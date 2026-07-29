-- Team-code sessions, shared GPS, optimistic concurrency and realtime game runs.

alter table city_game.teams add column if not exists code_hash text;

update city_game.teams
set code_hash = crypt(city_game.normalize_join_code(join_code), gen_salt('bf'))
where code_hash is null
  and join_code is not null;

alter table city_game.teams alter column code_hash set not null;
alter table city_game.teams add column if not exists current_stop_id text;
alter table city_game.teams add column if not exists current_step_id text;
alter table city_game.teams add column if not exists version bigint not null default 1;

alter table city_game.teams drop constraint if exists teams_status_check;
alter table city_game.teams add constraint teams_status_check
check (status in ('active', 'completed', 'disabled'));
alter table city_game.progress drop constraint if exists progress_state_check;
alter table city_game.progress add constraint progress_state_check
check (state in ('locked', 'available', 'arrived', 'started', 'completed'));

drop index if exists city_game.teams_join_code_idx;
alter table city_game.teams drop constraint if exists teams_join_code_key;
alter table city_game.teams drop column if exists join_code;

create table if not exists city_game.game_stops (
  game_slug text not null,
  game_version integer not null,
  stop_id text not null,
  stop_order integer not null check (stop_order > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m double precision not null check (radius_m > 0),
  maximum_accuracy_m double precision not null check (maximum_accuracy_m > 0),
  is_final boolean not null default false,
  answer_spec jsonb not null default '{}'::jsonb,
  hint_ids jsonb not null default '[]'::jsonb,
  primary key (game_slug, game_version, stop_id),
  unique (game_slug, game_version, stop_order)
);

alter table city_game.game_stops
add column if not exists hint_ids jsonb not null default '[]'::jsonb;

insert into city_game.game_stops (
  game_slug, game_version, stop_id, stop_order, latitude, longitude,
  radius_m, maximum_accuracy_m, is_final, answer_spec
)
values
  ('moerasdraak-den-bosch', 1, 'drakenfontein', 1, 51.690506, 5.296208, 50, 100, false, '{"kind":"choice","answer":"a"}'),
  ('moerasdraak-den-bosch', 1, 'zoete-lieve-gerritje', 2, 51.689817, 5.299926, 55, 110, false, '{"kind":"choice","answer":"b"}'),
  ('moerasdraak-den-bosch', 1, 'binnendieze', 3, 51.689641, 5.305190, 60, 120, false, '{"kind":"reorder","answer":["Bron","Kanaal","Sluis","Stad"]}'),
  ('moerasdraak-den-bosch', 1, 'bosch-wezen', 4, 51.688968, 5.304617, 55, 110, false, '{"kind":"composite","answer":{"head":"Horn","body":"Schubben","object":"Lantaarn"}}'),
  ('moerasdraak-den-bosch', 1, 'sint-jan', 5, 51.687992, 5.308464, 75, 120, false, '{"kind":"code","answers":["3142"]}'),
  ('moerasdraak-den-bosch', 1, 'kruithuis', 6, 51.693656, 5.305112, 65, 120, false, '{"kind":"choice","answer":"a"}'),
  ('moerasdraak-den-bosch', 1, 'bossche-brouwers', 7, 51.696900, 5.299290, 75, 120, true, '{"kind":"reorder","answer":["Schroten","Maischen","Filteren","Koken","Koelen","Gisten"]}')
on conflict (game_slug, game_version, stop_id) do update
set stop_order = excluded.stop_order,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    radius_m = excluded.radius_m,
    maximum_accuracy_m = excluded.maximum_accuracy_m,
    is_final = excluded.is_final,
    answer_spec = excluded.answer_spec;

update city_game.game_stops
set hint_ids = '["h1"]'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1;

update city_game.teams team
set current_stop_id = coalesce(
  nullif(team.metadata->'progress'->>'currentStopId', ''),
  (
    select stop.stop_id
    from city_game.game_stops stop
    where stop.game_slug = team.game_slug
      and stop.game_version = team.game_version
    order by stop.stop_order
    limit 1
  )
)
where current_stop_id is null;

create table if not exists city_game.team_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  auth_user_id uuid not null,
  device_id uuid not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text,
  unique (team_id, auth_user_id, device_id)
);

alter table city_game.team_sessions
add constraint team_sessions_id_team_key unique (id, team_id);

create index if not exists team_sessions_team_seen_idx
on city_game.team_sessions (team_id, last_seen_at desc)
where revoked_at is null;

create index if not exists team_sessions_user_idx
on city_game.team_sessions (auth_user_id, team_id)
where revoked_at is null;

alter table city_game.teams add column if not exists updated_by_session_id uuid
references city_game.team_sessions(id) on delete set null;

alter table city_game.events add column if not exists session_id uuid
references city_game.team_sessions(id) on delete set null;
alter table city_game.events
add constraint events_session_team_fkey
foreign key (session_id, team_id)
references city_game.team_sessions(id, team_id);
alter table city_game.events alter column event_id set default gen_random_uuid();
alter table city_game.events alter column occurred_at set default now();

create table if not exists city_game.team_session_locations (
  session_id uuid primary key references city_game.team_sessions(id) on delete cascade,
  team_id uuid not null references city_game.teams(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m > 0 and accuracy_m <= 10000),
  altitude_m double precision,
  heading_deg double precision check (heading_deg is null or heading_deg between 0 and 360),
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  captured_at timestamptz not null,
  received_at timestamptz not null default now()
);

alter table city_game.team_session_locations
add constraint team_session_locations_session_team_fkey
foreign key (session_id, team_id)
references city_game.team_sessions(id, team_id)
on delete cascade;

create index if not exists team_session_locations_team_fresh_idx
on city_game.team_session_locations (team_id, captured_at desc, accuracy_m);

create table if not exists city_game.team_current_location (
  team_id uuid primary key references city_game.teams(id) on delete cascade,
  source_session_id uuid not null references city_game.team_sessions(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m > 0 and accuracy_m <= 10000),
  captured_at timestamptz not null,
  selected_at timestamptz not null default now()
);

alter table city_game.team_current_location
add constraint team_current_location_source_team_fkey
foreign key (source_session_id, team_id)
references city_game.team_sessions(id, team_id)
on delete cascade;

create table if not exists city_game.team_game_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  game_id text not null,
  status text not null check (status in ('active', 'completed', 'abandoned')),
  state jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  started_by_session_id uuid not null references city_game.team_sessions(id),
  version bigint not null default 1 check (version > 0)
);

alter table city_game.team_game_runs
add constraint team_game_runs_starter_team_fkey
foreign key (started_by_session_id, team_id)
references city_game.team_sessions(id, team_id);

create unique index if not exists one_active_game_per_team
on city_game.team_game_runs (team_id)
where status = 'active';

create index if not exists team_game_runs_team_updated_idx
on city_game.team_game_runs (team_id, updated_at desc);

create or replace function city_game.active_session_timeout_seconds()
returns integer language sql immutable set search_path = ''
as $$ select 60 $$;

create or replace function city_game.location_freshness_seconds()
returns integer language sql immutable set search_path = ''
as $$ select 30 $$;

create or replace function city_game.location_retention_hours()
returns integer language sql immutable set search_path = ''
as $$ select 24 $$;

create or replace function city_game.has_team_session(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from city_game.team_sessions session
    where session.team_id = p_team_id
      and session.auth_user_id = auth.uid()
      and session.revoked_at is null
      and session.last_seen_at > now() - make_interval(
        secs => city_game.active_session_timeout_seconds()
      )
  );
$$;

create or replace function city_game.distance_m(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(p_latitude_b - p_latitude_a) / 2), 2)
      + cos(radians(p_latitude_a)) * cos(radians(p_latitude_b))
      * power(sin(radians(p_longitude_b - p_longitude_a) / 2), 2)
    )
  );
$$;

create or replace function city_game.game_run_json(p_run city_game.team_game_runs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_run.id,
    'teamId', p_run.team_id,
    'gameId', p_run.game_id,
    'status', p_run.status,
    'state', p_run.state,
    'result', p_run.result,
    'version', p_run.version,
    'startedAt', p_run.started_at,
    'updatedAt', p_run.updated_at,
    'completedAt', p_run.completed_at
  ));
$$;

create or replace function city_game.team_state_json(
  p_team_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  team_row city_game.teams%rowtype;
  active_run city_game.team_game_runs%rowtype;
  current_location city_game.team_current_location%rowtype;
  stop_progress jsonb;
  active_count integer;
  location_current boolean := false;
begin
  select * into team_row
  from city_game.teams
  where id = p_team_id;

  select coalesce(
    jsonb_object_agg(
      progress.stop_id,
      jsonb_strip_nulls(jsonb_build_object(
        'state', progress.state,
        'attempts', progress.attempts,
        'hintsUsed', progress.hints_used,
        'scoreAwarded', progress.score_awarded,
        'answerData', progress.answer_data,
        'unlockMethod', progress.unlock_method,
        'arrivedAt', progress.arrived_at,
        'startedAt', progress.started_at,
        'completedAt', progress.completed_at
      ))
    ),
    '{}'::jsonb
  )
  into stop_progress
  from city_game.progress progress
  where progress.team_id = p_team_id;

  select * into active_run
  from city_game.team_game_runs run
  where run.team_id = p_team_id and run.status = 'active'
  limit 1;

  select * into current_location
  from city_game.team_current_location location
  where location.team_id = p_team_id;

  if found then
    location_current := current_location.captured_at > now() - make_interval(
      secs => city_game.location_freshness_seconds()
    ) and exists (
      select 1
      from city_game.team_sessions session
      where session.id = current_location.source_session_id
        and session.revoked_at is null
        and session.last_seen_at > now() - make_interval(
          secs => city_game.active_session_timeout_seconds()
        )
    );
  end if;

  select count(*)::integer into active_count
  from city_game.team_sessions session
  where session.team_id = p_team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    );

  return jsonb_build_object(
    'team', jsonb_build_object(
      'id', team_row.id,
      'gameSlug', team_row.game_slug,
      'gameVersion', team_row.game_version,
      'name', team_row.name,
      'status', team_row.status,
      'score', team_row.score,
      'createdAt', team_row.created_at,
      'updatedAt', team_row.updated_at
    ),
    'progress', jsonb_build_object(
      'teamId', team_row.id,
      'gameSlug', team_row.game_slug,
      'gameVersion', team_row.game_version,
      'currentStopId', team_row.current_stop_id,
      'currentStepId', team_row.current_step_id,
      'version', team_row.version,
      'totalScore', team_row.score,
      'finalized', team_row.status = 'completed',
      'stopProgress', stop_progress
    ),
    'activeGame', case when active_run.id is null then null
      else city_game.game_run_json(active_run) end,
    'currentLocation', case when current_location.team_id is null then null
      else jsonb_build_object(
        'teamId', current_location.team_id,
        'sourceSessionId', current_location.source_session_id,
        'latitude', current_location.latitude,
        'longitude', current_location.longitude,
        'accuracyM', current_location.accuracy_m,
        'capturedAt', current_location.captured_at,
        'selectedAt', current_location.selected_at
      ) end,
    'locationStatus', case when location_current then 'current' else 'stale' end,
    'activeSessionCount', active_count,
    'sessionStateAt', now(),
    'sessionId', p_session_id
  );
end;
$$;

drop function if exists city_game.join_city_game_team(text);
drop function if exists public.join_city_game_team(text);
drop function if exists public.sync_city_game_state(jsonb, jsonb, jsonb);

create or replace function public.join_team_by_code(
  p_normalized_code text,
  p_device_id uuid,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := city_game.normalize_join_code(p_normalized_code);
  team_row city_game.teams%rowtype;
  session_row city_game.team_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_device_id is null or normalized_code = '' or length(normalized_code) > 32 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_TEAM_CODE'));
  end if;

  select * into team_row
  from city_game.teams team
  where team.status = 'active'
    and crypt(normalized_code, team.code_hash) = team.code_hash
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_TEAM_CODE'));
  end if;

  update city_game.team_sessions session
  set revoked_at = now()
  where session.auth_user_id = current_user_id
    and session.device_id = p_device_id
    and session.team_id <> team_row.id
    and session.revoked_at is null;

  insert into city_game.team_sessions (
    team_id, auth_user_id, device_id, user_agent
  )
  values (
    team_row.id, current_user_id, p_device_id, left(p_user_agent, 512)
  )
  on conflict (team_id, auth_user_id, device_id) do update
  set last_seen_at = now(),
      revoked_at = null,
      user_agent = excluded.user_agent
  returning * into session_row;

  insert into city_game.team_members (team_id, user_id, role)
  values (team_row.id, current_user_id, 'member')
  on conflict (team_id, user_id) do update
  set joined_at = now();

  insert into city_game.progress (team_id, stop_id, state)
  select
    team_row.id,
    stop.stop_id,
    case when stop.stop_order = 1 then 'available' else 'locked' end
  from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug
    and stop.game_version = team_row.game_version
  on conflict (team_id, stop_id) do nothing;

  update city_game.teams
  set current_stop_id = coalesce(
    current_stop_id,
    (
      select stop.stop_id
      from city_game.game_stops stop
      where stop.game_slug = team_row.game_slug
        and stop.game_version = team_row.game_version
      order by stop.stop_order
      limit 1
    )
  )
  where id = team_row.id;

  insert into city_game.events (
    team_id, session_id, game_slug, event_type, event_data
  )
  values (
    team_row.id, session_row.id, team_row.game_slug, 'session_joined',
    jsonb_build_object('deviceId', p_device_id)
  );

  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', session_row.id,
      'teamId', session_row.team_id,
      'deviceId', session_row.device_id,
      'joinedAt', session_row.joined_at,
      'lastSeenAt', session_row.last_seen_at
    ),
    'state', city_game.team_state_json(team_row.id, session_row.id)
  );
end;
$$;

create or replace function public.heartbeat_team_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  active_count integer;
begin
  update city_game.team_sessions session
  set last_seen_at = now()
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null
  returning * into session_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select count(*)::integer into active_count
  from city_game.team_sessions session
  where session.team_id = session_row.team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    );

  return jsonb_build_object(
    'ok', true,
    'sessionId', session_row.id,
    'lastSeenAt', session_row.last_seen_at,
    'activeSessionCount', active_count
  );
end;
$$;

create or replace function public.update_team_location(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_altitude_m double precision default null,
  p_heading_deg double precision default null,
  p_speed_mps double precision default null,
  p_captured_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  best_location record;
  previous_source uuid;
begin
  if p_latitude is null
    or p_longitude is null
    or p_accuracy_m is null
    or p_captured_at is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or p_accuracy_m <= 0 or p_accuracy_m > 10000
    or p_captured_at > now() + interval '1 minute'
    or (p_heading_deg is not null and p_heading_deg not between 0 and 360)
    or (p_speed_mps is not null and p_speed_mps < 0) then
    raise exception using errcode = 'P0001', message = 'INVALID_LOCATION';
  end if;

  update city_game.team_sessions session
  set last_seen_at = now()
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null
  returning * into session_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  -- Serialize the upsert + winner selection for this team. Without this lock,
  -- the last transaction to write could replace a concurrently selected,
  -- more accurate measurement.
  perform 1
  from city_game.teams team
  where team.id = session_row.team_id
  for update;

  insert into city_game.team_session_locations (
    session_id, team_id, latitude, longitude, accuracy_m, altitude_m,
    heading_deg, speed_mps, captured_at, received_at
  )
  values (
    session_row.id, session_row.team_id, p_latitude, p_longitude,
    p_accuracy_m, p_altitude_m, p_heading_deg, p_speed_mps,
    p_captured_at, now()
  )
  on conflict (session_id) do update
  set team_id = excluded.team_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      altitude_m = excluded.altitude_m,
      heading_deg = excluded.heading_deg,
      speed_mps = excluded.speed_mps,
      captured_at = excluded.captured_at,
      received_at = excluded.received_at;

  delete from city_game.team_session_locations location
  where location.received_at < now() - make_interval(
    hours => city_game.location_retention_hours()
  );

  select source_session_id into previous_source
  from city_game.team_current_location
  where team_id = session_row.team_id;

  select
    location.session_id,
    location.latitude,
    location.longitude,
    location.accuracy_m,
    location.captured_at
  into best_location
  from city_game.team_session_locations location
  join city_game.team_sessions session on session.id = location.session_id
  where location.team_id = session_row.team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    )
    and location.captured_at > now() - make_interval(
      secs => city_game.location_freshness_seconds()
    )
  order by location.accuracy_m asc, location.captured_at desc, location.received_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'currentLocation', null, 'locationStatus', 'stale');
  end if;

  insert into city_game.team_current_location (
    team_id, source_session_id, latitude, longitude, accuracy_m, captured_at, selected_at
  )
  values (
    session_row.team_id, best_location.session_id, best_location.latitude,
    best_location.longitude, best_location.accuracy_m, best_location.captured_at, now()
  )
  on conflict (team_id) do update
  set source_session_id = excluded.source_session_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      captured_at = excluded.captured_at,
      selected_at = excluded.selected_at;

  if previous_source is distinct from best_location.session_id then
    insert into city_game.events (
      team_id, session_id, game_slug, event_type, event_data
    )
    select
      session_row.team_id,
      session_row.id,
      team.game_slug,
      'location_source_changed',
      jsonb_build_object('sourceSessionId', best_location.session_id)
    from city_game.teams team
    where team.id = session_row.team_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'currentLocation', jsonb_build_object(
      'teamId', session_row.team_id,
      'sourceSessionId', best_location.session_id,
      'latitude', best_location.latitude,
      'longitude', best_location.longitude,
      'accuracyM', best_location.accuracy_m,
      'capturedAt', best_location.captured_at,
      'selectedAt', now()
    ),
    'locationStatus', 'current'
  );
end;
$$;

create or replace function public.advance_team_step(
  p_session_id uuid,
  p_expected_version bigint,
  p_target_step_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  stop_row city_game.game_stops%rowtype;
  progress_row city_game.progress%rowtype;
  location_row city_game.team_current_location%rowtype;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select * into team_row
  from city_game.teams team
  where team.id = session_row.team_id
  for update;

  if team_row.version is distinct from p_expected_version then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VERSION_CONFLICT'));
  end if;
  if p_target_step_id is distinct from team_row.current_stop_id then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_STEP_TRANSITION'));
  end if;

  select * into stop_row
  from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug
    and stop.game_version = team_row.game_version
    and stop.stop_id = p_target_step_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_STEP_TRANSITION'));
  end if;

  select * into progress_row
  from city_game.progress progress
  where progress.team_id = team_row.id
    and progress.stop_id = p_target_step_id
  for update;
  if progress_row.state <> 'available' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_STEP_TRANSITION'));
  end if;

  select * into location_row
  from city_game.team_current_location location
  where location.team_id = team_row.id;
  if not found
    or location_row.captured_at <= now() - make_interval(
      secs => city_game.location_freshness_seconds()
    )
    or not exists (
      select 1
      from city_game.team_sessions source_session
      where source_session.id = location_row.source_session_id
        and source_session.revoked_at is null
        and source_session.last_seen_at > now() - make_interval(
          secs => city_game.active_session_timeout_seconds()
        )
    )
    or location_row.accuracy_m > stop_row.maximum_accuracy_m
    or city_game.distance_m(
      location_row.latitude, location_row.longitude,
      stop_row.latitude, stop_row.longitude
    ) > stop_row.radius_m then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'LOCATION_NOT_CURRENT'));
  end if;

  if not exists (
    select 1
    from city_game.team_sessions source
    where source.id = location_row.source_session_id
      and source.revoked_at is null
      and source.last_seen_at > now() - make_interval(
        secs => city_game.active_session_timeout_seconds()
      )
  ) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'LOCATION_NOT_CURRENT'));
  end if;

  update city_game.progress
  set state = 'arrived',
      unlock_method = 'gps',
      arrived_at = coalesce(arrived_at, now())
  where id = progress_row.id;

  update city_game.teams
  set current_step_id = 'arrived',
      version = version + 1,
      updated_by_session_id = session_row.id
  where id = team_row.id;

  insert into city_game.events (
    team_id, session_id, game_slug, stop_id, event_type, event_data
  )
  values (
    team_row.id, session_row.id, team_row.game_slug, p_target_step_id,
    'team_step_advanced', jsonb_build_object('step', 'arrived')
  );

  return jsonb_build_object(
    'ok', true,
    'state', city_game.team_state_json(team_row.id, session_row.id)
  );
end;
$$;

create or replace function public.start_or_resume_team_game(
  p_session_id uuid,
  p_game_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  progress_row city_game.progress%rowtype;
  active_run city_game.team_game_runs%rowtype;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select * into team_row
  from city_game.teams team
  where team.id = session_row.team_id
  for update;

  select * into active_run
  from city_game.team_game_runs run
  where run.team_id = team_row.id and run.status = 'active'
  limit 1;

  if found then
    if active_run.game_id = p_game_id then
      insert into city_game.events (
        team_id, session_id, game_slug, stop_id, event_type, event_data
      )
      values (
        team_row.id, session_row.id, team_row.game_slug, p_game_id,
        'game_resumed', jsonb_build_object('runId', active_run.id)
      );
      return jsonb_build_object('ok', true, 'resumed', true, 'run', city_game.game_run_json(active_run));
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'ACTIVE_GAME_EXISTS'),
      'activeGame', city_game.game_run_json(active_run)
    );
  end if;

  if p_game_id is distinct from team_row.current_stop_id
    or not exists (
      select 1 from city_game.game_stops stop
      where stop.game_slug = team_row.game_slug
        and stop.game_version = team_row.game_version
        and stop.stop_id = p_game_id
    ) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_NOT_AVAILABLE'));
  end if;

  select * into progress_row
  from city_game.progress progress
  where progress.team_id = team_row.id and progress.stop_id = p_game_id
  for update;
  if progress_row.state = 'completed' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_ALREADY_COMPLETED'));
  end if;
  if progress_row.state not in ('arrived', 'started') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_NOT_AVAILABLE'));
  end if;

  begin
    insert into city_game.team_game_runs (
      team_id, game_id, status, started_by_session_id
    )
    values (
      team_row.id, p_game_id, 'active', session_row.id
    )
    returning * into active_run;
  exception when unique_violation then
    select * into active_run
    from city_game.team_game_runs run
    where run.team_id = team_row.id and run.status = 'active'
    limit 1;
    if active_run.game_id <> p_game_id then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object('code', 'ACTIVE_GAME_EXISTS'),
        'activeGame', city_game.game_run_json(active_run)
      );
    end if;
    return jsonb_build_object('ok', true, 'resumed', true, 'run', city_game.game_run_json(active_run));
  end;

  update city_game.progress
  set state = 'started', started_at = coalesce(started_at, now())
  where id = progress_row.id;

  update city_game.teams
  set current_step_id = 'started',
      version = version + 1,
      updated_by_session_id = session_row.id
  where id = team_row.id;

  insert into city_game.events (
    team_id, session_id, game_slug, stop_id, event_type, event_data
  )
  values (
    team_row.id, session_row.id, team_row.game_slug, p_game_id,
    'game_started', jsonb_build_object('runId', active_run.id)
  );

  return jsonb_build_object('ok', true, 'resumed', false, 'run', city_game.game_run_json(active_run));
end;
$$;

create or replace function public.update_team_game_state(
  p_session_id uuid,
  p_run_id uuid,
  p_expected_version bigint,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  run_row city_game.team_game_runs%rowtype;
  stop_row city_game.game_stops%rowtype;
  new_state jsonb;
  answer jsonb;
  answer_correct boolean := false;
  hint_id text;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select * into run_row
  from city_game.team_game_runs run
  where run.id = p_run_id
  for update;
  if not found or run_row.team_id <> session_row.team_id then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;
  if run_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_ALREADY_COMPLETED'));
  end if;
  if run_row.version is distinct from p_expected_version then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VERSION_CONFLICT'));
  end if;
  if p_action is null
    or p_action not in ('submit_answer', 'use_hint', 'place_item', 'reset_attempt')
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 16384 then
    raise exception using errcode = 'P0001', message = 'INVALID_GAME_ACTION';
  end if;

  select stop.* into stop_row
  from city_game.game_stops stop
  join city_game.teams team
    on team.game_slug = stop.game_slug and team.game_version = stop.game_version
  where team.id = run_row.team_id and stop.stop_id = run_row.game_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;

  new_state := run_row.state;
  if p_action = 'submit_answer' then
    answer := p_payload->'answer';
    if stop_row.answer_spec->>'kind' = 'code' then
      answer_correct := (stop_row.answer_spec->'answers') ? regexp_replace(
        upper(trim(both '"' from coalesce(answer::text, ''))), '[\s-]+', '', 'g'
      );
    else
      answer_correct := answer = stop_row.answer_spec->'answer';
    end if;
    new_state := jsonb_set(new_state, '{attempts}', to_jsonb(coalesce((new_state->>'attempts')::integer, 0) + 1), true);
    new_state := jsonb_set(new_state, '{answerAccepted}', to_jsonb(answer_correct), true);
  elsif p_action = 'use_hint' then
    hint_id := nullif(p_payload->>'hintId', '');
    if hint_id is null
      or not (stop_row.hint_ids ? hint_id)
      or (coalesce(new_state->'usedHintIds', '[]'::jsonb) ? hint_id) then
      raise exception using errcode = 'P0001', message = 'INVALID_GAME_ACTION';
    end if;
    new_state := jsonb_set(
      new_state,
      '{usedHintIds}',
      coalesce(new_state->'usedHintIds', '[]'::jsonb) || jsonb_build_array(hint_id),
      true
    );
    new_state := jsonb_set(
      new_state,
      '{hintsUsed}',
      to_jsonb(jsonb_array_length(new_state->'usedHintIds')),
      true
    );
  elsif p_action = 'place_item' then
    new_state := jsonb_set(new_state, '{placements}', coalesce(p_payload->'placements', '{}'::jsonb), true);
  elsif p_action = 'reset_attempt' then
    new_state := new_state - 'placements' - 'answerAccepted';
  end if;

  update city_game.team_game_runs
  set state = new_state,
      version = version + 1,
      updated_at = now()
  where id = run_row.id
  returning * into run_row;

  return jsonb_build_object(
    'ok', true,
    'run', city_game.game_run_json(run_row),
    'actionResult', case when p_action = 'submit_answer'
      then jsonb_build_object('correct', answer_correct)
      else '{}'::jsonb end
  );
end;
$$;

create or replace function public.complete_team_game(
  p_session_id uuid,
  p_run_id uuid,
  p_expected_version bigint,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  run_row city_game.team_game_runs%rowtype;
  team_row city_game.teams%rowtype;
  current_stop city_game.game_stops%rowtype;
  next_stop city_game.game_stops%rowtype;
  v_attempts integer;
  v_hints integer;
  v_awarded integer;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select * into run_row
  from city_game.team_game_runs run
  where run.id = p_run_id
  for update;
  if not found or run_row.team_id <> session_row.team_id then
    raise exception using errcode = 'P0001', message = 'GAME_NOT_AVAILABLE';
  end if;

  if run_row.status = 'completed' then
    return jsonb_build_object(
      'ok', true,
      'alreadyCompleted', true,
      'state', city_game.team_state_json(run_row.team_id, session_row.id)
    );
  end if;
  if run_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'GAME_NOT_AVAILABLE'));
  end if;
  if run_row.version is distinct from p_expected_version then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VERSION_CONFLICT'));
  end if;
  if coalesce((run_row.state->>'answerAccepted')::boolean, false) is not true then
    raise exception using errcode = 'P0001', message = 'INVALID_GAME_RESULT';
  end if;

  select * into team_row
  from city_game.teams team
  where team.id = run_row.team_id
  for update;

  select * into current_stop
  from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug
    and stop.game_version = team_row.game_version
    and stop.stop_id = run_row.game_id;

  if jsonb_typeof(coalesce(p_result, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_result, '{}'::jsonb)::text) > 16384 then
    raise exception using errcode = 'P0001', message = 'INVALID_GAME_RESULT';
  end if;

  v_attempts := greatest(coalesce((run_row.state->>'attempts')::integer, 1), 1);
  v_hints := greatest(coalesce((run_row.state->>'hintsUsed')::integer, 0), 0);
  v_awarded := greatest(100, 1000 - (v_hints * 100) - ((v_attempts - 1) * 25));

  update city_game.team_game_runs
  set status = 'completed',
      result = (coalesce(p_result, '{}'::jsonb) - 'score')
        || jsonb_build_object('score', v_awarded),
      version = version + 1,
      completed_at = now(),
      updated_at = now()
  where id = run_row.id;

  update city_game.progress
  set state = 'completed',
      attempts = v_attempts,
      hints_used = v_hints,
      score_awarded = v_awarded,
      answer_data = jsonb_build_object('accepted', true),
      completed_at = now()
  where team_id = team_row.id and stop_id = run_row.game_id;

  select * into next_stop
  from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug
    and stop.game_version = team_row.game_version
    and stop.stop_order = current_stop.stop_order + 1;

  if next_stop.stop_id is not null then
    update city_game.progress
    set state = 'available'
    where team_id = team_row.id
      and stop_id = next_stop.stop_id
      and state = 'locked';
  end if;

  update city_game.teams
  set score = (
        select coalesce(sum(progress.score_awarded), 0)
        from city_game.progress progress
        where progress.team_id = team_row.id
      ),
      status = case when current_stop.is_final then 'completed' else status end,
      completed_at = case when current_stop.is_final then now() else completed_at end,
      current_stop_id = coalesce(next_stop.stop_id, current_stop.stop_id),
      current_step_id = case when current_stop.is_final then 'completed' else 'available' end,
      version = version + 1,
      updated_by_session_id = session_row.id
  where id = team_row.id;

  insert into city_game.events (
    team_id, session_id, game_slug, stop_id, event_type, event_data
  )
  values (
    team_row.id, session_row.id, team_row.game_slug, run_row.game_id,
    'game_completed', jsonb_build_object('runId', run_row.id, 'score', v_awarded)
  );

  return jsonb_build_object(
    'ok', true,
    'alreadyCompleted', false,
    'state', city_game.team_state_json(team_row.id, session_row.id)
  );
end;
$$;

create or replace function public.revoke_team_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  game_slug text;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;
  if session_row.revoked_at is not null then
    return jsonb_build_object('ok', true, 'sessionId', session_row.id);
  end if;

  update city_game.team_sessions
  set revoked_at = now()
  where id = session_row.id
  returning * into session_row;

  select team.game_slug into game_slug
  from city_game.teams team
  where team.id = session_row.team_id;

  insert into city_game.events (
    team_id, session_id, game_slug, event_type, event_data
  )
  values (
    session_row.team_id, session_row.id, game_slug, 'session_revoked', '{}'::jsonb
  );

  delete from city_game.team_session_locations
  where session_id = session_row.id;

  return jsonb_build_object('ok', true, 'sessionId', session_row.id);
end;
$$;

create or replace function public.get_team_state(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', city_game.team_state_json(session_row.team_id, session_row.id)
  );
end;
$$;

alter table city_game.game_stops enable row level security;
alter table city_game.team_sessions enable row level security;
alter table city_game.team_session_locations enable row level security;
alter table city_game.team_current_location enable row level security;
alter table city_game.team_game_runs enable row level security;

drop policy if exists teams_insert_own on city_game.teams;
drop policy if exists teams_select_member on city_game.teams;
drop policy if exists teams_update_member on city_game.teams;
drop policy if exists members_select_member on city_game.team_members;
drop policy if exists members_insert_member on city_game.team_members;
drop policy if exists members_update_member on city_game.team_members;
drop policy if exists progress_select_member on city_game.progress;
drop policy if exists progress_insert_member on city_game.progress;
drop policy if exists progress_update_member on city_game.progress;
drop policy if exists events_select_member on city_game.events;
drop policy if exists events_insert_member on city_game.events;

create policy progress_select_active_session on city_game.progress
for select to authenticated using (city_game.has_team_session(team_id));

create policy current_location_select_active_session on city_game.team_current_location
for select to authenticated using (city_game.has_team_session(team_id));

create policy game_runs_select_active_session on city_game.team_game_runs
for select to authenticated using (city_game.has_team_session(team_id));

revoke all on all tables in schema city_game from public, anon, authenticated;
revoke usage on schema city_game from public, anon;
grant usage on schema city_game to authenticated;
grant select on city_game.progress, city_game.team_current_location, city_game.team_game_runs to authenticated;

revoke all on all functions in schema city_game from public, anon, authenticated;
grant execute on function city_game.has_team_session(uuid) to authenticated;
revoke all on function public.join_team_by_code(text, uuid, text) from public, anon;
revoke all on function public.heartbeat_team_session(uuid) from public, anon;
revoke all on function public.update_team_location(uuid, double precision, double precision, double precision, double precision, double precision, double precision, timestamptz) from public, anon;
revoke all on function public.advance_team_step(uuid, bigint, text) from public, anon;
revoke all on function public.start_or_resume_team_game(uuid, text) from public, anon;
revoke all on function public.update_team_game_state(uuid, uuid, bigint, text, jsonb) from public, anon;
revoke all on function public.complete_team_game(uuid, uuid, bigint, jsonb) from public, anon;
revoke all on function public.revoke_team_session(uuid) from public, anon;
revoke all on function public.get_team_state(uuid) from public, anon;

grant execute on function public.join_team_by_code(text, uuid, text) to authenticated;
grant execute on function public.heartbeat_team_session(uuid) to authenticated;
grant execute on function public.update_team_location(uuid, double precision, double precision, double precision, double precision, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.advance_team_step(uuid, bigint, text) to authenticated;
grant execute on function public.start_or_resume_team_game(uuid, text) to authenticated;
grant execute on function public.update_team_game_state(uuid, uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.complete_team_game(uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.revoke_team_session(uuid) to authenticated;
grant execute on function public.get_team_state(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'progress'
  ) then
    alter publication supabase_realtime add table city_game.progress;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'team_current_location'
  ) then
    alter publication supabase_realtime add table city_game.team_current_location;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'team_game_runs'
  ) then
    alter publication supabase_realtime add table city_game.team_game_runs;
  end if;
end;
$$;
