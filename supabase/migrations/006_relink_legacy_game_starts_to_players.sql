-- Herstelt een import die met een eerdere versie van 005 al starts zonder
-- spelerkoppeling heeft weggeschreven. Vereist de stagingtabel uit 005.
alter table private.players drop constraint if exists players_user_id_fkey;

with normalized as (
  select
    btrim(regexp_replace(regexp_replace(naam, '[<>[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')) as player_name,
    tijdstip::timestamptz as started_at
  from private.legacy_game_starts_staging
  where tijdstip ~ '^\d{4}-\d{2}-\d{2}T'
), grouped_players as (
  select player_name, lower(player_name) as normalized_name,
    min(started_at) as created_at, max(started_at) as last_seen_at
  from normalized
  where char_length(player_name) between 1 and 40
  group by player_name
)
insert into private.players (user_id, name, normalized_name, created_at, last_seen_at)
select (
    substr(md5('vriendenweekend-legacy:' || normalized_name), 1, 8) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 9, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 13, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 17, 4) || '-' ||
    substr(md5('vriendenweekend-legacy:' || normalized_name), 21, 12)
  )::uuid, player_name, normalized_name, created_at, last_seen_at
from grouped_players
on conflict (normalized_name) do update
set name = excluded.name,
    last_seen_at = greatest(private.players.last_seen_at, excluded.last_seen_at);

update private.game_starts legacy_start
set user_id = player.user_id
from private.players player
where legacy_start.user_id is null
  and player.normalized_name = lower(legacy_start.player_name);
