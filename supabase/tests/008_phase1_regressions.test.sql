begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(7);

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000008')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000008","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$
    select public.admin_save_work(
      null, null, 'm7-trash-work', 'Trash Work', 'excerpt', null, 'summary',
      'description', null, current_date, null, 'other', false, 0, false, 0,
      '{}', 'published', now(), 'regression fixture'
    )
  $$,
  'AAL2 creates a Work used by the shared Trash flow'
);
select lives_ok(
  $$
    select public.admin_set_content_trashed(
      content.id, content.lock_version, true
    )
    from public.content_items as content
    where content.slug = 'm7-trash-work'
  $$,
  'the canonical Trash command accepts a Work'
);
select ok(
  exists (
    select 1 from public.content_items
    where slug = 'm7-trash-work' and kind = 'work' and deleted_at is not null
  ),
  'the Work remains as a logically deleted canonical row'
);
do $$
begin
  perform set_config(
    'fumibro_test.trash_work_id',
    (select id::text from public.content_items where slug = 'm7-trash-work'),
    true
  );
end;
$$;

set local role anon;
select is(
  (select count(*)::bigint from public.content_items where slug = 'm7-trash-work'),
  0::bigint,
  'anonymous visitors cannot see trashed canonical content'
);
select is(
  (
    select count(*)::bigint from public.works
    where content_item_id =
      current_setting('fumibro_test.trash_work_id')::uuid
  ),
  0::bigint,
  'child-table RLS does not leak a trashed Work'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"70000000-0000-4000-8000-000000000008","aal":"aal2","app_metadata":{"role":"admin"}}';
select lives_ok(
  $$
    select public.admin_set_content_trashed(
      content.id, content.lock_version, false
    )
    from public.content_items as content
    where content.slug = 'm7-trash-work'
  $$,
  'the shared Trash flow restores a Work'
);
select throws_ok(
  $$
    select public.admin_set_content_trashed(
      content.id, content.lock_version, true
    )
    from public.content_items as content
    where content.id = '40000000-0000-4000-8000-000000000002'
  $$,
  '23514',
  null,
  'the Privacy system Page cannot be moved to Trash'
);

select * from finish();
rollback;
