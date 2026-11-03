-- Keep a single server deadline for every device on the team, even after proximity clears.
alter table city_game.spacing_members
  add column notice_schub_id text,
  add column wait_until timestamptz;

create or replace function public.get_team_spacing(p_session_id uuid, p_depart boolean default false, p_acknowledge uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_team uuid; m city_game.spacing_members%rowtype; e city_game.spacing_events%rowtype;
  v_ahead uuid; v_gap double precision; v_fresh boolean; v_schub text; v_wait_until timestamptz;
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
      select bonus.stop_id into v_schub
      from city_game.teams t
      join city_game.team_current_location loc on loc.team_id=t.id
      join city_game.game_stops bonus on bonus.game_slug=t.game_slug and bonus.game_version=t.game_version
        and bonus.is_bonus
      join (values
        ('bonus:bolwerk-sint-jan', 'zoete-lieve-gerritje'),
        ('bonus:halve-peer', 'binnendieze'),
        ('bonus:de-moriaan', 'bosch-wezen'),
        ('bonus:zwanenbroedershuis', 'kruithuis'),
        ('bonus:citadel', 'bossche-brouwers'),
        ('bonus:verkadefabriek', 'bossche-brouwers')
      ) as leg(stop_id, target_stop_id) on leg.stop_id=bonus.stop_id and leg.target_stop_id=t.current_stop_id
      left join city_game.progress progress on progress.team_id=t.id and progress.stop_id=bonus.stop_id
      cross join lateral (select city_game.distance_m(loc.latitude,loc.longitude,bonus.latitude,bonus.longitude) as meters) d
      where t.id=v_team and progress.state is distinct from 'completed'
        and city_game.team_can_see_bonus(t.id,bonus.stop_id) and d.meters <= 350
      order by d.meters, bonus.stop_id limit 1;

      update city_game.spacing_members set notice_id=gen_random_uuid(),notice_at=now(),acknowledged_at=null,
        notice_schub_id=v_schub,
        wait_until=case when v_schub is null then now()+interval '1 minute' end
        where team_id=v_team returning * into m;
    end if;
  end if;
  if e.enabled and m.departed_at is not null and m.notice_at >= m.departed_at and m.wait_until > now() then
    v_wait_until := m.wait_until;
  end if;
  -- Only own schedule and an opaque notice token leave the server. No rival identity/GPS.
  return jsonb_build_object('serverNow',clock_timestamp(),'schedule',jsonb_build_object(
    'eventId',e.id,'scheduledAt',m.scheduled_at,'departedAt',m.departed_at,'enabled',e.enabled),
    'noticeId',case when m.acknowledged_at is null then m.notice_id else null end,
    'schubId',case when m.notice_id is not null then m.notice_schub_id end,
    'waitUntil',v_wait_until);
end $$;

create or replace function public.start_or_resume_team_game(p_session_id uuid,p_game_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  v_result := public.get_team_spacing(p_session_id,false,null);
  if (v_result->'schedule'->>'enabled')::boolean and (v_result->'schedule'->>'departedAt') is null
    and (v_result->'schedule'->>'scheduledAt')::timestamptz > now() then raise exception 'START_NOT_RELEASED'; end if;
  if v_result->>'waitUntil' is not null then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','TEAM_SPACING_WAIT'));
  end if;
  v_result := city_game.start_or_resume_team_game_before_spacing(p_session_id,p_game_id);
  if (v_result->>'ok')::boolean then perform public.get_team_spacing(p_session_id,true,null); end if;
  return v_result;
end $$;
