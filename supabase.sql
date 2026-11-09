-- Im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" drücken.

create table if not exists public.ausgaben (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  betrag     numeric(10, 2) not null check (betrag > 0),
  datum      date not null default now(),
  kategorie  text,
  notiz      text
);

create index if not exists ausgaben_datum_idx on public.ausgaben (datum desc);

-- Zugriff für die App (Publishable Key = Rolle "anon").
-- ACHTUNG: Der Key steht öffentlich in config.js. Mit diesen Regeln kann jeder,
-- der die URL deiner App kennt, deine Einträge lesen, ändern und löschen.
-- Für echten Schutz später Supabase Auth (Login) ergänzen.
alter table public.ausgaben enable row level security;

grant select, insert, update, delete on public.ausgaben to anon;

drop policy if exists "App darf lesen und schreiben" on public.ausgaben;
create policy "App darf lesen und schreiben"
  on public.ausgaben
  for all
  to anon
  using (true)
  with check (true);
