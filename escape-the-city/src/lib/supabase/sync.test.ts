import { describe, expect, it } from 'vitest';
import { createInitialProgress, createTeamRecord, type SyncQueueItem } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import { buildSyncRpcPayload, mergeRemoteProgress } from './sync';

const team = createTeamRecord({
  id: '10000000-0000-4000-8000-000000000001',
  game: gamePack,
  name: 'Drakenteam',
  members: ['Ada', 'Bo'],
  privacyAccepted: true
});

describe('Supabase city-game sync', () => {
  it('maps the complete team, progress and event into one atomic RPC payload', () => {
    const progress = createInitialProgress(team.id, gamePack);
    progress.stopProgress.drakenfontein.state = 'completed';
    progress.totalScore = 900;
    const item: SyncQueueItem = {
      id: '20000000-0000-4000-8000-000000000002',
      teamId: team.id,
      eventType: 'stop_completed',
      stopId: 'drakenfontein',
      payload: { score: 900 },
      occurredAt: '2026-07-28T12:00:00.000Z',
      attempts: 0,
      status: 'pending'
    };

    expect(buildSyncRpcPayload(item, team, progress)).toMatchObject({
      p_team: {
        id: team.id,
        joinCode: team.joinCode,
        memberNames: ['Ada', 'Bo']
      },
      p_progress: {
        totalScore: 900,
        stopProgress: {
          drakenfontein: { state: 'completed' }
        }
      },
      p_event: {
        id: item.id,
        eventType: 'stop_completed',
        stopId: 'drakenfontein'
      }
    });
  });

  it('merges camelCase cloud progress without losing initial stops', () => {
    const progress = mergeRemoteProgress(team, {
      currentStopId: 'binnendieze',
      totalScore: 875,
      stopProgress: {
        drakenfontein: {
          state: 'completed',
          attempts: 1,
          hintsUsed: 0,
          scoreAwarded: 875,
          answerData: {}
        }
      }
    });

    expect(progress.currentStopId).toBe('binnendieze');
    expect(progress.totalScore).toBe(875);
    expect(progress.stopProgress.drakenfontein.state).toBe('completed');
    expect(progress.stopProgress['zoete-lieve-gerritje'].state).toBe('locked');
  });
});
