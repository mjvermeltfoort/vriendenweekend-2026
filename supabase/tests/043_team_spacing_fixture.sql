-- Run after the existing isolated 042 fixture + migration, in an empty test DB.
alter table city_game.teams add column started_at timestamptz;
create function city_game.assert_dashboard_team(uuid) returns void language plpgsql as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from city_game.teams where id=$1) then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;
create function city_game.dashboard_audit(uuid,text,uuid,jsonb) returns void language sql as $$ select $$;
create function public.start_or_resume_team_game(uuid,text) returns jsonb language sql as $$ select '{"ok":true}'::jsonb $$;
