-- Team radio messages for push-to-talk communication between active team sessions.

create table if not exists city_game.team_radio_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references city_game.teams(id) on delete cascade,
  session_id uuid not null,
  sender_alias text not null check (length(trim(sender_alias)) > 0),
  storage_path text not null,
  mime_type text not null check (length(trim(mime_type)) > 0),
  duration_ms integer not null check (duration_ms >= 0),
  transcript text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint team_radio_messages_session_fkey
    foreign key (session_id, team_id)
    references city_game.team_sessions(id, team_id)
    on delete cascade
);

create index if not exists team_radio_messages_team_id_created_idx
  on city_game.team_radio_messages (team_id, created_at desc);

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
    team_id,
    session_id,
    sender_alias,
    storage_path,
    mime_type,
    duration_ms,
    transcript
  ) values (
    session_row.team_id,
    session_row.id,
    p_sender_alias,
    p_storage_path,
    coalesce(nullif(btrim(p_mime_type), ''), 'audio/webm'),
    greatest(coalesce(p_duration_ms, 1), 1),
    nullif(btrim(p_transcript), '')
  ) returning * into message_row;

  return jsonb_build_object(
    'ok', true,
    'message', jsonb_build_object(
      'id', message_row.id,
      'teamId', message_row.team_id,
      'sessionId', message_row.session_id,
      'senderAlias', message_row.sender_alias,
      'storagePath', message_row.storage_path,
      'mimeType', message_row.mime_type,
      'durationMs', message_row.duration_ms,
      'transcript', message_row.transcript,
      'createdAt', message_row.created_at,
      'expiresAt', message_row.expires_at
    )
  );
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

create or replace function city_game.has_team_radio_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    city_game.has_team_session(p_team_id)
    and auth.role() = 'authenticated'
  );
$$;

insert into storage.buckets (id, name, public)
select 'team-radio-messages', 'team-radio-messages', true
where not exists (select 1 from storage.buckets where id = 'team-radio-messages');

update storage.buckets
set public = true
where id = 'team-radio-messages' and not public;

drop policy if exists team_radio_messages_storage_upload on storage.objects;
create policy team_radio_messages_storage_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-radio-messages'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) <> ''
  and city_game.has_team_radio_access((split_part(name, '/', 1))::uuid)
);

drop policy if exists team_radio_messages_storage_read on storage.objects;
create policy team_radio_messages_storage_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'team-radio-messages'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) <> ''
  and city_game.has_team_radio_access((split_part(name, '/', 1))::uuid)
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'city_game'
      and tablename = 'team_radio_messages'
  ) then
    alter publication supabase_realtime add table city_game.team_radio_messages;
  end if;
end;
$$;

revoke all on function public.send_team_radio_message(uuid, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.get_team_radio_messages(uuid, integer) from public, anon, authenticated;
grant execute on function public.send_team_radio_message(uuid, text, text, integer, text, text) to authenticated;
grant execute on function public.get_team_radio_messages(uuid, integer) to authenticated;
grant execute on function city_game.has_team_radio_access(uuid) to authenticated;
