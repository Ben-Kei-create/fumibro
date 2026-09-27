-- admin_save_downloadable_image uses INSERT ... ON CONFLICT for optimistic
-- updates. Distinguish a real insert/reclassification from that update path so
-- an already-reviewed KDP image can be published explicitly.

create or replace function private.enforce_kdp_downloadable_image_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existing_source text;
begin
  if new.source_system <> 'kdp' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.source_system is distinct from 'kdp' then
      new.distribution_clearance := 'review_required';
    end if;
    return new;
  end if;

  select image.source_system
    into v_existing_source
    from public.downloadable_images as image
   where image.id = new.id;

  if not found or v_existing_source is distinct from 'kdp' then
    new.distribution_clearance := 'review_required';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_kdp_downloadable_image_review()
  from public, anon, authenticated, service_role;
