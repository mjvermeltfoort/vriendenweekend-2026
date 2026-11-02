import type { LocationResult } from '../location/provider';
import type { RouteLegFeature } from './mapTypes';

export const GPS_FRESH_MS = 15_000;
export const OFF_ROUTE_DELAY_MS = 30_000;

export function isFreshLocation(location: LocationResult | null, now: number): location is LocationResult {
  if (!location) return false;
  const age = now - Date.parse(location.capturedAt ?? '');
  return Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && Number.isFinite(location.accuracy) && location.accuracy >= 0
    && Number.isFinite(age) && age >= 0 && age <= GPS_FRESH_MS;
}

// Local metre projection is sufficient for the short walking legs in Den Bosch.
export function distanceFromLeg(location: LocationResult, leg: RouteLegFeature): number {
  const scale = Math.PI / 180 * 6_371_000;
  const longitudeScale = scale * Math.cos(location.latitude * Math.PI / 180);
  let closest = Infinity;
  const points = leg.geometry.coordinates;
  for (let index = 1; index < points.length; index += 1) {
    const x = (points[index - 1][0] - location.longitude) * longitudeScale;
    const y = (points[index - 1][1] - location.latitude) * scale;
    const dx = (points[index][0] - points[index - 1][0]) * longitudeScale;
    const dy = (points[index][1] - points[index - 1][1]) * scale;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared)) : 0;
    closest = Math.min(closest, Math.hypot(x + t * dx, y + t * dy));
  }
  return closest;
}

export interface DeviationState {
  since: number | null;
  lastFix: number | null;
  confirmed: boolean;
}

export function emptyDeviation(): DeviationState {
  return { since: null, lastFix: null, confirmed: false };
}

export function updateDeviation(
  previous: DeviationState,
  location: LocationResult | null,
  leg: RouteLegFeature | null,
  now: number,
  bonusDetour = false
): DeviationState {
  if (!leg || bonusDetour || !isFreshLocation(location, now) || location.accuracy > 40) return emptyDeviation();
  const distance = distanceFromLeg(location, leg);
  // Include the uncertainty circle: GPS drift alone must not trigger help.
  if (!Number.isFinite(distance) || distance - location.accuracy <= 75) return emptyDeviation();
  const fixTime = Date.parse(location.capturedAt!);
  // A suspended tab or long GPS gap starts a new observation period.
  const continuous = previous.lastFix !== null && fixTime >= previous.lastFix
    && fixTime - previous.lastFix <= GPS_FRESH_MS;
  const since = continuous && previous.since !== null ? previous.since : fixTime;
  return { since, lastFix: fixTime, confirmed: fixTime - since >= OFF_ROUTE_DELAY_MS };
}
