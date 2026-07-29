import { describe, expect, it } from 'vitest';
import { observationFallbackAvailable } from './observationFallback';

describe('observation fallback timing', () => {
  it('opens immediately for denied/unavailable GPS without usable team location', () => {
    expect(observationFallbackAvailable({
      now: 1,
      waitingSince: 0,
      errorKind: 'permission-denied',
      location: null
    })).toBe(true);
    expect(observationFallbackAvailable({
      now: 1,
      waitingSince: 0,
      errorKind: 'unavailable',
      location: { isCurrent: true, accuracyM: 12 }
    })).toBe(false);
  });

  it('waits 25 seconds when no accurate team measurement arrives', () => {
    expect(observationFallbackAvailable({
      now: 24_999,
      waitingSince: 0,
      location: { isCurrent: true, accuracyM: 41 }
    })).toBe(false);
    expect(observationFallbackAvailable({
      now: 25_000,
      waitingSince: 0,
      location: { isCurrent: false, accuracyM: 12 }
    })).toBe(true);
  });
});
