import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { gamePack } from '../game-data/moerasdraak/game';
import { createInitialProgress, createTeamRecord, normalizeJoinCode, type GameProgress, type SyncQueueItem, type TeamRecord } from '../features/game/gameState';
import { clearLastTeamId, deleteQueueItem, deleteTeam, loadLastTeamId, loadProgress, loadQueueItems, loadStoredSettings, loadTeam, loadTeams, saveProgress, saveQueueItem, saveStoredSettings, saveTeam, type StoredSettings } from '../features/offline/storage';
import { isSupabaseAvailable, joinTeamByCode, syncQueueItem } from '../lib/supabase/sync';
import type { ChallengeConfig } from '../features/game/gameTypes';

interface GameContextValue {
  loading: boolean;
  teams: TeamRecord[];
  activeTeam: TeamRecord | null;
  progress: GameProgress | null;
  queue: SyncQueueItem[];
  settings: StoredSettings;
  syncStatus: 'saved' | 'local' | 'syncing' | 'failed' | 'offline';
  syncMessage: string;
  createTeam: (input: { name: string; members: string[]; privacyAccepted: boolean }) => Promise<void>;
  activateTeam: (teamId: string) => Promise<void>;
  resumeWithJoinCode: (code: string) => Promise<string>;
  removeActiveTeam: () => Promise<void>;
  updateSettings: (patch: Partial<StoredSettings>) => void;
  enqueue: (eventType: string, payload: Record<string, unknown>, stopId?: string) => Promise<void>;
  syncNow: () => Promise<void>;
  unlockStop: (stopId: string, method: 'gps' | 'manual') => Promise<void>;
  startStop: (stopId: string) => Promise<void>;
  useHint: (stopId: string, hintId: string) => Promise<void>;
  attemptAnswer: (stopId: string, challenge: ChallengeConfig, answer: unknown) => Promise<{ correct: boolean; message: string }>;
  completeFinale: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

function uid() {
  return crypto.randomUUID();
}

function cloneProgress(progress: GameProgress): GameProgress {
  return structuredClone(progress);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamRecord | null>(null);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [settings, setSettings] = useState<StoredSettings>(() => loadStoredSettings());
  const [syncStatus, setSyncStatus] = useState<GameContextValue['syncStatus']>('saved');
  const [syncMessage, setSyncMessage] = useState('Alles opgeslagen');

  async function refresh() {
    const [teamList, lastTeamId] = await Promise.all([loadTeams(), Promise.resolve(loadLastTeamId())]);
    setTeams(teamList);
    if (lastTeamId) {
      const team = teamList.find((item) => item.id === lastTeamId) ?? null;
      setActiveTeam(team);
      if (team) {
        const stored = await loadProgress(team.id);
        setProgress(stored ?? createInitialProgress(team.id, gamePack));
        setQueue(await loadQueueItems(team.id));
      }
    }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const online = () => { void syncNow(); };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncNow(); });
    return () => window.removeEventListener('online', online);
  }, []);

  async function persistTeam(team: TeamRecord, nextProgress: GameProgress) {
    await Promise.all([saveTeam(team), saveProgress(nextProgress)]);
    setTeams((items) => [team, ...items.filter((item) => item.id !== team.id)]);
    setActiveTeam(team);
    setProgress(nextProgress);
    setQueue(await loadQueueItems(team.id));
    setSyncStatus(isSupabaseAvailable() ? 'local' : 'offline');
    setSyncMessage(isSupabaseAvailable() ? 'Lokaal opgeslagen' : 'Offline opgeslagen');
  }

  async function pushEvent(eventType: string, payload: Record<string, unknown>, stopId?: string, teamArg = activeTeam, progressArg = progress) {
    if (!teamArg || !progressArg) return;
    const item: SyncQueueItem = { id: uid(), teamId: teamArg.id, eventType, stopId, payload, occurredAt: new Date().toISOString(), attempts: 0, status: 'pending' };
    await saveQueueItem(item);
    const nextQueue = await loadQueueItems(teamArg.id);
    setQueue(nextQueue);
    setSyncStatus(isSupabaseAvailable() ? 'local' : 'offline');
    setSyncMessage(isSupabaseAvailable() ? 'Lokaal opgeslagen' : 'Offline opgeslagen');
  }

  async function createTeam(input: { name: string; members: string[]; privacyAccepted: boolean }) {
    const team = createTeamRecord({ id: uid(), game: gamePack, name: input.name, members: input.members, privacyAccepted: input.privacyAccepted });
    const nextProgress = createInitialProgress(team.id, gamePack);
    await persistTeam(team, nextProgress);
    await pushEvent('team_created', { name: team.name, joinCode: team.joinCode, members: team.memberNames }, undefined, team, nextProgress);
    void syncNow();
  }

  async function activateTeam(teamId: string) {
    const team = await loadTeam(teamId);
    if (!team) return;
    setActiveTeam(team);
    const stored = await loadProgress(team.id);
    setProgress(stored ?? createInitialProgress(team.id, gamePack));
    setQueue(await loadQueueItems(team.id));
  }

  async function resumeWithJoinCode(code: string) {
    const normalized = normalizeJoinCode(code);
    if (!normalized || normalized.length !== 6) throw new Error('Voer een geldige teamcode in van 6 tekens.');
    const remote = await joinTeamByCode(normalized);
    await persistTeam(remote.team, remote.progress);
    await pushEvent('team_joined', { joinCode: normalized }, undefined, remote.team, remote.progress);
    void syncNow();
    return remote.team.id;
  }

  async function removeActiveTeam() {
    if (!activeTeam) return;
    await deleteTeam(activeTeam.id);
    setActiveTeam(null);
    setProgress(null);
    setQueue([]);
    clearLastTeamId();
    setTeams(await loadTeams());
  }

  function updateSettings(patch: Partial<StoredSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveStoredSettings(next);
  }

  async function syncNow() {
    if (!activeTeam || !progress) {
      setSyncStatus('saved');
      setSyncMessage('Alles opgeslagen');
      return;
    }
    if (!isSupabaseAvailable()) {
      setSyncStatus('offline');
      setSyncMessage('Offline opgeslagen');
      return;
    }
    const items = await loadQueueItems(activeTeam.id);
    if (!items.length) {
      setSyncStatus('saved');
      setSyncMessage('Alles opgeslagen');
      return;
    }
    setSyncStatus('syncing');
    let synced = 0;
    let failed: string | null = null;
    for (const item of items) {
      try {
        await syncQueueItem(item, activeTeam, progress);
        await saveQueueItem({ ...item, status: 'pending', attempts: item.attempts + 1, lastAttemptAt: new Date().toISOString() });
        await deleteQueueItem(item.id);
        synced += 1;
      } catch (error) {
        failed = error instanceof Error ? error.message : 'Onbekende synchronisatiefout';
        await saveQueueItem({ ...item, status: 'failed', attempts: item.attempts + 1, lastAttemptAt: new Date().toISOString(), lastError: failed });
        break;
      }
    }
    const remaining = await loadQueueItems(activeTeam.id);
    setQueue(remaining);
    if (failed) {
      setSyncStatus('failed');
      setSyncMessage(`Synchronisatie mislukt – ${failed}`);
    } else {
      setSyncStatus('saved');
      setSyncMessage(remaining.length ? `Offline opgeslagen (${remaining.length} acties)` : 'Alles opgeslagen');
    }
    const latestTeam = { ...activeTeam, lastActivityAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveTeam(latestTeam);
    setActiveTeam(latestTeam);
    setTeams((items) => [latestTeam, ...items.filter((item) => item.id !== latestTeam.id)]);
    setProgress((prev) => (prev ? { ...prev, lastSyncedAt: new Date().toISOString() } : prev));
    return void synced;
  }

  async function unlockStop(stopId: string, method: 'gps' | 'manual') {
    if (!progress) return;
    const next = cloneProgress(progress);
    const stop = next.stopProgress[stopId];
    if (!stop || stop.state === 'completed') return;
    stop.state = 'arrived';
    stop.unlockMethod = method;
    stop.arrivedAt = stop.arrivedAt ?? new Date().toISOString();
    const index = gamePack.stops.findIndex((item) => item.id === stopId);
    const nextStop = gamePack.stops[index + 1];
    if (nextStop && next.stopProgress[nextStop.id].state === 'locked') next.stopProgress[nextStop.id].state = 'available';
    next.currentStopId = stopId;
    await saveProgress(next);
    setProgress(next);
    await pushEvent('stop_unlocked', { method }, stopId);
  }

  async function startStop(stopId: string) {
    if (!progress) return;
    const next = cloneProgress(progress);
    const stop = next.stopProgress[stopId];
    if (!stop) return;
    stop.state = stop.state === 'completed' ? 'completed' : 'started';
    stop.startedAt = stop.startedAt ?? new Date().toISOString();
    next.currentStopId = stopId;
    await saveProgress(next);
    setProgress(next);
    await pushEvent('stop_started', {}, stopId);
  }

  async function useHint(stopId: string, hintId: string) {
    if (!progress) return;
    const next = cloneProgress(progress);
    const stop = next.stopProgress[stopId];
    if (!stop) return;
    stop.hintsUsed += 1;
    next.totalHintsUsed += 1;
    await saveProgress(next);
    setProgress(next);
    await pushEvent('hint_used', { hintId }, stopId);
  }

  async function attemptAnswer(stopId: string, challenge: ChallengeConfig, answer: unknown) {
    if (!progress || !activeTeam) return { correct: false, message: 'Geen actieve voortgang.' };
    const next = cloneProgress(progress);
    const stop = next.stopProgress[stopId];
    if (!stop) return { correct: false, message: 'Onbekende stop.' };
    stop.attempts += 1;
    const correct = (() => {
      if (challenge.kind === 'choice') return challenge.options.some((option) => option.id === String(answer) && option.correct);
      if (challenge.kind === 'code') return challenge.acceptedAnswers.some((value) => value.replace(/[\s-]/g, '').toUpperCase() === String(answer).replace(/[\s-]/g, '').toUpperCase());
      if (challenge.kind === 'reorder') return Array.isArray(answer) && answer.join('|') === challenge.correctOrder.join('|');
      if (challenge.kind === 'composite') return typeof answer === 'object' && answer !== null;
      return false;
    })();
    if (correct) {
      const stopData = gamePack.stops.find((item) => item.id === stopId)!;
      stop.state = 'completed';
      stop.completedAt = stop.completedAt ?? new Date().toISOString();
      stop.scoreAwarded = stop.scoreAwarded || Math.max(gamePack.scoring.minimumPerStop, calculateLocalStopScore(stopData, stop));
      if (!next.collectedRewards.includes(stopData.reward.symbol)) next.collectedRewards.push(stopData.reward.symbol);
      next.totalScore = next.totalScore + stop.scoreAwarded;
      const index = gamePack.stops.findIndex((item) => item.id === stopId);
      const nextStop = gamePack.stops[index + 1];
      if (nextStop && next.stopProgress[nextStop.id].state === 'locked') next.stopProgress[nextStop.id].state = 'available';
      next.currentStopId = nextStop?.id ?? stopId;
      await saveProgress(next);
      setProgress(next);
      await pushEvent('stop_completed', { score: stop.scoreAwarded }, stopId);
      return { correct: true, message: 'Goed antwoord.' };
    }
    next.wrongAttempts += 1;
    await saveProgress(next);
    setProgress(next);
    await pushEvent('answer_attempted', { answer }, stopId);
    return { correct: false, message: 'Nog niet juist.' };
  }

  async function completeFinale() {
    if (!progress || !activeTeam) return;
    const next = cloneProgress(progress);
    if (next.finalized) return;
    next.finalized = true;
    next.finalResult = {
      title: gamePack.title,
      summary: `MOERASDRAAK\nTeam ${activeTeam.name}\n\nGebrouwen met water, moed, verbeelding en een sterk verhaal.`,
      score: next.totalScore,
      durationMinutes: Math.max(1, Math.round((Date.now() - Date.parse(activeTeam.createdAt)) / 60000)),
      hintsUsed: next.totalHintsUsed,
      wrongAttempts: next.wrongAttempts,
      symbols: next.collectedRewards,
      createdAt: new Date().toISOString()
    };
    await saveProgress(next);
    setProgress(next);
    await pushEvent('game_completed', { score: next.totalScore }, gamePack.finalStopId);
  }

  const value = useMemo<GameContextValue>(() => ({
    loading,
    teams,
    activeTeam,
    progress,
    queue,
    settings,
    syncStatus,
    syncMessage,
    createTeam,
    activateTeam,
    resumeWithJoinCode,
    removeActiveTeam,
    updateSettings,
    enqueue: pushEvent,
    syncNow,
    unlockStop,
    startStop,
    useHint,
    attemptAnswer,
    completeFinale
  }), [loading, teams, activeTeam, progress, queue, settings, syncStatus, syncMessage]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

function calculateLocalStopScore(stop: { challenge: ChallengeConfig }, progress: { attempts: number; hintsUsed: number }) {
  return Math.max(100, 1000 - progress.hintsUsed * 100 - progress.attempts * 25);
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('GameProvider ontbreekt.');
  return value;
}
