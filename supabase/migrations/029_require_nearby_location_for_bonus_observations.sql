-- Bonus observation answers may only be submitted from the bonus vicinity.

create or replace function public.verify_bonus_observation(p_session_id uuid, p_stop_id text, p_question_id text, p_answer text, p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  stop_row city_game.game_stops%rowtype;
  question_row city_game.stop_observation_questions%rowtype;
  location_row city_game.team_current_location%rowtype;
  distance_m double precision;
begin
  select * into session_row from city_game.team_sessions session
  where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;

  select * into team_row from city_game.teams team where id = session_row.team_id for update;
  if not city_game.team_can_see_bonus(team_row.id, p_stop_id) then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;

  select * into stop_row from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version
    and stop.stop_id = p_stop_id and stop.is_bonus;
  if not found then raise exception using errcode = 'P0001', message = 'OBSERVATION_NOT_AVAILABLE'; end if;

  select * into location_row from city_game.team_current_location location
  where location.team_id = team_row.id
    and location.captured_at > now() - make_interval(secs => city_game.location_freshness_seconds());
  if not found or location_row.accuracy_m > stop_row.maximum_accuracy_m then
    raise exception using errcode = 'P0001', message = 'LOCATION_REQUIRED';
  end if;

  distance_m := city_game.distance_m(location_row.latitude, location_row.longitude, stop_row.latitude, stop_row.longitude);
  if distance_m > coalesce(stop_row.discovery_radius_m, stop_row.radius_m) then
    raise exception using errcode = 'P0001', message = 'LOCATION_TOO_FAR';
  end if;

  if exists (select 1 from city_game.team_stop_verifications where team_id = team_row.id and stop_id = p_stop_id) then
    return jsonb_build_object('ok', true, 'verified', true, 'state', city_game.team_state_json(team_row.id, session_row.id));
  end if;

  select * into question_row from city_game.stop_observation_questions question
  where question.id = p_question_id and question.stop_id = p_stop_id
    and question.game_slug = team_row.game_slug and question.game_version = team_row.game_version and question.enabled;
  if not found then raise exception using errcode = 'P0001', message = 'OBSERVATION_NOT_AVAILABLE'; end if;

  if not city_game.observation_answer_matches(question_row.answer_rule, p_answer) then
    insert into city_game.events (event_id, team_id, session_id, game_slug, stop_id, event_type)
    values (p_action_id, team_row.id, session_row.id, team_row.game_slug, p_stop_id, 'bonus_observation_rejected')
    on conflict (event_id) do nothing;
    return jsonb_build_object('ok', true, 'verified', false, 'state', city_game.team_state_json(team_row.id, session_row.id));
  end if;

  insert into city_game.team_stop_verifications (team_id, stop_id, method, verified_by_session_id, question_id, action_id)
  values (team_row.id, p_stop_id, 'observation', session_row.id, question_row.id, p_action_id)
  on conflict (team_id, stop_id) do nothing;
  update city_game.progress set state = 'arrived', unlock_method = 'observation', arrived_at = coalesce(arrived_at, now())
  where team_id = team_row.id and stop_id = p_stop_id and state = 'available';
  insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data)
  values (team_row.id, session_row.id, team_row.game_slug, p_stop_id, 'bonus_unlocked', jsonb_build_object('method', 'observation', 'questionId', question_row.id));
  return jsonb_build_object('ok', true, 'verified', true, 'state', city_game.team_state_json(team_row.id, session_row.id));
end;
$$;

grant execute on function public.verify_bonus_observation(uuid, text, text, text, uuid) to authenticated;
