import type { GamePack } from '../game/gameTypes';
import { haversineDistanceMeters } from './distance';
import { validateRouteGeoJson, type LngLat, type RouteGeoJson, type RouteLegFeature } from '../map/mapTypes';

export const DISTANCE_STATUS = {
  FAR: 500,
  NEAR: 150,
  VERY_NEAR: 60,
  ARRIVAL_RADIUS: 35,
  MAX_ARRIVAL_ACCURACY: 40
} as const;

let routePromise: Promise<RouteGeoJson> | null = null;

export function loadRouteGeoJson(gamePack: GamePack) {
  if (!routePromise) {
    routePromise = fetch(`${import.meta.env.BASE_URL}routes/moerasdraak-den-bosch.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error('Het lokale routebestand kon niet worden geladen.');
        return response.json();
      })
      .then((data) => validateRouteGeoJson(data, gamePack))
      .catch((error) => {
        routePromise = null;
        throw error;
      });
  }
  return routePromise;
}

function localPoint(coordinate: LngLat, latitude: number) {
  const radians = Math.PI / 180;
  return {
    x: coordinate[0] * radians * 6371000 * Math.cos(latitude * radians),
    y: coordinate[1] * radians * 6371000
  };
}

export function routeLegLength(leg: RouteLegFeature) {
  return leg.geometry.coordinates.slice(1).reduce((total, coordinate, index) => (
    total + haversineDistanceMeters(
      { longitude: leg.geometry.coordinates[index][0], latitude: leg.geometry.coordinates[index][1] },
      { longitude: coordinate[0], latitude: coordinate[1] }
    )
  ), 0);
}

export function remainingRouteDistance(
  leg: RouteLegFeature,
  location: { latitude: number; longitude: number }
) {
  const coordinates = leg.geometry.coordinates;
  const projectedLocation = localPoint([location.longitude, location.latitude], location.latitude);
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestSegment = 0;
  let bestFraction = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = localPoint(coordinates[index], location.latitude);
    const end = localPoint(coordinates[index + 1], location.latitude);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, (
        (projectedLocation.x - start.x) * dx + (projectedLocation.y - start.y) * dy
      ) / denominator));
    const projectedX = start.x + fraction * dx;
    const projectedY = start.y + fraction * dy;
    const distanceSquared = (projectedLocation.x - projectedX) ** 2
      + (projectedLocation.y - projectedY) ** 2;
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestSegment = index;
      bestFraction = fraction;
    }
  }

  const offRouteDistanceM = Math.sqrt(bestDistanceSquared);
  const segmentLength = haversineDistanceMeters(
    { longitude: coordinates[bestSegment][0], latitude: coordinates[bestSegment][1] },
    { longitude: coordinates[bestSegment + 1][0], latitude: coordinates[bestSegment + 1][1] }
  );
  return offRouteDistanceM + segmentLength * (1 - bestFraction)
    + coordinates.slice(bestSegment + 2).reduce((total, coordinate, index) => (
      total + haversineDistanceMeters(
        {
          longitude: coordinates[bestSegment + 1 + index][0],
          latitude: coordinates[bestSegment + 1 + index][1]
        },
        { longitude: coordinate[0], latitude: coordinate[1] }
      )
    ), 0);
}

export function activeRouteLeg(route: RouteGeoJson, currentStopId: string) {
  return route.features.find((feature) => feature.properties.toStopId === currentStopId) ?? null;
}

export function roundedWalkingDistance(distanceM: number) {
  const interval = distanceM > 100 ? 10 : 5;
  return Math.max(0, Math.round(distanceM / interval) * interval);
}

export function formattedWalkingDistance(distanceM: number) {
  if (distanceM >= 1000) {
    const km = Math.round(distanceM / 500) * 0.5;
    return `${km.toLocaleString('nl-NL', { minimumFractionDigits: km % 1 === 0 ? 0 : 1 })} km`;
  }
  return `${roundedWalkingDistance(distanceM)} m`;
}

export type WalkingStatus = 'Op weg' | 'Je komt dichterbij' | 'In de buurt' | 'Bijna daar';

export function walkingStatus(distanceM: number): WalkingStatus {
  if (distanceM > DISTANCE_STATUS.FAR) return 'Op weg';
  if (distanceM > DISTANCE_STATUS.NEAR) return 'Je komt dichterbij';
  if (distanceM > DISTANCE_STATUS.VERY_NEAR) return 'In de buurt';
  return 'Bijna daar';
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export interface DistanceFilterState {
  samples: number[];
  displayed: number | null;
  increaseCount: number;
}

export function filterWalkingDistance(
  state: DistanceFilterState,
  measurement: number
): DistanceFilterState {
  const samples = [...state.samples, measurement].slice(-3);
  const candidate = median(samples);
  if (state.displayed === null) {
    return { samples, displayed: candidate, increaseCount: 0 };
  }
  if (measurement < state.displayed) {
    return { samples, displayed: measurement, increaseCount: 0 };
  }
  if (measurement < state.displayed + 15) {
    return { ...state, samples, increaseCount: 0 };
  }
  const increaseCount = state.increaseCount + 1;
  return increaseCount >= 2
    ? { samples, displayed: Math.max(state.displayed, candidate), increaseCount: 0 }
    : { ...state, samples, increaseCount };
}
