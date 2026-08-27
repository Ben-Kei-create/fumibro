begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(20);

select has_function(
  'public',
  'admin_save_post',
  array[
    'uuid', 'integer', 'text', 'text', 'text', 'text', 'timestamp with time zone',
    'timestamp with time zone', 'content_status', 'uuid', 'uuid', 'uuid', 'uuid[]',
    'uuid', 'text', 'boolean', 'boolean', 'text'
  ],
  'canonical Blog save command exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_save_post(uuid,integer,text,text,text,text,timestamptz,timestamptz,content_status,uuid,uuid,uuid,uuid[],uuid,text,boolean,boolean,text)',
    'execute'
  ),
  'anonymous browsers cannot save Blog content'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_save_post(uuid,integer,text,text,text,text,timestamptz,timestamptz,content_status,uuid,uuid,uuid,uuid[],uuid,text,boolean,boolean,text)',
    'execute'
  ),
  'authenticated role can reach the AAL2-guarded Blog command'
);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;
insert into public.tags (id, label, slug)
values ('90000000-0000-4000-8000-000000000005', 'M4検証', 'm4-verification');
insert into public.locations (id, display_name, maps_query)
values ('91000000-0000-4000-8000-000000000005', '東京駅', '東京駅');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000005","aal":"aal1","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$
    select public.admin_save_post(
      null, null, 'm4-aal1-denied', null, null, 'blocked', now(), null,
      'draft', null, null, null, '{}', null, null, false, false, null
    )
  $$,
  '42501',
  null,
  'AAL1 cannot save Blog content'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000005","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$
    select public.admin_save_post(
      null,
      null,
      'm4-command-post',
      'M4投稿',
      '概要',
      '初回の日本語本文',
      now(),
      now(),
      'published',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000005',
      array['90000000-0000-4000-8000-000000000005'::uuid],
      null,
      'https://example.com',
      false,
      true,
      '初回公開'
    )
  $$,
  'AAL2 creates a published Blog post'
);
select ok(
  exists (
    select 1
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.slug = 'm4-command-post'
      and content.status = 'published'
      and post.body_markdown = '初回の日本語本文'
      and post.watermark_enabled
  ),
  'Blog root and detail are stored atomically'
);
select ok(
  (select search_text from public.content_items where slug = 'm4-command-post')
    like '%M4検証%',
  'central search text includes the selected tag'
);
select is(
  (
    select count(*)::bigint
    from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'm4-command-post'
  ),
  1::bigint,
  'initial publication stores a Revision'
);
select lives_ok(
  $$
    select public.admin_save_post(
      content.id,
      content.lock_version,
      content.slug,
      'M4投稿更新',
      content.excerpt,
      '更新した本文',
      content.posted_at,
      now(),
      'published',
      null,
      null,
      null,
      '{}',
      null,
      null,
      true,
      false,
      '本文更新'
    )
    from public.content_items as content
    where content.slug = 'm4-command-post'
  $$,
  'optimistic-lock update succeeds with the current version'
);
select is(
  (select feed_event_type from public.content_items where slug = 'm4-command-post'),
  'updated'::public.feed_event_type,
  'published edit appears as UPDATED in the feed projection'
);
select is(
  (
    select count(*)::bigint
    from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'm4-command-post'
  ),
  2::bigint,
  'editing snapshots the previous state'
);
select throws_ok(
  $$
    update public.posts
    set body_markdown = 'direct rewrite'
    where content_item_id = (
      select id from public.content_items where slug = 'm4-command-post'
    )
  $$,
  '42501',
  null,
  'authenticated browser cannot bypass the canonical Blog command'
);
select lives_ok(
  $$
    select public.admin_set_content_trashed(id, lock_version, true)
    from public.content_items
    where slug = 'm4-command-post'
  $$,
  'Blog post moves to Trash through the command'
);

set local role anon;
select is_empty(
  $$select id from public.content_items where slug = 'm4-command-post'$$,
  'Trash content is invisible to the public role'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000005","aal":"aal2","app_metadata":{"role":"admin"}}';
select lives_ok(
  $$
    select public.admin_set_content_trashed(id, lock_version, false)
    from public.content_items
    where slug = 'm4-command-post'
  $$,
  'Trash content can be restored'
);
select lives_ok(
  $$
    select public.admin_restore_content_revision(revision.id, content.id)
    from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'm4-command-post'
    order by revision.revision_no
    limit 1
  $$,
  'a prior Revision can be restored while preserving the current state first'
);

reset role;
insert into public.assets (
  id,
  kind,
  state,
  visibility,
  original_filename,
  mime_type,
  size_bytes,
  metadata,
  created_by
)
values (
  '92000000-0000-4000-8000-000000000005',
  'image',
  'processing',
  'private',
  'm4.jpg',
  'image/jpeg',
  100,
  '{"upload":{"object_path":"images/92000000-0000-4000-8000-000000000005/original.jpg"}}',
  '70000000-0000-4000-8000-000000000005'
);

set local role service_role;
select lives_ok(
  $$
    select public.service_finalize_processed_image(
      '92000000-0000-4000-8000-000000000005',
      'images/92000000-0000-4000-8000-000000000005/original.jpg',
      'image/jpeg',
      100,
      repeat('a', 64),
      100,
      50,
      'images/92000000-0000-4000-8000-000000000005/display.webp',
      80,
      repeat('b', 64),
      100,
      50,
      'images/92000000-0000-4000-8000-000000000005/thumbnail.webp',
      60,
      repeat('c', 64),
      100,
      50
    )
  $$,
  'service processor can atomically finalize validated image metadata'
);
select is(
  (
    select count(*)::integer
    from public.asset_variants
    where asset_id = '92000000-0000-4000-8000-000000000005'
  ),
  3,
  'finalized image has private original, display, and thumbnail variants'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000005","aal":"aal2","app_metadata":{"role":"admin"}}';
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
      content.publish_at,
      content.status,
      content.project_id,
      post.post_category_id,
      post.location_id,
      '{}',
      '92000000-0000-4000-8000-000000000005',
      post.external_url,
      post.is_spoiler,
      post.watermark_enabled,
      '画像追加'
    )
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.slug = 'm4-command-post'
  $$,
  'Blog command can attach a ready processed image'
);
select ok(
  (
    select position('public-media' in coalesce(with_check, '')) = 0
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_admin_insert'
  ),
  'Admin browser cannot bypass processing by writing public media directly'
);

select * from finish();
rollback;
