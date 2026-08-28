-- Functions created by later migration sessions must not rely on default ACLs.
-- They execute only through owner-run triggers or the explicitly granted public
-- service/admin wrapper functions.
revoke all on function private.assert_attachable_image_asset()
  from public, anon, authenticated, service_role;
revoke all on function private.assert_attachable_library_file_asset()
  from public, anon, authenticated, service_role;
revoke all on function private.ensure_project_visit_counter()
  from public, anon, authenticated, service_role;
revoke all on function private.prepare_content_purge(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.fail_content_purge(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_content_purge(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.finalize_processed_image(
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
) from public, anon, authenticated, service_role;
