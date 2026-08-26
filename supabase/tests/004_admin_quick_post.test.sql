begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(10);

select has_function(
  'public',
  'admin_create_quick_post',
  array['text', 'text', 'text', 'uuid', 'uuid', 'uuid[]', 'boolean'],
  'atomic Quick post command exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_quick_post(text,text,text,uuid,uuid,uuid[],boolean)',
    'execute'
  ),
  'anonymous browsers cannot execute the Quick post command'
);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.tags (id, label, slug)
values ('90000000-0000-4000-8000-000000000004', 'Quick検証', 'quick-verification');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000004","aal":"aal1","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$
    select public.admin_create_quick_post(
      'quick-aal1-denied',
      'AAL1では保存できない本文',
      null,
      null,
      null,
      '{}'::uuid[],
      true
    )
  $$,
  '42501',
  null,
  'AAL1 Admin cannot use Quick posting'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000004","aal":"aal2","app_metadata":{"role":"admin"}}';

select throws_ok(
  $$
    select public.admin_create_quick_post(
      'quick-too-many-tags',
      'タグ上限を超える本文',
      null,
      null,
      null,
      array_fill(
        '90000000-0000-4000-8000-000000000004'::uuid,
        array[21]
      ),
      true
    )
  $$,
  '22023',
  null,
  'the database enforces the Quick post tag limit'
);

select lives_ok(
  $$
    select public.admin_create_quick_post(
      'quick-aal2-created',
      'AAL2で保存した本文',
      'Quick投稿テスト',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      array['90000000-0000-4000-8000-000000000004'::uuid],
      true
    )
  $$,
  'AAL2 Admin can create a Quick post'
);

select ok(
  exists (
    select 1
    from public.content_items as content
    join public.posts as post on post.content_item_id = content.id
    where content.slug = 'quick-aal2-created'
      and content.status = 'published'
      and content.project_id = '10000000-0000-4000-8000-000000000001'
      and post.post_category_id = '20000000-0000-4000-8000-000000000001'
      and post.body_markdown = 'AAL2で保存した本文'
  ),
  'Quick posting creates the canonical root and Blog detail atomically'
);

select ok(
  exists (
    select 1
    from public.content_tags as content_tag
    join public.content_items as content on content.id = content_tag.content_item_id
    where content.slug = 'quick-aal2-created'
      and content_tag.tag_id = '90000000-0000-4000-8000-000000000004'
  ),
  'Quick posting attaches selected tags'
);

select is(
  (
    select count(*)::bigint
    from public.content_revisions as revision
    join public.content_items as content on content.id = revision.content_item_id
    where content.slug = 'quick-aal2-created'
  ),
  1::bigint,
  'initial publication stores one content revision'
);

select ok(
  exists (
    select 1
    from public.admin_audit_events as event
    join public.content_items as content on content.id = event.entity_id
    where content.slug = 'quick-aal2-created'
      and event.action = 'content.quick_created'
  ),
  'Quick posting writes an Admin audit event'
);

set local role anon;

select lives_ok(
  $$
    select post.body_markdown
    from public.posts as post
    join public.content_items as content on content.id = post.content_item_id
    where content.slug = 'quick-aal2-created'
  $$,
  'public child reads can evaluate the canonical soft-delete predicate'
);

select * from finish();
rollback;
