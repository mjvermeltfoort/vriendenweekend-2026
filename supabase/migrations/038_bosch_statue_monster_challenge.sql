-- Het Monster van Bosch now takes place at August Falise's statue on the Markt.
-- Coordinates from Wikimedia monument map: 51°41'20.72"N, 5°18'13.5"E.
-- Confirm exact GPS point during the on-site route test.
-- Replace the old arbitrary composite with the illustrated monster combination.
-- Keep radius, accuracy, hint grants, scoring, progress and route order unchanged.

update city_game.game_stops
set latitude = 51.689089,
    longitude = 5.303750,
    answer_spec = jsonb_build_object(
      'kind', 'composite',
      'answer', jsonb_build_object(
        'head', 'Vogel',
        'body', 'Vis',
        'object', 'Mens'
      )
    )
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bosch-wezen'
  and is_bonus = false;
