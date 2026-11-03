alter table city_game.teams
  add column starting_score integer not null default 0 check (starting_score >= 0);

create function city_game.starting_score_locked(p_team_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from city_game.teams where id = p_team_id and started_at is not null)
    or exists (
      select 1 from city_game.progress
      where team_id = p_team_id and (started_at is not null or state in ('started', 'completed'))
    );
$$;

revoke all on function city_game.starting_score_locked(uuid) from public, anon, authenticated;

alter function city_game.team_state_json(uuid, uuid) rename to team_state_without_starting_score;
create function city_game.team_state_json(p_team_id uuid, p_session_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_set(state.payload, '{team,startingScore}', to_jsonb(t.starting_score))
  from city_game.teams t
  cross join lateral (select city_game.team_state_without_starting_score(p_team_id, p_session_id) as payload) state
  where t.id = p_team_id;
$$;
revoke all on function city_game.team_state_json(uuid, uuid) from public, anon, authenticated;

alter function city_game.dashboard_team_json(uuid) rename to dashboard_team_without_starting_score;
create function city_game.dashboard_team_json(p_team_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select city_game.dashboard_team_without_starting_score(p_team_id)
    || jsonb_build_object('startingScore', t.starting_score, 'startingScoreLocked', city_game.starting_score_locked(t.id))
  from city_game.teams t where t.id = p_team_id;
$$;
revoke all on function city_game.dashboard_team_json(uuid) from public, anon, authenticated;

create function public.dashboard_update_team_with_score(
  p_team_id uuid, p_name text, p_client_id uuid, p_starting_score integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  previous_score integer;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_starting_score < 0 then
    raise exception 'INVALID_STARTING_SCORE';
  end if;

  select starting_score into previous_score from city_game.teams where id = p_team_id for update;
  if p_starting_score is not null and p_starting_score <> previous_score then
    if city_game.starting_score_locked(p_team_id) then
      raise exception 'STARTING_SCORE_LOCKED';
    end if;
    update city_game.teams set starting_score = p_starting_score, updated_at = now() where id = p_team_id;
    perform city_game.dashboard_audit(p_team_id, 'starting_score_updated_from_dashboard', p_client_id,
      jsonb_build_object('previousScore', previous_score, 'startingScore', p_starting_score));
  end if;

  return public.dashboard_update_team_name(p_team_id, p_name, p_client_id);
end;
$$;

create function public.dashboard_create_team_with_score(
  p_name text, p_join_code text, p_client_id uuid, p_starting_score integer
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  team_id uuid;
begin
  team_id := (public.dashboard_create_team(p_name, p_join_code, p_client_id)->>'id')::uuid;
  return public.dashboard_update_team_with_score(team_id, p_name, p_client_id, p_starting_score);
end;
$$;

revoke all on function public.dashboard_create_team_with_score(text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.dashboard_update_team_with_score(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.dashboard_create_team_with_score(text, text, uuid, integer) to authenticated;
grant execute on function public.dashboard_update_team_with_score(uuid, text, uuid, integer) to authenticated;

select city_game.refresh_dashboard_team(id)
from city_game.teams where game_slug = 'moerasdraak-den-bosch' and game_version = 1;
