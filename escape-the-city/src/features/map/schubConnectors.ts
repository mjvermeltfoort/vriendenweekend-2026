import connectors from '../../game-data/moerasdraak/schub-connectors.json';
import type { BonusLocation } from '../game/gameTypes';
import { haversineDistanceMeters } from '../location/distance';
import type { LocationResult } from '../location/provider';
import type { LngLat } from './mapTypes';

export interface SchubConnector {
  type: 'Feature';
  properties: { bonusId: string; legIndex: number; joinIndex: number };
  geometry: { type: 'LineString'; coordinates: LngLat[] };
}

// Bundled with the application, so the lines are available without a routing
// service, an internet connection or an additional download during the walk.
export const schubConnectors = connectors.features as unknown as SchubConnector[];

export function schubConnectorFor(bonusId: string | null, legIndex: number | null): SchubConnector | null {
  if (bonusId === null || legIndex === null) return null;
  return schubConnectors.find((feature) => feature.properties.bonusId === bonusId
    && feature.properties.legIndex === legIndex) ?? null;
}

// Completed schubben still need a way back to the active main route.
export function nearbyConnectorBonus(location: LocationResult, bonuses: BonusLocation[]): string | null {
  if (!Number.isFinite(location.accuracy) || location.accuracy < 0 || location.accuracy > 40) return null;
  const candidates = bonuses.map((bonus) => ({
    bonus,
    distance: haversineDistanceMeters(location, {
      latitude: bonus.coordinates.latitude!, longitude: bonus.coordinates.longitude!
    })
  })).filter(({ bonus, distance }) => distance <= bonus.coordinates.radiusMeters + 20)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.bonus.id ?? null;
}
