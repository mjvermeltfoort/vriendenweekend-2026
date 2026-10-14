-- Shared, server-authoritative wrong-answer penalty and 60-second retry window.
-- Apply after migration 041, before deploying the corresponding frontend.
begin;
alter table city_game.progress add column if not exists retry_available_at timestamptz;
alter table city_game.progress add column if not exists last_wrong_answer_at timestamptz;
alter table city_game.progress add column if not exists last_wrong_answer_penalty integer;

-- Same score floors and bonus factors as migration 027. Pending deductions are
-- negative progress ledger entries; completion replaces them, never subtracts twice.
create or replace function city_game.answer_potential_score(p_bonus boolean, p_maximum integer, p_wrong integer, p_hints integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_bonus then greatest(50, round(p_maximum * case when p_hints > 0 or p_wrong >= 2 then .5 when p_wrong = 1 then .75 else 1 end)::integer)
    else greatest(100, 1000 - p_hints * 100 - p_wrong * 25) end;
$$;
revoke all on function city_game.answer_potential_score(boolean, integer, integer, integer) from public, anon, authenticated;

create or replace function public.update_team_game_state(
  p_session_id uuid,
  p_run_id uuid,
  p_expected_version bigint,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  run_row city_game.team_game_runs%rowtype;
  stop_row city_game.game_stops%rowtype;
  new_state jsonb;
  answer jsonb;
  answer_correct boolean := false;
  hint_id text;
  v_now timestamptz;
  v_retry_at timestamptz;
  v_penalty integer := 0;
  v_wrong_count integer;
  v_penalty_total integer;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select * into run_row
  from city_game.team_game_runs run
  where run.id = p_run_id
  for update;
  if not found or run_row.team_id <> session_row.team_id then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;
  if run_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_ALREADY_COMPLETED'));
  end if;
  v_now := clock_timestamp();
  v_retry_at := (run_row.state->>'retryAvailableAt')::timestamptz;
  if p_action = 'submit_answer' and v_retry_at > v_now then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ANSWER_COOLDOWN'));
  end if;
  if run_row.version is distinct from p_expected_version then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VERSION_CONFLICT'));
  end if;
  if p_action is null
    or p_action not in ('submit_answer', 'use_hint', 'place_item', 'reset_attempt')
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 16384 then
    raise exception using errcode = 'P0001', message = 'INVALID_GAME_ACTION';
  end if;

  select stop.* into stop_row
  from city_game.game_stops stop
  join city_game.teams team
    on team.game_slug = stop.game_slug and team.game_version = stop.game_version
  where team.id = run_row.team_id and stop.stop_id = run_row.game_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;

  new_state := run_row.state;
  if p_action = 'submit_answer' then
    if coalesce((new_state->>'answerAccepted')::boolean, false) then
      return jsonb_build_object('ok', true, 'run', city_game.game_run_json(run_row), 'actionResult', jsonb_build_object('correct', true));
    end if;
    answer := p_payload->'answer';
    if answer is null or jsonb_typeof(answer) = 'null' then
      raise exception using errcode = 'P0001', message = 'INVALID_GAME_ACTION';
    end if;
    if stop_row.answer_spec->>'kind' = 'code' then
      answer_correct := (stop_row.answer_spec->'answers') ? regexp_replace(
        upper(trim(both '"' from coalesce(answer::text, ''))), '[\s-]+', '', 'g'
      );
    else
      answer_correct := answer = stop_row.answer_spec->'answer';
    end if;
    answer_correct := coalesce(answer_correct, false);
    v_wrong_count := coalesce((new_state->>'attempts')::integer, 0);
    if not answer_correct then
      v_penalty := city_game.answer_potential_score(stop_row.is_bonus, stop_row.maximum_points, v_wrong_count, coalesce((new_state->>'hintsUsed')::integer, 0))
        - city_game.answer_potential_score(stop_row.is_bonus, stop_row.maximum_points, v_wrong_count + 1, coalesce((new_state->>'hintsUsed')::integer, 0));
      v_retry_at := v_now + interval '60 seconds';
      v_penalty_total := coalesce((new_state->>'wrongAnswerPenaltyTotal')::integer, 0) + v_penalty;
      new_state := new_state || jsonb_build_object('retryAvailableAt', v_retry_at, 'lastWrongAnswerAt', v_now,
        'lastWrongAnswerPenalty', v_penalty, 'wrongAnswerPenaltyTotal', v_penalty_total);
      update city_game.progress set attempts = v_wrong_count + 1, retry_available_at = v_retry_at,
        last_wrong_answer_at = v_now, last_wrong_answer_penalty = v_penalty, score_awarded = -v_penalty_total
      where team_id = run_row.team_id and stop_id = run_row.game_id;
      update city_game.teams set score = (select coalesce(sum(p.score_awarded), 0) from city_game.progress p where p.team_id = run_row.team_id)
        + case when bonus_completion_awarded then 300 else 0 end,
        version = version + 1, updated_by_session_id = session_row.id
      where id = run_row.team_id;
      insert into city_game.events(team_id, session_id, game_slug, stop_id, event_type, event_data)
      select run_row.team_id, session_row.id, team.game_slug, run_row.game_id, 'wrong_answer',
        jsonb_build_object('runId', run_row.id, 'penaltyPoints', v_penalty, 'retryAvailableAt', v_retry_at)
      from city_game.teams team where team.id = run_row.team_id;
    else
      new_state := new_state - 'retryAvailableAt';
      update city_game.progress set retry_available_at = null where team_id = run_row.team_id and stop_id = run_row.game_id;
    end if;
    new_state := jsonb_set(new_state, '{attempts}', to_jsonb(coalesce((new_state->>'attempts')::integer, 0) + 1), true);
    new_state := jsonb_set(new_state, '{answerAccepted}', to_jsonb(answer_correct), true);
  elsif p_action = 'use_hint' then
    hint_id := nullif(p_payload->>'hintId', '');
    if hint_id is null
      or not (stop_row.hint_ids ? hint_id)
      or (coalesce(new_state->'usedHintIds', '[]'::jsonb) ? hint_id) then
      raise exception using errcode = 'P0001', message = 'INVALID_GAME_ACTION';
    end if;
    new_state := jsonb_set(
      new_state,
      '{usedHintIds}',
      coalesce(new_state->'usedHintIds', '[]'::jsonb) || jsonb_build_array(hint_id),
      true
    );
    new_state := jsonb_set(
      new_state,
      '{hintsUsed}',
      to_jsonb(jsonb_array_length(new_state->'usedHintIds')),
      true
    );
  elsif p_action = 'place_item' then
    new_state := jsonb_set(new_state, '{placements}', coalesce(p_payload->'placements', '{}'::jsonb), true);
  elsif p_action = 'reset_attempt' then
    -- Resetting placements must never erase a cooldown or an accepted answer.
    new_state := new_state - 'placements';
  end if;

  update city_game.team_game_runs
  set state = new_state,
      version = version + 1,
      updated_at = now()
  where id = run_row.id
  returning * into run_row;

  return jsonb_build_object(
    'ok', true,
    'run', city_game.game_run_json(run_row),
    'actionResult', case when p_action = 'submit_answer'
      then jsonb_build_object('correct', answer_correct, 'penaltyPoints', v_penalty, 'retryAvailableAt', case when answer_correct then null else v_retry_at end, 'serverNow', clock_timestamp())
      else '{}'::jsonb end
  );
end;
$$;

create or replace function city_game.team_state_json(
  p_team_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  team_row city_game.teams%rowtype;
  active_run city_game.team_game_runs%rowtype;
  current_location city_game.team_current_location%rowtype;
  stop_progress jsonb;
  verifications jsonb;
  active_count integer;
  location_current boolean := false;
begin
  select * into team_row from city_game.teams where id = p_team_id;

  select coalesce(
    jsonb_object_agg(
      progress.stop_id,
      jsonb_strip_nulls(jsonb_build_object(
        'state', progress.state,
        'attempts', progress.attempts,
        'hintsUsed', progress.hints_used,
        'scoreAwarded', progress.score_awarded,
        'answerData', progress.answer_data,
        'unlockMethod', progress.unlock_method,
        'arrivedAt', progress.arrived_at,
        'startedAt', progress.started_at,
        'completedAt', progress.completed_at,
        'retryAvailableAt', progress.retry_available_at,
        'lastWrongAnswerAt', progress.last_wrong_answer_at,
        'lastWrongAnswerPenalty', progress.last_wrong_answer_penalty
      ))
    ),
    '{}'::jsonb
  ) into stop_progress
  from city_game.progress progress
  where progress.team_id = p_team_id;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'stopId', verification.stop_id,
    'method', verification.method,
    'verifiedAt', verification.verified_at,
    'questionId', verification.question_id
  )) order by verification.verified_at), '[]'::jsonb)
  into verifications
  from city_game.team_stop_verifications verification
  where verification.team_id = p_team_id;

  select * into active_run
  from city_game.team_game_runs run
  where run.team_id = p_team_id and run.status = 'active'
  limit 1;

  select * into current_location
  from city_game.team_current_location location
  where location.team_id = p_team_id;
  if found then
    location_current := current_location.captured_at > now() - make_interval(
      secs => city_game.location_freshness_seconds()
    ) and exists (
      select 1 from city_game.team_sessions session
      where session.id = current_location.source_session_id
        and session.revoked_at is null
        and session.last_seen_at > now() - make_interval(
          secs => city_game.active_session_timeout_seconds()
        )
    );
  end if;

  select count(*)::integer into active_count
  from city_game.team_sessions session
  where session.team_id = p_team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    );

  return jsonb_build_object(
    'team', jsonb_build_object(
      'id', team_row.id,
      'gameSlug', team_row.game_slug,
      'gameVersion', team_row.game_version,
      'name', team_row.name,
      'status', team_row.status,
      'score', team_row.score,
      'createdAt', team_row.created_at,
      'updatedAt', team_row.updated_at
    ),
    'progress', jsonb_build_object(
      'teamId', team_row.id,
      'gameSlug', team_row.game_slug,
      'gameVersion', team_row.game_version,
      'currentStopId', team_row.current_stop_id,
      'currentStepId', team_row.current_step_id,
      'version', team_row.version,
      'totalScore', team_row.score,
      'serverNow', clock_timestamp(),
      'finalized', team_row.status = 'completed',
      'stopProgress', stop_progress
    ),
    'activeGame', case when active_run.id is null then null
      else city_game.game_run_json(active_run) end,
    'currentLocation', case when current_location.team_id is null then null
      else jsonb_build_object(
        'teamId', current_location.team_id,
        'sourceSessionId', current_location.source_session_id,
        'latitude', current_location.latitude,
        'longitude', current_location.longitude,
        'accuracyM', current_location.accuracy_m,
        'capturedAt', current_location.captured_at,
        'selectedAt', current_location.selected_at
      ) end,
    'locationStatus', case when location_current then 'current' else 'stale' end,
    'activeSessionCount', active_count,
    'verifications', verifications,
    'currentObservation', city_game.current_observation_json(
      p_team_id, team_row.current_stop_id
    ),
    'observationStatus', case
      when city_game.current_observation_json(p_team_id, team_row.current_stop_id) is not null
        then 'available'
      when exists (
        select 1 from city_game.stop_observation_questions question
        where question.stop_id = team_row.current_stop_id
          and question.enabled
          and question.requires_on_site_validation
      ) then 'validation_required'
      else 'unavailable'
    end,
    'sessionStateAt', now(),
    'sessionId', p_session_id
  );
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
  v_awarded := city_game.answer_potential_score(current_stop.is_bonus, current_stop.maximum_points, v_attempts - 1, v_hints);
  update city_game.team_game_runs set status = 'completed', result = (coalesce(p_result, '{}'::jsonb) - 'score') || jsonb_build_object('score', v_awarded), version = version + 1, completed_at = now(), updated_at = now() where id = run_row.id;
  update city_game.progress set state = 'completed', retry_available_at = null, attempts = v_attempts, hints_used = v_hints, score_awarded = v_awarded, answer_data = jsonb_build_object('accepted', true), completed_at = coalesce(completed_at, now()) where team_id = team_row.id and stop_id = run_row.game_id and state <> 'completed';
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

-- Replacing functions retains existing RPC grants; internal data stays private.
revoke all on function public.update_team_game_state(uuid, uuid, bigint, text, jsonb) from public, anon;
grant execute on function public.update_team_game_state(uuid, uuid, bigint, text, jsonb) to authenticated;
revoke all on function public.complete_team_game(uuid, uuid, bigint, jsonb) from public, anon;
grant execute on function public.complete_team_game(uuid, uuid, bigint, jsonb) to authenticated;
revoke all on function city_game.team_state_json(uuid, uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
