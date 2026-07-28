import type { GamePack } from './gameTypes';

export function validateGamePack(pack: GamePack) {
  const stopIds = new Set<string>();
  const orders = new Set<number>();
  const symbols = new Set<string>();
  for (const stop of pack.stops) {
    if (stopIds.has(stop.id)) return { valid: false, message: `Dubbele stop-id: ${stop.id}` };
    stopIds.add(stop.id);
    if (orders.has(stop.order)) return { valid: false, message: `Dubbele volgorde: ${stop.order}` };
    orders.add(stop.order);
    if (!stop.navigation.fallbackDirections && !stop.navigation.externalMapsQuery) return { valid: false, message: `Ontbrekende fallback voor ${stop.id}` };
    if ((stop.coordinates.latitude === null || stop.coordinates.longitude === null) && !stop.coordinates.needsOnSiteVerification) return { valid: false, message: `GPS moet als te verifiëren zijn gemarkeerd voor ${stop.id}` };
    if (stop.coordinates.radiusMeters <= 0 || stop.coordinates.maximumAccuracyMeters <= 0) return { valid: false, message: `Ongeldige GPS-configuratie voor ${stop.id}` };
    if (symbols.has(stop.reward.symbol)) return { valid: false, message: `Dubbel beloningssymbool: ${stop.reward.symbol}` };
    symbols.add(stop.reward.symbol);
  }
  if (pack.stops[0]?.id !== pack.startStopId) return { valid: false, message: 'Startstop klopt niet.' };
  if (pack.stops[pack.stops.length - 1]?.id !== pack.finalStopId) return { valid: false, message: 'Finalestop klopt niet.' };
  if (!pack.stops[pack.stops.length - 1]?.isFinal) return { valid: false, message: 'Finale moet als laatste staan.' };
  return { valid: true as const, message: 'OK' };
}
