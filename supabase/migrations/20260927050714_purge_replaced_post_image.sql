-- A Blog post has one top-image slot. Replacing or clearing that slot is an
-- explicit erasure request: once the canonical post no longer references the
-- prior asset, remove every Storage variant and scrub the old asset from this
-- post's revision snapshots. The application performs the Storage deletion
-- between prepare and complete so objects are never removed with SQL.

create function private.prepare_replaced_post_image_purge(
  p_content_item_id uuid,
  p_asset_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_manifest jsonb;
begin
  if not exists (
    select 1
    from auth.users as actor
    where actor.id = p_actor_user_id
      and actor.raw_app_meta_data ->> 'role' = 'admin'
  ) then
    raise exception 'Admin actor required' using errcode = '42501';
  end if;

  perform 1
  from public.assets as asset
  where asset.id = p_asset_id
    and asset.kind = 'image'
    and asset.deleted_at is null
  for update;

  if not found then
    raise exception 'Image asset not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.id = p_content_item_id
      and content.kind = 'post'
      and post.image_asset_id is distinct from p_asset_id
  ) then
    raise exception 'Post must stop referencing the replaced image first'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.posts where image_asset_id = p_asset_id)
    or exists (select 1 from public.works where image_asset_id = p_asset_id)
    or exists (select 1 from public.library_items where cover_asset_id = p_asset_id)
    or exists (select 1 from public.library_files where asset_id = p_asset_id)
    or exists (select 1 from public.business_cards where png_asset_id = p_asset_id)
    or exists (
      select 1
      from public.downloadable_images
      where asset_id = p_asset_id or download_asset_id = p_asset_id
    )
  then
    raise exception 'Image asset is still referenced by canonical content'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.content_revision_assets as revision_asset
    join public.content_revisions as revision
      on revision.id = revision_asset.revision_id
    where revision_asset.asset_id = p_asset_id
      and revision.content_item_id <> p_content_item_id
  ) then
    raise exception 'Image asset is retained by another content revision'
      using errcode = '23514';
  end if;

  update public.assets
  set
    state = 'processing',
    deleted_at = clock_timestamp(),
    error_message = null
  where id = p_asset_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket_id', variant.bucket_id,
        'object_path', variant.object_path
      )
      order by variant.bucket_id, variant.object_path
    ),
    '[]'::jsonb
  )
  into v_manifest
  from public.asset_variants as variant
  where variant.asset_id = p_asset_id;

  return v_manifest;
end;
$$;

create function private.fail_replaced_post_image_purge(
  p_asset_id uuid,
  p_error text
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  update public.assets
  set
    state = 'ready',
    deleted_at = null,
    error_message = left(coalesce(nullif(btrim(p_error), ''), 'Storage deletion failed'), 1000)
  where id = p_asset_id
    and state = 'processing'
    and deleted_at is not null;
end;
$$;

create function private.complete_replaced_post_image_purge(
  p_content_item_id uuid,
  p_asset_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if exists (select 1 from public.posts where image_asset_id = p_asset_id)
    or exists (select 1 from public.works where image_asset_id = p_asset_id)
    or exists (select 1 from public.library_items where cover_asset_id = p_asset_id)
    or exists (select 1 from public.library_files where asset_id = p_asset_id)
    or exists (select 1 from public.business_cards where png_asset_id = p_asset_id)
    or exists (
      select 1
      from public.downloadable_images
      where asset_id = p_asset_id or download_asset_id = p_asset_id
    )
  then
    raise exception 'Image asset was referenced again during deletion'
      using errcode = '23514';
  end if;

  update public.content_revisions as revision
  set snapshot = jsonb_set(
    revision.snapshot,
    '{detail,image_asset_id}',
    'null'::jsonb,
    false
  )
  where revision.content_item_id = p_content_item_id
    and revision.snapshot #>> '{detail,image_asset_id}' = p_asset_id::text;

  delete from public.content_revision_assets as revision_asset
  using public.content_revisions as revision
  where revision_asset.revision_id = revision.id
    and revision.content_item_id = p_content_item_id
    and revision_asset.asset_id = p_asset_id;

  delete from public.assets
  where id = p_asset_id
    and state = 'processing'
    and deleted_at is not null;

  if not found then
    raise exception 'Prepared image asset not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'post.top_image_replaced',
    'content_item',
    p_content_item_id,
    p_actor_user_id,
    jsonb_build_object('removed_asset_id', p_asset_id)
  );

  return p_asset_id;
end;
$$;

create function public.service_prepare_replaced_post_image_purge(
  p_content_item_id uuid,
  p_asset_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.prepare_replaced_post_image_purge(
    p_content_item_id,
    p_asset_id,
    p_actor_user_id
  );
$$;

create function public.service_fail_replaced_post_image_purge(
  p_asset_id uuid,
  p_error text
)
returns void
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.fail_replaced_post_image_purge(p_asset_id, p_error);
$$;

create function public.service_complete_replaced_post_image_purge(
  p_content_item_id uuid,
  p_asset_id uuid,
  p_actor_user_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.complete_replaced_post_image_purge(
    p_content_item_id,
    p_asset_id,
    p_actor_user_id
  );
$$;

revoke all on function private.prepare_replaced_post_image_purge(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.fail_replaced_post_image_purge(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_replaced_post_image_purge(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.service_prepare_replaced_post_image_purge(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.service_fail_replaced_post_image_purge(uuid, text)
  from public, anon, authenticated;
revoke all on function public.service_complete_replaced_post_image_purge(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.service_prepare_replaced_post_image_purge(uuid, uuid, uuid)
  to service_role;
grant execute on function public.service_fail_replaced_post_image_purge(uuid, text)
  to service_role;
grant execute on function public.service_complete_replaced_post_image_purge(uuid, uuid, uuid)
  to service_role;
