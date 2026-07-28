create extension if not exists pgcrypto;

create schema if not exists city_game;

create table if not exists city_game.teams (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  game_version integer not null,
  name text not null,
  join_code text unique not null,
  owner_user_id uuid not null,
  status text not null,
  score integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists city_game.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  user_id uuid not null,
  display_name text,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create table if not exists city_game.progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  stop_id text not null,
  state text not null,
  unlock_method text,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 0,
  hints_used integer not null default 0,
  score_awarded integer not null default 0,
  answer_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, stop_id)
);

create table if not exists city_game.events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid unique not null,
  team_id uuid not null references city_game.teams(id) on delete cascade,
  game_slug text not null,
  stop_id text,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists teams_game_slug_idx on city_game.teams (game_slug);
create index if not exists teams_join_code_idx on city_game.teams (join_code);
create index if not exists team_members_team_id_idx on city_game.team_members (team_id);
create index if not exists progress_team_id_idx on city_game.progress (team_id);
create index if not exists events_team_id_idx on city_game.events (team_id);

create or replace function city_game.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function city_game.normalize_join_code(input text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(input, ''), '[\s-]+', '', 'g'));
$$;

create or replace function city_game.join_city_game_team(join_code text)
returns jsonb
language plpgsql
security definer
set search_path = city_game, public
as $$
declare
  normalized text := city_game.normalize_join_code(join_code);
  team_row city_game.teams%rowtype;
  progress_rows jsonb;
begin
  select * into team_row from city_game.teams where city_game.normalize_join_code(city_game.teams.join_code) = normalized limit 1;
  if not found then
    raise exception 'team not found';
  end if;

  insert into city_game.team_members (team_id, user_id, role)
  values (team_row.id, auth.uid(), 'member')
  on conflict (team_id, user_id) do update set joined_at = now();

  select coalesce(jsonb_object_agg(stop_id, to_jsonb(progress_row)), '{}'::jsonb)
  into progress_rows
  from city_game.progress progress_row
  where progress_row.team_id = team_row.id;

  return jsonb_build_object(
    'team', to_jsonb(team_row),
    'progress', coalesce(progress_rows, '{}'::jsonb)
  );
end;
$$;

create or replace function city_game.is_team_member(team_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from city_game.team_members tm
    where tm.team_id = team_uuid and tm.user_id = auth.uid()
  ) or exists(
    select 1 from city_game.teams t
    where t.id = team_uuid and t.owner_user_id = auth.uid()
  );
$$;

create trigger teams_updated_at
before update on city_game.teams
for each row execute function city_game.set_updated_at();

create trigger progress_updated_at
before update on city_game.progress
for each row execute function city_game.set_updated_at();

alter table city_game.teams enable row level security;
alter table city_game.team_members enable row level security;
alter table city_game.progress enable row level security;
alter table city_game.events enable row level security;

create policy teams_insert_own on city_game.teams
for insert to authenticated with check (auth.uid() = owner_user_id);

create policy teams_select_member on city_game.teams
for select to authenticated using (city_game.is_team_member(id));

create policy teams_update_member on city_game.teams
for update to authenticated using (city_game.is_team_member(id)) with check (city_game.is_team_member(id));

create policy members_select_member on city_game.team_members
for select to authenticated using (city_game.is_team_member(team_id));

create policy members_insert_member on city_game.team_members
for insert to authenticated with check (city_game.is_team_member(team_id) or user_id = auth.uid());

create policy members_update_member on city_game.team_members
for update to authenticated using (city_game.is_team_member(team_id)) with check (city_game.is_team_member(team_id));

create policy progress_select_member on city_game.progress
for select to authenticated using (city_game.is_team_member(team_id));

create policy progress_insert_member on city_game.progress
for insert to authenticated with check (city_game.is_team_member(team_id));

create policy progress_update_member on city_game.progress
for update to authenticated using (city_game.is_team_member(team_id)) with check (city_game.is_team_member(team_id));

create policy events_select_member on city_game.events
for select to authenticated using (city_game.is_team_member(team_id));

create policy events_insert_member on city_game.events
for insert to authenticated with check (city_game.is_team_member(team_id));

grant usage on schema city_game to authenticated;
grant select, insert, update, delete on city_game.teams to authenticated;
grant select, insert, update, delete on city_game.team_members to authenticated;
grant select, insert, update, delete on city_game.progress to authenticated;
grant select, insert, update, delete on city_game.events to authenticated;
grant execute on function city_game.join_city_game_team(text) to authenticated;
