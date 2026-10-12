-- Waterpoort (Herman Moerkerkpark): update server-validated answer to Marktstroom.
-- Replaces the composite choice from migration 031. Correct option is id 'a'.
-- Leave GPS, location verification, scores and hints unchanged.
update city_game.game_stops
set answer_spec = '{"kind":"choice","answer":"a"}'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'binnendieze';
