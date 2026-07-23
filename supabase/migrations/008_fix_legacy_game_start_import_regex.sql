-- Herstelmigratie voor de te sterk ge-escapete reguliere expressies in 007.
-- Voer hierna de import opnieuw uit met:
-- select private.import_legacy_game_starts_from_staging();

create or replace function private.import_legacy_game_starts_from_staging()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_imported integer := 0; v_staged integer := 0;
begin
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
      and player_name !~* '^bijv\.?\s+mark$'
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
    and player.normalized_name = lower(legacy_start.player_name)
    and player.normalized_name !~* '^bijv\.?\s+mark$';

  with normalized as (
    select
      btrim(regexp_replace(regexp_replace(naam, '[<>[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')) as player_name,
      btrim(spel_id) as game_id,
      nullif(btrim(status), '') as start_status,
      left(coalesce(bron, ''), 100) as source,
      left(coalesce(apparaat, ''), 250) as user_agent,
      tijdstip::timestamptz as started_at
    from private.legacy_game_starts_staging
    where tijdstip ~ '^\d{4}-\d{2}-\d{2}T'
  ), valid_rows as (
    select n.*, p.user_id
    from normalized n
    join private.games g on g.id = n.game_id
    join private.players p on p.normalized_name = lower(n.player_name)
    where char_length(n.player_name) between 1 and 40
      and n.player_name !~* '^bijv\.?\s+mark$'
  )
  insert into private.game_starts (user_id, player_name, game_id, status, source, user_agent, started_at)
  select v.user_id, v.player_name, v.game_id, coalesce(v.start_status, 'gestart'),
    v.source, v.user_agent, v.started_at
  from valid_rows v
  where not exists (
    select 1 from private.game_starts existing
    where existing.user_id = v.user_id
      and existing.player_name = v.player_name
      and existing.game_id = v.game_id
      and existing.status = coalesce(v.start_status, 'gestart')
      and existing.source = v.source
      and existing.user_agent = v.user_agent
      and existing.started_at = v.started_at
  );
  get diagnostics v_imported = row_count;

  select count(*) into v_staged
  from private.legacy_game_starts_staging
  where btrim(naam) !~* '^bijv\.?\s+mark$';

  return jsonb_build_object('stagedRows', v_staged, 'importedStarts', v_imported);
end $$;

revoke all on function private.import_legacy_game_starts_from_staging() from public;
