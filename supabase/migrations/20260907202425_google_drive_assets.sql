-- Store Community Resources binaries in the owner's Google Drive. Supabase remains the metadata,
-- authentication, moderation, voting, and audit system of record.

alter table public.community_resource_versions
  rename column quarantine_path to drive_quarantine_file_id;

alter table public.community_resource_versions
  rename column published_path to drive_published_file_id;

alter table public.community_resource_versions
  rename column thumbnail_path to drive_thumbnail_file_id;

alter table public.community_resource_versions
  add constraint community_versions_quarantine_drive_id
    check (drive_quarantine_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add constraint community_versions_published_drive_id
    check (drive_published_file_id is null or drive_published_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add constraint community_versions_thumbnail_drive_id
    check (drive_thumbnail_file_id is null or drive_thumbnail_file_id ~ '^[A-Za-z0-9_-]{10,200}$');

comment on column public.community_resource_versions.drive_quarantine_file_id is
  'Private Google Drive file ID for the administrator upload awaiting scanning.';
comment on column public.community_resource_versions.drive_published_file_id is
  'Google Drive file ID for the sanitized PDF; published assets receive an anyone-reader permission.';
comment on column public.community_resource_versions.drive_thumbnail_file_id is
  'Google Drive file ID for the generated first-page preview.';
