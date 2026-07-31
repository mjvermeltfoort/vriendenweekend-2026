import { describe, expect, it } from 'vitest';
import { gamePack } from './game';
import { validateGamePack } from '../../features/game/dataValidation';

describe('Verborgen Schubben game data', () => {
  it('contains six unique and on-site-verification-required bonuses', () => {
    expect(gamePack.bonusLocations).toHaveLength(6);
    expect(new Set(gamePack.bonusLocations?.map((bonus) => bonus.id)).size).toBe(6);
    expect(gamePack.bonusLocations?.every((bonus) => bonus.coordinates.needsOnSiteVerification)).toBe(true);
    expect(validateGamePack(gamePack)).toEqual({ valid: true, message: 'OK' });
  });
});
