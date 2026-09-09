alter function public.community_touch_updated_at() set search_path = public;
alter function public.is_community_admin(uuid) security invoker;

revoke all on function public.is_community_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_community_admin(uuid) to authenticated;
grant select(user_id) on public.admin_users to authenticated;

create policy community_admin_self_check
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create index community_resources_created_by_idx on public.community_resources(created_by);
create index community_resource_versions_created_by_idx on public.community_resource_versions(created_by);
create index community_admin_audit_actor_idx on public.community_admin_audit(actor_id);
create index community_admin_audit_resource_idx on public.community_admin_audit(resource_id);
create index community_admin_ip_events_actor_idx on private.community_admin_ip_events(actor_id);
create index community_admin_ip_events_resource_idx
  on private.community_admin_ip_events(resource_id, created_at desc);
