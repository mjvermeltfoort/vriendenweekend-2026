insert into private.games (id, title, description, status, open_from, close_at, hint, max_points, display_order)
values
  ('mozaiek', 'Het gebroken zegel', 'Herstel het oude zegel en ontdek de eerste aanwijzing.', 'open', null, null, 'De oudste bewoner betaalt al eeuwen geen huur', 1000, 1),
  ('rebus', 'Het verzegelde bericht', 'Ontcijfer een cryptische rebus.', 'gesloten', null, null, 'Achter zware muren worden oude geheimen bewaakt', 800, 2),
  ('code', 'De viercijferige code', 'Vind de code met aanwijzingen uit eerdere spellen.', 'gesloten', null, null, 'De bestemming kon blijkbaar niet met één naam toe', 700, 3),
  ('memory', 'Het geheugenarchief', 'Vind alle kaartparen en onthul de verborgen aanwijzing.', 'gesloten', null, null, 'Niet alleen de antwoorden tellen; ook hun volgorde spreekt', 650, 4),
  ('vallende-stenen', 'De Vallende Stenen', 'Plaats de vallende stenen en maak 10 volledige rijen.', 'gesloten', null, null, 'Een rivier slingert zich zwijgend langs de bestemming', 900, 5),
  ('schaduwzoeker', 'Schaduwzoeker', 'Vind de zeven verschillen tussen het origineel en het schaduwbeeld.', 'gesloten', null, null, 'Hier waakt een abdij al eeuwen over haar omgeving', 850, 6),
  ('tussen-de-letters', 'Tussen de Letters', 'Vind de verborgen woorden en lees de aanwijzing tussen de letters.', 'gesloten', null, null, 'Een beroemde Brabantse bouwmeester liet hier zijn sporen na', 800, 7),
  ('vluchtroute', 'Vluchtroute', 'Ontwijk de obstakels en bereik de finish.', 'gesloten', null, null, 'Ge bent er sneller dan ge denkt. Tis nie ver', 900, 8),
  ('dwaalspoor', 'Dwaalspoor', 'Volg het verborgen pad, verzamel de symbolen en open de uitgang.', 'gesloten', null, null, 'De plaats werd pas één nadat twee buren hun namen samenvoegden', 850, 9),
  ('kettingreactie', 'Kettingreactie', 'Speel kleurgroepen weg en bevrijd de zes verzegelde letters.', 'gesloten', null, null, 'Zoek tussen ’s-Hertogenbosch en onze eigen achtertuin', 900, 10)
on conflict (id) do update set
  title = excluded.title, description = excluded.description, hint = excluded.hint,
  max_points = excluded.max_points, display_order = excluded.display_order, updated_at = now();
