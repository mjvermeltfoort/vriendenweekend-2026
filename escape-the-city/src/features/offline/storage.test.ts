import { beforeEach, describe, expect, it } from 'vitest';
import { readableJoinCode } from '../game/gameState';
import { loadStoredSettings } from './storage';

describe('storage helpers', () => {
  beforeEach(() => localStorage.clear());

  it('provides short join code', () => {
    expect(readableJoinCode(6)).toHaveLength(6);
  });

  it('adds audio defaults to legacy settings', () => {
    localStorage.setItem('moerasdraak-settings', JSON.stringify({ soundEnabled: false }));

    expect(loadStoredSettings()).toMatchObject({
      soundEnabled: false,
      backgroundMusicEnabled: true
    });
  });
});
