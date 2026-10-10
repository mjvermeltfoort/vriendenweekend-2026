import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import type { RouteMapProps } from './mapTypes';

const mapState = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  easeTo: vi.fn(),
  remove: vi.fn(),
  addControl: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  touchZoomRotate: { disableRotation: vi.fn() },
  on: vi.fn((event: string, handler: () => void) => {
    if (event === 'load') handler();
    return mapState;
  }),
  loaded: vi.fn(() => true),
  getLayer: vi.fn(() => true),
  setData: vi.fn(),
  getSource: vi.fn(() => ({ setData: mapState.setData })),
  project: vi.fn(([longitude, latitude]: [number, number]) => ({ x: longitude * 100, y: latitude * 100 })),
  setLayoutProperty: vi.fn(),
  setFilter: vi.fn(),
  resize: vi.fn(),
  removeControl: vi.fn()
}));

vi.mock('maplibre-gl', () => {
  class Map {
    touchZoomRotate = mapState.touchZoomRotate;
    constructor() {
      return mapState;
    }
  }
  class NavigationControl {}
  class AttributionControl {}
  class LngLatBounds {
    coordinates: number[][];
    constructor(start: number[], end: number[]) {
      this.coordinates = [start, end];
    }
    extend(value: number[]) {
      this.coordinates.push(value);
      return this;
    }
  }
  return { Map, NavigationControl, AttributionControl, LngLatBounds };
});

vi.mock('./mapStyle', () => ({
  MAP_STYLE_URL: 'style',
  mapColors: { completed: '#000', active: '#111', accuracy: '#222' },
  applyMoerasdraakTheme: vi.fn(),
  legFilter: vi.fn(() => ['all'])
}));
vi.mock('./RouteMarker', () => ({ RouteMarker: () => null }));
vi.mock('../components/GameUi', () => ({ GameIcon: () => null }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, Link: () => null };
});
vi.mock('./mapTypes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapTypes')>();
  return {
    ...actual,
    startLocationPolling: vi.fn((provider, onOutcome) => {
      void provider.getCurrentPosition?.();
      void onOutcome({ latitude: 51.69, longitude: 5.3, accuracy: 12 });
      return vi.fn();
    }),
    shouldUseFallbackForMapError: vi.fn(() => false)
  };
});
vi.mock('../location/routeDistance', () => ({ loadRouteGeoJson: vi.fn(async () => ({ type: 'FeatureCollection', features: [
  {
    type: 'Feature',
    properties: { legIndex: 0, fromStopId: 'a', toStopId: 'b', corridor: 'x' },
    geometry: { type: 'LineString', coordinates: [[5.3, 51.69], [5.304, 51.692], [5.31, 51.695]] }
  }
] })) }));
vi.mock('../game/gameState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../game/gameState')>();
  return {
    ...actual,
    visibleBonusLocations: vi.fn(() => [])
  };
});

import { RouteMap } from './RouteMap';

function locationProvider(): RouteMapProps['locationProvider'] {
  return {
    getCurrentPosition: vi.fn(async () => ({ latitude: 51.69, longitude: 5.3, accuracy: 12 }))
  };
}

function progressWithCurrentStop() {
  const progress = createInitialProgress('team-1', gamePack);
  progress.stopProgress[gamePack.stops[0].id].state = 'available';
  return progress;
}

describe('RouteMap', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  let testKey = 0;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.clearTimeout = vi.fn(window.clearTimeout);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });

  beforeEach(() => {
    testKey += 1;
    vi.clearAllMocks();
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function render(
    visibleStops: RouteMapProps['visibleStops'],
    progress: RouteMapProps['progress'],
    deviceLocation?: RouteMapProps['deviceLocation']
  ) {
    await act(async () => root.render(
      <MemoryRouter key={testKey}>
        <RouteMap
          gamePack={gamePack}
          progress={progress}
          visibleStops={visibleStops}
          locationProvider={locationProvider()}
          deviceLocation={deviceLocation}
        />
      </MemoryRouter>
    ));
  }

  it('starts location polling automatically and keeps manual recenter available', async () => {
    const visibleStops = gamePack.stops.filter((stop) => !stop.isFinal);
    await render(visibleStops, progressWithCurrentStop());

    expect(mapState.easeTo).not.toHaveBeenCalled();
    expect(mapState.fitBounds).toHaveBeenCalled();
    expect(mapState.getSource).toHaveBeenCalledWith('route-accuracy');
    expect(container.querySelector('[data-testid="route-gps-marker"]')).not.toBeNull();
  });

  it('keeps map instance stable when visibleStops gets a new equal array', async () => {
    const visibleStops = gamePack.stops.filter((stop) => !stop.isFinal);
    await render(visibleStops, progressWithCurrentStop());
    expect(mapState.addSource.mock.calls.length).toBe(2);
    expect(mapState.addLayer.mock.calls.length).toBe(6);
    const fits = mapState.fitBounds.mock.calls.length;
    await render([...visibleStops], progressWithCurrentStop());
    expect(mapState.addSource.mock.calls.length).toBe(2);
    expect(mapState.addLayer.mock.calls.length).toBe(6);
    expect(mapState.fitBounds.mock.calls.length).toBe(fits);
  });

  it('moves the GPS marker on successive device updates without resetting the map', async () => {
    const stops = gamePack.stops.filter((stop) => !stop.isFinal);
    const first = { latitude: 51.689, longitude: 5.302, accuracy: 14, capturedAt: new Date().toISOString() };
    await render(stops, progressWithCurrentStop(), first);

    const marker = container.querySelector('[data-testid="route-gps-marker"]');
    expect(marker?.getAttribute('aria-label')).toBe('Jouw actuele GPS-positie');
    const previousPosition = marker?.getAttribute('style');
    expect(previousPosition).toContain('left:');
    const fitsBefore = mapState.fitBounds.mock.calls.length;
    const addBefore = mapState.addSource.mock.calls.length;

    // GPS is part of the initial camera bounds; its marker remains independently
    // visible above stop markers and moves without another map.fitBounds.
    const initialBounds = mapState.fitBounds.mock.calls.at(-1)?.[0] as { coordinates: number[][] };
    expect(initialBounds.coordinates).toContainEqual([first.longitude, first.latitude]);

    const second = { ...first, latitude: 51.691, longitude: 5.308, capturedAt: new Date().toISOString() };
    await render(stops, progressWithCurrentStop(), second);
    expect(container.querySelector('[data-testid="route-gps-marker"]')?.getAttribute('style')).not.toBe(previousPosition);
    expect(mapState.project).toHaveBeenCalledWith([second.longitude, second.latitude]);
    expect(mapState.fitBounds.mock.calls.length).toBe(fitsBefore);
    expect(mapState.addSource.mock.calls.length).toBe(addBefore);
    expect(mapState.easeTo).not.toHaveBeenCalled();
  });
});
