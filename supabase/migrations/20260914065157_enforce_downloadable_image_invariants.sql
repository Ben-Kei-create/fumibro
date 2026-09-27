-- An asset represents one gallery image for its full lifetime, including Trash.
-- Reclassifying an uploaded draft as KDP must restart clearance review.

create unique index downloadable_images_asset_uidx
  on public.downloadable_images (asset_id);

create function private.enforce_kdp_downloadable_image_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.source_system = 'kdp'
    and (tg_op = 'INSERT' or old.source_system is distinct from 'kdp')
  then
    new.distribution_clearance := 'review_required';
  end if;
  return new;
end;
$$;

create trigger downloadable_images_enforce_kdp_review
before insert or update of source_system
on public.downloadable_images
for each row execute function private.enforce_kdp_downloadable_image_review();

revoke all on function private.enforce_kdp_downloadable_image_review()
  from public, anon, authenticated, service_role;
