create or replace function public.sync_city_game_state(
  p_team jsonb,
  p_progress jsonb,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  team_uuid uuid := nullif(p_team->>'id', '')::uuid;
  existing_owner uuid;
  stop_entry record;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if team_uuid is null
    or nullif(p_team->>'gameSlug', '') is null
    or nullif(p_team->>'joinCode', '') is null
    or nullif(p_team->>'name', '') is null then
    raise exception 'invalid team payload';
  end if;

  select owner_user_id
  into existing_owner
  from city_game.teams
  where id = team_uuid;

  if found
    and existing_owner <> current_user_id
    and not exists (
      select 1
      from city_game.team_members
      where team_id = team_uuid and user_id = current_user_id
    ) then
    raise exception 'team access denied';
  end if;

  insert into city_game.teams (
    id,
    game_slug,
    game_version,
    name,
    join_code,
    owner_user_id,
    status,
    score,
    started_at,
    completed_at,
    created_at,
    updated_at,
    metadata
  )
  values (
    team_uuid,
    p_team->>'gameSlug',
    coalesce((p_team->>'gameVersion')::integer, 1),
    p_team->>'name',
    city_game.normalize_join_code(p_team->>'joinCode'),
    current_user_id,
    coalesce(nullif(p_team->>'status', ''), 'active'),
    coalesce((p_progress->>'totalScore')::integer, 0),
    nullif(p_team->>'startedAt', '')::timestamptz,
    nullif(p_team->>'completedAt', '')::timestamptz,
    coalesce(nullif(p_team->>'createdAt', '')::timestamptz, now()),
    now(),
    jsonb_build_object(
      'memberNames', coalesce(p_team->'memberNames', '[]'::jsonb),
      'privacyAccepted', coalesce((p_team->>'privacyAccepted')::boolean, false),
      'progress', coalesce(p_progress, '{}'::jsonb) - 'stopProgress'
    )
  )
  on conflict (id) do update
  set game_slug = excluded.game_slug,
      game_version = excluded.game_version,
      name = excluded.name,
      join_code = excluded.join_code,
      status = excluded.status,
      score = excluded.score,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      updated_at = now(),
      metadata = excluded.metadata;

  insert into city_game.team_members (team_id, user_id, display_name, role)
  values (team_uuid, current_user_id, p_team->>'name', 'owner')
  on conflict (team_id, user_id) do update
  set display_name = excluded.display_name;

  for stop_entry in
    select key as stop_id, value as stop_data
    from jsonb_each(coalesce(p_progress->'stopProgress', '{}'::jsonb))
  loop
    insert into city_game.progress (
      team_id,
      stop_id,
      state,
      unlock_method,
      arrived_at,
      started_at,
      completed_at,
      attempts,
      hints_used,
      score_awarded,
      answer_data,
      updated_at
    )
    values (
      team_uuid,
      stop_entry.stop_id,
      coalesce(stop_entry.stop_data->>'state', 'locked'),
      nullif(stop_entry.stop_data->>'unlockMethod', ''),
      nullif(stop_entry.stop_data->>'arrivedAt', '')::timestamptz,
      nullif(stop_entry.stop_data->>'startedAt', '')::timestamptz,
      nullif(stop_entry.stop_data->>'completedAt', '')::timestamptz,
      coalesce((stop_entry.stop_data->>'attempts')::integer, 0),
      coalesce((stop_entry.stop_data->>'hintsUsed')::integer, 0),
      coalesce((stop_entry.stop_data->>'scoreAwarded')::integer, 0),
      coalesce(stop_entry.stop_data->'answerData', '{}'::jsonb),
      now()
    )
    on conflict (team_id, stop_id) do update
    set state = excluded.state,
        unlock_method = excluded.unlock_method,
        arrived_at = excluded.arrived_at,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        attempts = excluded.attempts,
        hints_used = excluded.hints_used,
        score_awarded = excluded.score_awarded,
        answer_data = excluded.answer_data,
        updated_at = now();
  end loop;

  insert into city_game.events (
    event_id,
    team_id,
    game_slug,
    stop_id,
    event_type,
    event_data,
    occurred_at
  )
  values (
    nullif(p_event->>'id', '')::uuid,
    team_uuid,
    p_team->>'gameSlug',
    nullif(p_event->>'stopId', ''),
    p_event->>'eventType',
    coalesce(p_event->'payload', '{}'::jsonb),
    coalesce(nullif(p_event->>'occurredAt', '')::timestamptz, now())
  )
  on conflict (event_id) do nothing;

  return jsonb_build_object('synced', true);
end;
$$;

create or replace function public.join_city_game_team(join_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := city_game.normalize_join_code(join_code);
  team_row city_game.teams%rowtype;
  stop_progress jsonb;
  progress_metadata jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select *
  into team_row
  from city_game.teams
  where city_game.normalize_join_code(city_game.teams.join_code) = normalized_code
  limit 1;

  if not found then
    raise exception 'team not found';
  end if;

  insert into city_game.team_members (team_id, user_id, role)
  values (team_row.id, current_user_id, 'member')
  on conflict (team_id, user_id) do update
  set joined_at = now();

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
  from city_game.progress
  where progress.team_id = team_row.id;

  progress_metadata := coalesce(team_row.metadata->'progress', '{}'::jsonb);

  return jsonb_build_object(
    'team', jsonb_build_object(
      'id', team_row.id,
      'gameSlug', team_row.game_slug,
      'gameVersion', team_row.game_version,
      'name', team_row.name,
      'joinCode', team_row.join_code,
      'memberNames', coalesce(team_row.metadata->'memberNames', '[]'::jsonb),
      'createdAt', team_row.created_at,
      'updatedAt', team_row.updated_at,
      'lastActivityAt', team_row.updated_at,
      'privacyAccepted', coalesce((team_row.metadata->>'privacyAccepted')::boolean, false)
    ),
    'progress', jsonb_strip_nulls(
      progress_metadata
      || jsonb_build_object(
        'teamId', team_row.id,
        'gameSlug', team_row.game_slug,
        'gameVersion', team_row.game_version,
        'totalScore', team_row.score,
        'finalized', team_row.status = 'completed',
        'stopProgress', stop_progress
      )
    )
  );
end;
$$;

revoke all on function public.sync_city_game_state(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.join_city_game_team(text) from public, anon;
grant execute on function public.sync_city_game_state(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.join_city_game_team(text) to authenticated;
