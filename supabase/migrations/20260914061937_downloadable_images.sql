-- Phase 2: FUMIBRO Images. Downloadable images are intentionally separate from
-- Portfolio/content_items, while reusing the hardened asset pipeline.

create type public.image_license_type as enum (
  'personal',
  'commercial',
  'editorial',
  'all_rights_reserved'
);

create type public.image_distribution_clearance as enum (
  'cleared',
  'review_required',
  'blocked'
);

create table public.downloadable_images (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null,
  use_examples text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  source_work_title text,
  source_system text not null default 'manual'
    references public.content_source_systems(code),
  license_type public.image_license_type not null default 'all_rights_reserved',
  distribution_clearance public.image_distribution_clearance not null
    default 'review_required',
  status public.content_status not null default 'draft',
  download_enabled boolean not null default false,
  ads_enabled boolean not null default false,
  published_at timestamptz,
  asset_id uuid not null references public.assets(id) on delete restrict,
  download_asset_id uuid not null references public.assets(id) on delete restrict,
  download_count bigint not null default 0,
  lock_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint downloadable_images_title_length check (
    length(btrim(title)) between 1 and 240
  ),
  constraint downloadable_images_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 160
  ),
  constraint downloadable_images_description_length check (
    length(btrim(description)) between 1 and 200000
  ),
  constraint downloadable_images_use_examples_length check (
    length(use_examples) <= 20000
  ),
  constraint downloadable_images_work_title_length check (
    source_work_title is null or length(btrim(source_work_title)) between 1 and 240
  ),
  constraint downloadable_images_download_count_nonnegative check (
    download_count >= 0
  ),
  constraint downloadable_images_lock_version_positive check (
    lock_version > 0
  ),
  constraint downloadable_images_publish_state check (
    status <> 'published'
    or (
      published_at is not null
      and distribution_clearance = 'cleared'
    )
  )
);

create index downloadable_images_public_idx
  on public.downloadable_images (published_at desc, id)
  where status = 'published'
    and distribution_clearance = 'cleared'
    and deleted_at is null;
create index downloadable_images_project_idx
  on public.downloadable_images (project_id, published_at desc)
  where deleted_at is null;
create index downloadable_images_asset_id_idx
  on public.downloadable_images (asset_id);
create index downloadable_images_download_asset_id_idx
  on public.downloadable_images (download_asset_id);

create table public.downloadable_image_tags (
  downloadable_image_id uuid not null
    references public.downloadable_images(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (downloadable_image_id, tag_id)
);
create index downloadable_image_tags_tag_id_idx
  on public.downloadable_image_tags (tag_id, downloadable_image_id);

create trigger downloadable_images_set_updated_at
before update on public.downloadable_images
for each row execute function private.set_updated_at();

alter table public.downloadable_images enable row level security;
alter table public.downloadable_image_tags enable row level security;

create policy downloadable_images_public_select
on public.downloadable_images
for select to anon, authenticated
using (
  status = 'published'
  and published_at <= now()
  and distribution_clearance = 'cleared'
  and deleted_at is null
);

create policy downloadable_images_admin_select
on public.downloadable_images
for select to authenticated
using ((select private.is_admin()));

create policy downloadable_image_tags_public_select
on public.downloadable_image_tags
for select to anon, authenticated
using (
  exists (
    select 1
    from public.downloadable_images as image
    where image.id = downloadable_image_tags.downloadable_image_id
      and image.status = 'published'
      and image.published_at <= now()
      and image.distribution_clearance = 'cleared'
      and image.deleted_at is null
  )
);

create policy downloadable_image_tags_admin_select
on public.downloadable_image_tags
for select to authenticated
using ((select private.is_admin()));

-- Browser roles can read only presentation-safe metadata. Mutations go through
-- AAL2-guarded commands so role membership alone is never write authorization.
grant select (
  id,
  title,
  slug,
  description,
  use_examples,
  project_id,
  source_work_title,
  license_type,
  distribution_clearance,
  status,
  download_enabled,
  ads_enabled,
  published_at,
  asset_id,
  download_asset_id,
  download_count,
  lock_version,
  created_at,
  updated_at
) on public.downloadable_images to anon;
grant select (
  id, title, slug, description, use_examples, project_id, source_work_title,
  source_system, license_type, distribution_clearance, status,
  download_enabled, ads_enabled, published_at, asset_id, download_asset_id,
  download_count, lock_version, created_at, updated_at, deleted_at
) on public.downloadable_images to authenticated;
grant select on public.downloadable_image_tags to anon, authenticated;

create function private.assert_downloadable_image_asset(
  p_asset_id uuid,
  p_require_download boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_asset_id is null or not exists (
    select 1
    from public.assets as asset
    where asset.id = p_asset_id
      and asset.kind = 'image'
      and asset.state = 'ready'
      and asset.visibility = 'public'
      and asset.deleted_at is null
      and exists (
        select 1 from public.asset_variants as variant
        where variant.asset_id = asset.id
          and variant.variant_role = 'display'
          and variant.bucket_id = 'public-media'
      )
      and exists (
        select 1 from public.asset_variants as variant
        where variant.asset_id = asset.id
          and variant.variant_role = 'thumbnail'
          and variant.bucket_id = 'public-media'
      )
      and (
        not p_require_download
        or exists (
          select 1 from public.asset_variants as variant
          where variant.asset_id = asset.id
            and variant.variant_role = 'download'
            and variant.bucket_id = 'private-downloads'
        )
      )
  ) then
    raise exception 'downloadable image asset is unavailable' using errcode = '23503';
  end if;
end;
$$;

create function public.admin_save_downloadable_image(
  p_image_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_slug text,
  p_description text,
  p_use_examples text,
  p_project_id uuid,
  p_source_work_title text,
  p_source_system text,
  p_license_type public.image_license_type,
  p_distribution_clearance public.image_distribution_clearance,
  p_status public.content_status,
  p_download_enabled boolean,
  p_ads_enabled boolean,
  p_published_at timestamptz,
  p_asset_id uuid,
  p_download_asset_id uuid,
  p_tag_ids uuid[]
)
returns table (saved_image_id uuid, saved_lock_version integer)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_id uuid := coalesce(p_image_id, gen_random_uuid());
  v_existing public.downloadable_images%rowtype;
  v_clearance public.image_distribution_clearance := p_distribution_clearance;
  v_published_at timestamptz := p_published_at;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  if p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception 'invalid image title' using errcode = '22023';
  end if;
  if p_slug is null
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(p_slug) > 160
  then
    raise exception 'invalid image slug' using errcode = '22023';
  end if;
  if p_description is null
    or length(btrim(p_description)) not between 1 and 200000
  then
    raise exception 'image description is required' using errcode = '22023';
  end if;
  if length(coalesce(p_use_examples, '')) > 20000 then
    raise exception 'use examples are too long' using errcode = '22023';
  end if;
  if p_source_work_title is not null
    and length(btrim(p_source_work_title)) not between 1 and 240
  then
    raise exception 'invalid source work title' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_tag_ids, '{}'::uuid[])) > 20 then
    raise exception 'at most 20 tags are allowed' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects as project
    where project.id = p_project_id
      and project.is_active
      and project.deleted_at is null
  ) then
    raise exception 'selected Project is unavailable' using errcode = '23503';
  end if;
  if p_source_system is null or not exists (
    select 1 from public.content_source_systems as source
    where source.code = p_source_system and source.is_enabled
  ) then
    raise exception 'source system is unavailable' using errcode = '23503';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as requested(tag_id)
    left join public.tags as tag
      on tag.id = requested.tag_id
      and tag.is_active
      and tag.deleted_at is null
    where tag.id is null
  ) then
    raise exception 'one or more tags are unavailable' using errcode = '23503';
  end if;

  perform private.assert_downloadable_image_asset(p_asset_id, false);
  perform private.assert_downloadable_image_asset(p_download_asset_id, true);

  if p_image_id is not null then
    select * into v_existing
    from public.downloadable_images
    where id = p_image_id and deleted_at is null
    for update;
    if not found then
      raise exception 'downloadable image not found' using errcode = 'P0002';
    end if;
    if p_expected_lock_version is null
      or p_expected_lock_version <> v_existing.lock_version
    then
      raise exception 'downloadable image changed concurrently' using errcode = '40001';
    end if;
  elsif p_expected_lock_version is not null then
    raise exception 'new image cannot have a lock version' using errcode = '22023';
  end if;

  -- A newly ingested KDP asset must be reviewed once. Later AAL2 admin edits may
  -- explicitly clear it after confirming distribution rights.
  if p_image_id is null and p_source_system = 'kdp' then
    v_clearance := 'review_required';
  end if;
  if p_status = 'published' and v_clearance <> 'cleared' then
    raise exception 'distribution clearance is required before publishing'
      using errcode = '23514';
  end if;
  if p_status = 'published' then
    v_published_at := coalesce(v_published_at, clock_timestamp());
  end if;

  insert into public.downloadable_images (
    id, title, slug, description, use_examples, project_id,
    source_work_title, source_system, license_type,
    distribution_clearance, status, download_enabled, ads_enabled,
    published_at, asset_id, download_asset_id, created_by
  ) values (
    v_id, btrim(p_title), p_slug, p_description, coalesce(p_use_examples, ''),
    p_project_id, nullif(btrim(p_source_work_title), ''), p_source_system,
    p_license_type, v_clearance, p_status, p_download_enabled, p_ads_enabled,
    v_published_at, p_asset_id, p_download_asset_id, v_actor_user_id
  )
  on conflict (id) do update set
    title = excluded.title,
    slug = excluded.slug,
    description = excluded.description,
    use_examples = excluded.use_examples,
    project_id = excluded.project_id,
    source_work_title = excluded.source_work_title,
    source_system = excluded.source_system,
    license_type = excluded.license_type,
    distribution_clearance = excluded.distribution_clearance,
    status = excluded.status,
    download_enabled = excluded.download_enabled,
    ads_enabled = excluded.ads_enabled,
    published_at = excluded.published_at,
    asset_id = excluded.asset_id,
    download_asset_id = excluded.download_asset_id,
    lock_version = public.downloadable_images.lock_version + 1;

  delete from public.downloadable_image_tags where downloadable_image_id = v_id;
  insert into public.downloadable_image_tags (downloadable_image_id, tag_id)
  select v_id, tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as requested(tag_id)
  on conflict do nothing;

  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id, metadata
  ) values (
    case when p_image_id is null then 'image.created' else 'image.updated' end,
    'downloadable_image',
    v_id,
    v_actor_user_id,
    jsonb_build_object(
      'status', p_status,
      'clearance', v_clearance,
      'download_enabled', p_download_enabled,
      'ads_enabled', p_ads_enabled
    )
  );

  return query
  select image.id, image.lock_version
  from public.downloadable_images as image
  where image.id = v_id;
end;
$$;

create function public.service_finalize_downloadable_image_variant(
  p_asset_id uuid,
  p_download_path text,
  p_download_size_bytes bigint,
  p_download_checksum_sha256 text,
  p_download_width integer,
  p_download_height integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  if p_download_path is null
    or p_download_path !~ ('^images/' || p_asset_id::text || '/download\.webp$')
    or p_download_size_bytes <= 0
    or p_download_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_download_width not between 1 and 2560
    or p_download_height not between 1 and 2560
  then
    raise exception 'invalid downloadable image variant' using errcode = '22023';
  end if;

  perform private.assert_downloadable_image_asset(p_asset_id, false);

  insert into public.asset_variants (
    asset_id, variant_role, bucket_id, object_path, mime_type, size_bytes,
    checksum_sha256, width, height
  ) values (
    p_asset_id, 'download', 'private-downloads', p_download_path, 'image/webp',
    p_download_size_bytes, p_download_checksum_sha256,
    p_download_width, p_download_height
  )
  on conflict (asset_id, variant_role) do update set
    bucket_id = excluded.bucket_id,
    object_path = excluded.object_path,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    checksum_sha256 = excluded.checksum_sha256,
    width = excluded.width,
    height = excluded.height;

  return p_asset_id;
end;
$$;

create function public.service_record_downloadable_image_download(p_image_id uuid)
returns table (
  object_path text,
  download_filename text,
  mime_type text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin

  return query
  with eligible as (
    select image.id, image.slug, variant.object_path, variant.mime_type
    from public.downloadable_images as image
    join public.asset_variants as variant
      on variant.asset_id = image.download_asset_id
      and variant.variant_role = 'download'
      and variant.bucket_id = 'private-downloads'
    join public.assets as asset on asset.id = image.download_asset_id
    where image.id = p_image_id
      and image.status = 'published'
      and image.published_at <= now()
      and image.distribution_clearance = 'cleared'
      and image.download_enabled
      and image.deleted_at is null
      and asset.kind = 'image'
      and asset.state = 'ready'
      and asset.deleted_at is null
    for update of image
  ), updated as (
    update public.downloadable_images as image
    set download_count = image.download_count + 1
    from eligible
    where image.id = eligible.id
    returning eligible.object_path,
      eligible.slug || '-standard.webp' as download_filename,
      eligible.mime_type
  )
  select updated.object_path, updated.download_filename, updated.mime_type
  from updated;
end;
$$;

revoke all on table public.downloadable_images from anon, authenticated;
revoke all on table public.downloadable_image_tags from anon, authenticated;
grant select (
  id, title, slug, description, use_examples, project_id,
  source_work_title, license_type, distribution_clearance, status,
  download_enabled, ads_enabled, published_at, asset_id, download_asset_id,
  download_count, lock_version, created_at, updated_at
) on public.downloadable_images to anon;
grant select (
  id, title, slug, description, use_examples, project_id, source_work_title,
  source_system, license_type, distribution_clearance, status,
  download_enabled, ads_enabled, published_at, asset_id, download_asset_id,
  download_count, lock_version, created_at, updated_at, deleted_at
) on public.downloadable_images to authenticated;
grant select on public.downloadable_image_tags to anon, authenticated;

revoke all on function public.admin_save_downloadable_image(
  uuid, integer, text, text, text, text, uuid, text, text,
  public.image_license_type, public.image_distribution_clearance,
  public.content_status, boolean, boolean, timestamptz, uuid, uuid, uuid[]
) from public, anon, authenticated;
grant execute on function public.admin_save_downloadable_image(
  uuid, integer, text, text, text, text, uuid, text, text,
  public.image_license_type, public.image_distribution_clearance,
  public.content_status, boolean, boolean, timestamptz, uuid, uuid, uuid[]
) to authenticated;

revoke all on function public.service_finalize_downloadable_image_variant(
  uuid, text, bigint, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.service_finalize_downloadable_image_variant(
  uuid, text, bigint, text, integer, integer
) to service_role;

revoke all on function public.service_record_downloadable_image_download(uuid)
  from public, anon, authenticated;
grant execute on function public.service_record_downloadable_image_download(uuid)
  to service_role;

revoke all on function private.assert_downloadable_image_asset(uuid, boolean)
  from public, anon, authenticated;

comment on table public.downloadable_images is
  'FUMIBRO Images metadata. Portfolio remains a separate, ad-free projection.';
comment on column public.downloadable_images.download_asset_id is
  'Asset owning the private-downloads standard variant; may equal asset_id.';
comment on column public.downloadable_images.source_system is
  'KDP starts review_required; manual and other sources remain explicitly reviewed by Admin.';
