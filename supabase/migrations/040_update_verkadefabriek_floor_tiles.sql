-- Verkadefabriek: replace the obvious chronology reorder with the historic floor-tile riddle.
-- Keep existing bonus ID, location, points, team progress, verification and hint IDs.
-- Correct choice is id 'a' in the client.
update city_game.game_stops
set answer_spec = '{"kind":"choice","answer":"a"}'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bonus:verkadefabriek'
  and is_bonus = true;
