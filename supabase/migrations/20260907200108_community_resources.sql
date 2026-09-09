create extension if not exists pgcrypto;

create type public.community_qualification as enum ('a_level', 'igcse', 'o_level');
create type public.community_resource_type as enum (
  'notes', 'revision_guide', 'formula_sheet', 'topic_questions', 'other'
);
create type public.community_resource_status as enum (
  'draft', 'uploading', 'scanning', 'ready_for_review', 'published',
  'quarantined', 'rejected', 'unpublished', 'archived'
);
create type public.community_scan_status as enum ('pending', 'running', 'passed', 'failed');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.community_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 10 and 2000),
  qualification public.community_qualification not null,
  level text not null,
  subject_code text not null check (subject_code ~ '^[0-9A-Za-z-]{2,16}$'),
  subject_name text not null check (char_length(subject_name) between 2 and 120),
  resource_type public.community_resource_type not null,
  author_name text not null check (char_length(author_name) between 1 and 120),
  uploader_name text not null check (char_length(uploader_name) between 1 and 80),
  contributor_credit text check (contributor_credit is null or char_length(contributor_credit) <= 120),
  source_url text check (source_url is null or char_length(source_url) <= 1000),
  rights_confirmed boolean not null default false,
  status public.community_resource_status not null default 'draft',
  current_version integer not null default 0,
  page_count integer check (page_count is null or page_count > 0),
  size_bytes bigint not null default 0 check (size_bytes between 0 and 209715200),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  upvotes integer not null default 0 check (upvotes >= 0),
  downloads integer not null default 0 check (downloads >= 0),
  opens integer not null default 0 check (opens >= 0),
  popularity_score double precision not null default 0,
  scan_status public.community_scan_status,
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subject_name, '') || ' ' || coalesce(subject_code, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(author_name, '') || ' ' || coalesce(contributor_credit, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  constraint published_requires_scan check (
    status <> 'published' or (scan_status = 'passed' and current_version > 0 and rights_confirmed)
  )
);

create index community_resources_public_idx
  on public.community_resources(status, qualification, subject_code, published_at desc);
create index community_resources_popular_idx
  on public.community_resources(status, popularity_score desc, upvotes desc);
create index community_resources_search_idx
  on public.community_resources using gin(search_vector);

create table public.community_resource_versions (
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  version integer not null,
  quarantine_path text not null,
  published_path text,
  thumbnail_path text,
  original_filename text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null check (size_bytes between 5 and 209715200),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer check (page_count is null or page_count > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(resource_id, version),
  unique(sha256)
);

create table public.community_votes (
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  voter_hash text not null check (char_length(voter_hash) = 64),
  created_at timestamptz not null default now(),
  primary key(resource_id, voter_hash)
);

create table public.community_events (
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  voter_hash text not null check (char_length(voter_hash) = 64),
  event_type text not null check (event_type in ('open', 'download')),
  event_day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key(resource_id, voter_hash, event_type, event_day)
);

create table public.community_daily_stats (
  resource_id uuid not null references public.community_resources(id) on delete cascade,
  day date not null,
  opens integer not null default 0,
  downloads integer not null default 0,
  upvotes integer not null default 0,
  primary key(resource_id, day)
);

create table public.community_scan_jobs (
  id bigint generated always as identity primary key,
  resource_id uuid not null,
  version integer not null,
  status public.community_scan_status not null default 'pending',
  attempts integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(resource_id, version),
  foreign key(resource_id, version)
    references public.community_resource_versions(resource_id, version) on delete cascade
);

create table public.community_scan_reports (
  resource_id uuid not null,
  version integer not null,
  status public.community_scan_status not null,
  scanner_version text not null,
  findings jsonb not null default '{}'::jsonb,
  scanned_at timestamptz not null default now(),
  primary key(resource_id, version),
  foreign key(resource_id, version)
    references public.community_resource_versions(resource_id, version) on delete cascade
);

create table public.community_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  resource_id uuid references public.community_resources(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.community_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key(key_hash, action, window_start)
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.community_admin_ip_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  resource_id uuid references public.community_resources(id) on delete set null,
  action text not null,
  ip_ciphertext text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index community_resources_created_by_idx on public.community_resources(created_by);
create index community_resource_versions_created_by_idx on public.community_resource_versions(created_by);
create index community_admin_audit_actor_idx on public.community_admin_audit(actor_id);
create index community_admin_audit_resource_idx on public.community_admin_audit(resource_id);
create index community_admin_ip_events_actor_idx on private.community_admin_ip_events(actor_id);
create index community_admin_ip_events_resource_idx
  on private.community_admin_ip_events(resource_id, created_at desc);

create or replace function public.community_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger community_resources_touch
before update on public.community_resources
for each row execute function public.community_touch_updated_at();

create trigger community_scan_jobs_touch
before update on public.community_scan_jobs
for each row execute function public.community_touch_updated_at();

create or replace function public.community_vote_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_resources
      set upvotes = upvotes + 1,
          popularity_score = popularity_score + 4
      where id = new.resource_id;
    insert into public.community_daily_stats(resource_id, day, upvotes)
      values(new.resource_id, current_date, 1)
      on conflict(resource_id, day) do update
        set upvotes = public.community_daily_stats.upvotes + 1;
    return new;
  end if;
  update public.community_resources
    set upvotes = greatest(0, upvotes - 1),
        popularity_score = greatest(0, popularity_score - 4)
    where id = old.resource_id;
  return old;
end;
$$;

create trigger community_votes_counter
after insert or delete on public.community_votes
for each row execute function public.community_vote_counter();

create or replace function public.community_event_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_type = 'open' then
    update public.community_resources
      set opens = opens + 1, popularity_score = popularity_score + 1
      where id = new.resource_id;
    insert into public.community_daily_stats(resource_id, day, opens)
      values(new.resource_id, new.event_day, 1)
      on conflict(resource_id, day) do update
        set opens = public.community_daily_stats.opens + 1;
  else
    update public.community_resources
      set downloads = downloads + 1, popularity_score = popularity_score + 2
      where id = new.resource_id;
    insert into public.community_daily_stats(resource_id, day, downloads)
      values(new.resource_id, new.event_day, 1)
      on conflict(resource_id, day) do update
        set downloads = public.community_daily_stats.downloads + 1;
  end if;
  return new;
end;
$$;

create trigger community_events_counter
after insert on public.community_events
for each row execute function public.community_event_counter();

create or replace function public.is_community_admin(candidate uuid default auth.uid())
returns boolean
language sql stable security invoker
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = candidate);
$$;

create or replace function public.community_consume_rate_limit(
  p_key_hash text,
  p_action text,
  p_window timestamptz,
  p_limit integer
) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare next_hits integer;
begin
  insert into public.community_rate_limits(key_hash, action, window_start, hits)
  values(p_key_hash, p_action, p_window, 1)
  on conflict(key_hash, action, window_start)
  do update set hits = public.community_rate_limits.hits + 1
  returning hits into next_hits;
  return next_hits <= p_limit;
end;
$$;

create or replace function public.community_record_admin_ip(
  p_actor_id uuid,
  p_resource_id uuid,
  p_action text,
  p_ip_ciphertext text
) returns void
language sql security definer
set search_path = private, public
as $$
  insert into private.community_admin_ip_events(actor_id, resource_id, action, ip_ciphertext)
  values(p_actor_id, p_resource_id, p_action, p_ip_ciphertext);
$$;

create or replace function public.community_read_admin_ips(p_resource_id uuid)
returns table(action text, ip_ciphertext text, created_at timestamptz, expires_at timestamptz)
language sql security definer
set search_path = private, public
as $$
  select e.action, e.ip_ciphertext, e.created_at, e.expires_at
  from private.community_admin_ip_events e
  where e.resource_id = p_resource_id and e.expires_at > now()
  order by e.created_at desc;
$$;

create or replace function public.community_purge_expired_security_data()
returns bigint
language plpgsql security definer
set search_path = private
as $$
declare removed bigint;
begin
  delete from private.community_admin_ip_events where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

alter table public.admin_users enable row level security;
alter table public.community_resources enable row level security;
alter table public.community_resource_versions enable row level security;
alter table public.community_votes enable row level security;
alter table public.community_events enable row level security;
alter table public.community_daily_stats enable row level security;
alter table public.community_scan_jobs enable row level security;
alter table public.community_scan_reports enable row level security;
alter table public.community_admin_audit enable row level security;
alter table public.community_rate_limits enable row level security;

create policy community_admin_self_check
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;
grant select(user_id) on public.admin_users to authenticated;
revoke all on function public.is_community_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_community_admin(uuid) to authenticated;
revoke all on function public.community_touch_updated_at() from public, anon, authenticated;
revoke all on function public.community_vote_counter() from public, anon, authenticated;
revoke all on function public.community_event_counter() from public, anon, authenticated;
revoke all on function public.community_consume_rate_limit(text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.community_record_admin_ip(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.community_read_admin_ips(uuid) from public, anon, authenticated;
revoke all on function public.community_purge_expired_security_data() from public, anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('community-quarantine', 'community-quarantine', false, 209715200, array['application/pdf']),
  ('community-published', 'community-published', false, 209715200, array['application/pdf']),
  ('community-thumbnails', 'community-thumbnails', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy community_admin_quarantine_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-quarantine'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_community_admin(auth.uid())
  and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
);

create policy community_admin_quarantine_read
on storage.objects for select to authenticated
using (
  bucket_id = 'community-quarantine'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_community_admin(auth.uid())
  and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
);

-- Edge Functions and the scanner use the service role for all other access. Published files remain
-- private and are served only through short-lived signed URLs issued by community-public.

comment on table private.community_admin_ip_events is
  'Encrypted administrator upload/security IPs. Purge rows at expires_at; never expose this schema.';
