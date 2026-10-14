-- Citadel / Papenbril: replace the opaque lens puzzle with a historical choice question.
-- Keep stop id, game version, location, rewards, hint ids, verification and team progress unchanged.
-- The correct choice is 'a' (displayed third in the client).
update city_game.game_stops
set answer_spec = '{"kind":"choice","answer":"a"}'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bonus:citadel'
  and is_bonus = true;
