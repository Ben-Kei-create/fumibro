-- Follow-up found during the live bucket/RPC privilege audit.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'image/webp'
]::text[]
where id = 'private-downloads';

revoke all on function public.admin_save_downloadable_image(
  uuid, integer, text, text, text, text, uuid, text, text,
  public.image_license_type, public.image_distribution_clearance,
  public.content_status, boolean, boolean, timestamptz, uuid, uuid, uuid[]
) from service_role;
