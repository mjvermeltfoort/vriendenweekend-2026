-- Public realtime operations dashboard for Moerasdraak v1.
-- Anonymous Auth users intentionally receive the `authenticated` role. The
-- projection and RPCs below are therefore public to anyone who knows the URL.

alter table city_game.teams
add column if not exists join_code text;

create or replace function city_game.generate_dashboard_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text := '';
  index integer;
begin
  for index in 1..6 loop
    candidate := candidate || substr(
      alphabet,
      1 + floor(random() * length(alphabet))::integer,
      1
    );
  end loop;
  return candidate;
end;
$$;

create or replace function city_game.hash_dashboard_join_code(p_code text)
returns text
language sql
volatile
set search_path = pg_catalog, extensions, public
as $$
  select crypt(p_code, gen_salt('bf'))
$$;

do $$
declare
  team_row record;
  candidate text;
begin
  for team_row in
    select id, game_slug
    from city_game.teams
    where join_code is null
    for update
  loop
    loop
      candidate := city_game.generate_dashboard_join_code();
      exit when not exists (
        select 1 from city_game.teams where join_code = candidate
      );
    end loop;

    update city_game.teams
    set join_code = candidate,
        code_hash = city_game.hash_dashboard_join_code(candidate)
    where id = team_row.id;

    if team_row.game_slug = 'moerasdraak-den-bosch' then
      insert into city_game.events (
        team_id, game_slug, event_type, event_data
      )
      values (
        team_row.id,
        team_row.game_slug,
        'team_code_rotated_by_migration',
        jsonb_build_object('migration', '019')
      );
    end if;
  end loop;
end;
$$;

alter table city_game.teams
alter column join_code set not null;

alter table city_game.teams
drop constraint if exists teams_join_code_format_check;
alter table city_game.teams
add constraint teams_join_code_format_check
check (join_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$');

create unique index if not exists teams_join_code_unique_idx
on city_game.teams (join_code);

create table if not exists public.dashboard_team_projection (
  team_id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_team_projection enable row level security;

drop policy if exists dashboard_projection_authenticated_read
on public.dashboard_team_projection;
create policy dashboard_projection_authenticated_read
on public.dashboard_team_projection
for select
to authenticated
using (true);

revoke all on public.dashboard_team_projection from public, anon;
grant select on public.dashboard_team_projection to authenticated;

create or replace function city_game.dashboard_team_json(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  team_row city_game.teams%rowtype;
  current_location city_game.team_current_location%rowtype;
  active_run city_game.team_game_runs%rowtype;
  current_stop_index integer;
  next_stop_id text;
  stop_progress jsonb;
  participants jsonb;
begin
  select * into team_row
  from city_game.teams
  where id = p_team_id
    and game_slug = 'moerasdraak-den-bosch'
    and game_version = 1;
  if not found then
    return null;
  end if;

  select stop_order into current_stop_index
  from city_game.game_stops
  where game_slug = team_row.game_slug
    and game_version = team_row.game_version
    and stop_id = team_row.current_stop_id;

  select stop_id into next_stop_id
  from city_game.game_stops
  where game_slug = team_row.game_slug
    and game_version = team_row.game_version
    and stop_order > coalesce(current_stop_index, 0)
  order by stop_order
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'stopId', progress.stop_id,
        'state', progress.state,
        'attempts', progress.attempts,
        'hintsUsed', progress.hints_used,
        'scoreAwarded', progress.score_awarded,
        'arrivedAt', progress.arrived_at,
        'startedAt', progress.started_at,
        'completedAt', progress.completed_at
      ))
      order by stop.stop_order
    ),
    '[]'::jsonb
  ) into stop_progress
  from city_game.progress progress
  join city_game.game_stops stop
    on stop.game_slug = team_row.game_slug
   and stop.game_version = team_row.game_version
   and stop.stop_id = progress.stop_id
  where progress.team_id = team_row.id;

  select * into active_run
  from city_game.team_game_runs run
  where run.team_id = team_row.id
    and run.status = 'active'
  limit 1;

  select * into current_location
  from city_game.team_current_location location
  where location.team_id = team_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'sessionId', session.id,
        'joinedAt', session.joined_at,
        'lastSeenAt', session.last_seen_at,
        'deviceLabel', case
          when session.user_agent ~* 'iPhone|iPad' then 'iPhone/iPad'
          when session.user_agent ~* 'Android' then 'Android'
          when session.user_agent ~* 'Windows' then 'Windows'
          when session.user_agent ~* 'Macintosh' then 'Mac'
          else 'Apparaat'
        end,
        'browserLabel', case
          when session.user_agent ~* 'Edg/' then 'Edge'
          when session.user_agent ~* 'Firefox/' then 'Firefox'
          when session.user_agent ~* 'Chrome/' then 'Chrome'
          when session.user_agent ~* 'Safari/' then 'Safari'
          else 'Browser'
        end,
        'locationAccuracyM', location.accuracy_m,
        'locationCapturedAt', location.captured_at,
        'isLocationSource', session.id = current_location.source_session_id
      ))
      order by session.joined_at, session.id
    ),
    '[]'::jsonb
  ) into participants
  from city_game.team_sessions session
  left join city_game.team_session_locations location
    on location.session_id = session.id
  where session.team_id = team_row.id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    );

  return jsonb_strip_nulls(jsonb_build_object(
    'id', team_row.id,
    'name', team_row.name,
    'code', team_row.join_code,
    'status', team_row.status,
    'score', team_row.score,
    'currentStopIndex', current_stop_index,
    'currentStopId', team_row.current_stop_id,
    'currentStepId', team_row.current_step_id,
    'nextStopId', next_stop_id,
    'progressVersion', team_row.version,
    'createdAt', team_row.created_at,
    'updatedAt', team_row.updated_at,
    'lastSeenAt', (
      select max(session.last_seen_at)
      from city_game.team_sessions session
      where session.team_id = team_row.id
    ),
    'startedAt', team_row.started_at,
    'completedAt', team_row.completed_at,
    'stopProgress', stop_progress,
    'activeGame', case when active_run.id is null then null else
      jsonb_build_object(
        'runId', active_run.id,
        'gameId', active_run.game_id,
        'state', active_run.state,
        'startedAt', active_run.started_at,
        'updatedAt', active_run.updated_at,
        'version', active_run.version
      )
    end,
    'location', case when current_location.team_id is null then null else
      jsonb_build_object(
        'latitude', current_location.latitude,
        'longitude', current_location.longitude,
        'accuracyM', current_location.accuracy_m,
        'capturedAt', current_location.captured_at,
        'selectedAt', current_location.selected_at,
        'sourceSessionId', current_location.source_session_id
      )
    end,
    'participants', participants
  ));
end;
$$;

create or replace function city_game.refresh_dashboard_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  projection jsonb;
begin
  projection := city_game.dashboard_team_json(p_team_id);
  if projection is null then
    delete from public.dashboard_team_projection where team_id = p_team_id;
  else
    insert into public.dashboard_team_projection (team_id, payload, updated_at)
    values (p_team_id, projection, now())
    on conflict (team_id) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;
  end if;
end;
$$;

create or replace function city_game.refresh_dashboard_team_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform city_game.refresh_dashboard_team(
    case when tg_op = 'DELETE' then old.team_id else new.team_id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function city_game.refresh_dashboard_from_team_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform city_game.refresh_dashboard_team(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists dashboard_projection_teams on city_game.teams;
create trigger dashboard_projection_teams
after insert or update or delete on city_game.teams
for each row execute function city_game.refresh_dashboard_from_team_trigger();

drop trigger if exists dashboard_projection_progress on city_game.progress;
create trigger dashboard_projection_progress
after insert or update or delete on city_game.progress
for each row execute function city_game.refresh_dashboard_team_trigger();

drop trigger if exists dashboard_projection_sessions on city_game.team_sessions;
create trigger dashboard_projection_sessions
after insert or update or delete on city_game.team_sessions
for each row execute function city_game.refresh_dashboard_team_trigger();

drop trigger if exists dashboard_projection_session_locations
on city_game.team_session_locations;
create trigger dashboard_projection_session_locations
after insert or update or delete on city_game.team_session_locations
for each row execute function city_game.refresh_dashboard_team_trigger();

drop trigger if exists dashboard_projection_current_location
on city_game.team_current_location;
create trigger dashboard_projection_current_location
after insert or update or delete on city_game.team_current_location
for each row execute function city_game.refresh_dashboard_team_trigger();

drop trigger if exists dashboard_projection_game_runs
on city_game.team_game_runs;
create trigger dashboard_projection_game_runs
after insert or update or delete on city_game.team_game_runs
for each row execute function city_game.refresh_dashboard_team_trigger();

select city_game.refresh_dashboard_team(id)
from city_game.teams
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1;

create or replace function public.get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  generated_at timestamptz := now();
  teams jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  perform city_game.refresh_dashboard_team(team.id)
  from city_game.teams team
  where team.game_slug = 'moerasdraak-den-bosch'
    and team.game_version = 1;

  select coalesce(jsonb_agg(payload order by payload->>'name'), '[]'::jsonb)
  into teams
  from public.dashboard_team_projection;

  return jsonb_build_object(
    'generatedAt', generated_at,
    'serverNow', now(),
    'teams', teams
  );
end;
$$;

create or replace function city_game.dashboard_audit(
  p_team_id uuid,
  p_event_type text,
  p_client_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  insert into city_game.events (
    team_id, game_slug, event_type, event_data
  )
  values (
    p_team_id,
    'moerasdraak-den-bosch',
    p_event_type,
    jsonb_build_object('dashboardClientId', p_client_id) || coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function city_game.assert_dashboard_team(p_team_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from city_game.teams
    where id = p_team_id
      and game_slug = 'moerasdraak-den-bosch'
      and game_version = 1
  ) then
    raise exception using errcode = 'P0001', message = 'TEAM_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.dashboard_create_team(
  p_name text,
  p_join_code text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_id uuid;
  normalized_code text := city_game.normalize_join_code(p_join_code);
  first_stop text;
  attempts integer := 0;
begin
  if auth.uid() is null or p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception using errcode = 'P0001', message = 'INVALID_TEAM_NAME';
  end if;
  if normalized_code <> '' and normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_TEAM_CODE';
  end if;

  loop
    if normalized_code = '' then
      normalized_code := city_game.generate_dashboard_join_code();
    end if;
    begin
      select stop_id into first_stop
      from city_game.game_stops
      where game_slug = 'moerasdraak-den-bosch' and game_version = 1
      order by stop_order limit 1;

      insert into city_game.teams (
        game_slug, game_version, name, join_code, code_hash,
        owner_user_id, status, current_stop_id, current_step_id
      )
      values (
        'moerasdraak-den-bosch', 1, trim(p_name), normalized_code,
        city_game.hash_dashboard_join_code(normalized_code), auth.uid(), 'active',
        first_stop, 'available'
      )
      returning id into team_id;
      exit;
    exception when unique_violation then
      if p_join_code is not null and city_game.normalize_join_code(p_join_code) <> '' then
        raise exception using errcode = 'P0001', message = 'TEAM_CODE_IN_USE';
      end if;
      normalized_code := '';
      attempts := attempts + 1;
      if attempts >= 20 then
        raise exception using errcode = 'P0001', message = 'TEAM_CODE_GENERATION_FAILED';
      end if;
    end;
  end loop;

  insert into city_game.progress (team_id, stop_id, state)
  select team_id, stop_id, case when stop_order = 1 then 'available' else 'locked' end
  from city_game.game_stops
  where game_slug = 'moerasdraak-den-bosch' and game_version = 1;

  perform city_game.dashboard_audit(
    team_id, 'team_created_from_dashboard', p_client_id
  );
  perform city_game.refresh_dashboard_team(team_id);
  return city_game.dashboard_team_json(team_id);
end;
$$;

create or replace function public.dashboard_update_team_name(
  p_team_id uuid,
  p_name text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_name text;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null or length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception using errcode = 'P0001', message = 'INVALID_TEAM_NAME';
  end if;
  select name into previous_name from city_game.teams where id = p_team_id for update;
  update city_game.teams set name = trim(p_name) where id = p_team_id;
  perform city_game.dashboard_audit(
    p_team_id, 'team_renamed_from_dashboard', p_client_id,
    jsonb_build_object('previousName', previous_name)
  );
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

create or replace function public.dashboard_rotate_team_code(
  p_team_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  perform 1 from city_game.teams where id = p_team_id for update;
  loop
    candidate := city_game.generate_dashboard_join_code();
    exit when not exists (select 1 from city_game.teams where join_code = candidate);
  end loop;
  update city_game.teams
  set join_code = candidate,
      code_hash = city_game.hash_dashboard_join_code(candidate)
  where id = p_team_id;
  perform city_game.dashboard_audit(
    p_team_id, 'team_code_rotated_from_dashboard', p_client_id
  );
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

create or replace function public.dashboard_set_team_status(
  p_team_id uuid,
  p_status text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null or p_status not in ('active', 'disabled') then
    raise exception using errcode = 'P0001', message = 'INVALID_TEAM_STATUS';
  end if;
  select status into current_status from city_game.teams where id = p_team_id for update;
  if current_status = 'completed' then
    raise exception using errcode = 'P0001', message = 'COMPLETED_TEAM_STATUS_LOCKED';
  end if;
  update city_game.teams set status = p_status where id = p_team_id;
  if p_status = 'disabled' then
    update city_game.team_sessions
    set revoked_at = now()
    where team_id = p_team_id and revoked_at is null;
    delete from city_game.team_session_locations where team_id = p_team_id;
  end if;
  perform city_game.dashboard_audit(
    p_team_id,
    case when p_status = 'disabled'
      then 'team_disabled_from_dashboard'
      else 'team_enabled_from_dashboard'
    end,
    p_client_id
  );
  perform city_game.refresh_dashboard_team(p_team_id);
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

create or replace function public.dashboard_reset_team_progress(
  p_team_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_stop text;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  perform 1 from city_game.teams where id = p_team_id for update;
  update city_game.team_game_runs
  set status = 'abandoned', updated_at = now(), version = version + 1
  where team_id = p_team_id and status = 'active';
  delete from city_game.progress where team_id = p_team_id;
  select stop_id into first_stop
  from city_game.game_stops
  where game_slug = 'moerasdraak-den-bosch' and game_version = 1
  order by stop_order limit 1;
  insert into city_game.progress (team_id, stop_id, state)
  select p_team_id, stop_id, case when stop_order = 1 then 'available' else 'locked' end
  from city_game.game_stops
  where game_slug = 'moerasdraak-den-bosch' and game_version = 1;
  update city_game.teams
  set status = 'active',
      score = 0,
      started_at = null,
      completed_at = null,
      current_stop_id = first_stop,
      current_step_id = 'available',
      version = version + 1
  where id = p_team_id;
  perform city_game.dashboard_audit(
    p_team_id, 'team_progress_reset_from_dashboard', p_client_id
  );
  perform city_game.refresh_dashboard_team(p_team_id);
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

create or replace function public.dashboard_abandon_active_game(
  p_team_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  perform 1 from city_game.teams where id = p_team_id for update;
  update city_game.team_game_runs
  set status = 'abandoned', updated_at = now(), version = version + 1
  where team_id = p_team_id and status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_GAME';
  end if;
  perform city_game.dashboard_audit(
    p_team_id, 'game_abandoned_from_dashboard', p_client_id
  );
  perform city_game.refresh_dashboard_team(p_team_id);
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

create or replace function public.dashboard_revoke_team_session(
  p_team_id uuid,
  p_session_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  update city_game.team_sessions
  set revoked_at = now()
  where id = p_session_id
    and team_id = p_team_id
    and revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;
  delete from city_game.team_session_locations where session_id = p_session_id;
  perform city_game.dashboard_audit(
    p_team_id, 'session_revoked_from_dashboard', p_client_id
  );
  perform city_game.refresh_dashboard_team(p_team_id);
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

revoke all on function public.get_dashboard_snapshot() from public, anon, authenticated;
revoke all on function public.dashboard_create_team(text, text, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_update_team_name(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_rotate_team_code(uuid, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_set_team_status(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_reset_team_progress(uuid, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_abandon_active_game(uuid, uuid) from public, anon, authenticated;
revoke all on function public.dashboard_revoke_team_session(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_dashboard_snapshot() to authenticated;
grant execute on function public.dashboard_create_team(text, text, uuid) to authenticated;
grant execute on function public.dashboard_update_team_name(uuid, text, uuid) to authenticated;
grant execute on function public.dashboard_rotate_team_code(uuid, uuid) to authenticated;
grant execute on function public.dashboard_set_team_status(uuid, text, uuid) to authenticated;
grant execute on function public.dashboard_reset_team_progress(uuid, uuid) to authenticated;
grant execute on function public.dashboard_abandon_active_game(uuid, uuid) to authenticated;
grant execute on function public.dashboard_revoke_team_session(uuid, uuid, uuid) to authenticated;

revoke all on function city_game.generate_dashboard_join_code() from public, anon, authenticated;
revoke all on function city_game.hash_dashboard_join_code(text) from public, anon, authenticated;
revoke all on function city_game.dashboard_team_json(uuid) from public, anon, authenticated;
revoke all on function city_game.refresh_dashboard_team(uuid) from public, anon, authenticated;
revoke all on function city_game.refresh_dashboard_team_trigger() from public, anon, authenticated;
revoke all on function city_game.refresh_dashboard_from_team_trigger() from public, anon, authenticated;
revoke all on function city_game.dashboard_audit(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function city_game.assert_dashboard_team(uuid) from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'progress'
  ) then
    alter publication supabase_realtime drop table city_game.progress;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'team_current_location'
  ) then
    alter publication supabase_realtime drop table city_game.team_current_location;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'team_game_runs'
  ) then
    alter publication supabase_realtime drop table city_game.team_game_runs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dashboard_team_projection'
  ) then
    alter publication supabase_realtime add table public.dashboard_team_projection;
  end if;
end;
$$;
