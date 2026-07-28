import { describe, expect, it } from 'vitest';
import { canAdvance } from './gameReducer';
import { gamePack } from '../../game-data/moerasdraak/game';

describe('gameReducer', () => {
  it('prevents progression regression', () => {
    expect(canAdvance({ currentStopId: gamePack.stops[0].id, completedStops: [], wrongAttempts: 0, hintsUsed: 0 }, gamePack)).toBe(true);
  });
});
