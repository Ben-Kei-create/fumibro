begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(14);

insert into public.content_items (
  id, kind, slug, title, status, publish_at, first_published_at, feed_at, feed_event_type
)
values
  (
    '61000000-0000-4000-8000-000000000001', 'post', 'rls-public', null,
    'published', now() - interval '1 hour', now() - interval '1 hour',
    now() - interval '1 hour', 'new'
  ),
  (
    '61000000-0000-4000-8000-000000000002', 'post', 'rls-future', null,
    'published', now() + interval '1 day', now() + interval '1 day',
    now() + interval '1 day', 'new'
  ),
  (
    '61000000-0000-4000-8000-000000000003', 'post', 'rls-draft', null,
    'draft', null, null, null, null
  );

insert into public.posts (content_item_id, body_markdown)
values
  ('61000000-0000-4000-8000-000000000001', 'public body'),
  ('61000000-0000-4000-8000-000000000002', 'future body'),
  ('61000000-0000-4000-8000-000000000003', 'draft body');

insert into public.comments (id, post_id, display_name, body, status)
values
  (
    '62000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'Visible',
    'visible comment',
    'visible'
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'Pending',
    'pending comment',
    'pending'
  );

set local role anon;

select results_eq(
  $$
    select id
    from public.content_items
    where id in (
      '61000000-0000-4000-8000-000000000001'::uuid,
      '61000000-0000-4000-8000-000000000002'::uuid,
      '61000000-0000-4000-8000-000000000003'::uuid
    )
    order by id
  $$,
  array['61000000-0000-4000-8000-000000000001'::uuid],
  'anon sees only currently published content'
);
select is(
  (select count(*)::bigint from public.posts
   where content_item_id::text like '61000000-%'),
  1::bigint,
  'child-table RLS follows the public parent'
);
select results_eq(
  $$
    select body from public.comments
    where post_id = '61000000-0000-4000-8000-000000000001'
    order by body
  $$,
  array['visible comment'::text],
  'anon sees only visible comments'
);
select throws_ok(
  $$
    insert into public.comments (post_id, display_name, body)
    values ('61000000-0000-4000-8000-000000000001', 'Browser', 'blocked')
  $$,
  '42501',
  null,
  'anon cannot insert comments directly'
);
select throws_ok(
  $$
    insert into public.contact_inquiries (category_id, name, email, message)
    values ('30000000-0000-4000-8000-000000000003', 'Browser', 'b@example.com', 'blocked')
  $$,
  '42501',
  null,
  'anon cannot insert contact inquiries directly'
);
select throws_ok(
  $$
    insert into public.post_likes (post_id, visitor_key)
    values ('61000000-0000-4000-8000-000000000001', decode(repeat('aa', 32), 'hex'))
  $$,
  '42501',
  null,
  'anon cannot insert likes directly'
);
select throws_ok(
  $$select * from public.content_revisions limit 1$$,
  '42501',
  null,
  'anon cannot read revisions'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000001","aal":"aal1","app_metadata":{"role":"admin"}}';

select is(private.is_admin(), false, 'admin claim without AAL2 is rejected');
select throws_ok(
  $$
    insert into public.post_categories (label, slug)
    values ('AAL1 blocked', 'aal1-blocked')
  $$,
  '42501',
  null,
  'AAL1 session cannot use Admin writes'
);

set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000001","aal":"aal2","app_metadata":{"role":"admin"}}';

select is(private.is_admin(), true, 'admin app_metadata plus AAL2 is accepted');
select lives_ok(
  $$
    insert into public.post_categories (label, slug)
    values ('AAL2 allowed', 'aal2-allowed')
  $$,
  'AAL2 Admin can create managed categories'
);
select lives_ok(
  $$
    update public.comments
    set status = 'hidden', moderated_at = now()
    where id = '62000000-0000-4000-8000-000000000001'
  $$,
  'AAL2 Admin can moderate a comment'
);
select throws_ok(
  $$
    update public.comments
    set body = 'rewritten by moderator'
    where id = '62000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'Admin cannot rewrite visitor comment text'
);
select throws_ok(
  $$delete from public.content_items where id = '61000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'Admin browser role has no direct hard-delete grant'
);

select * from finish();
rollback;
