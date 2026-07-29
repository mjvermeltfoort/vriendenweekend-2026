export const ACTIVE_SESSION_MS = 60_000;
export const FRESH_LOCATION_MS = 30_000;
export const ACCURATE_LOCATION_M = 50;
export const MAX_VISUAL_ACCURACY_M = 250;

export interface DashboardParticipant {
  sessionId: string;
  joinedAt: string;
  lastSeenAt: string;
  deviceLabel: string;
  browserLabel: string;
  locationAccuracyM: number | null;
  locationCapturedAt?: string;
  isLocationSource: boolean;
}

export interface DashboardLocation {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
  selectedAt: string;
  sourceSessionId: string;
}

export interface DashboardProgress {
  stopId: string;
  state: 'locked' | 'available' | 'arrived' | 'started' | 'completed';
  attempts: number;
  hintsUsed: number;
  scoreAwarded: number;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DashboardTeam {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'completed' | 'disabled';
  score: number;
  currentStopIndex: number | null;
  currentStopId: string | null;
  currentStepId: string | null;
  nextStopId: string | null;
  progressVersion: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  startedAt?: string;
  completedAt?: string;
  stopProgress: DashboardProgress[];
  activeGame: {
    runId: string;
    gameId: string;
    state: Record<string, unknown>;
    startedAt: string;
    updatedAt: string;
    version: number;
  } | null;
  location: DashboardLocation | null;
  participants: DashboardParticipant[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  serverNow: string;
  teams: DashboardTeam[];
}

export type TeamHealth = 'healthy' | 'location-problem' | 'inactive' | 'completed';

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeDashboardTeam(input: unknown): DashboardTeam {
  if (!input || typeof input !== 'object') throw new Error('Ongeldige teamgegevens ontvangen.');
  const item = input as Record<string, unknown>;
  const location = item.location && typeof item.location === 'object'
    ? item.location as Record<string, unknown>
    : null;
  const activeGame = item.activeGame && typeof item.activeGame === 'object'
    ? item.activeGame as Record<string, unknown>
    : null;
  const status = item.status;
  if (!['active', 'completed', 'disabled'].includes(String(status))) {
    throw new Error('Ongeldige teamstatus ontvangen.');
  }
  const id = stringValue(item.id);
  const name = stringValue(item.name);
  const code = stringValue(item.code);
  if (!id || !name || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) {
    throw new Error('Onvolledige teamgegevens ontvangen.');
  }
  return {
    id,
    name,
    code,
    status: status as DashboardTeam['status'],
    score: numberValue(item.score),
    currentStopIndex: typeof item.currentStopIndex === 'number' ? item.currentStopIndex : null,
    currentStopId: typeof item.currentStopId === 'string' ? item.currentStopId : null,
    currentStepId: typeof item.currentStepId === 'string' ? item.currentStepId : null,
    nextStopId: typeof item.nextStopId === 'string' ? item.nextStopId : null,
    progressVersion: numberValue(item.progressVersion, 1),
    createdAt: stringValue(item.createdAt),
    updatedAt: stringValue(item.updatedAt),
    lastSeenAt: typeof item.lastSeenAt === 'string' ? item.lastSeenAt : undefined,
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : undefined,
    completedAt: typeof item.completedAt === 'string' ? item.completedAt : undefined,
    stopProgress: Array.isArray(item.stopProgress)
      ? item.stopProgress.map((value) => {
        const progress = value as Record<string, unknown>;
        return {
          stopId: stringValue(progress.stopId),
          state: stringValue(progress.state, 'locked') as DashboardProgress['state'],
          attempts: numberValue(progress.attempts),
          hintsUsed: numberValue(progress.hintsUsed),
          scoreAwarded: numberValue(progress.scoreAwarded),
          arrivedAt: typeof progress.arrivedAt === 'string' ? progress.arrivedAt : undefined,
          startedAt: typeof progress.startedAt === 'string' ? progress.startedAt : undefined,
          completedAt: typeof progress.completedAt === 'string' ? progress.completedAt : undefined
        };
      })
      : [],
    activeGame: activeGame ? {
      runId: stringValue(activeGame.runId),
      gameId: stringValue(activeGame.gameId),
      state: activeGame.state && typeof activeGame.state === 'object'
        ? activeGame.state as Record<string, unknown>
        : {},
      startedAt: stringValue(activeGame.startedAt),
      updatedAt: stringValue(activeGame.updatedAt),
      version: numberValue(activeGame.version, 1)
    } : null,
    location: location ? {
      latitude: numberValue(location.latitude),
      longitude: numberValue(location.longitude),
      accuracyM: numberValue(location.accuracyM),
      capturedAt: stringValue(location.capturedAt),
      selectedAt: stringValue(location.selectedAt),
      sourceSessionId: stringValue(location.sourceSessionId)
    } : null,
    participants: Array.isArray(item.participants)
      ? item.participants.map((value) => {
        const participant = value as Record<string, unknown>;
        return {
          sessionId: stringValue(participant.sessionId),
          joinedAt: stringValue(participant.joinedAt),
          lastSeenAt: stringValue(participant.lastSeenAt),
          deviceLabel: stringValue(participant.deviceLabel, 'Apparaat'),
          browserLabel: stringValue(participant.browserLabel, 'Browser'),
          locationAccuracyM: typeof participant.locationAccuracyM === 'number'
            ? participant.locationAccuracyM
            : null,
          locationCapturedAt: typeof participant.locationCapturedAt === 'string'
            ? participant.locationCapturedAt
            : undefined,
          isLocationSource: participant.isLocationSource === true
        };
      })
      : []
  };
}

export function normalizeDashboardSnapshot(input: unknown): DashboardSnapshot {
  if (!input || typeof input !== 'object') throw new Error('Dashboard-snapshot ontbreekt.');
  const snapshot = input as Record<string, unknown>;
  return {
    generatedAt: stringValue(snapshot.generatedAt),
    serverNow: stringValue(snapshot.serverNow),
    teams: Array.isArray(snapshot.teams) ? snapshot.teams.map(normalizeDashboardTeam) : []
  };
}

export function activeParticipants(team: DashboardTeam, now = Date.now()) {
  return team.participants.filter(
    (participant) => now - Date.parse(participant.lastSeenAt) <= ACTIVE_SESSION_MS
  );
}

export function locationIsFresh(team: DashboardTeam, now = Date.now()) {
  return Boolean(
    team.location
    && now - Date.parse(team.location.capturedAt) <= FRESH_LOCATION_MS
    && activeParticipants(team, now).some(
      (participant) => participant.sessionId === team.location?.sourceSessionId
    )
  );
}

export function teamHealth(team: DashboardTeam, now = Date.now()): TeamHealth {
  if (team.status === 'completed') return 'completed';
  const participants = activeParticipants(team, now);
  if (team.status === 'disabled' || participants.length === 0) return 'inactive';
  return locationIsFresh(team, now) && (team.location?.accuracyM ?? Infinity) <= ACCURATE_LOCATION_M
    ? 'healthy'
    : 'location-problem';
}

const healthOrder: Record<TeamHealth, number> = {
  healthy: 0,
  'location-problem': 1,
  inactive: 2,
  completed: 3
};

export function sortDashboardTeams(teams: DashboardTeam[], now = Date.now()) {
  return [...teams].sort((left, right) => {
    const healthDifference = healthOrder[teamHealth(left, now)] - healthOrder[teamHealth(right, now)];
    return healthDifference || left.name.localeCompare(right.name, 'nl', { sensitivity: 'base' });
  });
}

export function dashboardSummary(teams: DashboardTeam[], now = Date.now()) {
  return {
    teams: teams.length,
    activeTeams: teams.filter((team) => activeParticipants(team, now).length > 0).length,
    participants: teams.reduce((total, team) => total + activeParticipants(team, now).length, 0),
    locationProblems: teams.filter((team) => (
      activeParticipants(team, now).length > 0 && teamHealth(team, now) === 'location-problem'
    )).length
  };
}

export function ageLabel(timestamp: string | undefined, now = Date.now()) {
  if (!timestamp) return 'onbekend';
  const seconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (seconds < 5) return 'zojuist';
  if (seconds < 60) return `${seconds} sec geleden`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min geleden`;
  return `${Math.floor(minutes / 60)} uur geleden`;
}
