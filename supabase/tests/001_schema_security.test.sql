begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(31);

select ok(to_regclass('public.projects') is not null, 'projects table exists');
select ok(to_regclass('public.content_items') is not null, 'content_items table exists');
select ok(to_regclass('public.posts') is not null, 'posts table exists');
select ok(to_regclass('public.works') is not null, 'works table exists');
select ok(to_regclass('public.library_items') is not null, 'library_items table exists');
select ok(to_regclass('public.content_revisions') is not null, 'content_revisions table exists');
select ok(to_regclass('public.contact_inquiries') is not null, 'contact_inquiries table exists');
select ok(to_regclass('public.business_cards') is not null, 'business_cards table exists');

select ok(
  exists (select 1 from pg_extension where extname = 'pgroonga'),
  'PGroonga extension is enabled'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'content_items_search_text_pgroonga_idx'
      and indexdef ilike '%using pgroonga%search_text%'
  ),
  'search_text has a PGroonga index'
);

select ok(
  not exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  'every exposed public table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.rate_limit_buckets'::regclass),
  'private rate limit storage has defense-in-depth RLS'
);
select ok(
  to_regclass('private.ai_handoff_inbox') is null,
  'Phase 2 AI handoff inbox is not created in Phase 1'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_items'
      and column_name = 'source_external_id'
  ),
  'source_external_id exists'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_items'
      and column_name = 'search_text'
  ),
  'search_text exists'
);
select ok(
  not has_column_privilege('anon', 'public.content_items', 'source_external_id', 'select'),
  'anon cannot read source provenance'
);
select ok(
  has_column_privilege('anon', 'public.content_items', 'search_text', 'select'),
  'anon can query the safe search projection column'
);
select ok(
  not has_table_privilege('anon', 'public.contact_inquiries', 'insert'),
  'anon has no direct contact write grant'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.service_register_post_like(uuid,bytea)',
    'execute'
  ),
  'anon cannot execute service like RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.service_register_post_like(uuid,bytea)',
    'execute'
  ),
  'authenticated browser sessions cannot execute service like RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.service_register_post_like(uuid,bytea)',
    'execute'
  ),
  'service role can execute service like RPC'
);
select ok(
  not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where procedure.prosecdef
      and namespace.nspname in ('public', 'private')
      and not coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=pg_catalog']
  ),
  'every security-definer function fixes search_path to pg_catalog'
);
select ok(
  not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.prosecdef
      and (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        or has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
  ),
  'private security-definer functions are not executable by browser roles'
);

select is(
  (select count(*)::integer from storage.buckets
   where id in ('private-originals', 'public-media', 'private-downloads')),
  3,
  'three responsibility-specific Storage buckets exist'
);
select is(
  (select public from storage.buckets where id = 'public-media'),
  true,
  'processed media bucket is public'
);
select is(
  (select public from storage.buckets where id = 'private-originals'),
  false,
  'originals bucket is private'
);
select is(
  (select public from storage.buckets where id = 'private-downloads'),
  false,
  'downloads bucket is private'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname like 'storage_admin_%'),
  4,
  'Storage has explicit admin policies for each operation'
);

select is(
  (select count(*)::integer from public.content_source_systems),
  7,
  'all approved source systems are seeded'
);
select is(
  (select count(*)::integer from public.library_access_policies),
  5,
  'all Library access policies are seeded'
);
select ok(
  exists (
    select 1
    from public.pages as page
    join public.content_items as content on content.id = page.content_item_id
    where page.page_key = 'privacy'
      and page.is_system
      and content.slug = 'privacy'
      and content.status = 'published'
      and content.deleted_at is null
  ),
  'Privacy is a protected published system page'
);

select * from finish();
rollback;
