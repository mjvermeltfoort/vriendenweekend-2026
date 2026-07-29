import { haversineDistanceMeters } from './distance';
import type { LocationResult } from './provider';

export const LOCATION_MIN_SEND_INTERVAL_MS = 5_000;
export const LOCATION_MAX_SEND_INTERVAL_MS = 10_000;
export const LOCATION_MOVEMENT_THRESHOLD_M = 8;
export const LOCATION_ACCURACY_IMPROVEMENT_M = 10;

export interface LastSentLocation {
  location: LocationResult;
  sentAt: number;
}

export function shouldSendLocation(
  previous: LastSentLocation | null,
  next: LocationResult,
  now = Date.now()
) {
  if (!previous) return true;
  const elapsed = now - previous.sentAt;
  if (elapsed < LOCATION_MIN_SEND_INTERVAL_MS) return false;
  if (elapsed >= LOCATION_MAX_SEND_INTERVAL_MS) return true;
  const moved = haversineDistanceMeters(previous.location, next);
  const accuracyImprovement = previous.location.accuracy - next.accuracy;
  return moved >= LOCATION_MOVEMENT_THRESHOLD_M
    || accuracyImprovement >= LOCATION_ACCURACY_IMPROVEMENT_M;
}
