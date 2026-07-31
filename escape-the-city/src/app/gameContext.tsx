import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { gamePack } from '../game-data/moerasdraak/game';
import { canStartFinale, challengeAnswerIsCorrect, hasLocationUnlock, normalizeJoinCode, type GameProgress, type TeamRecord } from '../features/game/gameState';
import {
  clearLastTeamId,
  clearSensitiveSessionData,
  deleteTeam,
  getOrCreateDeviceId,
  deleteQueueItem,
  loadLastTeamId,
  loadProgress,
  loadQueueItems,
  loadStoredSettings,
  loadTeam,
  loadTeamSession,
  loadTeamSnapshot,
  loadTeams,
  saveTeam,
  saveQueueItem,
  saveTeamSession,
  saveTeamSnapshotIfNewer,
  updateStoredSettings,
  type StoredSettings,
  type StoredTeamSession
} from '../features/offline/storage';
import {
  completeTeamGame,
  fetchTeamRadioMessages,
  getTeamState,
  heartbeatTeamSession,
  getTeamRadioMessageUrl,
  isSupabaseAvailable,
  joinTeamByCode,
  sendTeamRadioMessage,
  uploadTeamRadioRecording,
  revokeTeamSession,
  selectBackupStopObservation,
  startOrResumeTeamGame,
  subscribeToTeamState,
  TeamSyncError,
  type TeamRadioMessage,
  updateTeamGameState,
  updateTeamLocation,
  verifyStopObservation,
  type TeamGameRun,
  type TeamLocation,
  type StopObservation,
  type TeamState
} from '../lib/supabase/sync';
import type { ChallengeConfig } from '../features/game/gameTypes';
import { browserLocationProvider } from '../features/location/browserProvider';
import { shouldSendLocation, type LastSentLocation } from '../features/location/locationThrottle';
import type { LocationErrorResult, LocationResult } from '../features/location/provider';

interface GameContextValue {
  loading: boolean;
  teams: TeamRecord[];
  activeTeam: TeamRecord | null;
  progress: GameProgress | null;
  settings: StoredSettings;
  syncStatus: 'saved' | 'local' | 'syncing' | 'failed' | 'offline';
  syncMessage: string;
  teamLocation: TeamLocation | null;
  activeSessionCount: number;
  activeGameRun: TeamGameRun | null;
  locationError: LocationErrorResult | null;
  currentObservation: StopObservation | null;
  observationStatus: TeamState['observationStatus'];
  teamRadioMessages: TeamRadioMessage[];
  resumeWithJoinCode: (code: string) => Promise<string>;
  removeActiveTeam: () => Promise<void>;
  updateSettings: (patch: Partial<StoredSettings>) => void;
  syncNow: () => Promise<void>;
  submitObservation: (stopId: string, questionId: string, answer: string) => Promise<{ verified: boolean; pending?: boolean }>;
  selectBackupObservation: (stopId: string) => Promise<void>;
  submitSimulatedLocation: (location: LocationResult) => Promise<void>;
  sendRadioMessage: (payload: { audio: Blob; durationMs: number; transcript?: string }) => Promise<void>;
  startStop: (stopId: string) => Promise<boolean>;
  useHint: (stopId: string, hintId: string) => Promise<void>;
  attemptAnswer: (stopId: string, challenge: ChallengeConfig, answer: unknown) => Promise<{ correct: boolean; message: string }>;
  completeFinale: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);
const HEARTBEAT_INTERVAL_MS = 20_000;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamRecord | null>(null);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [settings, setSettings] = useState<StoredSettings>(() => loadStoredSettings());
  const [syncStatus, setSyncStatus] = useState<GameContextValue['syncStatus']>('saved');
  const [syncMessage, setSyncMessage] = useState('Alles opgeslagen');
  const [teamLocation, setTeamLocation] = useState<TeamLocation | null>(null);
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const [activeGameRun, setActiveGameRun] = useState<TeamGameRun | null>(null);
  const [locationError, setLocationError] = useState<LocationErrorResult | null>(null);
  const [currentObservation, setCurrentObservation] = useState<StopObservation | null>(null);
  const [observationStatus, setObservationStatus] = useState<TeamState['observationStatus']>('unavailable');
  const [teamRadioMessages, setTeamRadioMessages] = useState<TeamRadioMessage[]>([]);
  const [session, setSession] = useState<StoredTeamSession | null>(null);
  const sessionRef = useRef<StoredTeamSession | null>(null);
  const progressRef = useRef<GameProgress | null>(null);
  const gameRunRef = useRef<TeamGameRun | null>(null);

  const applyServerState = useCallback(async (state: TeamState, stateSession = sessionRef.current) => {
    if (!stateSession) return false;
    const serverProgress = { ...state.progress, version: state.progressVersion };
    const accepted = await saveTeamSnapshotIfNewer({
      teamId: state.team.id,
      sessionId: stateSession.id,
      deviceId: stateSession.deviceId,
      progress: serverProgress,
      progressVersion: state.progressVersion,
      activeGameRun: state.activeGame,
      activeGameVersion: state.activeGame?.version ?? null,
      currentLocation: state.currentLocation,
      activeSessionCount: state.activeSessionCount,
      sessionStateAt: state.sessionStateAt,
      lastSyncedAt: new Date().toISOString()
    });
    if (!accepted) return false;
    await Promise.all([saveTeam(state.team), saveTeamSession(stateSession)]);
    sessionRef.current = stateSession;
    progressRef.current = serverProgress;
    gameRunRef.current = state.activeGame;
    setActiveGameRun(state.activeGame);
    setSession(stateSession);
    setActiveTeam(state.team);
    setProgress(serverProgress);
    setTeamLocation(state.currentLocation);
    setActiveSessionCount(state.activeSessionCount);
    setCurrentObservation(state.currentObservation);
    setObservationStatus(state.observationStatus);
    setTeams((items) => [state.team, ...items.filter((item) => item.id !== state.team.id)]);
    setSyncStatus('saved');
    setSyncMessage(state.activeSessionCount > 1 ? `${state.activeSessionCount} spelers actief` : 'Alles opgeslagen');
    return true;
  }, []);

  const refreshTeamRadioMessages = useCallback(async (sessionId = sessionRef.current?.id) => {
    if (!sessionId || !navigator.onLine) return;
    try {
      const current = await fetchTeamRadioMessages(sessionId);
      setTeamRadioMessages(current.map((message) => ({
        ...message,
        isMine: message.sessionId === sessionId,
        audioUrl: getTeamRadioMessageUrl(message.storagePath)
      })));
    } catch {
      // Radio messages are optional to the game loop; keep it silent.
    }
  }, []);

  const fetchServerState = useCallback(async (sessionId = sessionRef.current?.id) => {
    if (!sessionId || !isSupabaseAvailable() || !navigator.onLine) return null;
    setSyncStatus('syncing');
    setSyncMessage('Synchroniseren…');
    try {
      const state = await getTeamState(sessionId);
      await applyServerState(state);
      await refreshTeamRadioMessages(sessionId);
      return state;
    } catch (error) {
      if (error instanceof TeamSyncError && (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_NOT_FOUND')) {
        sessionRef.current = null;
        progressRef.current = null;
        gameRunRef.current = null;
        setSession(null);
        setActiveTeam(null);
        setProgress(null);
        setActiveGameRun(null);
        setTeamLocation(null);
        setActiveSessionCount(0);
        setTeamRadioMessages([]);
        clearLastTeamId();
        await clearSensitiveSessionData();
      }
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Synchroniseren is mislukt.');
      throw error;
    }
  }, [applyServerState, refreshTeamRadioMessages]);

  const replayObservationQueue = useCallback(async (sessionId: string) => {
    const teamId = sessionRef.current?.teamId;
    if (!teamId || !navigator.onLine) return;
    const items = (await loadQueueItems(teamId))
      .filter((item) => item.eventType === 'verify_stop_observation')
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    for (const item of items) {
      const stopId = item.stopId;
      if (!stopId) {
        await deleteQueueItem(item.id);
        continue;
      }
      const currentState = progressRef.current?.stopProgress[stopId]?.state;
      if (currentState && ['arrived', 'started', 'completed'].includes(currentState)) {
        await deleteQueueItem(item.id);
        continue;
      }
      try {
        const result = await verifyStopObservation({
          sessionId,
          stopId,
          questionId: String(item.payload.questionId ?? ''),
          answer: String(item.payload.answer ?? ''),
          actionId: item.id
        });
        await applyServerState(result.state);
        await deleteQueueItem(item.id);
      } catch (error) {
        if (error instanceof TeamSyncError && !['UNKNOWN', 'SYNC_UNAVAILABLE'].includes(error.code)) {
          await deleteQueueItem(item.id);
          continue;
        }
        break;
      }
    }
  }, [applyServerState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const teamList = await loadTeams();
      const lastTeamId = loadLastTeamId();
      setTeams(teamList);
      if (lastTeamId) {
        const team = teamList.find((item) => item.id === lastTeamId) ?? await loadTeam(lastTeamId) ?? null;
        const [storedSession, snapshot, storedProgress] = await Promise.all([
          loadTeamSession(lastTeamId),
          loadTeamSnapshot(lastTeamId),
          loadProgress(lastTeamId)
        ]);
        if (!cancelled && team) {
          const cachedProgress = snapshot?.progress ?? storedProgress ?? null;
          setActiveTeam(team);
          setProgress(cachedProgress);
          setSession(storedSession ?? null);
          sessionRef.current = storedSession ?? null;
          progressRef.current = cachedProgress;
          gameRunRef.current = snapshot?.activeGameRun as TeamGameRun | null ?? null;
          setActiveGameRun(gameRunRef.current);
          setTeamLocation(snapshot?.currentLocation as TeamLocation | null ?? null);
          setActiveSessionCount(snapshot?.activeSessionCount ?? 0);
          setSyncStatus(navigator.onLine ? 'local' : 'offline');
          setSyncMessage(navigator.onLine ? 'Opgeslagen stand laden…' : 'Offline opgeslagen');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeTeam || !session) return;
    let disposed = false;
    let reconnectGeneration = 0;
    let unsubscribe: (() => void) | undefined;

    const heartbeat = async () => {
      if (disposed || document.hidden || !navigator.onLine) return;
      try {
        const updated = await heartbeatTeamSession(session.id);
        const nextSession = { ...session, lastSeenAt: updated.lastSeenAt };
        sessionRef.current = nextSession;
        setSession(nextSession);
        setActiveSessionCount(updated.activeSessionCount);
        setSyncMessage(updated.activeSessionCount > 1 ? `${updated.activeSessionCount} spelers actief` : 'Alles opgeslagen');
        await saveTeamSession(nextSession);
      } catch (error) {
        if (error instanceof TeamSyncError && (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_NOT_FOUND')) {
          disposed = true;
          unsubscribe?.();
          sessionRef.current = null;
          setSession(null);
          setActiveGameRun(null);
          setTeamRadioMessages([]);
          await clearSensitiveSessionData(activeTeam.id);
        }
      }
    };

    const reconnect = async () => {
      const generation = ++reconnectGeneration;
      unsubscribe?.();
      unsubscribe = undefined;
      if (disposed || !navigator.onLine) return;
      try {
        await fetchServerState(session.id);
        await replayObservationQueue(session.id);
        await fetchServerState(session.id);
        if (!disposed && generation === reconnectGeneration) {
          unsubscribe = subscribeToTeamState(activeTeam.id, () => { void fetchServerState(session.id); });
        }
      } catch {
        // Status is set by fetchServerState; a later online/visibility event retries.
      }
    };

    const onOnline = () => { void reconnect().then(heartbeat); };
    const onOffline = () => {
      unsubscribe?.();
      unsubscribe = undefined;
      setSyncStatus('offline');
      setSyncMessage('Offline opgeslagen');
    };
    const onVisibility = () => {
      if (!document.hidden) void reconnect().then(heartbeat);
    };
    const heartbeatTimer = window.setInterval(() => { void heartbeat(); }, HEARTBEAT_INTERVAL_MS);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    void reconnect().then(heartbeat);

    return () => {
      disposed = true;
      reconnectGeneration += 1;
      window.clearInterval(heartbeatTimer);
      unsubscribe?.();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeTeam?.id, session?.id, fetchServerState, replayObservationQueue]);

  useEffect(() => {
    if (!session || !browserLocationProvider.watchPosition) return;
    let disposed = false;
    let sending = false;
    let lastSent: LastSentLocation | null = null;

    const stopWatching = browserLocationProvider.watchPosition((outcome) => {
      if (disposed) return;
      if ('kind' in outcome) {
        setLocationError(outcome);
        return;
      }
      setLocationError(null);
      if (sending || !navigator.onLine) return;
      const now = Date.now();
      if (!shouldSendLocation(lastSent, outcome, now)) return;
      sending = true;
      void updateTeamLocation({
        sessionId: session.id,
        latitude: outcome.latitude,
        longitude: outcome.longitude,
        accuracyM: outcome.accuracy,
        altitudeM: outcome.altitude,
        headingDeg: outcome.heading,
        speedMps: outcome.speed,
        capturedAt: outcome.capturedAt ?? new Date().toISOString()
      }).then((location) => {
        if (!disposed) setTeamLocation(location);
        lastSent = { location: outcome, sentAt: Date.now() };
        return fetchServerState(session.id);
      }).catch((error) => {
        if (error instanceof TeamSyncError && (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_NOT_FOUND')) {
          sessionRef.current = null;
          setSession(null);
          setTeamRadioMessages([]);
        }
      }).finally(() => {
        sending = false;
      });
    }, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 15_000 });

    return () => {
      disposed = true;
      stopWatching();
    };
  }, [session?.id, fetchServerState]);

  async function resumeWithJoinCode(code: string) {
    const normalized = normalizeJoinCode(code);
    if (!normalized || normalized.length > 32) throw new Error('Voer een geldige teamcode in.');
    if (!navigator.onLine || !isSupabaseAvailable()) {
      throw new Error('Je bent offline. Maak verbinding om met een teamcode deel te nemen.');
    }
    const deviceId = await getOrCreateDeviceId();
    const remote = await joinTeamByCode(normalized, deviceId);
    if (!remote.session) throw new Error('De teamsessie kon niet worden geopend.');
    await applyServerState({
      team: remote.team,
      progress: remote.progress,
      progressVersion: remote.progressVersion ?? remote.progress.version,
      activeGame: remote.activeGameRun ?? null,
      currentLocation: remote.currentLocation ?? null,
      locationStatus: remote.locationStatus ?? 'stale',
      activeSessionCount: remote.activeSessionCount ?? 1,
      sessionStateAt: remote.sessionStateAt,
      verifications: remote.verifications ?? [],
      currentObservation: remote.currentObservation ?? null,
      observationStatus: remote.observationStatus ?? 'unavailable'
    }, remote.session);
    await refreshTeamRadioMessages(remote.session.id);
    return remote.team.id;
  }

  async function removeActiveTeam() {
    const teamId = activeTeam?.id;
    const activeSession = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    if (activeSession && navigator.onLine && isSupabaseAvailable()) {
      try {
        await revokeTeamSession(activeSession.id);
      } catch {
        // Local logout must still finish when the revoke request cannot be delivered.
      }
    }
    if (teamId) {
      await clearSensitiveSessionData(teamId);
      await deleteTeam(teamId);
    }
    clearLastTeamId();
    progressRef.current = null;
    gameRunRef.current = null;
    setActiveGameRun(null);
    setActiveTeam(null);
    setProgress(null);
    setTeamLocation(null);
    setLocationError(null);
    setCurrentObservation(null);
    setObservationStatus('unavailable');
    setActiveSessionCount(0);
    setTeamRadioMessages([]);
    setTeams(await loadTeams());
    setSyncStatus('saved');
    setSyncMessage('Alles opgeslagen');
  }

  function updateSettings(patch: Partial<StoredSettings>) {
    const next = updateStoredSettings(settings, patch);
    setSettings(next);
  }

  async function ensureGameRun(gameId: string) {
    const activeSession = sessionRef.current;
    if (!activeSession || !navigator.onLine) {
      throw new Error('Je bent offline. Maak opnieuw verbinding om deze actie voor het team uit te voeren.');
    }
    const current = gameRunRef.current;
    if (current?.status === 'active' && current.gameId === gameId) return current;
    const run = await startOrResumeTeamGame({ sessionId: activeSession.id, gameId });
    gameRunRef.current = run;
    setActiveGameRun(run);
    return run;
  }

  async function runVersionedAction(gameId: string, action: string, payload: Record<string, unknown>) {
    const activeSession = sessionRef.current;
    if (!activeSession) throw new Error('Voer de teamcode opnieuw in.');
    try {
      const run = await ensureGameRun(gameId);
      const updated = await updateTeamGameState({
        sessionId: activeSession.id,
        runId: run.id,
        expectedVersion: run.version,
        action,
        payload
      });
      gameRunRef.current = updated.run;
      await fetchServerState(activeSession.id);
      return updated;
    } catch (error) {
      if (error instanceof TeamSyncError && error.code === 'VERSION_CONFLICT') {
        await fetchServerState(activeSession.id);
      }
      throw error;
    }
  }

  async function syncNow() {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      setSyncMessage('Offline opgeslagen');
      return;
    }
    await fetchServerState();
  }

  async function submitObservation(stopId: string, questionId: string, answer: string) {
    const activeSession = sessionRef.current;
    const teamId = activeSession?.teamId;
    if (!activeSession || !teamId) throw new Error('Voer de teamcode opnieuw in.');
    const actionId = crypto.randomUUID();
    if (!navigator.onLine) {
      await saveQueueItem({
        id: actionId,
        teamId,
        eventType: 'verify_stop_observation',
        stopId,
        payload: { questionId, answer },
        occurredAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending'
      });
      return { verified: false, pending: true };
    }
    try {
      const result = await verifyStopObservation({
        sessionId: activeSession.id,
        stopId,
        questionId,
        answer,
        actionId
      });
      await applyServerState(result.state);
      return { verified: result.verified };
    } catch (error) {
      throw error;
    }
  }

  async function selectBackupObservation(stopId: string) {
    const activeSession = sessionRef.current;
    if (!activeSession || !navigator.onLine) {
      throw new Error('Maak verbinding om de reservevraag te laden.');
    }
    const result = await selectBackupStopObservation({
      sessionId: activeSession.id,
      stopId,
      actionId: crypto.randomUUID()
    });
    await applyServerState(result.state);
  }

  async function submitSimulatedLocation(location: LocationResult) {
    const activeSession = sessionRef.current;
    if (!activeSession) throw new Error('Voer de teamcode opnieuw in.');
    await updateTeamLocation({
      sessionId: activeSession.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracy,
      altitudeM: location.altitude,
      headingDeg: location.heading,
      speedMps: location.speed,
      capturedAt: location.capturedAt ?? new Date().toISOString()
    });
    await fetchServerState(activeSession.id);
  }

  async function sendRadioMessage({ audio, durationMs, transcript }: { audio: Blob; durationMs: number; transcript?: string }) {
    const activeSession = sessionRef.current;
    if (!activeSession || !activeTeam) throw new Error('Voer de teamcode opnieuw in.');
    if (!navigator.onLine) throw new Error('Je bent offline. Opnames worden direct verzonden als er netwerk is.');

    const fallbackType = audio.type || 'audio/webm';
    const extension = fallbackType.includes('ogg') ? 'ogg' : fallbackType.includes('wav') ? 'wav' : 'webm';
    // `storage.from(bucket)` already selects the bucket. The storage policy
    // therefore expects the object path to start with the team UUID.
    const path = `${activeTeam.id}/${activeSession.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await uploadTeamRadioRecording(path, audio);
    await sendTeamRadioMessage({
      sessionId: activeSession.id,
      storagePath: path,
      mimeType: fallbackType,
      durationMs,
      senderAlias: `Pionier ${activeSession.id.slice(0, 4).toUpperCase()}`,
      transcript
    } satisfies {
      sessionId: string;
      storagePath: string;
      mimeType: string;
      durationMs: number;
      senderAlias: string;
      transcript?: string;
    });
    await refreshTeamRadioMessages(activeSession.id);
  }

  async function startStop(stopId: string) {
    const currentProgress = progressRef.current;
    if (!currentProgress || !hasLocationUnlock(currentProgress, stopId)) return false;
    try {
      await ensureGameRun(stopId);
      await fetchServerState();
      return true;
    } catch (error) {
      if (error instanceof TeamSyncError && error.code === 'ACTIVE_GAME_EXISTS') {
        await fetchServerState();
        return false;
      }
      throw error;
    }
  }

  async function useHint(stopId: string, hintId: string) {
    await runVersionedAction(stopId, 'use_hint', { hintId });
  }

  async function attemptAnswer(stopId: string, challenge: ChallengeConfig, answer: unknown) {
    const currentProgress = progressRef.current;
    if (!currentProgress || !activeTeam) return { correct: false, message: 'Geen actieve voortgang.' };
    const stop = currentProgress.stopProgress[stopId];
    if (!stop) return { correct: false, message: 'Onbekende stop.' };
    if (stop.state === 'completed') return { correct: true, message: 'Deze opdracht was al voltooid.' };
    if (stop.state !== 'started' || !hasLocationUnlock(currentProgress, stopId)) {
      return { correct: false, message: 'Controleer eerst jullie locatie.' };
    }
    const expectedCorrect = challengeAnswerIsCorrect(challenge, answer);
    const updated = await runVersionedAction(stopId, 'submit_answer', { answer });
    const correct = updated.actionResult?.correct === true;
    if (correct !== expectedCorrect && import.meta.env.DEV) {
      console.warn('Server- en clientantwoordvalidatie verschillen voor', stopId);
    }
    if (correct && stopId !== gamePack.finalStopId) {
      const activeSession = sessionRef.current;
      if (!activeSession) throw new Error('Voer de teamcode opnieuw in.');
      const state = await completeTeamGame({
        sessionId: activeSession.id,
        runId: updated.run.id,
        expectedVersion: updated.run.version,
        result: { completedAt: new Date().toISOString() }
      });
      await applyServerState(state);
    }
    return correct
      ? { correct: true, message: 'Goed antwoord.' }
      : { correct: false, message: 'Nog niet juist.' };
  }

  async function completeFinale() {
    const currentProgress = progressRef.current;
    const activeSession = sessionRef.current;
    if (!currentProgress || !activeTeam || !activeSession || currentProgress.finalized) return;
    const eligibility = canStartFinale(currentProgress, gamePack);
    if (eligibility.missingCount > 0) return;
    const run = await ensureGameRun(gamePack.finalStopId);
    const result = {
      title: gamePack.title,
      summary: `MOERASDRAAK\nTeam ${activeTeam.name}\n\nGebrouwen met water, moed, verbeelding en een sterk verhaal.`,
      score: currentProgress.totalScore,
      durationMinutes: Math.max(1, Math.round((Date.now() - Date.parse(activeTeam.createdAt)) / 60000)),
      hintsUsed: currentProgress.totalHintsUsed,
      wrongAttempts: currentProgress.wrongAttempts,
      symbols: currentProgress.collectedRewards,
      createdAt: new Date().toISOString()
    };
    try {
      const state = await completeTeamGame({
        sessionId: activeSession.id,
        runId: run.id,
        expectedVersion: run.version,
        result
      });
      await applyServerState(state);
    } catch (error) {
      if (error instanceof TeamSyncError && error.code === 'VERSION_CONFLICT') await fetchServerState(activeSession.id);
      throw error;
    }
  }

  const value = useMemo<GameContextValue>(() => ({
    loading,
    teams,
    activeTeam,
    progress,
    settings,
    syncStatus,
    syncMessage,
    teamLocation,
    activeSessionCount,
    activeGameRun,
    locationError,
    teamRadioMessages,
    currentObservation,
    observationStatus,
    sendRadioMessage,
    resumeWithJoinCode,
    removeActiveTeam,
    updateSettings,
    syncNow,
    submitObservation,
    selectBackupObservation,
    submitSimulatedLocation,
    startStop,
    useHint,
    attemptAnswer,
    completeFinale
  }), [loading, teams, activeTeam, progress, settings, syncStatus, syncMessage, teamLocation, activeSessionCount, activeGameRun, locationError, teamRadioMessages, currentObservation, observationStatus, sendRadioMessage]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('GameProvider ontbreekt.');
  return value;
}
