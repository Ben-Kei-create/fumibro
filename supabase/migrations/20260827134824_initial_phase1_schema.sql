-- FUMIBRO Phase 1
-- PostgreSQL 17 / Supabase. This migration is intentionally self-contained so a
-- fresh project can be rebuilt with `supabase db reset`.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgroonga with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create type public.content_kind as enum ('post', 'work', 'library', 'page');
create type public.content_status as enum ('draft', 'published', 'hidden');
create type public.feed_event_type as enum ('new', 'updated');
create type public.asset_kind as enum ('image', 'document', 'archive');
create type public.asset_state as enum ('uploaded', 'processing', 'ready', 'failed');
create type public.asset_visibility as enum ('private', 'public');
create type public.asset_variant_role as enum (
  'original',
  'display',
  'thumbnail',
  'download',
  'card_png'
);
create type public.notice_status as enum ('draft', 'published', 'hidden');
create type public.comment_status as enum ('pending', 'visible', 'hidden', 'spam');
create type public.inquiry_status as enum ('new', 'in_progress', 'closed', 'spam');
create type public.revision_event_type as enum ('publish', 'update', 'restore', 'import');
create type public.revision_actor_type as enum ('admin', 'ai', 'import', 'system');
create type public.visit_scope_type as enum ('site', 'project');
create type public.purge_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  theme_key text not null default 'default',
  external_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint projects_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint projects_theme_key_format check (theme_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint projects_external_url_format check (
    external_url is null or external_url ~ '^https?://'
  )
);

create table public.content_source_systems (
  code text primary key,
  label text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint content_source_systems_code_format check (
    code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  constraint content_source_systems_label_not_blank check (length(btrim(label)) between 1 and 80)
);

insert into public.content_source_systems (code, label)
values
  ('manual', 'Manual'),
  ('gmail', 'Gmail'),
  ('chatgpt', 'ChatGPT'),
  ('claude', 'Claude'),
  ('gemini', 'Gemini'),
  ('kdp', 'KDP'),
  ('import', 'Import')
on conflict (code) do nothing;

create table public.post_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null unique,
  icon_key text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint post_categories_label_not_blank check (length(btrim(label)) between 1 and 80),
  constraint post_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint post_categories_icon_key_format check (
    icon_key is null or icon_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  maps_query text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint locations_display_name_not_blank check (length(btrim(display_name)) between 1 and 160),
  constraint locations_maps_query_not_blank check (length(btrim(maps_query)) between 1 and 500)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null unique,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tags_label_not_blank check (length(btrim(label)) between 1 and 80),
  constraint tags_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.library_access_policies (
  code text primary key,
  label text not null,
  description text not null,
  allows_anonymous_download boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint library_access_policies_code_format check (
    code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  constraint library_access_policies_label_not_blank check (length(btrim(label)) between 1 and 80)
);

insert into public.library_access_policies (
  code,
  label,
  description,
  allows_anonymous_download
)
values
  ('public', 'Public', 'Public detail page and optional preview; no anonymous file delivery.', false),
  ('free_download', 'Free download', 'Anonymous delivery is allowed when download_enabled is true.', true),
  ('email_gate', 'Email gate', 'Reserved for a future email grant workflow.', false),
  ('paid', 'Paid', 'Reserved for a future order and download grant workflow.', false),
  ('restricted', 'Restricted', 'Reserved for manually granted access.', false)
on conflict (code) do nothing;

create table public.contact_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null unique,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contact_categories_label_not_blank check (length(btrim(label)) between 1 and 80),
  constraint contact_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  kind public.asset_kind not null,
  state public.asset_state not null default 'uploaded',
  visibility public.asset_visibility not null default 'private',
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text,
  width integer,
  height integer,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assets_original_filename_not_blank check (
    length(btrim(original_filename)) between 1 and 255
  ),
  constraint assets_mime_type_format check (
    mime_type ~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$'
  ),
  constraint assets_size_positive check (size_bytes > 0 and size_bytes <= 104857600),
  constraint assets_checksum_format check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint assets_dimensions_valid check (
    (width is null and height is null)
    or (width between 1 and 20000 and height between 1 and 20000)
  ),
  constraint assets_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_role public.asset_variant_role not null,
  bucket_id text not null,
  object_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text not null,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (asset_id, variant_role),
  unique (bucket_id, object_path),
  constraint asset_variants_bucket check (
    bucket_id in ('private-originals', 'public-media', 'private-downloads')
  ),
  constraint asset_variants_role_bucket check (
    (variant_role = 'original' and bucket_id = 'private-originals')
    or (variant_role in ('display', 'thumbnail', 'card_png') and bucket_id = 'public-media')
    or (variant_role = 'download' and bucket_id = 'private-downloads')
  ),
  constraint asset_variants_object_path_safe check (
    length(object_path) between 1 and 900
    and object_path !~ '(^/|(^|/)\\.\\.(/|$))'
  ),
  constraint asset_variants_mime_type_format check (
    mime_type ~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$'
  ),
  constraint asset_variants_size_positive check (size_bytes > 0 and size_bytes <= 104857600),
  constraint asset_variants_checksum_format check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint asset_variants_dimensions_valid check (
    (width is null and height is null)
    or (width between 1 and 20000 and height between 1 and 20000)
  )
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  project_id uuid references public.projects(id) on delete restrict,
  slug text not null,
  title text,
  excerpt text,
  status public.content_status not null default 'draft',
  posted_at timestamptz not null default now(),
  publish_at timestamptz,
  first_published_at timestamptz,
  feed_at timestamptz,
  feed_event_type public.feed_event_type,
  source_system text not null default 'manual'
    references public.content_source_systems(code) on update cascade on delete restrict,
  source_external_id text,
  search_text text not null default '',
  lock_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint content_items_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint content_items_title_valid check (
    (kind = 'post' and (title is null or length(btrim(title)) between 1 and 240))
    or (kind <> 'post' and title is not null and length(btrim(title)) between 1 and 240)
  ),
  constraint content_items_excerpt_length check (excerpt is null or length(excerpt) <= 1000),
  constraint content_items_publish_state check (
    status <> 'published'
    or (publish_at is not null and first_published_at is not null)
  ),
  constraint content_items_feed_state check (
    (feed_at is null and feed_event_type is null)
    or (feed_at is not null and feed_event_type is not null)
  ),
  constraint content_items_source_identity check (
    (source_system = 'manual' and source_external_id is null)
    or (
      source_system <> 'manual'
      and source_external_id is not null
      and source_external_id = btrim(source_external_id)
      and length(source_external_id) between 1 and 512
    )
  ),
  constraint content_items_lock_version_positive check (lock_version > 0),
  constraint content_items_deleted_actor check (deleted_at is not null or deleted_by is null)
);

-- Detail routes are canonical by kind and slug (`/blog/[slug]`,
-- `/works/[slug]`, `/library/[slug]`) regardless of Project classification.
create unique index content_items_kind_slug_uidx
  on public.content_items (kind, slug);
create unique index content_items_source_identity_uidx
  on public.content_items (source_system, source_external_id)
  where source_external_id is not null;
create index content_items_project_id_idx on public.content_items (project_id);
create index content_items_source_system_idx on public.content_items (source_system);
create index content_items_created_by_idx on public.content_items (created_by);
create index content_items_updated_by_idx on public.content_items (updated_by);
create index content_items_deleted_by_idx on public.content_items (deleted_by);
create index content_items_publish_idx
  on public.content_items (status, publish_at desc)
  where deleted_at is null;
create index content_items_project_publish_idx
  on public.content_items (project_id, status, publish_at desc)
  where deleted_at is null;
create index content_items_feed_idx
  on public.content_items (feed_at desc)
  where status = 'published' and deleted_at is null;
create index content_items_search_text_pgroonga_idx
  on public.content_items using pgroonga (search_text);

create table public.content_tags (
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, tag_id)
);
create index content_tags_tag_id_idx on public.content_tags (tag_id);

create table public.posts (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  body_markdown text not null,
  post_category_id uuid references public.post_categories(id) on delete restrict,
  location_id uuid references public.locations(id) on delete restrict,
  image_asset_id uuid references public.assets(id) on delete set null,
  external_url text,
  is_spoiler boolean not null default false,
  watermark_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_not_blank check (length(btrim(body_markdown)) between 1 and 200000),
  constraint posts_external_url_format check (external_url is null or external_url ~ '^https?://')
);
create index posts_post_category_id_idx on public.posts (post_category_id);
create index posts_location_id_idx on public.posts (location_id);
create index posts_image_asset_id_idx on public.posts (image_asset_id);

create table public.works (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  summary text,
  description_markdown text not null,
  image_asset_id uuid references public.assets(id) on delete set null,
  released_on date,
  external_url text,
  work_type text not null default 'other',
  show_on_home boolean not null default false,
  home_display_order integer not null default 0,
  show_in_portfolio boolean not null default false,
  portfolio_display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint works_summary_length check (summary is null or length(summary) <= 1000),
  constraint works_description_length check (length(description_markdown) <= 200000),
  constraint works_external_url_format check (external_url is null or external_url ~ '^https?://'),
  constraint works_type_format check (work_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);
create index works_image_asset_id_idx on public.works (image_asset_id);
create index works_home_idx on public.works (show_on_home, home_display_order);
create index works_portfolio_idx on public.works (show_in_portfolio, portfolio_display_order);

create table public.work_links (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(content_item_id) on delete cascade,
  link_kind text not null,
  label text not null,
  url text not null,
  display_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint work_links_kind_format check (link_kind ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint work_links_label_not_blank check (length(btrim(label)) between 1 and 100),
  constraint work_links_url_format check (url ~ '^https?://')
);
create index work_links_work_id_idx on public.work_links (work_id);

create table public.library_items (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  description_markdown text not null,
  access_policy_code text not null default 'public'
    references public.library_access_policies(code) on update cascade on delete restrict,
  download_enabled boolean not null default false,
  inline_preview_enabled boolean not null default false,
  cover_asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_items_description_length check (length(description_markdown) <= 200000)
);
create index library_items_access_policy_idx on public.library_items (access_policy_code);
create index library_items_cover_asset_id_idx on public.library_items (cover_asset_id);

create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.library_items(content_item_id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  version_label text not null default '1',
  display_name text not null,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint library_files_version_not_blank check (length(btrim(version_label)) between 1 and 40),
  constraint library_files_display_name_not_blank check (length(btrim(display_name)) between 1 and 255)
);
create index library_files_library_item_id_idx on public.library_files (library_item_id);
create index library_files_asset_id_idx on public.library_files (asset_id);
create unique index library_files_one_primary_uidx
  on public.library_files (library_item_id)
  where is_primary and deleted_at is null;

create table public.pages (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  page_key text not null unique,
  body_markdown text not null,
  seo_description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_key_format check (page_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint pages_body_length check (length(body_markdown) <= 300000),
  constraint pages_seo_description_length check (
    seo_description is null or length(seo_description) <= 320
  )
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link_url text,
  link_label text,
  display_order integer not null default 0,
  status public.notice_status not null default 'draft',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint notices_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint notices_body_length check (length(btrim(body)) between 1 and 3000),
  constraint notices_link_url_format check (
    link_url is null or link_url ~ '^(/|https?://)'
  ),
  constraint notices_date_order check (ends_at is null or ends_at > starts_at),
  constraint notices_deleted_actor check (deleted_at is not null or deleted_by is null)
);
create index notices_created_by_idx on public.notices (created_by);
create index notices_updated_by_idx on public.notices (updated_by);
create index notices_deleted_by_idx on public.notices (deleted_by);
create index notices_public_idx
  on public.notices (display_order, starts_at desc)
  where status = 'published' and deleted_at is null;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(content_item_id) on delete cascade,
  display_name text not null,
  body text not null,
  status public.comment_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint comments_display_name_length check (length(btrim(display_name)) between 1 and 80),
  constraint comments_body_length check (length(btrim(body)) between 1 and 5000),
  constraint comments_deleted_actor check (deleted_at is not null or deleted_by is null)
);
create index comments_post_id_idx on public.comments (post_id);
create index comments_moderated_by_idx on public.comments (moderated_by);
create index comments_deleted_by_idx on public.comments (deleted_by);
create index comments_moderation_idx on public.comments (status, submitted_at desc)
  where deleted_at is null;
create index comments_public_idx on public.comments (post_id, submitted_at)
  where status = 'visible' and deleted_at is null;

create table public.post_likes (
  post_id uuid not null references public.posts(content_item_id) on delete cascade,
  visitor_key bytea not null,
  created_at timestamptz not null default now(),
  primary key (post_id, visitor_key),
  constraint post_likes_visitor_key_length check (octet_length(visitor_key) = 32)
);

create table public.post_like_counts (
  post_id uuid primary key references public.posts(content_item_id) on delete cascade,
  like_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint post_like_counts_nonnegative check (like_count >= 0)
);

create table public.site_unique_visitors (
  visitor_key bytea primary key,
  counted_at timestamptz not null default now(),
  constraint site_unique_visitors_key_length check (octet_length(visitor_key) = 32)
);

create table public.project_unique_visitors (
  project_id uuid not null references public.projects(id) on delete cascade,
  visitor_key bytea not null,
  counted_at timestamptz not null default now(),
  primary key (project_id, visitor_key),
  constraint project_unique_visitors_key_length check (octet_length(visitor_key) = 32)
);

create table public.visit_counters (
  scope_key text primary key,
  scope_type public.visit_scope_type not null,
  project_id uuid unique references public.projects(id) on delete cascade,
  total bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint visit_counters_nonnegative check (total >= 0),
  constraint visit_counters_scope_consistency check (
    (scope_type = 'site' and scope_key = 'site' and project_id is null)
    or (
      scope_type = 'project'
      and project_id is not null
      and scope_key = 'project:' || project_id::text
    )
  )
);
create index visit_counters_project_id_idx on public.visit_counters (project_id);

create table public.site_settings (
  setting_key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_key_format check (
    setting_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  ),
  constraint site_settings_no_secret_keys check (
    setting_key !~* '(secret|password|token|api[_-]?key|service[_-]?role)'
  )
);
create index site_settings_updated_by_idx on public.site_settings (updated_by);

create table public.business_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  organization text,
  job_title text,
  email text,
  phone text,
  website text,
  address text,
  note text,
  png_asset_id uuid references public.assets(id) on delete set null,
  is_primary boolean not null default false,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint business_cards_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint business_cards_name_not_blank check (length(btrim(display_name)) between 1 and 120),
  constraint business_cards_email_format check (
    email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+$')
  ),
  constraint business_cards_website_format check (website is null or website ~ '^https?://'),
  constraint business_cards_deleted_actor check (deleted_at is not null or deleted_by is null)
);
create index business_cards_png_asset_id_idx on public.business_cards (png_asset_id);
create index business_cards_created_by_idx on public.business_cards (created_by);
create index business_cards_updated_by_idx on public.business_cards (updated_by);
create index business_cards_deleted_by_idx on public.business_cards (deleted_by);
create unique index business_cards_one_primary_uidx
  on public.business_cards ((true))
  where is_primary and deleted_at is null;

create table public.business_card_links (
  id uuid primary key default gen_random_uuid(),
  business_card_id uuid not null references public.business_cards(id) on delete cascade,
  link_kind text not null,
  label text not null,
  url text not null,
  display_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint business_card_links_kind_format check (
    link_kind ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  constraint business_card_links_label_not_blank check (length(btrim(label)) between 1 and 100),
  constraint business_card_links_url_format check (url ~ '^https?://')
);
create index business_card_links_card_id_idx on public.business_card_links (business_card_id);

create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.contact_categories(id) on delete restrict,
  name text not null,
  email text not null,
  subject text,
  message text not null,
  status public.inquiry_status not null default 'new',
  admin_note text,
  submitted_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint contact_inquiries_name_length check (length(btrim(name)) between 1 and 120),
  constraint contact_inquiries_email_format check (
    length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  constraint contact_inquiries_subject_length check (subject is null or length(subject) <= 240),
  constraint contact_inquiries_message_length check (length(btrim(message)) between 1 and 10000),
  constraint contact_inquiries_admin_note_length check (admin_note is null or length(admin_note) <= 10000),
  constraint contact_inquiries_deleted_actor check (deleted_at is not null or deleted_by is null)
);
create index contact_inquiries_category_id_idx on public.contact_inquiries (category_id);
create index contact_inquiries_handled_by_idx on public.contact_inquiries (handled_by);
create index contact_inquiries_deleted_by_idx on public.contact_inquiries (deleted_by);
create index contact_inquiries_inbox_idx on public.contact_inquiries (status, submitted_at desc)
  where deleted_at is null;

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  revision_no bigint not null,
  schema_version integer not null default 1,
  snapshot jsonb not null,
  event_type public.revision_event_type not null,
  change_reason text,
  actor_type public.revision_actor_type not null default 'admin',
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_item_id, revision_no),
  constraint content_revisions_revision_positive check (revision_no > 0),
  constraint content_revisions_schema_version_positive check (schema_version > 0),
  constraint content_revisions_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint content_revisions_reason_length check (change_reason is null or length(change_reason) <= 1000)
);
create index content_revisions_actor_user_id_idx on public.content_revisions (actor_user_id);
create index content_revisions_created_at_idx on public.content_revisions (content_item_id, created_at desc);

create table public.content_revision_assets (
  revision_id uuid not null references public.content_revisions(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  primary key (revision_id, asset_id)
);
create index content_revision_assets_asset_id_idx on public.content_revision_assets (asset_id);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_events_action_format check (
    action ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  ),
  constraint admin_audit_events_entity_type_format check (
    entity_type ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  ),
  constraint admin_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index admin_audit_events_actor_user_id_idx on public.admin_audit_events (actor_user_id);
create index admin_audit_events_target_idx on public.admin_audit_events (entity_type, entity_id, created_at desc);

create table public.purge_jobs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references public.content_items(id) on delete set null,
  status public.purge_status not null default 'pending',
  object_manifest jsonb not null default '[]'::jsonb,
  attempts integer not null default 0,
  last_error text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  constraint purge_jobs_manifest_array check (jsonb_typeof(object_manifest) = 'array'),
  constraint purge_jobs_attempts_nonnegative check (attempts >= 0),
  constraint purge_jobs_completion_state check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);
create index purge_jobs_content_item_id_idx on public.purge_jobs (content_item_id);
create index purge_jobs_requested_by_idx on public.purge_jobs (requested_by);
create index purge_jobs_completed_by_idx on public.purge_jobs (completed_by);
create index purge_jobs_queue_idx on public.purge_jobs (status, requested_at)
  where status in ('pending', 'failed');

create table private.rate_limit_buckets (
  action_key text not null,
  subject_key bytea not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (action_key, subject_key, window_started_at),
  constraint rate_limit_buckets_action_format check (
    action_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  ),
  constraint rate_limit_buckets_subject_length check (octet_length(subject_key) = 32),
  constraint rate_limit_buckets_hit_count_positive check (hit_count > 0),
  constraint rate_limit_buckets_expiry check (expires_at > window_started_at)
);
create index rate_limit_buckets_expires_at_idx on private.rate_limit_buckets (expires_at);

-- Authorization helpers used by RLS. Neither function reads user-editable
-- user_metadata. The administrator role must be in app_metadata and the active
-- session must already be AAL2.
create function private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

create function private.content_is_public(p_content_item_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.content_items as content
    where content.id = p_content_item_id
      and content.status = 'published'
      and content.publish_at <= now()
      and content.deleted_at is null
  );
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.prepare_content_item()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.slug := lower(btrim(new.slug));
  new.title := nullif(btrim(new.title), '');
  new.source_external_id := nullif(btrim(new.source_external_id), '');

  if new.status = 'published' then
    new.publish_at := coalesce(new.publish_at, clock_timestamp());
    new.first_published_at := coalesce(new.first_published_at, new.publish_at);
    new.feed_at := coalesce(new.feed_at, new.publish_at);
    new.feed_event_type := coalesce(new.feed_event_type, 'new');
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := clock_timestamp();
    new.lock_version := old.lock_version + 1;
  end if;

  return new;
end;
$$;

create trigger content_items_prepare_insert
before insert on public.content_items
for each row execute function private.prepare_content_item();

create trigger content_items_prepare_update
before update of
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
  source_system,
  source_external_id,
  updated_by,
  deleted_at,
  deleted_by
on public.content_items
for each row execute function private.prepare_content_item();

create function private.assert_content_kind()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
  v_actual_kind public.content_kind;
  v_expected_kind public.content_kind := tg_argv[0]::public.content_kind;
begin
  v_content_item_id := new.content_item_id;

  select kind into v_actual_kind
  from public.content_items
  where id = v_content_item_id;

  if v_actual_kind is null or v_actual_kind <> v_expected_kind then
    raise exception 'content item % must have kind %, got %',
      v_content_item_id,
      v_expected_kind,
      coalesce(v_actual_kind::text, 'missing')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger posts_assert_kind
before insert or update of content_item_id on public.posts
for each row execute function private.assert_content_kind('post');

create trigger works_assert_kind
before insert or update of content_item_id on public.works
for each row execute function private.assert_content_kind('work');

create trigger library_items_assert_kind
before insert or update of content_item_id on public.library_items
for each row execute function private.assert_content_kind('library');

create trigger pages_assert_kind
before insert or update of content_item_id on public.pages
for each row execute function private.assert_content_kind('page');

create function private.refresh_content_search(
  p_content_item_id uuid,
  p_touch_content boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_search_text text;
begin
  select btrim(concat_ws(
    E'\n',
    content.title,
    content.excerpt,
    project.name,
    tag_list.labels,
    post.body_markdown,
    work.summary,
    work.description_markdown,
    library.description_markdown,
    page.body_markdown
  ))
  into v_search_text
  from public.content_items as content
  left join public.projects as project
    on project.id = content.project_id
    and project.is_active
    and project.deleted_at is null
  left join lateral (
    select string_agg(tag.label, ' ' order by tag.label) as labels
    from public.content_tags as content_tag
    join public.tags as tag on tag.id = content_tag.tag_id
    where content_tag.content_item_id = content.id
      and tag.is_active
      and tag.deleted_at is null
  ) as tag_list on true
  left join public.posts as post on post.content_item_id = content.id
  left join public.works as work on work.content_item_id = content.id
  left join public.library_items as library on library.content_item_id = content.id
  left join public.pages as page on page.content_item_id = content.id
  where content.id = p_content_item_id;

  update public.content_items
  set
    search_text = coalesce(v_search_text, ''),
    updated_at = case when p_touch_content then clock_timestamp() else updated_at end,
    lock_version = case when p_touch_content then lock_version + 1 else lock_version end
  where id = p_content_item_id;
end;
$$;

create function private.refresh_content_search_from_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.refresh_content_search(new.id, false);
  return new;
end;
$$;

create function private.refresh_content_search_from_detail()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
begin
  if tg_op = 'DELETE' then
    v_content_item_id := old.content_item_id;
  else
    v_content_item_id := new.content_item_id;
  end if;

  perform private.refresh_content_search(v_content_item_id, true);
  return coalesce(new, old);
end;
$$;

create trigger content_items_search_after_insert
after insert on public.content_items
for each row execute function private.refresh_content_search_from_parent();

create trigger content_items_search_after_title
after update of title, excerpt, project_id on public.content_items
for each row execute function private.refresh_content_search_from_parent();

create trigger posts_refresh_search
after insert or update of body_markdown or delete on public.posts
for each row execute function private.refresh_content_search_from_detail();

create trigger works_refresh_search
after insert or update of summary, description_markdown or delete on public.works
for each row execute function private.refresh_content_search_from_detail();

create trigger library_items_refresh_search
after insert or update of description_markdown or delete on public.library_items
for each row execute function private.refresh_content_search_from_detail();

create trigger pages_refresh_search
after insert or update of body_markdown or delete on public.pages
for each row execute function private.refresh_content_search_from_detail();

create trigger content_tags_refresh_search
after insert or update of content_item_id, tag_id or delete on public.content_tags
for each row execute function private.refresh_content_search_from_detail();

create function private.refresh_search_for_tag()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
begin
  for v_content_item_id in
    select content_tag.content_item_id
    from public.content_tags as content_tag
    where content_tag.tag_id = new.id
  loop
    perform private.refresh_content_search(v_content_item_id, false);
  end loop;
  return new;
end;
$$;

create trigger tags_refresh_content_search
after update of label, is_active, deleted_at on public.tags
for each row execute function private.refresh_search_for_tag();

create function private.refresh_search_for_project()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
begin
  for v_content_item_id in
    select content.id
    from public.content_items as content
    where content.project_id = new.id
  loop
    perform private.refresh_content_search(v_content_item_id, false);
  end loop;
  return new;
end;
$$;

create trigger projects_refresh_content_search
after update of name, is_active, deleted_at on public.projects
for each row execute function private.refresh_search_for_project();

create function private.protect_system_page_detail()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'system page % cannot be deleted', old.page_key using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.is_system and (
    new.page_key is distinct from old.page_key
    or new.is_system is distinct from true
    or new.content_item_id is distinct from old.content_item_id
  ) then
    raise exception 'system page identity cannot be changed' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger pages_protect_system
before update or delete on public.pages
for each row execute function private.protect_system_page_detail();

create function private.protect_system_page_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_page_key text;
begin
  select page_key into v_page_key
  from public.pages
  where content_item_id = old.id and is_system;

  if v_page_key is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'system page % cannot be deleted', v_page_key using errcode = '23514';
  end if;

  if new.kind <> 'page'
    or new.slug is distinct from old.slug
    or new.project_id is not null
    or new.status <> 'published'
    or new.publish_at is null
    or new.publish_at > clock_timestamp()
    or new.deleted_at is not null
  then
    raise exception 'system page % cannot be moved, hidden, scheduled, or deleted', v_page_key
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger content_items_protect_system_page
before update or delete on public.content_items
for each row execute function private.protect_system_page_content();

-- Routine updated_at maintenance for tables that do not use lock_version.
create trigger projects_set_updated_at before update on public.projects
for each row execute function private.set_updated_at();
create trigger post_categories_set_updated_at before update on public.post_categories
for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function private.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function private.set_updated_at();
create trigger contact_categories_set_updated_at before update on public.contact_categories
for each row execute function private.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
for each row execute function private.set_updated_at();
create trigger posts_set_updated_at before update on public.posts
for each row execute function private.set_updated_at();
create trigger works_set_updated_at before update on public.works
for each row execute function private.set_updated_at();
create trigger work_links_set_updated_at before update on public.work_links
for each row execute function private.set_updated_at();
create trigger library_items_set_updated_at before update on public.library_items
for each row execute function private.set_updated_at();
create trigger library_files_set_updated_at before update on public.library_files
for each row execute function private.set_updated_at();
create trigger pages_set_updated_at before update on public.pages
for each row execute function private.set_updated_at();
create trigger notices_set_updated_at before update on public.notices
for each row execute function private.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function private.set_updated_at();
create trigger business_cards_set_updated_at before update on public.business_cards
for each row execute function private.set_updated_at();
create trigger business_card_links_set_updated_at before update on public.business_card_links
for each row execute function private.set_updated_at();

create function private.initialize_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.post_like_counts (post_id, like_count)
  values (new.content_item_id, 0)
  on conflict (post_id) do nothing;
  return new;
end;
$$;

create trigger posts_initialize_like_count
after insert on public.posts
for each row execute function private.initialize_post_like_count();

create function private.update_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_like_counts (post_id, like_count, updated_at)
    values (new.post_id, 1, clock_timestamp())
    on conflict (post_id) do update
      set like_count = public.post_like_counts.like_count + 1,
          updated_at = excluded.updated_at;
    return new;
  end if;

  update public.post_like_counts
  set like_count = greatest(like_count - 1, 0), updated_at = clock_timestamp()
  where post_id = old.post_id;
  return old;
end;
$$;

create trigger post_likes_update_count
after insert or delete on public.post_likes
for each row execute function private.update_post_like_count();

create function private.update_site_visit_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.visit_counters (scope_key, scope_type, total, updated_at)
    values ('site', 'site', 1, clock_timestamp())
    on conflict (scope_key) do update
      set total = public.visit_counters.total + 1,
          updated_at = excluded.updated_at;
    return new;
  end if;

  update public.visit_counters
  set total = greatest(total - 1, 0), updated_at = clock_timestamp()
  where scope_key = 'site';
  return old;
end;
$$;

create trigger site_unique_visitors_update_count
after insert or delete on public.site_unique_visitors
for each row execute function private.update_site_visit_count();

create function private.update_project_visit_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.visit_counters (scope_key, scope_type, project_id, total, updated_at)
    values (
      'project:' || new.project_id::text,
      'project',
      new.project_id,
      1,
      clock_timestamp()
    )
    on conflict (scope_key) do update
      set total = public.visit_counters.total + 1,
          updated_at = excluded.updated_at;
    return new;
  end if;

  update public.visit_counters
  set total = greatest(total - 1, 0), updated_at = clock_timestamp()
  where scope_key = 'project:' || old.project_id::text;
  return old;
end;
$$;

create trigger project_unique_visitors_update_count
after insert or delete on public.project_unique_visitors
for each row execute function private.update_project_visit_count();

create function private.consume_rate_limit(
  p_action_key text,
  p_subject_key bytea,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_window_started_at timestamptz;
  v_hit_count integer;
begin
  if p_action_key !~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
    or octet_length(p_subject_key) <> 32
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'invalid rate limit input' using errcode = '22023';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into private.rate_limit_buckets (
    action_key,
    subject_key,
    window_started_at,
    hit_count,
    expires_at
  )
  values (
    p_action_key,
    p_subject_key,
    v_window_started_at,
    1,
    v_window_started_at + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (action_key, subject_key, window_started_at) do update
    set hit_count = private.rate_limit_buckets.hit_count + 1
    where private.rate_limit_buckets.hit_count < p_limit
  returning hit_count into v_hit_count;

  return v_hit_count is not null and v_hit_count <= p_limit;
end;
$$;

create function private.register_post_like(
  p_post_id uuid,
  p_visitor_key bytea
)
returns table (accepted boolean, total bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted integer;
begin
  if octet_length(p_visitor_key) <> 32 then
    raise exception 'visitor key must be a 32-byte HMAC' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.content_items
    where id = p_post_id
      and kind = 'post'
      and status = 'published'
      and publish_at <= now()
      and deleted_at is null
  ) then
    raise exception 'post is not publicly available' using errcode = 'P0002';
  end if;

  insert into public.post_likes (post_id, visitor_key)
  values (p_post_id, p_visitor_key)
  on conflict (post_id, visitor_key) do nothing;
  get diagnostics v_inserted = row_count;

  return query
  select
    v_inserted = 1,
    coalesce((select like_count from public.post_like_counts where post_id = p_post_id), 0);
end;
$$;

create function private.register_site_visit(p_visitor_key bytea)
returns table (accepted boolean, total bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted integer;
begin
  if octet_length(p_visitor_key) <> 32 then
    raise exception 'visitor key must be a 32-byte HMAC' using errcode = '22023';
  end if;

  insert into public.site_unique_visitors (visitor_key)
  values (p_visitor_key)
  on conflict (visitor_key) do nothing;
  get diagnostics v_inserted = row_count;

  return query
  select
    v_inserted = 1,
    coalesce((select counter.total from public.visit_counters as counter where scope_key = 'site'), 0);
end;
$$;

create function private.register_project_visit(
  p_project_id uuid,
  p_visitor_key bytea
)
returns table (accepted boolean, total bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted integer;
begin
  if octet_length(p_visitor_key) <> 32 then
    raise exception 'visitor key must be a 32-byte HMAC' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and is_active and deleted_at is null
  ) then
    raise exception 'project is not publicly available' using errcode = 'P0002';
  end if;

  insert into public.project_unique_visitors (project_id, visitor_key)
  values (p_project_id, p_visitor_key)
  on conflict (project_id, visitor_key) do nothing;
  get diagnostics v_inserted = row_count;

  return query
  select
    v_inserted = 1,
    coalesce((
      select counter.total
      from public.visit_counters as counter
      where scope_key = 'project:' || p_project_id::text
    ), 0);
end;
$$;

create function private.library_file_is_anonymously_downloadable(p_library_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.library_files as file
    join public.library_items as library on library.content_item_id = file.library_item_id
    join public.content_items as content on content.id = library.content_item_id
    join public.assets as asset on asset.id = file.asset_id
    where file.id = p_library_file_id
      and file.deleted_at is null
      and library.access_policy_code = 'free_download'
      and library.download_enabled
      and content.status = 'published'
      and content.publish_at <= now()
      and content.deleted_at is null
      and asset.state = 'ready'
      and asset.deleted_at is null
      and exists (
        select 1
        from public.asset_variants as variant
        where variant.asset_id = asset.id
          and variant.variant_role = 'download'
          and variant.bucket_id = 'private-downloads'
      )
  );
$$;

create function private.capture_content_revision(
  p_content_item_id uuid,
  p_event_type public.revision_event_type,
  p_change_reason text default null,
  p_actor_type public.revision_actor_type default 'admin',
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_content_kind public.content_kind;
  v_revision_id uuid := gen_random_uuid();
  v_revision_no bigint;
  v_snapshot jsonb;
begin
  perform 1
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  select kind into v_content_kind
  from public.content_items
  where id = p_content_item_id;

  select coalesce(max(revision_no), 0) + 1
  into v_revision_no
  from public.content_revisions
  where content_item_id = p_content_item_id;

  select jsonb_build_object(
    'schema_version', 1,
    'content_item',
      to_jsonb(content)
        - array[
          'search_text',
          'lock_version',
          'created_by',
          'updated_by',
          'deleted_by',
          'created_at',
          'updated_at',
          'deleted_at'
        ],
    'detail',
      case content.kind
        when 'post' then (
          select to_jsonb(post) - array['content_item_id', 'created_at', 'updated_at']
          from public.posts as post
          where post.content_item_id = content.id
        )
        when 'work' then (
          select to_jsonb(work) - array['content_item_id', 'created_at', 'updated_at']
          from public.works as work
          where work.content_item_id = content.id
        )
        when 'library' then (
          select to_jsonb(library) - array['content_item_id', 'created_at', 'updated_at']
          from public.library_items as library
          where library.content_item_id = content.id
        )
        when 'page' then (
          select to_jsonb(page) - array['content_item_id', 'created_at', 'updated_at']
          from public.pages as page
          where page.content_item_id = content.id
        )
      end,
    'tag_ids',
      coalesce((
        select jsonb_agg(tag.tag_id order by tag.tag_id)
        from public.content_tags as tag
        where tag.content_item_id = content.id
      ), '[]'::jsonb)
  )
  into v_snapshot
  from public.content_items as content
  where content.id = p_content_item_id;

  if v_snapshot -> 'detail' is null or v_snapshot -> 'detail' = 'null'::jsonb then
    raise exception 'content item has no matching % detail row', v_content_kind
      using errcode = '23514';
  end if;

  insert into public.content_revisions (
    id,
    content_item_id,
    revision_no,
    schema_version,
    snapshot,
    event_type,
    change_reason,
    actor_type,
    actor_user_id
  )
  values (
    v_revision_id,
    p_content_item_id,
    v_revision_no,
    1,
    v_snapshot,
    p_event_type,
    p_change_reason,
    p_actor_type,
    p_actor_user_id
  );

  insert into public.content_revision_assets (revision_id, asset_id)
  select v_revision_id, referenced.asset_id
  from (
    select post.image_asset_id as asset_id
    from public.posts as post
    where post.content_item_id = p_content_item_id
    union
    select work.image_asset_id
    from public.works as work
    where work.content_item_id = p_content_item_id
    union
    select library.cover_asset_id
    from public.library_items as library
    where library.content_item_id = p_content_item_id
    union
    select file.asset_id
    from public.library_files as file
    where file.library_item_id = p_content_item_id and file.deleted_at is null
  ) as referenced
  where referenced.asset_id is not null
  on conflict do nothing;

  return v_revision_id;
end;
$$;

create function private.restore_content_revision(
  p_revision_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_content_item_id uuid;
  v_content_kind public.content_kind;
  v_snapshot jsonb;
  v_parent jsonb;
  v_detail jsonb;
  v_before_revision_id uuid;
begin
  select revision.content_item_id, content.kind, revision.snapshot
  into v_content_item_id, v_content_kind, v_snapshot
  from public.content_revisions as revision
  join public.content_items as content on content.id = revision.content_item_id
  where revision.id = p_revision_id
  for update of content;

  if not found then
    raise exception 'revision not found' using errcode = 'P0002';
  end if;

  if coalesce((v_snapshot ->> 'schema_version')::integer, 0) <> 1 then
    raise exception 'unsupported revision schema version' using errcode = '22023';
  end if;

  v_parent := v_snapshot -> 'content_item';
  v_detail := v_snapshot -> 'detail';

  if (v_parent ->> 'id')::uuid <> v_content_item_id
    or (v_parent ->> 'kind')::public.content_kind <> v_content_kind
  then
    raise exception 'revision identity does not match current content' using errcode = '23514';
  end if;

  v_before_revision_id := private.capture_content_revision(
    v_content_item_id,
    'restore',
    'Automatic snapshot before restoring revision ' || p_revision_id::text,
    'admin',
    p_actor_user_id
  );

  update public.content_items
  set
    project_id = nullif(v_parent ->> 'project_id', '')::uuid,
    slug = v_parent ->> 'slug',
    title = v_parent ->> 'title',
    excerpt = v_parent ->> 'excerpt',
    status = (v_parent ->> 'status')::public.content_status,
    posted_at = (v_parent ->> 'posted_at')::timestamptz,
    publish_at = nullif(v_parent ->> 'publish_at', '')::timestamptz,
    first_published_at = nullif(v_parent ->> 'first_published_at', '')::timestamptz,
    feed_at = nullif(v_parent ->> 'feed_at', '')::timestamptz,
    feed_event_type = case
      when v_parent ->> 'feed_event_type' is null then null
      else (v_parent ->> 'feed_event_type')::public.feed_event_type
    end,
    updated_by = p_actor_user_id
  where id = v_content_item_id;

  case v_content_kind
    when 'post' then
      update public.posts
      set
        body_markdown = v_detail ->> 'body_markdown',
        post_category_id = nullif(v_detail ->> 'post_category_id', '')::uuid,
        location_id = nullif(v_detail ->> 'location_id', '')::uuid,
        image_asset_id = nullif(v_detail ->> 'image_asset_id', '')::uuid,
        external_url = v_detail ->> 'external_url',
        is_spoiler = (v_detail ->> 'is_spoiler')::boolean,
        watermark_enabled = (v_detail ->> 'watermark_enabled')::boolean
      where content_item_id = v_content_item_id;
    when 'work' then
      update public.works
      set
        summary = v_detail ->> 'summary',
        description_markdown = v_detail ->> 'description_markdown',
        image_asset_id = nullif(v_detail ->> 'image_asset_id', '')::uuid,
        released_on = nullif(v_detail ->> 'released_on', '')::date,
        external_url = v_detail ->> 'external_url',
        work_type = v_detail ->> 'work_type',
        show_on_home = (v_detail ->> 'show_on_home')::boolean,
        home_display_order = (v_detail ->> 'home_display_order')::integer,
        show_in_portfolio = (v_detail ->> 'show_in_portfolio')::boolean,
        portfolio_display_order = (v_detail ->> 'portfolio_display_order')::integer
      where content_item_id = v_content_item_id;
    when 'library' then
      update public.library_items
      set
        description_markdown = v_detail ->> 'description_markdown',
        access_policy_code = v_detail ->> 'access_policy_code',
        download_enabled = (v_detail ->> 'download_enabled')::boolean,
        inline_preview_enabled = (v_detail ->> 'inline_preview_enabled')::boolean,
        cover_asset_id = nullif(v_detail ->> 'cover_asset_id', '')::uuid
      where content_item_id = v_content_item_id;
    when 'page' then
      update public.pages
      set
        page_key = v_detail ->> 'page_key',
        body_markdown = v_detail ->> 'body_markdown',
        seo_description = v_detail ->> 'seo_description',
        is_system = (v_detail ->> 'is_system')::boolean
      where content_item_id = v_content_item_id;
  end case;

  delete from public.content_tags where content_item_id = v_content_item_id;
  insert into public.content_tags (content_item_id, tag_id)
  select v_content_item_id, value::uuid
  from jsonb_array_elements_text(coalesce(v_snapshot -> 'tag_ids', '[]'::jsonb)) as tag(value)
  on conflict do nothing;

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'content.revision_restored',
    'content_item',
    v_content_item_id,
    p_actor_user_id,
    jsonb_build_object(
      'restored_revision_id', p_revision_id,
      'before_restore_revision_id', v_before_revision_id
    )
  );

  return v_before_revision_id;
end;
$$;

create function private.request_content_purge(
  p_content_item_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job_id uuid := gen_random_uuid();
  v_manifest jsonb;
begin
  perform 1
  from public.content_items
  where id = p_content_item_id and deleted_at is not null
  for update;

  if not found then
    raise exception 'only trashed content can be permanently purged' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.pages
    where content_item_id = p_content_item_id and is_system
  ) then
    raise exception 'system pages cannot be purged' using errcode = '23514';
  end if;

  -- Only exclusive assets are candidates for byte deletion. A shared media
  -- object must survive when another content item, revision, or business card
  -- still references it. The purge worker rechecks this invariant before it
  -- removes each Storage object and asset row.
  with target_assets as (
    select post.image_asset_id as asset_id
    from public.posts as post
    where post.content_item_id = p_content_item_id
    union
    select work.image_asset_id
    from public.works as work
    where work.content_item_id = p_content_item_id
    union
    select library.cover_asset_id
    from public.library_items as library
    where library.content_item_id = p_content_item_id
    union
    select file.asset_id
    from public.library_files as file
    where file.library_item_id = p_content_item_id
  ),
  exclusive_assets as (
    select target.asset_id
    from target_assets as target
    where target.asset_id is not null
      and not exists (
        select 1 from public.posts as post
        where post.image_asset_id = target.asset_id
          and post.content_item_id <> p_content_item_id
      )
      and not exists (
        select 1 from public.works as work
        where work.image_asset_id = target.asset_id
          and work.content_item_id <> p_content_item_id
      )
      and not exists (
        select 1 from public.library_items as library
        where library.cover_asset_id = target.asset_id
          and library.content_item_id <> p_content_item_id
      )
      and not exists (
        select 1 from public.library_files as file
        where file.asset_id = target.asset_id
          and file.library_item_id <> p_content_item_id
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
          and revision.content_item_id <> p_content_item_id
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_id', variant.asset_id,
    'bucket_id', variant.bucket_id,
    'object_path', variant.object_path
  ) order by variant.bucket_id, variant.object_path), '[]'::jsonb)
  into v_manifest
  from public.asset_variants as variant
  where variant.asset_id in (select asset_id from exclusive_assets);

  insert into public.purge_jobs (
    id,
    content_item_id,
    object_manifest,
    requested_by
  )
  values (v_job_id, p_content_item_id, v_manifest, p_actor_user_id);

  insert into public.admin_audit_events (
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  )
  values (
    'content.purge_requested',
    'content_item',
    p_content_item_id,
    p_actor_user_id,
    jsonb_build_object('purge_job_id', v_job_id)
  );

  return v_job_id;
end;
$$;

-- Public projection deliberately omits source_external_id and actor identifiers.
create view public.content_catalog
with (security_invoker = true)
as
select
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
  created_at,
  updated_at
from public.content_items;

-- RLS is enabled on every table in the exposed public schema. Public policies
-- are read-only; browser writes are never accepted for comments, contact,
-- counters, likes, imports, or revisions.
alter table public.projects enable row level security;
alter table public.content_source_systems enable row level security;
alter table public.post_categories enable row level security;
alter table public.locations enable row level security;
alter table public.tags enable row level security;
alter table public.library_access_policies enable row level security;
alter table public.contact_categories enable row level security;
alter table public.assets enable row level security;
alter table public.asset_variants enable row level security;
alter table public.content_items enable row level security;
alter table public.content_tags enable row level security;
alter table public.posts enable row level security;
alter table public.works enable row level security;
alter table public.work_links enable row level security;
alter table public.library_items enable row level security;
alter table public.library_files enable row level security;
alter table public.pages enable row level security;
alter table public.notices enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_like_counts enable row level security;
alter table public.site_unique_visitors enable row level security;
alter table public.project_unique_visitors enable row level security;
alter table public.visit_counters enable row level security;
alter table public.site_settings enable row level security;
alter table public.business_cards enable row level security;
alter table public.business_card_links enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.content_revisions enable row level security;
alter table public.content_revision_assets enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.purge_jobs enable row level security;
alter table private.rate_limit_buckets enable row level security;

create policy projects_public_select on public.projects
for select to anon, authenticated
using (is_active and deleted_at is null);
create policy projects_admin_select on public.projects
for select to authenticated
using ((select private.is_admin()));
create policy projects_admin_insert on public.projects
for insert to authenticated
with check ((select private.is_admin()));
create policy projects_admin_update on public.projects
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy content_source_systems_admin_select on public.content_source_systems
for select to authenticated
using ((select private.is_admin()));

create policy post_categories_public_select on public.post_categories
for select to anon, authenticated
using (is_active and deleted_at is null);
create policy post_categories_admin_select on public.post_categories
for select to authenticated
using ((select private.is_admin()));
create policy post_categories_admin_insert on public.post_categories
for insert to authenticated
with check ((select private.is_admin()));
create policy post_categories_admin_update on public.post_categories
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy locations_public_select on public.locations
for select to anon, authenticated
using (is_active and deleted_at is null);
create policy locations_admin_select on public.locations
for select to authenticated
using ((select private.is_admin()));
create policy locations_admin_insert on public.locations
for insert to authenticated
with check ((select private.is_admin()));
create policy locations_admin_update on public.locations
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy tags_public_select on public.tags
for select to anon, authenticated
using (is_active and deleted_at is null);
create policy tags_admin_select on public.tags
for select to authenticated
using ((select private.is_admin()));
create policy tags_admin_insert on public.tags
for insert to authenticated
with check ((select private.is_admin()));
create policy tags_admin_update on public.tags
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy library_access_policies_public_select on public.library_access_policies
for select to anon, authenticated
using (is_active);
create policy library_access_policies_admin_select on public.library_access_policies
for select to authenticated
using ((select private.is_admin()));

create policy contact_categories_public_select on public.contact_categories
for select to anon, authenticated
using (is_active and deleted_at is null);
create policy contact_categories_admin_select on public.contact_categories
for select to authenticated
using ((select private.is_admin()));
create policy contact_categories_admin_insert on public.contact_categories
for insert to authenticated
with check ((select private.is_admin()));
create policy contact_categories_admin_update on public.contact_categories
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy assets_public_select on public.assets
for select to anon, authenticated
using (visibility = 'public' and state = 'ready' and deleted_at is null);
create policy assets_admin_select on public.assets
for select to authenticated
using ((select private.is_admin()));
create policy assets_admin_insert on public.assets
for insert to authenticated
with check ((select private.is_admin()));
create policy assets_admin_update on public.assets
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy asset_variants_public_select on public.asset_variants
for select to anon, authenticated
using (
  bucket_id = 'public-media'
  and variant_role in ('display', 'thumbnail', 'card_png')
  and exists (
    select 1 from public.assets as asset
    where asset.id = asset_variants.asset_id
      and asset.visibility = 'public'
      and asset.state = 'ready'
      and asset.deleted_at is null
  )
);
create policy asset_variants_admin_select on public.asset_variants
for select to authenticated
using ((select private.is_admin()));
create policy asset_variants_admin_insert on public.asset_variants
for insert to authenticated
with check ((select private.is_admin()));
create policy asset_variants_admin_update on public.asset_variants
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy content_items_public_select on public.content_items
for select to anon, authenticated
using (status = 'published' and publish_at <= now() and deleted_at is null);
create policy content_items_admin_select on public.content_items
for select to authenticated
using ((select private.is_admin()));
create policy content_items_admin_insert on public.content_items
for insert to authenticated
with check ((select private.is_admin()));
create policy content_items_admin_update on public.content_items
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy content_tags_public_select on public.content_tags
for select to anon, authenticated
using (
  (select private.content_is_public(content_item_id))
  and exists (
    select 1 from public.tags as tag
    where tag.id = content_tags.tag_id and tag.is_active and tag.deleted_at is null
  )
);
create policy content_tags_admin_select on public.content_tags
for select to authenticated
using ((select private.is_admin()));
create policy content_tags_admin_insert on public.content_tags
for insert to authenticated
with check ((select private.is_admin()));
create policy content_tags_admin_delete on public.content_tags
for delete to authenticated
using ((select private.is_admin()));

create policy posts_public_select on public.posts
for select to anon, authenticated
using ((select private.content_is_public(content_item_id)));
create policy posts_admin_select on public.posts
for select to authenticated
using ((select private.is_admin()));
create policy posts_admin_insert on public.posts
for insert to authenticated
with check ((select private.is_admin()));
create policy posts_admin_update on public.posts
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy works_public_select on public.works
for select to anon, authenticated
using ((select private.content_is_public(content_item_id)));
create policy works_admin_select on public.works
for select to authenticated
using ((select private.is_admin()));
create policy works_admin_insert on public.works
for insert to authenticated
with check ((select private.is_admin()));
create policy works_admin_update on public.works
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy work_links_public_select on public.work_links
for select to anon, authenticated
using (
  is_public
  and deleted_at is null
  and (select private.content_is_public(work_id))
);
create policy work_links_admin_select on public.work_links
for select to authenticated
using ((select private.is_admin()));
create policy work_links_admin_insert on public.work_links
for insert to authenticated
with check ((select private.is_admin()));
create policy work_links_admin_update on public.work_links
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy library_items_public_select on public.library_items
for select to anon, authenticated
using ((select private.content_is_public(content_item_id)));
create policy library_items_admin_select on public.library_items
for select to authenticated
using ((select private.is_admin()));
create policy library_items_admin_insert on public.library_items
for insert to authenticated
with check ((select private.is_admin()));
create policy library_items_admin_update on public.library_items
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy library_files_public_select on public.library_files
for select to anon, authenticated
using (deleted_at is null and (select private.content_is_public(library_item_id)));
create policy library_files_admin_select on public.library_files
for select to authenticated
using ((select private.is_admin()));
create policy library_files_admin_insert on public.library_files
for insert to authenticated
with check ((select private.is_admin()));
create policy library_files_admin_update on public.library_files
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy pages_public_select on public.pages
for select to anon, authenticated
using ((select private.content_is_public(content_item_id)));
create policy pages_admin_select on public.pages
for select to authenticated
using ((select private.is_admin()));
create policy pages_admin_insert on public.pages
for insert to authenticated
with check ((select private.is_admin()));
create policy pages_admin_update on public.pages
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy notices_public_select on public.notices
for select to anon, authenticated
using (
  status = 'published'
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and deleted_at is null
);
create policy notices_admin_select on public.notices
for select to authenticated
using ((select private.is_admin()));
create policy notices_admin_insert on public.notices
for insert to authenticated
with check ((select private.is_admin()));
create policy notices_admin_update on public.notices
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy comments_public_select on public.comments
for select to anon, authenticated
using (
  status = 'visible'
  and deleted_at is null
  and (select private.content_is_public(post_id))
);
create policy comments_admin_select on public.comments
for select to authenticated
using ((select private.is_admin()));
create policy comments_admin_update on public.comments
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy post_like_counts_public_select on public.post_like_counts
for select to anon, authenticated
using ((select private.content_is_public(post_id)));
create policy post_like_counts_admin_select on public.post_like_counts
for select to authenticated
using ((select private.is_admin()));

create policy visit_counters_public_select on public.visit_counters
for select to anon, authenticated
using (
  scope_type = 'site'
  or exists (
    select 1 from public.projects as project
    where project.id = visit_counters.project_id
      and project.is_active
      and project.deleted_at is null
  )
);
create policy visit_counters_admin_select on public.visit_counters
for select to authenticated
using ((select private.is_admin()));

create policy site_settings_public_select on public.site_settings
for select to anon, authenticated
using (is_public);
create policy site_settings_admin_select on public.site_settings
for select to authenticated
using ((select private.is_admin()));
create policy site_settings_admin_insert on public.site_settings
for insert to authenticated
with check ((select private.is_admin()));
create policy site_settings_admin_update on public.site_settings
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_cards_public_select on public.business_cards
for select to anon, authenticated
using (is_published and deleted_at is null);
create policy business_cards_admin_select on public.business_cards
for select to authenticated
using ((select private.is_admin()));
create policy business_cards_admin_insert on public.business_cards
for insert to authenticated
with check ((select private.is_admin()));
create policy business_cards_admin_update on public.business_cards
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_card_links_public_select on public.business_card_links
for select to anon, authenticated
using (
  is_public
  and deleted_at is null
  and exists (
    select 1 from public.business_cards as card
    where card.id = business_card_links.business_card_id
      and card.is_published
      and card.deleted_at is null
  )
);
create policy business_card_links_admin_select on public.business_card_links
for select to authenticated
using ((select private.is_admin()));
create policy business_card_links_admin_insert on public.business_card_links
for insert to authenticated
with check ((select private.is_admin()));
create policy business_card_links_admin_update on public.business_card_links
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy contact_inquiries_admin_select on public.contact_inquiries
for select to authenticated
using ((select private.is_admin()));
create policy contact_inquiries_admin_update on public.contact_inquiries
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy content_revisions_admin_select on public.content_revisions
for select to authenticated
using ((select private.is_admin()));
create policy content_revision_assets_admin_select on public.content_revision_assets
for select to authenticated
using ((select private.is_admin()));
create policy admin_audit_events_admin_select on public.admin_audit_events
for select to authenticated
using ((select private.is_admin()));
create policy purge_jobs_admin_select on public.purge_jobs
for select to authenticated
using ((select private.is_admin()));

-- Explicit Data API privileges. RLS filters rows; grants decide whether an
-- operation exists at all. content_items uses column grants so ingestion
-- provenance is never exposed to a browser role.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to anon, authenticated, service_role;

grant select on table
  public.projects,
  public.post_categories,
  public.locations,
  public.tags,
  public.library_access_policies,
  public.contact_categories,
  public.asset_variants,
  public.content_tags,
  public.posts,
  public.works,
  public.work_links,
  public.library_items,
  public.library_files,
  public.pages,
  public.notices,
  public.comments,
  public.post_like_counts,
  public.visit_counters,
  public.site_settings,
  public.business_cards,
  public.business_card_links,
  public.content_catalog
to anon, authenticated;

grant select (
  id,
  kind,
  state,
  visibility,
  mime_type,
  width,
  height,
  alt_text
) on public.assets to anon, authenticated;

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
  created_at,
  updated_at
) on public.content_items to anon, authenticated;

grant select on table
  public.content_source_systems,
  public.contact_inquiries,
  public.content_revisions,
  public.content_revision_assets,
  public.admin_audit_events,
  public.purge_jobs
to authenticated;

grant insert, update on table
  public.projects,
  public.post_categories,
  public.locations,
  public.tags,
  public.contact_categories,
  public.assets,
  public.asset_variants,
  public.posts,
  public.works,
  public.work_links,
  public.library_items,
  public.library_files,
  public.pages,
  public.notices,
  public.site_settings,
  public.business_cards,
  public.business_card_links
to authenticated;

grant update (
  status,
  moderated_at,
  moderated_by,
  deleted_at,
  deleted_by
) on public.comments to authenticated;
grant update (
  status,
  admin_note,
  handled_at,
  handled_by,
  deleted_at,
  deleted_by
) on public.contact_inquiries to authenticated;
grant insert, delete on table public.content_tags to authenticated;

grant insert (
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
  feed_event_type
) on public.content_items to authenticated;

grant update (
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
  updated_by,
  deleted_at,
  deleted_by
) on public.content_items to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all sequences in schema public to service_role;

grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.content_is_public(uuid) to anon, authenticated, service_role;
grant execute on function private.consume_rate_limit(text, bytea, integer, integer) to service_role;
grant execute on function private.register_post_like(uuid, bytea) to service_role;
grant execute on function private.register_site_visit(bytea) to service_role;
grant execute on function private.register_project_visit(uuid, bytea) to service_role;
grant execute on function private.library_file_is_anonymously_downloadable(uuid) to service_role;
grant execute on function private.capture_content_revision(
  uuid,
  public.revision_event_type,
  text,
  public.revision_actor_type,
  uuid
) to service_role;
grant execute on function private.restore_content_revision(uuid, uuid) to service_role;
grant execute on function private.request_content_purge(uuid, uuid) to service_role;

-- Storage is split by responsibility. Source masters and delivery files stay
-- private; only processed media is public. File bytes are uploaded through
-- signed URLs/server flows and still undergo application-level magic-byte,
-- decoded-size, and dimensions validation.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'private-originals',
    'private-originals',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'public-media',
    'public-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'private-downloads',
    'private-downloads',
    false,
    104857600,
    array['application/pdf', 'application/zip', 'application/x-zip-compressed']
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke insert, update, delete on table storage.objects from anon;
grant select, insert, update, delete on table storage.objects to authenticated;

create policy storage_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id in ('private-originals', 'public-media', 'private-downloads')
  and (select private.is_admin())
);

create policy storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('private-originals', 'public-media', 'private-downloads')
  and name !~ '(^/|(^|/)\.\.(/|$))'
  and (select private.is_admin())
);

create policy storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id in ('private-originals', 'public-media', 'private-downloads')
  and (select private.is_admin())
)
with check (
  bucket_id in ('private-originals', 'public-media', 'private-downloads')
  and name !~ '(^/|(^|/)\.\.(/|$))'
  and (select private.is_admin())
);

create policy storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('private-originals', 'public-media', 'private-downloads')
  and (select private.is_admin())
);

-- Narrow Data API facades. The private schema stays unexposed; Vercel calls
-- these functions with a server-only service role client. Browser roles have
-- no EXECUTE privilege.
create function public.service_consume_rate_limit(
  p_action_key text,
  p_subject_key bytea,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.consume_rate_limit(
    p_action_key,
    p_subject_key,
    p_limit,
    p_window_seconds
  );
$$;

create function public.service_register_post_like(
  p_post_id uuid,
  p_visitor_key bytea
)
returns table (accepted boolean, total bigint)
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select * from private.register_post_like(p_post_id, p_visitor_key);
$$;

create function public.service_register_site_visit(p_visitor_key bytea)
returns table (accepted boolean, total bigint)
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select * from private.register_site_visit(p_visitor_key);
$$;

create function public.service_register_project_visit(
  p_project_id uuid,
  p_visitor_key bytea
)
returns table (accepted boolean, total bigint)
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select * from private.register_project_visit(p_project_id, p_visitor_key);
$$;

create function public.service_library_file_is_anonymously_downloadable(
  p_library_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.library_file_is_anonymously_downloadable(p_library_file_id);
$$;

create function public.service_capture_content_revision(
  p_content_item_id uuid,
  p_event_type public.revision_event_type,
  p_change_reason text default null,
  p_actor_type public.revision_actor_type default 'admin',
  p_actor_user_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.capture_content_revision(
    p_content_item_id,
    p_event_type,
    p_change_reason,
    p_actor_type,
    p_actor_user_id
  );
$$;

create function public.service_restore_content_revision(
  p_revision_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.restore_content_revision(p_revision_id, p_actor_user_id);
$$;

create function public.service_request_content_purge(
  p_content_item_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select private.request_content_purge(p_content_item_id, p_actor_user_id);
$$;

revoke all on function public.service_consume_rate_limit(text, bytea, integer, integer)
  from public, anon, authenticated;
revoke all on function public.service_register_post_like(uuid, bytea)
  from public, anon, authenticated;
revoke all on function public.service_register_site_visit(bytea)
  from public, anon, authenticated;
revoke all on function public.service_register_project_visit(uuid, bytea)
  from public, anon, authenticated;
revoke all on function public.service_library_file_is_anonymously_downloadable(uuid)
  from public, anon, authenticated;
revoke all on function public.service_capture_content_revision(
  uuid,
  public.revision_event_type,
  text,
  public.revision_actor_type,
  uuid
) from public, anon, authenticated;
revoke all on function public.service_restore_content_revision(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.service_request_content_purge(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.service_consume_rate_limit(text, bytea, integer, integer)
  to service_role;
grant execute on function public.service_register_post_like(uuid, bytea)
  to service_role;
grant execute on function public.service_register_site_visit(bytea)
  to service_role;
grant execute on function public.service_register_project_visit(uuid, bytea)
  to service_role;
grant execute on function public.service_library_file_is_anonymously_downloadable(uuid)
  to service_role;
grant execute on function public.service_capture_content_revision(
  uuid,
  public.revision_event_type,
  text,
  public.revision_actor_type,
  uuid
) to service_role;
grant execute on function public.service_restore_content_revision(uuid, uuid)
  to service_role;
grant execute on function public.service_request_content_purge(uuid, uuid)
  to service_role;
