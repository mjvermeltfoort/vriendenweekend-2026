import { describe, expect, it } from 'vitest';
import { haversineDistanceMeters, isWithinGeofence } from './distance';

describe('distance', () => {
  it('calculates zero distance', () => {
    expect(haversineDistanceMeters({ latitude: 51, longitude: 5 }, { latitude: 51, longitude: 5 })).toBeCloseTo(0);
  });

  it('detects inside geofence', () => {
    expect(isWithinGeofence(10, 60)).toBe(true);
  });

  it('detects outside geofence', () => {
    expect(isWithinGeofence(120, 60)).toBe(false);
  });
});
