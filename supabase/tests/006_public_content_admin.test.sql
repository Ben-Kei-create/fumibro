begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(15);

select has_function(
  'public',
  'admin_save_work',
  array[
    'uuid', 'integer', 'text', 'text', 'text', 'uuid', 'text', 'text', 'uuid',
    'date', 'text', 'text', 'boolean', 'integer', 'boolean', 'integer', 'uuid[]',
    'content_status', 'timestamp with time zone', 'text'
  ],
  'canonical Work save command exists'
);
select has_function(
  'public',
  'admin_save_library_item',
  array[
    'uuid', 'integer', 'text', 'text', 'text', 'uuid', 'text', 'text',
    'boolean', 'boolean', 'uuid', 'uuid[]', 'content_status',
    'timestamp with time zone', 'text'
  ],
  'canonical Library save command exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_save_page(uuid,integer,text,text,text,text,content_status,timestamptz,text)',
    'execute'
  ),
  'anonymous browser cannot update Pages'
);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000006","aal":"aal1","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$
    select public.admin_save_work(
      null, null, 'm5-denied', 'Denied', null, null, null, '', null, null,
      null, 'other', false, 0, false, 0, '{}', 'draft', null, null
    )
  $$,
  '42501',
  null,
  'AAL1 cannot save Works'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000006","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$
    select public.admin_save_work(
      null, null, 'm5-work', 'M5 Work', 'excerpt',
      '10000000-0000-4000-8000-000000000006', 'summary', 'description',
      null, current_date, 'https://example.com', 'web_app', true, 1, true, 1,
      '{}', 'published', now(), 'initial publication'
    )
  $$,
  'AAL2 creates a Work'
);
select ok(
  exists (
    select 1 from public.content_items as content
    join public.works as work on work.content_item_id = content.id
    where content.slug = 'm5-work'
      and content.status = 'published'
      and work.show_on_home
      and work.show_in_portfolio
  ),
  'Work projections share one canonical row'
);
select is(
  (
    select count(*)::bigint from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'm5-work'
  ),
  1::bigint,
  'initial Work publication stores a Revision'
);

select lives_ok(
  $$
    select public.admin_save_library_item(
      null, null, 'm5-library', 'M5 Library', 'excerpt', null, 'description',
      'restricted', false, false, null, '{}', 'published', now(), 'publish'
    )
  $$,
  'AAL2 creates a restricted Library item'
);
select is(
  (
    select library.access_policy_code from public.library_items as library
    join public.content_items as content on content.id = library.content_item_id
    where content.slug = 'm5-library'
  ),
  'restricted',
  'Library access policy is persisted separately from visibility'
);

select throws_ok(
  $$
    select public.admin_save_page(
      content.id, content.lock_version, content.title, content.excerpt,
      page.body_markdown, page.seo_description, 'hidden', content.publish_at,
      'attempt to hide system page'
    )
    from public.content_items as content
    join public.pages as page on page.content_item_id = content.id
    where page.page_key = 'privacy'
  $$,
  '23514',
  null,
  'Privacy system Page must stay published'
);
select lives_ok(
  $$
    select public.admin_save_page(
      content.id, content.lock_version, content.title, content.excerpt,
      page.body_markdown || E'\n\nUpdated', page.seo_description,
      'published', content.publish_at, 'Privacy copy update'
    )
    from public.content_items as content
    join public.pages as page on page.content_item_id = content.id
    where page.page_key = 'privacy'
  $$,
  'AAL2 updates Privacy while preserving its identity'
);
select ok(
  exists (
    select 1 from public.content_revisions as revision
    where revision.content_item_id = '40000000-0000-4000-8000-000000000002'
  ),
  'Page update snapshots the prior state'
);
select ok(
  not has_table_privilege('authenticated', 'public.content_items', 'update'),
  'authenticated browser cannot bypass canonical commands'
);
select ok(
  not has_table_privilege('authenticated', 'public.works', 'update')
    and not has_table_privilege('authenticated', 'public.library_items', 'update')
    and not has_table_privilege('authenticated', 'public.pages', 'update'),
  'canonical child tables cannot bypass Revision commands'
);
insert into public.projects (id, slug, name)
values ('94000000-0000-4000-8000-000000000006', 'm5-project', 'M5 Project');
select ok(
  exists (
    select 1 from public.visit_counters
    where project_id = '94000000-0000-4000-8000-000000000006'
      and total = 0
  ),
  'new Project receives an independent unique visitor counter'
);

select * from finish();
rollback;
