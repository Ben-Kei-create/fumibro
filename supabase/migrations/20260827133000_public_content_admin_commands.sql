-- Milestone 5: audited Admin commands for public Works, Library, and Pages.

create function private.ensure_project_visit_counter()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.visit_counters (scope_key, scope_type, project_id, total)
  values ('project:' || new.id::text, 'project', new.id, 0)
  on conflict (scope_key) do nothing;
  return new;
end;
$$;

create trigger projects_ensure_visit_counter
after insert on public.projects
for each row execute function private.ensure_project_visit_counter();

insert into public.visit_counters (scope_key, scope_type, project_id, total)
select 'project:' || project.id::text, 'project', project.id, 0
from public.projects as project
on conflict (scope_key) do nothing;

-- Canonical children are written only through the transactional commands
-- below so Revision capture cannot be bypassed by a browser table update.
revoke insert, update, delete on table public.works from authenticated;
revoke insert, update, delete on table public.library_items from authenticated;
revoke insert, update, delete on table public.pages from authenticated;
grant select on table public.works, public.library_items, public.pages
  to authenticated;

create function public.admin_save_work(
  p_content_item_id uuid,
  p_expected_lock_version integer,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_project_id uuid,
  p_summary text,
  p_description_markdown text,
  p_image_asset_id uuid,
  p_released_on date,
  p_external_url text,
  p_work_type text,
  p_show_on_home boolean,
  p_home_display_order integer,
  p_show_in_portfolio boolean,
  p_portfolio_display_order integer,
  p_tag_ids uuid[],
  p_status public.content_status,
  p_publish_at timestamptz,
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
  if p_slug is null or btrim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(btrim(p_slug)) > 160
  then
    raise exception 'invalid work slug' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception 'work title is required' using errcode = '22023';
  end if;
  if p_excerpt is not null and length(p_excerpt) > 1000 then
    raise exception 'work excerpt is too long' using errcode = '22023';
  end if;
  if p_summary is not null and length(p_summary) > 1000 then
    raise exception 'work summary is too long' using errcode = '22023';
  end if;
  if p_description_markdown is null or length(p_description_markdown) > 200000 then
    raise exception 'invalid work description' using errcode = '22023';
  end if;
  if p_work_type is null or btrim(p_work_type) !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception 'invalid work type' using errcode = '22023';
  end if;
  if p_external_url is not null
    and (length(p_external_url) > 2000 or p_external_url !~ '^https?://')
  then
    raise exception 'invalid external URL' using errcode = '22023';
  end if;
  if p_status is null then
    raise exception 'work status is required' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_tag_ids, '{}'::uuid[])) > 20 then
    raise exception 'at most 20 tags are allowed' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects as project
    where project.id = p_project_id and project.is_active and project.deleted_at is null
  ) then
    raise exception 'selected Project is unavailable' using errcode = '23503';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as requested(tag_id)
    left join public.tags as tag on tag.id = requested.tag_id
      and tag.is_active and tag.deleted_at is null
    where tag.id is null
  ) then
    raise exception 'one or more selected tags are unavailable' using errcode = '23503';
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
      id, kind, project_id, slug, title, excerpt, status, posted_at,
      publish_at, feed_at, feed_event_type, created_by, updated_by
    ) values (
      v_content_id, 'work', p_project_id, lower(btrim(p_slug)), btrim(p_title),
      nullif(btrim(p_excerpt), ''), p_status, v_now, v_publish_at,
      case when p_status = 'published' then v_publish_at else null end,
      case when p_status = 'published' then 'new'::public.feed_event_type else null end,
      v_actor_user_id, v_actor_user_id
    );
    insert into public.works (
      content_item_id, summary, description_markdown, image_asset_id,
      released_on, external_url, work_type, show_on_home,
      home_display_order, show_in_portfolio, portfolio_display_order
    ) values (
      v_content_id, nullif(btrim(p_summary), ''), p_description_markdown,
      p_image_asset_id, p_released_on, nullif(btrim(p_external_url), ''),
      lower(btrim(p_work_type)), coalesce(p_show_on_home, false),
      coalesce(p_home_display_order, 0), coalesce(p_show_in_portfolio, false),
      coalesce(p_portfolio_display_order, 0)
    );
  else
    select content.* into v_existing
    from public.content_items as content
    where content.id = p_content_item_id
    for update;
    if not found or v_existing.kind <> 'work' then
      raise exception 'work not found' using errcode = 'P0002';
    end if;
    if v_existing.deleted_at is not null then
      raise exception 'restore trashed content before editing' using errcode = '23514';
    end if;
    if p_expected_lock_version is distinct from v_existing.lock_version then
      raise exception 'content changed since it was loaded' using errcode = '40001';
    end if;
    perform private.capture_content_revision(
      v_content_id,
      case when p_status = 'published' and v_existing.first_published_at is null
        then 'publish'::public.revision_event_type
        else 'update'::public.revision_event_type end,
      nullif(btrim(p_change_reason), ''), 'admin', v_actor_user_id
    );
    update public.content_items set
      project_id = p_project_id,
      slug = lower(btrim(p_slug)),
      title = btrim(p_title),
      excerpt = nullif(btrim(p_excerpt), ''),
      status = p_status,
      publish_at = v_publish_at,
      feed_at = case when p_status = 'published' then v_now else feed_at end,
      feed_event_type = case
        when p_status <> 'published' then feed_event_type
        when v_existing.first_published_at is null then 'new'::public.feed_event_type
        else 'updated'::public.feed_event_type end,
      updated_by = v_actor_user_id
    where id = v_content_id;
    update public.works set
      summary = nullif(btrim(p_summary), ''),
      description_markdown = p_description_markdown,
      image_asset_id = p_image_asset_id,
      released_on = p_released_on,
      external_url = nullif(btrim(p_external_url), ''),
      work_type = lower(btrim(p_work_type)),
      show_on_home = coalesce(p_show_on_home, false),
      home_display_order = coalesce(p_home_display_order, 0),
      show_in_portfolio = coalesce(p_show_in_portfolio, false),
      portfolio_display_order = coalesce(p_portfolio_display_order, 0)
    where content_item_id = v_content_id;
  end if;

  delete from public.content_tags where content_item_id = v_content_id;
  insert into public.content_tags (content_item_id, tag_id)
  select v_content_id, requested.tag_id
  from (select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id) as requested;
  if v_is_new and p_status = 'published' then
    perform private.capture_content_revision(
      v_content_id, 'publish',
      coalesce(nullif(btrim(p_change_reason), ''), 'Initial publication'),
      'admin', v_actor_user_id
    );
  end if;
  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id, metadata
  ) values (
    case when v_is_new then 'work.created' else 'work.updated' end,
    'content_item', v_content_id, v_actor_user_id,
    jsonb_build_object('status', p_status, 'show_on_home', coalesce(p_show_on_home, false),
      'show_in_portfolio', coalesce(p_show_in_portfolio, false))
  );
  return query select content.id, content.lock_version
  from public.content_items as content where content.id = v_content_id;
end;
$$;

revoke all on function public.admin_save_work(
  uuid, integer, text, text, text, uuid, text, text, uuid, date, text, text,
  boolean, integer, boolean, integer, uuid[], public.content_status,
  timestamptz, text
) from public, anon;
grant execute on function public.admin_save_work(
  uuid, integer, text, text, text, uuid, text, text, uuid, date, text, text,
  boolean, integer, boolean, integer, uuid[], public.content_status,
  timestamptz, text
) to authenticated;

create function public.admin_save_library_item(
  p_content_item_id uuid,
  p_expected_lock_version integer,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_project_id uuid,
  p_description_markdown text,
  p_access_policy_code text,
  p_download_enabled boolean,
  p_inline_preview_enabled boolean,
  p_cover_asset_id uuid,
  p_tag_ids uuid[],
  p_status public.content_status,
  p_publish_at timestamptz,
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
  if p_slug is null or btrim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(btrim(p_slug)) > 160
  then
    raise exception 'invalid Library slug' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception 'Library title is required' using errcode = '22023';
  end if;
  if p_excerpt is not null and length(p_excerpt) > 1000 then
    raise exception 'Library excerpt is too long' using errcode = '22023';
  end if;
  if p_description_markdown is null or length(p_description_markdown) > 200000 then
    raise exception 'invalid Library description' using errcode = '22023';
  end if;
  if p_status is null then
    raise exception 'Library status is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.library_access_policies as policy
    where policy.code = p_access_policy_code and policy.is_active
  ) then
    raise exception 'invalid Library access policy' using errcode = '23503';
  end if;
  if coalesce(p_download_enabled, false) and p_access_policy_code = 'public' then
    raise exception 'public policy does not deliver files anonymously' using errcode = '23514';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects as project
    where project.id = p_project_id and project.is_active and project.deleted_at is null
  ) then
    raise exception 'selected Project is unavailable' using errcode = '23503';
  end if;
  if cardinality(coalesce(p_tag_ids, '{}'::uuid[])) > 20 then
    raise exception 'at most 20 tags are allowed' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as requested(tag_id)
    left join public.tags as tag on tag.id = requested.tag_id
      and tag.is_active and tag.deleted_at is null
    where tag.id is null
  ) then
    raise exception 'one or more selected tags are unavailable' using errcode = '23503';
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
      id, kind, project_id, slug, title, excerpt, status, posted_at,
      publish_at, feed_at, feed_event_type, created_by, updated_by
    ) values (
      v_content_id, 'library', p_project_id, lower(btrim(p_slug)), btrim(p_title),
      nullif(btrim(p_excerpt), ''), p_status, v_now, v_publish_at,
      case when p_status = 'published' then v_publish_at else null end,
      case when p_status = 'published' then 'new'::public.feed_event_type else null end,
      v_actor_user_id, v_actor_user_id
    );
    insert into public.library_items (
      content_item_id, description_markdown, access_policy_code,
      download_enabled, inline_preview_enabled, cover_asset_id
    ) values (
      v_content_id, p_description_markdown, p_access_policy_code,
      coalesce(p_download_enabled, false), coalesce(p_inline_preview_enabled, false),
      p_cover_asset_id
    );
  else
    select content.* into v_existing
    from public.content_items as content
    where content.id = p_content_item_id
    for update;
    if not found or v_existing.kind <> 'library' then
      raise exception 'Library item not found' using errcode = 'P0002';
    end if;
    if v_existing.deleted_at is not null then
      raise exception 'restore trashed content before editing' using errcode = '23514';
    end if;
    if p_expected_lock_version is distinct from v_existing.lock_version then
      raise exception 'content changed since it was loaded' using errcode = '40001';
    end if;
    perform private.capture_content_revision(
      v_content_id,
      case when p_status = 'published' and v_existing.first_published_at is null
        then 'publish'::public.revision_event_type
        else 'update'::public.revision_event_type end,
      nullif(btrim(p_change_reason), ''), 'admin', v_actor_user_id
    );
    update public.content_items set
      project_id = p_project_id,
      slug = lower(btrim(p_slug)),
      title = btrim(p_title),
      excerpt = nullif(btrim(p_excerpt), ''),
      status = p_status,
      publish_at = v_publish_at,
      feed_at = case when p_status = 'published' then v_now else feed_at end,
      feed_event_type = case
        when p_status <> 'published' then feed_event_type
        when v_existing.first_published_at is null then 'new'::public.feed_event_type
        else 'updated'::public.feed_event_type end,
      updated_by = v_actor_user_id
    where id = v_content_id;
    update public.library_items set
      description_markdown = p_description_markdown,
      access_policy_code = p_access_policy_code,
      download_enabled = coalesce(p_download_enabled, false),
      inline_preview_enabled = coalesce(p_inline_preview_enabled, false),
      cover_asset_id = p_cover_asset_id
    where content_item_id = v_content_id;
  end if;

  delete from public.content_tags where content_item_id = v_content_id;
  insert into public.content_tags (content_item_id, tag_id)
  select v_content_id, requested.tag_id
  from (select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id) as requested;
  if v_is_new and p_status = 'published' then
    perform private.capture_content_revision(
      v_content_id, 'publish',
      coalesce(nullif(btrim(p_change_reason), ''), 'Initial publication'),
      'admin', v_actor_user_id
    );
  end if;
  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id, metadata
  ) values (
    case when v_is_new then 'library.created' else 'library.updated' end,
    'content_item', v_content_id, v_actor_user_id,
    jsonb_build_object('status', p_status, 'access_policy', p_access_policy_code)
  );
  return query select content.id, content.lock_version
  from public.content_items as content where content.id = v_content_id;
end;
$$;

revoke all on function public.admin_save_library_item(
  uuid, integer, text, text, text, uuid, text, text, boolean, boolean, uuid,
  uuid[], public.content_status, timestamptz, text
) from public, anon;
grant execute on function public.admin_save_library_item(
  uuid, integer, text, text, text, uuid, text, text, boolean, boolean, uuid,
  uuid[], public.content_status, timestamptz, text
) to authenticated;

create function public.admin_save_page(
  p_content_item_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_excerpt text,
  p_body_markdown text,
  p_seo_description text,
  p_status public.content_status,
  p_publish_at timestamptz,
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
  v_existing public.content_items%rowtype;
  v_page public.pages%rowtype;
  v_now timestamptz := clock_timestamp();
  v_publish_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;
  if p_content_item_id is null or p_expected_lock_version is null then
    raise exception 'existing Page identity and lock version are required' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception 'Page title is required' using errcode = '22023';
  end if;
  if p_excerpt is not null and length(p_excerpt) > 1000 then
    raise exception 'Page excerpt is too long' using errcode = '22023';
  end if;
  if p_body_markdown is null or length(p_body_markdown) > 300000 then
    raise exception 'invalid Page body' using errcode = '22023';
  end if;
  if p_seo_description is not null and length(p_seo_description) > 320 then
    raise exception 'SEO description is too long' using errcode = '22023';
  end if;
  if p_status is null then
    raise exception 'Page status is required' using errcode = '22023';
  end if;

  select content.* into v_existing
  from public.content_items as content
  where content.id = p_content_item_id
  for update;
  select page.* into v_page
  from public.pages as page
  where page.content_item_id = p_content_item_id;
  if not found or v_existing.kind <> 'page' then
    raise exception 'Page not found' using errcode = 'P0002';
  end if;
  if v_existing.deleted_at is not null then
    raise exception 'restore trashed content before editing' using errcode = '23514';
  end if;
  if p_expected_lock_version is distinct from v_existing.lock_version then
    raise exception 'content changed since it was loaded' using errcode = '40001';
  end if;
  if v_page.is_system and p_status <> 'published' then
    raise exception 'system Page must remain published' using errcode = '23514';
  end if;
  v_publish_at := case
    when p_status = 'published' then coalesce(p_publish_at, v_now)
    else p_publish_at
  end;
  perform private.capture_content_revision(
    p_content_item_id, 'update', nullif(btrim(p_change_reason), ''),
    'admin', v_actor_user_id
  );
  update public.content_items set
    title = btrim(p_title),
    excerpt = nullif(btrim(p_excerpt), ''),
    status = p_status,
    publish_at = v_publish_at,
    feed_at = case when p_status = 'published' then v_now else feed_at end,
    feed_event_type = case when p_status = 'published'
      then 'updated'::public.feed_event_type else feed_event_type end,
    updated_by = v_actor_user_id
  where id = p_content_item_id;
  update public.pages set
    body_markdown = p_body_markdown,
    seo_description = nullif(btrim(p_seo_description), '')
  where content_item_id = p_content_item_id;
  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id, metadata
  ) values (
    'page.updated', 'content_item', p_content_item_id, v_actor_user_id,
    jsonb_build_object('page_key', v_page.page_key, 'status', p_status)
  );
  return query select content.id, content.lock_version
  from public.content_items as content where content.id = p_content_item_id;
end;
$$;

revoke all on function public.admin_save_page(
  uuid, integer, text, text, text, text, public.content_status, timestamptz, text
) from public, anon;
grant execute on function public.admin_save_page(
  uuid, integer, text, text, text, text, public.content_status, timestamptz, text
) to authenticated;
