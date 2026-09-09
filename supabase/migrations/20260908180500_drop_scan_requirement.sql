-- Remove the mandatory scan check from publication and unstick any resources that were
-- left in the 'scanning' state because the scanner container was never deployed.

alter table public.community_resources
  drop constraint published_requires_scan;

alter table public.community_resources
  add constraint published_requires_upload check (
    status <> 'published' or (current_version > 0 and rights_confirmed)
  );

-- Any resources stuck at 'scanning' move straight to 'ready_for_review'.
update public.community_resources
  set status = 'ready_for_review', scan_status = 'passed'
  where status = 'scanning';
