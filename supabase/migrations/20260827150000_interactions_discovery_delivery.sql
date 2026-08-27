-- Milestone 6: public comments/search and private Library delivery commands.

create function public.search_public_content(
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  kind public.content_kind,
  slug text,
  title text,
  excerpt text,
  project_id uuid,
  publish_at timestamptz,
  feed_event_type public.feed_event_type
)
language sql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select
    content.id,
    content.kind,
    content.slug,
    content.title,
    content.excerpt,
    content.project_id,
    content.publish_at,
    content.feed_event_type
  from public.content_items as content
  where length(btrim(p_query)) between 1 and 100
    and p_limit between 1 and 50
    and p_offset between 0 and 10000
    and content.status = 'published'
    and content.publish_at <= now()
    and content.deleted_at is null
    and content.search_text &@~ btrim(p_query)
  order by content.publish_at desc, content.id
  limit p_limit
  offset p_offset;
$$;

revoke all on function public.search_public_content(text, integer, integer)
  from public;
grant execute on function public.search_public_content(text, integer, integer)
  to anon, authenticated;

create function public.service_create_comment(
  p_post_id uuid,
  p_display_name text,
  p_body text,
  p_status public.comment_status
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_status not in ('pending', 'visible') then
    raise exception 'invalid initial comment status' using errcode = '22023';
  end if;
  if length(btrim(p_display_name)) not between 1 and 80
    or length(btrim(p_body)) not between 1 and 5000
  then
    raise exception 'invalid comment input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.content_items as content
    where content.id = p_post_id
      and content.kind = 'post'
      and content.status = 'published'
      and content.publish_at <= now()
      and content.deleted_at is null
  ) then
    raise exception 'post is not publicly available' using errcode = 'P0002';
  end if;
  insert into public.comments (id, post_id, display_name, body, status)
  values (v_id, p_post_id, btrim(p_display_name), btrim(p_body), p_status);
  return v_id;
end;
$$;

revoke all on function public.service_create_comment(
  uuid, text, text, public.comment_status
) from public, anon, authenticated;
grant execute on function public.service_create_comment(
  uuid, text, text, public.comment_status
) to service_role;

create function private.assert_attachable_library_file_asset()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.assets as asset
    where asset.id = new.asset_id
      and asset.kind in ('document', 'archive')
      and asset.state = 'ready'
      and asset.visibility = 'private'
      and asset.deleted_at is null
      and exists (
        select 1 from public.asset_variants as variant
        where variant.asset_id = asset.id
          and variant.variant_role = 'download'
          and variant.bucket_id = 'private-downloads'
      )
  ) then
    raise exception 'Library file asset is not attachable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger library_files_assert_asset
before insert or update of asset_id on public.library_files
for each row execute function private.assert_attachable_library_file_asset();

create unique index library_files_active_asset_uidx
  on public.library_files (asset_id)
  where deleted_at is null;

revoke insert, update, delete on table public.library_files from authenticated;

drop policy library_files_public_select on public.library_files;
create policy library_files_public_select on public.library_files
for select to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.library_items as library
    where library.content_item_id = library_files.library_item_id
      and library.access_policy_code = 'free_download'
      and library.download_enabled
      and private.content_is_public(library.content_item_id)
  )
);

create function public.service_finalize_download_asset(
  p_asset_id uuid,
  p_object_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_asset public.assets%rowtype;
begin
  select asset.* into v_asset
  from public.assets as asset
  where asset.id = p_asset_id
  for update;
  if not found or v_asset.state not in ('uploaded', 'processing') then
    raise exception 'download asset cannot be finalized' using errcode = '23514';
  end if;
  if v_asset.kind not in ('document', 'archive')
    or p_mime_type not in ('application/pdf', 'application/zip', 'application/x-zip-compressed')
    or p_mime_type is distinct from v_asset.mime_type
    or p_size_bytes is distinct from v_asset.size_bytes
    or p_size_bytes not between 1 and 104857600
    or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or length(p_object_path) not between 1 and 900
    or p_object_path ~ '(^/|(^|/)\.\.(/|$))'
  then
    raise exception 'invalid finalized download metadata' using errcode = '22023';
  end if;
  update public.assets set
    state = 'ready',
    visibility = 'private',
    checksum_sha256 = p_checksum_sha256,
    error_message = null,
    metadata = metadata || jsonb_build_object('validated_at', clock_timestamp())
  where id = p_asset_id;
  insert into public.asset_variants (
    asset_id, variant_role, bucket_id, object_path, mime_type,
    size_bytes, checksum_sha256
  ) values (
    p_asset_id, 'download', 'private-downloads', p_object_path, p_mime_type,
    p_size_bytes, p_checksum_sha256
  )
  on conflict (asset_id, variant_role) do update set
    bucket_id = excluded.bucket_id,
    object_path = excluded.object_path,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    checksum_sha256 = excluded.checksum_sha256;
end;
$$;

create function public.admin_add_library_file(
  p_library_item_id uuid,
  p_asset_id uuid,
  p_version_label text,
  p_display_name text,
  p_display_order integer,
  p_is_primary boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_file_id uuid := gen_random_uuid();
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;
  if length(btrim(p_version_label)) not between 1 and 40
    or length(btrim(p_display_name)) not between 1 and 255
  then
    raise exception 'invalid Library file metadata' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.content_items as content
    join public.library_items as library on library.content_item_id = content.id
    where content.id = p_library_item_id and content.deleted_at is null
  ) then
    raise exception 'active Library item not found' using errcode = 'P0002';
  end if;
  if coalesce(p_is_primary, false) then
    update public.library_files set is_primary = false
    where library_item_id = p_library_item_id and deleted_at is null;
  end if;
  insert into public.library_files (
    id, library_item_id, asset_id, version_label, display_name,
    display_order, is_primary
  ) values (
    v_file_id, p_library_item_id, p_asset_id, btrim(p_version_label),
    btrim(p_display_name), coalesce(p_display_order, 0),
    coalesce(p_is_primary, false)
  );
  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id, metadata
  ) values (
    'library.file_added', 'library_file', v_file_id, v_actor_user_id,
    jsonb_build_object('library_item_id', p_library_item_id, 'asset_id', p_asset_id)
  );
  return v_file_id;
end;
$$;

create function public.admin_archive_library_file(p_library_file_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;
  update public.library_files set deleted_at = clock_timestamp(), is_primary = false
  where id = p_library_file_id and deleted_at is null;
  if not found then
    raise exception 'active Library file not found' using errcode = 'P0002';
  end if;
  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id
  ) values ('library.file_archived', 'library_file', p_library_file_id, v_actor_user_id);
end;
$$;

revoke all on function public.service_finalize_download_asset(
  uuid, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.service_finalize_download_asset(
  uuid, text, text, bigint, text
) to service_role;
revoke all on function public.admin_add_library_file(
  uuid, uuid, text, text, integer, boolean
) from public, anon;
grant execute on function public.admin_add_library_file(
  uuid, uuid, text, text, integer, boolean
) to authenticated;
revoke all on function public.admin_archive_library_file(uuid)
  from public, anon;
grant execute on function public.admin_archive_library_file(uuid)
  to authenticated;
