-- De Halve Peer hangt aan de gevel boven de Binnendieze in de Molenstraat.
-- Kaartpunt Bossche Encyclopedie: 51.6888460326795, 5.30005800701746.
-- Corrigeert alleen deze schub; behoudt straal, zichtbaarheid, score en antwoorden.
-- Noodzakelijk naast de PWA-update: GPS-verificatie wordt op de server uitgevoerd.

update city_game.game_stops
set latitude = 51.688846,
    longitude = 5.300058
where game_slug = 'moerasdraak-den-bosch'
  and game_version = 1
  and stop_id = 'bonus:halve-peer'
  and is_bonus = true;
