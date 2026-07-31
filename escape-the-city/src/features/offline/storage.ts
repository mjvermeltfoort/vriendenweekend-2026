import type { GameProgress, SyncQueueItem, TeamRecord } from '../game/gameState';

const DB_NAME = 'moerasdraak-storage';
const DB_VERSION = 2;
const TEAM_STORE = 'teams';
const PROGRESS_STORE = 'progress';
const QUEUE_STORE = 'queue';
const DEVICE_STORE = 'device';
const SESSION_STORE = 'team-sessions';
const SNAPSHOT_STORE = 'team-snapshots';
const DEVICE_KEY = 'current';
const SETTINGS_KEY = 'moerasdraak-settings';
const LAST_TEAM_KEY = 'moerasdraak-last-team';
const TEAM_RADIO_SEEN_PREFIX = 'moerasdraak-team-radio-seen:';

export interface StoredSettings {
  soundEnabled: boolean;
  backgroundMusicEnabled: boolean;
  highContrastEnabled: boolean;
  installDismissedAt?: string;
  updateDismissedAt?: string;
}

export interface StoredTeamSession {
  id: string;
  teamId: string;
  deviceId: string;
  authUserId?: string;
  joinedAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
}

export interface TeamSnapshot {
  teamId: string;
  sessionId: string;
  deviceId: string;
  progress: GameProgress;
  progressVersion: number;
  activeGameRun?: unknown | null;
  activeGameVersion?: number | null;
  currentLocation?: unknown | null;
  activeSessionCount?: number;
  sessionStateAt?: string;
  lastSyncedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEAM_STORE)) db.createObjectStore(TEAM_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) db.createObjectStore(PROGRESS_STORE, { keyPath: 'teamId' });
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DEVICE_STORE)) db.createObjectStore(DEVICE_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE, { keyPath: 'teamId' });
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'teamId' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveTeam(team: TeamRecord) {
  await withStore(TEAM_STORE, 'readwrite', (store) => store.put(team));
  localStorage.setItem(LAST_TEAM_KEY, team.id);
}

export async function deleteTeam(teamId: string) {
  const db = await openDb();
  const tx1 = db.transaction([TEAM_STORE, PROGRESS_STORE, QUEUE_STORE, SESSION_STORE, SNAPSHOT_STORE], 'readwrite');
  tx1.objectStore(TEAM_STORE).delete(teamId);
  tx1.objectStore(PROGRESS_STORE).delete(teamId);
  tx1.objectStore(SESSION_STORE).delete(teamId);
  tx1.objectStore(SNAPSHOT_STORE).delete(teamId);
  const queue = tx1.objectStore(QUEUE_STORE);
  const cursor = queue.openCursor();
  cursor.onsuccess = () => {
    const current = cursor.result;
    if (current && current.value.teamId === teamId) {
      current.delete();
      current.continue();
    }
  };
  await new Promise<void>((resolve, reject) => {
    tx1.oncomplete = () => {
      db.close();
      resolve();
    };
    tx1.onerror = () => reject(tx1.error);
  });
  if (localStorage.getItem(LAST_TEAM_KEY) === teamId) localStorage.removeItem(LAST_TEAM_KEY);
}

export async function loadTeams() {
  return withStore<TeamRecord[]>(TEAM_STORE, 'readonly', (store) => store.getAll());
}

export async function loadTeam(teamId: string) {
  return withStore<TeamRecord | undefined>(TEAM_STORE, 'readonly', (store) => store.get(teamId));
}

export async function saveProgress(progress: GameProgress) {
  await withStore(PROGRESS_STORE, 'readwrite', (store) => store.put(progress));
}

export async function loadProgress(teamId: string) {
  return withStore<GameProgress | undefined>(PROGRESS_STORE, 'readonly', (store) => store.get(teamId));
}

export async function saveQueueItem(item: SyncQueueItem) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(item));
}

export async function loadQueueItems(teamId?: string) {
  const items = await withStore<SyncQueueItem[]>(QUEUE_STORE, 'readonly', (store) => store.getAll());
  return teamId ? items.filter((item) => item.teamId === teamId) : items;
}

export async function deleteQueueItem(id: string) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
}

export async function getOrCreateDeviceId() {
  const db = await openDb();
  const tx = db.transaction(DEVICE_STORE, 'readwrite');
  const store = tx.objectStore(DEVICE_STORE);
  const request = store.get(DEVICE_KEY);
  let deviceId = '';
  request.onsuccess = () => {
    const existing = request.result as { key: string; deviceId: string } | undefined;
    deviceId = existing?.deviceId ?? crypto.randomUUID();
    if (!existing) store.put({ key: DEVICE_KEY, deviceId });
  };
  return new Promise<string>((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve(deviceId);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveTeamSession(session: StoredTeamSession) {
  await withStore(SESSION_STORE, 'readwrite', (store) => store.put(session));
}

export async function loadTeamSession(teamId: string) {
  return withStore<StoredTeamSession | undefined>(SESSION_STORE, 'readonly', (store) => store.get(teamId));
}

export async function loadTeamSessions() {
  return withStore<StoredTeamSession[]>(SESSION_STORE, 'readonly', (store) => store.getAll());
}

export function shouldAcceptTeamSnapshot(current: TeamSnapshot | undefined, incoming: TeamSnapshot) {
  if (!current) return true;
  if (incoming.progressVersion !== current.progressVersion) {
    return incoming.progressVersion > current.progressVersion;
  }
  const incomingGameVersion = incoming.activeGameVersion ?? -1;
  const currentGameVersion = current.activeGameVersion ?? -1;
  if (incomingGameVersion !== currentGameVersion) return incomingGameVersion > currentGameVersion;
  const selectedAt = (snapshot: TeamSnapshot) => {
    const location = snapshot.currentLocation;
    if (!location || typeof location !== 'object' || !('selectedAt' in location)) return '';
    return typeof location.selectedAt === 'string' ? location.selectedAt : '';
  };
  const incomingLocation = selectedAt(incoming);
  const currentLocation = selectedAt(current);
  if (incomingLocation !== currentLocation) return incomingLocation > currentLocation;
  return (incoming.sessionStateAt ?? '') >= (current.sessionStateAt ?? '');
}

export async function saveTeamSnapshotIfNewer(snapshot: TeamSnapshot) {
  const db = await openDb();
  const tx = db.transaction([SNAPSHOT_STORE, PROGRESS_STORE], 'readwrite');
  const snapshotStore = tx.objectStore(SNAPSHOT_STORE);
  const currentRequest = snapshotStore.get(snapshot.teamId);
  let accepted = false;
  currentRequest.onsuccess = () => {
    const current = currentRequest.result as TeamSnapshot | undefined;
    if (!shouldAcceptTeamSnapshot(current, snapshot)) return;
    accepted = true;
    snapshotStore.put(snapshot);
    tx.objectStore(PROGRESS_STORE).put(snapshot.progress);
  };
  return new Promise<boolean>((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve(accepted);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadTeamSnapshot(teamId: string) {
  return withStore<TeamSnapshot | undefined>(SNAPSHOT_STORE, 'readonly', (store) => store.get(teamId));
}

export async function clearSensitiveSessionData(teamId?: string) {
  const db = await openDb();
  const tx = db.transaction([SESSION_STORE, SNAPSHOT_STORE, QUEUE_STORE], 'readwrite');
  if (teamId) {
    tx.objectStore(SESSION_STORE).delete(teamId);
    tx.objectStore(SNAPSHOT_STORE).delete(teamId);
    const queueCursor = tx.objectStore(QUEUE_STORE).openCursor();
    queueCursor.onsuccess = () => {
      const current = queueCursor.result;
      if (!current) return;
      if ((current.value as SyncQueueItem).teamId === teamId) current.delete();
      current.continue();
    };
  } else {
    tx.objectStore(SESSION_STORE).clear();
    tx.objectStore(SNAPSHOT_STORE).clear();
    tx.objectStore(QUEUE_STORE).clear();
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  if (!teamId || localStorage.getItem(LAST_TEAM_KEY) === teamId) {
    localStorage.removeItem(LAST_TEAM_KEY);
  }
}

export function loadStoredSettings(): StoredSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const stored = raw ? JSON.parse(raw) as Partial<StoredSettings> : {};
  return {
    soundEnabled: stored.soundEnabled ?? true,
    backgroundMusicEnabled: stored.backgroundMusicEnabled ?? true,
    highContrastEnabled: stored.highContrastEnabled ?? false,
    installDismissedAt: stored.installDismissedAt,
    updateDismissedAt: stored.updateDismissedAt
  };
}

export function saveStoredSettings(settings: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function updateStoredSettings(settings: StoredSettings, patch: Partial<StoredSettings>) {
  const next = { ...settings, ...patch };
  saveStoredSettings(next);
  return next;
}

export function loadLastTeamId() {
  return localStorage.getItem(LAST_TEAM_KEY);
}

export function clearLastTeamId() {
  localStorage.removeItem(LAST_TEAM_KEY);
}

export function loadTeamRadioSeenAt(teamId: string) {
  return localStorage.getItem(`${TEAM_RADIO_SEEN_PREFIX}${teamId}`) ?? '';
}

export function saveTeamRadioSeenAt(teamId: string, createdAt: string) {
  localStorage.setItem(`${TEAM_RADIO_SEEN_PREFIX}${teamId}`, createdAt);
}
