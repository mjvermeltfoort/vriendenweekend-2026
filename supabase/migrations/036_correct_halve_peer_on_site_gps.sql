-- Exact GPS-punt van De Halve Peer, vastgesteld bij test op locatie.
-- Vervangt het onnauwkeurige monumentenkaartpunt uit migratie 035.
-- Op zes decimalen afgerond (minder dan 10 cm afwijking t.o.v. GPS-meting).
-- De schub ligt circa 22 meter van Zoete Lieve Gerritje; GPS-selectie
-- wordt in de app voorzichtig behandeld. Andere spelgegevens blijven gelijk.

update city_game.game_stops
set latitude = 51.689618,
    longitude = 5.299956
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bonus:halve-peer'
  and is_bonus = true;
