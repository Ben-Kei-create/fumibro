-- Follow-up from Supabase Performance Advisor. Public reads use the dedicated
-- anonymous client; authenticated Admin reads use only the AAL2 policy.

create index downloadable_images_created_by_idx
  on public.downloadable_images (created_by);
create index downloadable_images_source_system_idx
  on public.downloadable_images (source_system);

drop policy downloadable_images_public_select
  on public.downloadable_images;
create policy downloadable_images_public_select
on public.downloadable_images
for select to anon
using (
  status = 'published'
  and published_at <= now()
  and distribution_clearance = 'cleared'
  and deleted_at is null
);

drop policy downloadable_image_tags_public_select
  on public.downloadable_image_tags;
create policy downloadable_image_tags_public_select
on public.downloadable_image_tags
for select to anon
using (
  exists (
    select 1
    from public.downloadable_images as image
    where image.id = downloadable_image_tags.downloadable_image_id
      and image.status = 'published'
      and image.published_at <= now()
      and image.distribution_clearance = 'cleared'
      and image.deleted_at is null
  )
);
