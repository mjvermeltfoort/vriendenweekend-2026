import type { GameProgress, SyncQueueItem, TeamRecord } from '../game/gameState';

const DB_NAME = 'moerasdraak-storage';
const DB_VERSION = 1;
const TEAM_STORE = 'teams';
const PROGRESS_STORE = 'progress';
const QUEUE_STORE = 'queue';
const SETTINGS_KEY = 'moerasdraak-settings';
const LAST_TEAM_KEY = 'moerasdraak-last-team';

export interface StoredSettings {
  soundEnabled: boolean;
  backgroundMusicEnabled: boolean;
  installDismissedAt?: string;
  updateDismissedAt?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEAM_STORE)) db.createObjectStore(TEAM_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) db.createObjectStore(PROGRESS_STORE, { keyPath: 'teamId' });
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
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
  const tx1 = db.transaction([TEAM_STORE, PROGRESS_STORE, QUEUE_STORE], 'readwrite');
  tx1.objectStore(TEAM_STORE).delete(teamId);
  tx1.objectStore(PROGRESS_STORE).delete(teamId);
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

export function loadStoredSettings(): StoredSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const stored = raw ? JSON.parse(raw) as Partial<StoredSettings> : {};
  return {
    soundEnabled: stored.soundEnabled ?? true,
    backgroundMusicEnabled: stored.backgroundMusicEnabled ?? true,
    installDismissedAt: stored.installDismissedAt,
    updateDismissedAt: stored.updateDismissedAt
  };
}

export function saveStoredSettings(settings: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadLastTeamId() {
  return localStorage.getItem(LAST_TEAM_KEY);
}

export function clearLastTeamId() {
  localStorage.removeItem(LAST_TEAM_KEY);
}
