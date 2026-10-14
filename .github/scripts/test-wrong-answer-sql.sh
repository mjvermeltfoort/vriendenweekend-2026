#!/usr/bin/env bash
set -euo pipefail
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/042_wrong_answer_fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/042_wrong_answer_cooldown.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/042_wrong_answer_regression.sql

# Two actual database connections submit the same stale run version. The first
# keeps the row locked briefly; the second must not create another penalty.
psql -X -v ON_ERROR_STOP=1 <<'SQL' &
begin;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.update_team_game_state('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0,'submit_answer','{"answer":"no"}');
select pg_sleep(1);
commit;
SQL
first=$!
psql -X -v ON_ERROR_STOP=1 <<'SQL'
select pg_sleep(.2);
begin;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
select public.update_team_game_state('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',0,'submit_answer','{"answer":"no"}');
commit;
SQL
wait "$first"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if (select score from city_game.teams where id='00000000-0000-0000-0000-000000000001') <> -25
    or (select count(*) from city_game.events where event_type='wrong_answer') <> 1
    or (select version from city_game.team_game_runs where id='30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'concurrent submissions caused duplicate penalties';
  end if;
end; $$;
SQL
