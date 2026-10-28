#!/usr/bin/env bash
set -euo pipefail
# CI-only isolated database. Never use the production Supabase connection.
createdb spacing_rebuild
export PGDATABASE=spacing_rebuild
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/043_full_rebuild_bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/043_full_rebuild_regression.sql
