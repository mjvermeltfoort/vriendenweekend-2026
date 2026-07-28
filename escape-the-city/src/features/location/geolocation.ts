import { haversineDistanceMeters } from './distance';

export function checkGeofence(
  current: { latitude: number; longitude: number; accuracy: number },
  target: { latitude: number; longitude: number; radiusMeters: number; maximumAccuracyMeters: number }
) {
  const distanceMeters = haversineDistanceMeters(current, target);
  return {
    distanceMeters,
    accuracyOk: current.accuracy <= target.maximumAccuracyMeters,
    withinRadius: distanceMeters <= target.radiusMeters
  };
}
