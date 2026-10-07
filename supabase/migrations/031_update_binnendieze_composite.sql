-- Update binnendieze stop to composite answer matching the app configuration
-- This keeps server-side answer validation in sync with the client game pack

update city_game.game_stops
set answer_spec = jsonb_build_object(
  'kind', 'composite',
  'answer', jsonb_build_object(
    'Oud', 'Bakstenen resten',
    'Modern', 'Stalen poort',
    'Spoor in straat', 'Blauwe stenen'
  )
)
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'binnendieze';
