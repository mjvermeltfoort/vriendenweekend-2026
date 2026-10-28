begin;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
update city_game.progress set started_at=null,state='available';
delete from city_game.team_game_runs;
select public.dashboard_plan_spacing('Test event',array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::uuid[],now()+interval '1 hour',5,100,'50000000-0000-0000-0000-000000000001');
do $$ declare v_status jsonb; v_notice uuid; v_depart timestamptz;
begin
  if (select max(scheduled_at)-min(scheduled_at) from city_game.spacing_members) <> interval '5 minutes' then raise exception 'slots not staggered'; end if;
  begin
    perform public.get_team_spacing('10000000-0000-0000-0000-000000000003');
    raise exception 'rival session accepted';
  exception when others then if sqlerrm <> 'SESSION_REVOKED' then raise; end if; end;
  begin
    perform public.start_or_resume_team_game('10000000-0000-0000-0000-000000000001','main');
    raise exception 'early start allowed';
  exception when others then if sqlerrm <> 'START_NOT_RELEASED' then raise; end if; end;
  perform public.dashboard_update_spacing('00000000-0000-0000-0000-000000000001',now()-interval '1 minute',null,'50000000-0000-0000-0000-000000000001');
  v_status := public.get_team_spacing('10000000-0000-0000-0000-000000000001',true);
  v_depart := (v_status->'schedule'->>'departedAt')::timestamptz;
  if v_depart is null then raise exception 'departure not recorded'; end if;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000002',true);
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  if (select departed_at from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') <> v_depart then raise exception 'second device reset clock'; end if;
  if city_game.team_state_json('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001')->'team'->>'startedAt' is null then raise exception 'departure missing from team snapshot'; end if;
  update city_game.spacing_members set scheduled_at=now()-interval '1 minute',departed_at=now() where team_id='00000000-0000-0000-0000-000000000002';
  -- A straight 400m test corridor: same target, 69m route gap, GPS +/- 5m.
  insert into city_game.spacing_route_segments values('main',0,5.3*69342,51.69*111195,5.306*69342,51.69*111195,0,.006*69342);
  insert into city_game.team_current_location(team_id,source_session_id,latitude,longitude,accuracy_m,captured_at,selected_at) values
    ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',51.69,5.300,5,now(),now()),
    ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',51.69,5.301,5,now(),now());
  v_status:=public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if v_status->>'noticeId' is not null then raise exception 'transient proximity warned'; end if;
  update city_game.spacing_members set close_since=now()-interval '31 seconds' where team_id='00000000-0000-0000-0000-000000000001';
  v_status:=public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  v_notice:=(v_status->>'noticeId')::uuid;
  if v_notice is null then raise exception 'sustained proximity not detected'; end if;
  if v_status::text like '%00000000-0000-0000-0000-000000000002%' or v_status::text like '%latitude%' then raise exception 'rival data leaked'; end if;
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
  v_status:=public.get_team_spacing('10000000-0000-0000-0000-000000000002',false,v_notice);
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  if v_status->>'noticeId' is not null then raise exception 'shared dismissal not respected'; end if;
  -- A telemetry gap cannot count as 30 uninterrupted seconds.
  update city_game.spacing_members set checked_at=now()-interval '20 seconds',close_since=now()-interval '1 minute' where team_id='00000000-0000-0000-0000-000000000001';
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if (select close_since from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') < now()-interval '1 second' then raise exception 'gap did not reset observation'; end if;
  update city_game.team_current_location set captured_at=now()-interval '31 seconds' where team_id='00000000-0000-0000-0000-000000000002';
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if (select ahead_team_id from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') is not null then raise exception 'stale GPS accepted'; end if;
  update city_game.team_current_location set captured_at=now(),accuracy_m=90;
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if (select ahead_team_id from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') is not null then raise exception 'inaccurate GPS accepted'; end if;
  update city_game.team_current_location set accuracy_m=5;
  -- Same physical stop: earlier verified arrival establishes who is occupying it.
  insert into city_game.progress(team_id,stop_id,state,arrived_at) values('00000000-0000-0000-0000-000000000002','main','started',now()-interval '1 minute')
    on conflict(team_id,stop_id) do update set state='started',arrived_at=excluded.arrived_at;
  update city_game.team_current_location set longitude=5.300;
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if (select ahead_team_id from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') is null then raise exception 'occupied stop not detected'; end if;
  insert into city_game.spacing_events(id,name) values('60000000-0000-0000-0000-000000000001','Other event');
  update city_game.spacing_members set event_id='60000000-0000-0000-0000-000000000001' where team_id='00000000-0000-0000-0000-000000000002';
  perform public.get_team_spacing('10000000-0000-0000-0000-000000000001');
  if (select ahead_team_id from city_game.spacing_members where team_id='00000000-0000-0000-0000-000000000001') is not null then raise exception 'different events compared'; end if;
  if has_table_privilege('authenticated','city_game.spacing_members','select') or has_table_privilege('anon','city_game.spacing_events','insert')
    or has_function_privilege('authenticated','city_game.start_or_resume_team_game_before_spacing(uuid,text)','execute')
    or has_function_privilege('anon','public.get_team_spacing(uuid,boolean,uuid)','execute')
    then raise exception 'excess privileges'; end if;
  perform public.dashboard_update_spacing('00000000-0000-0000-0000-000000000001',null,false,'50000000-0000-0000-0000-000000000001');
  if (public.get_team_spacing('10000000-0000-0000-0000-000000000001')->'schedule'->>'enabled')::boolean then raise exception 'disable failed'; end if;
end $$;
rollback;
