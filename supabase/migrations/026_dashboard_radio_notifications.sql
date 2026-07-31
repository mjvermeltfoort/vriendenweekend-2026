-- Public dashboard projection for reliable team-radio notifications.

create table if not exists public.dashboard_radio_notifications (
  message_id uuid primary key references city_game.team_radio_messages(id) on delete cascade,
  team_id uuid not null references city_game.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.dashboard_radio_notifications enable row level security;

drop policy if exists dashboard_radio_notifications_authenticated_read
on public.dashboard_radio_notifications;
create policy dashboard_radio_notifications_authenticated_read
on public.dashboard_radio_notifications
for select
to authenticated
using (true);

revoke all on public.dashboard_radio_notifications from public, anon;
grant select on public.dashboard_radio_notifications to authenticated;

create or replace function city_game.notify_dashboard_team_radio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_kind = 'team' then
    insert into public.dashboard_radio_notifications (message_id, team_id, created_at)
    values (new.id, new.team_id, new.created_at)
    on conflict (message_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists dashboard_radio_notification_on_insert
on city_game.team_radio_messages;
create trigger dashboard_radio_notification_on_insert
after insert on city_game.team_radio_messages
for each row execute function city_game.notify_dashboard_team_radio();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dashboard_radio_notifications'
  ) then
    alter publication supabase_realtime add table public.dashboard_radio_notifications;
  end if;
end;
$$;

revoke all on function city_game.notify_dashboard_team_radio() from public, anon, authenticated;
