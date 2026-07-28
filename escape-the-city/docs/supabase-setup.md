# Supabase setup

1. Create Supabase project.
2. Enable Anonymous auth.
3. Run root migration `supabase/migrations/015_city_game_schema.sql`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
5. Test `join_city_game_team(join_code)` with anon user.
6. Verify RLS: owner/member can read, others cannot.
