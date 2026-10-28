-- Optional event-scoped start slots and advisory spacing. Internal tables are RPC-only.
begin;
create table city_game.spacing_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  enabled boolean not null default true,
  gap_m integer not null default 100 check (gap_m between 50 and 300),
  created_at timestamptz not null default now()
);
create table city_game.spacing_members (
  team_id uuid primary key references city_game.teams(id) on delete cascade,
  event_id uuid not null references city_game.spacing_events(id) on delete cascade,
  scheduled_at timestamptz not null,
  departed_at timestamptz,
  ahead_team_id uuid references city_game.teams(id) on delete set null,
  close_since timestamptz,
  checked_at timestamptz,
  notice_id uuid,
  notice_at timestamptz,
  acknowledged_at timestamptz,
  gap_m double precision
);
create index spacing_members_event_idx on city_game.spacing_members(event_id);
-- Segments are derived from the checked-in walking GeoJSON, not straight-line stop distances.
create table city_game.spacing_route_segments (
  target_stop_id text not null, segment integer not null,
  x1 double precision not null, y1 double precision not null,
  x2 double precision not null, y2 double precision not null,
  start_m double precision not null, length_m double precision not null,
  primary key (target_stop_id, segment)
);
alter table city_game.spacing_events enable row level security;
alter table city_game.spacing_members enable row level security;
alter table city_game.spacing_route_segments enable row level security;
revoke all on city_game.spacing_events, city_game.spacing_members, city_game.spacing_route_segments from public, anon, authenticated;

-- Uses the same local metric projection for both positions and the route.
create function city_game.spacing_position(p_team_id uuid)
returns table(target_stop_id text, along_m double precision, accuracy_m double precision)
language sql stable security definer set search_path = '' as $$
  select t.current_stop_id, coalesce(nearest.start_m + nearest.f * nearest.length_m,0), l.accuracy_m
  from city_game.teams t
  join city_game.team_current_location l on l.team_id = t.id
  left join lateral (
    select s.*, projection.f,
      sqrt(power(s.x1 + projection.f*(s.x2-s.x1) - l.longitude*69342.0,2)
         + power(s.y1 + projection.f*(s.y2-s.y1) - l.latitude*111195.0,2)) as off_m
    from city_game.spacing_route_segments s
    cross join lateral (select greatest(0.0, least(1.0,
      ((l.longitude*69342.0-s.x1)*(s.x2-s.x1)+(l.latitude*111195.0-s.y1)*(s.y2-s.y1))
      / nullif(power(s.x2-s.x1,2)+power(s.y2-s.y1,2),0))) as f) projection
    where s.target_stop_id = t.current_stop_id
    order by off_m limit 1
  ) nearest on true
  where t.id = p_team_id and t.status = 'active'
    -- The route origin has no incoming leg; an earlier arrival identifies its occupant.
    and (nearest.off_m <= 40 or (nearest.off_m is null and t.current_stop_id='drakenfontein'
      and sqrt(power((l.longitude-5.296208)*69342.0,2)+power((l.latitude-51.690506)*111195.0,2)) <= 40))
    and l.accuracy_m between 0 and 40
    and l.captured_at between now()-interval '30 seconds' and now()+interval '5 seconds'
    and exists (select 1 from city_game.team_sessions ss where ss.id=l.source_session_id
      and ss.team_id=t.id and ss.revoked_at is null and ss.last_seen_at > now()-interval '60 seconds')
$$;

create function public.dashboard_plan_spacing(
  p_name text, p_team_ids uuid[], p_start_at timestamptz, p_interval_minutes integer,
  p_gap_m integer, p_client_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_team uuid; v_index integer := 0;
begin
  if auth.uid() is null or p_client_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_team_ids is null or cardinality(p_team_ids) not between 1 and 100
    or p_start_at is null or p_interval_minutes is null or p_interval_minutes not between 1 and 30
    or p_gap_m is null or p_gap_m not between 50 and 300
    or p_name is null or length(trim(p_name)) not between 2 and 80
    or (select count(distinct x) from unnest(p_team_ids) x) <> cardinality(p_team_ids)
    then raise exception 'INVALID_SPACING_PLAN'; end if;
  -- One lock order for overlapping plans, departures and polls.
  perform 1 from city_game.teams where id=any(p_team_ids) order by id for update;
  foreach v_team in array p_team_ids loop
    perform city_game.assert_dashboard_team(v_team);
    if exists(select 1 from city_game.progress where team_id=v_team and (started_at is not null or state in ('started','completed')))
      or exists(select 1 from city_game.spacing_members where team_id=v_team and departed_at is not null)
      then raise exception 'TEAM_ALREADY_STARTED'; end if;
  end loop;
  insert into city_game.spacing_events(name,gap_m) values(trim(p_name),p_gap_m) returning id into v_event;
  foreach v_team in array p_team_ids loop
    insert into city_game.spacing_members(team_id,event_id,scheduled_at)
      values(v_team,v_event,p_start_at+make_interval(mins=>v_index*p_interval_minutes))
      on conflict(team_id) do update set event_id=excluded.event_id,scheduled_at=excluded.scheduled_at,
        departed_at=null,ahead_team_id=null,close_since=null,checked_at=null,notice_id=null,notice_at=null,acknowledged_at=null,gap_m=null;
    perform city_game.dashboard_audit(v_team,'spacing_scheduled',p_client_id,jsonb_build_object('eventId',v_event));
    v_index := v_index+1;
  end loop;
  return v_event;
end $$;

create function public.dashboard_update_spacing(
  p_team_id uuid, p_scheduled_at timestamptz, p_enabled boolean, p_client_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare m city_game.spacing_members%rowtype;
begin
  perform city_game.assert_dashboard_team(p_team_id);
  perform 1 from city_game.teams where id=p_team_id for update;
  select * into m from city_game.spacing_members where team_id=p_team_id for update;
  if not found then raise exception 'SPACING_NOT_PLANNED'; end if;
  if p_scheduled_at is not null then
    if m.departed_at is not null then raise exception 'TEAM_ALREADY_STARTED'; end if;
    update city_game.spacing_members set scheduled_at=p_scheduled_at where team_id=p_team_id;
  end if;
  if p_enabled is not null then
    update city_game.spacing_events set enabled=p_enabled where id=m.event_id;
    update city_game.spacing_members set close_since=null,notice_id=null,notice_at=null,acknowledged_at=null,gap_m=null
      where event_id=m.event_id;
  end if;
  perform city_game.dashboard_audit(p_team_id,'spacing_updated',p_client_id,jsonb_build_object('scheduledAt',p_scheduled_at,'enabled',p_enabled));
end $$;

create function public.get_team_spacing(p_session_id uuid, p_depart boolean default false, p_acknowledge uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_team uuid; m city_game.spacing_members%rowtype; e city_game.spacing_events%rowtype;
  v_ahead uuid; v_gap double precision; v_fresh boolean;
begin
  select team_id into v_team from city_game.team_sessions
    where id=p_session_id and auth_user_id=auth.uid() and revoked_at is null;
  if not found then raise exception 'SESSION_REVOKED'; end if;
  perform 1 from city_game.teams where id=v_team for update;
  select * into m from city_game.spacing_members where team_id=v_team for update;
  if not found then return jsonb_build_object('serverNow',clock_timestamp(),'schedule',null,'noticeId',null); end if;
  select * into e from city_game.spacing_events where id=m.event_id;
  if p_depart and m.departed_at is null then
    if e.enabled and m.scheduled_at > now() then raise exception 'START_NOT_RELEASED'; end if;
    update city_game.spacing_members set departed_at=now() where team_id=v_team returning * into m;
    update city_game.teams set started_at=coalesce(started_at,now()) where id=v_team;
  end if;
  if p_acknowledge is not null and p_acknowledge=m.notice_id then
    update city_game.spacing_members set acknowledged_at=now() where team_id=v_team returning * into m;
  end if;
  if e.enabled and m.departed_at is not null then
    select other.team_id, abs(b.along_m-a.along_m) as gap into v_ahead, v_gap
    from city_game.spacing_position(v_team) a
    join city_game.spacing_members other on other.event_id=m.event_id and other.team_id<>v_team and other.departed_at is not null
    cross join lateral city_game.spacing_position(other.team_id) b
    left join city_game.progress theirs on theirs.team_id=other.team_id and theirs.stop_id=b.target_stop_id
    left join city_game.progress ours on ours.team_id=v_team and ours.stop_id=a.target_stop_id
    where b.target_stop_id=a.target_stop_id
      -- Conservative: the route separation must exceed GPS uncertainty to establish who's ahead.
      and (b.along_m-a.along_m > greatest(5,a.accuracy_m+b.accuracy_m)
        or (theirs.state in ('arrived','started') and theirs.arrived_at < coalesce(ours.arrived_at,now())))
      and abs(b.along_m-a.along_m) < case when other.team_id=m.ahead_team_id then e.gap_m+50 else e.gap_m end
    order by abs(b.along_m-a.along_m) limit 1;
  end if;
  if v_ahead is null then
    update city_game.spacing_members set ahead_team_id=null,close_since=null,checked_at=now(),gap_m=null,notice_id=null,acknowledged_at=null
      where team_id=v_team returning * into m;
  else
    v_fresh := m.checked_at > now()-interval '15 seconds' and m.ahead_team_id=v_ahead;
    update city_game.spacing_members set ahead_team_id=v_ahead, gap_m=v_gap,
      close_since=case when v_fresh then coalesce(close_since,now()) else now() end,
      checked_at=now(),notice_id=case when v_fresh then notice_id else null end,
      acknowledged_at=case when v_fresh then acknowledged_at else null end
      where team_id=v_team returning * into m;
    if m.close_since <= now()-interval '30 seconds' and m.notice_id is null
      and (m.notice_at is null or m.notice_at < now()-interval '10 minutes') then
      update city_game.spacing_members set notice_id=gen_random_uuid(),notice_at=now(),acknowledged_at=null
        where team_id=v_team returning * into m;
    end if;
  end if;
  -- Only own schedule and an opaque notice token leave the server. No rival identity/GPS.
  return jsonb_build_object('serverNow',clock_timestamp(),'schedule',jsonb_build_object(
    'eventId',e.id,'scheduledAt',m.scheduled_at,'departedAt',m.departed_at,'enabled',e.enabled),
    'noticeId',case when m.acknowledged_at is null then m.notice_id else null end);
end $$;

create function public.dashboard_get_spacing()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'teamId',m.team_id,'eventId',e.id,'eventName',e.name,'enabled',e.enabled,'scheduledAt',m.scheduled_at,
    'departedAt',m.departed_at,'aheadTeamId',case when m.checked_at>now()-interval '15 seconds' then m.ahead_team_id end,
    'gapM',case when m.checked_at>now()-interval '15 seconds' then m.gap_m end,
    'closeSince',case when m.checked_at>now()-interval '15 seconds' then m.close_since end))
    from city_game.spacing_members m join city_game.spacing_events e on e.id=m.event_id),'[]'::jsonb);
end $$;

create function city_game.reset_spacing_departure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.started_at is not null and new.started_at is null then
    update city_game.spacing_members set departed_at=null,ahead_team_id=null,close_since=null,
      checked_at=null,notice_id=null,notice_at=null,acknowledged_at=null,gap_m=null where team_id=new.id;
  end if;
  return new;
end $$;
create trigger reset_spacing_departure after update of started_at on city_game.teams
for each row execute function city_game.reset_spacing_departure();
revoke all on function city_game.reset_spacing_departure() from public,anon,authenticated;

-- Preserve the existing game-start logic; enforce only scheduled starts, never proximity.
alter function public.start_or_resume_team_game(uuid,text) rename to start_or_resume_team_game_before_spacing;
alter function public.start_or_resume_team_game_before_spacing(uuid,text) set schema city_game;
revoke all on function city_game.start_or_resume_team_game_before_spacing(uuid,text) from public,anon,authenticated;
create function public.start_or_resume_team_game(p_session_id uuid,p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  v_result := public.get_team_spacing(p_session_id,false,null);
  if (v_result->'schedule'->>'enabled')::boolean and (v_result->'schedule'->>'departedAt') is null
    and (v_result->'schedule'->>'scheduledAt')::timestamptz > now() then raise exception 'START_NOT_RELEASED'; end if;
  v_result := city_game.start_or_resume_team_game_before_spacing(p_session_id,p_game_id);
  if (v_result->>'ok')::boolean then perform public.get_team_spacing(p_session_id,true,null); end if;
  return v_result;
end $$;

-- Report actual departure for elapsed time, also after a reload or a second device joins.
alter function city_game.team_state_json(uuid,uuid) rename to team_state_json_before_spacing;
create function city_game.team_state_json(p_team_id uuid,p_session_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_set(city_game.team_state_json_before_spacing(p_team_id,p_session_id),'{team,startedAt}',
    coalesce(to_jsonb((select coalesce(m.departed_at,t.started_at) from city_game.teams t
      left join city_game.spacing_members m on m.team_id=t.id where t.id=p_team_id)), 'null'::jsonb))
$$;
revoke all on function city_game.spacing_position(uuid),city_game.team_state_json(uuid,uuid),city_game.team_state_json_before_spacing(uuid,uuid) from public,anon,authenticated;
revoke all on function public.dashboard_plan_spacing(text,uuid[],timestamptz,integer,integer,uuid),public.dashboard_update_spacing(uuid,timestamptz,boolean,uuid),public.get_team_spacing(uuid,boolean,uuid),public.dashboard_get_spacing(),public.start_or_resume_team_game(uuid,text) from public,anon;
grant execute on function public.dashboard_plan_spacing(text,uuid[],timestamptz,integer,integer,uuid),public.dashboard_update_spacing(uuid,timestamptz,boolean,uuid),public.get_team_spacing(uuid,boolean,uuid),public.dashboard_get_spacing(),public.start_or_resume_team_game(uuid,text) to authenticated;

insert into city_game.spacing_route_segments values
('zoete-lieve-gerritje',0,367249.655136,5747725.814670,367260.195120,5747729.372910,0.000000,11.124403),
('zoete-lieve-gerritje',1,367260.195120,5747729.372910,367261.928670,5747736.711780,11.124403,7.540836),
('zoete-lieve-gerritje',2,367261.928670,5747736.711780,367267.822740,5747736.155805,18.665239,5.920234),
('zoete-lieve-gerritje',3,367267.822740,5747736.155805,367324.960548,5747731.152030,24.585473,57.356489),
('zoete-lieve-gerritje',4,367324.960548,5747731.152030,367367.675220,5747727.482595,81.941962,42.871995),
('zoete-lieve-gerritje',5,367367.675220,5747727.482595,367388.061768,5747725.703475,124.813957,20.464032),
('zoete-lieve-gerritje',6,367388.061768,5747725.703475,367407.130818,5747714.695170,145.277989,22.018434),
('zoete-lieve-gerritje',7,367407.130818,5747714.695170,367437.294588,5747712.804855,167.296423,30.222943),
('zoete-lieve-gerritje',8,367437.294588,5747712.804855,367457.126400,5747710.580955,197.519367,19.956114),
('zoete-lieve-gerritje',9,367457.126400,5747710.580955,367456.710348,5747705.354790,217.475481,5.242700),
('zoete-lieve-gerritje',10,367456.710348,5747705.354790,367497.275418,5747704.798815,222.718181,40.568880),
('zoete-lieve-gerritje',11,367497.275418,5747704.798815,367540.198116,5747705.577180,263.287061,42.929755),
('zoete-lieve-gerritje',12,367540.198116,5747705.577180,367569.529782,5747709.469005,306.216815,29.588730),
('zoete-lieve-gerritje',13,367569.529782,5747709.469005,367587.142650,5747713.027245,335.805545,17.968700),
('zoete-lieve-gerritje',14,367587.142650,5747713.027245,367569.529782,5747709.469005,353.774246,17.968700),
('zoete-lieve-gerritje',15,367569.529782,5747709.469005,367540.198116,5747705.577180,371.742946,29.588730),
('zoete-lieve-gerritje',16,367540.198116,5747705.577180,367547.062974,5747680.780695,401.331676,25.729204),
('zoete-lieve-gerritje',17,367547.062974,5747680.780695,367554.829278,5747652.537165,427.060880,29.291850),
('zoete-lieve-gerritje',18,367554.829278,5747652.537165,367554.205200,5747639.972130,456.352730,12.580524),
('zoete-lieve-gerritje',19,367554.205200,5747639.972130,367528.271292,5747637.303450,468.933253,26.070854),
('zoete-lieve-gerritje',20,367528.271292,5747637.303450,367501.713306,5747636.525085,495.004108,26.569390),
('zoete-lieve-gerritje',21,367501.713306,5747636.525085,367499.216994,5747636.413890,521.573497,2.498787),
('zoete-lieve-gerritje',22,367499.216994,5747636.413890,367507.468692,5747649.201315,524.072285,15.218698),
('binnendieze',0,367507.468692,5747649.201315,367498.731600,5747638.637790,0.000000,13.708568),
('binnendieze',1,367498.731600,5747638.637790,367501.713306,5747636.525085,13.708568,3.654325),
('binnendieze',2,367501.713306,5747636.525085,367528.271292,5747637.303450,17.362893,26.569390),
('binnendieze',3,367528.271292,5747637.303450,367554.205200,5747639.972130,43.932283,26.070854),
('binnendieze',4,367554.205200,5747639.972130,367562.179530,5747613.507720,70.003137,27.639735),
('binnendieze',5,367562.179530,5747613.507720,367554.274542,5747633.189235,97.642872,21.209688),
('binnendieze',6,367554.274542,5747633.189235,367562.318214,5747643.307980,118.852560,12.926317),
('binnendieze',7,367562.318214,5747643.307980,367598.722764,5747650.202070,131.778877,37.051582),
('binnendieze',8,367598.722764,5747650.202070,367618.831944,5747617.177155,168.830459,38.665542),
('binnendieze',9,367618.831944,5747617.177155,367624.726014,5747593.270230,207.496001,24.622777),
('binnendieze',10,367624.726014,5747593.270230,367634.988630,5747568.140160,232.118777,27.144828),
('binnendieze',11,367634.988630,5747568.140160,367639.426518,5747536.004805,259.263605,32.440344),
('binnendieze',12,367639.426518,5747536.004805,367644.696510,5747523.995745,291.703949,13.114509),
('binnendieze',13,367644.696510,5747523.995745,367702.458396,5747527.776375,304.818458,57.885479),
('binnendieze',14,367702.458396,5747527.776375,367708.421808,5747555.352735,362.703936,28.213789),
('binnendieze',15,367708.421808,5747555.352735,367716.257454,5747513.877000,390.917726,42.209406),
('binnendieze',16,367716.257454,5747513.877000,367749.680298,5747517.546435,433.127132,33.623671),
('binnendieze',17,367749.680298,5747517.546435,367782.340380,5747530.556250,466.750803,35.155885),
('binnendieze',18,367782.340380,5747530.556250,367808.551656,5747545.789965,501.906688,30.316614),
('binnendieze',19,367808.551656,5747545.789965,367827.065970,5747574.589470,532.223301,34.237280),
('binnendieze',20,367827.065970,5747574.589470,367841.835816,5747576.146200,566.460581,14.851658),
('binnendieze',21,367841.835816,5747576.146200,367859.101974,5747571.253620,581.312239,17.945962),
('binnendieze',22,367859.101974,5747571.253620,367864.302624,5747585.264190,599.258201,14.944659),
('binnendieze',23,367864.302624,5747585.264190,367869.919326,5747598.162810,614.202860,14.068466),
('binnendieze',24,367869.919326,5747598.162810,367874.010504,5747615.286840,628.271326,17.605969),
('binnendieze',25,367874.010504,5747615.286840,367877.200236,5747620.735395,645.877295,6.313568),
('binnendieze',26,367877.200236,5747620.735395,367881.430098,5747626.851120,652.190863,7.435982),
('binnendieze',27,367881.430098,5747626.851120,367872.484980,5747629.630995,659.626845,9.367115),
('bosch-wezen',0,367872.484980,5747629.630995,367880.944704,5747629.630995,0.000000,8.459724),
('bosch-wezen',1,367880.944704,5747629.630995,367881.430098,5747626.851120,8.459724,2.821934),
('bosch-wezen',2,367881.430098,5747626.851120,367877.200236,5747620.735395,11.281658,7.435982),
('bosch-wezen',3,367877.200236,5747620.735395,367873.594452,5747619.623445,18.717640,3.773342),
('bosch-wezen',4,367873.594452,5747619.623445,367869.919326,5747598.162810,22.490982,21.773043),
('bosch-wezen',5,367869.919326,5747598.162810,367864.718676,5747586.042555,44.264025,13.188910),
('bosch-wezen',6,367864.718676,5747586.042555,367860.280788,5747576.702175,57.452935,10.341061),
('bosch-wezen',7,367860.280788,5747576.702175,367857.992502,5747571.476010,67.793996,5.705178),
('bosch-wezen',8,367857.992502,5747571.476010,367847.799228,5747574.478275,73.499174,10.626214),
('bosch-wezen',9,367847.799228,5747574.478275,367836.704508,5747577.480540,84.125388,11.493755),
('bosch-wezen',10,367836.704508,5747577.480540,367810.770600,5747575.256640,95.619143,26.029086),
('bosch-wezen',11,367810.770600,5747575.256640,367791.354840,5747570.364060,121.648229,20.022714),
('bosch-wezen',12,367791.354840,5747570.364060,367772.632500,5747568.251355,141.670943,18.841166),
('sint-jan',0,367772.632500,5747568.251355,367794.128520,5747565.805065,0.000000,21.634769),
('sint-jan',1,367794.128520,5747565.805065,367817.704800,5747561.246070,21.634769,24.013026),
('sint-jan',2,367817.704800,5747561.246070,367854.248034,5747560.022925,45.647794,36.563698),
('sint-jan',3,367854.248034,5747560.022925,367879.835232,5747555.019150,82.211493,26.071871),
('sint-jan',4,367879.835232,5747555.019150,367907.780058,5747550.348960,108.283364,28.332384),
('sint-jan',5,367907.780058,5747550.348960,367911.593868,5747548.903425,136.615748,4.078568),
('sint-jan',6,367911.593868,5747548.903425,367908.334794,5747514.099390,140.694316,34.956293),
('sint-jan',7,367908.334794,5747514.099390,367909.652292,5747500.422405,175.650609,13.740295),
('sint-jan',8,367909.652292,5747500.422405,367903.966248,5747482.520010,189.390904,18.783686),
('sint-jan',9,367903.966248,5747482.520010,367899.875070,5747470.733340,208.174590,12.476511),
('sint-jan',10,367899.875070,5747470.733340,367901.608620,5747466.063150,220.651101,4.981553),
('sint-jan',11,367901.608620,5747466.063150,367914.298206,5747459.057865,225.632654,14.494813),
('sint-jan',12,367914.298206,5747459.057865,367942.520400,5747464.506420,240.127467,28.743329),
('sint-jan',13,367942.520400,5747464.506420,367946.819604,5747489.191710,268.870797,25.056869),
('sint-jan',14,367946.819604,5747489.191710,367939.608036,5747451.051825,293.927666,38.815687),
('sint-jan',15,367939.608036,5747451.051825,367983.570864,5747439.821130,332.743353,45.374649),
('sint-jan',16,367983.570864,5747439.821130,368032.942368,5747432.259870,378.118001,49.947153),
('sint-jan',17,368032.942368,5747432.259870,368032.110264,5747457.167550,428.065154,24.921575),
('sint-jan',18,368032.110264,5747457.167550,368036.132100,5747477.071455,452.986730,20.306171),
('sint-jan',19,368036.132100,5747477.071455,368032.110264,5747457.167550,473.292901,20.306171),
('sint-jan',20,368032.110264,5747457.167550,368032.873026,5747427.144900,493.599072,30.032338),
('sint-jan',21,368032.873026,5747427.144900,368096.945034,5747417.693325,523.631410,64.765380),
('sint-jan',22,368096.945034,5747417.693325,368099.510688,5747446.270440,588.396791,28.692056),
('kruithuis',0,368099.510688,5747446.270440,368130.021168,5747418.249300,0.000000,41.425520),
('kruithuis',1,368130.021168,5747418.249300,368163.652038,5747412.022380,41.425520,34.202485),
('kruithuis',2,368163.652038,5747412.022380,368170.516896,5747454.721260,75.628004,43.247204),
('kruithuis',3,368170.516896,5747454.721260,368143.334832,5747488.524540,118.875208,43.376564),
('kruithuis',4,368143.334832,5747488.524540,368144.791014,5747514.321780,162.251772,25.838306),
('kruithuis',5,368144.791014,5747514.321780,368115.667374,5747526.664425,188.090078,31.631113),
('kruithuis',6,368115.667374,5747526.664425,368131.061298,5747568.140160,219.721191,44.240360),
('kruithuis',7,368131.061298,5747568.140160,368149.922322,5747627.407095,263.961551,62.195722),
('kruithuis',8,368149.922322,5747627.407095,368163.652038,5747670.217170,326.157273,44.957843),
('kruithuis',9,368163.652038,5747670.217170,368155.955076,5747648.311755,371.115116,23.218321),
('kruithuis',10,368155.955076,5747648.311755,368103.809892,5747663.100690,394.333437,54.201779),
('kruithuis',11,368103.809892,5747663.100690,368067.336000,5747669.550000,448.535216,37.039687),
('kruithuis',12,368067.336000,5747669.550000,368071.080468,5747758.283610,485.574902,88.812581),
('kruithuis',13,368071.080468,5747758.283610,368053.744968,5747780.522610,574.387484,28.197388),
('kruithuis',14,368053.744968,5747780.522610,368035.785390,5747799.981735,602.584872,26.480257),
('kruithuis',15,368035.785390,5747799.981735,368038.489728,5747811.434820,629.065128,11.768033),
('kruithuis',16,368038.489728,5747811.434820,368067.058632,5747833.673820,640.833161,36.204356),
('kruithuis',17,368067.058632,5747833.673820,368100.481476,5747866.587540,677.037517,46.908416),
('kruithuis',18,368100.481476,5747866.587540,368193.538440,5747799.314565,723.945933,114.827051),
('kruithuis',19,368193.538440,5747799.314565,368100.481476,5747866.587540,838.772984,114.827051),
('kruithuis',20,368100.481476,5747866.587540,368147.703378,5747923.519380,953.600036,73.967171),
('kruithuis',21,368147.703378,5747923.519380,368173.706628,5747968.886940,1027.567207,52.291343),
('kruithuis',22,368173.706628,5747968.886940,368087.445180,5748031.378530,1079.858549,106.518713),
('kruithuis',23,368087.445180,5748031.378530,368047.018794,5748060.289230,1186.377262,49.700314),
('kruithuis',24,368047.018794,5748060.289230,367980.450474,5748094.982070,1236.077577,75.066200),
('kruithuis',25,367980.450474,5748094.982070,367870.959456,5748173.819325,1311.143777,134.920702),
('kruithuis',26,367870.959456,5748173.819325,367843.985418,5748136.346610,1446.064479,46.171453),
('kruithuis',27,367843.985418,5748136.346610,367887.601536,5748106.101570,1492.235932,53.076626),
('kruithuis',28,367887.601536,5748106.101570,367867.076304,5748076.078920,1545.312558,36.368182),
('bossche-brouwers',0,367867.076304,5748076.078920,367881.014046,5748096.761190,0.000000,24.940268),
('bossche-brouwers',1,367881.014046,5748096.761190,367867.423014,5748103.544085,24.940268,15.189596),
('bossche-brouwers',2,367867.423014,5748103.544085,367843.708050,5748095.982825,40.129863,24.891207),
('bossche-brouwers',3,367843.708050,5748095.982825,367819.369008,5748101.987355,65.021070,25.068772),
('bossche-brouwers',4,367819.369008,5748101.987355,367802.657586,5748077.858040,90.089842,29.351243),
('bossche-brouwers',5,367802.657586,5748077.858040,367772.632500,5748096.538800,119.441085,35.362078),
('bossche-brouwers',6,367772.632500,5748096.538800,367749.056220,5748115.219560,154.803164,30.080089),
('bossche-brouwers',7,367749.056220,5748115.219560,367761.676464,5748126.227865,184.883253,16.746741),
('bossche-brouwers',8,367761.676464,5748126.227865,367727.213490,5748163.700580,201.629994,50.910715),
('bossche-brouwers',9,367727.213490,5748163.700580,367716.326796,5748178.044735,252.540709,18.007634),
('bossche-brouwers',10,367716.326796,5748178.044735,367708.075098,5748160.142340,270.548344,19.712592),
('bossche-brouwers',11,367708.075098,5748160.142340,367684.914870,5748181.158195,290.260935,31.273988),
('bossche-brouwers',12,367684.914870,5748181.158195,367659.050304,5748219.965250,321.534923,46.636502),
('bossche-brouwers',13,367659.050304,5748219.965250,367632.908370,5748283.568790,368.171425,68.766351),
('bossche-brouwers',14,367632.908370,5748283.568790,367613.561952,5748305.585400,436.937776,29.308958),
('bossche-brouwers',15,367613.561952,5748305.585400,367620.010758,5748316.037730,466.246733,12.281625),
('bossche-brouwers',16,367620.010758,5748316.037730,367571.263332,5748273.561240,478.528358,64.657279),
('bossche-brouwers',17,367571.263332,5748273.561240,367516.205784,5748217.518960,543.185637,78.562528),
('bossche-brouwers',18,367516.205784,5748217.518960,367454.422062,5748156.917685,621.748165,86.543300),
('bossche-brouwers',19,367454.422062,5748156.917685,367444.922208,5748181.825365,708.291465,26.657827),
('bossche-brouwers',20,367444.922208,5748181.825365,367484.100438,5748211.403235,734.949292,49.089552),
('bossche-brouwers',21,367484.100438,5748211.403235,367520.227620,5748249.987900,784.038844,52.857825),
('bossche-brouwers',22,367520.227620,5748249.987900,367538.811276,5748282.123255,836.896669,37.121871),
('bossche-brouwers',23,367538.811276,5748282.123255,367511.005134,5748353.621640,874.018540,76.715061),
('bossche-brouwers',24,367511.005134,5748353.621640,367513.917498,5748368.188185,950.733601,14.854834),
('bossche-brouwers',25,367513.917498,5748368.188185,367503.030804,5748395.875740,965.588435,29.750980),
('bossche-brouwers',26,367503.030804,5748395.875740,367482.366888,5748437.462670,995.339415,46.437810),
('bossche-brouwers',27,367482.366888,5748437.462670,367463.367180,5748436.795500,1041.777225,19.011418);
notify pgrst, 'reload schema';
commit;
