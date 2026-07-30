import type { LocationErrorKind } from './provider';

export const OBSERVATION_FALLBACK_DELAY_MS = 25_000;
export const OBSERVATION_FALLBACK_OUTSIDE_RADIUS_DELAY_MS = 60_000;

export function observationFallbackAvailable(input: {
  now: number;
  waitingSince: number;
  errorKind?: LocationErrorKind;
  location?: { isCurrent?: boolean; accuracyM: number } | null;
  outsideStopRadius?: boolean;
}) {
  const usableLocation = input.location?.isCurrent && input.location.accuracyM <= 40;
  if (usableLocation && !input.outsideStopRadius) return false;
  if ((input.errorKind === 'permission-denied' || input.errorKind === 'unavailable') && !usableLocation) {
    return true;
  }
  if (usableLocation && input.outsideStopRadius) {
    return input.now - input.waitingSince >= OBSERVATION_FALLBACK_OUTSIDE_RADIUS_DELAY_MS;
  }
  return input.now - input.waitingSince >= OBSERVATION_FALLBACK_DELAY_MS;
}
