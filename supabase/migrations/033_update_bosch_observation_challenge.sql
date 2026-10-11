-- Replace the placeholder Bosch composite puzzle with an on-site observation challenge.
-- Keep the existing stop id for compatibility with saved progress and route geometry.

update city_game.game_stops
set answer_spec = '{"kind":"choice","answer":"a"}'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bosch-wezen';
