import type { GamePack, RouteStop, ChallengeConfig } from './gameTypes';
import { calculateStopScore, normalizeAnswer } from './scoring';

export type StopStatus = 'locked' | 'available' | 'arrived' | 'started' | 'completed';

export interface StopProgress {
  state: StopStatus;
  attempts: number;
  hintsUsed: number;
  scoreAwarded: number;
  answerData: Record<string, unknown>;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  unlockMethod?: 'gps' | 'manual';
}

export interface TeamRecord {
  id: string;
  gameSlug: string;
  gameVersion: number;
  name: string;
  joinCode?: string;
  memberNames: string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  privacyAccepted: boolean;
}

export interface TeamSession {
  id: string;
  teamId: string;
  deviceId: string;
  joinedAt: string;
  lastSeenAt: string;
}

export interface TeamLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
  selectedAt: string;
  sourceSessionId: string;
  fresh: boolean;
}

export interface TeamGameRun {
  id: string;
  teamId: string;
  gameId: string;
  status: 'active' | 'completed' | 'abandoned';
  state: Record<string, unknown>;
  result?: Record<string, unknown>;
  version: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TeamStateSnapshot {
  team: TeamRecord;
  session: TeamSession;
  progress: GameProgress;
  activeGameRun: TeamGameRun | null;
  teamLocation: TeamLocation | null;
  activeSessionCount: number;
  lastSyncedAt: string;
}

export interface SyncQueueItem {
  id: string;
  teamId: string;
  eventType: string;
  stopId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

export interface ResultData {
  title: string;
  summary: string;
  score: number;
  durationMinutes: number;
  hintsUsed: number;
  wrongAttempts: number;
  symbols: string[];
  createdAt: string;
}

export interface GameProgress {
  teamId: string;
  gameSlug: string;
  gameVersion: number;
  currentStopId: string;
  stopProgress: Record<string, StopProgress>;
  collectedRewards: string[];
  wrongAttempts: number;
  totalHintsUsed: number;
  totalScore: number;
  finalized: boolean;
  version: number;
  updatedAt?: string;
  finalResult?: ResultData;
  lastSyncedAt?: string;
}

export function readableJoinCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function normalizeJoinCode(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

export function createTeamRecord(params: {
  id: string;
  game: GamePack;
  name: string;
  members: string[];
  privacyAccepted: boolean;
}) {
  const now = new Date().toISOString();
  return {
    id: params.id,
    gameSlug: params.game.slug,
    gameVersion: params.game.version,
    name: params.name.trim(),
    joinCode: readableJoinCode(),
    memberNames: params.members.map((name) => name.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    privacyAccepted: params.privacyAccepted
  } satisfies TeamRecord;
}

export function createInitialProgress(teamId: string, game: GamePack): GameProgress {
  const firstStop = game.stops[0];
  const stopProgress: Record<string, StopProgress> = {};
  for (const stop of game.stops) {
    stopProgress[stop.id] = {
      state: stop.id === firstStop.id ? 'available' : 'locked',
      attempts: 0,
      hintsUsed: 0,
      scoreAwarded: 0,
      answerData: {}
    };
  }
  return {
    teamId,
    gameSlug: game.slug,
    gameVersion: game.version,
    currentStopId: firstStop.id,
    stopProgress,
    collectedRewards: [],
    wrongAttempts: 0,
    totalHintsUsed: 0,
    totalScore: 0,
    finalized: false,
    version: 1
  };
}

export function stopById(game: GamePack, stopId: string) {
  return game.stops.find((stop) => stop.id === stopId) ?? null;
}

export function nextStop(game: GamePack, stopId: string) {
  const index = game.stops.findIndex((stop) => stop.id === stopId);
  return index >= 0 ? game.stops[index + 1] ?? null : null;
}

export function statusOrder(status: StopStatus) {
  return ['locked', 'available', 'arrived', 'started', 'completed'].indexOf(status);
}

export function hasLocationUnlock(progress: GameProgress, stopId: string) {
  const stop = progress.stopProgress?.[stopId];
  return !!stop
    && statusOrder(stop.state) >= statusOrder('arrived')
    && (stop.unlockMethod === 'gps' || stop.unlockMethod === 'manual');
}

export function canAccessChallenge(progress: GameProgress, stopId: string) {
  const stop = progress.stopProgress?.[stopId];
  return !!stop
    && statusOrder(stop.state) >= statusOrder('started')
    && (stop.state === 'completed' || hasLocationUnlock(progress, stopId));
}

export function canViewResult(progress: GameProgress, game: GamePack) {
  return progress.finalized
    && !!progress.finalResult
    && game.stops.every((stop) => progress.stopProgress?.[stop.id]?.state === 'completed')
    && progress.finalResult.symbols.length === game.stops.length;
}

export function canStartFinale(progress: GameProgress, game: GamePack) {
  const final = game.stops[game.stops.length - 1];
  const requiredStops = game.stops.slice(0, -1);
  const missing = requiredStops.filter((stop) => progress.stopProgress?.[stop.id]?.state !== 'completed');
  const currentFinal = progress.stopProgress?.[final.id];
  const eligible = missing.length === 0 && !!currentFinal && statusOrder(currentFinal.state) >= statusOrder('available') && !progress.finalized;
  return {
    eligible,
    missingCount: missing.length,
    missingTitles: missing.map((stop) => stop.shortTitle)
  };
}

export function isFinaleLocationRevealed(progress: GameProgress, game: GamePack) {
  return game.stops
    .slice(0, -1)
    .every((stop) => progress.stopProgress?.[stop.id]?.state === 'completed');
}

export function challengeAnswerIsCorrect(challenge: ChallengeConfig, answer: unknown) {
  if (challenge.kind === 'choice') {
    const value = String(answer ?? '');
    return challenge.options.some((option) => option.id === value && option.correct);
  }
  if (challenge.kind === 'code') {
    const normalized = normalizeAnswer(String(answer ?? ''));
    return challenge.acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === normalized);
  }
  if (challenge.kind === 'reorder') {
    return Array.isArray(answer) && answer.length === challenge.correctOrder.length && answer.every((item, index) => item === challenge.correctOrder[index]);
  }
  if (challenge.kind === 'composite') {
    if (typeof answer !== 'object' || answer === null) return false;
    const values = answer as Record<string, unknown>;
    return Object.entries(challenge.correctAnswer)
      .every(([category, expected]) => values[category] === expected);
  }
  return false;
}

export function computeStopCompletionScore(game: GamePack, stop: RouteStop, progress: StopProgress) {
  return calculateStopScore(game, progress.hintsUsed, progress.attempts);
}
