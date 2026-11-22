-- Kino: tables live in the Supabase project "Perfumes" next to the perfume diary (free plan allows only 2 projects).
-- Every table here starts with watch_ so it never mixes with the diary. All tables are "own rows only".
-- Screenshots go to the private bucket `watch`, path <user_id>/<uuid>.webp (+ _t.webp thumb).
-- Posters are links to Wikimedia images (found through Wikidata), stored as poster_url.

create table if not exists watch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  original_title text,
  kind text not null default 'film' check (kind in ('film', 'series')),
  year smallint,
  genres text[] not null default '{}',
  status text not null default 'want' check (status in ('want', 'watching', 'watched')),
  favorite boolean not null default false,
  rewatch boolean not null default false,
  where_to_watch text,
  source text,
  url text,
  note text,
  poster_url text,
  photos text[] not null default '{}',
  rating smallint check (rating between 1 and 10),
  impression text,
  length text check (length in ('short', 'medium', 'long')),
  runtime smallint,
  moods text[] not null default '{}',
  wikidata text,
  wiki_url text,
  watched_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table watch_items enable row level security;
drop policy if exists "own watch items" on watch_items;
create policy "own watch items" on watch_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function watch_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists watch_touch on watch_items;
create trigger watch_touch before update on watch_items for each row execute function watch_touch();

insert into storage.buckets (id, name, public) values ('watch', 'watch', false) on conflict (id) do nothing;
drop policy if exists "watch own folder" on storage.objects;
create policy "watch own folder" on storage.objects for all to authenticated
  using (bucket_id = 'watch' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'watch' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2026-11-22: books live in the same table (kind 'book'), shown in their own "Books" section.
-- Book covers and details come from Open Library (free, no key).
alter table watch_items drop constraint if exists watch_items_kind_check;
alter table watch_items add constraint watch_items_kind_check check (kind in ('film', 'series', 'book'));
alter table watch_items add column if not exists author text;
alter table watch_items add column if not exists series text;
alter table watch_items add column if not exists series_no smallint;
alter table watch_items add column if not exists pages smallint;
alter table watch_items add column if not exists ol_key text;
