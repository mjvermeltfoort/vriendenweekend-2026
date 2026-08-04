-- Daily finale location guess with an authoritative completion gate and bonus.
create table if not exists private.location_guesses (
  id bigint generated always as identity primary key,
  user_id uuid not null references private.players(user_id) on update cascade on delete cascade,
  guessed_location text not null check (char_length(guessed_location) between 1 and 100),
  normalized_guess text not null check (char_length(normalized_guess) between 1 and 100),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists location_guesses_user_created_idx
on private.location_guesses (user_id, created_at desc);

create unique index if not exists location_guesses_one_correct_per_player_idx
on private.location_guesses (user_id)
where is_correct;

alter table private.location_guesses enable row level security;
revoke all on private.location_guesses from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

create or replace function private.normalize_location_guess(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  )
$$;

create or replace function private.location_guess_state(p_uid uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_visible boolean;
  v_eligible boolean;
  v_solved private.location_guesses;
  v_last private.location_guesses;
  v_total_games integer;
  v_completed_games integer;
  v_next_attempt_at timestamptz;
begin
  select count(*)::integer into v_total_games from private.games;
  select count(*)::integer into v_completed_games
  from private.scores
  where user_id = p_uid;

  v_visible := v_total_games > 0 and not exists (
    select 1 from private.games game
    where private.game_state(game) <> 'open'
  );
  v_eligible := exists (select 1 from private.players where user_id = p_uid)
    and v_total_games > 0
    and not exists (
      select 1 from private.games game
      where not exists (
        select 1 from private.scores score
        where score.user_id = p_uid and score.game_id = game.id
      )
    );

  select * into v_solved
  from private.location_guesses
  where user_id = p_uid and is_correct
  order by created_at
  limit 1;

  select * into v_last
  from private.location_guesses
  where user_id = p_uid
  order by created_at desc, id desc
  limit 1;

  if v_solved.id is null and v_last.id is not null then
    v_next_attempt_at := v_last.created_at + interval '24 hours';
  end if;

  return jsonb_build_object(
    'visible', v_visible,
    'eligible', v_eligible,
    'solved', v_solved.id is not null,
    'canAttempt', v_visible and v_eligible and v_solved.id is null
      and (v_last.id is null or v_next_attempt_at <= now()),
    'completedGames', v_completed_games,
    'totalGames', v_total_games,
    'bonusPoints', case when v_solved.id is null then 0 else 1000 end,
    'lastAttemptAt', v_last.created_at,
    'lastAttemptCorrect', case when v_last.id is null then null else v_last.is_correct end,
    'nextAttemptAt', case
      when v_solved.id is null and v_next_attempt_at > now() then v_next_attempt_at
      else null
    end,
    'solvedAt', v_solved.created_at,
    'location', case when v_solved.id is null then null else 'Heeswijk-Dinther' end
  );
end
$$;

create or replace function public.submit_location_guess(p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_player_name text;
  v_guess text;
  v_normalized text;
  v_correct boolean;
  v_last_attempt_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Je sessie ontbreekt. Probeer opnieuw.';
  end if;

  select name into v_player_name
  from private.players
  where user_id = v_uid
  for update;
  if not found then
    raise exception 'Sla eerst je naam op.';
  end if;

  if exists (
    select 1 from private.location_guesses
    where user_id = v_uid and is_correct
  ) then
    return private.location_guess_state(v_uid)
      || jsonb_build_object('correct', true, 'alreadySolved', true);
  end if;

  if not exists (select 1 from private.games) or exists (
    select 1 from private.games game
    where private.game_state(game) <> 'open'
  ) then
    raise exception 'De eindbestemming is nog niet vrijgegeven.';
  end if;

  if exists (
    select 1 from private.games game
    where not exists (
      select 1 from private.scores score
      where score.user_id = v_uid and score.game_id = game.id
    )
  ) then
    raise exception 'Voltooi eerst alle spellen.';
  end if;

  select created_at into v_last_attempt_at
  from private.location_guesses
  where user_id = v_uid
  order by created_at desc, id desc
  limit 1;
  if v_last_attempt_at is not null and v_last_attempt_at + interval '24 hours' > now() then
    raise exception 'Je hebt al een poging gedaan. Probeer het later opnieuw.';
  end if;

  v_guess := btrim(regexp_replace(coalesce(p_guess, ''), '[[:cntrl:]]', '', 'g'));
  v_normalized := private.normalize_location_guess(v_guess);
  if char_length(v_guess) not between 1 and 100 or char_length(v_normalized) not between 1 and 100 then
    raise exception 'Vul een geldige locatie van maximaal 100 tekens in.';
  end if;

  v_correct := v_normalized = 'heeswijkdinther';
  insert into private.location_guesses (
    user_id, guessed_location, normalized_guess, is_correct
  ) values (
    v_uid, v_guess, v_normalized, v_correct
  );

  return private.location_guess_state(v_uid)
    || jsonb_build_object('correct', v_correct, 'alreadySolved', false);
end
$$;

create or replace function public.get_app_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt. Probeer opnieuw.'; end if;
  update private.players set last_seen_at = now() where user_id = v_uid;
  return jsonb_build_object(
    'games', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'description', g.description, 'status', g.status, 'state', private.game_state(g), 'openFrom', g.open_from, 'closeAt', g.close_at, 'hint', case when s.id is null then '' else g.hint end, 'maxPoints', g.max_points, 'order', g.display_order, 'completed', case when s.id is null then null else jsonb_build_object('gameId',s.game_id,'title',g.title,'score',s.score,'seconds',s.seconds,'attempts',s.attempts) end) order by g.display_order) from private.games g left join private.scores s on s.game_id=g.id and s.user_id=v_uid), '[]'::jsonb),
    'leaderboard', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', x.name,
          'score', x.score,
          'games', x.games,
          'seconds', x.seconds,
          'bonusScore', x.bonus_score,
          'gameDetails', x.game_details
        )
        order by x.score desc, x.seconds asc, x.name asc
      )
      from (
        select
          min(s.player_name) as name,
          (sum(s.score) + case when exists (
            select 1 from private.location_guesses guess
            where guess.user_id = s.user_id and guess.is_correct
          ) then 1000 else 0 end)::integer as score,
          count(*)::integer as games,
          sum(s.seconds)::integer as seconds,
          (case when exists (
            select 1 from private.location_guesses guess
            where guess.user_id = s.user_id and guess.is_correct
          ) then 1000 else 0 end)::integer as bonus_score,
          jsonb_agg(
            jsonb_build_object(
              'gameId', s.game_id,
              'title', g.title,
              'score', s.score,
              'seconds', s.seconds,
              'attempts', s.attempts,
              'starts', (select count(*)::integer from private.game_starts gs where gs.user_id = s.user_id and gs.game_id = s.game_id)
            )
            order by g.display_order
          ) || case when exists (
            select 1 from private.location_guesses guess
            where guess.user_id = s.user_id and guess.is_correct
          ) then jsonb_build_array(jsonb_build_object(
            'gameId', 'eindlocatie',
            'title', 'Eindlocatie gevonden',
            'score', 1000,
            'isFinale', true
          )) else '[]'::jsonb end as game_details
        from private.scores s
        join private.games g on g.id = s.game_id
        group by s.user_id
        order by (sum(s.score) + case when exists (
          select 1 from private.location_guesses guess
          where guess.user_id = s.user_id and guess.is_correct
        ) then 1000 else 0 end) desc, sum(s.seconds) asc, min(s.player_name) asc
        limit 50
      ) x
    ), '[]'::jsonb),
    'activePlayers', coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'gameId',a.game_id,'gameTitle',g.title,'startedAt',a.started_at) order by a.last_seen_at desc) from private.active_players a join private.players p on p.user_id=a.user_id join private.games g on g.id=a.game_id where a.last_seen_at >= now() - interval '30 seconds'), '[]'::jsonb),
    'locationGuess', private.location_guess_state(v_uid)
  );
end $$;

revoke all on function private.normalize_location_guess(text), private.location_guess_state(uuid) from public;
revoke all on function public.submit_location_guess(text), public.get_app_state() from public;
grant execute on function public.submit_location_guess(text), public.get_app_state() to authenticated;
