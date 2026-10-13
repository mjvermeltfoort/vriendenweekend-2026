-- Forward-only correction; the existing composite RPC validates answer_spec.
-- Preserve GPS, game version, scoring, grants and existing team progress.
update city_game.game_stops
set answer_spec = jsonb_build_object(
  'kind', 'composite',
  'answer', jsonb_build_object('head', 'human', 'body', 'egg', 'object', 'trees')
)
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bosch-wezen'
  and is_bonus = false;
