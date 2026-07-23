(() => {
  'use strict';

  const CONFIG = window.VRIENDENWEEKEND_CONFIG || {};
  const TIMEOUT_MS = 12000;
  let client = null;
  let authPromise = null;

  function configured() {
    return /^https:\/\//.test(CONFIG.supabaseUrl || '') &&
      CONFIG.supabaseUrl !== 'VUL_SUPABASE_URL_IN' &&
      typeof CONFIG.supabasePublishableKey === 'string' &&
      CONFIG.supabasePublishableKey &&
      CONFIG.supabasePublishableKey !== 'VUL_SUPABASE_PUBLISHABLE_KEY_IN';
  }

  function message(error) {
    const raw = String(error && (error.message || error.error_description || error) || '');
    if (/Invalid API key|JWT/i.test(raw)) return 'De Supabase-configuratie is ongeldig.';
    if (/Failed to fetch|network|timeout/i.test(raw)) return 'Supabase is niet bereikbaar. Controleer je internetverbinding.';
    if (/naam|player/i.test(raw)) return raw;
    return raw || 'Er ging iets mis bij de spelserver.';
  }

  function withTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('Supabase reageert niet op tijd.')), TIMEOUT_MS))
    ]);
  }

  function getClient() {
    if (client) return client;
    if (!configured()) throw new Error('Vul eerst de Supabase URL en publishable key in config.js in.');
    if (!window.supabase || !window.supabase.createClient) throw new Error('De Supabase-client kon niet worden geladen.');
    client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return client;
  }

  async function ensureAuth() {
    if (authPromise) return authPromise;
    authPromise = (async () => {
      const api = getClient();
      const { data, error } = await withTimeout(api.auth.getSession());
      if (error) throw error;
      if (data.session) return data.session;
      const signedIn = await withTimeout(api.auth.signInAnonymously());
      if (signedIn.error) throw signedIn.error;
      return signedIn.data.session;
    })().catch(error => {
      authPromise = null;
      throw new Error(message(error));
    });
    return authPromise;
  }

  async function rpc(name, params) {
    await ensureAuth();
    const result = await withTimeout(getClient().rpc(name, params || {}));
    if (result.error) {
      if (/JWT|session|not authenticated/i.test(result.error.message || '')) {
        authPromise = null;
      }
      throw new Error(message(result.error));
    }
    return result.data;
  }

  const actionMap = {
    state: ['get_app_state', () => ({})],
    access: ['get_game_access', p => ({ p_game_id: p.gameId })],
    start: ['register_game_start', p => ({ p_game_id: p.gameId, p_source: p.source || '', p_user_agent: p.userAgent || '' })],
    heartbeat: ['register_game_heartbeat', p => ({ p_game_id: p.gameId })],
    replay: ['reset_game_progress', p => ({ p_game_id: p.gameId })],
    score: ['submit_score', p => ({ p_game_id: p.gameId, p_seconds: p.seconds, p_attempts: p.attempts, p_detail: p.detail || {} })]
  };

  window.VriendenweekendApi = {
    isConfigured: configured,
    ensureAuth,
    async register(name) { return rpc('register_player', { p_name: name }); },
    async get(action, params = {}) {
      const item = actionMap[action];
      if (!item) throw new Error('Onbekende API-actie.');
      return rpc(item[0], item[1](params));
    },
    async post(action, payload = {}) { return this.get(action, payload); },
    state() { return rpc('get_app_state'); },
    access(gameId) { return rpc('get_game_access', { p_game_id: gameId }); },
    start(gameId, source, userAgent) { return rpc('register_game_start', { p_game_id: gameId, p_source: source || '', p_user_agent: userAgent || '' }); },
    heartbeat(gameId) { return rpc('register_game_heartbeat', { p_game_id: gameId }); },
    replay(gameId) { return rpc('reset_game_progress', { p_game_id: gameId }); },
    score(gameId, seconds, attempts, detail) { return rpc('submit_score', { p_game_id: gameId, p_seconds: seconds, p_attempts: attempts, p_detail: detail || {} }); }
  };
})();
