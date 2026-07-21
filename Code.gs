/**
 * Vriendenweekend 2026 - Google Apps Script JSON API
 *
 * GET  ?action=state&playerName=Mark
 * GET  ?action=access&gameId=mozaiek&playerName=Mark
 * POST action=start  + payload={...}
 * POST action=score  + payload={...}
 *
 * Gebruik voor POST vanuit GitHub Pages bij voorkeur URLSearchParams.
 */

const SETTINGS_SHEET = 'Spellen';
const SCORES_SHEET = 'Scores';
const STARTS_SHEET = 'Spelstarts';
const API_VERSION = '1.0.0';

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

      case 'score':
      case 'submitscore':
        requireMethod_(method, 'POST');
        data = submitScore(request.payload);
        break;

      default:
        throw new Error(
          'Onbekende API-actie. Gebruik health, state, access, start of score.'
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let games = ss.getSheetByName(SETTINGS_SHEET);
  if (!games) games = ss.insertSheet(SETTINGS_SHEET);
  games.clear();
  games.getRange(1, 1, 1, 9).setValues([[
    'id', 'titel', 'omschrijving', 'status', 'open_vanaf', 'sluit_op', 'hint', 'max_punten', 'volgorde'
  ]]);
  games.getRange(2, 1, 4, 9).setValues([
    ['mozaiek', 'Het gebroken zegel', 'Herstel het oude zegel en ontdek de eerste aanwijzing.', 'open', '', '', 'Waar oude muren verhalen bewaren.', 1000, 1],
    ['rebus', 'Het verzegelde bericht', 'Ontcijfer een cryptische rebus.', 'gesloten', '', '', 'Een plek waar muren verhalen bewaren.', 800, 2],
    ['code', 'De viercijferige code', 'Vind de code met aanwijzingen uit eerdere spellen.', 'gesloten', '', '', 'Twee namen, maar één bestemming.', 700, 3],
    ['memory', 'Het geheugenarchief', 'Vind alle kaartparen en onthul de verborgen aanwijzing.', 'gesloten', '', '', 'Soms onthult volgorde wat stilte verbergt.', 650, 4]
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

  return 'Installatie voltooid. Publiceer het script opnieuw als web-app.';
}

function getPublicState(playerName) {
  const games = readGames_();
  const completed = getCompletedForPlayer_(playerName || '');

  return {
    games: games.map(game => ({
      id: game.id,
      title: game.title,
      description: game.description,
      state: calculateState_(game),
      openFrom: dateToIso_(game.openFrom),
      closeAt: dateToIso_(game.closeAt),
      maxPoints: game.maxPoints,
      order: game.order,
      completed: completed[game.id] || null
    })),
    leaderboard: getLeaderboard_()
  };
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
    game: {
      id: game.id,
      title: game.title,
      description: game.description,
      maxPoints: game.maxPoints
    }
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

  return { registered: true };
}

function getOrCreateStartsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    const existing = getCompletedForPlayer_(name)[gameId];
    if (existing) {
      return {
        alreadySubmitted: true,
        result: existing,
        leaderboard: getLeaderboard_()
      };
    }

    const score = calculateScore_(gameId, game.maxPoints, seconds, attempts);
    const detail = serializeDetail_(payload.detail || {});
    const sheet = getScoresSheet_();

    sheet.appendRow([
      new Date(),
      name,
      game.id,
      game.title,
      score,
      seconds,
      attempts,
      detail
    ]);

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
      leaderboard: getLeaderboard_()
    };
  } finally {
    lock.releaseLock();
  }
}

function readGames_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SETTINGS_SHEET);

  if (!sheet) throw new Error('Voer eerst setup() uit.');

  const values = sheet.getDataRange().getValues();

  return values.slice(1)
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0]).trim(),
      title: String(row[1] || row[0]),
      description: String(row[2] || ''),
      status: String(row[3] || 'gesloten').toLowerCase().trim(),
      openFrom: row[4],
      closeAt: row[5],
      hint: String(row[6] || ''),
      maxPoints: Number(row[7]) || 1000,
      order: Number(row[8]) || 999
    }))
    .sort((a, b) => a.order - b.order);
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

function getCompletedForPlayer_(playerName) {
  const name = sanitizeName_(playerName);
  if (!name) return {};

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SCORES_SHEET);

  if (!sheet || sheet.getLastRow() < 2) return {};

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 8)
    .getValues();

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

function getLeaderboard_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SCORES_SHEET);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 8)
    .getValues();
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

function calculateScore_(gameId, maxPoints, seconds, attempts) {
  if (gameId === 'mozaiek') {
    const timePenalty = Math.min(500, Math.floor(seconds * 2));
    const movePenalty = Math.min(350, Math.max(0, attempts - 15) * 5);
    return Math.max(100, maxPoints - timePenalty - movePenalty);
  }

  return Math.max(
    100,
    maxPoints - Math.floor(seconds) - Math.max(0, attempts - 1) * 20
  );
}

function getScoresSheet_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SCORES_SHEET);

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
