-- Eenmalige, niet-destructieve import voor het legacy-tabblad Spelstarts.
-- Laad eerst de CSV in private.legacy_game_starts_staging via psql/COPY of
-- de Supabase-importtool. De echte export staat bewust niet in deze repository.

-- Legacy-spelers krijgen een deterministische UUID. Bij hun eerste anonieme
-- registratie zet register_player deze UUID met ON UPDATE CASCADE over naar
-- de echte auth.uid(), inclusief alle gekoppelde starts en eventuele scores.
alter table private.players drop constraint if exists players_user_id_fkey;

create table if not exists private.legacy_game_starts_staging (
  import_row_id bigint generated always as identity primary key,
  tijdstip text not null,
  naam text not null,
  spel_id text not null,
  spel text,
  status text,
  bron text,
  apparaat text
);

alter table private.legacy_game_starts_staging enable row level security;
revoke all on private.legacy_game_starts_staging from public, anon, authenticated;
revoke all on sequence private.legacy_game_starts_staging_import_row_id_seq from public, anon, authenticated;

-- Voorbeeld voor een lokale psql-import (pas de bestandsnaam aan):
-- \copy private.legacy_game_starts_staging(tijdstip,naam,spel_id,spel,status,bron,apparaat)
--   from 'Spelstarts.csv' with (format csv, header true, encoding 'UTF8');

with normalized as (
  select
    btrim(regexp_replace(regexp_replace(naam, '[<>[:cntrl:]]', '', 'g'), '\\s+', ' ', 'g')) as player_name,
    btrim(spel_id) as game_id,
    nullif(btrim(status), '') as start_status,
    left(coalesce(bron, ''), 100) as source,
    left(coalesce(apparaat, ''), 250) as user_agent,
    tijdstip::timestamptz as started_at
  from private.legacy_game_starts_staging
  where tijdstip ~ '^\\d{4}-\\d{2}-\\d{2}T'
), valid_rows as (
  select n.*
  from normalized n
  join private.games g on g.id = n.game_id
  where char_length(n.player_name) between 1 and 40
), grouped_players as (
  select
    player_name,
    lower(player_name) as normalized_name,
    min(started_at) as created_at,
    max(started_at) as last_seen_at
  from valid_rows
  group by player_name
)
insert into private.players (user_id, name, normalized_name, created_at, last_seen_at)
select
  (
    substr(md5('vriendenweekend-legacy:' || normalized_name), 1, 8) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 9, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 13, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 17, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 21, 12)
  )::uuid,
  player_name,
  normalized_name,
  created_at,
  last_seen_at
from grouped_players
on conflict (normalized_name) do update
set name = excluded.name,
    last_seen_at = greatest(private.players.last_seen_at, excluded.last_seen_at);

-- Herstel ook starts die met een eerdere versie van deze migratie zonder
-- gebruikerskoppeling zijn geïmporteerd.
update private.game_starts legacy_start
set user_id = player.user_id
from private.players player
where legacy_start.user_id is null
  and player.normalized_name = lower(legacy_start.player_name);

with normalized as (
  select
    btrim(regexp_replace(regexp_replace(naam, '[<>[:cntrl:]]', '', 'g'), '\\s+', ' ', 'g')) as player_name,
    btrim(spel_id) as game_id,
    nullif(btrim(status), '') as start_status,
    left(coalesce(bron, ''), 100) as source,
    left(coalesce(apparaat, ''), 250) as user_agent,
    tijdstip::timestamptz as started_at
  from private.legacy_game_starts_staging
  where tijdstip ~ '^\\d{4}-\\d{2}-\\d{2}T'
), valid_rows as (
  select n.*, p.user_id
  from normalized n
  join private.games g on g.id = n.game_id
  join private.players p on p.normalized_name = lower(n.player_name)
  where char_length(n.player_name) between 1 and 40
)
insert into private.game_starts (user_id, player_name, game_id, status, source, user_agent, started_at)
select
  v.user_id,
  v.player_name,
  v.game_id,
  coalesce(v.start_status, 'gestart'),
  v.source,
  v.user_agent,
  v.started_at
from valid_rows v
where not exists (
  select 1
  from private.game_starts existing
  where existing.user_id = v.user_id
    and existing.player_name = v.player_name
    and existing.game_id = v.game_id
    and existing.status = coalesce(v.start_status, 'gestart')
    and existing.source = v.source
    and existing.user_agent = v.user_agent
    and existing.started_at = v.started_at
);

-- De aangeleverde export bevat 48 rijen; na het overslaan van twee testregels
-- verwacht je 46 geïmporteerde starts voor mozaiek.
select game_id, count(*) as imported_starts
from private.game_starts
where user_id in (
  select user_id
  from private.players
  where user_id::text = (
    substr(md5('vriendenweekend-legacy:' || normalized_name), 1, 8) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 9, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 13, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 17, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 21, 12)
  )
)
group by game_id
order by game_id;
