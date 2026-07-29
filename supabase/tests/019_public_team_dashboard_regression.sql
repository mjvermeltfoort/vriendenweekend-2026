begin;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000019',
  true
);

create temporary table dashboard_test_state (
  team_id uuid,
  original_code text,
  rotated_code text,
  session_id uuid
);

with created as (
  select public.dashboard_create_team(
    'SQL Dashboard Testteam',
    null,
    '20000000-0000-4000-8000-000000000019'
  ) as value
)
insert into dashboard_test_state (team_id, original_code)
select (value->>'id')::uuid, value->>'code' from created;

do $$
declare
  test_row dashboard_test_state%rowtype;
  snapshot jsonb;
begin
  select * into test_row from dashboard_test_state;
  if test_row.original_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'code backfill/generation format failed';
  end if;
  if (
    select count(*) <> count(distinct join_code)
    from city_game.teams
  ) then
    raise exception 'join codes are not unique';
  end if;
  snapshot := public.get_dashboard_snapshot();
  if not exists (
    select 1 from jsonb_array_elements(snapshot->'teams') team
    where team->>'id' = test_row.team_id::text
      and team->>'code' = test_row.original_code
  ) then
    raise exception 'snapshot content failed';
  end if;
end;
$$;

with joined as (
  select public.join_team_by_code(
    (select original_code from dashboard_test_state),
    '30000000-0000-4000-8000-000000000019',
    'Dashboard regression browser'
  ) as value
)
update dashboard_test_state
set session_id = (select (value->'session'->>'id')::uuid from joined);

select public.update_team_location(
  (select session_id from dashboard_test_state),
  51.690506,
  5.296208,
  12,
  null,
  null,
  null,
  now()
);

do $$
declare
  projected jsonb;
begin
  select payload into projected
  from public.dashboard_team_projection
  where team_id = (select team_id from dashboard_test_state);
  if jsonb_array_length(projected->'participants') <> 1 then
    raise exception 'active participants projection failed';
  end if;
  if projected->'location'->>'sourceSessionId'
    <> (select session_id::text from dashboard_test_state) then
    raise exception 'location source projection failed';
  end if;
end;
$$;

update dashboard_test_state
set rotated_code = (
  public.dashboard_rotate_team_code(
    team_id,
    '20000000-0000-4000-8000-000000000019'
  )->>'code'
);

do $$
begin
  if (select original_code = rotated_code from dashboard_test_state) then
    raise exception 'code rotation failed';
  end if;
  if (
    public.join_team_by_code(
      (select original_code from dashboard_test_state),
      gen_random_uuid(),
      'old code check'
    )->>'ok'
  )::boolean then
    raise exception 'old code remains valid';
  end if;
end;
$$;

select public.dashboard_update_team_name(
  (select team_id from dashboard_test_state),
  'SQL Dashboard Hernoemd',
  '20000000-0000-4000-8000-000000000019'
);

select public.start_or_resume_team_game(
  (select session_id from dashboard_test_state),
  'drakenfontein'
);
select public.dashboard_abandon_active_game(
  (select team_id from dashboard_test_state),
  '20000000-0000-4000-8000-000000000019'
);

select public.dashboard_reset_team_progress(
  (select team_id from dashboard_test_state),
  '20000000-0000-4000-8000-000000000019'
);

do $$
begin
  if exists (
    select 1 from city_game.team_game_runs
    where team_id = (select team_id from dashboard_test_state)
      and status = 'active'
  ) then
    raise exception 'reset did not abandon active run';
  end if;
  if (
    select count(*) filter (where state = 'available') <> 1
      or count(*) filter (where state <> 'locked' and state <> 'available') <> 0
    from city_game.progress
    where team_id = (select team_id from dashboard_test_state)
  ) then
    raise exception 'progress reset failed';
  end if;
end;
$$;

select public.dashboard_revoke_team_session(
  (select team_id from dashboard_test_state),
  (select session_id from dashboard_test_state),
  '20000000-0000-4000-8000-000000000019'
);

select public.dashboard_set_team_status(
  (select team_id from dashboard_test_state),
  'disabled',
  '20000000-0000-4000-8000-000000000019'
);
select public.dashboard_set_team_status(
  (select team_id from dashboard_test_state),
  'active',
  '20000000-0000-4000-8000-000000000019'
);

do $$
begin
  if not exists (
    select 1 from city_game.team_sessions
    where id = (select session_id from dashboard_test_state)
      and revoked_at is not null
  ) then
    raise exception 'session revocation failed';
  end if;
  if (
    select count(*) < 7
    from city_game.events
    where team_id = (select team_id from dashboard_test_state)
      and event_type like '%from_dashboard'
      and event_data ? 'dashboardClientId'
      and not (event_data ?| array['code', 'codeHash', 'latitude', 'longitude'])
  ) then
    raise exception 'dashboard audit events failed';
  end if;
end;
$$;

rollback;
