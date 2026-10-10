-- CE Fun Club Links — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Everything is prefixed with ce_ so it can share a project with another app without clashing.
-- Then set your edit code (see the bottom of this file).
--
-- How editing works: there are no accounts. Anyone can read the page; changes go through
-- ce_save_page(), which only saves when it's given the right edit code. The code is stored
-- hashed, can't be read through the API, and 10 wrong guesses lock editing for 15 minutes.

create extension if not exists pgcrypto with schema extensions;

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

-- Edit code per page (bcrypt hash), plus a counter for wrong guesses.
create table if not exists public.ce_edit_codes (
  page_id         text primary key,
  code_hash       text        not null,
  failed_attempts integer     not null default 0,
  window_start    timestamptz not null default now()
);

-- Every save bumps the version, so two devices can't silently overwrite each other.
create or replace function public.ce_link_pages_touch()
returns trigger language plpgsql as $$
begin
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ce_link_pages_touch on public.ce_link_pages;
create trigger ce_link_pages_touch before update on public.ce_link_pages
  for each row execute function public.ce_link_pages_touch();

-- ── Row level security: the API can only read ───────────────────────────
alter table public.ce_link_pages enable row level security;
alter table public.ce_edit_codes enable row level security;
revoke all on public.ce_edit_codes from anon, authenticated;

drop policy if exists "Anyone can read pages" on public.ce_link_pages;
create policy "Anyone can read pages" on public.ce_link_pages
  for select using (true);

-- ── Edit code checks ────────────────────────────────────────────────────
-- Returns 'ok', 'bad_code', 'locked' (10 wrong tries in 15 minutes) or 'no_code' (none set yet).
create or replace function public.ce_verify_code(p_page text, p_code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c public.ce_edit_codes;
begin
  select * into c from public.ce_edit_codes where page_id = p_page for update;
  if not found then return 'no_code'; end if;
  if c.window_start < now() - interval '15 minutes' then
    c.failed_attempts := 0;
    c.window_start := now();
  end if;
  if c.failed_attempts >= 10 then return 'locked'; end if;
  if c.code_hash = crypt(coalesce(p_code, ''), c.code_hash) then
    update public.ce_edit_codes set failed_attempts = 0, window_start = now() where page_id = p_page;
    return 'ok';
  end if;
  update public.ce_edit_codes
    set failed_attempts = c.failed_attempts + 1, window_start = c.window_start
    where page_id = p_page;
  return 'bad_code';
end $$;
revoke execute on function public.ce_verify_code(text, text) from public, anon, authenticated;

create or replace function public.ce_check_code(p_page text, p_code text)
returns text language sql security definer set search_path = public as $$
  select public.ce_verify_code(p_page, p_code);
$$;
grant execute on function public.ce_check_code(text, text) to anon, authenticated;

-- Saves the page if the code is right and nobody else saved since p_version.
-- Returns {"status":"ok","row":{…}} or {"status":"bad_code"|"locked"|"no_code"|"conflict"|"invalid"|"too_large"}.
create or replace function public.ce_save_page(
  p_page text, p_code text, p_version integer, p_name text, p_logo text, p_links jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text; r public.ce_link_pages;
begin
  s := public.ce_verify_code(p_page, p_code);
  if s <> 'ok' then return jsonb_build_object('status', s); end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;
  if octet_length(p_links::text) + octet_length(coalesce(p_logo, '')) > 4000000 then
    return jsonb_build_object('status', 'too_large');
  end if;
  if p_version is null then
    insert into public.ce_link_pages (id, name, logo, links)
    values (p_page, coalesce(nullif(trim(p_name), ''), 'CE Fun Club Store'), coalesce(p_logo, ''), p_links)
    on conflict (id) do nothing
    returning * into r;
  else
    update public.ce_link_pages
      set name = coalesce(nullif(trim(p_name), ''), 'CE Fun Club Store'), logo = coalesce(p_logo, ''), links = p_links
      where id = p_page and version = p_version
      returning * into r;
  end if;
  if r.id is null then return jsonb_build_object('status', 'conflict'); end if;
  return jsonb_build_object('status', 'ok', 'row', to_jsonb(r));
end $$;
revoke execute on function public.ce_save_page(text, text, integer, text, text, jsonb) from public;
grant execute on function public.ce_save_page(text, text, integer, text, text, jsonb) to anon, authenticated;

-- ── Realtime: tell every open device when the page changes ──────────────
do $$ begin
  alter publication supabase_realtime add table public.ce_link_pages;
exception when duplicate_object then null; end $$;

-- ── Clean up the earlier email sign-in version, if it was installed ─────
drop policy if exists "Editors can insert pages" on public.ce_link_pages;
drop policy if exists "Editors can update pages" on public.ce_link_pages;
drop policy if exists "Editors can upload CE link images" on storage.objects;
drop policy if exists "Editors can change CE link images" on storage.objects;
drop policy if exists "Editors can delete CE link images" on storage.objects;
drop function if exists public.ce_is_editor();
drop table if exists public.ce_editors;

-- ── Starting content (same as the original page) ────────────────────────
insert into public.ce_link_pages (id, name, links)
values ('main', 'CE Fun Club Store',
  '[{"id":"l1","title":"Order online","url":"https://bilihan.shop","img":"","admin":"https://bilihan.shop/admin.html"}]'::jsonb)
on conflict (id) do nothing;

-- ── Set (or change) your edit code: replace CHANGE-ME, then run these lines ──
-- Pick something longer than 4 digits, e.g. a short phrase like 'green-mango-42'.
-- insert into public.ce_edit_codes (page_id, code_hash)
-- values ('main', extensions.crypt('CESADMIN', extensions.gen_salt('bf')))
-- on conflict (page_id) do update set code_hash = excluded.code_hash, failed_attempts = 0;
