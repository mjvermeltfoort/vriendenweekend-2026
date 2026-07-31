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
    if (stop.challenge.kind === 'code' && !stop.challenge.acceptedAnswers.length) {
      return { valid: false, message: `Ontbrekend codeantwoord voor ${stop.id}` };
    }
    if (stop.challenge.kind === 'composite') {
      const challenge = stop.challenge;
      const categories = Object.keys(challenge.categories);
      if (!categories.every((category) => challenge.categories[category].includes(challenge.correctAnswer[category]))) {
        return { valid: false, message: `Ongeldig samengesteld antwoord voor ${stop.id}` };
      }
    }
  }
  if (pack.stops[0]?.id !== pack.startStopId) return { valid: false, message: 'Startstop klopt niet.' };
  if (pack.stops[pack.stops.length - 1]?.id !== pack.finalStopId) return { valid: false, message: 'Finalestop klopt niet.' };
  if (!pack.stops[pack.stops.length - 1]?.isFinal) return { valid: false, message: 'Finale moet als laatste staan.' };
  const bonusIds = new Set<string>();
  const bonusRewards = new Set<string>();
  for (const bonus of pack.bonusLocations ?? []) {
    if (!bonus.id.startsWith('bonus:')) return { valid: false, message: `Bonus-id moet met bonus: beginnen: ${bonus.id}` };
    if (bonusIds.has(bonus.id) || stopIds.has(bonus.id)) return { valid: false, message: `Dubbele bonus-id: ${bonus.id}` };
    if (bonusRewards.has(bonus.reward.id)) return { valid: false, message: `Dubbele bonusbeloning: ${bonus.reward.id}` };
    bonusIds.add(bonus.id);
    bonusRewards.add(bonus.reward.id);
    const { latitude, longitude, radiusMeters, maximumAccuracyMeters, discoveryRadiusMeters } = bonus.coordinates;
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { valid: false, message: `Ongeldige bonuscoördinaten voor ${bonus.id}` };
    if (radiusMeters <= 0 || maximumAccuracyMeters <= 0 || discoveryRadiusMeters < radiusMeters) return { valid: false, message: `Ongeldige bonusgeofence voor ${bonus.id}` };
    if (!stopIds.has(bonus.recommendedBetween.afterStopId) || !stopIds.has(bonus.recommendedBetween.beforeStopId)) return { valid: false, message: `Ongeldige bonusrouteverwijzing voor ${bonus.id}` };
    if (bonus.maximumPoints <= 0 || !bonus.reward.id || !bonus.hints || !bonus.challenge) return { valid: false, message: `Onvolledige bonusconfiguratie voor ${bonus.id}` };
  }
  if (pack.bonusCompletionReward && pack.bonusCompletionReward.requiredCount !== bonusIds.size) return { valid: false, message: 'De Schubbenjagers-bonus past niet bij het aantal bonussen.' };
  return { valid: true as const, message: 'OK' };
}
