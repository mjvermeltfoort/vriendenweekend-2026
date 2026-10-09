-- Fix dashboard team delete in a new migration.
-- Do not edit 019_public_team_dashboard.sql; this migration overrides delete behavior.

create or replace function public.dashboard_delete_team(
  p_team_id uuid,
  p_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  select name into team_name from city_game.teams where id = p_team_id for update;
  perform city_game.dashboard_audit(
    p_team_id,
    'team_deleted_from_dashboard',
    p_client_id,
    jsonb_build_object('teamName', team_name)
  );
  delete from city_game.teams where id = p_team_id;
end;
$$;

revoke all on function public.dashboard_delete_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dashboard_delete_team(uuid, uuid) to authenticated;
