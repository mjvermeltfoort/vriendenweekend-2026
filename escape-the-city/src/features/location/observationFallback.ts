import type { LocationErrorKind } from './provider';

export const OBSERVATION_FALLBACK_DELAY_MS = 25_000;
export const OBSERVATION_FALLBACK_OUTSIDE_RADIUS_DELAY_MS = 60_000;

export function observationFallbackDelayMs(input: {
  errorKind?: LocationErrorKind;
  location?: { isCurrent?: boolean; accuracyM: number } | null;
  outsideStopRadius?: boolean;
}) {
  const usableLocation = input.location?.isCurrent && input.location.accuracyM <= 40;
  if (usableLocation && !input.outsideStopRadius) return null;
  if ((input.errorKind === 'permission-denied' || input.errorKind === 'unavailable') && !usableLocation) {
    return 0;
  }
  if (usableLocation && input.outsideStopRadius) {
    return OBSERVATION_FALLBACK_OUTSIDE_RADIUS_DELAY_MS;
  }
  return OBSERVATION_FALLBACK_DELAY_MS;
}

export function observationFallbackAvailable(input: {
  now: number;
  waitingSince: number;
  errorKind?: LocationErrorKind;
  location?: { isCurrent?: boolean; accuracyM: number } | null;
  outsideStopRadius?: boolean;
}) {
  const delayMs = observationFallbackDelayMs(input);
  if (delayMs === null) return false;
  return input.now - input.waitingSince >= delayMs;
}
