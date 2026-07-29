-- Server-owned location evidence, observation fallback and dashboard release.

update city_game.game_stops
set radius_m = 35,
    maximum_accuracy_m = 40
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1;

create table city_game.stop_observation_questions (
  id text primary key,
  game_slug text not null,
  game_version integer not null,
  stop_id text not null,
  question_kind text not null check (question_kind in ('primary', 'backup')),
  question text not null,
  answer_rule jsonb not null,
  hint text,
  enabled boolean not null default true,
  requires_on_site_validation boolean not null default true,
  unique (game_slug, game_version, stop_id, question_kind),
  foreign key (game_slug, game_version, stop_id)
    references city_game.game_stops(game_slug, game_version, stop_id)
    on delete cascade,
  check (
    (answer_rule->>'type' = 'variants' and jsonb_typeof(answer_rule->'values') = 'array')
    or
    (answer_rule->>'type' = 'required_all' and jsonb_typeof(answer_rule->'values') = 'array')
  )
);

create table city_game.team_stop_observation_state (
  team_id uuid not null references city_game.teams(id) on delete cascade,
  stop_id text not null,
  wrong_attempts integer not null default 0 check (wrong_attempts >= 0),
  hint_visible boolean not null default false,
  backup_selected boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (team_id, stop_id)
);

create table city_game.team_stop_verifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  stop_id text not null,
  method text not null check (method in ('gps', 'observation', 'dashboard_override')),
  verified_at timestamptz not null default now(),
  verified_by_session_id uuid references city_game.team_sessions(id) on delete set null,
  dashboard_client_id uuid,
  gps_latitude double precision,
  gps_longitude double precision,
  gps_distance_m double precision,
  gps_accuracy_m double precision,
  question_id text references city_game.stop_observation_questions(id),
  reason text,
  action_id uuid,
  unique (team_id, stop_id),
  unique (action_id),
  check (
    (method = 'gps' and gps_distance_m is not null and gps_accuracy_m is not null)
    or (method = 'observation' and question_id is not null)
    or (method = 'dashboard_override' and dashboard_client_id is not null and length(trim(reason)) > 0)
  )
);

create index team_stop_verifications_team_idx
on city_game.team_stop_verifications(team_id, verified_at);

alter table city_game.stop_observation_questions enable row level security;
alter table city_game.team_stop_observation_state enable row level security;
alter table city_game.team_stop_verifications enable row level security;

revoke all on city_game.stop_observation_questions from public, anon, authenticated;
revoke all on city_game.team_stop_observation_state from public, anon, authenticated;
revoke all on city_game.team_stop_verifications from public, anon, authenticated;

insert into city_game.stop_observation_questions (
  id, game_slug, game_version, stop_id, question_kind, question, answer_rule, hint
)
values
  ('drakenfontein-primary', 'moerasdraak-den-bosch', 1, 'drakenfontein', 'primary',
   'Hoeveel zwarte draken staan aan de voet van de fontein?',
   '{"type":"variants","values":["4","vier"]}',
   'Kijk niet alleen naar de gouden draak bovenop. Tel de donkere draken lager bij het bassin.'),
  ('drakenfontein-backup', 'moerasdraak-den-bosch', 1, 'drakenfontein', 'backup',
   'Wat houdt de grote gouden draak vast?',
   '{"type":"variants","values":["schild","wapenschild","een schild","familiewapen"]}', null),
  ('zoete-lieve-gerritje-primary', 'moerasdraak-den-bosch', 1, 'zoete-lieve-gerritje', 'primary',
   'Welk dier staat naast Gerritje op de mand?',
   '{"type":"variants","values":["haan","een haan"]}',
   'Kijk naast Gerritje, iets lager dan haar gezicht.'),
  ('zoete-lieve-gerritje-backup', 'moerasdraak-den-bosch', 1, 'zoete-lieve-gerritje', 'backup',
   'Waar zit Gerritje op?',
   '{"type":"variants","values":["bank","bankje","een bank","een bankje"]}', null),
  ('binnendieze-primary', 'moerasdraak-den-bosch', 1, 'binnendieze', 'primary',
   'Van welk materiaal is de hoge moderne reconstructie boven de oude bakstenen toren gemaakt?',
   '{"type":"variants","values":["staal","metaal","stalen constructie","metalen constructie"]}',
   'Kijk boven de oude bakstenen muur naar de hoge verticale constructie.'),
  ('binnendieze-backup', 'moerasdraak-den-bosch', 1, 'binnendieze', 'backup',
   'Welke kleur hebben de stenen die in de bestrating de verdwenen Marktstroom aangeven?',
   '{"type":"variants","values":["blauw","blauwe stenen","donkerblauw","blauwzwart"]}', null),
  ('bosch-wezen-primary', 'moerasdraak-den-bosch', 1, 'bosch-wezen', 'primary',
   'Welke naam staat tussen aanhalingstekens op de bronzen plaquette in de gevel?',
   '{"type":"variants","values":["de roosekrans","roosekrans","de rozenkrans","rozenkrans"]}',
   'Zoek laag in de gevel naar de bronzen plaquette en lees de naam tussen de aanhalingstekens.'),
  ('bosch-wezen-backup', 'moerasdraak-den-bosch', 1, 'bosch-wezen', 'backup',
   'Welke twee jaartallen staan direct achter de naam Jeroen Bosch op de plaquette?',
   '{"type":"required_all","values":["1450","1516"]}', null),
  ('sint-jan-primary', 'moerasdraak-den-bosch', 1, 'sint-jan', 'primary',
   'Welk modern voorwerp draagt de engel behalve haar mobiele telefoon?',
   '{"type":"variants","values":["laptoptas","laptop tas","computertas","computer tas","tas met laptop"]}',
   'Kijk niet alleen naar wat zij bij haar oor houdt. Bekijk ook wat zij bij zich draagt.'),
  ('sint-jan-backup', 'moerasdraak-den-bosch', 1, 'sint-jan', 'backup',
   'Wat houdt de engel tegen haar oor?',
   '{"type":"variants","values":["telefoon","mobiele telefoon","mobiel","mobieltje","gsm"]}', null),
  ('kruithuis-primary', 'moerasdraak-den-bosch', 1, 'kruithuis', 'primary',
   'Welk dier is verguld afgebeeld in de wapensteen boven de toegangspoort?',
   '{"type":"variants","values":["leeuw","een leeuw","gouden leeuw","vergulde leeuw"]}',
   'Kijk boven de toegangspoort naar de gekleurde wapensteen.'),
  ('kruithuis-backup', 'moerasdraak-den-bosch', 1, 'kruithuis', 'backup',
   'Welke vorm heeft het hoofdgebouw van het Kruithuis?',
   '{"type":"variants","values":["zeshoek","zeshoekig","6 hoek","6-hoek","hexagon"]}', null),
  ('bossche-brouwers-primary', 'moerasdraak-den-bosch', 1, 'bossche-brouwers', 'primary',
   'Welke twee woorden volgen in de naam op “Bossche Brouwers”?',
   '{"type":"variants","values":["aan de vaart","aandevaart"]}',
   'Kijk naar de volledige naam op of bij de ingang.'),
  ('bossche-brouwers-backup', 'moerasdraak-den-bosch', 1, 'bossche-brouwers', 'backup',
   'In welk soort industrieel gebouw is Bossche Brouwers gevestigd?',
   '{"type":"variants","values":["silo","silogebouw","graansilo","voedersilo","veevoedersilo"]}', null);

create or replace function city_game.normalize_observation_answer(p_answer text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(
        lower(coalesce(p_answer, '')),
        'áàäâãåéèëêíìïîóòöôõúùüûçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9 ]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function city_game.observation_answer_matches(
  p_rule jsonb,
  p_answer text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text := city_game.normalize_observation_answer(p_answer);
begin
  if p_rule->>'type' = 'variants' then
    return exists (
      select 1
      from jsonb_array_elements_text(p_rule->'values') value
      where city_game.normalize_observation_answer(value) = normalized
    );
  end if;
  if p_rule->>'type' = 'required_all' then
    return not exists (
      select 1
      from jsonb_array_elements_text(p_rule->'values') value
      where position(city_game.normalize_observation_answer(value) in normalized) = 0
    );
  end if;
  return false;
end;
$$;

-- Forward declarations keep this imperative migration valid while later
-- definitions replace these bodies with the complete implementations.
create or replace function city_game.current_observation_json(
  p_team_id uuid,
  p_stop_id text
)
returns jsonb language sql stable security definer set search_path = ''
as $$ select null::jsonb $$;

create or replace function city_game.verify_team_stop(
  p_team_id uuid,
  p_stop_id text,
  p_method text,
  p_session_id uuid default null,
  p_dashboard_client_id uuid default null,
  p_gps_latitude double precision default null,
  p_gps_longitude double precision default null,
  p_gps_distance_m double precision default null,
  p_gps_accuracy_m double precision default null,
  p_question_id text default null,
  p_reason text default null,
  p_action_id uuid default null
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;

create or replace function city_game.refresh_team_current_location(p_team_id uuid)
returns city_game.team_current_location
language sql security definer set search_path = ''
as $$ select null::city_game.team_current_location $$;

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
  verifications jsonb;
  active_count integer;
  location_current boolean := false;
begin
  select * into team_row from city_game.teams where id = p_team_id;

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
  ) into stop_progress
  from city_game.progress progress
  where progress.team_id = p_team_id;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'stopId', verification.stop_id,
    'method', verification.method,
    'verifiedAt', verification.verified_at,
    'questionId', verification.question_id
  )) order by verification.verified_at), '[]'::jsonb)
  into verifications
  from city_game.team_stop_verifications verification
  where verification.team_id = p_team_id;

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
      select 1 from city_game.team_sessions session
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
    'verifications', verifications,
    'currentObservation', city_game.current_observation_json(
      p_team_id, team_row.current_stop_id
    ),
    'observationStatus', case
      when city_game.current_observation_json(p_team_id, team_row.current_stop_id) is not null
        then 'available'
      when exists (
        select 1 from city_game.stop_observation_questions question
        where question.stop_id = team_row.current_stop_id
          and question.enabled
          and question.requires_on_site_validation
      ) then 'validation_required'
      else 'unavailable'
    end,
    'sessionStateAt', now(),
    'sessionId', p_session_id
  );
end;
$$;

create or replace function public.verify_stop_observation(
  p_session_id uuid,
  p_stop_id text,
  p_question_id text,
  p_answer text,
  p_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
  question_row city_game.stop_observation_questions%rowtype;
  expected_kind text;
  is_correct boolean;
begin
  if p_action_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_OBSERVATION_ACTION';
  end if;
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;
  select * into team_row from city_game.teams team
  where team.id = session_row.team_id for update;
  if exists (
    select 1 from city_game.team_stop_verifications verification
    where verification.team_id = team_row.id and verification.stop_id = p_stop_id
  ) then
    return jsonb_build_object(
      'ok', true, 'verified', true,
      'state', city_game.team_state_json(team_row.id, session_row.id)
    );
  end if;
  if team_row.current_stop_id is distinct from p_stop_id or not exists (
    select 1 from city_game.progress progress
    where progress.team_id = team_row.id
      and progress.stop_id = p_stop_id
      and progress.state = 'available'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STEP_TRANSITION';
  end if;

  if exists (select 1 from city_game.events where event_id = p_action_id)
    or exists (
      select 1 from city_game.team_stop_verifications
      where action_id = p_action_id
    ) then
    return jsonb_build_object(
      'ok', true, 'replayed', true,
      'verified', exists (
        select 1 from city_game.team_stop_verifications verification
        where verification.team_id = team_row.id and verification.stop_id = p_stop_id
      ),
      'state', city_game.team_state_json(team_row.id, session_row.id)
    );
  end if;

  select case when coalesce(state.backup_selected, false) then 'backup' else 'primary' end
  into expected_kind
  from (select 1) seed
  left join city_game.team_stop_observation_state state
    on state.team_id = team_row.id and state.stop_id = p_stop_id;

  select * into question_row
  from city_game.stop_observation_questions question
  where question.id = p_question_id
    and question.game_slug = team_row.game_slug
    and question.game_version = team_row.game_version
    and question.stop_id = p_stop_id
    and question.question_kind = expected_kind
    and question.enabled
    and not question.requires_on_site_validation;
  if not found then
    raise exception using errcode = 'P0001', message = 'OBSERVATION_NOT_AVAILABLE';
  end if;

  is_correct := city_game.observation_answer_matches(question_row.answer_rule, p_answer);
  if not is_correct then
    insert into city_game.team_stop_observation_state (
      team_id, stop_id, wrong_attempts, hint_visible, updated_at
    ) values (team_row.id, p_stop_id, 1, false, now())
    on conflict (team_id, stop_id) do update
    set wrong_attempts = city_game.team_stop_observation_state.wrong_attempts + 1,
        hint_visible = city_game.team_stop_observation_state.wrong_attempts + 1 >= 2,
        updated_at = now();
    insert into city_game.events (
      event_id, team_id, session_id, game_slug, stop_id, event_type, event_data
    ) values (
      p_action_id, team_row.id, session_row.id, team_row.game_slug, p_stop_id,
      'observation_attempt_rejected',
      jsonb_build_object('questionId', question_row.id)
    );
    return jsonb_build_object(
      'ok', true, 'verified', false,
      'observation', city_game.current_observation_json(team_row.id, p_stop_id),
      'state', city_game.team_state_json(team_row.id, session_row.id)
    );
  end if;

  perform city_game.verify_team_stop(
    team_row.id, p_stop_id, 'observation', session_row.id,
    null, null, null, null, null, question_row.id, null, p_action_id
  );
  return jsonb_build_object(
    'ok', true, 'verified', true,
    'state', city_game.team_state_json(team_row.id, session_row.id)
  );
end;
$$;

create or replace function public.select_backup_stop_observation(
  p_session_id uuid,
  p_stop_id text,
  p_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  team_row city_game.teams%rowtype;
begin
  if p_action_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_OBSERVATION_ACTION';
  end if;
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;
  select * into team_row from city_game.teams team
  where team.id = session_row.team_id for update;
  if team_row.current_stop_id is distinct from p_stop_id or not exists (
    select 1 from city_game.progress
    where team_id = team_row.id and stop_id = p_stop_id and state = 'available'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STEP_TRANSITION';
  end if;
  if exists (select 1 from city_game.events where event_id = p_action_id) then
    return jsonb_build_object(
      'ok', true,
      'observation', city_game.current_observation_json(team_row.id, p_stop_id),
      'state', city_game.team_state_json(team_row.id, session_row.id)
    );
  end if;
  if not exists (
    select 1 from city_game.stop_observation_questions question
    where question.game_slug = team_row.game_slug
      and question.game_version = team_row.game_version
      and question.stop_id = p_stop_id
      and question.question_kind = 'backup'
      and question.enabled
      and not question.requires_on_site_validation
  ) then
    raise exception using errcode = 'P0001', message = 'OBSERVATION_NOT_AVAILABLE';
  end if;

  insert into city_game.team_stop_observation_state (
    team_id, stop_id, backup_selected, updated_at
  ) values (team_row.id, p_stop_id, true, now())
  on conflict (team_id, stop_id) do update
  set backup_selected = case
        when city_game.team_stop_observation_state.backup_selected then true
        else excluded.backup_selected
      end,
      updated_at = now()
  where not city_game.team_stop_observation_state.backup_selected;
  if not found then
    raise exception using errcode = 'P0001', message = 'BACKUP_ALREADY_SELECTED';
  end if;
  insert into city_game.events (
    event_id, team_id, session_id, game_slug, stop_id, event_type, event_data
  ) values (
    p_action_id, team_row.id, session_row.id, team_row.game_slug, p_stop_id,
    'observation_backup_selected', '{}'::jsonb
  );
  return jsonb_build_object(
    'ok', true,
    'observation', city_game.current_observation_json(team_row.id, p_stop_id),
    'state', city_game.team_state_json(team_row.id, session_row.id)
  );
end;
$$;

create or replace function public.dashboard_release_current_stop(
  p_team_id uuid,
  p_client_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_row city_game.teams%rowtype;
  released boolean;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  if p_client_id is null or nullif(trim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  select * into team_row from city_game.teams
  where id = p_team_id for update;
  if exists (
    select 1 from city_game.team_stop_verifications verification
    where verification.team_id = p_team_id
      and verification.stop_id = team_row.current_stop_id
  ) then
    perform city_game.refresh_dashboard_team(p_team_id);
    return city_game.dashboard_team_json(p_team_id);
  end if;
  if not exists (
    select 1 from city_game.progress
    where team_id = p_team_id
      and stop_id = team_row.current_stop_id
      and state = 'available'
  ) then
    raise exception using errcode = 'P0001', message = 'CURRENT_STOP_NOT_AVAILABLE';
  end if;
  released := city_game.verify_team_stop(
    p_team_id, team_row.current_stop_id, 'dashboard_override',
    null, p_client_id, null, null, null, null, null, p_reason
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
  delete from city_game.team_stop_verifications where team_id = p_team_id;
  delete from city_game.team_stop_observation_state where team_id = p_team_id;
  delete from city_game.progress where team_id = p_team_id;
  select stop_id into first_stop from city_game.game_stops
  where game_slug = 'moerasdraak-den-bosch' and game_version = 1
  order by stop_order limit 1;
  insert into city_game.progress (team_id, stop_id, state)
  select p_team_id, stop_id, case when stop_order = 1 then 'available' else 'locked' end
  from city_game.game_stops
  where game_slug = 'moerasdraak-den-bosch' and game_version = 1;
  update city_game.teams
  set status = 'active', score = 0, started_at = null, completed_at = null,
      current_stop_id = first_stop, current_step_id = 'available',
      version = version + 1
  where id = p_team_id;
  perform city_game.dashboard_audit(
    p_team_id, 'team_progress_reset_from_dashboard', p_client_id
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
  where id = p_session_id and team_id = p_team_id and revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;
  delete from city_game.team_session_locations where session_id = p_session_id;
  perform city_game.refresh_team_current_location(p_team_id);
  perform city_game.dashboard_audit(
    p_team_id, 'session_revoked_from_dashboard', p_client_id,
    jsonb_build_object('sessionId', p_session_id)
  );
  perform city_game.refresh_dashboard_team(p_team_id);
  return city_game.dashboard_team_json(p_team_id);
end;
$$;

revoke all on function public.verify_stop_observation(uuid, text, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.select_backup_stop_observation(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.dashboard_release_current_stop(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.verify_stop_observation(uuid, text, text, text, uuid)
to authenticated;
grant execute on function public.select_backup_stop_observation(uuid, text, uuid)
to authenticated;
grant execute on function public.dashboard_release_current_stop(uuid, uuid, text)
to authenticated;

revoke all on function city_game.normalize_observation_answer(text)
from public, anon, authenticated;
revoke all on function city_game.observation_answer_matches(jsonb, text)
from public, anon, authenticated;
revoke all on function city_game.current_observation_json(uuid, text)
from public, anon, authenticated;
revoke all on function city_game.verify_team_stop(
  uuid, text, text, uuid, uuid, double precision, double precision,
  double precision, double precision, text, text, uuid
) from public, anon, authenticated;
revoke all on function city_game.refresh_team_current_location(uuid)
from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['progress', 'team_game_runs', 'team_current_location']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'city_game'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table city_game.%I', target_table);
    end if;
  end loop;
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
  perform city_game.refresh_team_current_location(session_row.team_id);
  select count(*)::integer into active_count
  from city_game.team_sessions session
  where session.team_id = session_row.team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    );
  return jsonb_build_object(
    'ok', true, 'sessionId', session_row.id,
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
  selected_location city_game.team_current_location%rowtype;
  affected integer;
begin
  if p_latitude is null or p_longitude is null or p_accuracy_m is null
    or p_captured_at is null or p_latitude not between -90 and 90
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

  insert into city_game.team_session_locations (
    session_id, team_id, latitude, longitude, accuracy_m, altitude_m,
    heading_deg, speed_mps, captured_at, received_at
  )
  values (
    session_row.id, session_row.team_id, p_latitude, p_longitude,
    p_accuracy_m, p_altitude_m, p_heading_deg, p_speed_mps, p_captured_at, now()
  )
  on conflict (session_id) do update
  set latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      altitude_m = excluded.altitude_m,
      heading_deg = excluded.heading_deg,
      speed_mps = excluded.speed_mps,
      captured_at = excluded.captured_at,
      received_at = excluded.received_at
  where excluded.captured_at >= city_game.team_session_locations.captured_at;
  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception using errcode = 'P0001', message = 'LOCATION_OUT_OF_ORDER';
  end if;

  delete from city_game.team_session_locations location
  where location.received_at < now() - make_interval(
    hours => city_game.location_retention_hours()
  );
  selected_location := city_game.refresh_team_current_location(session_row.team_id);

  return jsonb_build_object(
    'ok', true,
    'currentLocation', case when selected_location.team_id is null then null else
      jsonb_build_object(
        'teamId', selected_location.team_id,
        'sourceSessionId', selected_location.source_session_id,
        'latitude', selected_location.latitude,
        'longitude', selected_location.longitude,
        'accuracyM', selected_location.accuracy_m,
        'capturedAt', selected_location.captured_at,
        'selectedAt', selected_location.selected_at
      ) end,
    'locationStatus', case when selected_location.team_id is null then 'stale' else 'current' end
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
  progress_state text;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;
  perform city_game.refresh_team_current_location(session_row.team_id);
  select state into progress_state from city_game.progress
  where team_id = session_row.team_id and stop_id = p_target_step_id;
  if progress_state not in ('arrived', 'started', 'completed') then
    return jsonb_build_object(
      'ok', false, 'error', jsonb_build_object('code', 'LOCATION_NOT_CURRENT')
    );
  end if;
  return jsonb_build_object(
    'ok', true, 'state', city_game.team_state_json(session_row.team_id, session_row.id)
  );
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
  perform city_game.refresh_team_current_location(session_row.team_id);
  return jsonb_build_object(
    'ok', true, 'state', city_game.team_state_json(session_row.team_id, session_row.id)
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
  where session.id = p_session_id and session.auth_user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;
  if session_row.revoked_at is not null then
    return jsonb_build_object('ok', true, 'sessionId', session_row.id);
  end if;
  update city_game.team_sessions set revoked_at = now()
  where id = session_row.id returning * into session_row;
  select team.game_slug into game_slug from city_game.teams team
  where team.id = session_row.team_id;
  insert into city_game.events (
    team_id, session_id, game_slug, event_type, event_data
  ) values (
    session_row.team_id, session_row.id, game_slug, 'session_revoked', '{}'::jsonb
  );
  delete from city_game.team_session_locations where session_id = session_row.id;
  perform city_game.refresh_team_current_location(session_row.team_id);
  return jsonb_build_object('ok', true, 'sessionId', session_row.id);
end;
$$;

create or replace function city_game.current_observation_json(
  p_team_id uuid,
  p_stop_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  observation_state city_game.team_stop_observation_state%rowtype;
  question_row city_game.stop_observation_questions%rowtype;
begin
  select * into observation_state
  from city_game.team_stop_observation_state state
  where state.team_id = p_team_id and state.stop_id = p_stop_id;

  select * into question_row
  from city_game.stop_observation_questions question
  where question.game_slug = 'moerasdraak-den-bosch'
    and question.game_version = 1
    and question.stop_id = p_stop_id
    and question.question_kind = case
      when coalesce(observation_state.backup_selected, false) then 'backup'
      else 'primary'
    end
    and question.enabled;

  if not found or question_row.requires_on_site_validation then
    return null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'questionId', question_row.id,
    'question', question_row.question,
    'isBackup', question_row.question_kind = 'backup',
    'wrongAttempts', coalesce(observation_state.wrong_attempts, 0),
    'hint', case when coalesce(observation_state.hint_visible, false)
      then question_row.hint else null end,
    'canSelectBackup', question_row.question_kind = 'primary' and exists (
      select 1 from city_game.stop_observation_questions backup
      where backup.game_slug = question_row.game_slug
        and backup.game_version = question_row.game_version
        and backup.stop_id = question_row.stop_id
        and backup.question_kind = 'backup'
        and backup.enabled
        and not backup.requires_on_site_validation
    )
  ));
end;
$$;

create or replace function city_game.verify_team_stop(
  p_team_id uuid,
  p_stop_id text,
  p_method text,
  p_session_id uuid default null,
  p_dashboard_client_id uuid default null,
  p_gps_latitude double precision default null,
  p_gps_longitude double precision default null,
  p_gps_distance_m double precision default null,
  p_gps_accuracy_m double precision default null,
  p_question_id text default null,
  p_reason text default null,
  p_action_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_row city_game.teams%rowtype;
  inserted_id uuid;
  audit_type text;
begin
  select * into team_row
  from city_game.teams team
  where team.id = p_team_id
  for update;
  if not found or team_row.current_stop_id is distinct from p_stop_id then
    return false;
  end if;
  if exists (
    select 1 from city_game.team_stop_verifications verification
    where verification.team_id = p_team_id and verification.stop_id = p_stop_id
  ) then
    return false;
  end if;
  if not exists (
    select 1 from city_game.progress progress
    where progress.team_id = p_team_id
      and progress.stop_id = p_stop_id
      and progress.state = 'available'
  ) then
    return false;
  end if;

  insert into city_game.team_stop_verifications (
    team_id, stop_id, method, verified_by_session_id, dashboard_client_id,
    gps_latitude, gps_longitude, gps_distance_m, gps_accuracy_m,
    question_id, reason, action_id
  )
  values (
    p_team_id, p_stop_id, p_method, p_session_id, p_dashboard_client_id,
    p_gps_latitude, p_gps_longitude, p_gps_distance_m, p_gps_accuracy_m,
    p_question_id, nullif(trim(p_reason), ''), p_action_id
  )
  on conflict (team_id, stop_id) do nothing
  returning id into inserted_id;
  if inserted_id is null then return false; end if;

  update city_game.progress
  set state = 'arrived',
      unlock_method = p_method,
      arrived_at = coalesce(arrived_at, now()),
      updated_at = now()
  where team_id = p_team_id and stop_id = p_stop_id and state = 'available';

  update city_game.teams
  set current_step_id = 'arrived',
      version = version + 1,
      updated_by_session_id = p_session_id
  where id = p_team_id;

  audit_type := case p_method
    when 'gps' then 'stop_verified_by_gps'
    when 'observation' then 'stop_verified_by_observation'
    else 'stop_released_from_dashboard'
  end;
  insert into city_game.events (
    event_id, team_id, session_id, game_slug, stop_id, event_type, event_data
  )
  values (
    coalesce(p_action_id, gen_random_uuid()), p_team_id, p_session_id,
    team_row.game_slug, p_stop_id, audit_type,
    jsonb_strip_nulls(jsonb_build_object(
      'method', p_method,
      'questionId', p_question_id,
      'dashboardClientId', p_dashboard_client_id,
      'reason', nullif(trim(p_reason), '')
    ))
  );
  return true;
end;
$$;

create or replace function city_game.refresh_team_current_location(p_team_id uuid)
returns city_game.team_current_location
language plpgsql
security definer
set search_path = ''
as $$
declare
  best_location record;
  result city_game.team_current_location%rowtype;
  team_row city_game.teams%rowtype;
  stop_row city_game.game_stops%rowtype;
  distance_to_stop double precision;
  previous_source uuid;
begin
  perform 1 from city_game.teams where id = p_team_id for update;
  select source_session_id into previous_source
  from city_game.team_current_location where team_id = p_team_id;
  select
    location.session_id, location.latitude, location.longitude,
    location.accuracy_m, location.captured_at
  into best_location
  from city_game.team_session_locations location
  join city_game.team_sessions session on session.id = location.session_id
  where location.team_id = p_team_id
    and session.revoked_at is null
    and session.last_seen_at > now() - make_interval(
      secs => city_game.active_session_timeout_seconds()
    )
    and location.captured_at > now() - make_interval(
      secs => city_game.location_freshness_seconds()
    )
  order by location.accuracy_m, location.captured_at desc, location.received_at desc
  limit 1;

  if not found then
    delete from city_game.team_current_location where team_id = p_team_id;
    if previous_source is not null then
      insert into city_game.events (
        team_id, game_slug, event_type, event_data
      )
      select p_team_id, team.game_slug, 'location_source_changed',
        jsonb_build_object('sourceSessionId', null)
      from city_game.teams team where team.id = p_team_id;
    end if;
    return null;
  end if;

  insert into city_game.team_current_location (
    team_id, source_session_id, latitude, longitude, accuracy_m, captured_at, selected_at
  )
  values (
    p_team_id, best_location.session_id, best_location.latitude,
    best_location.longitude, best_location.accuracy_m, best_location.captured_at, now()
  )
  on conflict (team_id) do update
  set source_session_id = excluded.source_session_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m,
      captured_at = excluded.captured_at,
      selected_at = excluded.selected_at
  where (
    city_game.team_current_location.source_session_id,
    city_game.team_current_location.latitude,
    city_game.team_current_location.longitude,
    city_game.team_current_location.accuracy_m,
    city_game.team_current_location.captured_at
  ) is distinct from (
    excluded.source_session_id,
    excluded.latitude,
    excluded.longitude,
    excluded.accuracy_m,
    excluded.captured_at
  )
  returning * into result;
  if result.team_id is null then
    select * into result from city_game.team_current_location
    where team_id = p_team_id;
  end if;

  select * into team_row from city_game.teams where id = p_team_id;
  if previous_source is distinct from result.source_session_id then
    insert into city_game.events (
      team_id, session_id, game_slug, event_type, event_data
    ) values (
      p_team_id, result.source_session_id, team_row.game_slug,
      'location_source_changed',
      jsonb_build_object('sourceSessionId', result.source_session_id)
    );
  end if;
  select * into stop_row
  from city_game.game_stops stop
  where stop.game_slug = team_row.game_slug
    and stop.game_version = team_row.game_version
    and stop.stop_id = team_row.current_stop_id;
  if found and best_location.accuracy_m <= stop_row.maximum_accuracy_m then
    distance_to_stop := city_game.distance_m(
      best_location.latitude, best_location.longitude,
      stop_row.latitude, stop_row.longitude
    );
    if distance_to_stop <= stop_row.radius_m then
      perform city_game.verify_team_stop(
        p_team_id, stop_row.stop_id, 'gps', best_location.session_id,
        null, best_location.latitude, best_location.longitude,
        distance_to_stop, best_location.accuracy_m
      );
    end if;
  end if;
  return result;
end;
$$;

create or replace function city_game.refresh_location_after_session_revocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_team_id uuid;
begin
  affected_team_id := case when tg_op = 'DELETE' then old.team_id else new.team_id end;
  if exists (select 1 from city_game.teams where id = affected_team_id) then
    perform city_game.refresh_team_current_location(affected_team_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists refresh_location_after_session_revocation
on city_game.team_sessions;
create trigger refresh_location_after_session_revocation
after update of revoked_at on city_game.team_sessions
for each row
when (old.revoked_at is distinct from new.revoked_at)
execute function city_game.refresh_location_after_session_revocation();

drop trigger if exists refresh_location_after_session_delete
on city_game.team_sessions;
create trigger refresh_location_after_session_delete
after delete on city_game.team_sessions
for each row
execute function city_game.refresh_location_after_session_revocation();

revoke all on function city_game.refresh_location_after_session_revocation()
from public, anon, authenticated;
