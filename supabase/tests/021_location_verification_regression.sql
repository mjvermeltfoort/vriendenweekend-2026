begin;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000021',
  true
);

create temporary table location_verification_test (
  team_id uuid,
  code text,
  session_id uuid
);

do $$
begin
  if (select count(*) from city_game.stop_observation_questions) <> 14 then
    raise exception 'all primary and backup questions must be seeded';
  end if;
  if exists (
    select 1 from city_game.stop_observation_questions
    where not requires_on_site_validation
  ) then
    raise exception 'questions must remain behind the field-validation gate';
  end if;
  if has_table_privilege('anon', 'city_game.stop_observation_questions', 'select')
    or has_table_privilege('authenticated', 'city_game.stop_observation_questions', 'select')
    or has_table_privilege('authenticated', 'city_game.team_stop_verifications', 'select') then
    raise exception 'question answers or evidence ledger are exposed';
  end if;
  if city_game.normalize_observation_answer('  ÉÉN,  SCHÍLD! ') <> 'een schild' then
    raise exception 'answer normalization failed';
  end if;
  if not city_game.observation_answer_matches(
    '{"type":"required_all","values":["1450","1516"]}', '1450 en 1516'
  ) or city_game.observation_answer_matches(
    '{"type":"required_all","values":["1450","1516"]}', 'alleen 1450'
  ) then
    raise exception 'required_all answer matching failed';
  end if;
  if exists (
    select 1 from city_game.game_stops
    where radius_m <> 35 or maximum_accuracy_m <> 40
  ) then
    raise exception 'provisional GPS thresholds were not applied';
  end if;
end;
$$;

with created as (
  select public.dashboard_create_team(
    'SQL Locatiebewijsteam', null,
    '20000000-0000-4000-8000-000000000021'
  ) value
)
insert into location_verification_test(team_id, code)
select (value->>'id')::uuid, value->>'code' from created;

with joined as (
  select public.join_team_by_code(
    (select code from location_verification_test),
    '30000000-0000-4000-8000-000000000021',
    'Location verification regression'
  ) value
)
update location_verification_test
set session_id = (select (value->'session'->>'id')::uuid from joined);

select public.update_team_location(
  (select session_id from location_verification_test),
  51.690506, 5.296208, 40, null, null, null, now()
);

do $$
declare
  state jsonb;
begin
  if (
    select count(*) from city_game.team_stop_verifications
    where team_id = (select team_id from location_verification_test)
      and stop_id = 'drakenfontein'
      and method = 'gps'
      and gps_distance_m <= 35
      and gps_accuracy_m = 40
  ) <> 1 then
    raise exception 'automatic GPS verification failed at the inclusive boundary';
  end if;
  state := public.get_team_state((select session_id from location_verification_test))->'state';
  if state->'progress'->'stopProgress'->'drakenfontein'->>'unlockMethod' <> 'gps'
    or jsonb_array_length(state->'verifications') <> 1 then
    raise exception 'sanitized verification was not published in team state';
  end if;
  if state::text ~ '"values"|"answerRule"|"vier"' then
    raise exception 'answer rules leaked through the team-state RPC';
  end if;
end;
$$;

do $$
begin
  perform public.update_team_location(
    (select session_id from location_verification_test),
    51.690506, 5.296208, 12, null, null, null, now() - interval '1 minute'
  );
  raise exception 'older per-session location was accepted';
exception
  when others then
    if sqlerrm not like '%LOCATION_OUT_OF_ORDER%' then raise; end if;
end;
$$;

select public.dashboard_reset_team_progress(
  (select team_id from location_verification_test),
  '20000000-0000-4000-8000-000000000021'
);
delete from city_game.team_session_locations
where team_id = (select team_id from location_verification_test);
delete from city_game.team_current_location
where team_id = (select team_id from location_verification_test);

do $$
begin
  perform public.verify_stop_observation(
    (select session_id from location_verification_test),
    'drakenfontein', 'drakenfontein-primary', 'vier',
    '40000000-0000-4000-8000-000000000020'
  );
  raise exception 'field-validation gate released an unapproved question';
exception
  when others then
    if sqlerrm not like '%OBSERVATION_NOT_AVAILABLE%' then raise; end if;
end;
$$;

do $$
begin
  perform public.dashboard_release_current_stop(
    (select team_id from location_verification_test),
    '20000000-0000-4000-8000-000000000021',
    ''
  );
  raise exception 'empty dashboard reason was accepted';
exception
  when others then
    if sqlerrm not like '%REASON_REQUIRED%' then raise; end if;
end;
$$;

select public.dashboard_release_current_stop(
  (select team_id from location_verification_test),
  '20000000-0000-4000-8000-000000000021',
  'GPS is op alle toestellen onbruikbaar'
);
select public.dashboard_release_current_stop(
  (select team_id from location_verification_test),
  '20000000-0000-4000-8000-000000000021',
  'Dubbele klik'
);

do $$
begin
  if (
    select count(*) from city_game.team_stop_verifications
    where team_id = (select team_id from location_verification_test)
      and stop_id = 'drakenfontein'
  ) <> 1 then
    raise exception 'dashboard release is not idempotent';
  end if;
  if not exists (
    select 1 from city_game.events
    where team_id = (select team_id from location_verification_test)
      and event_type = 'stop_released_from_dashboard'
      and event_data->>'reason' = 'GPS is op alle toestellen onbruikbaar'
      and event_data ? 'dashboardClientId'
  ) then
    raise exception 'dashboard release audit event is incomplete';
  end if;
end;
$$;

select public.dashboard_reset_team_progress(
  (select team_id from location_verification_test),
  '20000000-0000-4000-8000-000000000021'
);
update city_game.stop_observation_questions
set requires_on_site_validation = false
where id in ('drakenfontein-primary', 'drakenfontein-backup');

select public.verify_stop_observation(
  (select session_id from location_verification_test),
  'drakenfontein', 'drakenfontein-primary', 'onjuist',
  '40000000-0000-4000-8000-000000000021'
);
select public.verify_stop_observation(
  (select session_id from location_verification_test),
  'drakenfontein', 'drakenfontein-primary', 'nog onjuist',
  '40000000-0000-4000-8000-000000000022'
);

do $$
declare
  state jsonb;
begin
  state := public.get_team_state((select session_id from location_verification_test))->'state';
  if state->'currentObservation'->>'hint' is null
    or (state->'currentObservation'->>'wrongAttempts')::integer <> 2 then
    raise exception 'team-wide hint after two wrong attempts failed';
  end if;
end;
$$;

select public.verify_stop_observation(
  (select session_id from location_verification_test),
  'drakenfontein', 'drakenfontein-primary', ' VÍER! ',
  '40000000-0000-4000-8000-000000000023'
);
select public.verify_stop_observation(
  (select session_id from location_verification_test),
  'drakenfontein', 'drakenfontein-primary', ' VÍER! ',
  '40000000-0000-4000-8000-000000000023'
);

do $$
begin
  if (
    select count(*) from city_game.team_stop_verifications
    where team_id = (select team_id from location_verification_test)
      and method = 'observation'
  ) <> 1 then
    raise exception 'observation verification or replay idempotency failed';
  end if;
  if exists (
    select 1 from city_game.events
    where team_id = (select team_id from location_verification_test)
      and event_type = 'observation_attempt_rejected'
      and event_data ?| array['answer', 'normalizedAnswer']
  ) then
    raise exception 'wrong observation input was stored';
  end if;
end;
$$;

rollback;
