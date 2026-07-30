import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { createInitialProgress, type StopStatus } from '../game/gameState';
import { haversineDistanceMeters } from '../location/distance';
import {
  createAccuracyPolygon,
  externalNavigationUrl,
  getRoutePresentation,
  markerStatus,
  shouldUseFallbackForMapError,
  startLocationPolling,
  validateRouteGeoJson
} from './mapTypes';
import { autoSelectedStopId, visibleRouteFeatures } from './RouteMap';

const routeData = JSON.parse(readFileSync(
  resolve(process.cwd(), 'public/routes/moerasdraak-den-bosch.geojson'),
  'utf8'
));

describe('route GeoJSON', () => {
  it('contains six ordered, connected [longitude, latitude] legs', () => {
    const route = validateRouteGeoJson(routeData, gamePack);

    expect(route.features).toHaveLength(6);
    route.features.forEach((feature, index) => {
      expect(feature.properties.legIndex).toBe(index);
      expect(feature.properties.fromStopId).toBe(gamePack.stops[index].id);
      expect(feature.properties.toStopId).toBe(gamePack.stops[index + 1].id);
      expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(3);
      if (index > 0) {
        expect(feature.geometry.coordinates[0]).toEqual(
          route.features[index - 1].geometry.coordinates.at(-1)
        );
      }
    });
  });

  it('rejects latitude/longitude in the wrong order', () => {
    const invalid = structuredClone(routeData);
    invalid.features[0].geometry.coordinates[1] = [51.690538, 5.29636];

    expect(() => validateRouteGeoJson(invalid, gamePack)).toThrow(/\[longitude, latitude\]/);
  });
});

describe('route presentation', () => {
  it('does not invent an incoming leg for the start stop', () => {
    const progress = createInitialProgress('team', gamePack);

    expect(getRoutePresentation(gamePack, progress)).toEqual({
      activeLegIndex: null,
      completedLegIndices: [],
      finalLegVisible: false,
      fullRouteVisible: false
    });
  });

  it('moves completed and active segments with progress', () => {
    const progress = createInitialProgress('team', gamePack);
    progress.stopProgress[gamePack.stops[0].id].state = 'completed';
    progress.stopProgress[gamePack.stops[1].id].state = 'completed';

    expect(getRoutePresentation(gamePack, progress)).toMatchObject({
      activeLegIndex: 1,
      completedLegIndices: [0],
      finalLegVisible: false
    });
  });

  it('reveals the finale leg only after the six earlier assignments', () => {
    const progress = createInitialProgress('team', gamePack);
    for (const stop of gamePack.stops.slice(0, -1)) {
      progress.stopProgress[stop.id].state = 'completed';
    }
    const presentation = getRoutePresentation(gamePack, progress);
    const route = validateRouteGeoJson(routeData, gamePack);

    expect(presentation.finalLegVisible).toBe(true);
    expect(presentation.activeLegIndex).toBe(5);
    expect(presentation.completedLegIndices).toEqual([0, 1, 2, 3, 4]);
    expect(visibleRouteFeatures(route, presentation)).toHaveLength(6);
  });

  it('hides the finale feature before it is revealed and shows the full route after completion', () => {
    const progress = createInitialProgress('team', gamePack);
    const route = validateRouteGeoJson(routeData, gamePack);

    expect(visibleRouteFeatures(route, getRoutePresentation(gamePack, progress))).toHaveLength(5);

    for (const stop of gamePack.stops) progress.stopProgress[stop.id].state = 'completed';
    expect(getRoutePresentation(gamePack, progress).fullRouteVisible).toBe(true);
  });
});

describe('map helpers', () => {
  it('auto-opens the bottom-sheet for the active stop unless it is locked', () => {
    const progress = createInitialProgress('team', gamePack);

    expect(autoSelectedStopId(progress.currentStopId, progress, gamePack.stops)).toBe(progress.currentStopId);

    progress.stopProgress[progress.currentStopId].state = 'locked';
    expect(autoSelectedStopId(progress.currentStopId, progress, gamePack.stops)).toBe(null);
  });

  it('does not auto-open for unknown or missing active stops', () => {
    const progress = createInitialProgress('team', gamePack);

    expect(autoSelectedStopId(undefined, progress, gamePack.stops)).toBe(null);
    expect(autoSelectedStopId('onbekend', progress, gamePack.stops)).toBe(null);
  });

  it('maps every marker state and keeps the finale visually distinct', () => {
    const stop = gamePack.stops[1];
    const statuses: StopStatus[] = ['locked', 'available', 'arrived', 'started', 'completed'];

    expect(statuses.map((state) => markerStatus(stop, state))).toEqual(statuses);
    expect(markerStatus(stop, 'available', stop.id)).toBe('current');
    expect(markerStatus(gamePack.stops.at(-1)!, 'available')).toBe('finale');
  });

  it('creates a meter-correct closed accuracy polygon', () => {
    const location = { latitude: 51.69, longitude: 5.3, accuracy: 42 };
    const polygon = createAccuracyPolygon(location);
    const first = polygon.coordinates[0][0];
    const distance = haversineDistanceMeters(location, {
      latitude: first[1],
      longitude: first[0]
    });

    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates[0]).toHaveLength(65);
    expect(polygon.coordinates[0][0]).toEqual(polygon.coordinates[0].at(-1));
    expect(distance).toBeCloseTo(42, 0);
  });

  it('uses Apple Maps on iOS and walking Google Maps elsewhere', () => {
    const stop = gamePack.stops[0];

    expect(externalNavigationUrl(stop, 'iPhone', 5)).toContain('maps.apple.com');
    expect(externalNavigationUrl(stop, 'Android', 5)).toContain('travelmode=walking');
  });

  it('falls back for style errors but not for missing tiles', () => {
    expect(shouldUseFallbackForMapError(new Error('Style failed to load'), true)).toBe(true);
    expect(shouldUseFallbackForMapError(new Error('Tile 14/8410/5473 failed'), false)).toBe(false);
  });
});

describe('location polling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is opt-in, refreshes every 15 seconds and cleans up', async () => {
    vi.useFakeTimers();
    const provider = {
      getCurrentPosition: vi.fn().mockResolvedValue({ latitude: 51.69, longitude: 5.3, accuracy: 12 })
    };
    const onOutcome = vi.fn();

    expect(provider.getCurrentPosition).not.toHaveBeenCalled();
    const stop = startLocationPolling(provider, onOutcome);
    await Promise.resolve();
    await Promise.resolve();
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15000);
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
