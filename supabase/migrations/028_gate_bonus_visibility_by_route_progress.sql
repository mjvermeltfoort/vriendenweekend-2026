-- Reveal bonus locations only after their prerequisite main stop has been reached.

alter table city_game.game_stops
  add column if not exists visible_after_stop_id text;

update city_game.game_stops
set visible_after_stop_id = case stop_id
  when 'bonus:bolwerk-sint-jan' then 'drakenfontein'
  when 'bonus:halve-peer' then 'drakenfontein'
  when 'bonus:de-moriaan' then 'zoete-lieve-gerritje'
  when 'bonus:zwanenbroedershuis' then 'binnendieze'
  when 'bonus:citadel' then 'kruithuis'
  when 'bonus:verkadefabriek' then 'kruithuis'
end
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and is_bonus;

create or replace function city_game.team_can_see_bonus(p_team_id uuid, p_bonus_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from city_game.teams team
    join city_game.game_stops bonus
      on bonus.game_slug = team.game_slug
      and bonus.game_version = team.game_version
      and bonus.stop_id = p_bonus_id
      and bonus.is_bonus
    join city_game.progress prerequisite
      on prerequisite.team_id = team.id
      and prerequisite.stop_id = bonus.visible_after_stop_id
    where team.id = p_team_id
      and prerequisite.state in ('arrived', 'started', 'completed')
  );
$$;

create or replace function public.select_bonus_location(p_session_id uuid, p_bonus_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  stop_row city_game.game_stops%rowtype;
  location_row city_game.team_current_location%rowtype;
  distance_m double precision;
begin
  select * into session_row from city_game.team_sessions session
  where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;
  select * into team_row from city_game.teams team where id = session_row.team_id for update;
  select * into stop_row from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version
    and stop.stop_id = p_bonus_id and stop.is_bonus;
  if not found or not city_game.team_can_see_bonus(team_row.id, p_bonus_id) then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;

  update city_game.teams set selected_bonus_location_id = p_bonus_id, version = version + 1,
    updated_by_session_id = session_row.id where id = team_row.id;
  insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type)
  values (team_row.id, session_row.id, team_row.game_slug, p_bonus_id, 'bonus_selected');

  select * into location_row from city_game.team_current_location where team_id = team_row.id;
  if location_row.team_id is not null and location_row.accuracy_m <= stop_row.maximum_accuracy_m then
    distance_m := city_game.distance_m(location_row.latitude, location_row.longitude, stop_row.latitude, stop_row.longitude);
    if distance_m <= stop_row.radius_m then
      update city_game.progress set state = 'arrived', unlock_method = 'gps', arrived_at = coalesce(arrived_at, now())
      where team_id = team_row.id and stop_id = p_bonus_id and state = 'available';
      if found then
        insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data)
        values (team_row.id, session_row.id, team_row.game_slug, p_bonus_id, 'bonus_unlocked', jsonb_build_object('method', 'gps', 'distanceM', distance_m));
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'state', city_game.team_state_json(team_row.id, session_row.id));
end;
$$;

create or replace function public.verify_bonus_observation(p_session_id uuid, p_stop_id text, p_question_id text, p_answer text, p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  question_row city_game.stop_observation_questions%rowtype;
begin
  select * into session_row from city_game.team_sessions session where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;
  select * into team_row from city_game.teams team where id = session_row.team_id for update;
  if not city_game.team_can_see_bonus(team_row.id, p_stop_id) then raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE'; end if;
  if exists (select 1 from city_game.team_stop_verifications where team_id = team_row.id and stop_id = p_stop_id) then return jsonb_build_object('ok', true, 'verified', true, 'state', city_game.team_state_json(team_row.id, session_row.id)); end if;
  select * into question_row from city_game.stop_observation_questions question join city_game.game_stops stop on stop.game_slug = question.game_slug and stop.game_version = question.game_version and stop.stop_id = question.stop_id
  where question.id = p_question_id and question.stop_id = p_stop_id and question.game_slug = team_row.game_slug and question.game_version = team_row.game_version and stop.is_bonus and question.enabled;
  if not found then raise exception using errcode = 'P0001', message = 'OBSERVATION_NOT_AVAILABLE'; end if;
  if not city_game.observation_answer_matches(question_row.answer_rule, p_answer) then
    insert into city_game.events (event_id, team_id, session_id, game_slug, stop_id, event_type) values (p_action_id, team_row.id, session_row.id, team_row.game_slug, p_stop_id, 'bonus_observation_rejected') on conflict (event_id) do nothing;
    return jsonb_build_object('ok', true, 'verified', false, 'state', city_game.team_state_json(team_row.id, session_row.id));
  end if;
  insert into city_game.team_stop_verifications (team_id, stop_id, method, verified_by_session_id, question_id, action_id) values (team_row.id, p_stop_id, 'observation', session_row.id, question_row.id, p_action_id) on conflict (team_id, stop_id) do nothing;
  update city_game.progress set state = 'arrived', unlock_method = 'observation', arrived_at = coalesce(arrived_at, now()) where team_id = team_row.id and stop_id = p_stop_id and state = 'available';
  insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data) values (team_row.id, session_row.id, team_row.game_slug, p_stop_id, 'bonus_unlocked', jsonb_build_object('method', 'observation', 'questionId', question_row.id));
  return jsonb_build_object('ok', true, 'verified', true, 'state', city_game.team_state_json(team_row.id, session_row.id));
end;
$$;

grant execute on function public.select_bonus_location(uuid, text) to authenticated;
grant execute on function public.verify_bonus_observation(uuid, text, text, text, uuid) to authenticated;
