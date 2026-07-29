import { beforeEach, describe, expect, it } from 'vitest';
import { readableJoinCode } from '../game/gameState';
import { loadStoredSettings, saveStoredSettings, updateStoredSettings } from './storage';

describe('storage helpers', () => {
  beforeEach(() => localStorage.clear());

  it('provides short join code', () => {
    expect(readableJoinCode(6)).toHaveLength(6);
  });

  it('adds audio defaults to legacy settings', () => {
    localStorage.setItem('moerasdraak-settings', JSON.stringify({ soundEnabled: false }));

    expect(loadStoredSettings()).toMatchObject({
      soundEnabled: false,
      backgroundMusicEnabled: true,
      highContrastEnabled: false
    });
  });

  it('loads a stored high contrast preference', () => {
    localStorage.setItem('moerasdraak-settings', JSON.stringify({
      soundEnabled: true,
      backgroundMusicEnabled: true,
      highContrastEnabled: true
    }));

    expect(loadStoredSettings().highContrastEnabled).toBe(true);
  });

  it('saves a high contrast preference', () => {
    saveStoredSettings({
      soundEnabled: true,
      backgroundMusicEnabled: true,
      highContrastEnabled: true
    });

    expect(loadStoredSettings().highContrastEnabled).toBe(true);
  });

  it('updates and persists a high contrast preference', () => {
    const current = loadStoredSettings();
    const updated = updateStoredSettings(current, { highContrastEnabled: true });

    expect(updated.highContrastEnabled).toBe(true);
    expect(loadStoredSettings().highContrastEnabled).toBe(true);
  });
});
