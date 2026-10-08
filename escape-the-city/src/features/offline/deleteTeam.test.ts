import { beforeEach, describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { createInitialProgress } from '../game/gameState';
import {
  saveTeam,
  saveProgress,
  saveTeamSession,
  saveQueueItem,
  saveTeamSnapshotIfNewer,
  loadTeams,
  loadTeam,
  loadProgress,
  loadTeamSession,
  loadQueueItems,
  loadTeamSnapshot,
  deleteTeam,
  loadLastTeamId
} from './storage';

const DB_NAME = 'moerasdraak-storage';

async function resetDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('deleteTeam', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetDb();
  });

  it('removes all local data for the team and iterates the full queue', async () => {
    const teamA = { id: 'team-a', gameSlug: gamePack.slug, gameVersion: gamePack.version, name: 'Alpha', joinCode: 'AAA111', memberNames: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), privacyAccepted: true };
    const teamB = { id: 'team-b', gameSlug: gamePack.slug, gameVersion: gamePack.version, name: 'Bravo', joinCode: 'BBB222', memberNames: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), privacyAccepted: true };

    // seed teams and per-team data
    await saveTeam(teamA);
    await saveTeam(teamB);
    await saveProgress(createInitialProgress(teamA.id, gamePack));
    await saveTeamSession({ id: 'sess-a-1', teamId: teamA.id, deviceId: 'dev-1', joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
    await saveTeamSnapshotIfNewer({
      teamId: teamA.id,
      sessionId: 'sess-a-1',
      deviceId: 'dev-1',
      progress: createInitialProgress(teamA.id, gamePack),
      progressVersion: 1,
      activeGameVersion: null,
      lastSyncedAt: new Date().toISOString()
    });

    // queue: insert interleaved items for both teams to test cursor iteration
    await saveQueueItem({ id: 'q-1', teamId: teamB.id, eventType: 'x', payload: {}, occurredAt: '2026-01-01T00:00:00Z', attempts: 0, status: 'pending' });
    await saveQueueItem({ id: 'q-2', teamId: teamA.id, eventType: 'y', payload: {}, occurredAt: '2026-01-01T00:00:01Z', attempts: 0, status: 'pending' });
    await saveQueueItem({ id: 'q-3', teamId: teamB.id, eventType: 'z', payload: {}, occurredAt: '2026-01-01T00:00:02Z', attempts: 0, status: 'pending' });
    await saveQueueItem({ id: 'q-4', teamId: teamA.id, eventType: 'w', payload: {}, occurredAt: '2026-01-01T00:00:03Z', attempts: 0, status: 'pending' });

    // per-team UI flags and last-team pointer
    localStorage.setItem('moerasdraak-last-team', teamA.id);
    localStorage.setItem(`moerasdraak-team-radio-seen:${teamA.id}`, '2026-01-01T00:00:00Z');
    localStorage.setItem(`moerasdraak-bonus-intro:${teamA.id}`, 'seen');

    await deleteTeam(teamA.id);

    // team A data gone
    expect(await loadTeam(teamA.id)).toBeUndefined();
    expect(await loadProgress(teamA.id)).toBeUndefined();
    expect(await loadTeamSession(teamA.id)).toBeUndefined();
    expect(await loadTeamSnapshot(teamA.id)).toBeUndefined();

    // team B intact
    const teams = await loadTeams();
    expect(teams.map((t) => t.id)).toContain(teamB.id);

    // queue pruned for A only
    const aQueue = await loadQueueItems(teamA.id);
    const bQueue = await loadQueueItems(teamB.id);
    expect(aQueue).toHaveLength(0);
    expect(bQueue.map((i) => i.id).sort()).toEqual(['q-1', 'q-3']);

    // local UI flags cleared for A
    expect(localStorage.getItem(`moerasdraak-team-radio-seen:${teamA.id}`)).toBeNull();
    expect(localStorage.getItem(`moerasdraak-bonus-intro:${teamA.id}`)).toBeNull();

    // last-team pointer cleared if it pointed to deleted team
    expect(loadLastTeamId()).toBeNull();
  });
});
