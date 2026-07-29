-- City-game clients use only the public security-definer RPCs from migration 016.
-- Keep the underlying schema unavailable through direct Data API table access.

revoke all on all tables in schema city_game from anon, authenticated;
revoke usage on schema city_game from anon, authenticated;

revoke all on function city_game.set_updated_at() from public, anon, authenticated;
revoke all on function city_game.normalize_join_code(text) from public, anon, authenticated;
revoke all on function city_game.join_city_game_team(text) from public, anon, authenticated;
revoke all on function city_game.is_team_member(uuid) from public, anon, authenticated;

revoke all on function public.sync_city_game_state(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.join_city_game_team(text) from public, anon;

grant execute on function public.sync_city_game_state(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.join_city_game_team(text) to authenticated;

do $$
declare
  browser_role text;
  city_table regclass;
begin
  foreach browser_role in array array['anon', 'authenticated']
  loop
    if has_schema_privilege(browser_role, 'city_game', 'usage') then
      raise exception '% still has usage on schema city_game', browser_role;
    end if;

    for city_table in
      select c.oid::regclass
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'city_game'
        and c.relkind in ('r', 'p')
    loop
      if has_table_privilege(browser_role, city_table, 'select')
        or has_table_privilege(browser_role, city_table, 'insert')
        or has_table_privilege(browser_role, city_table, 'update')
        or has_table_privilege(browser_role, city_table, 'delete') then
        raise exception '% still has direct privileges on %', browser_role, city_table;
      end if;
    end loop;
  end loop;

  if has_function_privilege('anon', 'public.sync_city_game_state(jsonb,jsonb,jsonb)', 'execute')
    or has_function_privilege('anon', 'public.join_city_game_team(text)', 'execute') then
    raise exception 'anon can still execute a city-game public RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.sync_city_game_state(jsonb,jsonb,jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.join_city_game_team(text)', 'execute') then
    raise exception 'authenticated is missing execute on a city-game public RPC';
  end if;
end;
$$;
