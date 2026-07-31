-- Dashboard-to-team radio messages and dashboard upload access.

alter table city_game.team_radio_messages
  alter column session_id drop not null;

alter table city_game.team_radio_messages
  add column if not exists sender_kind text not null default 'team';

update city_game.team_radio_messages
set sender_kind = 'team'
where sender_kind is null;

alter table city_game.team_radio_messages
  drop constraint if exists team_radio_messages_sender_kind_check;

alter table city_game.team_radio_messages
  add constraint team_radio_messages_sender_kind_check
  check (sender_kind in ('team', 'dashboard'));

create or replace function public.send_team_radio_message(
  p_session_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_duration_ms integer,
  p_sender_alias text,
  p_transcript text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  message_row city_game.team_radio_messages%rowtype;
begin
  if p_session_id is null then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception using errcode = 'P0001', message = 'INVALID_STEP_TRANSITION';
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

  insert into city_game.team_radio_messages (
    team_id, session_id, sender_alias, sender_kind, storage_path, mime_type, duration_ms, transcript
  ) values (
    session_row.team_id, session_row.id, p_sender_alias, 'team', p_storage_path,
    coalesce(nullif(btrim(p_mime_type), ''), 'audio/webm'),
    greatest(coalesce(p_duration_ms, 1), 1), nullif(btrim(p_transcript), '')
  ) returning * into message_row;

  return jsonb_build_object('ok', true, 'message', jsonb_build_object(
    'id', message_row.id,
    'teamId', message_row.team_id,
    'sessionId', message_row.session_id,
    'senderAlias', message_row.sender_alias,
    'senderKind', message_row.sender_kind,
    'storagePath', message_row.storage_path,
    'mimeType', message_row.mime_type,
    'durationMs', message_row.duration_ms,
    'transcript', message_row.transcript,
    'createdAt', message_row.created_at,
    'expiresAt', message_row.expires_at
  ));
end;
$$;

create or replace function public.get_team_radio_messages(
  p_session_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row city_game.team_sessions%rowtype;
  response jsonb;
begin
  select * into session_row
  from city_game.team_sessions session
  where session.id = p_session_id
    and session.auth_user_id = auth.uid()
    and session.revoked_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_REVOKED';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', message.id,
      'teamId', message.team_id,
      'sessionId', message.session_id,
      'senderAlias', message.sender_alias,
      'senderKind', message.sender_kind,
      'storagePath', message.storage_path,
      'mimeType', message.mime_type,
      'durationMs', message.duration_ms,
      'transcript', message.transcript,
      'createdAt', message.created_at,
      'expiresAt', message.expires_at
    ) order by message.created_at desc
  ), '[]'::jsonb)
  into response
  from (
    select *
    from city_game.team_radio_messages message
    where message.team_id = session_row.team_id
    order by message.created_at desc
    limit greatest(coalesce(p_limit, 20), 1)
  ) message;

  return jsonb_build_object('ok', true, 'messages', response);
end;
$$;

create or replace function city_game.has_dashboard_radio_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'authenticated'
    and exists (
      select 1
      from city_game.teams team
      where team.id = p_team_id
        and team.game_slug = 'moerasdraak-den-bosch'
        and team.game_version = 1
    );
$$;

create or replace function public.dashboard_get_team_radio_messages(
  p_team_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
begin
  perform city_game.assert_dashboard_team(p_team_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', message.id,
      'teamId', message.team_id,
      'sessionId', message.session_id,
      'senderAlias', message.sender_alias,
      'senderKind', message.sender_kind,
      'storagePath', message.storage_path,
      'mimeType', message.mime_type,
      'durationMs', message.duration_ms,
      'transcript', message.transcript,
      'createdAt', message.created_at,
      'expiresAt', message.expires_at
    ) order by message.created_at desc
  ), '[]'::jsonb)
  into response
  from (
    select *
    from city_game.team_radio_messages message
    where message.team_id = p_team_id
    order by message.created_at desc
    limit greatest(coalesce(p_limit, 50), 1)
  ) message;

  return jsonb_build_object('ok', true, 'messages', response);
end;
$$;

create or replace function public.dashboard_send_team_radio_message(
  p_team_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_duration_ms integer,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_row city_game.team_radio_messages%rowtype;
  expected_prefix text := p_team_id::text || '/dashboard/';
begin
  perform city_game.assert_dashboard_team(p_team_id);

  if p_client_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_storage_path is null
    or btrim(p_storage_path) = ''
    or left(p_storage_path, length(expected_prefix)) <> expected_prefix then
    raise exception using errcode = 'P0001', message = 'INVALID_STEP_TRANSITION';
  end if;

  insert into city_game.team_radio_messages (
    team_id, session_id, sender_alias, sender_kind, storage_path, mime_type, duration_ms
  ) values (
    p_team_id, null, 'Meldkamer', 'dashboard', p_storage_path,
    coalesce(nullif(btrim(p_mime_type), ''), 'audio/webm'),
    greatest(coalesce(p_duration_ms, 1), 1)
  ) returning * into message_row;

  perform city_game.dashboard_audit(
    p_team_id,
    'team_radio_sent_from_dashboard',
    p_client_id,
    jsonb_build_object('messageId', message_row.id, 'durationMs', message_row.duration_ms)
  );

  return jsonb_build_object('ok', true, 'message', jsonb_build_object(
    'id', message_row.id,
    'teamId', message_row.team_id,
    'sessionId', message_row.session_id,
    'senderAlias', message_row.sender_alias,
    'senderKind', message_row.sender_kind,
    'storagePath', message_row.storage_path,
    'mimeType', message_row.mime_type,
    'durationMs', message_row.duration_ms,
    'transcript', message_row.transcript,
    'createdAt', message_row.created_at,
    'expiresAt', message_row.expires_at
  ));
end;
$$;

drop policy if exists team_radio_messages_storage_upload on storage.objects;
create policy team_radio_messages_storage_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-radio-messages'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) <> ''
  and (
    city_game.has_team_radio_access((split_part(name, '/', 1))::uuid)
    or (
      split_part(name, '/', 2) = 'dashboard'
      and city_game.has_dashboard_radio_access((split_part(name, '/', 1))::uuid)
    )
  )
);

revoke all on function public.dashboard_get_team_radio_messages(uuid, integer) from public, anon, authenticated;
revoke all on function public.dashboard_send_team_radio_message(uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.dashboard_get_team_radio_messages(uuid, integer) to authenticated;
grant execute on function public.dashboard_send_team_radio_message(uuid, text, text, integer, uuid) to authenticated;
grant execute on function city_game.has_dashboard_radio_access(uuid) to authenticated;
