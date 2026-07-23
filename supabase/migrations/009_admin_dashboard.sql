-- 009_admin_dashboard.sql
-- Voegt beheerdersrol en dashboardtoegang toe voor dashboard.html.
--
-- VEREISTE SETUP NA HET UITVOEREN VAN DEZE MIGRATIE:
-- 1. Maak een beheerdersaccount aan via Supabase Dashboard:
--    Authentication → Users → Add user (kies "Email & Password")
-- 2. Voeg de beheerdersrol toe via de Supabase SQL-editor:
--    INSERT INTO public.profiles (user_id, role)
--    VALUES ('<uuid uit stap 1>', 'admin');
-- Gebruik NOOIT de service-role key in frontendcode.
--
-- ROW LEVEL SECURITY:
-- • public.profiles heeft RLS ingeschakeld; gebruikers mogen alleen hun
--   eigen rij lezen (voor de zelfcontrole in check_admin_access()).
-- • get_dashboard_data() is SECURITY DEFINER en voert de beheerderscheck
--   intern uit voordat het private.* tabellen raadpleegt. Aanvallers die de
--   JavaScript-controle omzeilen stoten alsnog op deze servercontrole.
-- • De bestaande RLS op private.* tabellen wordt niet gewijzigd.

-- ============================================================
-- 1. Profielen-tabel voor rolbeheer
-- ============================================================
create table if not exists public.profiles (
  user_id    uuid        primary key
               references auth.users(id) on update cascade on delete cascade,
  role       text        not null default 'user'
               check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Gebruikers mogen alleen hun eigen profiel lezen (voor de beheerderscheck).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- Geen insert/update/delete policies — beheer uitsluitend via Supabase Dashboard of SQL-editor.
revoke all on table public.profiles from public, anon;
grant select on table public.profiles to authenticated;

-- ============================================================
-- 2. Beheerderscheck-functie
-- ============================================================
-- Geeft true terug als de ingelogde gebruiker de rol 'admin' heeft.
create or replace function public.check_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where user_id = auth.uid()),
    false
  )
$$;

revoke all on function public.check_admin_access() from public;
grant execute on function public.check_admin_access() to authenticated;

-- ============================================================
-- 3. Dashboard-datafunctie
-- ============================================================
-- Geeft alle dashboardgegevens terug in één aanroep.
-- Toegang is beperkt tot gebruikers met role = 'admin' in public.profiles.
-- De functie is SECURITY DEFINER en voert de beheerderscheck intern uit.
create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Niet ingelogd.';
  end if;
  if not exists(
    select 1 from public.profiles where user_id = v_uid and role = 'admin'
  ) then
    raise exception 'Geen beheerderstoegang.';
  end if;

  return jsonb_build_object(
    'games', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',           g.id,
            'title',        g.title,
            'status',       g.status,
            'openFrom',     g.open_from,
            'closeAt',      g.close_at,
            'maxPoints',    g.max_points,
            'displayOrder', g.display_order
          ) order by g.display_order
        ),
        '[]'::jsonb
      )
      from private.games g
    ),
    'players', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'userId',     p.user_id,
            'name',       p.name,
            'createdAt',  p.created_at,
            'lastSeenAt', p.last_seen_at
          ) order by p.created_at
        ),
        '[]'::jsonb
      )
      from private.players p
    ),
    'starts', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',         gs.id,
            'userId',     gs.user_id,
            'playerName', gs.player_name,
            'gameId',     gs.game_id,
            'status',     gs.status,
            'startedAt',  gs.started_at
          ) order by gs.started_at desc
        ),
        '[]'::jsonb
      )
      from private.game_starts gs
    ),
    'scores', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',         s.id,
            'userId',     s.user_id,
            'playerName', s.player_name,
            'gameId',     s.game_id,
            'score',      s.score,
            'seconds',    s.seconds,
            'attempts',   s.attempts,
            'createdAt',  s.created_at
          ) order by s.created_at desc
        ),
        '[]'::jsonb
      )
      from private.scores s
    )
  );
end;
$$;

revoke all on function public.get_dashboard_data() from public;
grant execute on function public.get_dashboard_data() to authenticated;
