begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(29);

select has_table('public', 'downloadable_images', 'downloadable images table exists');
select has_table('public', 'downloadable_image_tags', 'downloadable image tags table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.downloadable_images'::regclass), 'downloadable images has RLS');
select ok(not has_table_privilege('anon', 'public.downloadable_images', 'insert'), 'anonymous users cannot insert image metadata');
select ok(not has_table_privilege('authenticated', 'public.downloadable_images', 'update'), 'authenticated browsers cannot update metadata directly');
select ok(not has_function_privilege('anon', 'public.admin_save_downloadable_image(uuid,integer,text,text,text,text,uuid,text,text,public.image_license_type,public.image_distribution_clearance,public.content_status,boolean,boolean,timestamptz,uuid,uuid,uuid[])', 'execute'), 'anonymous users cannot execute Admin command');
select ok(has_function_privilege('authenticated', 'public.admin_save_downloadable_image(uuid,integer,text,text,text,text,uuid,text,text,public.image_license_type,public.image_distribution_clearance,public.content_status,boolean,boolean,timestamptz,uuid,uuid,uuid[])', 'execute'), 'authenticated role can reach AAL2 command');
select ok(not has_function_privilege('service_role', 'public.admin_save_downloadable_image(uuid,integer,text,text,text,text,uuid,text,text,public.image_license_type,public.image_distribution_clearance,public.content_status,boolean,boolean,timestamptz,uuid,uuid,uuid[])', 'execute'), 'service role cannot execute the human Admin command');
select ok(not has_function_privilege('authenticated', 'public.service_record_downloadable_image_download(uuid)', 'execute'), 'browser role cannot increment downloads');
select ok(has_function_privilege('service_role', 'public.service_record_downloadable_image_download(uuid)', 'execute'), 'service role can issue downloads');

insert into auth.users (id) values ('70000000-0000-4000-8000-000000000010') on conflict (id) do nothing;
insert into public.tags (id, label, slug) values ('90000000-0000-4000-8000-000000000010', 'Images検証', 'images-verification');
insert into public.assets (id, kind, state, visibility, original_filename, mime_type, size_bytes, width, height, created_by)
values ('92000000-0000-4000-8000-000000000010', 'image', 'ready', 'public', 'test.png', 'image/png', 4096, 1600, 1200, '70000000-0000-4000-8000-000000000010');
insert into public.asset_variants (asset_id, variant_role, bucket_id, object_path, mime_type, size_bytes, checksum_sha256, width, height)
values
  ('92000000-0000-4000-8000-000000000010', 'original', 'private-originals', 'images/92000000-0000-4000-8000-000000000010/original.png', 'image/png', 4096, repeat('a', 64), 1600, 1200),
  ('92000000-0000-4000-8000-000000000010', 'display', 'public-media', 'images/92000000-0000-4000-8000-000000000010/display.webp', 'image/webp', 2048, repeat('b', 64), 1600, 1200),
  ('92000000-0000-4000-8000-000000000010', 'thumbnail', 'public-media', 'images/92000000-0000-4000-8000-000000000010/thumbnail.webp', 'image/webp', 512, repeat('c', 64), 640, 480),
  ('92000000-0000-4000-8000-000000000010', 'download', 'private-downloads', 'images/92000000-0000-4000-8000-000000000010/download.webp', 'image/webp', 3072, repeat('d', 64), 1600, 1200);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"70000000-0000-4000-8000-000000000010","aal":"aal1","app_metadata":{"role":"admin"}}';
select throws_ok($$select public.admin_save_downloadable_image(null,null,'AAL1','aal1-image','AAL1 cannot create this image metadata.', '',null,null,'manual','personal','cleared','draft',false,false,null,'92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000010','{}')$$, '42501', null, 'AAL1 cannot save image metadata');

set local "request.jwt.claims" = '{"sub":"70000000-0000-4000-8000-000000000010","aal":"aal2","app_metadata":{"role":"admin"}}';
select lives_ok($$select public.admin_save_downloadable_image(null,null,'KDP画像','kdp-image','KDP由来の検証用画像説明です。公開前の権利確認が必要です。','教材や記事の挿絵として利用する例です。','10000000-0000-4000-8000-000000000005','Wonderloom test','kdp','personal','cleared','draft',false,false,null,'92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000010',array['90000000-0000-4000-8000-000000000010'::uuid])$$, 'AAL2 creates a KDP draft');
select is((select distribution_clearance from public.downloadable_images where slug = 'kdp-image'), 'review_required'::public.image_distribution_clearance, 'new KDP image defaults to review required');
select is((select count(*)::bigint from public.downloadable_image_tags where downloadable_image_id = (select id from public.downloadable_images where slug = 'kdp-image')), 1::bigint, 'tags are stored through the command');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='downloadable_images_asset_uidx'), 'one asset can back only one gallery image');
select throws_ok($$update public.downloadable_images set title = 'direct' where slug = 'kdp-image'$$, '42501', null, 'direct metadata updates are denied');
select lives_ok($$select public.admin_save_downloadable_image(image.id,image.lock_version,image.title,image.slug,image.description,image.use_examples,image.project_id,image.source_work_title,image.source_system,image.license_type,'cleared','published',true,true,now(),image.asset_id,image.download_asset_id,array['90000000-0000-4000-8000-000000000010'::uuid]) from public.downloadable_images image where image.slug='kdp-image'$$, 'AAL2 clears and publishes the reviewed image');
select is((select count(*)::bigint from public.admin_audit_events where entity_type='downloadable_image'), 2::bigint, 'create and update are audited');

set local role anon;
select is((select count(*)::bigint from public.downloadable_images where slug='kdp-image'), 1::bigint, 'published cleared image is visible anonymously');
select throws_ok($$select public.service_record_downloadable_image_download((select id from public.downloadable_images where slug='kdp-image'))$$, '42501', null, 'anonymous users cannot call the delivery command');

reset role;
set local role service_role;
select results_eq($$select object_path,download_filename,mime_type from public.service_record_downloadable_image_download((select id from public.downloadable_images where slug='kdp-image'))$$, $$values ('images/92000000-0000-4000-8000-000000000010/download.webp'::text,'kdp-image-standard.webp'::text,'image/webp'::text)$$, 'service delivery returns only the standard private variant');
reset role;
select is((select download_count from public.downloadable_images where slug='kdp-image'), 1::bigint, 'successful issuance increments the anonymous count');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='downloadable_images' and column_name in ('ip','raw_ip','ip_address','visitor_ip')), 'download metadata stores no IP address');
select ok(exists(select 1 from public.asset_variants where asset_id='92000000-0000-4000-8000-000000000010' and variant_role='original' and bucket_id='private-originals'), 'master remains private');
select ok(exists(select 1 from public.asset_variants where asset_id='92000000-0000-4000-8000-000000000010' and variant_role='download' and bucket_id='private-downloads'), 'download variant remains private');
select ok(not exists(select 1 from public.asset_variants where asset_id='92000000-0000-4000-8000-000000000010' and variant_role='original' and bucket_id='public-media'), 'raw master is never public media');
select is((select count(*)::bigint from public.downloadable_images where source_system='kdp' and status='published'), 1::bigint, 'reviewed KDP image can be published explicitly');
select ok((select 'image/webp'::text = any(allowed_mime_types) from storage.buckets where id='private-downloads'), 'private downloads accepts the processed WebP delivery variant');
select ok(exists(select 1 from pg_trigger where tgrelid='public.downloadable_images'::regclass and tgname='downloadable_images_enforce_kdp_review' and not tgisinternal), 'KDP reclassification is protected by a database trigger');

select * from finish();
rollback;
