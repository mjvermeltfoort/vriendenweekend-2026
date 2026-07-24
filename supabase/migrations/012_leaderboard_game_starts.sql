-- Add starts count per game to leaderboard gameDetails so the frontend can show
-- how many times each player started a game.
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
          'gameDetails', x.game_details
        )
        order by x.score desc, x.seconds asc, x.name asc
      )
      from (
        select
          min(s.player_name) as name,
          sum(s.score)::integer as score,
          count(*)::integer as games,
          sum(s.seconds)::integer as seconds,
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
          ) as game_details
        from private.scores s
        join private.games g on g.id = s.game_id
        group by s.user_id
        order by sum(s.score) desc, sum(s.seconds) asc, min(s.player_name) asc
        limit 50
      ) x
    ), '[]'::jsonb),
    'activePlayers', coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'gameId',a.game_id,'gameTitle',g.title,'startedAt',a.started_at) order by a.last_seen_at desc) from private.active_players a join private.players p on p.user_id=a.user_id join private.games g on g.id=a.game_id where a.last_seen_at >= now() - interval '30 seconds'), '[]'::jsonb)
  );
end $$;
