begin;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000030',
  'authenticated',
  'authenticated',
  'location-guess-regression@example.invalid',
  now(),
  now()
);

insert into private.players (user_id, name, normalized_name)
values (
  '10000000-0000-4000-8000-000000000030',
  'Finale test',
  'finale test'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000030',
  true
);

do $$
begin
  if private.normalize_location_guess('  HÉËSWIJK — DÍNTHER! ') <> 'heeswijkdinther' then
    raise exception 'location normalization failed';
  end if;
  if has_table_privilege('anon', 'private.location_guesses', 'select')
    or has_table_privilege('authenticated', 'private.location_guesses', 'select') then
    raise exception 'private location guesses are exposed';
  end if;
end;
$$;

update private.games
set status = 'open', open_from = null, close_at = null;

update private.games
set status = 'gesloten'
where id = (select id from private.games order by display_order limit 1);

do $$
begin
  if (private.location_guess_state(auth.uid())->>'visible')::boolean then
    raise exception 'finale became visible before every game was open';
  end if;
  perform public.submit_location_guess('test');
  raise exception 'submission was accepted while a game was closed';
exception
  when others then
    if sqlerrm not like '%nog niet vrijgegeven%' then raise; end if;
end;
$$;

update private.games set status = 'open';

do $$
declare
  v_state jsonb := private.location_guess_state(auth.uid());
begin
  if not (v_state->>'visible')::boolean or (v_state->>'eligible')::boolean then
    raise exception 'visibility and completion gates are inconsistent';
  end if;
  if v_state::text like '%Heeswijk-Dinther%' then
    raise exception 'canonical location leaked before success';
  end if;
  perform public.submit_location_guess('test');
  raise exception 'submission was accepted before all games were completed';
exception
  when others then
    if sqlerrm not like '%Voltooi eerst alle spellen%' then raise; end if;
end;
$$;

insert into private.scores (
  user_id, player_name, game_id, score, seconds, attempts
)
select
  auth.uid(), 'Finale test', id, 100, 1, 1
from private.games;

do $$
declare
  v_result jsonb;
begin
  v_result := public.submit_location_guess('Veghel');
  if (v_result->>'correct')::boolean
    or (v_result->>'canAttempt')::boolean
    or v_result->>'nextAttemptAt' is null then
    raise exception 'incorrect attempt or cooldown state is invalid';
  end if;

  perform public.submit_location_guess('Heeswijk-Dinther');
  raise exception 'rolling 24-hour limit was not enforced';
exception
  when others then
    if sqlerrm not like '%al een poging%' then raise; end if;
end;
$$;

update private.location_guesses
set created_at = now() - interval '24 hours 1 minute'
where user_id = auth.uid();

do $$
declare
  v_result jsonb;
  v_state jsonb;
  v_row jsonb;
  v_expected_score integer;
begin
  v_result := public.submit_location_guess('  Héëswijk - Dínther ');
  if not (v_result->>'correct')::boolean
    or not (v_result->>'solved')::boolean
    or v_result->>'location' <> 'Heeswijk-Dinther'
    or (v_result->>'bonusPoints')::integer <> 1000 then
    raise exception 'correct finale result is invalid';
  end if;

  v_state := public.get_app_state();
  select value into v_row
  from jsonb_array_elements(v_state->'leaderboard') value
  where value->>'name' = 'Finale test';
  select count(*) * 100 + 1000 into v_expected_score from private.games;
  if (v_row->>'score')::integer <> v_expected_score
    or (v_row->>'bonusScore')::integer <> 1000
    or (v_row->>'games')::integer <> (select count(*) from private.games) then
    raise exception 'leaderboard finale bonus is invalid';
  end if;

  perform public.submit_location_guess('Heeswijk-Dinther');
  if (select count(*) from private.location_guesses where user_id = auth.uid() and is_correct) <> 1 then
    raise exception 'correct finale reward was not idempotent';
  end if;
end;
$$;

rollback;
