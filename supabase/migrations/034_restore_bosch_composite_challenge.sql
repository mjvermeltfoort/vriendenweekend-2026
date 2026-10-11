-- Roll back migration 033: restore the original Bosch composite challenge answer spec.
-- This is a forward migration so environments that already applied 033 are repaired safely.

update city_game.game_stops
set answer_spec = '{"kind":"composite","answer":{"head":"Horn","body":"Schubben","object":"Lantaarn"}}'::jsonb
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bosch-wezen';
