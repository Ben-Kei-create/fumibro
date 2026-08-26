-- Public child-table policies call the SECURITY INVOKER
-- private.content_is_public() helper. It evaluates deleted_at as part of the
-- canonical visibility predicate, so browser roles need that one additional
-- column privilege. RLS still hides every deleted root; the column is always
-- null on rows visible to a public browser.
grant select (deleted_at) on public.content_items to anon, authenticated;

-- Atomic command used by the lightweight mobile Admin form. Authentication is
-- rechecked inside the database; the browser cannot use this function with an
-- AAL1 session or without the trusted app_metadata admin role.
create function public.admin_create_quick_post(
  p_slug text,
  p_body_markdown text,
  p_title text default null,
  p_project_id uuid default null,
  p_post_category_id uuid default null,
  p_tag_ids uuid[] default '{}'::uuid[],
  p_publish boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid := gen_random_uuid();
  v_actor_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
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

  if p_body_markdown is null
    or length(btrim(p_body_markdown)) not between 1 and 200000
  then
    raise exception 'post body is required' using errcode = '22023';
  end if;

  if p_publish is null then
    raise exception 'publish mode is required' using errcode = '22023';
  end if;

  if cardinality(coalesce(p_tag_ids, '{}'::uuid[])) > 20 then
    raise exception 'at most 20 tags are allowed' using errcode = '22023';
  end if;

  if p_project_id is not null and not exists (
    select 1
    from public.projects as project
    where project.id = p_project_id
      and project.is_active
      and project.deleted_at is null
  ) then
    raise exception 'selected Project is unavailable' using errcode = '23503';
  end if;

  if p_post_category_id is not null and not exists (
    select 1
    from public.post_categories as category
    where category.id = p_post_category_id
      and category.is_active
      and category.deleted_at is null
  ) then
    raise exception 'selected category is unavailable' using errcode = '23503';
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

  insert into public.content_items (
    id,
    kind,
    project_id,
    slug,
    title,
    status,
    posted_at,
    publish_at,
    created_by,
    updated_by
  )
  values (
    v_content_item_id,
    'post',
    p_project_id,
    lower(btrim(p_slug)),
    nullif(btrim(p_title), ''),
    case when p_publish then 'published'::public.content_status else 'draft' end,
    v_now,
    case when p_publish then v_now else null end,
    v_actor_user_id,
    v_actor_user_id
  );

  insert into public.posts (
    content_item_id,
    body_markdown,
    post_category_id
  )
  values (
    v_content_item_id,
    btrim(p_body_markdown),
    p_post_category_id
  );

  insert into public.content_tags (content_item_id, tag_id)
  select v_content_item_id, requested.tag_id
  from (
    select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id
  ) as requested;

  if p_publish then
    perform private.capture_content_revision(
      v_content_item_id,
      'publish',
      'Initial Quick publication',
      'admin',
      v_actor_user_id
    );
  end if;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'content.quick_created',
    'content_item',
    v_content_item_id,
    v_actor_user_id,
    jsonb_build_object('published', p_publish)
  );

  return v_content_item_id;
end;
$$;

revoke all on function public.admin_create_quick_post(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid[],
  boolean
) from public, anon;

grant execute on function public.admin_create_quick_post(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid[],
  boolean
) to authenticated;
