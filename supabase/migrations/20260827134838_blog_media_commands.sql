-- Milestone 4: canonical Blog commands, media finalization, Revision restore,
-- Trash, and retryable permanent deletion.

-- Admin readers need the concurrency token. Non-admin authenticated users can
-- only see public rows through RLS, so this does not reveal draft provenance.
grant select (lock_version) on public.content_items to authenticated;

-- Canonical Blog writes go through audited, transactional commands. Remove the
-- legacy direct-table path while keeping the safe read projection intact.
revoke all privileges on table public.posts from authenticated;
revoke all privileges on table public.content_tags from authenticated;
revoke all privileges on table public.content_items from authenticated;

grant select on table public.posts, public.content_tags to authenticated;
grant select (
  id,
  kind,
  project_id,
  slug,
  title,
  excerpt,
  status,
  posted_at,
  publish_at,
  first_published_at,
  feed_at,
  feed_event_type,
  search_text,
  lock_version,
  created_at,
  updated_at,
  deleted_at
) on public.content_items to authenticated;

-- Admin browsers may upload only private source/delivery bytes. Processed
-- public media is written by the narrow server processor using service_role.
drop policy storage_admin_insert on storage.objects;
drop policy storage_admin_update on storage.objects;
drop policy storage_admin_delete on storage.objects;

create policy storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('private-originals', 'private-downloads')
  and name !~ '(^/|(^|/)\.\.(/|$))'
  and (select private.is_admin())
);

create policy storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id in ('private-originals', 'private-downloads')
  and (select private.is_admin())
)
with check (
  bucket_id in ('private-originals', 'private-downloads')
  and name !~ '(^/|(^|/)\.\.(/|$))'
  and (select private.is_admin())
);

create policy storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('private-originals', 'private-downloads')
  and (select private.is_admin())
);

create function private.assert_attachable_image_asset()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_asset_id uuid;
begin
  v_asset_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;

  if v_asset_id is null then
    return new;
  end if;

  perform 1
  from public.assets as asset
  where asset.id = v_asset_id
    and asset.kind = 'image'
    and asset.state = 'ready'
    and asset.visibility = 'public'
    and asset.deleted_at is null
  for key share;

  if not found then
    raise exception 'image asset is not attachable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger posts_assert_image_asset
before insert or update of image_asset_id on public.posts
for each row execute function private.assert_attachable_image_asset('image_asset_id');

create trigger works_assert_image_asset
before insert or update of image_asset_id on public.works
for each row execute function private.assert_attachable_image_asset('image_asset_id');

create trigger library_items_assert_cover_asset
before insert or update of cover_asset_id on public.library_items
for each row execute function private.assert_attachable_image_asset('cover_asset_id');

create trigger business_cards_assert_png_asset
before insert or update of png_asset_id on public.business_cards
for each row execute function private.assert_attachable_image_asset('png_asset_id');

create function public.admin_save_post(
  p_content_item_id uuid,
  p_expected_lock_version integer,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_body_markdown text,
  p_posted_at timestamptz,
  p_publish_at timestamptz,
  p_status public.content_status,
  p_project_id uuid,
  p_post_category_id uuid,
  p_location_id uuid,
  p_tag_ids uuid[],
  p_image_asset_id uuid,
  p_external_url text,
  p_is_spoiler boolean,
  p_watermark_enabled boolean,
  p_change_reason text
)
returns table (saved_content_item_id uuid, saved_lock_version integer)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_content_id uuid := coalesce(p_content_item_id, gen_random_uuid());
  v_existing public.content_items%rowtype;
  v_is_new boolean := p_content_item_id is null;
  v_now timestamptz := clock_timestamp();
  v_publish_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  if p_slug is null
    or btrim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(btrim(p_slug)) > 160
  then
    raise exception 'invalid post slug' using errcode = '22023';
  end if;

  if p_title is not null and length(btrim(p_title)) > 240 then
    raise exception 'post title is too long' using errcode = '22023';
  end if;

  if p_excerpt is not null and length(p_excerpt) > 1000 then
    raise exception 'post excerpt is too long' using errcode = '22023';
  end if;

  if p_body_markdown is null
    or length(btrim(p_body_markdown)) not between 1 and 200000
  then
    raise exception 'post body is required' using errcode = '22023';
  end if;

  if p_posted_at is null or p_status is null then
    raise exception 'posted_at and status are required' using errcode = '22023';
  end if;

  if p_external_url is not null
    and (length(p_external_url) > 2000 or p_external_url !~ '^https?://')
  then
    raise exception 'invalid external URL' using errcode = '22023';
  end if;

  if p_change_reason is not null and length(p_change_reason) > 1000 then
    raise exception 'change reason is too long' using errcode = '22023';
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

  if p_post_category_id is not null and not exists (
    select 1 from public.post_categories as category
    where category.id = p_post_category_id
      and category.is_active
      and category.deleted_at is null
  ) then
    raise exception 'selected category is unavailable' using errcode = '23503';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations as location
    where location.id = p_location_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'selected location is unavailable' using errcode = '23503';
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
    raise exception 'one or more selected tags are unavailable' using errcode = '23503';
  end if;

  if p_image_asset_id is not null and not exists (
    select 1
    from public.assets as asset
    where asset.id = p_image_asset_id
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
  ) then
    raise exception 'selected image is unavailable' using errcode = '23503';
  end if;

  v_publish_at := case
    when p_status = 'published' then coalesce(p_publish_at, v_now)
    else p_publish_at
  end;

  if v_is_new then
    if p_expected_lock_version is not null then
      raise exception 'new content cannot have a lock version' using errcode = '22023';
    end if;

    insert into public.content_items (
      id,
      kind,
      project_id,
      slug,
      title,
      excerpt,
      status,
      posted_at,
      publish_at,
      feed_at,
      feed_event_type,
      created_by,
      updated_by
    )
    values (
      v_content_id,
      'post',
      p_project_id,
      lower(btrim(p_slug)),
      nullif(btrim(p_title), ''),
      nullif(btrim(p_excerpt), ''),
      p_status,
      p_posted_at,
      v_publish_at,
      case when p_status = 'published' then v_publish_at else null end,
      case when p_status = 'published' then 'new'::public.feed_event_type else null end,
      v_actor_user_id,
      v_actor_user_id
    );

    insert into public.posts (
      content_item_id,
      body_markdown,
      post_category_id,
      location_id,
      image_asset_id,
      external_url,
      is_spoiler,
      watermark_enabled
    )
    values (
      v_content_id,
      btrim(p_body_markdown),
      p_post_category_id,
      p_location_id,
      p_image_asset_id,
      nullif(btrim(p_external_url), ''),
      coalesce(p_is_spoiler, false),
      coalesce(p_watermark_enabled, false)
    );

    insert into public.content_tags (content_item_id, tag_id)
    select v_content_id, requested.tag_id
    from (
      select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id
    ) as requested;

    if p_status = 'published' then
      perform private.capture_content_revision(
        v_content_id,
        'publish',
        coalesce(nullif(btrim(p_change_reason), ''), 'Initial publication'),
        'admin',
        v_actor_user_id
      );
    end if;
  else
    select content.* into v_existing
    from public.content_items as content
    where content.id = p_content_item_id
    for update;

    if not found or v_existing.kind <> 'post' then
      raise exception 'post not found' using errcode = 'P0002';
    end if;

    if v_existing.deleted_at is not null then
      raise exception 'restore trashed content before editing' using errcode = '23514';
    end if;

    if p_expected_lock_version is distinct from v_existing.lock_version then
      raise exception 'content changed since it was loaded' using errcode = '40001';
    end if;

    perform private.capture_content_revision(
      v_content_id,
      case
        when p_status = 'published' and v_existing.first_published_at is null
          then 'publish'::public.revision_event_type
        else 'update'::public.revision_event_type
      end,
      coalesce(nullif(btrim(p_change_reason), ''), 'Admin edit'),
      'admin',
      v_actor_user_id
    );

    update public.content_items
    set
      project_id = p_project_id,
      slug = lower(btrim(p_slug)),
      title = nullif(btrim(p_title), ''),
      excerpt = nullif(btrim(p_excerpt), ''),
      status = p_status,
      posted_at = p_posted_at,
      publish_at = v_publish_at,
      feed_at = case
        when p_status = 'published' and v_existing.first_published_at is null
          then v_publish_at
        when p_status = 'published'
          then greatest(v_publish_at, v_now)
        else v_existing.feed_at
      end,
      feed_event_type = case
        when p_status = 'published' and v_existing.first_published_at is null
          then 'new'::public.feed_event_type
        when p_status = 'published'
          then 'updated'::public.feed_event_type
        else v_existing.feed_event_type
      end,
      updated_by = v_actor_user_id
    where id = v_content_id;

    update public.posts
    set
      body_markdown = btrim(p_body_markdown),
      post_category_id = p_post_category_id,
      location_id = p_location_id,
      image_asset_id = p_image_asset_id,
      external_url = nullif(btrim(p_external_url), ''),
      is_spoiler = coalesce(p_is_spoiler, false),
      watermark_enabled = coalesce(p_watermark_enabled, false)
    where content_item_id = v_content_id;

    delete from public.content_tags where content_item_id = v_content_id;
    insert into public.content_tags (content_item_id, tag_id)
    select v_content_id, requested.tag_id
    from (
      select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id
    ) as requested;
  end if;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    case when v_is_new then 'content.post_created' else 'content.post_updated' end,
    'content_item',
    v_content_id,
    v_actor_user_id,
    jsonb_build_object(
      'status',
      p_status,
      'scheduled',
      p_status = 'published' and v_publish_at > v_now
    )
  );

  return query
  select content.id, content.lock_version
  from public.content_items as content
  where content.id = v_content_id;
end;
$$;

revoke all on function public.admin_save_post(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  public.content_status,
  uuid,
  uuid,
  uuid,
  uuid[],
  uuid,
  text,
  boolean,
  boolean,
  text
) from public, anon;

grant execute on function public.admin_save_post(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  public.content_status,
  uuid,
  uuid,
  uuid,
  uuid[],
  uuid,
  text,
  boolean,
  boolean,
  text
) to authenticated;

create function public.admin_set_content_trashed(
  p_content_item_id uuid,
  p_expected_lock_version integer,
  p_trashed boolean
)
returns integer
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_content public.content_items%rowtype;
  v_new_lock_version integer;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  if p_trashed is null then
    raise exception 'Trash mode is required' using errcode = '22023';
  end if;

  select content.* into v_content
  from public.content_items as content
  where content.id = p_content_item_id
  for update;

  if not found then
    raise exception 'content not found' using errcode = 'P0002';
  end if;

  if p_expected_lock_version is distinct from v_content.lock_version then
    raise exception 'content changed since it was loaded' using errcode = '40001';
  end if;

  if p_trashed = (v_content.deleted_at is not null) then
    return v_content.lock_version;
  end if;

  if p_trashed and v_content.deleted_at is null then
    perform private.capture_content_revision(
      p_content_item_id,
      'update',
      'Automatic snapshot before moving to Trash',
      'admin',
      v_actor_user_id
    );

    update public.content_items
    set deleted_at = clock_timestamp(), deleted_by = v_actor_user_id
    where id = p_content_item_id;
  elsif not p_trashed and v_content.deleted_at is not null then
    if exists (
      select 1 from public.purge_jobs as job
      where job.content_item_id = p_content_item_id
        and job.status in ('pending', 'processing', 'failed')
    ) then
      raise exception 'content with a purge job cannot be restored'
        using errcode = '23514';
    end if;

    perform private.capture_content_revision(
      p_content_item_id,
      'restore',
      'Automatic snapshot before restoring from Trash',
      'admin',
      v_actor_user_id
    );

    update public.content_items
    set
      deleted_at = null,
      deleted_by = null,
      feed_at = case
        when status = 'published' then greatest(publish_at, clock_timestamp())
        else feed_at
      end,
      feed_event_type = case
        when status = 'published' then 'updated'::public.feed_event_type
        else feed_event_type
      end,
      updated_by = v_actor_user_id
    where id = p_content_item_id;
  end if;

  select lock_version into v_new_lock_version
  from public.content_items
  where id = p_content_item_id;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    case when p_trashed then 'content.trashed' else 'content.trash_restored' end,
    'content_item',
    p_content_item_id,
    v_actor_user_id,
    '{}'::jsonb
  );

  return v_new_lock_version;
end;
$$;

revoke all on function public.admin_set_content_trashed(uuid, integer, boolean)
  from public, anon;
grant execute on function public.admin_set_content_trashed(uuid, integer, boolean)
  to authenticated;

create function public.admin_restore_content_revision(
  p_revision_id uuid,
  p_expected_content_item_id uuid
)
returns table (restored_content_item_id uuid, before_restore_revision_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_content_item_id uuid;
  v_before_revision_id uuid;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  select revision.content_item_id into v_content_item_id
  from public.content_revisions as revision
  join public.content_items as content on content.id = revision.content_item_id
  where revision.id = p_revision_id
    and revision.content_item_id = p_expected_content_item_id
    and content.deleted_at is null
  for update of content;

  if not found then
    raise exception 'active revision not found' using errcode = 'P0002';
  end if;

  v_before_revision_id := private.restore_content_revision(
    p_revision_id,
    v_actor_user_id
  );

  return query select v_content_item_id, v_before_revision_id;
end;
$$;

revoke all on function public.admin_restore_content_revision(uuid, uuid)
  from public, anon;
grant execute on function public.admin_restore_content_revision(uuid, uuid)
  to authenticated;

create unique index purge_jobs_one_active_per_content_uidx
  on public.purge_jobs (content_item_id)
  where content_item_id is not null and status in ('pending', 'processing');

create function public.admin_request_content_purge(p_content_item_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_existing_job_id uuid;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  perform 1
  from public.content_items as content
  where content.id = p_content_item_id
    and content.deleted_at is not null
  for update;

  if not found then
    raise exception 'only trashed content can be permanently purged' using errcode = '23514';
  end if;

  select job.id into v_existing_job_id
  from public.purge_jobs as job
  where job.content_item_id = p_content_item_id
    and job.status in ('pending', 'processing', 'failed')
  order by job.requested_at desc
  limit 1
  for update;

  if v_existing_job_id is not null then
    return v_existing_job_id;
  end if;

  return private.request_content_purge(p_content_item_id, v_actor_user_id);
end;
$$;

revoke all on function public.admin_request_content_purge(uuid)
  from public, anon;
grant execute on function public.admin_request_content_purge(uuid)
  to authenticated;

create function private.prepare_content_purge(p_job_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
  v_asset_ids uuid[] := '{}'::uuid[];
  v_manifest jsonb := '[]'::jsonb;
begin
  select job.content_item_id into v_content_item_id
  from public.purge_jobs as job
  where job.id = p_job_id
    and job.status in ('pending', 'processing', 'failed')
  for update;

  if not found or v_content_item_id is null then
    raise exception 'purge job is not retryable' using errcode = '23514';
  end if;

  perform 1
  from public.content_items as content
  where content.id = v_content_item_id
    and content.deleted_at is not null
  for update;

  if not found then
    raise exception 'purge target is not in Trash' using errcode = '23514';
  end if;

  with target_assets as (
    select post.image_asset_id as asset_id
    from public.posts as post
    where post.content_item_id = v_content_item_id
    union
    select work.image_asset_id
    from public.works as work
    where work.content_item_id = v_content_item_id
    union
    select library.cover_asset_id
    from public.library_items as library
    where library.content_item_id = v_content_item_id
    union
    select file.asset_id
    from public.library_files as file
    where file.library_item_id = v_content_item_id
    union
    select revision_asset.asset_id
    from public.content_revision_assets as revision_asset
    join public.content_revisions as revision
      on revision.id = revision_asset.revision_id
    where revision.content_item_id = v_content_item_id
  )
  select coalesce(array_agg(target.asset_id), '{}'::uuid[])
  into v_asset_ids
  from target_assets as target
  where target.asset_id is not null
    and not exists (
      select 1 from public.posts as post
      where post.image_asset_id = target.asset_id
        and post.content_item_id <> v_content_item_id
    )
    and not exists (
      select 1 from public.works as work
      where work.image_asset_id = target.asset_id
        and work.content_item_id <> v_content_item_id
    )
    and not exists (
      select 1 from public.library_items as library
      where library.cover_asset_id = target.asset_id
        and library.content_item_id <> v_content_item_id
    )
    and not exists (
      select 1 from public.library_files as file
      where file.asset_id = target.asset_id
        and file.library_item_id <> v_content_item_id
    )
    and not exists (
      select 1 from public.business_cards as card
      where card.png_asset_id = target.asset_id
    )
    and not exists (
      select 1
      from public.content_revision_assets as revision_asset
      join public.content_revisions as revision
        on revision.id = revision_asset.revision_id
      where revision_asset.asset_id = target.asset_id
        and revision.content_item_id <> v_content_item_id
    );

  update public.assets
  set state = 'processing', deleted_at = coalesce(deleted_at, clock_timestamp())
  where id = any(v_asset_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_id', variant.asset_id,
    'bucket_id', variant.bucket_id,
    'object_path', variant.object_path
  ) order by variant.bucket_id, variant.object_path), '[]'::jsonb)
  into v_manifest
  from public.asset_variants as variant
  where variant.asset_id = any(v_asset_ids);

  update public.purge_jobs
  set
    status = 'processing',
    object_manifest = v_manifest,
    attempts = attempts + 1,
    last_error = null
  where id = p_job_id;

  return v_manifest;
end;
$$;

create function private.fail_content_purge(p_job_id uuid, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  update public.purge_jobs
  set
    status = 'failed',
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Storage deletion failed'), 1000)
  where id = p_job_id
    and status = 'processing';

  if not found then
    raise exception 'processing purge job not found' using errcode = 'P0002';
  end if;
end;
$$;

create function private.complete_content_purge(
  p_job_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
  v_asset_ids uuid[] := '{}'::uuid[];
begin
  select job.content_item_id into v_content_item_id
  from public.purge_jobs as job
  where job.id = p_job_id
    and job.status = 'processing'
  for update;

  if not found or v_content_item_id is null then
    raise exception 'processing purge job not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct (entry ->> 'asset_id')::uuid), '{}'::uuid[])
  into v_asset_ids
  from jsonb_array_elements(
    (select object_manifest from public.purge_jobs where id = p_job_id)
  ) as entry;

  delete from public.content_items
  where id = v_content_item_id
    and deleted_at is not null;

  if not found then
    raise exception 'purge target is not in Trash' using errcode = '23514';
  end if;

  delete from public.assets as asset
  where asset.id = any(v_asset_ids)
    and not exists (select 1 from public.posts where image_asset_id = asset.id)
    and not exists (select 1 from public.works where image_asset_id = asset.id)
    and not exists (select 1 from public.library_items where cover_asset_id = asset.id)
    and not exists (select 1 from public.library_files where asset_id = asset.id)
    and not exists (select 1 from public.business_cards where png_asset_id = asset.id)
    and not exists (
      select 1 from public.content_revision_assets where asset_id = asset.id
    );

  update public.purge_jobs
  set
    status = 'completed',
    last_error = null,
    completed_by = p_actor_user_id,
    completed_at = clock_timestamp()
  where id = p_job_id;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'content.purge_completed',
    'content_item',
    v_content_item_id,
    p_actor_user_id,
    jsonb_build_object('purge_job_id', p_job_id)
  );

  return v_content_item_id;
end;
$$;

create function public.service_prepare_content_purge(p_job_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.prepare_content_purge(p_job_id);
$$;

create function public.service_fail_content_purge(p_job_id uuid, p_error text)
returns void
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.fail_content_purge(p_job_id, p_error);
$$;

create function public.service_complete_content_purge(
  p_job_id uuid,
  p_actor_user_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.complete_content_purge(p_job_id, p_actor_user_id);
$$;

revoke all on function public.service_prepare_content_purge(uuid)
  from public, anon, authenticated;
revoke all on function public.service_fail_content_purge(uuid, text)
  from public, anon, authenticated;
revoke all on function public.service_complete_content_purge(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.service_prepare_content_purge(uuid)
  to service_role;
grant execute on function public.service_fail_content_purge(uuid, text)
  to service_role;
grant execute on function public.service_complete_content_purge(uuid, uuid)
  to service_role;

create function private.finalize_processed_image(
  p_asset_id uuid,
  p_original_path text,
  p_original_mime_type text,
  p_original_size_bytes bigint,
  p_original_checksum_sha256 text,
  p_width integer,
  p_height integer,
  p_display_path text,
  p_display_size_bytes bigint,
  p_display_checksum_sha256 text,
  p_display_width integer,
  p_display_height integer,
  p_thumbnail_path text,
  p_thumbnail_size_bytes bigint,
  p_thumbnail_checksum_sha256 text,
  p_thumbnail_width integer,
  p_thumbnail_height integer
)
returns uuid
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

  if not found or v_asset.kind <> 'image' then
    raise exception 'image asset not found' using errcode = 'P0002';
  end if;

  if v_asset.deleted_at is not null or v_asset.state <> 'processing' then
    raise exception 'image asset is not processing' using errcode = '23514';
  end if;

  if v_asset.metadata -> 'upload' ->> 'object_path' is distinct from p_original_path then
    raise exception 'original object path does not match upload reservation'
      using errcode = '23514';
  end if;

  if p_original_path !~ ('^images/' || p_asset_id::text || '/original\.(jpg|png|webp)$')
    or p_display_path <> 'images/' || p_asset_id::text || '/display.webp'
    or p_thumbnail_path <> 'images/' || p_asset_id::text || '/thumbnail.webp'
  then
    raise exception 'processed image path is invalid' using errcode = '22023';
  end if;

  if p_original_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'processed image MIME type is invalid' using errcode = '22023';
  end if;

  update public.assets
  set
    state = 'ready',
    visibility = 'public',
    mime_type = p_original_mime_type,
    size_bytes = p_original_size_bytes,
    checksum_sha256 = p_original_checksum_sha256,
    width = p_width,
    height = p_height,
    metadata = (metadata - 'upload') || jsonb_build_object(
      'processor', jsonb_build_object(
        'version', 1,
        'display_format', 'webp',
        'metadata_stripped', true
      )
    ),
    error_message = null
  where id = p_asset_id;

  insert into public.asset_variants (
    asset_id,
    variant_role,
    bucket_id,
    object_path,
    mime_type,
    size_bytes,
    checksum_sha256,
    width,
    height
  )
  values
    (
      p_asset_id,
      'original',
      'private-originals',
      p_original_path,
      p_original_mime_type,
      p_original_size_bytes,
      p_original_checksum_sha256,
      p_width,
      p_height
    ),
    (
      p_asset_id,
      'display',
      'public-media',
      p_display_path,
      'image/webp',
      p_display_size_bytes,
      p_display_checksum_sha256,
      p_display_width,
      p_display_height
    ),
    (
      p_asset_id,
      'thumbnail',
      'public-media',
      p_thumbnail_path,
      'image/webp',
      p_thumbnail_size_bytes,
      p_thumbnail_checksum_sha256,
      p_thumbnail_width,
      p_thumbnail_height
    );

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'asset.image_processed',
    'asset',
    p_asset_id,
    v_asset.created_by,
    jsonb_build_object('processor_version', 1)
  );

  return p_asset_id;
end;
$$;

create function public.service_finalize_processed_image(
  p_asset_id uuid,
  p_original_path text,
  p_original_mime_type text,
  p_original_size_bytes bigint,
  p_original_checksum_sha256 text,
  p_width integer,
  p_height integer,
  p_display_path text,
  p_display_size_bytes bigint,
  p_display_checksum_sha256 text,
  p_display_width integer,
  p_display_height integer,
  p_thumbnail_path text,
  p_thumbnail_size_bytes bigint,
  p_thumbnail_checksum_sha256 text,
  p_thumbnail_width integer,
  p_thumbnail_height integer
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.finalize_processed_image(
    p_asset_id,
    p_original_path,
    p_original_mime_type,
    p_original_size_bytes,
    p_original_checksum_sha256,
    p_width,
    p_height,
    p_display_path,
    p_display_size_bytes,
    p_display_checksum_sha256,
    p_display_width,
    p_display_height,
    p_thumbnail_path,
    p_thumbnail_size_bytes,
    p_thumbnail_checksum_sha256,
    p_thumbnail_width,
    p_thumbnail_height
  );
$$;

revoke all on function public.service_finalize_processed_image(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  text,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.service_finalize_processed_image(
  uuid,
  text,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  text,
  integer,
  integer
) to service_role;
