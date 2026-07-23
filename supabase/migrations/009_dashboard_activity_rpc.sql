create or replace function public.get_dashboard_activity()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Je sessie ontbreekt. Probeer opnieuw.';
  end if;

  return jsonb_build_object(
    'games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'title', g.title,
          'status', g.status,
          'openFrom', g.open_from,
          'displayOrder', g.display_order
        )
        order by g.open_from nulls last, g.display_order
      )
      from private.games g
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', p.user_id,
          'name', p.name,
          'normalizedName', p.normalized_name,
          'createdAt', p.created_at,
          'lastSeenAt', p.last_seen_at
        )
        order by p.created_at
      )
      from private.players p
    ), '[]'::jsonb),
    'starts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', gs.user_id,
          'playerName', gs.player_name,
          'gameId', gs.game_id,
          'status', gs.status,
          'startedAt', gs.started_at
        )
        order by gs.started_at desc
      )
      from private.game_starts gs
    ), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', s.user_id,
          'playerName', s.player_name,
          'gameId', s.game_id,
          'score', s.score,
          'seconds', s.seconds,
          'attempts', s.attempts,
          'createdAt', s.created_at
        )
        order by s.created_at desc
      )
      from private.scores s
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.get_dashboard_activity() from public;
grant execute on function public.get_dashboard_activity() to authenticated;
