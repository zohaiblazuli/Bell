alter table public.admin_users
  add column username text;

alter table public.admin_users
  add constraint admin_users_username_format
  check (username ~ '^[a-z0-9][a-z0-9_-]{2,63}$');

create unique index admin_users_username_unique
  on public.admin_users (lower(username));

alter table public.admin_users
  alter column username set not null;

comment on column public.admin_users.username is
  'Case-insensitive Bell administrator login name. The internal Auth email is never shown in Bell.';
