create or replace function public.register_player(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_name       text;
  v_normalized text;
  v_existing   uuid;
  v_current    uuid;
begin
  if v_uid is null then
    raise exception 'Je sessie ontbreekt. Probeer opnieuw.';
  end if;

  v_name := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>[:cntrl:]]', '', 'g'), '\\s+', ' ', 'g'));
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Vul een naam van maximaal 40 tekens in.';
  end if;

  v_normalized := lower(v_name);

  select user_id
    into v_current
    from private.players
    where user_id = v_uid
    for update;

  select user_id
    into v_existing
    from private.players
    where normalized_name = v_normalized
    for update;

  if v_existing is not null and v_existing <> v_uid then
    if v_current is not null then
      update private.game_starts
      set user_id = v_uid,
          player_name = v_name
      where user_id = v_existing;

      insert into private.scores (user_id, player_name, game_id, score, seconds, attempts, detail, created_at)
      select v_uid, v_name, game_id, score, seconds, attempts, detail, created_at
      from private.scores
      where user_id = v_existing
      on conflict (user_id, game_id) do update
      set player_name = excluded.player_name,
          score = case
            when excluded.score > private.scores.score then excluded.score
            when excluded.score = private.scores.score and excluded.seconds < private.scores.seconds then excluded.score
            else private.scores.score
          end,
          seconds = case
            when excluded.score > private.scores.score then excluded.seconds
            when excluded.score = private.scores.score and excluded.seconds < private.scores.seconds then excluded.seconds
            else private.scores.seconds
          end,
          attempts = case
            when excluded.score > private.scores.score then excluded.attempts
            when excluded.score = private.scores.score and excluded.seconds < private.scores.seconds then excluded.attempts
            else private.scores.attempts
          end,
          detail = case
            when excluded.score > private.scores.score then excluded.detail
            when excluded.score = private.scores.score and excluded.seconds < private.scores.seconds then excluded.detail
            else private.scores.detail
          end,
          created_at = least(private.scores.created_at, excluded.created_at);

      delete from private.scores where user_id = v_existing;

      insert into private.active_players (user_id, game_id, started_at, last_seen_at)
      select v_uid, game_id, started_at, last_seen_at
      from private.active_players
      where user_id = v_existing
      on conflict (user_id) do update
      set game_id = excluded.game_id,
          started_at = case
            when excluded.last_seen_at >= private.active_players.last_seen_at then excluded.started_at
            else private.active_players.started_at
          end,
          last_seen_at = greatest(private.active_players.last_seen_at, excluded.last_seen_at);

      delete from private.active_players where user_id = v_existing;
      delete from private.players where user_id = v_existing;

      update private.players
      set name = v_name,
          normalized_name = v_normalized,
          last_seen_at = now()
      where user_id = v_uid;
    else
      update private.players
      set user_id = v_uid,
          name = v_name,
          last_seen_at = now()
      where user_id = v_existing;
    end if;
  elsif v_current is not null then
    update private.players
    set name = v_name,
        normalized_name = v_normalized,
        last_seen_at = now()
    where user_id = v_uid;
  else
    insert into private.players (user_id, name, normalized_name)
    values (v_uid, v_name, v_normalized);
  end if;

  update private.game_starts
  set player_name = v_name
  where user_id = v_uid;

  update private.scores
  set player_name = v_name
  where user_id = v_uid;

  return jsonb_build_object('playerName', v_name);
end $$;

revoke all on function public.register_player(text) from public;
grant execute on function public.register_player(text) to authenticated;
