/**
 * Vriendenweekend 2026 - Google Apps Script JSON API
 *
 * POST action=session + payload={name, accessCode}
 * POST action=state + payload={name, token}
 * POST action=access + payload={name, gameId, token}
 * POST action=start  + payload={name, gameId, token, ...}
 * POST action=heartbeat + payload={name, gameId, token, ...}
 * POST action=replay + payload={name, gameId, token, ...}
 * POST action=score  + payload={name, gameId, token, ...}
 *
 * Gebruik voor POST vanuit GitHub Pages bij voorkeur URLSearchParams.
 *
 * Authenticatie wordt actief zodra in de Apps Script-projectinstellingen de
 * Script Property API_ACCESS_CODE is ingesteld. Gebruik een willekeurige code
 * van minimaal 10 tekens en zet deze nooit in de repository of frontend.
 */

const SETTINGS_SHEET = 'Spellen';
const SCORES_SHEET = 'Scores';
const STARTS_SHEET = 'Spelstarts';
const API_VERSION = '1.6.0';
const ACTIVE_PLAYERS_PROPERTY = 'activePlayers';
const API_ACCESS_CODE_PROPERTY = 'API_ACCESS_CODE';
const API_TOKEN_SECRET_PROPERTY = 'API_TOKEN_SECRET';
const API_TOKEN_TTL_SECONDS = 6 * 60 * 60;
const RATE_LIMIT_PREFIX = 'rate:v1:';
const MAX_CACHE_SECONDS = 6 * 60 * 60;
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
    enforceRequestRateLimit_(action, request);
    let data;

    switch (action) {
      case 'health':
        data = {
          status: 'ok',
          version: API_VERSION,
          webAppUrl: getWebAppUrl(),
          authenticationRequired: isAuthenticationEnabled_()
        };
        break;

      case 'session':
      case 'authenticate':
      case 'createsession':
        requireMethod_(method, 'POST');
        data = createPlayerSession_(request.payload);
        break;

      case 'state':
      case 'publicstate':
      case 'getpublicstate':
        requireReadMethod_(method);
        data = getPublicState(
          request.params.playerName ||
          request.params.name ||
          request.payload.playerName ||
          request.payload.name ||
          '',
          request.params.token || request.payload.token || ''
        );
        break;

      case 'access':
      case 'gameaccess':
      case 'getgameaccess':
        requireReadMethod_(method);
        data = getGameAccess(
          String(request.params.gameId || request.payload.gameId || '').trim(),
          request.params.playerName ||
          request.params.name ||
          request.payload.playerName ||
          request.payload.name ||
          '',
          request.params.token || request.payload.token || ''
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
          'Onbekende API-actie. Gebruik health, session, state, access, start, heartbeat, replay of score.'
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

function requireReadMethod_(actualMethod) {
  if (isAuthenticationEnabled_()) {
    requireMethod_(actualMethod, 'POST');
    return;
  }
  if (actualMethod !== 'GET' && actualMethod !== 'POST') {
    throw new Error('Deze actie vereist een GET- of POST-verzoek.');
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
 * Wisselt de niet-publieke evenementcode om voor een tijdelijk, aan de
 * spelersnaam gekoppeld token. Het token bevat geen toegangscode.
 */
function createPlayerSession_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige sessieaanvraag.');
  }

  const name = sanitizeName_(payload.name || payload.playerName);
  if (!name) throw new Error('Vul eerst je naam in.');

  const accessCode = getApiAccessCode_();
  if (!accessCode) {
    return {
      authenticationRequired: false,
      playerName: name,
      token: '',
      expiresAt: ''
    };
  }
  if (accessCode.length < 10) {
    throw new Error('API_ACCESS_CODE moet minimaal 10 tekens bevatten.');
  }

  const suppliedCode = String(payload.accessCode || '');
  if (!constantTimeEquals_(suppliedCode, accessCode)) {
    throw new Error('Naam of toegangscode is ongeldig.');
  }

  const expiresAt = Date.now() + API_TOKEN_TTL_SECONDS * 1000;
  const claims = {
    version: 1,
    name: name,
    expiresAt: expiresAt,
    accessVersion: accessCodeFingerprint_(accessCode)
  };

  return {
    authenticationRequired: true,
    playerName: name,
    token: signTokenClaims_(claims),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

function isAuthenticationEnabled_() {
  return Boolean(getApiAccessCode_());
}

function getApiAccessCode_() {
  return String(
    PropertiesService.getScriptProperties().getProperty(API_ACCESS_CODE_PROPERTY) || ''
  );
}

/**
 * Valideert bij ingeschakelde authenticatie het token en bindt het verzoek aan
 * de naam in dat token. Zonder API_ACCESS_CODE blijft de bestaande API werken.
 */
function requireAuthenticatedPlayer_(playerName, token) {
  const requestedName = sanitizeName_(playerName);
  if (!requestedName) throw new Error('Vul eerst je naam in.');

  if (!isAuthenticationEnabled_()) {
    return { name: requestedName, authenticated: false };
  }

  const claims = verifyPlayerToken_(token);
  if (claims.name.toLowerCase() !== requestedName.toLowerCase()) {
    throw new Error('Dit sessietoken hoort bij een andere speler.');
  }

  return { name: claims.name, authenticated: true };
}

function signTokenClaims_(claims) {
  const encodedClaims = base64WebSafeEncode_(JSON.stringify(claims));
  const signature = createTokenSignature_(encodedClaims);
  return encodedClaims + '.' + signature;
}

function verifyPlayerToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Je sessie ontbreekt of is ongeldig. Meld je opnieuw aan.');
  }

  const expectedSignature = createTokenSignature_(parts[0]);
  if (!constantTimeEquals_(parts[1], expectedSignature)) {
    throw new Error('Je sessie ontbreekt of is ongeldig. Meld je opnieuw aan.');
  }

  let claims;
  try {
    claims = JSON.parse(base64WebSafeDecode_(parts[0]));
  } catch (error) {
    throw new Error('Je sessie ontbreekt of is ongeldig. Meld je opnieuw aan.');
  }

  if (
    !claims ||
    claims.version !== 1 ||
    !claims.name ||
    !Number.isFinite(Number(claims.expiresAt)) ||
    Number(claims.expiresAt) <= Date.now()
  ) {
    throw new Error('Je sessie is verlopen. Meld je opnieuw aan.');
  }

  const accessCode = getApiAccessCode_();
  if (
    !accessCode ||
    !constantTimeEquals_(
      String(claims.accessVersion || ''),
      accessCodeFingerprint_(accessCode)
    )
  ) {
    throw new Error('Je sessie is verlopen. Meld je opnieuw aan.');
  }

  return {
    name: sanitizeName_(claims.name),
    expiresAt: Number(claims.expiresAt)
  };
}

function createTokenSignature_(encodedClaims) {
  const bytes = Utilities.computeHmacSha256Signature(
    encodedClaims,
    getOrCreateTokenSecret_(),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function getOrCreateTokenSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(API_TOKEN_SECRET_PROPERTY);
  if (secret) return secret;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('De sessiebeveiliging is tijdelijk bezet. Probeer opnieuw.');
  }
  try {
    secret = properties.getProperty(API_TOKEN_SECRET_PROPERTY);
    if (!secret) {
      secret = Utilities.getUuid() + Utilities.getUuid();
      properties.setProperty(API_TOKEN_SECRET_PROPERTY, secret);
    }
    return secret;
  } finally {
    lock.releaseLock();
  }
}

function accessCodeFingerprint_(accessCode) {
  return digestText_(String(accessCode || '')).slice(0, 24);
}

function base64WebSafeEncode_(value) {
  return Utilities.base64EncodeWebSafe(
    String(value || ''),
    Utilities.Charset.UTF_8
  ).replace(/=+$/g, '');
}

function base64WebSafeDecode_(value) {
  let padded = String(value || '');
  while (padded.length % 4) padded += '=';
  return Utilities.newBlob(
    Utilities.base64DecodeWebSafe(padded)
  ).getDataAsString('UTF-8');
}

function constantTimeEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * Apps Script stelt geen betrouwbaar client-IP-adres beschikbaar. Daarom
 * begrenzen we zowel globaal als per token/naam. Dit voorkomt geen gerichte
 * DDoS, maar remt misbruik en beschermt de dagelijkse Apps Script-quota.
 */
function enforceRequestRateLimit_(action, request) {
  const rateAction = canonicalRateLimitAction_(action);
  const limits = getRateLimits_(rateAction);
  const identity = getRequestIdentity_(request);
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    throw new Error('De API is tijdelijk druk. Probeer over enkele seconden opnieuw.');
  }

  try {
    consumeRateLimitBucket_(
      cache,
      RATE_LIMIT_PREFIX + 'global:' + rateAction,
      limits.global,
      limits.windowSeconds
    );
    consumeRateLimitBucket_(
      cache,
      RATE_LIMIT_PREFIX + rateAction + ':' + identity,
      limits.perIdentity,
      limits.windowSeconds
    );
  } finally {
    lock.releaseLock();
  }
}

function canonicalRateLimitAction_(action) {
  const aliases = {
    authenticate: 'session',
    createsession: 'session',
    publicstate: 'state',
    getpublicstate: 'state',
    gameaccess: 'access',
    getgameaccess: 'access',
    registergamestart: 'start',
    gameheartbeat: 'heartbeat',
    resetgameprogress: 'replay',
    submitscore: 'score'
  };
  return aliases[action] || action || 'unknown';
}

function getRateLimits_(action) {
  const limits = {
    health: { perIdentity: 60, global: 120, windowSeconds: 60 },
    session: { perIdentity: 10, global: 60, windowSeconds: 300 },
    state: { perIdentity: 120, global: 600, windowSeconds: 60 },
    access: { perIdentity: 60, global: 300, windowSeconds: 60 },
    start: { perIdentity: 20, global: 120, windowSeconds: 60 },
    heartbeat: { perIdentity: 30, global: 600, windowSeconds: 60 },
    replay: { perIdentity: 5, global: 60, windowSeconds: 300 },
    score: { perIdentity: 10, global: 100, windowSeconds: 300 }
  };

  return limits[action] || { perIdentity: 20, global: 100, windowSeconds: 60 };
}

function getRequestIdentity_(request) {
  const params = (request && request.params) || {};
  const payload = (request && request.payload) || {};
  const value =
    params.token || payload.token ||
    params.playerName || params.name ||
    payload.playerName || payload.name ||
    'anonymous';
  return digestText_(String(value)).slice(0, 24);
}

function consumeRateLimitBucket_(cache, key, limit, windowSeconds) {
  const now = Date.now();
  let bucket = null;
  const raw = cache.get(key);

  if (raw) {
    try {
      bucket = JSON.parse(raw);
    } catch (error) {
      bucket = null;
    }
  }
  if (!bucket || Number(bucket.expiresAt) <= now) {
    bucket = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }
  if (Number(bucket.count) >= limit) {
    throw new Error('Te veel API-verzoeken. Wacht even en probeer opnieuw.');
  }

  bucket.count = Number(bucket.count) + 1;
  const remainingSeconds = Math.max(
    1,
    Math.min(MAX_CACHE_SECONDS, Math.ceil((bucket.expiresAt - now) / 1000))
  );
  cache.put(key, JSON.stringify(bucket), remainingSeconds);
}

function digestText_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
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

function getPublicState(playerName, token) {
  const games = readGames_();
  let authorizedName = '';

  if (playerName) {
    if (isAuthenticationEnabled_()) {
      authorizedName = requireAuthenticatedPlayer_(playerName, token).name;
    } else {
      authorizedName = sanitizeName_(playerName);
    }
  }

  const scoreSnapshot = getScoreSnapshot_(authorizedName);

  return {
    authenticationRequired: isAuthenticationEnabled_(),
    games: games.map(game => {
      const completed = scoreSnapshot.completed[game.id] || null;
      return serializeGame_(game, completed, Boolean(completed));
    }),
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

function getGameAccess(gameId, playerName, token) {
  if (!gameId) throw new Error('Geen spel-id opgegeven.');

  const identity = requireAuthenticatedPlayer_(playerName, token);

  const game = readGames_().find(item => item.id === gameId);
  if (!game) throw new Error('Onbekend spel.');

  const authenticationRequired = isAuthenticationEnabled_();
  const state = calculateState_(game);
  const completed = getCompletedForPlayer_(identity.name)[gameId] || null;

  return {
    authenticationRequired: authenticationRequired,
    allowed: state === 'open' && !completed,
    state: state,
    completed: completed,
    // Houd de bestaande frontend werkend totdat API_ACCESS_CODE wordt ingesteld.
    game: serializeGame_(game, completed, Boolean(completed) || !authenticationRequired)
  };
}

/**
 * Zet een rij uit Spellen om naar het publieke API-formaat.
 * Alle ingestelde Sheet-velden zijn hierdoor beschikbaar via state en access.
 */
function serializeGame_(game, completed, includeHint) {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    status: game.status,
    state: calculateState_(game),
    openFrom: dateToIso_(game.openFrom),
    closeAt: dateToIso_(game.closeAt),
    hint: includeHint ? game.hint : '',
    maxPoints: game.maxPoints,
    order: game.order,
    completed: completed || null
  };
}

function registerGameStart(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige startregistratie.');
  }

  const identity = requireAuthenticatedPlayer_(
    payload.name || payload.playerName,
    payload.token
  );
  const name = identity.name;
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
    sanitizeSpreadsheetText_(payload.source || 'github-pages', 100),
    sanitizeSpreadsheetText_(payload.userAgent || '', 250)
  ]);

  setActivePlayer_(name, game);

  return { registered: true };
}

function registerGameHeartbeat(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ongeldige heartbeat.');
  }

  const identity = requireAuthenticatedPlayer_(
    payload.name || payload.playerName,
    payload.token
  );
  const name = identity.name;
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

  const identity = requireAuthenticatedPlayer_(
    payload.name || payload.playerName,
    payload.token
  );
  const name = identity.name;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Het spel kon niet direct worden gereset. Probeer opnieuw.');
  }

  try {
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

  const identity = requireAuthenticatedPlayer_(
    payload.name || payload.playerName,
    payload.token
  );
  const name = identity.name;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('De score kon niet direct worden opgeslagen. Probeer opnieuw.');
  }

  try {
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
        result: Object.assign({}, existing, { hint: game.hint }),
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
  const name = sanitizeText_(value, 40);
  if (/^[=+\-@]/.test(name)) {
    throw new Error('Een spelersnaam mag niet beginnen met =, +, - of @.');
  }
  return name;
}

function sanitizeText_(value, maxLength) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Voorkomt dat door een gebruiker aangeleverde tekst bij appendRow als een
 * spreadsheetformule wordt geïnterpreteerd.
 */
function sanitizeSpreadsheetText_(value, maxLength) {
  const text = sanitizeText_(value, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
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
