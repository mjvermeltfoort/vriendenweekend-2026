import { describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createTeamRecord } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import { getTeamState, updateTeamGameState } from './sync';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ supabase: { rpc }, ensureAnonymousSession: vi.fn().mockResolvedValue(null) }));
describe('shared answer cooldown synchronization', () => {
  it('restores the server deadline, penalty and clock offset for another device', async () => {
    const team = createTeamRecord({ id: 'a', game: gamePack, name: 'A', members: [], privacyAccepted: true });
    const progress = createInitialProgress('a', gamePack);
    const now = new Date().toISOString();
    progress.serverNow = now;
    progress.stopProgress.drakenfontein = { ...progress.stopProgress.drakenfontein, state: 'started', attempts: 1, scoreAwarded: -25, retryAvailableAt: new Date(Date.now() + 60_000).toISOString(), lastWrongAnswerPenalty: 25 };
    rpc.mockResolvedValue({ data: { ok: true, state: { team, progress, activeGame: null, currentLocation: null } }, error: null });
    const state = await getTeamState('session-b');
    expect(state.progress.stopProgress.drakenfontein.retryAvailableAt).toBe(progress.stopProgress.drakenfontein.retryAvailableAt);
    expect(state.progress.stopProgress.drakenfontein.lastWrongAnswerPenalty).toBe(25);
    expect(Math.abs(state.progress.serverTimeOffsetMs!)).toBeLessThan(1000);
    expect(state.progress.wrongAttempts).toBe(1);
  });
  it('turns server rejection into a readable cooldown error without pretending it was another mistake', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: { code: 'ANSWER_COOLDOWN' } }, error: null });
    await expect(updateTeamGameState({ sessionId: 'b', runId: 'r', expectedVersion: 0, action: 'submit_answer', payload: { answer: 'x' } })).rejects.toMatchObject({ code: 'ANSWER_COOLDOWN' });
  });
});
