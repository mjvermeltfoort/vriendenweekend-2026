import { describe, expect, it } from 'vitest';
import { calculateStopScore, normalizeAnswer } from './scoring';
import { gamePack } from '../../game-data/moerasdraak/game';

describe('scoring', () => {
  it('normalizes answers', () => {
    expect(normalizeAnswer(' Één ')).toBe('een');
  });

  it('applies penalties with minimum floor', () => {
    expect(calculateStopScore(gamePack, 2, 3)).toBeGreaterThanOrEqual(gamePack.scoring.minimumPerStop);
  });
});
