import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialProgress, readableJoinCode } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import { loadStoredSettings, saveStoredSettings, shouldAcceptTeamSnapshot, updateStoredSettings, type TeamSnapshot } from './storage';

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

  it('never accepts an older server progress snapshot', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const current: TeamSnapshot = {
      teamId: 'team-1',
      sessionId: 'session-1',
      deviceId: 'device-1',
      progress,
      progressVersion: 4,
      activeGameVersion: 2,
      lastSyncedAt: '2026-07-29T10:00:00Z'
    };
    expect(shouldAcceptTeamSnapshot(current, {
      ...current,
      progressVersion: 3,
      activeGameVersion: 99
    })).toBe(false);
  });

  it('uses the active game version when progress versions are equal', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const current: TeamSnapshot = {
      teamId: 'team-1',
      sessionId: 'session-1',
      deviceId: 'device-1',
      progress,
      progressVersion: 4,
      activeGameVersion: 5,
      lastSyncedAt: '2026-07-29T10:00:00Z'
    };
    expect(shouldAcceptTeamSnapshot(current, { ...current, activeGameVersion: 4 })).toBe(false);
    expect(shouldAcceptTeamSnapshot(current, { ...current, activeGameVersion: 6 })).toBe(true);
  });

  it('rejects an older selected location when shared versions are equal', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const current: TeamSnapshot = {
      teamId: 'team-1',
      sessionId: 'session-1',
      deviceId: 'device-1',
      progress,
      progressVersion: 4,
      activeGameVersion: 5,
      currentLocation: { selectedAt: '2026-07-29T10:00:10Z' },
      lastSyncedAt: '2026-07-29T10:00:11Z'
    };
    expect(shouldAcceptTeamSnapshot(current, {
      ...current,
      currentLocation: { selectedAt: '2026-07-29T10:00:05Z' },
      lastSyncedAt: '2026-07-29T10:00:12Z'
    })).toBe(false);
  });

  it('rejects an older active-session snapshot when other versions are equal', () => {
    const progress = createInitialProgress('team-1', gamePack);
    const current: TeamSnapshot = {
      teamId: 'team-1',
      sessionId: 'session-1',
      deviceId: 'device-1',
      progress,
      progressVersion: 4,
      activeGameVersion: 5,
      activeSessionCount: 2,
      sessionStateAt: '2026-07-29T10:00:10Z',
      lastSyncedAt: '2026-07-29T10:00:11Z'
    };
    expect(shouldAcceptTeamSnapshot(current, {
      ...current,
      activeSessionCount: 1,
      sessionStateAt: '2026-07-29T10:00:05Z',
      lastSyncedAt: '2026-07-29T10:00:12Z'
    })).toBe(false);
  });
});
