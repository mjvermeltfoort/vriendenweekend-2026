import { describe, expect, it } from 'vitest';
import { answerRetrySeconds, formatAnswerWait } from './answerCooldown';

describe('answer retry countdown', () => {
  const now = Date.parse('2026-10-14T18:00:00Z');
  it('uses the server deadline, rounds up and expires exactly at the boundary', () => {
    const deadline = new Date(now + 60_000).toISOString();
    expect(answerRetrySeconds(deadline, 0, now)).toBe(60);
    expect(answerRetrySeconds(deadline, 0, now + 59_001)).toBe(1);
    expect(answerRetrySeconds(deadline, 0, now + 60_000)).toBe(0);
    expect(answerRetrySeconds(undefined, 0, now)).toBe(0);
    expect(answerRetrySeconds('invalid', 0, now)).toBe(0);
  });
  it('corrects a device clock that differs from the server', () => {
    expect(answerRetrySeconds(new Date(now + 60_000).toISOString(), 120_000, now - 120_000)).toBe(60);
    expect(formatAnswerWait(60)).toBe('01:00');
    expect(formatAnswerWait(9)).toBe('00:09');
  });
});
