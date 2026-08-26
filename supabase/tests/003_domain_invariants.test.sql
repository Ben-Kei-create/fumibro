begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(14);

insert into public.content_items (id, kind, project_id, slug, status)
values (
  '81000000-0000-4000-8000-000000000001',
  'post',
  '10000000-0000-4000-8000-000000000001',
  'canonical-slug',
  'draft'
);

select throws_ok(
  $$
    insert into public.content_items (id, kind, project_id, slug, status)
    values (
      '81000000-0000-4000-8000-000000000002',
      'post',
      '10000000-0000-4000-8000-000000000002',
      'canonical-slug',
      'draft'
    )
  $$,
  '23505',
  null,
  'canonical content slug stays unique across Projects'
);

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  status,
  source_system,
  source_external_id
)
values (
  '81000000-0000-4000-8000-000000000003',
  'work',
  'imported-work',
  'Imported work',
  'draft',
  'kdp',
  'book-001'
);

update public.content_items
set deleted_at = now()
where id = '81000000-0000-4000-8000-000000000003';

select throws_ok(
  $$
    insert into public.content_items (
      id,
      kind,
      slug,
      title,
      status,
      source_system,
      source_external_id
    )
    values (
      '81000000-0000-4000-8000-000000000004',
      'work',
      'imported-work-copy',
      'Imported work copy',
      'draft',
      'kdp',
      'book-001'
    )
  $$,
  '23505',
  null,
  'source identity remains unique while the original is in Trash'
);

insert into public.content_items (
  id,
  kind,
  project_id,
  slug,
  status,
  publish_at,
  first_published_at,
  feed_at,
  feed_event_type
)
values (
  '82000000-0000-4000-8000-000000000001',
  'post',
  '10000000-0000-4000-8000-000000000001',
  'searchable-post',
  'published',
  now() - interval '1 hour',
  now() - interval '1 hour',
  now() - interval '1 hour',
  'new'
);

insert into public.posts (content_item_id, body_markdown)
values (
  '82000000-0000-4000-8000-000000000001',
  '日本語の本文を検索できます'
);

insert into public.tags (id, label, slug)
values ('82000000-0000-4000-8000-000000000002', '理科教材', 'science-material');

insert into public.content_tags (content_item_id, tag_id)
values (
  '82000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000002'
);

select ok(
  (select search_text like '%Give教育%' from public.content_items
   where id = '82000000-0000-4000-8000-000000000001'),
  'search_text includes the Project name'
);
select ok(
  (select search_text like '%理科教材%' from public.content_items
   where id = '82000000-0000-4000-8000-000000000001'),
  'search_text includes tag labels'
);
select ok(
  (select search_text like '%日本語の本文%' from public.content_items
   where id = '82000000-0000-4000-8000-000000000001'),
  'search_text includes detail body text'
);

select throws_ok(
  $$
    update public.content_items
    set deleted_at = now()
    where id = '40000000-0000-4000-8000-000000000002'
  $$,
  '23514',
  null,
  'Privacy system Page cannot be moved to Trash'
);

select is(
  (select accepted from public.service_register_post_like(
    '82000000-0000-4000-8000-000000000001',
    decode(repeat('ab', 32), 'hex')
  )),
  true,
  'first like from a visitor is accepted'
);
select is(
  (select accepted from public.service_register_post_like(
    '82000000-0000-4000-8000-000000000001',
    decode(repeat('ab', 32), 'hex')
  )),
  false,
  'duplicate like from the same visitor is ignored'
);
select is(
  (select like_count from public.post_like_counts
   where post_id = '82000000-0000-4000-8000-000000000001'),
  1::bigint,
  'duplicate likes do not inflate the total'
);

select is(
  (select accepted from public.service_register_site_visit(
    decode(repeat('cd', 32), 'hex')
  )),
  true,
  'first site visit from a visitor is accepted'
);
select is(
  (select accepted from public.service_register_site_visit(
    decode(repeat('cd', 32), 'hex')
  )),
  false,
  'duplicate site visit from the same visitor is ignored'
);
select is(
  (select total from public.visit_counters where scope_key = 'site'),
  1::bigint,
  'duplicate site visits do not inflate the total'
);

insert into public.assets (
  id,
  kind,
  state,
  visibility,
  original_filename,
  mime_type,
  size_bytes
)
values (
  '83000000-0000-4000-8000-000000000001',
  'document',
  'ready',
  'private',
  'guide.pdf',
  'application/pdf',
  10
);

insert into public.asset_variants (
  asset_id,
  variant_role,
  bucket_id,
  object_path,
  mime_type,
  size_bytes,
  checksum_sha256
)
values (
  '83000000-0000-4000-8000-000000000001',
  'download',
  'private-downloads',
  'library/guide.pdf',
  'application/pdf',
  10,
  repeat('0', 64)
);

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  status,
  publish_at,
  first_published_at,
  feed_at,
  feed_event_type
)
values (
  '83000000-0000-4000-8000-000000000002',
  'library',
  'private-guide',
  'Private guide',
  'published',
  now() - interval '1 hour',
  now() - interval '1 hour',
  now() - interval '1 hour',
  'new'
);

insert into public.library_items (
  content_item_id,
  description_markdown,
  access_policy_code,
  download_enabled
)
values (
  '83000000-0000-4000-8000-000000000002',
  'A future paid download',
  'paid',
  true
);

insert into public.library_files (
  id,
  library_item_id,
  asset_id,
  display_name,
  is_primary
)
values (
  '83000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000001',
  'guide.pdf',
  true
);

select is(
  public.service_library_file_is_anonymously_downloadable(
    '83000000-0000-4000-8000-000000000003'
  ),
  false,
  'paid Library content denies anonymous download in Phase 1'
);

update public.library_items
set access_policy_code = 'free_download'
where content_item_id = '83000000-0000-4000-8000-000000000002';

select is(
  public.service_library_file_is_anonymously_downloadable(
    '83000000-0000-4000-8000-000000000003'
  ),
  true,
  'free_download content can be delivered when explicitly enabled'
);

select * from finish();
rollback;
