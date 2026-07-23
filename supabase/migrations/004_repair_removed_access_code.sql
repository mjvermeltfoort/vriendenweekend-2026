-- Herstelt projecten waarin een eerdere, inmiddels verwijderde
-- toegangscodeversie al gedeeltelijk is uitgevoerd.
create or replace function public.register_player(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text; v_normalized text; v_existing uuid;
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt. Probeer opnieuw.'; end if;
  v_name := btrim(regexp_replace(regexp_replace(coalesce(p_name,''), '[<>[:cntrl:]]', '', 'g'), '\\s+', ' ', 'g'));
  if char_length(v_name) not between 1 and 40 then raise exception 'Vul een naam van maximaal 40 tekens in.'; end if;
  v_normalized := lower(v_name);
  select user_id into v_existing from private.players where normalized_name = v_normalized for update;
  if v_existing is not null and v_existing <> v_uid then
    update private.players set user_id = v_uid, name = v_name, last_seen_at = now() where user_id = v_existing;
  elsif v_existing is null then
    insert into private.players (user_id, name, normalized_name) values (v_uid, v_name, v_normalized);
  else
    update private.players set name = v_name, last_seen_at = now() where user_id = v_uid;
  end if;
  return jsonb_build_object('playerName', v_name);
end $$;

create or replace function public.get_app_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt. Probeer opnieuw.'; end if;
  update private.players set last_seen_at = now() where user_id = v_uid;
  return jsonb_build_object(
    'games', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'description', g.description, 'status', g.status, 'state', private.game_state(g), 'openFrom', g.open_from, 'closeAt', g.close_at, 'hint', case when s.id is null then '' else g.hint end, 'maxPoints', g.max_points, 'order', g.display_order, 'completed', case when s.id is null then null else jsonb_build_object('gameId',s.game_id,'title',g.title,'score',s.score,'seconds',s.seconds,'attempts',s.attempts) end) order by g.display_order) from private.games g left join private.scores s on s.game_id=g.id and s.user_id=v_uid), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'score', x.score, 'games', x.games, 'seconds', x.seconds) order by x.score desc, x.seconds asc, x.name asc) from (select min(player_name) name, sum(score)::integer score, count(*)::integer games, sum(seconds)::integer seconds from private.scores group by user_id order by sum(score) desc, sum(seconds), min(player_name) limit 50) x), '[]'::jsonb),
    'activePlayers', coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'gameId',a.game_id,'gameTitle',g.title,'startedAt',a.started_at) order by a.last_seen_at desc) from private.active_players a join private.players p on p.user_id=a.user_id join private.games g on g.id=a.game_id where a.last_seen_at >= now() - interval '30 seconds'), '[]'::jsonb)
  );
end $$;

revoke all on function public.register_player(text) from public;
revoke all on function public.get_app_state() from public;
grant execute on function public.register_player(text), public.get_app_state() to authenticated;
