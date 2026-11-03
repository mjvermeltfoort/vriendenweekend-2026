select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
do $$ declare a jsonb; b jsonb; joined jsonb; sid uuid; result jsonb;
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
  update city_game.spacing_members set notice_at=now(),wait_until=now()+interval '1 minute'
    where team_id=(a->>'id')::uuid;
  result:=public.get_team_spacing(sid);
  if (result->>'waitUntil')::timestamptz is distinct from now()+interval '1 minute' then
    raise exception 'team wait disappeared after proximity cleared';
  end if;
  result:=public.start_or_resume_team_game(sid,'drakenfontein');
  if result->'error'->>'code' is distinct from 'TEAM_SPACING_WAIT' then
    raise exception 'team wait did not block opening the challenge';
  end if;
  update city_game.spacing_members set wait_until=now()-interval '1 second' where team_id=(a->>'id')::uuid;
  if public.get_team_spacing(sid)->>'waitUntil' is not null then raise exception 'expired wait retained'; end if;
  result:=public.start_or_resume_team_game(sid,'drakenfontein');
  if result->'error'->>'code' = 'TEAM_SPACING_WAIT' then raise exception 'expired wait blocked opening'; end if;
  perform public.dashboard_reset_team_progress((a->>'id')::uuid,'50000000-0000-0000-0000-000000000001');
  if public.get_team_spacing(sid)->'schedule'->>'departedAt' is not null then raise exception 'reset retained departure'; end if;
  if has_table_privilege('authenticated','city_game.spacing_events','select')
    or has_table_privilege('authenticated','city_game.spacing_members','select')
    or has_table_privilege('anon','city_game.spacing_route_segments','insert') then raise exception 'data API privileges leaked'; end if;
end $$;
