-- Isolated test database only: the existing schema surfaces used by migration 042.
create role anon;
create role authenticated;
create schema auth;
create schema city_game;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table city_game.teams (
  id uuid primary key, game_slug text, game_version integer, name text, status text default 'active', score integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(), current_stop_id text, current_step_id text,
  version bigint default 1, updated_by_session_id uuid, bonus_completion_awarded boolean default false, completed_at timestamptz
);
create table city_game.team_sessions (id uuid primary key, team_id uuid references city_game.teams, auth_user_id uuid, revoked_at timestamptz, last_seen_at timestamptz default now());
create table city_game.game_stops (
  game_slug text, game_version integer, stop_id text, stop_order integer, is_bonus boolean default false,
  is_final boolean default false, maximum_points integer default 1000, answer_spec jsonb, hint_ids jsonb default '["h1"]',
  primary key(game_slug, game_version, stop_id)
);
create table city_game.progress (
  team_id uuid references city_game.teams, stop_id text, state text default 'started', attempts integer default 0,
  hints_used integer default 0, score_awarded integer default 0, answer_data jsonb default '{}', unlock_method text default 'gps',
  arrived_at timestamptz, started_at timestamptz default now(), completed_at timestamptz,
  primary key(team_id, stop_id)
);
create table city_game.team_game_runs (
  id uuid primary key, team_id uuid references city_game.teams, game_id text, status text default 'active', state jsonb default '{}',
  result jsonb, version bigint default 0, started_at timestamptz default now(), updated_at timestamptz default now(), completed_at timestamptz
);
create table city_game.events (id uuid default gen_random_uuid(), team_id uuid, session_id uuid, game_slug text, stop_id text, event_type text, event_data jsonb);
create table city_game.team_current_location (team_id uuid, source_session_id uuid, latitude float8, longitude float8, accuracy_m float8, captured_at timestamptz, selected_at timestamptz);
create table city_game.team_stop_verifications (team_id uuid, stop_id text, method text, verified_at timestamptz, question_id text);
create table city_game.stop_observation_questions (stop_id text, enabled boolean, requires_on_site_validation boolean);
create function city_game.location_freshness_seconds() returns integer language sql as $$ select 300 $$;
create function city_game.active_session_timeout_seconds() returns integer language sql as $$ select 60 $$;
create function city_game.current_observation_json(uuid, text) returns jsonb language sql as $$ select null::jsonb $$;
create function city_game.game_run_json(city_game.team_game_runs) returns jsonb language sql as $$
  select jsonb_build_object('id', $1.id, 'teamId', $1.team_id, 'gameId', $1.game_id, 'status', $1.status, 'state', $1.state, 'version', $1.version);
$$;

insert into city_game.teams(id, game_slug, game_version, name, current_stop_id) values
  ('00000000-0000-0000-0000-000000000001', 'test', 1, 'Cooldown test', 'main'),
  ('00000000-0000-0000-0000-000000000002', 'test', 1, 'Other team', 'main');
insert into city_game.team_sessions(id, team_id, auth_user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003');
insert into city_game.game_stops(game_slug,game_version,stop_id,stop_order,is_bonus,is_final,maximum_points,answer_spec) values
  ('test',1,'main',1,false,false,1000,'{"kind":"choice","answer":"yes"}'),
  ('test',1,'bonus',0,true,false,200,'{"kind":"choice","answer":"yes"}'),
  ('test',1,'final',2,false,true,1000,'{"kind":"code","answers":["1234"]}');
insert into city_game.progress(team_id,stop_id) select '00000000-0000-0000-0000-000000000001', stop_id from city_game.game_stops;
insert into city_game.team_game_runs(id,team_id,game_id) values
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','main'),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','bonus'),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','final');
