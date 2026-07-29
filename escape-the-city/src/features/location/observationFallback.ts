import type { LocationErrorKind } from './provider';

export const OBSERVATION_FALLBACK_DELAY_MS = 25_000;

export function observationFallbackAvailable(input: {
  now: number;
  waitingSince: number;
  errorKind?: LocationErrorKind;
  location?: { isCurrent?: boolean; accuracyM: number } | null;
}) {
  const usableLocation = input.location?.isCurrent && input.location.accuracyM <= 40;
  if (usableLocation) return false;
  if (input.errorKind === 'permission-denied' || input.errorKind === 'unavailable') return true;
  return input.now - input.waitingSince >= OBSERVATION_FALLBACK_DELAY_MS;
}
