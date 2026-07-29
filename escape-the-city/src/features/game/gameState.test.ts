import { describe, expect, it } from 'vitest';
import { canAccessChallenge, canStartFinale, canViewResult, challengeAnswerIsCorrect, createInitialProgress, hasLocationUnlock, isFinaleLocationRevealed, normalizeJoinCode, readableJoinCode } from './gameState';
import { gamePack } from '../../game-data/moerasdraak/game';

describe('gameState', () => {
  it('normalizes join codes', () => {
    expect(normalizeJoinCode(' ab-c 1 ')).toBe('ABC1');
  });

  it('generates readable join codes', () => {
    expect(readableJoinCode()).toHaveLength(6);
  });

  it('blocks finale before completion', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const eligibility = canStartFinale(progress, gamePack);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.missingCount).toBeGreaterThan(0);
    expect(isFinaleLocationRevealed(progress, gamePack)).toBe(false);
  });

  it('reveals the finale location after all preceding assignments', () => {
    const progress = createInitialProgress('team-1', gamePack);
    for (const stop of gamePack.stops.slice(0, -1)) {
      progress.stopProgress[stop.id].state = 'completed';
    }
    expect(isFinaleLocationRevealed(progress, gamePack)).toBe(true);
  });

  it('keeps the route usable with legacy local progress', () => {
    const legacyProgress = {
      ...createInitialProgress('team-1', gamePack),
      stopProgress: undefined
    };
    expect(isFinaleLocationRevealed(legacyProgress as unknown as ReturnType<typeof createInitialProgress>, gamePack)).toBe(false);
    expect(canStartFinale(legacyProgress as unknown as ReturnType<typeof createInitialProgress>, gamePack).eligible).toBe(false);
  });

  it('requires an explicit location unlock before a challenge', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const stop = progress.stopProgress[gamePack.startStopId];
    expect(hasLocationUnlock(progress, gamePack.startStopId)).toBe(false);
    expect(canAccessChallenge(progress, gamePack.startStopId)).toBe(false);

    stop.state = 'started';
    stop.unlockMethod = 'gps';
    expect(hasLocationUnlock(progress, gamePack.startStopId)).toBe(true);
    expect(canAccessChallenge(progress, gamePack.startStopId)).toBe(true);
    for (const method of ['observation', 'dashboard_override'] as const) {
      stop.unlockMethod = method;
      expect(hasLocationUnlock(progress, gamePack.startStopId)).toBe(true);
    }
  });

  it('accepts bell code 3142 and rejects the old five-digit pattern', () => {
    const bell = gamePack.stops.find((stop) => stop.id === 'sint-jan')!.challenge;
    expect(challengeAnswerIsCorrect(bell, '3142')).toBe(true);
    expect(challengeAnswerIsCorrect(bell, '3-1-4-2')).toBe(true);
    expect(challengeAnswerIsCorrect(bell, '32143')).toBe(false);
  });

  it('checks every category of a composite answer', () => {
    const composite = gamePack.stops.find((stop) => stop.id === 'bosch-wezen')!.challenge;
    expect(challengeAnswerIsCorrect(composite, {
      head: 'Horn',
      body: 'Schubben',
      object: 'Lantaarn'
    })).toBe(true);
    expect(challengeAnswerIsCorrect(composite, {
      head: 'Masker',
      body: 'Schubben',
      object: 'Lantaarn'
    })).toBe(false);
  });

  it('only exposes a complete, finalized result', () => {
    const progress = createInitialProgress('team-1', gamePack);
    expect(canViewResult(progress, gamePack)).toBe(false);
    for (const stop of gamePack.stops) progress.stopProgress[stop.id].state = 'completed';
    progress.collectedRewards = gamePack.stops.map((stop) => stop.reward.symbol);
    progress.finalized = true;
    progress.finalResult = {
      title: gamePack.title,
      summary: 'Klaar',
      score: 7000,
      durationMinutes: 120,
      hintsUsed: 0,
      wrongAttempts: 0,
      symbols: progress.collectedRewards,
      createdAt: new Date().toISOString()
    };
    expect(canViewResult(progress, gamePack)).toBe(true);
  });
});
