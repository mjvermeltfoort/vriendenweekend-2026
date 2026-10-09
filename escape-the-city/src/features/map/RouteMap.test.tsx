import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import type { RouteMapProps } from './mapTypes';

const mapState = vi.hoisted(() => ({
  fitBounds: vi.fn(),
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
  getSource: vi.fn(() => ({ setData: vi.fn() })),
  project: vi.fn(() => ({ x: 100, y: 100 })),
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
    constructor() {}
    extend() { return this; }
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
    startLocationPolling: vi.fn(() => vi.fn()),
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
    getCurrentPosition: vi.fn(async () => ({ kind: 'unavailable' as const, message: 'x' }))
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

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.clearTimeout = vi.fn(window.clearTimeout);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function render(visibleStops: RouteMapProps['visibleStops'], progress: RouteMapProps['progress']) {
    await act(async () => root.render(
      <MemoryRouter>
        <RouteMap
          gamePack={gamePack}
          progress={progress}
          visibleStops={visibleStops}
          locationProvider={locationProvider()}
        />
      </MemoryRouter>
    ));
  }

  it('keeps map instance stable when visibleStops gets a new equal array', async () => {
    const visibleStops = gamePack.stops.filter((stop) => !stop.isFinal);
    await render(visibleStops, progressWithCurrentStop());
    expect(mapState.addSource.mock.calls.length).toBe(3);
    expect(mapState.addLayer.mock.calls.length).toBe(7);
    expect(mapState.fitBounds.mock.calls.length).toBe(1);

    await render([...visibleStops], progressWithCurrentStop());
    expect(mapState.addSource.mock.calls.length).toBe(3);
    expect(mapState.addLayer.mock.calls.length).toBe(7);
    expect(mapState.fitBounds.mock.calls.length).toBe(1);
  });
});
