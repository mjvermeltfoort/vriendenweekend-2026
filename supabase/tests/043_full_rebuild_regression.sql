select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
do $$ declare a jsonb; b jsonb; joined jsonb; sid uuid; rival_sid uuid; result jsonb; first_notice text;
begin
  a:=public.dashboard_create_team('Spacing integration A','ABCDEF','50000000-0000-0000-0000-000000000001');
  b:=public.dashboard_create_team('Spacing integration B','GHJKLM','50000000-0000-0000-0000-000000000001');
  perform public.dashboard_plan_spacing('Integration',array[(a->>'id')::uuid,(b->>'id')::uuid],now()+interval '1 hour',5,100,'50000000-0000-0000-0000-000000000001');
  joined:=public.join_team_by_code('ABCDEF','40000000-0000-0000-0000-000000000001','Test browser');
  if not (joined->>'ok')::boolean then raise exception 'join failed'; end if;
  sid:=(joined->'session'->>'id')::uuid;
  begin
    perform public.start_or_resume_team_game(sid,'drakenfontein');
    raise exception 'early start allowed';
  exception when others then if sqlerrm <> 'START_NOT_RELEASED' then raise; end if; end;
  perform public.dashboard_update_spacing((a->>'id')::uuid,now()-interval '1 minute',null,'50000000-0000-0000-0000-000000000001');
  perform public.get_team_spacing(sid,true);
  result:=public.get_team_state(sid);
  if result->'state'->'team'->>'startedAt' is null then raise exception 'actual departure missing from snapshot'; end if;
  joined:=public.join_team_by_code('GHJKLM','40000000-0000-0000-0000-000000000002','Rival browser');
  rival_sid:=(joined->'session'->>'id')::uuid;
  perform public.dashboard_update_spacing((b->>'id')::uuid,now()-interval '1 minute',null,'50000000-0000-0000-0000-000000000001');
  perform public.get_team_spacing(rival_sid,true);
  insert into city_game.spacing_route_segments values
    ('drakenfontein',0,5.3*69342,51.69*111195,5.306*69342,51.69*111195,0,.006*69342);
  insert into city_game.team_current_location(team_id,source_session_id,latitude,longitude,accuracy_m,captured_at) values
    ((a->>'id')::uuid,sid,51.69,5.300,5,now()),
    ((b->>'id')::uuid,rival_sid,51.69,5.301,5,now());
  perform public.get_team_spacing(sid);
  update city_game.spacing_members set close_since=now()-interval '31 seconds' where team_id=(a->>'id')::uuid;
  result:=public.get_team_spacing(sid);
  first_notice:=result->>'noticeId';
  if first_notice is null then raise exception 'first encounter did not warn'; end if;
  if (result->>'waitUntil')::timestamptz is distinct from now()+interval '1 minute' then
    raise exception 'first encounter did not grant a full minute';
  end if;
  result:=public.start_or_resume_team_game(sid,'drakenfontein');
  if result->'error'->>'code' is distinct from 'TEAM_SPACING_WAIT' then
    raise exception 'team wait did not block opening the challenge';
  end if;
  update city_game.spacing_members set wait_until=now()-interval '1 second' where team_id=(a->>'id')::uuid;
  if public.get_team_spacing(sid)->>'waitUntil' is not null then raise exception 'expired wait retained'; end if;
  result:=public.start_or_resume_team_game(sid,'drakenfontein');
  if result->'error'->>'code' = 'TEAM_SPACING_WAIT' then raise exception 'expired wait blocked opening'; end if;
  if public.get_team_spacing(sid)->>'noticeId' is distinct from first_notice then
    raise exception 'the same encounter was rearmed';
  end if;
  update city_game.team_current_location set longitude=5.303 where team_id=(b->>'id')::uuid;
  if public.get_team_spacing(sid)->>'noticeId' is not null then raise exception 'separation did not clear the notice'; end if;
  update city_game.team_current_location set longitude=5.301 where team_id=(b->>'id')::uuid;
  if public.get_team_spacing(sid)->>'waitUntil' is not null then raise exception 'brief proximity caused a second timeout'; end if;
  update city_game.spacing_members set close_since=now()-interval '31 seconds' where team_id=(a->>'id')::uuid;
  result:=public.get_team_spacing(sid);
  if result->>'noticeId' is null or result->>'noticeId'=first_notice or result->>'waitUntil' is null then
    raise exception 'new encounter did not cause a second timeout';
  end if;
  perform public.dashboard_reset_team_progress((a->>'id')::uuid,'50000000-0000-0000-0000-000000000001');
  if public.get_team_spacing(sid)->'schedule'->>'departedAt' is not null then raise exception 'reset retained departure'; end if;
  if has_table_privilege('authenticated','city_game.spacing_events','select')
    or has_table_privilege('authenticated','city_game.spacing_members','select')
    or has_table_privilege('anon','city_game.spacing_route_segments','insert') then raise exception 'data API privileges leaked'; end if;
end $$;
