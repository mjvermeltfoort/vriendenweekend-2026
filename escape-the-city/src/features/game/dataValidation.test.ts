import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { validateGamePack } from './dataValidation';

describe('game data validation', () => {
  it('accepts current pack', () => {
    expect(validateGamePack(gamePack).valid).toBe(true);
  });
});
