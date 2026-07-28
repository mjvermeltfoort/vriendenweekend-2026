import type { GameProgress, StopStatus } from '../game/gameState';
import type { GamePack, RouteStop } from '../game/gameTypes';
import type { LocationOutcome, LocationProvider, LocationResult } from '../location/provider';
import { haversineDistanceMeters } from '../location/distance';

export type LngLat = [longitude: number, latitude: number];

export interface RouteLegProperties {
  legIndex: number;
  fromStopId: string;
  toStopId: string;
  corridor: string;
}

export interface RouteLegFeature {
  type: 'Feature';
  properties: RouteLegProperties;
  geometry: {
    type: 'LineString';
    coordinates: LngLat[];
  };
}

export interface RouteGeoJson {
  type: 'FeatureCollection';
  name?: string;
  features: RouteLegFeature[];
}

export interface AccuracyPolygon {
  type: 'Polygon';
  coordinates: LngLat[][];
}

export interface RouteMapProps {
  gamePack: GamePack;
  progress: GameProgress | null;
  visibleStops: RouteStop[];
  locationProvider: LocationProvider;
}

export type RouteMarkerStatus = StopStatus | 'current' | 'finale';

export interface RoutePresentation {
  activeLegIndex: number | null;
  completedLegIndices: number[];
  finalLegVisible: boolean;
  fullRouteVisible: boolean;
}

const DEN_BOSCH_BOUNDS = {
  minLongitude: 5.27,
  maxLongitude: 5.34,
  minLatitude: 51.67,
  maxLatitude: 51.72
};

export function validateRouteGeoJson(data: unknown, gamePack: GamePack): RouteGeoJson {
  if (!data || typeof data !== 'object') throw new Error('Routebestand ontbreekt.');
  const candidate = data as Partial<RouteGeoJson>;
  if (candidate.type !== 'FeatureCollection' || !Array.isArray(candidate.features)) {
    throw new Error('Routebestand is geen GeoJSON FeatureCollection.');
  }
  const expectedLegs = gamePack.stops.length - 1;
  if (candidate.features.length !== expectedLegs) {
    throw new Error(`Routebestand moet ${expectedLegs} etappes bevatten.`);
  }

  candidate.features.forEach((feature, index) => {
    const fromStop = gamePack.stops[index];
    const toStop = gamePack.stops[index + 1];
    if (
      feature?.type !== 'Feature'
      || feature.geometry?.type !== 'LineString'
      || !Array.isArray(feature.geometry.coordinates)
      || feature.geometry.coordinates.length < 3
    ) {
      throw new Error(`Etappe ${index + 1} is geen geldige LineString.`);
    }
    if (
      feature.properties?.legIndex !== index
      || feature.properties?.fromStopId !== fromStop.id
      || feature.properties?.toStopId !== toStop.id
      || typeof feature.properties?.corridor !== 'string'
      || feature.properties.corridor.length === 0
    ) {
      throw new Error(`Etappe ${index + 1} sluit niet aan op de stopvolgorde.`);
    }
    feature.geometry.coordinates.forEach((coordinate) => {
      if (
        !Array.isArray(coordinate)
        || coordinate.length !== 2
        || !Number.isFinite(coordinate[0])
        || !Number.isFinite(coordinate[1])
        || coordinate[0] < DEN_BOSCH_BOUNDS.minLongitude
        || coordinate[0] > DEN_BOSCH_BOUNDS.maxLongitude
        || coordinate[1] < DEN_BOSCH_BOUNDS.minLatitude
        || coordinate[1] > DEN_BOSCH_BOUNDS.maxLatitude
      ) {
        throw new Error(`Etappe ${index + 1} bevat een ongeldige [longitude, latitude]-positie.`);
      }
    });

    const first = feature.geometry.coordinates[0];
    const last = feature.geometry.coordinates.at(-1)!;
    const fromDistance = haversineDistanceMeters(
      { latitude: first[1], longitude: first[0] },
      { latitude: fromStop.coordinates.latitude!, longitude: fromStop.coordinates.longitude! }
    );
    const toDistance = haversineDistanceMeters(
      { latitude: last[1], longitude: last[0] },
      { latitude: toStop.coordinates.latitude!, longitude: toStop.coordinates.longitude! }
    );
    if (fromDistance > 2 || toDistance > 2) {
      throw new Error(`Etappe ${index + 1} begint of eindigt niet bij de juiste stop.`);
    }
  });

  return candidate as RouteGeoJson;
}

export function getRoutePresentation(gamePack: GamePack, progress: GameProgress | null): RoutePresentation {
  const finalLegIndex = gamePack.stops.length - 2;
  const finalLegVisible = gamePack.stops
    .slice(0, -1)
    .every((stop) => progress?.stopProgress?.[stop.id]?.state === 'completed');
  const completedLegIndices = gamePack.stops
    .slice(1)
    .map((stop, index) => progress?.stopProgress?.[stop.id]?.state === 'completed' ? index : -1)
    .filter((index) => index >= 0 && (index !== finalLegIndex || finalLegVisible));
  const fullRouteVisible = Boolean(progress?.finalized)
    || gamePack.stops.every((stop) => progress?.stopProgress?.[stop.id]?.state === 'completed');

  if (fullRouteVisible) {
    return { activeLegIndex: null, completedLegIndices, finalLegVisible: true, fullRouteVisible: true };
  }

  const firstUnfinishedIndex = gamePack.stops.findIndex(
    (stop) => progress?.stopProgress?.[stop.id]?.state !== 'completed'
  );
  let activeLegIndex: number | null = firstUnfinishedIndex <= 1 ? 0 : firstUnfinishedIndex - 1;
  if (firstUnfinishedIndex < 0) activeLegIndex = null;
  if (activeLegIndex === finalLegIndex && !finalLegVisible) activeLegIndex = null;

  return {
    activeLegIndex,
    completedLegIndices,
    finalLegVisible,
    fullRouteVisible
  };
}

export function markerStatus(stop: RouteStop, state: StopStatus, currentStopId?: string): RouteMarkerStatus {
  if (stop.isFinal && state !== 'locked') return 'finale';
  if (stop.id === currentStopId && state !== 'completed' && state !== 'locked') return 'current';
  return state;
}

export function createAccuracyPolygon(location: LocationResult, points = 64): AccuracyPolygon {
  const earthRadius = 6371000;
  const latitudeRadians = location.latitude * Math.PI / 180;
  const coordinates: LngLat[] = [];
  for (let index = 0; index <= points; index += 1) {
    const angle = index / points * Math.PI * 2;
    const latitudeOffset = Math.sin(angle) * location.accuracy / earthRadius;
    const longitudeOffset = Math.cos(angle) * location.accuracy / (earthRadius * Math.cos(latitudeRadians));
    coordinates.push([
      location.longitude + longitudeOffset * 180 / Math.PI,
      location.latitude + latitudeOffset * 180 / Math.PI
    ]);
  }
  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

export function isLocationResult(outcome: LocationOutcome): outcome is LocationResult {
  return !('kind' in outcome);
}

export function externalNavigationUrl(stop: RouteStop, userAgent = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints) {
  const destination = `${stop.coordinates.latitude},${stop.coordinates.longitude}`;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (isAppleMobile) return `https://maps.apple.com/?daddr=${destination}&dirflg=w`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

export function shouldUseFallbackForMapError(error: unknown, styleReady: boolean) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/tile|glyph|sprite image/i.test(message)) return false;
  if (/style/i.test(message)) return true;
  return !styleReady;
}

export function startLocationPolling(
  provider: LocationProvider,
  onOutcome: (outcome: LocationOutcome) => void,
  intervalMs = 15000
) {
  let active = true;
  const update = async () => {
    const outcome = await provider.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    });
    if (active) onOutcome(outcome);
  };
  void update();
  const intervalId = window.setInterval(() => void update(), intervalMs);
  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}
