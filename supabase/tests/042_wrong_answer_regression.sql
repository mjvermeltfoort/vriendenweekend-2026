-- Run against 042_wrong_answer_fixture.sql + migration 042; rollback all test changes.
begin;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$
declare
  session_a uuid := '10000000-0000-0000-0000-000000000001';
  session_b uuid := '10000000-0000-0000-0000-000000000002';
  team uuid := '00000000-0000-0000-0000-000000000001';
  main uuid := '30000000-0000-0000-0000-000000000001';
  bonus uuid := '30000000-0000-0000-0000-000000000002';
  final uuid := '30000000-0000-0000-0000-000000000003';
  result jsonb;
  snapshot jsonb;
  deadline timestamptz;
  before_version bigint;
begin
  result := public.update_team_game_state(session_a, main, 0, 'submit_answer', '{"answer":"no"}');
  deadline := (result->'actionResult'->>'retryAvailableAt')::timestamptz;
  if (result->'actionResult'->>'correct')::boolean or (result->'actionResult'->>'penaltyPoints')::integer <> 25
    or deadline < clock_timestamp() + interval '55 seconds' or deadline > clock_timestamp() + interval '60 seconds' then raise exception 'wrong answer did not create one 60-second penalty'; end if;
  if (select score from city_game.teams where id=team) <> -25 then raise exception 'penalty not immediate'; end if;
  snapshot := city_game.team_state_json(team, session_a);
  if snapshot->'progress'->'stopProgress'->'main'->>'retryAvailableAt' is null or snapshot->'progress'->>'serverNow' is null then raise exception 'cooldown missing from shared snapshot'; end if;
  result := public.update_team_game_state(session_a, main, 0, 'submit_answer', '{"answer":"no"}');
  if result->'error'->>'code' <> 'ANSWER_COOLDOWN' then raise exception 'duplicate tap not blocked'; end if;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
  result := public.update_team_game_state(session_b, main, 1, 'submit_answer', '{"answer":"yes","retryAvailableAt":"2000-01-01"}');
  if result->'error'->>'code' <> 'ANSWER_COOLDOWN' then raise exception 'other phone bypassed cooldown'; end if;
  if (select score from city_game.teams where id=team) <> -25 or (select count(*) from city_game.events where event_type='wrong_answer') <> 1 then raise exception 'duplicate deducted again'; end if;
  -- Hints and placement reset remain possible but cannot erase the server deadline.
  perform public.update_team_game_state(session_b, main, 1, 'use_hint', '{"hintId":"h1"}');
  perform public.update_team_game_state(session_b, main, 2, 'reset_attempt', '{}');
  if (select (state->>'retryAvailableAt')::timestamptz from city_game.team_game_runs where id=main) <> deadline then raise exception 'reset erased cooldown'; end if;
  update city_game.team_game_runs set state=jsonb_set(state,'{retryAvailableAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=main;
  result := public.update_team_game_state(session_b, main, 0, 'submit_answer', '{"answer":"no"}');
  if result->'error'->>'code' <> 'VERSION_CONFLICT' then raise exception 'stale concurrent version accepted'; end if;
  result := public.update_team_game_state(session_b, main, 3, 'submit_answer', '{"answer":"yes"}');
  if not (result->'actionResult'->>'correct')::boolean then raise exception 'retry after deadline rejected'; end if;
  perform public.complete_team_game(session_b, main, 4, '{}');
  if (select score from city_game.teams where id=team) <> 875 then raise exception 'completion double-charged penalty or changed hint scoring'; end if;
  perform public.complete_team_game(session_b, main, 4, '{}');
  if (select score from city_game.teams where id=team) <> 875 then raise exception 'completion retry changed score'; end if;
  result := public.update_team_game_state(session_b, bonus, 0, 'submit_answer', '{"answer":"no"}');
  if (result->'actionResult'->>'penaltyPoints')::integer <> 50 then raise exception 'bonus formula changed'; end if;
  update city_game.team_game_runs set state=jsonb_set(state,'{retryAvailableAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=bonus;
  result := public.update_team_game_state(session_b, bonus, 1, 'submit_answer', '{"answer":"yes"}');
  perform public.complete_team_game(session_b, bonus, 2, '{}');
  if (select score from city_game.teams where id=team) <> 1025 then raise exception 'bonus penalty double-charged'; end if;
  result := public.update_team_game_state(session_b, final, 0, 'submit_answer', '{"answer":"9999"}');
  if (result->'actionResult'->>'penaltyPoints')::integer <> 25 or result->'actionResult'->>'retryAvailableAt' is null then raise exception 'finale not covered'; end if;
  update city_game.team_game_runs set state=jsonb_set(state,'{retryAvailableAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=final;
  perform public.update_team_game_state(session_b, final, 1, 'submit_answer', '{"answer":"1234"}');
  perform public.complete_team_game(session_b, final, 2, '{}');
  if (select score from city_game.teams where id=team) <> 2000 then raise exception 'final score incorrect'; end if;
  if city_game.answer_potential_score(false,1000,100,0) <> 100 or city_game.answer_potential_score(true,200,100,0) <> 100 then raise exception 'score floors changed'; end if;
  if has_function_privilege('authenticated','city_game.answer_potential_score(boolean,integer,integer,integer)','execute') then raise exception 'private scorer exposed'; end if;
  if has_function_privilege('authenticated','city_game.team_state_json(uuid,uuid)','execute') then raise exception 'internal state exposed'; end if;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
  begin
    perform public.update_team_game_state('10000000-0000-0000-0000-000000000003', bonus, 2, 'submit_answer', '{"answer":"no"}');
    raise exception 'foreign team access accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'GAME_NOT_AVAILABLE' then raise; end if;
  end;
end;
$$;
rollback;
