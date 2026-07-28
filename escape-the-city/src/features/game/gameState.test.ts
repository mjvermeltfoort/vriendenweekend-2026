import { describe, expect, it } from 'vitest';
import { canStartFinale, createInitialProgress, isFinaleLocationRevealed, normalizeJoinCode, readableJoinCode } from './gameState';
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
});
