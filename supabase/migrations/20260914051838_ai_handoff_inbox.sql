-- Phase 2: human-reviewed AI Handoff Inbox.
-- External systems may enqueue through one narrow service RPC. They never
-- receive table privileges and can never publish canonical content directly.

create type public.ai_handoff_destination as enum (
  'blog',
  'works',
  'library',
  'portfolio',
  'notice',
  'none'
);

create type public.ai_handoff_status as enum (
  'pending',
  'approved',
  'published',
  'ignored',
  'error'
);

create table public.ai_handoff_inbox (
  id uuid primary key default gen_random_uuid(),
  source_system text not null
    references public.content_source_systems(code) on update cascade on delete restrict,
  source_external_id text not null,
  source_title text,
  source_url text,
  source_date timestamptz,
  payload jsonb not null default '{}'::jsonb,
  suggested_project uuid references public.projects(id) on delete restrict,
  suggested_destination public.ai_handoff_destination not null default 'none',
  suggested_title text,
  suggested_body text,
  suggested_public_url text,
  status public.ai_handoff_status not null default 'pending',
  content_item_id uuid references public.content_items(id) on delete set null,
  notice_id uuid references public.notices(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_handoff_source_external_id_valid check (
    source_external_id = btrim(source_external_id)
    and length(source_external_id) between 1 and 512
  ),
  constraint ai_handoff_source_title_length check (
    source_title is null or length(source_title) <= 500
  ),
  constraint ai_handoff_source_url_valid check (
    source_url is null
    or (length(source_url) <= 2000 and source_url ~ '^https://')
  ),
  constraint ai_handoff_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint ai_handoff_payload_size check (pg_column_size(payload) <= 262144),
  constraint ai_handoff_suggested_title_length check (
    suggested_title is null or length(suggested_title) <= 240
  ),
  constraint ai_handoff_suggested_body_length check (
    suggested_body is null or length(suggested_body) <= 200000
  ),
  constraint ai_handoff_public_url_valid check (
    suggested_public_url is null
    or (length(suggested_public_url) <= 2000 and suggested_public_url ~ '^https://')
  ),
  constraint ai_handoff_last_error_length check (
    last_error is null or length(last_error) <= 1000
  ),
  constraint ai_handoff_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint ai_handoff_destination_state check (
    (status in ('approved', 'published') and num_nonnulls(content_item_id, notice_id) = 1)
    or (status not in ('approved', 'published') and content_item_id is null and notice_id is null)
  ),
  constraint ai_handoff_published_state check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  ),
  unique (source_system, source_external_id)
);

create index ai_handoff_inbox_status_created_idx
  on public.ai_handoff_inbox (status, created_at desc);
create index ai_handoff_inbox_project_idx
  on public.ai_handoff_inbox (suggested_project, created_at desc)
  where suggested_project is not null;
create index ai_handoff_inbox_content_item_idx
  on public.ai_handoff_inbox (content_item_id)
  where content_item_id is not null;
create index ai_handoff_inbox_notice_idx
  on public.ai_handoff_inbox (notice_id)
  where notice_id is not null;
create index ai_handoff_inbox_reviewed_by_idx
  on public.ai_handoff_inbox (reviewed_by)
  where reviewed_by is not null;

create trigger ai_handoff_inbox_set_updated_at
before update on public.ai_handoff_inbox
for each row execute function private.set_updated_at();

alter table public.ai_handoff_inbox enable row level security;

create policy ai_handoff_inbox_admin_select
on public.ai_handoff_inbox
for select
to authenticated
using ((select private.is_admin()));

revoke all on table public.ai_handoff_inbox
  from public, anon, authenticated, service_role;
grant select on table public.ai_handoff_inbox to authenticated;

-- Service-only ingestion. The caller supplies content suggestions, never
-- workflow status, reviewer identity, or canonical content identifiers.
create function public.service_enqueue_ai_handoff(
  p_source_system text,
  p_source_external_id text,
  p_source_title text,
  p_source_url text,
  p_source_date timestamptz,
  p_payload jsonb,
  p_suggested_project uuid,
  p_suggested_destination public.ai_handoff_destination,
  p_suggested_title text,
  p_suggested_body text,
  p_suggested_public_url text
)
returns table (
  handoff_id uuid,
  handoff_status public.ai_handoff_status,
  was_created boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_handoff_id uuid := gen_random_uuid();
  v_source_system text := lower(btrim(p_source_system));
  v_source_external_id text := btrim(p_source_external_id);
  v_created boolean := false;
begin
  if v_source_system = 'manual' or not exists (
    select 1
    from public.content_source_systems as source
    where source.code = v_source_system
      and source.is_enabled
  ) then
    raise exception 'unsupported source system' using errcode = '22023';
  end if;

  if v_source_external_id is null
    or length(v_source_external_id) not between 1 and 512
  then
    raise exception 'invalid source external id' using errcode = '22023';
  end if;

  if p_source_title is not null and length(p_source_title) > 500 then
    raise exception 'source title is too long' using errcode = '22023';
  end if;

  if p_source_url is not null
    and (length(p_source_url) > 2000 or p_source_url !~ '^https://')
  then
    raise exception 'invalid source URL' using errcode = '22023';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or pg_column_size(p_payload) > 262144
  then
    raise exception 'payload must be a JSON object no larger than 256 KiB'
      using errcode = '22023';
  end if;

  if p_suggested_project is not null and not exists (
    select 1
    from public.projects as project
    where project.id = p_suggested_project
      and project.is_active
      and project.deleted_at is null
  ) then
    raise exception 'suggested Project is unavailable' using errcode = '23503';
  end if;

  if p_suggested_title is not null and length(p_suggested_title) > 240 then
    raise exception 'suggested title is too long' using errcode = '22023';
  end if;

  if p_suggested_body is not null and length(p_suggested_body) > 200000 then
    raise exception 'suggested body is too long' using errcode = '22023';
  end if;

  if p_suggested_public_url is not null
    and (
      length(p_suggested_public_url) > 2000
      or p_suggested_public_url !~ '^https://'
    )
  then
    raise exception 'invalid suggested public URL' using errcode = '22023';
  end if;

  insert into public.ai_handoff_inbox (
    id,
    source_system,
    source_external_id,
    source_title,
    source_url,
    source_date,
    payload,
    suggested_project,
    suggested_destination,
    suggested_title,
    suggested_body,
    suggested_public_url,
    status
  ) values (
    v_handoff_id,
    v_source_system,
    v_source_external_id,
    nullif(btrim(p_source_title), ''),
    nullif(btrim(p_source_url), ''),
    p_source_date,
    p_payload,
    p_suggested_project,
    coalesce(p_suggested_destination, 'none'),
    nullif(btrim(p_suggested_title), ''),
    nullif(p_suggested_body, ''),
    nullif(btrim(p_suggested_public_url), ''),
    'pending'
  )
  on conflict (source_system, source_external_id) do nothing;

  v_created := found;

  select inbox.id, inbox.status
  into v_handoff_id, handoff_status
  from public.ai_handoff_inbox as inbox
  where inbox.source_system = v_source_system
    and inbox.source_external_id = v_source_external_id;

  if v_created then
    insert into public.admin_audit_events (
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      'ai_handoff.enqueued',
      'ai_handoff_inbox',
      v_handoff_id,
      jsonb_build_object(
        'source_system', v_source_system,
        'suggested_destination', coalesce(p_suggested_destination, 'none')
      )
    );
  end if;

  return query select v_handoff_id, handoff_status, v_created;
end;
$$;

revoke all on function public.service_enqueue_ai_handoff(
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  uuid,
  public.ai_handoff_destination,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.service_enqueue_ai_handoff(
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  uuid,
  public.ai_handoff_destination,
  text,
  text,
  text
) to service_role;

create function public.admin_ignore_ai_handoff(p_handoff_id uuid)
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

  update public.ai_handoff_inbox
  set
    status = 'ignored',
    reviewed_by = v_actor_user_id,
    reviewed_at = clock_timestamp(),
    last_error = null
  where id = p_handoff_id
    and status in ('pending', 'error');

  if not found then
    raise exception 'reviewable AI handoff not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id
  ) values (
    'ai_handoff.ignored', 'ai_handoff_inbox', p_handoff_id, v_actor_user_id
  );
end;
$$;

revoke all on function public.admin_ignore_ai_handoff(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_ignore_ai_handoff(uuid)
  to authenticated;

create function public.admin_mark_ai_handoff_error(
  p_handoff_id uuid,
  p_error text
)
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

  if p_error is null or length(btrim(p_error)) not between 1 and 1000 then
    raise exception 'invalid handoff error message' using errcode = '22023';
  end if;

  update public.ai_handoff_inbox
  set
    status = 'error',
    reviewed_by = v_actor_user_id,
    reviewed_at = clock_timestamp(),
    last_error = btrim(p_error)
  where id = p_handoff_id
    and status in ('pending', 'error');

  if not found then
    raise exception 'reviewable AI handoff not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_events (
    action, entity_type, entity_id, actor_user_id
  ) values (
    'ai_handoff.error', 'ai_handoff_inbox', p_handoff_id, v_actor_user_id
  );
end;
$$;

revoke all on function public.admin_mark_ai_handoff_error(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_mark_ai_handoff_error(uuid, text)
  to authenticated;

-- Convert one reviewed candidate through the existing canonical content
-- commands. Every destination is a draft; this function cannot publish.
create function public.admin_convert_ai_handoff(
  p_handoff_id uuid,
  p_destination public.ai_handoff_destination,
  p_project_id uuid default null
)
returns table (
  converted_handoff_id uuid,
  converted_content_item_id uuid,
  converted_notice_id uuid
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_handoff public.ai_handoff_inbox%rowtype;
  v_project_id uuid;
  v_slug text;
  v_title text;
  v_body text;
  v_content_item_id uuid;
  v_notice_id uuid;
begin
  if not private.is_admin() then
    raise exception 'AAL2 administrator session required' using errcode = '42501';
  end if;

  if p_destination is null
    or p_destination not in ('blog', 'works', 'library', 'portfolio', 'notice')
  then
    raise exception 'unsupported conversion destination' using errcode = '22023';
  end if;

  select inbox.*
  into v_handoff
  from public.ai_handoff_inbox as inbox
  where inbox.id = p_handoff_id
  for update;

  if not found or v_handoff.status not in ('pending', 'error') then
    raise exception 'reviewable AI handoff not found' using errcode = 'P0002';
  end if;

  v_project_id := coalesce(p_project_id, v_handoff.suggested_project);
  v_title := coalesce(v_handoff.suggested_title, v_handoff.source_title);
  v_body := v_handoff.suggested_body;
  v_slug := 'ai-' || v_handoff.source_system || '-'
    || left(replace(v_handoff.id::text, '-', ''), 12);

  if v_project_id is not null and not exists (
    select 1
    from public.projects as project
    where project.id = v_project_id
      and project.is_active
      and project.deleted_at is null
  ) then
    raise exception 'selected Project is unavailable' using errcode = '23503';
  end if;

  if v_body is null or length(btrim(v_body)) = 0 then
    raise exception 'suggested body is required' using errcode = '22023';
  end if;

  if p_destination = 'blog' then
    select result.saved_content_item_id
    into v_content_item_id
    from public.admin_save_post(
      p_content_item_id => null,
      p_expected_lock_version => null,
      p_slug => v_slug,
      p_title => v_title,
      p_excerpt => null,
      p_body_markdown => v_body,
      p_posted_at => coalesce(v_handoff.source_date, clock_timestamp()),
      p_publish_at => null,
      p_status => 'draft',
      p_project_id => v_project_id,
      p_post_category_id => null,
      p_location_id => null,
      p_tag_ids => '{}'::uuid[],
      p_image_asset_id => null,
      p_external_url => v_handoff.suggested_public_url,
      p_is_spoiler => false,
      p_watermark_enabled => false,
      p_change_reason => 'AI Handoff Inboxから下書き作成'
    ) as result;
  elsif p_destination in ('works', 'portfolio') then
    if v_title is null then
      raise exception 'suggested title is required for Works' using errcode = '22023';
    end if;

    select result.saved_content_item_id
    into v_content_item_id
    from public.admin_save_work(
      p_content_item_id => null,
      p_expected_lock_version => null,
      p_slug => v_slug,
      p_title => v_title,
      p_excerpt => null,
      p_project_id => v_project_id,
      p_summary => left(v_body, 1000),
      p_description_markdown => v_body,
      p_image_asset_id => null,
      p_released_on => v_handoff.source_date::date,
      p_external_url => v_handoff.suggested_public_url,
      p_work_type => 'other',
      p_show_on_home => false,
      p_home_display_order => 0,
      p_show_in_portfolio => p_destination = 'portfolio',
      p_portfolio_display_order => 0,
      p_tag_ids => '{}'::uuid[],
      p_status => 'draft',
      p_publish_at => null,
      p_change_reason => 'AI Handoff Inboxから下書き作成'
    ) as result;
  elsif p_destination = 'library' then
    if v_title is null then
      raise exception 'suggested title is required for Library' using errcode = '22023';
    end if;

    select result.saved_content_item_id
    into v_content_item_id
    from public.admin_save_library_item(
      p_content_item_id => null,
      p_expected_lock_version => null,
      p_slug => v_slug,
      p_title => v_title,
      p_excerpt => null,
      p_project_id => v_project_id,
      p_description_markdown => v_body,
      p_access_policy_code => 'public',
      p_download_enabled => false,
      p_inline_preview_enabled => false,
      p_cover_asset_id => null,
      p_tag_ids => '{}'::uuid[],
      p_status => 'draft',
      p_publish_at => null,
      p_change_reason => 'AI Handoff Inboxから下書き作成'
    ) as result;
  else
    if v_title is null then
      raise exception 'suggested title is required for a notice' using errcode = '22023';
    end if;

    insert into public.notices (
      title,
      body,
      link_url,
      link_label,
      status,
      starts_at,
      created_by,
      updated_by
    ) values (
      v_title,
      left(v_body, 3000),
      v_handoff.suggested_public_url,
      case when v_handoff.suggested_public_url is null then null else '詳細' end,
      'draft',
      coalesce(v_handoff.source_date, clock_timestamp()),
      v_actor_user_id,
      v_actor_user_id
    )
    returning id into v_notice_id;
  end if;

  if v_content_item_id is not null then
    update public.content_items
    set
      source_system = v_handoff.source_system,
      source_external_id = v_handoff.source_external_id,
      updated_by = v_actor_user_id
    where id = v_content_item_id;
  end if;

  update public.ai_handoff_inbox
  set
    suggested_destination = p_destination,
    suggested_project = v_project_id,
    status = 'approved',
    content_item_id = v_content_item_id,
    notice_id = v_notice_id,
    reviewed_by = v_actor_user_id,
    reviewed_at = clock_timestamp(),
    last_error = null
  where id = v_handoff.id;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  ) values (
    'ai_handoff.converted',
    'ai_handoff_inbox',
    v_handoff.id,
    v_actor_user_id,
    jsonb_build_object(
      'destination', p_destination,
      'content_item_id', v_content_item_id,
      'notice_id', v_notice_id
    )
  );

  return query select v_handoff.id, v_content_item_id, v_notice_id;
end;
$$;

revoke all on function public.admin_convert_ai_handoff(
  uuid, public.ai_handoff_destination, uuid
) from public, anon, authenticated;
grant execute on function public.admin_convert_ai_handoff(
  uuid, public.ai_handoff_destination, uuid
) to authenticated;

create function private.mark_ai_handoff_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    update public.ai_handoff_inbox
    set
      status = 'published',
      published_at = coalesce(new.publish_at, clock_timestamp())
    where content_item_id = new.id
      and status = 'approved';
  end if;

  return new;
end;
$$;

create trigger content_items_mark_ai_handoff_published
after update of status on public.content_items
for each row execute function private.mark_ai_handoff_published();

revoke execute on function private.mark_ai_handoff_published()
  from public, anon, authenticated;

comment on table public.ai_handoff_inbox is
  'Human-reviewed staging area for external AI and import suggestions.';
comment on function public.service_enqueue_ai_handoff(
  text, text, text, text, timestamptz, jsonb, uuid,
  public.ai_handoff_destination, text, text, text
) is
  'Service-only idempotent enqueue command. It always creates pending handoffs.';
