import { ensureAnonymousSession, supabase } from './client';
import type { GameProgress, TeamRecord } from '../../features/game/gameState';
import { createInitialProgress } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import { getOrCreateDeviceId, type StoredTeamSession } from '../../features/offline/storage';

export type TeamSyncErrorCode =
  | 'INVALID_TEAM_CODE'
  | 'TEAM_DISABLED'
  | 'AUTH_REQUIRED'
  | 'SESSION_REVOKED'
  | 'SESSION_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'ACTIVE_GAME_EXISTS'
  | 'GAME_NOT_AVAILABLE'
  | 'GAME_ALREADY_COMPLETED'
  | 'INVALID_GAME_ACTION'
  | 'INVALID_GAME_RESULT'
  | 'INVALID_STEP_TRANSITION'
  | 'INVALID_LOCATION'
  | 'LOCATION_OUT_OF_ORDER'
  | 'LOCATION_NOT_CURRENT'
  | 'OBSERVATION_NOT_AVAILABLE'
  | 'INVALID_OBSERVATION_ACTION'
  | 'OFFLINE_REQUIRED_ACTION'
  | 'SYNC_UNAVAILABLE'
  | 'UNKNOWN';

export class TeamSyncError extends Error {
  constructor(
    public readonly code: TeamSyncErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TeamSyncError';
  }
}

export interface TeamLocation {
  sourceSessionId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
  selectedAt: string;
  isCurrent?: boolean;
}

export interface TeamGameRun {
  id: string;
  teamId: string;
  gameId: string;
  status: 'active' | 'completed' | 'abandoned';
  state: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  version: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface TeamStopVerification {
  stopId: string;
  method: 'gps' | 'observation' | 'dashboard_override';
  verifiedAt: string;
  questionId?: string;
}

export interface StopObservation {
  questionId: string;
  question: string;
  isBackup: boolean;
  wrongAttempts: number;
  hint?: string;
  canSelectBackup: boolean;
}

export interface TeamState {
  team: TeamRecord;
  progress: GameProgress;
  progressVersion: number;
  activeGame: TeamGameRun | null;
  currentLocation: TeamLocation | null;
  locationStatus: 'current' | 'stale';
  activeSessionCount: number;
  sessionStateAt: string;
  verifications: TeamStopVerification[];
  currentObservation: StopObservation | null;
  observationStatus: 'available' | 'validation_required' | 'unavailable';
}

type RemoteTeamState = Omit<TeamState, 'progressVersion'> & {
  progressVersion?: number;
  progress: GameProgress & { version?: number };
};

export interface UpdateTeamLocationInput {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt: string;
}

export interface AdvanceTeamStepInput {
  sessionId: string;
  expectedVersion: number;
  targetStepId: string;
}

export interface StartOrResumeTeamGameInput {
  sessionId: string;
  gameId: string;
}

export interface UpdateTeamGameStateInput {
  sessionId: string;
  runId: string;
  expectedVersion: number;
  action: string;
  payload: Record<string, unknown>;
}

export interface CompleteTeamGameInput {
  sessionId: string;
  runId: string;
  expectedVersion: number;
  result: Record<string, unknown>;
}

export function isSupabaseAvailable() {
  return Boolean(supabase);
}

const errorMessages: Record<Exclude<TeamSyncErrorCode, 'UNKNOWN'>, string> = {
  INVALID_TEAM_CODE: 'Deze teamcode is niet geldig.',
  TEAM_DISABLED: 'Deze teamcode is niet geldig.',
  AUTH_REQUIRED: 'Anoniem aanmelden is mislukt. Probeer het opnieuw.',
  SESSION_REVOKED: 'Deze teamsessie is beëindigd. Voer de teamcode opnieuw in.',
  SESSION_NOT_FOUND: 'Deze teamsessie is niet meer beschikbaar. Voer de teamcode opnieuw in.',
  VERSION_CONFLICT: 'De teamvoortgang is op een ander toestel bijgewerkt. De nieuwste stand wordt geladen.',
  ACTIVE_GAME_EXISTS: 'Jullie team is al bezig met een andere opdracht. Rond die opdracht eerst af.',
  GAME_NOT_AVAILABLE: 'Deze opdracht is nu nog niet beschikbaar.',
  GAME_ALREADY_COMPLETED: 'Deze opdracht is al voltooid.',
  INVALID_GAME_ACTION: 'Deze spelactie kan nu niet worden uitgevoerd.',
  INVALID_GAME_RESULT: 'Dit spelresultaat kon niet worden verwerkt.',
  INVALID_STEP_TRANSITION: 'Deze stap kan nu niet worden uitgevoerd.',
  INVALID_LOCATION: 'Deze GPS-meting kon niet worden verwerkt.',
  LOCATION_OUT_OF_ORDER: 'Een nieuwere GPS-meting is al verwerkt.',
  LOCATION_NOT_CURRENT: 'We ontvangen momenteel geen actuele locatie van het team.',
  OBSERVATION_NOT_AVAILABLE: 'Deze observatievraag is nog niet beschikbaar.',
  INVALID_OBSERVATION_ACTION: 'Dit observatieantwoord kon niet worden verwerkt.',
  OFFLINE_REQUIRED_ACTION: 'Je bent offline. Maak opnieuw verbinding om deze actie voor het team uit te voeren.',
  SYNC_UNAVAILABLE: 'Teamsynchronisatie is niet beschikbaar.'
};

function readableRpcError(error: { message: string; code?: string }) {
  const details = `${error.code ?? ''} ${error.message}`.toUpperCase();
  const functionalCode = (Object.keys(errorMessages) as Exclude<TeamSyncErrorCode, 'UNKNOWN'>[])
    .find((code) => details.includes(code));
  if (functionalCode) return new TeamSyncError(functionalCode, errorMessages[functionalCode]);
  if (error.code === 'PGRST202' || /could not find.*function/i.test(error.message)) {
    return new TeamSyncError('SYNC_UNAVAILABLE', 'Teamsynchronisatie is nog niet ingericht.');
  }
  if (/team not found|invalid team/i.test(error.message)) return new TeamSyncError('INVALID_TEAM_CODE', errorMessages.INVALID_TEAM_CODE);
  if (/authentication required/i.test(error.message)) {
    return new TeamSyncError('SESSION_NOT_FOUND', 'Anoniem aanmelden is mislukt. Probeer het opnieuw.');
  }
  if (import.meta.env.DEV) console.error('Onverwachte teamsynchronisatiefout', error);
  return new TeamSyncError('UNKNOWN', 'Synchroniseren is mislukt. Probeer het opnieuw.');
}

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new TeamSyncError('SYNC_UNAVAILABLE', errorMessages.SYNC_UNAVAILABLE);
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw readableRpcError(error);
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    const responseError = 'error' in data && data.error && typeof data.error === 'object'
      ? data.error as { code?: string; message?: string }
      : { code: 'UNKNOWN' };
    throw readableRpcError({
      code: responseError.code,
      message: responseError.message ?? responseError.code ?? 'UNKNOWN'
    });
  }
  return data as T;
}

function normalizeTeamState(state: RemoteTeamState): TeamState {
  const team: TeamRecord = {
    ...state.team,
    memberNames: state.team.memberNames ?? [],
    privacyAccepted: state.team.privacyAccepted ?? true,
    lastActivityAt: state.team.lastActivityAt ?? state.team.updatedAt
  };
  const progress = mergeRemoteProgress(team, state.progress);
  if (state.activeGame) {
    const activeStop = progress.stopProgress[state.activeGame.gameId];
    if (activeStop) {
      activeStop.attempts = Number(state.activeGame.state.attempts ?? activeStop.attempts);
      activeStop.hintsUsed = Number(state.activeGame.state.hintsUsed ?? activeStop.hintsUsed);
    }
  }
  const completedStops = gamePack.stops.filter((stop) => progress.stopProgress[stop.id]?.state === 'completed');
  progress.collectedRewards = completedStops.map((stop) => stop.reward.symbol);
  progress.totalHintsUsed = Object.values(progress.stopProgress)
    .reduce((total, stop) => total + stop.hintsUsed, 0);
  progress.wrongAttempts = Object.values(progress.stopProgress)
    .reduce((total, stop) => total + Math.max(0, stop.attempts - 1), 0);
  if (progress.finalized && !progress.finalResult) {
    progress.finalResult = {
      title: gamePack.title,
      summary: `MOERASDRAAK\nTeam ${team.name}`,
      score: progress.totalScore,
      durationMinutes: Math.max(1, Math.round((Date.parse(team.updatedAt) - Date.parse(team.createdAt)) / 60_000)),
      hintsUsed: progress.totalHintsUsed,
      wrongAttempts: progress.wrongAttempts,
      symbols: progress.collectedRewards,
      createdAt: team.updatedAt
    };
  }
  return {
    ...state,
    team,
    progress,
    progressVersion: state.progressVersion ?? state.progress.version ?? 1,
    currentLocation: state.currentLocation
      ? { ...state.currentLocation, isCurrent: state.locationStatus === 'current' }
      : null,
    verifications: state.verifications ?? [],
    currentObservation: state.currentObservation ?? null,
    observationStatus: state.observationStatus ?? 'unavailable'
  };
}

export async function joinTeamByCode(joinCode: string, deviceId?: string) {
  const resolvedDeviceId = deviceId ?? await getOrCreateDeviceId();
  const response = await callRpc<{
    ok: true;
    session?: StoredTeamSession;
    state?: RemoteTeamState;
  }>('join_team_by_code', {
    p_normalized_code: joinCode,
    p_device_id: resolvedDeviceId,
    p_user_agent: navigator.userAgent
  });
  if (!response.state?.team?.id || !response.session) {
    throw new TeamSyncError('INVALID_TEAM_CODE', errorMessages.INVALID_TEAM_CODE);
  }
  const state = normalizeTeamState(response.state);
  return {
    ...state,
    activeGameRun: state.activeGame,
    session: response.session,
    deviceId: resolvedDeviceId
  };
}

export function heartbeatTeamSession(sessionId: string) {
  return callRpc<{
    ok: true;
    sessionId: string;
    lastSeenAt: string;
    activeSessionCount: number;
  }>('heartbeat_team_session', { p_session_id: sessionId });
}

export async function updateTeamLocation(input: UpdateTeamLocationInput) {
  const response = await callRpc<{
    ok: true;
    currentLocation: TeamLocation | null;
    locationStatus: 'current' | 'stale';
  }>('update_team_location', {
    p_session_id: input.sessionId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracyM,
    p_altitude_m: input.altitudeM ?? null,
    p_heading_deg: input.headingDeg ?? null,
    p_speed_mps: input.speedMps ?? null,
    p_captured_at: input.capturedAt
  });
  return response.currentLocation;
}

export async function advanceTeamStep(input: AdvanceTeamStepInput) {
  const response = await callRpc<{ ok: true; state: RemoteTeamState }>('advance_team_step', {
    p_session_id: input.sessionId,
    p_expected_version: input.expectedVersion,
    p_target_step_id: input.targetStepId
  });
  return normalizeTeamState(response.state);
}

export async function verifyStopObservation(input: {
  sessionId: string;
  stopId: string;
  questionId: string;
  answer: string;
  actionId: string;
}) {
  const response = await callRpc<{
    ok: true;
    verified: boolean;
    observation?: StopObservation | null;
    state: RemoteTeamState;
  }>('verify_stop_observation', {
    p_session_id: input.sessionId,
    p_stop_id: input.stopId,
    p_question_id: input.questionId,
    p_answer: input.answer,
    p_action_id: input.actionId
  });
  return { ...response, state: normalizeTeamState(response.state) };
}

export async function selectBackupStopObservation(input: {
  sessionId: string;
  stopId: string;
  actionId: string;
}) {
  const response = await callRpc<{
    ok: true;
    observation: StopObservation | null;
    state: RemoteTeamState;
  }>('select_backup_stop_observation', {
    p_session_id: input.sessionId,
    p_stop_id: input.stopId,
    p_action_id: input.actionId
  });
  return { ...response, state: normalizeTeamState(response.state) };
}

export async function startOrResumeTeamGame(input: StartOrResumeTeamGameInput) {
  const response = await callRpc<{ ok: true; resumed: boolean; run: TeamGameRun }>('start_or_resume_team_game', {
    p_session_id: input.sessionId,
    p_game_id: input.gameId
  });
  return response.run;
}

export async function updateTeamGameState(input: UpdateTeamGameStateInput) {
  const response = await callRpc<{
    ok: true;
    run: TeamGameRun;
    actionResult?: Record<string, unknown>;
  }>('update_team_game_state', {
    p_session_id: input.sessionId,
    p_run_id: input.runId,
    p_expected_version: input.expectedVersion,
    p_action: input.action,
    p_payload: input.payload
  });
  return response;
}

export async function completeTeamGame(input: CompleteTeamGameInput) {
  const response = await callRpc<{
    ok: true;
    alreadyCompleted: boolean;
    state: RemoteTeamState;
  }>('complete_team_game', {
    p_session_id: input.sessionId,
    p_run_id: input.runId,
    p_expected_version: input.expectedVersion,
    p_result: input.result
  });
  return normalizeTeamState(response.state);
}

export async function revokeTeamSession(sessionId: string) {
  const response = await callRpc<{ ok: true; sessionId: string }>('revoke_team_session', {
    p_session_id: sessionId
  });
  return { revoked: response.sessionId === sessionId };
}

export async function getTeamState(sessionId: string) {
  const response = await callRpc<{ ok: true; state: RemoteTeamState }>('get_team_state', {
    p_session_id: sessionId
  });
  return normalizeTeamState(response.state);
}

export function subscribeToTeamState(
  teamId: string,
  onChange: () => void,
  onStatus?: (status: string) => void
) {
  const client = supabase;
  if (!client) return () => undefined;
  const channel = client.channel(`team-state:${teamId}`);
  for (const table of ['progress', 'team_game_runs', 'team_current_location']) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'city_game', table, filter: `team_id=eq.${teamId}` },
      onChange
    );
  }
  channel.subscribe((status) => onStatus?.(status));
  return () => {
    void client.removeChannel(channel);
  };
}

export function mergeRemoteProgress(team: TeamRecord, remote?: Partial<GameProgress>) {
  const initial = createInitialProgress(team.id, gamePack);
  const stopProgress = { ...initial.stopProgress };
  for (const [stopId, value] of Object.entries(remote?.stopProgress ?? {})) {
    if (stopProgress[stopId] && value) {
      stopProgress[stopId] = { ...stopProgress[stopId], ...value };
    }
  }
  return {
    ...initial,
    ...remote,
    teamId: team.id,
    gameSlug: team.gameSlug,
    gameVersion: team.gameVersion,
    stopProgress
  };
}
