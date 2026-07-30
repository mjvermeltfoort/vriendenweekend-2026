-- Enable observation fallback questions for all stops.
-- Sets requires_on_site_validation = false so teams can see and answer
-- verification questions automatically when GPS fails, without requiring
-- a dashboard override (stop release) by an admin.

update city_game.stop_observation_questions
set requires_on_site_validation = false
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1;
