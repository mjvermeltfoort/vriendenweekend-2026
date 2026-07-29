import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { gamePack } from '../game-data/moerasdraak/game';
import { canStartFinale, challengeAnswerIsCorrect, hasLocationUnlock, normalizeJoinCode, type GameProgress, type TeamRecord } from '../features/game/gameState';
import {
  clearLastTeamId,
  clearSensitiveSessionData,
  deleteTeam,
  getOrCreateDeviceId,
  loadLastTeamId,
  loadProgress,
  loadStoredSettings,
  loadTeam,
  loadTeamSession,
  loadTeamSnapshot,
  loadTeams,
  saveTeam,
  saveTeamSession,
  saveTeamSnapshotIfNewer,
  updateStoredSettings,
  type StoredSettings,
  type StoredTeamSession
} from '../features/offline/storage';
import {
  advanceTeamStep,
  completeTeamGame,
  getTeamState,
  heartbeatTeamSession,
  isSupabaseAvailable,
  joinTeamByCode,
  revokeTeamSession,
  startOrResumeTeamGame,
  subscribeToTeamState,
  TeamSyncError,
  updateTeamGameState,
  updateTeamLocation,
  type TeamGameRun,
  type TeamLocation,
  type TeamState
} from '../lib/supabase/sync';
import type { ChallengeConfig } from '../features/game/gameTypes';
import { browserLocationProvider } from '../features/location/browserProvider';

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
  resumeWithJoinCode: (code: string) => Promise<string>;
  removeActiveTeam: () => Promise<void>;
  updateSettings: (patch: Partial<StoredSettings>) => void;
  syncNow: () => Promise<void>;
  unlockStop: (stopId: string, method: 'gps' | 'manual') => Promise<void>;
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
    setTeams((items) => [state.team, ...items.filter((item) => item.id !== state.team.id)]);
    setSyncStatus('saved');
    setSyncMessage(state.activeSessionCount > 1 ? `${state.activeSessionCount} spelers actief` : 'Alles opgeslagen');
    return true;
  }, []);

  const fetchServerState = useCallback(async (sessionId = sessionRef.current?.id) => {
    if (!sessionId || !isSupabaseAvailable() || !navigator.onLine) return null;
    setSyncStatus('syncing');
    setSyncMessage('Synchroniseren…');
    try {
      const state = await getTeamState(sessionId);
      await applyServerState(state);
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
        clearLastTeamId();
        await clearSensitiveSessionData();
      }
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Synchroniseren is mislukt.');
      throw error;
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
  }, [activeTeam?.id, session?.id, fetchServerState]);

  useEffect(() => {
    if (!session || !browserLocationProvider.watchPosition) return;
    let disposed = false;
    let sending = false;
    let lastSentAt = 0;
    let lastAccuracy = Number.POSITIVE_INFINITY;

    const stopWatching = browserLocationProvider.watchPosition((outcome) => {
      if (disposed || sending || !navigator.onLine || 'kind' in outcome) return;
      const now = Date.now();
      const accuracyImproved = outcome.accuracy + 10 < lastAccuracy;
      if (!accuracyImproved && now - lastSentAt < 5_000) return;
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
        lastSentAt = Date.now();
        lastAccuracy = outcome.accuracy;
      }).catch((error) => {
        if (error instanceof TeamSyncError && (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_NOT_FOUND')) {
          sessionRef.current = null;
          setSession(null);
        }
      }).finally(() => {
        sending = false;
      });
    }, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 15_000 });

    return () => {
      disposed = true;
      stopWatching();
    };
  }, [session?.id]);

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
      sessionStateAt: remote.sessionStateAt
    }, remote.session);
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
    setActiveSessionCount(0);
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

  async function unlockStop(stopId: string, _method: 'gps' | 'manual') {
    const activeSession = sessionRef.current;
    const currentProgress = progressRef.current;
    if (!activeSession || !currentProgress) return;
    try {
      const state = await advanceTeamStep({
        sessionId: activeSession.id,
        expectedVersion: currentProgress.version,
        targetStepId: stopId
      });
      await applyServerState(state);
    } catch (error) {
      if (error instanceof TeamSyncError && error.code === 'VERSION_CONFLICT') await fetchServerState(activeSession.id);
      throw error;
    }
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
    resumeWithJoinCode,
    removeActiveTeam,
    updateSettings,
    syncNow,
    unlockStop,
    startStop,
    useHint,
    attemptAnswer,
    completeFinale
  }), [loading, teams, activeTeam, progress, settings, syncStatus, syncMessage, teamLocation, activeSessionCount, activeGameRun]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('GameProvider ontbreekt.');
  return value;
}
