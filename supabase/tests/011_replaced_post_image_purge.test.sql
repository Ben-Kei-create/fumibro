begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(17);

select has_function(
  'public',
  'service_prepare_replaced_post_image_purge',
  array['uuid', 'uuid', 'uuid'],
  'service prepare command exists'
);
select has_function(
  'public',
  'service_complete_replaced_post_image_purge',
  array['uuid', 'uuid', 'uuid'],
  'service complete command exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.service_prepare_replaced_post_image_purge(uuid,uuid,uuid)',
    'execute'
  ),
  'anonymous users cannot prepare image deletion'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.service_prepare_replaced_post_image_purge(uuid,uuid,uuid)',
    'execute'
  ),
  'browser sessions cannot prepare image deletion'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.service_prepare_replaced_post_image_purge(uuid,uuid,uuid)',
    'execute'
  ),
  'service role can prepare image deletion'
);

insert into auth.users (id, raw_app_meta_data)
values (
  '70000000-0000-4000-8000-000000000011',
  '{"role":"admin"}'::jsonb
)
on conflict (id) do update set raw_app_meta_data = excluded.raw_app_meta_data;

insert into public.assets (
  id, kind, state, visibility, original_filename, mime_type, size_bytes,
  width, height, created_by
)
values
  (
    '92000000-0000-4000-8000-000000000011', 'image', 'ready', 'public',
    'old.png', 'image/png', 4096, 1600, 900,
    '70000000-0000-4000-8000-000000000011'
  ),
  (
    '92000000-0000-4000-8000-000000000012', 'image', 'ready', 'public',
    'new.png', 'image/png', 4096, 1600, 900,
    '70000000-0000-4000-8000-000000000011'
  );

insert into public.asset_variants (
  asset_id, variant_role, bucket_id, object_path, mime_type, size_bytes,
  checksum_sha256, width, height
)
values
  (
    '92000000-0000-4000-8000-000000000011', 'original',
    'private-originals',
    'images/92000000-0000-4000-8000-000000000011/original.png',
    'image/png', 4096, repeat('a', 64), 1600, 900
  ),
  (
    '92000000-0000-4000-8000-000000000011', 'display',
    'public-media',
    'images/92000000-0000-4000-8000-000000000011/display.webp',
    'image/webp', 2048, repeat('b', 64), 1600, 900
  ),
  (
    '92000000-0000-4000-8000-000000000011', 'thumbnail',
    'public-media',
    'images/92000000-0000-4000-8000-000000000011/thumbnail.webp',
    'image/webp', 512, repeat('c', 64), 640, 360
  ),
  (
    '92000000-0000-4000-8000-000000000012', 'original',
    'private-originals',
    'images/92000000-0000-4000-8000-000000000012/original.png',
    'image/png', 4096, repeat('d', 64), 1600, 900
  ),
  (
    '92000000-0000-4000-8000-000000000012', 'display',
    'public-media',
    'images/92000000-0000-4000-8000-000000000012/display.webp',
    'image/webp', 2048, repeat('e', 64), 1600, 900
  ),
  (
    '92000000-0000-4000-8000-000000000012', 'thumbnail',
    'public-media',
    'images/92000000-0000-4000-8000-000000000012/thumbnail.webp',
    'image/webp', 512, repeat('f', 64), 640, 360
  );

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000011","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$
    select public.admin_save_post(
      null, null, 'replace-image-test', '差し替えテスト', null, '本文',
      now(), now(), 'published', null, null, null, '{}',
      '92000000-0000-4000-8000-000000000011', null, false, false, '初回'
    )
  $$,
  'post starts with the old top image'
);

select lives_ok(
  $$
    select public.admin_save_post(
      content.id, content.lock_version, content.slug, content.title,
      content.excerpt, '本文更新', content.posted_at, content.publish_at,
      content.status, content.project_id, null, null, '{}',
      '92000000-0000-4000-8000-000000000012', null, false, false, '画像差し替え'
    )
    from public.content_items as content
    where content.slug = 'replace-image-test'
  $$,
  'post switches to the new top image through the canonical command'
);

reset role;

select ok(
  exists (
    select 1
    from public.content_revision_assets
    where asset_id = '92000000-0000-4000-8000-000000000011'
  ),
  'the update initially snapshots the old image'
);

set local role service_role;

select lives_ok(
  $$
    select public.service_prepare_replaced_post_image_purge(
      (select id from public.content_items where slug = 'replace-image-test'),
      '92000000-0000-4000-8000-000000000011',
      '70000000-0000-4000-8000-000000000011'
    )
  $$,
  'service prepares the unreferenced old image for Storage deletion'
);

reset role;

select is(
  (select state from public.assets where id = '92000000-0000-4000-8000-000000000011'),
  'processing'::public.asset_state,
  'prepared image is unavailable while Storage deletion runs'
);
select ok(
  (select deleted_at is not null from public.assets where id = '92000000-0000-4000-8000-000000000011'),
  'prepared image is soft hidden'
);

set local role service_role;

select lives_ok(
  $$
    select public.service_complete_replaced_post_image_purge(
      (select id from public.content_items where slug = 'replace-image-test'),
      '92000000-0000-4000-8000-000000000011',
      '70000000-0000-4000-8000-000000000011'
    )
  $$,
  'service completes deletion after Storage succeeds'
);

reset role;

select ok(
  not exists (
    select 1 from public.assets
    where id = '92000000-0000-4000-8000-000000000011'
  ),
  'old asset row is deleted'
);
select ok(
  not exists (
    select 1 from public.asset_variants
    where asset_id = '92000000-0000-4000-8000-000000000011'
  ),
  'old variant metadata cascades away'
);
select ok(
  not exists (
    select 1 from public.content_revision_assets
    where asset_id = '92000000-0000-4000-8000-000000000011'
  ),
  'old revision asset references are removed'
);
select ok(
  not exists (
    select 1
    from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'replace-image-test'
      and revision.snapshot #>> '{detail,image_asset_id}' =
        '92000000-0000-4000-8000-000000000011'
  ),
  'revision snapshots no longer restore the erased image'
);
select is(
  (
    select count(*)::bigint
    from public.admin_audit_events
    where action = 'post.top_image_replaced'
  ),
  1::bigint,
  'top-image erasure is audited'
);

select * from finish();
rollback;
