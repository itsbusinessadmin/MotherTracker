-- CE Fun Club Links — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Everything is prefixed with ce_ so it can share a project with another app without clashing.
-- Then add your own email as an editor (see the bottom of this file).

-- ── Page data ────────────────────────────────────────────────────────────
create table if not exists public.ce_link_pages (
  id         text primary key default 'main',
  name       text        not null default 'CE Fun Club Store',
  logo       text        not null default '',
  links      jsonb       not null default '[]'::jsonb,
  version    integer     not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Who may edit. Anyone can view the page; only these emails can change it.
create table if not exists public.ce_editors (
  email text primary key
);

-- Every save bumps the version, so two devices can't silently overwrite each other.
create or replace function public.ce_link_pages_touch()
returns trigger language plpgsql as $$
begin
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists ce_link_pages_touch on public.ce_link_pages;
create trigger ce_link_pages_touch before update on public.ce_link_pages
  for each row execute function public.ce_link_pages_touch();

create or replace function public.ce_is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ce_editors
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.ce_is_editor() to anon, authenticated;

-- ── Row level security ──────────────────────────────────────────────────
alter table public.ce_link_pages enable row level security;
alter table public.ce_editors    enable row level security;

drop policy if exists "Anyone can read pages" on public.ce_link_pages;
create policy "Anyone can read pages" on public.ce_link_pages
  for select using (true);

drop policy if exists "Editors can insert pages" on public.ce_link_pages;
create policy "Editors can insert pages" on public.ce_link_pages
  for insert to authenticated with check (public.ce_is_editor());

drop policy if exists "Editors can update pages" on public.ce_link_pages;
create policy "Editors can update pages" on public.ce_link_pages
  for update to authenticated using (public.ce_is_editor()) with check (public.ce_is_editor());

-- (No policies on public.ce_editors: it is only managed from the SQL editor.)

-- ── Realtime: push saves to every open device ───────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.ce_link_pages;
exception when duplicate_object then null; end $$;

-- ── Image storage for logos and tile photos ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('ce-link-images', 'ce-link-images', true)
on conflict (id) do nothing;

drop policy if exists "Editors can upload CE link images" on storage.objects;
create policy "Editors can upload CE link images" on storage.objects
  for insert to authenticated with check (bucket_id = 'ce-link-images' and public.ce_is_editor());

drop policy if exists "Editors can change CE link images" on storage.objects;
create policy "Editors can change CE link images" on storage.objects
  for update to authenticated using (bucket_id = 'ce-link-images' and public.ce_is_editor());

drop policy if exists "Editors can delete CE link images" on storage.objects;
create policy "Editors can delete CE link images" on storage.objects
  for delete to authenticated using (bucket_id = 'ce-link-images' and public.ce_is_editor());

-- ── Starting content (same as the original page) ────────────────────────
insert into public.ce_link_pages (id, name, links)
values ('main', 'CE Fun Club Store',
  '[{"id":"l1","title":"Order online","url":"https://bilihan.shop","img":"","admin":"https://bilihan.shop/admin.html"}]'::jsonb)
on conflict (id) do nothing;

-- ── Add yourself as an editor (change the email, then run this line) ───
-- insert into public.ce_editors (email) values ('you@example.com') on conflict do nothing;
