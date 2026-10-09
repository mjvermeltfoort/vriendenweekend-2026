import { beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { GameProvider, useGame, pickDeletableLocalTeamId } from './gameContext';
import { gamePack } from '../game-data/moerasdraak/game';
import { createInitialProgress, type TeamRecord } from '../features/game/gameState';
import {
  saveTeam,
  saveProgress,
  saveTeamSession,
  loadTeams,
  loadTeamSession,
  loadProgress,
  loadLastTeamId
} from '../features/offline/storage';

function TestProbe({ onRemove }: { onRemove?: (remove: () => Promise<void>) => void }) {
  const value = useGame();
  // Capture the initial callback before asynchronous team hydration.
  if (onRemove) onRemove(value.removeActiveTeam);
  return (
    <pre data-active={value.activeTeam?.id ?? ''} data-has-delete={String(value.hasLocalTeamToDelete)} />
  );
}

async function resetDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('moerasdraak-storage');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('pickDeletableLocalTeamId', () => {
  it('prefers active, then session, then last-team, then only local team', () => {
    const teams: TeamRecord[] = [
      { id: 'a', gameSlug: gamePack.slug, gameVersion: gamePack.version, name: 'A', joinCode: 'A', memberNames: [], createdAt: '', updatedAt: '', lastActivityAt: '', privacyAccepted: true },
      { id: 'b', gameSlug: gamePack.slug, gameVersion: gamePack.version, name: 'B', joinCode: 'B', memberNames: [], createdAt: '', updatedAt: '', lastActivityAt: '', privacyAccepted: true }
    ];
    expect(pickDeletableLocalTeamId({ teams, activeTeamId: 'a', sessionTeamId: 'b', lastTeamId: 'b' })).toBe('a');
    expect(pickDeletableLocalTeamId({ teams, activeTeamId: null, sessionTeamId: 'b', lastTeamId: 'a' })).toBe('b');
    expect(pickDeletableLocalTeamId({ teams, activeTeamId: null, sessionTeamId: null, lastTeamId: 'b' })).toBe('b');
    expect(pickDeletableLocalTeamId({ teams: [teams[0]], activeTeamId: null, sessionTeamId: null, lastTeamId: null })).toBe('a');
    expect(pickDeletableLocalTeamId({ teams, activeTeamId: null, sessionTeamId: null, lastTeamId: null })).toBeNull();
  });
});

describe('removeActiveTeam fallbacks', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetDb();
  });

  it('deletes team when activeTeam is null but last-team exists', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const teamId = 'x-team';
    const team: TeamRecord = { id: teamId, gameSlug: gamePack.slug, gameVersion: gamePack.version, name: 'X', joinCode: 'X', memberNames: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), privacyAccepted: true };
    await saveTeam(team);
    await saveProgress(createInitialProgress(teamId, gamePack));
    await saveTeamSession({ id: 'sess-x', teamId, deviceId: 'dev-1', joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });

    // simulate last-team pointer without mounting state as active
    localStorage.setItem('moerasdraak-last-team', teamId);

    let remove: (() => Promise<void>) | undefined;
    await act(async () => {
      root.render(<GameProvider><TestProbe onRemove={(fn) => { remove ??= fn; }} /></GameProvider>);
    });

    const probe = container.querySelector('pre')!;
    expect(probe.getAttribute('data-has-delete')).toBe('true');

    // Wait for the full asynchronous removal before checking IndexedDB.
    expect(remove).toBeDefined();
    await act(async () => { await remove!(); });

    // verify local deletion
    expect((await loadTeams()).length).toBe(0);
    expect(await loadProgress(teamId)).toBeUndefined();
    expect(await loadTeamSession(teamId)).toBeUndefined();
    expect(loadLastTeamId()).toBeNull();

    await act(async () => { root.unmount(); });
  });

  it('hasLocalTeamToDelete is false when no teams exist', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => { root.render(<GameProvider><TestProbe /></GameProvider>); });

    const probe = container.querySelector('pre')!;
    expect(probe.getAttribute('data-has-delete')).toBe('false');

    await act(async () => { root.unmount(); });
  });
});
