alter policy community_admin_self_check
on public.admin_users
using (user_id = (select auth.uid()));
