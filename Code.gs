/**
 * Vriendenweekend 2026 - Google Apps Script JSON API
 *
 * GET  ?action=state&playerName=Mark
 * GET  ?action=access&gameId=mozaiek&playerName=Mark
 * POST action=start  + payload={...}
 * POST action=heartbeat + payload={...}
 * POST action=replay + payload={...}
 * POST action=score  + payload={...}
 *
 * Gebruik voor POST vanuit GitHub Pages bij voorkeur URLSearchParams.
 */

const SETTINGS_SHEET = 'Spellen';
const SCORES_SHEET = 'Scores';
const STARTS_SHEET = 'Spelstarts';
const API_VERSION = '1.5.0';
const ACTIVE_PLAYERS_PROPERTY = 'activePlayers';
const ACTIVE_PLAYER_WINDOW_MS = 30 * 1000;
const GAMES_CACHE_KEY = 'games:v1';
const LEADERBOARD_CACHE_KEY = 'leaderboard:v1';
const COMPLETED_CACHE_PREFIX = 'completed:v1:';
const GAMES_CACHE_SECONDS = 60;
const LEADERBOARD_CACHE_SECONDS = 30;
const COMPLETED_CACHE_SECONDS = 60;

let spreadsheetInstance_ = null;

function getSpreadsheet_() {
  if (!spreadsheetInstance_) {
    spreadsheetInstance_ = SpreadsheetApp.getActiveSpreadsheet();
  }
  return spreadsheetInstance_;
}

/**
 * Publieke GET-ingang van de web-app.
 */
function doGet(e) {
  return handleApiRequest_('GET', e);
}

/**
 * Publieke POST-ingang van de web-app.
 */
function doPost(e) {
  return handleApiRequest_('POST', e);
}

/**
 * Routeert alle API-verzoeken en zorgt voor een consistente JSON-response.
 * Apps Script Web Apps kunnen geen eigen HTTP-statuscode instellen, daarom
 * bevat iedere response een success-veld.
 */
function handleApiRequest_(method, e) {
  try {
    const request = parseApiRequest_(e);
    const action = normalizeAction_(request.action);
    let data;

    switch (action) {
      case 'health':
        data = {
          status: 'ok',
          version: API_VERSION,
          webAppUrl: getWebAppUrl()
        };
        break;

      case 'state':
      case 'publicstate':
      case 'getpublicstate':
        requireMethod_(method, 'GET');
        data = getPublicState(
          request.params.playerName ||
          request.params.name ||
          request.payload.playerName ||
          request.payload.name ||
          ''
        );
        break;

      case 'access':
      case 'gameaccess':
      case 'getgameaccess':
        requireMethod_(method, 'GET');
        data = getGameAccess(
          String(request.params.gameId || request.payload.gameId || '').trim(),
          request.params.playerName ||
          request.params.name ||
          request.payload.playerName ||
          request.payload.name ||
          ''
        );
        break;

      case 'start':
      case 'registergamestart':
        requireMethod_(method, 'POST');
        data = registerGameStart(request.payload);
        break;

      case 'heartbeat':
      case 'gameheartbeat':
        requireMethod_(method, 'POST');
        data = registerGameHeartbeat(request.payload);
        break;

      case 'replay':
      case 'resetgameprogress':
        requireMethod_(method, 'POST');
        data = resetGameProgress(request.payload);
        break;

      case 'score':
      case 'submitscore':
        requireMethod_(method, 'POST');
        data = submitScore(request.payload);
        break;

      default:
        throw new Error(
          'Onbekende API-actie. Gebruik health, state, access, start, heartbeat, replay of score.'
        );
    }

    return jsonResponse_({
      success: true,
      data: data,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);

    return jsonResponse_({
      success: false,
      data: null,
      error: error && error.message ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Ondersteunt zowel:
 * - URLSearchParams: action=score&payload={...}
 * - JSON body: { "action": "score", "payload": { ... } }
 */
function parseApiRequest_(e) {
  const params = Object.assign({}, (e && e.parameter) || {});
  const postData = e && e.postData ? e.postData : null;
  const rawBody = postData && postData.contents
    ? String(postData.contents).trim()
    : '';
  const contentType = postData && postData.type
    ? String(postData.type).toLowerCase()
    : '';

  let body = {};

  if (rawBody && contentType.indexOf('application/json') !== -1) {
    body = parseJsonObject_(rawBody, 'Ongeldige JSON-body.');
  }

  let payload = {};

  if (params.payload) {
    payload = parseJsonObject_(params.payload, 'Ongeldige JSON in payload.');
  } else if (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) {
    payload = body.payload;
  } else if (body && typeof body === 'object' && !Array.isArray(body)) {
    payload = Object.assign({}, body);
    delete payload.action;
  }

  return {
    action: params.action || body.action || '',
    params: params,
    payload: payload
  };
}

function parseJsonObject_(value, errorMessage) {
  try {
    const result = JSON.parse(String(value));
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error(errorMessage);
    }
    return result;
  } catch (error) {
    throw new Error(errorMessage);
  }
}

function normalizeAction_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function requireMethod_(actualMethod, expectedMethod) {
  if (actualMethod !== expectedMethod) {
    throw new Error('Deze actie vereist een ' + expectedMethod + '-verzoek.');
  }
}

function jsonResponse_(response) {
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Geeft de URL van de actieve web-appdeployment terug.
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Maakt of reset de benodigde werkbladen.
 */
function setup() {
  const ss = getSpreadsheet_();

  let games = ss.getSheetByName(SETTINGS_SHEET);
  if (!games) games = ss.insertSheet(SETTINGS_SHEET);
  games.clear();
  games.getRange(1, 1, 1, 9).setValues([[
    'id', 'titel', 'omschrijving', 'status', 'open_vanaf', 'sluit_op', 'hint', 'max_punten', 'volgorde'
  ]]);
  games.getRange(2, 1, 8, 9).setValues([
    ['mozaiek', 'Het gebroken zegel', 'Herstel het oude zegel en ontdek de eerste aanwijzing.', 'open', '', '', 'Waar oude muren verhalen bewaren.', 1000, 1],
    ['rebus', 'Het verzegelde bericht', 'Ontcijfer een cryptische rebus.', 'gesloten', '', '', 'Een plek waar muren verhalen bewaren.', 800, 2],
    ['code', 'De viercijferige code', 'Vind de code met aanwijzingen uit eerdere spellen.', 'gesloten', '', '', 'Twee namen, maar één bestemming.', 700, 3],
    ['memory', 'Het geheugenarchief', 'Vind alle kaartparen en onthul de verborgen aanwijzing.', 'gesloten', '', '', 'Soms onthult volgorde wat stilte verbergt.', 650, 4],
    ['vluchtroute', 'Vluchtroute', 'Ontwijk de obstakels en bereik de finish.', 'gesloten', '', '', 'BOSPAD', 900, 5],
    ['vallende-stenen', 'De Vallende Stenen', 'Plaats de vallende stenen en maak 10 volledige rijen.', 'gesloten', '', '', 'ONDER DE OUDE BRUG', 900, 6],
    ['schaduwzoeker', 'Schaduwzoeker', 'Vind de zeven verschillen tussen het origineel en het schaduwbeeld.', 'gesloten', '', '', 'ACHTER DE ZEVENDE SCHADUW', 850, 7],
    ['tussen-de-letters', 'Tussen de Letters', 'Vind de verborgen woorden en lees de aanwijzing tussen de letters.', 'gesloten', '', '', 'ZOEK DE KIST ACHTER HET GORDIJN IN DE GROTE KAMER', 800, 8]
  ]);
  games.setFrozenRows(1);
  games.autoResizeColumns(1, 9);

  let scores = ss.getSheetByName(SCORES_SHEET);
  if (!scores) scores = ss.insertSheet(SCORES_SHEET);
  scores.clear();
  scores.getRange(1, 1, 1, 8).setValues([[
    'tijdstip', 'naam', 'spel_id', 'spel', 'punten', 'speeltijd_seconden', 'pogingen', 'detail'
  ]]);
  scores.setFrozenRows(1);
  scores.autoResizeColumns(1, 8);

  const starts = getOrCreateStartsSheet_();
  starts.clear();
  starts.getRange(1, 1, 1, 7).setValues([[
    'tijdstip', 'naam', 'spel_id', 'spel', 'status', 'bron', 'apparaat'
  ]]);
  starts.setFrozenRows(1);
  starts.autoResizeColumns(1, 7);

  clearDataCaches_();

  return 'Installatie voltooid. Publiceer het script opnieuw als web-app.';
}

/**
 * Voegt De Vallende Stenen toe aan een bestaande installatie zonder scores
 * of andere spelinstellingen te wissen. Voer deze functie één keer handmatig uit.
 */
function addVallendeStenenGame() {
  const ss = getSpreadsheet_();
  const games = ss.getSheetByName(SETTINGS_SHEET);
  if (!games) throw new Error('Voer eerst setup() uit.');

  const ids = games.getLastRow() > 1
    ? games.getRange(2, 1, games.getLastRow() - 1, 1).getDisplayValues().flat()
    : [];
  if (ids.some(id => String(id).trim() === 'vallende-stenen')) return;

  games.appendRow([
    'vallende-stenen',
    'De Vallende Stenen',
    'Plaats de vallende stenen en maak 10 volledige rijen.',
    'gesloten',
    '',
    '',
    'ONDER DE OUDE BRUG',
    900,
    6
  ]);
  clearGamesCache_();
}

/**
 * Voegt Schaduwzoeker toe aan een bestaande installatie zonder scores
 * of andere spelinstellingen te wissen. Voer deze functie één keer handmatig uit.
 */
function addSchaduwzoekerGame() {
  const ss = getSpreadsheet_();
  const games = ss.getSheetByName(SETTINGS_SHEET);
  if (!games) throw new Error('Voer eerst setup() uit.');

  const ids = games.getLastRow() > 1
    ? games.getRange(2, 1, games.getLastRow() - 1, 1).getDisplayValues().flat()
    : [];
  if (ids.some(id => String(id).trim() === 'schaduwzoeker')) return;

  games.appendRow([
    'schaduwzoeker',
    'Schaduwzoeker',
    'Vind de zeven verschillen tussen het origineel en het schaduwbeeld.',
    'gesloten',
    '',
    '',
    'ACHTER DE ZEVENDE SCHADUW',
    850,
    7
  ]);
  clearGamesCache_();
}

/**
 * Voegt Tussen de Letters toe aan een bestaande installatie zonder scores
 * of andere spelinstellingen te wissen. Voer deze functie één keer handmatig uit.
 */
function addTussenDeLettersGame() {
  const ss = getSpreadsheet_();
  const games = ss.getSheetByName(SETTINGS_SHEET);
  if (!games) throw new Error('Voer eerst setup() uit.');

  const ids = games.getLastRow() > 1
    ? games.getRange(2, 1, games.getLastRow() - 1, 1).getDisplayValues().flat()
    : [];
  if (ids.some(id => String(id).trim() === 'tussen-de-letters')) return;

  games.appendRow([
    'tussen-de-letters',
    'Tussen de Letters',
    'Vind de verborgen woorden en lees de aanwijzing tussen de letters.',
    'gesloten',
    '',
    '',
    'ZOEK DE KIST ACHTER HET GORDIJN IN DE GROTE KAMER',
    800,
    8
  ]);
  clearGamesCache_();
}

function getPublicState(playerName) {
  const games = readGames_();
  const scoreSnapshot = getScoreSnapshot_(playerName || '');

  return {
    games: games.map(game => serializeGame_(game, scoreSnapshot.completed[game.id] || null)),
    leaderboard: scoreSnapshot.leaderboard,
    activePlayers: getActivePlayers_()
  };
}

/**
 * Alleen spelers met een recente heartbeat worden als actief getoond.
 */
function getActivePlayers_() {
  const cutoff = Date.now() - ACTIVE_PLAYER_WINDOW_MS;
  const active = readActivePlayers_();

  return Object.values(active)
    .filter(item => Number(item.lastSeen) >= cutoff)
    .sort((a, b) => Number(b.lastSeen) - Number(a.lastSeen))
    .map(item => ({
      name: item.name,
      gameId: item.gameId,
      gameTitle: item.gameTitle,
      startedAt: item.startedAt
    }));
}

function getGameAccess(gameId, playerName) {
  if (!gameId) throw new Error('Geen spel-id opgegeven.');

  const game = readGames_().find(item => item.id === gameId);
  if (!game) throw new Error('Onbekend spel.');

  const state = calculateState_(game);
  const completed = getCompletedForPlayer_(playerName || '')[gameId] || null;

  return {
    allowed: state === 'open' && !completed,
    state: state,
    completed: completed,
    game: serializeGame_(game, completed)
  };
}

/**
 * Zet een rij uit Spellen om naar het publieke API-formaat.
 * Alle ingestelde Sheet-velden zijn hierdoor beschikbaar via state en access.
 */
function serializeGame_(game, completed) {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    status: game.status,
    state: calculateState_(game),
    openFrom: dateToIso_(game.openFrom),
    closeAt: dateToIso_(game.closeAt),
    hint: game.hint,
    maxPoints: game.maxPoints,
    order: game.order,
    completed: completed || null
  };
}

function registerGameStart(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige startregistratie.');
  }

  const name = sanitizeName_(payload.name || payload.playerName);
  const gameId = String(payload.gameId || '').trim();
  if (!name) throw new Error('Vul eerst je naam in.');
  if (!gameId) throw new Error('Geen spel-id opgegeven.');

  const game = readGames_().find(item => item.id === gameId);
  if (!game) throw new Error('Onbekend spel.');
  if (calculateState_(game) !== 'open') {
    throw new Error('Dit spel is niet vrijgegeven.');
  }

  const completed = getCompletedForPlayer_(name)[gameId];
  if (completed) {
    return { registered: false, reason: 'completed' };
  }

  const sheet = getOrCreateStartsSheet_();
  sheet.appendRow([
    new Date(),
    name,
    game.id,
    game.title,
    'gestart',
    sanitizeText_(payload.source || 'github-pages', 100),
    sanitizeText_(payload.userAgent || '', 250)
  ]);

  setActivePlayer_(name, game);

  return { registered: true };
}

function registerGameHeartbeat(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige heartbeat.');
  }

  const name = sanitizeName_(payload.name || payload.playerName);
  const gameId = String(payload.gameId || '').trim();
  if (!name || !gameId) throw new Error('Naam of spel-id ontbreekt.');

  const game = readGames_().find(item => item.id === gameId);
  if (!game || calculateState_(game) !== 'open') {
    throw new Error('Dit spel is niet actief.');
  }
  if (getCompletedForPlayer_(name)[gameId]) {
    removeActivePlayer_(name);
    return { active: false, reason: 'completed' };
  }

  setActivePlayer_(name, game);
  return { active: true };
}

function readActivePlayers_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ACTIVE_PLAYERS_PROPERTY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function setActivePlayer_(name, game) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const active = readActivePlayers_();
    const key = name.toLowerCase();
    const now = Date.now();
    const existing = active[key];
    active[key] = {
      name: name,
      gameId: game.id,
      gameTitle: game.title,
      startedAt: existing && existing.gameId === game.id
        ? existing.startedAt
        : new Date(now).toISOString(),
      lastSeen: now
    };

    Object.keys(active).forEach(playerKey => {
      if (Number(active[playerKey].lastSeen) < now - ACTIVE_PLAYER_WINDOW_MS) {
        delete active[playerKey];
      }
    });
    PropertiesService.getScriptProperties().setProperty(
      ACTIVE_PLAYERS_PROPERTY,
      JSON.stringify(active)
    );
  } finally {
    lock.releaseLock();
  }
}

function removeActivePlayer_(name) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    removeActivePlayerUnlocked_(name);
  } finally {
    lock.releaseLock();
  }
}

function removeActivePlayerUnlocked_(name) {
  const active = readActivePlayers_();
  delete active[String(name || '').toLowerCase()];
  PropertiesService.getScriptProperties().setProperty(
    ACTIVE_PLAYERS_PROPERTY,
    JSON.stringify(active)
  );
}

function getOrCreateStartsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(STARTS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(STARTS_SHEET);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'tijdstip', 'naam', 'spel_id', 'spel', 'status', 'bron', 'apparaat'
    ]]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 7);
  }

  return sheet;
}

/**
 * Verwijdert de bestaande score voor één speler en spel, zodat het spel
 * opnieuw gespeeld kan worden. De leaderboardbijdrage vervalt direct.
 */
function resetGameProgress(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige replay-aanvraag.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Het spel kon niet direct worden gereset. Probeer opnieuw.');
  }

  try {
    const name = sanitizeName_(payload.name || payload.playerName);
    const gameId = String(payload.gameId || '').trim();
    if (!name) throw new Error('Vul eerst je naam in.');
    if (!gameId) throw new Error('Geen spel-id opgegeven.');

    const game = readGames_().find(item => item.id === gameId);
    if (!game) throw new Error('Onbekend spel.');
    if (calculateState_(game) !== 'open') {
      throw new Error('Dit spel kan nu niet opnieuw worden gestart.');
    }

    const sheet = getScoresSheet_();
    const scoreRows = readScoreRows_();
    const normalizedName = name.toLowerCase();
    const rowsToDelete = [];
    const remainingRows = [];

    scoreRows.forEach((row, index) => {
      const isTarget =
        String(row[1] || '').trim().toLowerCase() === normalizedName &&
        String(row[2] || '').trim() === gameId;

      if (isTarget) {
        rowsToDelete.push(index + 2);
      } else {
        remainingRows.push(row);
      }
    });

    rowsToDelete
      .sort((a, b) => b - a)
      .forEach(rowNumber => sheet.deleteRow(rowNumber));

    const completed = buildCompletedForPlayer_(name, remainingRows);
    cacheCompletedForPlayer_(name, completed);
    clearLeaderboardCache_();
    removeActivePlayerUnlocked_(name);

    return {
      reset: rowsToDelete.length > 0,
      gameId: game.id,
      removedScores: rowsToDelete.length,
      leaderboard: getLeaderboard_(remainingRows)
    };
  } finally {
    lock.releaseLock();
  }
}

function submitScore(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige inzending.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('De score kon niet direct worden opgeslagen. Probeer opnieuw.');
  }

  try {
    const name = sanitizeName_(payload.name || payload.playerName);
    const gameId = String(payload.gameId || '').trim();
    const seconds = clampNumber_(payload.seconds, 0, 86400);
    const attempts = clampNumber_(payload.attempts, 0, 10000);

    if (!name) throw new Error('Vul eerst je naam in.');
    if (!gameId) throw new Error('Geen spel-id opgegeven.');

    const game = readGames_().find(item => item.id === gameId);
    if (!game) throw new Error('Onbekend spel.');
    if (calculateState_(game) !== 'open') {
      throw new Error('Dit spel is niet vrijgegeven.');
    }

    const scoreRows = readScoreRows_();
    const completed = buildCompletedForPlayer_(name, scoreRows);
    cacheCompletedForPlayer_(name, completed);
    const existing = completed[gameId];
    if (existing) {
      removeActivePlayerUnlocked_(name);
      return {
        alreadySubmitted: true,
        result: existing,
        leaderboard: getLeaderboard_(scoreRows)
      };
    }

    const score = calculateScore_(gameId, game.maxPoints, seconds, attempts);
    const detail = serializeDetail_(payload.detail || {});
    const sheet = getScoresSheet_();

    const scoreRow = [
      new Date(),
      name,
      game.id,
      game.title,
      score,
      seconds,
      attempts,
      detail
    ];
    sheet.appendRow(scoreRow);
    removeActivePlayerUnlocked_(name);
    completed[game.id] = {
      gameId: game.id,
      title: game.title,
      score: score,
      seconds: seconds,
      attempts: attempts,
      hint: game.hint
    };
    cacheCompletedForPlayer_(name, completed);
    clearLeaderboardCache_();

    return {
      alreadySubmitted: false,
      result: {
        gameId: game.id,
        title: game.title,
        score: score,
        seconds: seconds,
        attempts: attempts,
        hint: game.hint
      },
      leaderboard: getLeaderboard_(scoreRows.concat([scoreRow]))
    };
  } finally {
    lock.releaseLock();
  }
}

function readGames_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(GAMES_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached).map(game => ({
        ...game,
        openFrom: game.openFrom ? new Date(game.openFrom) : '',
        closeAt: game.closeAt ? new Date(game.closeAt) : ''
      }));
    } catch (error) {
      cache.remove(GAMES_CACHE_KEY);
    }
  }

  const sheet = getSpreadsheet_().getSheetByName(SETTINGS_SHEET);

  if (!sheet) throw new Error('Voer eerst setup() uit.');

  const values = sheet.getDataRange().getValues();

  if (!values.length) return [];

  const headers = values[0].reduce((result, value, index) => {
    result[String(value || '').trim().toLowerCase()] = index;
    return result;
  }, {});
  const requiredHeaders = [
    'id', 'titel', 'omschrijving', 'status', 'open_vanaf',
    'sluit_op', 'hint', 'max_punten', 'volgorde'
  ];
  const missingHeaders = requiredHeaders.filter(header => headers[header] === undefined);

  if (missingHeaders.length) {
    throw new Error('Ontbrekende kolommen in Spellen: ' + missingHeaders.join(', ') + '.');
  }

  const games = values.slice(1)
    .filter(row => row[headers.id])
    .map(row => ({
      id: String(row[headers.id]).trim(),
      title: String(row[headers.titel] || row[headers.id]),
      description: String(row[headers.omschrijving] || ''),
      status: String(row[headers.status] || 'gesloten').toLowerCase().trim(),
      openFrom: row[headers.open_vanaf],
      closeAt: row[headers.sluit_op],
      hint: String(row[headers.hint] || ''),
      maxPoints: Number(row[headers.max_punten]) || 1000,
      order: Number(row[headers.volgorde]) || 999
    }))
    .sort((a, b) => a.order - b.order);

  cache.put(GAMES_CACHE_KEY, JSON.stringify(games), GAMES_CACHE_SECONDS);
  return games;
}

function calculateState_(game) {
  const now = new Date();

  if (game.status === 'afgelopen') return 'afgelopen';
  if (game.status !== 'open') return 'gesloten';

  if (
    game.openFrom instanceof Date &&
    !isNaN(game.openFrom) &&
    now < game.openFrom
  ) {
    return 'gesloten';
  }

  if (
    game.closeAt instanceof Date &&
    !isNaN(game.closeAt) &&
    now > game.closeAt
  ) {
    return 'afgelopen';
  }

  return 'open';
}

function getScoreSnapshot_(playerName) {
  const name = sanitizeName_(playerName);
  let completed = name ? readCompletedCache_(name) : {};
  let leaderboard = readLeaderboardCache_();

  if (completed === null || leaderboard === null) {
    const rows = readScoreRows_();

    if (completed === null) {
      completed = buildCompletedForPlayer_(name, rows);
      cacheCompletedForPlayer_(name, completed);
    }

    if (leaderboard === null) {
      leaderboard = buildLeaderboard_(rows);
      cacheLeaderboard_(leaderboard);
    }
  }

  return {
    completed: completed || {},
    leaderboard: leaderboard || []
  };
}

function readScoreRows_() {
  const sheet = getSpreadsheet_().getSheetByName(SCORES_SHEET);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 8).getValues();
}

function getCompletedForPlayer_(playerName, scoreRows) {
  const name = sanitizeName_(playerName);
  if (!name) return {};

  if (!scoreRows) {
    const cached = readCompletedCache_(name);
    if (cached !== null) return cached;
  }

  const completed = buildCompletedForPlayer_(
    name,
    scoreRows || readScoreRows_()
  );
  cacheCompletedForPlayer_(name, completed);
  return completed;
}

function buildCompletedForPlayer_(playerName, rows) {
  const name = sanitizeName_(playerName);
  if (!name) return {};

  return rows.reduce((result, row) => {
    if (String(row[1]).toLowerCase() === name.toLowerCase()) {
      result[String(row[2])] = {
        gameId: String(row[2]),
        title: String(row[3]),
        score: Number(row[4]),
        seconds: Number(row[5]),
        attempts: Number(row[6])
      };
    }
    return result;
  }, {});
}

function getLeaderboard_(scoreRows) {
  if (!scoreRows) {
    const cached = readLeaderboardCache_();
    if (cached !== null) return cached;
  }

  const leaderboard = buildLeaderboard_(scoreRows || readScoreRows_());
  cacheLeaderboard_(leaderboard);
  return leaderboard;
}

function buildLeaderboard_(rows) {
  const totals = {};

  rows.forEach(row => {
    const name = String(row[1] || '').trim();
    if (!name) return;

    const key = name.toLowerCase();
    if (!totals[key]) {
      totals[key] = {
        name: name,
        score: 0,
        games: 0,
        seconds: 0
      };
    }

    totals[key].score += Number(row[4]) || 0;
    totals[key].games += 1;
    totals[key].seconds += Number(row[5]) || 0;
  });

  return Object.values(totals)
    .sort((a, b) =>
      b.score - a.score ||
      a.seconds - b.seconds ||
      a.name.localeCompare(b.name)
    )
    .slice(0, 50);
}

function readCompletedCache_(name) {
  return readJsonCache_(completedCacheKey_(name));
}

function cacheCompletedForPlayer_(name, completed) {
  if (!name) return;
  CacheService.getScriptCache().put(
    completedCacheKey_(name),
    JSON.stringify(completed || {}),
    COMPLETED_CACHE_SECONDS
  );
}

function completedCacheKey_(name) {
  return COMPLETED_CACHE_PREFIX + String(name || '').toLowerCase();
}

function readLeaderboardCache_() {
  return readJsonCache_(LEADERBOARD_CACHE_KEY);
}

function cacheLeaderboard_(leaderboard) {
  CacheService.getScriptCache().put(
    LEADERBOARD_CACHE_KEY,
    JSON.stringify(leaderboard || []),
    LEADERBOARD_CACHE_SECONDS
  );
}

function readJsonCache_(key) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    cache.remove(key);
    return null;
  }
}

function clearGamesCache_() {
  CacheService.getScriptCache().remove(GAMES_CACHE_KEY);
}

function clearLeaderboardCache_() {
  CacheService.getScriptCache().remove(LEADERBOARD_CACHE_KEY);
}

function clearDataCaches_() {
  const cache = CacheService.getScriptCache();
  cache.removeAll([GAMES_CACHE_KEY, LEADERBOARD_CACHE_KEY]);
}

function calculateScore_(gameId, maxPoints, seconds, attempts) {
  if (gameId === 'mozaiek') {
    const timePenalty = Math.min(500, Math.floor(seconds * 2));
    const movePenalty = Math.min(350, Math.max(0, attempts - 15) * 5);
    return Math.max(100, maxPoints - timePenalty - movePenalty);
  }

  if (gameId === 'vallende-stenen') {
    const timePenalty = Math.min(500, Math.floor(seconds * 1.5));
    const piecePenalty = Math.min(250, Math.max(0, attempts - 30) * 4);
    return Math.max(100, maxPoints - timePenalty - piecePenalty);
  }

  return Math.max(
    100,
    maxPoints - Math.floor(seconds) - Math.max(0, attempts - 1) * 20
  );
}

function getScoresSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(SCORES_SHEET);

  if (!sheet) throw new Error('Voer eerst setup() uit.');
  return sheet;
}

function sanitizeName_(value) {
  return sanitizeText_(value, 40);
}

function sanitizeText_(value, maxLength) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function clampNumber_(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function serializeDetail_(detail) {
  let json;

  try {
    json = JSON.stringify(detail || {});
  } catch (error) {
    json = '{}';
  }

  if (json.length <= 5000) return json;

  return JSON.stringify({
    truncated: true,
    preview: json.slice(0, 4800)
  });
}

function dateToIso_(value) {
  return value instanceof Date && !isNaN(value)
    ? value.toISOString()
    : '';
}
