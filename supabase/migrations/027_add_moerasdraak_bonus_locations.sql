-- Optional, non-sequential locations for De Verborgen Schubben.
-- They reuse city_game.progress, events and team_game_runs; no separate bonus table is introduced.

alter table city_game.game_stops
  add column if not exists is_bonus boolean not null default false,
  add column if not exists discovery_radius_m double precision,
  add column if not exists maximum_points integer;

alter table city_game.teams
  add column if not exists selected_bonus_location_id text;

create or replace function city_game.make_bonus_progress_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from city_game.game_stops stop
    where stop.game_slug = (select game_slug from city_game.teams where id = new.team_id)
      and stop.game_version = (select game_version from city_game.teams where id = new.team_id)
      and stop.stop_id = new.stop_id and stop.is_bonus
  ) then
    new.state := 'available';
  end if;
  return new;
end;
$$;

drop trigger if exists make_bonus_progress_available on city_game.progress;
create trigger make_bonus_progress_available
before insert on city_game.progress
for each row execute function city_game.make_bonus_progress_available();

insert into city_game.game_stops (
  game_slug, game_version, stop_id, stop_order, latitude, longitude, radius_m,
  maximum_accuracy_m, is_bonus, discovery_radius_m, maximum_points, answer_spec, hint_ids
) values
  ('moerasdraak-den-bosch', 1, 'bonus:bolwerk-sint-jan', 101, 51.689541, 5.298851, 55, 120, true, 120, 100, '{"kind":"choice","answer":"a"}', '["h1"]'),
  ('moerasdraak-den-bosch', 1, 'bonus:halve-peer', 102, 51.689444, 5.299722, 55, 130, true, 120, 200, '{"kind":"choice","answer":"b"}', '["h1"]'),
  ('moerasdraak-den-bosch', 1, 'bonus:de-moriaan', 103, 51.689615, 5.303141, 55, 120, true, 120, 150, '{"kind":"choice","answer":"a"}', '["h1"]'),
  ('moerasdraak-den-bosch', 1, 'bonus:zwanenbroedershuis', 104, 51.688710, 5.309535, 60, 130, true, 120, 150, '{"kind":"choice","answer":"b"}', '["h1"]'),
  ('moerasdraak-den-bosch', 1, 'bonus:citadel', 105, 51.695161, 5.302865, 80, 140, true, 140, 250, '{"kind":"lens","answer":"vesting"}', '["h1"]'),
  ('moerasdraak-den-bosch', 1, 'bonus:verkadefabriek', 106, 51.695626, 5.297448, 70, 130, true, 130, 250, '{"kind":"reorder","answer":["Koekjes- en biscuitfabriek","Leegstand / einde productie","Theater en film"]}', '["h1"]')
on conflict (game_slug, game_version, stop_id) do update set
  latitude = excluded.latitude, longitude = excluded.longitude, radius_m = excluded.radius_m,
  maximum_accuracy_m = excluded.maximum_accuracy_m, is_bonus = true,
  discovery_radius_m = excluded.discovery_radius_m, maximum_points = excluded.maximum_points,
  answer_spec = excluded.answer_spec, hint_ids = excluded.hint_ids;

insert into city_game.progress (team_id, stop_id, state)
select team.id, stop.stop_id, 'available'
from city_game.teams team
join city_game.game_stops stop on stop.game_slug = team.game_slug and stop.game_version = team.game_version
where stop.is_bonus
on conflict (team_id, stop_id) do nothing;

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
  if not found then raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE'; end if;

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
      insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data)
      values (team_row.id, session_row.id, team_row.game_slug, p_bonus_id, 'bonus_unlocked', jsonb_build_object('method', 'gps', 'distanceM', distance_m));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'state', city_game.team_state_json(team_row.id, session_row.id));
end;
$$;

grant execute on function public.select_bonus_location(uuid, text) to authenticated;

insert into city_game.stop_observation_questions (id, game_slug, game_version, stop_id, question_kind, question, answer_rule, hint, requires_on_site_validation)
values
  ('bonus-bolwerk-primary', 'moerasdraak-den-bosch', 1, 'bonus:bolwerk-sint-jan', 'primary', 'Welke twee materialen ontmoeten elkaar hier het duidelijkst?', '{"type":"variants","values":["baksteen en roestkleurig staal","baksteen staal"]}', 'Kijk naar oud steen en het pantser.', false),
  ('bonus-halve-peer-primary', 'moerasdraak-den-bosch', 1, 'bonus:halve-peer', 'primary', 'Waar bevindt de afgebeelde helft zich?', '{"type":"variants","values":["tegen een gevel boven de binnendieze","gevel boven de binnendieze"]}', 'Kijk omhoog aan de gevel.', false),
  ('bonus-moriaan-primary', 'moerasdraak-den-bosch', 1, 'bonus:de-moriaan', 'primary', 'Welke combinatie herken je aan dit gebouw?', '{"type":"variants","values":["trapgevel rond hoektorentje en spitsboogdetails","trapgevel hoektorentje spitsboogdetails"]}', 'Kijk naar daklijn, hoek en bogen.', false),
  ('bonus-zwanenbroedershuis-primary', 'moerasdraak-den-bosch', 1, 'bonus:zwanenbroedershuis', 'primary', 'Welk dier staat helemaal boven op de gevel?', '{"type":"variants","values":["zwaan","een zwaan"]}', 'De huisnaam helpt.', false),
  ('bonus-citadel-primary', 'moerasdraak-den-bosch', 1, 'bonus:citadel', 'primary', 'Welk verdedigend onderdeel vormt hier nog steeds de toegang tot de Citadel?', '{"type":"variants","values":["een doorgang door de hoge bakstenen vestingwal","doorgang door de hoge bakstenen vestingwal","doorgang door de vestingwal"]}', 'Kijk naar de bakstenen wal rond de doorgang.', false),
  ('bonus-verkade-primary', 'moerasdraak-den-bosch', 1, 'bonus:verkadefabriek', 'primary', 'Wat was de oorspronkelijke functie van dit gebouw?', '{"type":"variants","values":["koekjes en biscuitfabriek","koekjesfabriek","biscuitfabriek"]}', 'Denk aan de oorspronkelijke productie.', false)
on conflict (id) do update set question = excluded.question, answer_rule = excluded.answer_rule, hint = excluded.hint, requires_on_site_validation = false, enabled = true;

create or replace function public.verify_bonus_observation(p_session_id uuid, p_stop_id text, p_question_id text, p_answer text, p_action_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare session_row city_game.team_sessions%rowtype; team_row city_game.teams%rowtype; question_row city_game.stop_observation_questions%rowtype;
begin
  select * into session_row from city_game.team_sessions session where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;
  select * into team_row from city_game.teams team where id = session_row.team_id for update;
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
grant execute on function public.verify_bonus_observation(uuid, text, text, text, uuid) to authenticated;

create or replace function city_game.unlock_selected_bonus_from_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare team_row city_game.teams%rowtype; stop_row city_game.game_stops%rowtype; distance_m double precision;
begin
  select * into team_row from city_game.teams team where team.id = new.team_id;
  if team_row.selected_bonus_location_id is null then return new; end if;
  select * into stop_row from city_game.game_stops stop where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version and stop.stop_id = team_row.selected_bonus_location_id and stop.is_bonus;
  if not found or new.accuracy_m > stop_row.maximum_accuracy_m then return new; end if;
  distance_m := city_game.distance_m(new.latitude, new.longitude, stop_row.latitude, stop_row.longitude);
  if distance_m <= stop_row.radius_m then
    update city_game.progress set state = 'arrived', unlock_method = 'gps', arrived_at = coalesce(arrived_at, now()) where team_id = new.team_id and stop_id = stop_row.stop_id and state = 'available';
    if found then insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data) values (new.team_id, new.source_session_id, team_row.game_slug, stop_row.stop_id, 'bonus_unlocked', jsonb_build_object('method', 'gps', 'distanceM', distance_m)); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists unlock_selected_bonus_from_location on city_game.team_current_location;
create trigger unlock_selected_bonus_from_location after insert or update of latitude, longitude, accuracy_m on city_game.team_current_location
for each row execute function city_game.unlock_selected_bonus_from_location();

alter table city_game.teams add column if not exists bonus_completion_awarded boolean not null default false;

create or replace function public.start_or_resume_team_game(p_session_id uuid, p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare session_row city_game.team_sessions%rowtype; team_row city_game.teams%rowtype;
  progress_row city_game.progress%rowtype; active_run city_game.team_game_runs%rowtype; stop_row city_game.game_stops%rowtype;
begin
  select * into session_row from city_game.team_sessions session where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;
  select * into team_row from city_game.teams team where id = session_row.team_id for update;
  select * into active_run from city_game.team_game_runs run where run.team_id = team_row.id and run.status = 'active' limit 1;
  if found then
    if active_run.game_id = p_game_id then return jsonb_build_object('ok', true, 'resumed', true, 'run', city_game.game_run_json(active_run)); end if;
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ACTIVE_GAME_EXISTS'));
  end if;
  select * into stop_row from city_game.game_stops stop where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version and stop.stop_id = p_game_id;
  if not found or (not stop_row.is_bonus and p_game_id is distinct from team_row.current_stop_id) then return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_NOT_AVAILABLE')); end if;
  select * into progress_row from city_game.progress progress where progress.team_id = team_row.id and progress.stop_id = p_game_id for update;
  if progress_row.state = 'completed' then return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_ALREADY_COMPLETED')); end if;
  if progress_row.state not in ('arrived', 'started') then return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_NOT_AVAILABLE')); end if;
  insert into city_game.team_game_runs (team_id, game_id, status, started_by_session_id) values (team_row.id, p_game_id, 'active', session_row.id) returning * into active_run;
  update city_game.progress set state = 'started', started_at = coalesce(started_at, now()) where id = progress_row.id;
  insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type) values (team_row.id, session_row.id, team_row.game_slug, p_game_id, case when stop_row.is_bonus then 'bonus_started' else 'game_started' end);
  return jsonb_build_object('ok', true, 'resumed', false, 'run', city_game.game_run_json(active_run));
end;
$$;

create or replace function public.complete_team_game(p_session_id uuid, p_run_id uuid, p_expected_version bigint, p_result jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare session_row city_game.team_sessions%rowtype; run_row city_game.team_game_runs%rowtype;
  team_row city_game.teams%rowtype; current_stop city_game.game_stops%rowtype; next_stop city_game.game_stops%rowtype;
  v_attempts integer; v_hints integer; v_awarded integer; v_collection_bonus integer := 0;
begin
  select * into session_row from city_game.team_sessions session where session.id = p_session_id and session.auth_user_id = auth.uid() and session.revoked_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_REVOKED'; end if;
  select * into run_row from city_game.team_game_runs run where run.id = p_run_id for update;
  if not found or run_row.team_id <> session_row.team_id then raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE'; end if;
  if run_row.status = 'completed' then return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'state', city_game.team_state_json(run_row.team_id, session_row.id)); end if;
  if run_row.status <> 'active' or run_row.version is distinct from p_expected_version or coalesce((run_row.state->>'answerAccepted')::boolean, false) is not true then raise exception using errcode = 'P0001', message = 'INVALID_GAME_RESULT'; end if;
  select * into team_row from city_game.teams team where id = run_row.team_id for update;
  select * into current_stop from city_game.game_stops stop where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version and stop.stop_id = run_row.game_id;
  v_attempts := greatest(coalesce((run_row.state->>'attempts')::integer, 1), 1); v_hints := greatest(coalesce((run_row.state->>'hintsUsed')::integer, 0), 0);
  v_awarded := case when current_stop.is_bonus then greatest(50, round(current_stop.maximum_points * case when v_hints > 0 or v_attempts >= 3 then .5 when v_attempts = 2 then .75 else 1 end)::integer) else greatest(100, 1000 - (v_hints * 100) - ((v_attempts - 1) * 25)) end;
  update city_game.team_game_runs set status = 'completed', result = (coalesce(p_result, '{}'::jsonb) - 'score') || jsonb_build_object('score', v_awarded), version = version + 1, completed_at = now(), updated_at = now() where id = run_row.id;
  update city_game.progress set state = 'completed', attempts = v_attempts, hints_used = v_hints, score_awarded = v_awarded, answer_data = jsonb_build_object('accepted', true), completed_at = coalesce(completed_at, now()) where team_id = team_row.id and stop_id = run_row.game_id and state <> 'completed';
  if not current_stop.is_bonus then
    select * into next_stop from city_game.game_stops stop where stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version and stop.stop_order = current_stop.stop_order + 1 and not stop.is_bonus;
    if next_stop.stop_id is not null then update city_game.progress set state = 'available' where team_id = team_row.id and stop_id = next_stop.stop_id and state = 'locked'; end if;
  elsif not team_row.bonus_completion_awarded and (select count(*) from city_game.progress progress join city_game.game_stops stop on stop.game_slug = team_row.game_slug and stop.game_version = team_row.game_version and stop.stop_id = progress.stop_id where progress.team_id = team_row.id and stop.is_bonus and progress.state = 'completed') = 6 then
    v_collection_bonus := 300; update city_game.teams set bonus_completion_awarded = true where id = team_row.id;
    insert into city_game.events (team_id, session_id, game_slug, event_type, event_data) values (team_row.id, session_row.id, team_row.game_slug, 'bonus_collection_completed', jsonb_build_object('score', 300));
  end if;
  update city_game.teams set score = (select coalesce(sum(progress.score_awarded), 0) from city_game.progress progress where progress.team_id = team_row.id) + case when bonus_completion_awarded then 300 else 0 end,
    status = case when current_stop.is_final then 'completed' else status end, completed_at = case when current_stop.is_final then now() else completed_at end,
    current_stop_id = case when current_stop.is_bonus then current_stop_id else coalesce(next_stop.stop_id, current_stop.stop_id) end,
    current_step_id = case when current_stop.is_final then 'completed' when current_stop.is_bonus then current_step_id else 'available' end, version = version + 1, updated_by_session_id = session_row.id where id = team_row.id;
  insert into city_game.events (team_id, session_id, game_slug, stop_id, event_type, event_data) values (team_row.id, session_row.id, team_row.game_slug, run_row.game_id, case when current_stop.is_bonus then 'bonus_completed' else 'game_completed' end, jsonb_build_object('runId', run_row.id, 'score', v_awarded, 'collectionBonus', v_collection_bonus));
  return jsonb_build_object('ok', true, 'alreadyCompleted', false, 'state', city_game.team_state_json(team_row.id, session_row.id));
end;
$$;
