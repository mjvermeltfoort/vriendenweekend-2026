drop function if exists private.score_for(text, integer, integer, integer, integer);

create or replace function private.score_for(
  p_game_id    text,
  p_max_points integer,
  p_seconds    integer,
  p_attempts   integer,
  p_starts     integer default 1,
  p_detail     jsonb default '{}'::jsonb
)
returns integer language sql immutable security definer set search_path = '' as $$
  select case
    when p_game_id = 'rebus' then greatest(100,
      p_max_points
      - floor(p_seconds * 2)::integer
      - greatest(0, p_attempts) * 20
      - greatest(
          0,
          case
            when coalesce(p_detail->>'hintsUsed', '') ~ '^[0-9]+$'
              then (p_detail->>'hintsUsed')::integer
            else 0
          end
        ) * 75
    )
    when p_game_id = 'mozaiek' then greatest(100,
      p_max_points
      - least(500, floor(p_seconds * 2)::integer)
      - least(350, greatest(0, p_attempts - 15) * 5)
      - least(300, greatest(0, p_starts - 1) * 100)
    )
    when p_game_id = 'vallende-stenen' then greatest(100,
      p_max_points
      - least(500, floor(p_seconds * 1.5)::integer)
      - least(250, greatest(0, p_attempts - 30) * 4)
    )
    else greatest(100,
      p_max_points
      - floor(p_seconds)::integer
      - greatest(0, p_attempts - 1) * 20
    )
  end
$$;

revoke all on function private.score_for(text, integer, integer, integer, integer, jsonb) from public;

create or replace function public.submit_score(
  p_game_id  text,
  p_seconds  integer,
  p_attempts integer,
  p_detail   jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid         uuid             := auth.uid();
  v_game        private.games;
  v_score       private.scores;
  v_score_value integer;
  v_inserted    boolean          := false;
  v_starts      integer          := 1;
begin
  if v_uid is null or not exists(select 1 from private.players where user_id = v_uid)
    then raise exception 'Sla eerst je naam op.'; end if;
  if p_seconds is null or p_seconds not between 0 and 86400
  or p_attempts is null or p_attempts not between 0 and 10000
  or p_detail is null or octet_length(p_detail::text) > 5120
    then raise exception 'Ongeldige scoregegevens.'; end if;

  select * into v_game from private.games where id = p_game_id;
  if not found or private.game_state(v_game) <> 'open'
    then raise exception 'Dit spel is niet vrijgegeven.'; end if;

  select greatest(1, count(*))
    into v_starts
    from private.game_starts
    where user_id = v_uid and game_id = p_game_id;

  v_score_value := private.score_for(p_game_id, v_game.max_points, p_seconds, p_attempts, v_starts, p_detail);

  insert into private.scores(user_id, player_name, game_id, score, seconds, attempts, detail)
    select user_id, name, p_game_id, v_score_value, p_seconds, p_attempts, p_detail
      from private.players where user_id = v_uid
    on conflict(user_id, game_id) do nothing
    returning * into v_score;
  v_inserted := found;
  if not v_inserted then
    select * into v_score from private.scores where user_id = v_uid and game_id = p_game_id;
  end if;

  delete from private.active_players where user_id = v_uid;

  return jsonb_build_object(
    'alreadySubmitted', not v_inserted,
    'result', jsonb_build_object(
      'gameId',   v_score.game_id,
      'title',    v_game.title,
      'score',    v_score.score,
      'seconds',  v_score.seconds,
      'attempts', v_score.attempts,
      'starts',   v_starts,
      'hint',     v_game.hint
    )
  );
end $$;

update private.scores s
set score = private.score_for(
  s.game_id,
  g.max_points,
  s.seconds,
  s.attempts,
  greatest(1, (
    select count(*)::integer
      from private.game_starts gs
      where gs.user_id = s.user_id
        and gs.game_id = s.game_id
  )),
  s.detail
)
from private.games g
where s.game_id = 'rebus'
  and g.id = s.game_id;
