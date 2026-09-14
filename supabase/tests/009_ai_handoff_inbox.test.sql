begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(35);

select has_table('public', 'ai_handoff_inbox', 'AI Handoff Inbox table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_handoff_inbox'::regclass),
  'AI Handoff Inbox has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.ai_handoff_inbox', 'select'),
  'anonymous visitors have no Inbox table access'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_handoff_inbox', 'insert'),
  'authenticated browsers cannot insert Inbox rows directly'
);
select ok(
  not has_table_privilege('service_role', 'public.ai_handoff_inbox', 'insert'),
  'service integrations cannot insert Inbox rows directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.service_enqueue_ai_handoff(text,text,text,text,timestamptz,jsonb,uuid,public.ai_handoff_destination,text,text,text)',
    'execute'
  ),
  'anonymous visitors cannot execute the service enqueue command'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.service_enqueue_ai_handoff(text,text,text,text,timestamptz,jsonb,uuid,public.ai_handoff_destination,text,text,text)',
    'execute'
  ),
  'authenticated browsers cannot execute the service enqueue command'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.service_enqueue_ai_handoff(text,text,text,text,timestamptz,jsonb,uuid,public.ai_handoff_destination,text,text,text)',
    'execute'
  ),
  'service role can execute the narrow enqueue command'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_convert_ai_handoff(uuid,public.ai_handoff_destination,uuid)',
    'execute'
  ),
  'anonymous visitors cannot execute the Admin conversion command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_convert_ai_handoff(uuid,public.ai_handoff_destination,uuid)',
    'execute'
  ),
  'authenticated sessions can reach the AAL2-guarded conversion command'
);
select ok(
  not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'admin_convert_ai_handoff',
        'admin_ignore_ai_handoff',
        'admin_mark_ai_handoff_error'
      )
      and has_function_privilege('service_role', procedure.oid, 'execute')
  ),
  'service integrations cannot execute human review commands'
);

set local role service_role;

select lives_ok(
  $$
    select public.service_enqueue_ai_handoff(
      'gemini',
      'drive:test-handoff-001',
      'Gemini handoff test',
      'https://docs.google.com/document/d/test-handoff-001',
      '2026-08-30T00:00:00Z',
      '{"source":"pgTap"}'::jsonb,
      '10000000-0000-4000-8000-000000000005',
      'blog',
      'AI Inbox test draft',
      'AI Handoff Inboxから作成するテスト本文です。',
      'https://example.com/handoff-test'
    )
  $$,
  'service enqueue accepts a bounded Gemini candidate'
);

select lives_ok(
  $$
    select public.service_enqueue_ai_handoff(
      'gemini',
      'drive:test-handoff-001',
      'A duplicate must not overwrite the first candidate',
      'https://docs.google.com/document/d/test-handoff-001',
      '2026-08-30T00:00:00Z',
      '{"source":"duplicate"}'::jsonb,
      null,
      'works',
      'Duplicate',
      'Duplicate',
      null
    )
  $$,
  'repeating the same source identity is safe'
);

select lives_ok(
  $$
    select public.service_enqueue_ai_handoff(
      'gemini', candidate.external_id, candidate.title, null,
      '2026-08-30T00:00:00Z',
      jsonb_build_object('source', 'pgTap', 'candidate', candidate.external_id),
      null, candidate.destination::public.ai_handoff_destination,
      candidate.title, candidate.body, null
    )
    from (
      values
        ('drive:test-handoff-work', 'AI Work draft', 'works', 'Works本文'),
        ('drive:test-handoff-library', 'AI Library draft', 'library', 'Library本文'),
        ('drive:test-handoff-portfolio', 'AI Portfolio draft', 'portfolio', 'Portfolio本文'),
        ('drive:test-handoff-notice', 'AI Notice draft', 'notice', '掲示板本文'),
        ('drive:test-handoff-ignore', 'Ignored candidate', 'none', '無視する本文')
    ) as candidate(external_id, title, destination, body)
  $$,
  'service enqueue accepts candidates for every review choice'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.ai_handoff_inbox
    where source_system = 'gemini'
      and source_external_id = 'drive:test-handoff-001'
  ),
  1::bigint,
  'source identity is idempotent'
);
select ok(
  exists (
    select 1
    from public.ai_handoff_inbox
    where source_system = 'gemini'
      and source_external_id = 'drive:test-handoff-001'
      and source_title = 'Gemini handoff test'
      and status = 'pending'
      and reviewed_at is null
  ),
  'an enqueued candidate is pending and the duplicate did not overwrite it'
);
select is(
  (
    select count(*)::bigint
    from public.admin_audit_events
    where action = 'ai_handoff.enqueued'
      and entity_type = 'ai_handoff_inbox'
  ),
  6::bigint,
  'each unique enqueue writes exactly one audit event'
);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000009')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000009","aal":"aal1","app_metadata":{"role":"admin"}}';

select is(
  (select count(*)::bigint from public.ai_handoff_inbox),
  0::bigint,
  'AAL1 Admin cannot read Inbox rows'
);
select throws_ok(
  $$
    select public.admin_convert_ai_handoff(
      '00000000-0000-0000-0000-000000000000',
      null,
      null
    )
  $$,
  '42501',
  null,
  'AAL1 authorization fails before conversion input is inspected'
);
select throws_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox limit 1),
      'blog',
      null
    )
  $$,
  '42501',
  null,
  'AAL1 Admin cannot convert a candidate'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000009","aal":"aal2","app_metadata":{"role":"admin"}}';

select is(
  (select count(*)::bigint from public.ai_handoff_inbox where status = 'pending'),
  6::bigint,
  'AAL2 Admin can read all pending Inbox rows'
);
select lives_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox where status = 'pending' limit 1),
      'blog',
      null
    )
  $$,
  'AAL2 Admin can convert the candidate through the canonical Blog command'
);
select lives_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox where source_external_id = 'drive:test-handoff-work'),
      'works', null
    )
  $$,
  'AAL2 Admin can convert a Works candidate'
);
select lives_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox where source_external_id = 'drive:test-handoff-library'),
      'library', null
    )
  $$,
  'AAL2 Admin can convert a Library candidate'
);
select lives_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox where source_external_id = 'drive:test-handoff-portfolio'),
      'portfolio', null
    )
  $$,
  'AAL2 Admin can convert a Portfolio candidate through Works'
);
select lives_ok(
  $$
    select public.admin_convert_ai_handoff(
      (select id from public.ai_handoff_inbox where source_external_id = 'drive:test-handoff-notice'),
      'notice', null
    )
  $$,
  'AAL2 Admin can convert a notice candidate'
);
select lives_ok(
  $$
    select public.admin_ignore_ai_handoff(
      (select id from public.ai_handoff_inbox where source_external_id = 'drive:test-handoff-ignore')
    )
  $$,
  'AAL2 Admin can ignore a candidate without creating content'
);

reset role;

select ok(
  exists (
    select 1
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.source_system = 'gemini'
      and content.source_external_id = 'drive:test-handoff-001'
      and content.status = 'draft'
      and post.body_markdown = 'AI Handoff Inboxから作成するテスト本文です。'
  ),
  'conversion creates one canonical Blog draft with source provenance'
);
select ok(
  exists (
    select 1
    from public.content_items as content
    join public.works as work on work.content_item_id = content.id
    where content.source_external_id = 'drive:test-handoff-work'
      and content.kind = 'work'
      and content.status = 'draft'
      and not work.show_in_portfolio
  )
  and exists (
    select 1
    from public.content_items as content
    join public.works as work on work.content_item_id = content.id
    where content.source_external_id = 'drive:test-handoff-portfolio'
      and content.kind = 'work'
      and content.status = 'draft'
      and work.show_in_portfolio
  )
  and exists (
    select 1
    from public.content_items as content
    join public.library_items as library on library.content_item_id = content.id
    where content.source_external_id = 'drive:test-handoff-library'
      and content.kind = 'library'
      and content.status = 'draft'
      and library.access_policy_code = 'public'
      and not library.download_enabled
  )
  and exists (
    select 1
    from public.ai_handoff_inbox as inbox
    join public.notices as notice on notice.id = inbox.notice_id
    where inbox.source_external_id = 'drive:test-handoff-notice'
      and inbox.status = 'approved'
      and notice.status = 'draft'
  ),
  'every destination uses its canonical draft structure'
);
select ok(
  exists (
    select 1
    from public.ai_handoff_inbox
    where source_external_id = 'drive:test-handoff-ignore'
      and status = 'ignored'
      and content_item_id is null
      and notice_id is null
  ),
  'ignoring a candidate records review without canonical content'
);
select ok(
  exists (
    select 1
    from public.ai_handoff_inbox as inbox
    where inbox.source_external_id = 'drive:test-handoff-001'
      and inbox.status = 'approved'
      and inbox.content_item_id is not null
      and inbox.reviewed_by = '70000000-0000-4000-8000-000000000009'
      and inbox.reviewed_at is not null
  ),
  'conversion records the human review and canonical content reference'
);
select is(
  (
    select count(*)::bigint
    from public.admin_audit_events
    where action = 'ai_handoff.converted'
      and entity_type = 'ai_handoff_inbox'
  ),
  5::bigint,
  'each conversion writes an Admin audit event'
);
select is(
  (
    select count(*)::bigint
    from public.admin_audit_events
    where action = 'ai_handoff.ignored'
      and entity_type = 'ai_handoff_inbox'
  ),
  1::bigint,
  'ignoring a candidate writes an Admin audit event'
);

select lives_ok(
  $$
    select public.admin_save_post(
      content.id,
      content.lock_version,
      content.slug,
      content.title,
      content.excerpt,
      post.body_markdown,
      content.posted_at,
      now(),
      'published',
      content.project_id,
      post.post_category_id,
      post.location_id,
      '{}'::uuid[],
      post.image_asset_id,
      post.external_url,
      post.is_spoiler,
      post.watermark_enabled,
      'AI Handoff publish test'
    )
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.source_system = 'gemini'
      and content.source_external_id = 'drive:test-handoff-001'
  $$,
  'the existing Blog command can publish the reviewed draft later'
);

reset role;

select ok(
  exists (
    select 1
    from public.ai_handoff_inbox
    where source_external_id = 'drive:test-handoff-001'
      and status = 'published'
      and published_at is not null
  ),
  'publishing canonical content advances the linked Inbox status'
);

select * from finish();
rollback;
