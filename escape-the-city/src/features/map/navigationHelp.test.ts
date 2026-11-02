import { describe, expect, it } from 'vitest';
import type { RouteLegFeature } from './mapTypes';
import { distanceFromLeg, emptyDeviation, isFreshLocation, updateDeviation } from './navigationHelp';

const leg: RouteLegFeature = {
  type: 'Feature',
  properties: { legIndex: 0, fromStopId: 'a', toStopId: 'b', corridor: 'street' },
  geometry: { type: 'LineString', coordinates: [[5.3, 51.69], [5.3, 51.692], [5.3, 51.694]] }
};
const start = Date.parse('2026-11-02T12:00:00Z');
const fix = (seconds: number, longitude = 5.303, accuracy = 10) => ({
  latitude: 51.691, longitude, accuracy, capturedAt: new Date(start + seconds * 1000).toISOString()
});

describe('navigation help', () => {
  it('measures distance to segments rather than just route vertices', () => {
    expect(distanceFromLeg(fix(0, 5.3), leg)).toBeLessThan(1);
    expect(distanceFromLeg(fix(0), leg)).toBeGreaterThan(200);
    expect(distanceFromLeg(fix(0), leg)).toBeLessThan(210);
  });

  it('requires 30 seconds of successive fresh fixes, not the passage of time alone', () => {
    let state = emptyDeviation();
    for (const seconds of [0, 10, 20]) {
      state = updateDeviation(state, fix(seconds), leg, start + seconds * 1000);
      expect(state.confirmed).toBe(false);
    }
    expect(updateDeviation(state, fix(30), leg, start + 30_000).confirmed).toBe(true);
    const singleFix = updateDeviation(emptyDeviation(), fix(0), leg, start);
    expect(updateDeviation(singleFix, fix(0), leg, start + 30_000).confirmed).toBe(false);
  });

  it('resets after returning to the route, GPS gaps, poor GPS or a bonus detour', () => {
    let state = emptyDeviation();
    for (const seconds of [0, 10, 20, 30]) state = updateDeviation(state, fix(seconds), leg, start + seconds * 1000);
    expect(state.confirmed).toBe(true);
    expect(updateDeviation(state, fix(35, 5.3), leg, start + 35_000)).toEqual(emptyDeviation());
    expect(updateDeviation(state, fix(60), leg, start + 60_000).confirmed).toBe(false);
    expect(updateDeviation(state, fix(35, 5.303, 80), leg, start + 35_000)).toEqual(emptyDeviation());
    expect(updateDeviation(state, fix(35), leg, start + 35_000, true)).toEqual(emptyDeviation());
    expect(updateDeviation(state, fix(35), null, start + 35_000)).toEqual(emptyDeviation());
  });

  it('accounts for GPS uncertainty at the route boundary', () => {
    const location = fix(0, 5.3013, 30);
    expect(distanceFromLeg(location, leg)).toBeGreaterThan(75);
    expect(updateDeviation(emptyDeviation(), location, leg, start)).toEqual(emptyDeviation());
  });

  it('rejects stale, future, missing timestamps and invalid coordinates', () => {
    expect(isFreshLocation(fix(0), start + 16_000)).toBe(false);
    expect(isFreshLocation(fix(10), start)).toBe(false);
    expect(isFreshLocation({ ...fix(0), capturedAt: undefined }, start)).toBe(false);
    expect(isFreshLocation({ ...fix(0), accuracy: NaN }, start)).toBe(false);
    expect(isFreshLocation({ ...fix(0), latitude: 200 }, start)).toBe(false);
  });
});
