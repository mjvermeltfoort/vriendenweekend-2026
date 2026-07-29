import { describe, expect, it } from 'vitest';
import { shouldSendLocation, type LastSentLocation } from './locationThrottle';

const base = { latitude: 51.690506, longitude: 5.296208, accuracy: 30 };

describe('GPS update throttling', () => {
  it('sends the initial reading and never more often than every five seconds', () => {
    expect(shouldSendLocation(null, base, 1_000)).toBe(true);
    const previous: LastSentLocation = { location: base, sentAt: 1_000 };
    expect(shouldSendLocation(previous, { ...base, latitude: 52, accuracy: 1 }, 5_999)).toBe(false);
  });

  it('sends after movement or a ten-meter accuracy improvement', () => {
    const previous: LastSentLocation = { location: base, sentAt: 1_000 };
    expect(shouldSendLocation(previous, { ...base, latitude: base.latitude + 0.00008 }, 6_000)).toBe(true);
    expect(shouldSendLocation(previous, { ...base, accuracy: 20 }, 6_000)).toBe(true);
  });

  it('sends at ten seconds even without a meaningful change', () => {
    const previous: LastSentLocation = { location: base, sentAt: 1_000 };
    expect(shouldSendLocation(previous, base, 10_999)).toBe(false);
    expect(shouldSendLocation(previous, base, 11_000)).toBe(true);
  });
});
