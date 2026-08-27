begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(14);

select has_function(
  'public',
  'search_public_content',
  array['text', 'integer', 'integer'],
  'PGroonga-backed public search facade exists'
);
select ok(
  has_function_privilege('anon', 'public.search_public_content(text,integer,integer)', 'execute'),
  'anonymous visitors can search the public projection'
);
select ok(
  not has_function_privilege('anon', 'public.service_create_comment(uuid,text,text,comment_status)', 'execute'),
  'anonymous browsers cannot call the comment write command directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.comments', 'insert'),
  'authenticated browsers cannot insert comments directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.library_files', 'insert'),
  'authenticated browsers cannot bypass the Library file command'
);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000007')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000007","aal":"aal1","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$
    select public.admin_add_library_file(
      '40000000-0000-4000-8000-000000000001',
      gen_random_uuid(), '1', 'denied.pdf', 0, true
    )
  $$,
  '42501',
  null,
  'AAL1 cannot attach a Library file'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000007","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$
    select public.admin_save_post(
      null, null, 'm6-search-post', '猫と日本語検索', '検索用概要',
      '京都で映画を見た記録', now(), now(), 'published', null, null, null,
      '{}', null, null, false, false, 'M6 search fixture'
    )
  $$,
  'AAL2 creates the search fixture'
);
select lives_ok(
  $$
    select public.admin_save_library_item(
      null, null, 'm6-download', 'M6 Download', 'free file', null,
      'download description', 'free_download', true, false, null, '{}',
      'published', now(), 'M6 delivery fixture'
    )
  $$,
  'AAL2 creates a free-download Library item'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    select public.service_create_comment(
      (select id from public.content_items where slug = 'm6-search-post'),
      'Reader', '承認待ちコメント', 'pending'
    )
  $$,
  'server-only comment command accepts a public post'
);
select ok(
  exists (
    select 1 from public.comments
    where body = '承認待ちコメント' and status = 'pending'
  ),
  'comment is persisted with its moderation status'
);

insert into public.assets (
  id, kind, state, visibility, original_filename, mime_type, size_bytes,
  created_by, metadata
) values (
  'a7000000-0000-4000-8000-000000000007', 'document', 'uploaded', 'private',
  'm6.pdf', 'application/pdf', 8,
  '70000000-0000-4000-8000-000000000007',
  '{"upload":{"declared_mime_type":"application/pdf","declared_size_bytes":8,"object_path":"library/m6/download.pdf"}}'
);
select lives_ok(
  $$
    select public.service_finalize_download_asset(
      'a7000000-0000-4000-8000-000000000007',
      'library/m6/download.pdf', 'application/pdf', 8,
      repeat('a', 64)
    )
  $$,
  'server validates metadata before making a private download attachable'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000007","aal":"aal2","app_metadata":{"role":"admin"}}';
select lives_ok(
  $$
    select public.admin_add_library_file(
      (select id from public.content_items where slug = 'm6-download'),
      'a7000000-0000-4000-8000-000000000007', '1', 'm6.pdf', 0, true
    )
  $$,
  'AAL2 attaches a validated private download'
);

reset role;
set local role service_role;
select ok(
  public.service_library_file_is_anonymously_downloadable(
    (select id from public.library_files where asset_id = 'a7000000-0000-4000-8000-000000000007')
  ),
  'server authorizes only the eligible free-download projection'
);

set local role anon;
select ok(
  exists (select 1 from public.search_public_content('京都', 20, 0) where slug = 'm6-search-post'),
  'Japanese query finds the published search_text via PGroonga'
);

select * from finish();
rollback;
