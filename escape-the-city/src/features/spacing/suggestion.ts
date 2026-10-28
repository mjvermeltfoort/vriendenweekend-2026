import type { GamePack } from '../game/gameTypes';
import { visibleBonusLocations, type GameProgress } from '../game/gameState';
import { haversineDistanceMeters } from '../location/distance';

/** An already visible, unfinished detour on this leg; never reveal a locked schub. */
export function spacingSchub(pack: GamePack, progress: GameProgress, fix: { latitude: number; longitude: number } | null) {
  if (!fix) return null;
  return visibleBonusLocations(pack, progress)
    .filter(b => b.recommendedBetween.beforeStopId === progress.currentStopId
      && progress.stopProgress[b.id]?.state !== 'completed'
      && b.coordinates.latitude !== null && b.coordinates.longitude !== null)
    .map(b => ({ b, distance: haversineDistanceMeters(fix, { latitude: b.coordinates.latitude!, longitude: b.coordinates.longitude! }) }))
    .filter(item => item.distance <= 350)
    .sort((a, b) => a.distance - b.distance)[0]?.b ?? null;
}
