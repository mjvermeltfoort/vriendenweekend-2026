create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_settings (
  singleton boolean primary key default true check (singleton),
  access_code_hash text,
  updated_at timestamptz not null default now()
);
insert into private.app_settings (singleton) values (true) on conflict do nothing;

create table if not exists private.players (
  user_id uuid primary key references auth.users(id) on update cascade on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  normalized_name text not null unique check (char_length(normalized_name) between 1 and 40),
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now()
);
create table if not exists private.games (
  id text primary key check (id ~ '^[a-z0-9-]{1,60}$'), title text not null,
  description text not null default '', status text not null default 'gesloten' check (status in ('gesloten','open','afgelopen')),
  open_from timestamptz, close_at timestamptz, hint text not null default '',
  max_points integer not null check (max_points between 100 and 100000),
  display_order integer not null unique check (display_order > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists private.game_starts (
  id bigint generated always as identity primary key, user_id uuid not null references private.players(user_id) on update cascade on delete cascade,
  player_name text not null, game_id text not null references private.games(id), status text not null default 'gestart',
  source text not null default '', user_agent text not null default '', started_at timestamptz not null default now(),
  check (char_length(source) <= 100), check (char_length(user_agent) <= 250)
);
create table if not exists private.scores (
  id bigint generated always as identity primary key, user_id uuid not null references private.players(user_id) on update cascade on delete cascade,
  player_name text not null, game_id text not null references private.games(id), score integer not null check (score >= 0),
  seconds integer not null check (seconds between 0 and 86400), attempts integer not null check (attempts between 0 and 10000),
  detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  constraint scores_one_per_player_game unique (user_id, game_id), check (octet_length(detail::text) <= 5120)
);
create table if not exists private.active_players (
  user_id uuid primary key references private.players(user_id) on update cascade on delete cascade,
  game_id text not null references private.games(id), started_at timestamptz not null default now(), last_seen_at timestamptz not null default now()
);
create index if not exists players_name_idx on private.players (normalized_name);
create index if not exists games_schedule_idx on private.games (status, open_from, close_at, display_order);
create index if not exists starts_user_game_started_idx on private.game_starts (user_id, game_id, started_at desc);
create index if not exists scores_game_user_idx on private.scores (game_id, user_id);
create index if not exists scores_leaderboard_idx on private.scores (user_id, score desc, seconds asc);
create index if not exists active_players_seen_idx on private.active_players (last_seen_at desc);

alter table private.app_settings enable row level security;
alter table private.players enable row level security;
alter table private.games enable row level security;
alter table private.game_starts enable row level security;
alter table private.scores enable row level security;
alter table private.active_players enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

create or replace function private.game_state(p_game private.games)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_game.status = 'afgelopen' then 'afgelopen'
    when p_game.status <> 'open' then 'gesloten'
    when p_game.open_from is not null and now() < p_game.open_from then 'gesloten'
    when p_game.close_at is not null and now() > p_game.close_at then 'afgelopen'
    else 'open' end
$$;

create or replace function private.score_for(p_game_id text, p_max_points integer, p_seconds integer, p_attempts integer)
returns integer language sql immutable security definer set search_path = '' as $$
  select case
    when p_game_id = 'mozaiek' then greatest(100, p_max_points - least(500, floor(p_seconds * 2)::integer) - least(350, greatest(0, p_attempts - 15) * 5))
    when p_game_id = 'vallende-stenen' then greatest(100, p_max_points - least(500, floor(p_seconds * 1.5)::integer) - least(250, greatest(0, p_attempts - 30) * 4))
    else greatest(100, p_max_points - floor(p_seconds)::integer - greatest(0, p_attempts - 1) * 20)
  end
$$;

create or replace function public.get_public_config()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('authenticationRequired', exists(select 1 from private.app_settings where singleton and access_code_hash is not null))
$$;

create or replace function public.register_player(p_name text, p_access_code text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text; v_normalized text; v_hash text; v_existing uuid;
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt. Probeer opnieuw.'; end if;
  v_name := btrim(regexp_replace(regexp_replace(coalesce(p_name,''), '[<>[:cntrl:]]', '', 'g'), '\\s+', ' ', 'g'));
  if char_length(v_name) not between 1 and 40 then raise exception 'Vul een naam van maximaal 40 tekens in.'; end if;
  v_normalized := lower(v_name);
  select access_code_hash into v_hash from private.app_settings where singleton;
  if v_hash is not null and (coalesce(p_access_code,'') = '' or extensions.crypt(p_access_code, v_hash) <> v_hash) then raise exception 'Naam of toegangscode is ongeldig.'; end if;
  select user_id into v_existing from private.players where normalized_name = v_normalized for update;
  if v_existing is not null and v_existing <> v_uid then
    update private.players set user_id = v_uid, name = v_name, last_seen_at = now() where user_id = v_existing;
  elsif v_existing is null then
    insert into private.players (user_id, name, normalized_name) values (v_uid, v_name, v_normalized);
  else
    update private.players set name = v_name, last_seen_at = now() where user_id = v_uid;
  end if;
  return jsonb_build_object('authenticationRequired', v_hash is not null, 'playerName', v_name);
end $$;

create or replace function public.get_app_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt. Probeer opnieuw.'; end if;
  update private.players set last_seen_at = now() where user_id = v_uid;
  return jsonb_build_object(
    'authenticationRequired', exists(select 1 from private.app_settings where singleton and access_code_hash is not null),
    'games', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'description', g.description, 'status', g.status, 'state', private.game_state(g), 'openFrom', g.open_from, 'closeAt', g.close_at, 'hint', case when s.id is null then '' else g.hint end, 'maxPoints', g.max_points, 'order', g.display_order, 'completed', case when s.id is null then null else jsonb_build_object('gameId',s.game_id,'title',g.title,'score',s.score,'seconds',s.seconds,'attempts',s.attempts) end) order by g.display_order) from private.games g left join private.scores s on s.game_id=g.id and s.user_id=v_uid), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'score', x.score, 'games', x.games, 'seconds', x.seconds) order by x.score desc, x.seconds asc, x.name asc) from (select min(player_name) name, sum(score)::integer score, count(*)::integer games, sum(seconds)::integer seconds from private.scores group by user_id order by sum(score) desc, sum(seconds), min(player_name) limit 50) x), '[]'::jsonb),
    'activePlayers', coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'gameId',a.game_id,'gameTitle',g.title,'startedAt',a.started_at) order by a.last_seen_at desc) from private.active_players a join private.players p on p.user_id=a.user_id join private.games g on g.id=a.game_id where a.last_seen_at >= now() - interval '30 seconds'), '[]'::jsonb)
  );
end $$;

create or replace function public.get_game_access(p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_game private.games; v_score private.scores; v_state text;
begin
  if v_uid is null or not exists(select 1 from private.players where user_id=v_uid) then raise exception 'Open dit spel via de startpagina en sla eerst je naam op.'; end if;
  select * into v_game from private.games where id=p_game_id; if not found then raise exception 'Onbekend spel.'; end if;
  select * into v_score from private.scores where user_id=v_uid and game_id=p_game_id; v_state := private.game_state(v_game);
  return jsonb_build_object('allowed', v_state='open' and v_score.id is null, 'state', v_state, 'completed', case when v_score.id is null then null else jsonb_build_object('gameId',v_score.game_id,'title',v_game.title,'score',v_score.score,'seconds',v_score.seconds,'attempts',v_score.attempts) end, 'game', jsonb_build_object('id',v_game.id,'title',v_game.title,'description',v_game.description,'status',v_game.status,'state',v_state,'openFrom',v_game.open_from,'closeAt',v_game.close_at,'hint',case when v_score.id is null then '' else v_game.hint end,'maxPoints',v_game.max_points,'order',v_game.display_order));
end $$;

create or replace function public.register_game_start(p_game_id text, p_source text default '', p_user_agent text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_game private.games;
begin
  if v_uid is null or not exists(select 1 from private.players where user_id=v_uid) then raise exception 'Sla eerst je naam op.'; end if;
  if char_length(coalesce(p_source,'')) > 100 or char_length(coalesce(p_user_agent,'')) > 250 then raise exception 'Startgegevens zijn te lang.'; end if;
  select * into v_game from private.games where id=p_game_id; if not found or private.game_state(v_game) <> 'open' then raise exception 'Dit spel is niet vrijgegeven.'; end if;
  if exists(select 1 from private.scores where user_id=v_uid and game_id=p_game_id) then return jsonb_build_object('registered',false,'reason','completed'); end if;
  insert into private.game_starts(user_id,player_name,game_id,source,user_agent) select user_id,name,p_game_id,coalesce(p_source,''),coalesce(p_user_agent,'') from private.players where user_id=v_uid;
  insert into private.active_players(user_id,game_id) values(v_uid,p_game_id) on conflict(user_id) do update set game_id=excluded.game_id,started_at=case when private.active_players.game_id=excluded.game_id then private.active_players.started_at else now() end,last_seen_at=now();
  return jsonb_build_object('registered',true);
end $$;

create or replace function public.register_game_heartbeat(p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_game private.games;
begin
  if v_uid is null or not exists(select 1 from private.players where user_id=v_uid) then raise exception 'Sla eerst je naam op.'; end if;
  select * into v_game from private.games where id=p_game_id; if not found or private.game_state(v_game) <> 'open' then raise exception 'Dit spel is niet actief.'; end if;
  if exists(select 1 from private.scores where user_id=v_uid and game_id=p_game_id) then delete from private.active_players where user_id=v_uid; return jsonb_build_object('active',false,'reason','completed'); end if;
  insert into private.active_players(user_id,game_id) values(v_uid,p_game_id) on conflict(user_id) do update set game_id=excluded.game_id,last_seen_at=now(); return jsonb_build_object('active',true);
end $$;

create or replace function public.reset_game_progress(p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_game private.games; v_count integer;
begin
  if v_uid is null then raise exception 'Je sessie ontbreekt.'; end if; select * into v_game from private.games where id=p_game_id; if not found then raise exception 'Onbekend spel.'; end if;
  if private.game_state(v_game) <> 'open' then raise exception 'Dit spel kan nu niet opnieuw worden gestart.'; end if;
  delete from private.scores where user_id=v_uid and game_id=p_game_id; get diagnostics v_count = row_count; delete from private.active_players where user_id=v_uid;
  return jsonb_build_object('reset',v_count>0,'gameId',p_game_id,'removedScores',v_count);
end $$;

create or replace function public.submit_score(p_game_id text, p_seconds integer, p_attempts integer, p_detail jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_game private.games; v_score private.scores; v_score_value integer; v_inserted boolean := false;
begin
  if v_uid is null or not exists(select 1 from private.players where user_id=v_uid) then raise exception 'Sla eerst je naam op.'; end if;
  if p_seconds is null or p_seconds not between 0 and 86400 or p_attempts is null or p_attempts not between 0 and 10000 or p_detail is null or octet_length(p_detail::text)>5120 then raise exception 'Ongeldige scoregegevens.'; end if;
  select * into v_game from private.games where id=p_game_id; if not found or private.game_state(v_game) <> 'open' then raise exception 'Dit spel is niet vrijgegeven.'; end if;
  v_score_value := private.score_for(p_game_id,v_game.max_points,p_seconds,p_attempts);
  insert into private.scores(user_id,player_name,game_id,score,seconds,attempts,detail) select user_id,name,p_game_id,v_score_value,p_seconds,p_attempts,p_detail from private.players where user_id=v_uid on conflict(user_id,game_id) do nothing returning * into v_score;
  v_inserted := found; if not v_inserted then select * into v_score from private.scores where user_id=v_uid and game_id=p_game_id; end if;
  delete from private.active_players where user_id=v_uid;
  return jsonb_build_object('alreadySubmitted',not v_inserted,'result',jsonb_build_object('gameId',v_score.game_id,'title',v_game.title,'score',v_score.score,'seconds',v_score.seconds,'attempts',v_score.attempts,'hint',v_game.hint));
end $$;

revoke all on function private.game_state(private.games), private.score_for(text,integer,integer,integer) from public;
revoke all on function public.get_public_config(), public.register_player(text,text), public.get_app_state(), public.get_game_access(text), public.register_game_start(text,text,text), public.register_game_heartbeat(text), public.reset_game_progress(text), public.submit_score(text,integer,integer,jsonb) from public;
grant execute on function public.get_public_config(), public.register_player(text,text), public.get_app_state(), public.get_game_access(text), public.register_game_start(text,text,text), public.register_game_heartbeat(text), public.reset_game_progress(text), public.submit_score(text,integer,integer,jsonb) to authenticated;

-- Optional access code, run manually in the SQL editor (replace the placeholder):
-- update private.app_settings set access_code_hash = extensions.crypt('KIES_EEN_LANGE_CODE', extensions.gen_salt('bf')), updated_at = now() where singleton;
-- Disable it again with: update private.app_settings set access_code_hash = null, updated_at = now() where singleton;
