import { describe, expect, it } from 'vitest';
import { calculateBonusScore, calculateStopScore, normalizeAnswer } from './scoring';
import { gamePack } from '../../game-data/moerasdraak/game';

describe('scoring', () => {
  it('normalizes answers', () => {
    expect(normalizeAnswer(' Één ')).toBe('een');
  });

  it('applies penalties with minimum floor', () => {
    expect(calculateStopScore(gamePack, 2, 3)).toBeGreaterThanOrEqual(gamePack.scoring.minimumPerStop);
  });
});

describe('calculateBonusScore', () => {
  it('applies attempt and hint limits without dropping below fifty points', () => {
    expect(calculateBonusScore({ maximumPoints: 200, attempts: 1, hintsUsed: 0 })).toBe(200);
    expect(calculateBonusScore({ maximumPoints: 200, attempts: 2, hintsUsed: 0 })).toBe(150);
    expect(calculateBonusScore({ maximumPoints: 200, attempts: 3, hintsUsed: 0 })).toBe(100);
    expect(calculateBonusScore({ maximumPoints: 100, attempts: 1, hintsUsed: 1 })).toBe(50);
  });
});
