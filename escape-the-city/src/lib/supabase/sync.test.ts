import { describe, expect, it } from 'vitest';
import { createTeamRecord } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import { mergeRemoteProgress } from './sync';

const team = createTeamRecord({
  id: '10000000-0000-4000-8000-000000000001',
  game: gamePack,
  name: 'Drakenteam',
  members: ['Ada', 'Bo'],
  privacyAccepted: true
});

describe('Supabase city-game sync', () => {
  it('merges camelCase cloud progress without losing initial stops', () => {
    const progress = mergeRemoteProgress(team, {
      currentStopId: 'binnendieze',
      version: 8,
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
    expect(progress.version).toBe(8);
    expect(progress.stopProgress.drakenfontein.state).toBe('completed');
    expect(progress.stopProgress['zoete-lieve-gerritje'].state).toBe('locked');
  });
});
