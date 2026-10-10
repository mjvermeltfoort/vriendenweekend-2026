import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import type { RouteMapProps } from './mapTypes';

const mapState = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  easeTo: vi.fn(),
  positionSetData: vi.fn(),
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
  getSource: vi.fn(() => ({ setData: mapState.positionSetData })),
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

function progressWithCurrentStop() {
  const progress = createInitialProgress('team-1', gamePack);
  progress.stopProgress[gamePack.stops[0].id].state = 'available';
  return progress;
}

describe('RouteMap', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.clearTimeout = vi.fn(window.clearTimeout);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  afterAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function render(
    visibleStops: RouteMapProps['visibleStops'],
    progress: RouteMapProps['progress'],
    location: RouteMapProps['location'] = null
  ) {
    await act(async () => root.render(
      <MemoryRouter>
        <RouteMap
          gamePack={gamePack}
          progress={progress}
          visibleStops={visibleStops}
          location={location}
          locationError={null}
        />
      </MemoryRouter>
    ));
  }

  it('starts location polling automatically and keeps manual recenter available', async () => {
    const visibleStops = gamePack.stops.filter((stop) => !stop.isFinal);
    await render(visibleStops, progressWithCurrentStop());

    expect(mapState.easeTo).not.toHaveBeenCalled();
    expect(mapState.fitBounds).toHaveBeenCalledTimes(1);
    expect(mapState.getSource).toHaveBeenCalledWith('route-position');
  });

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

  it('updates the live GPS marker without resetting the map and centers on the newest point on request', async () => {
    const visibleStops = gamePack.stops.filter((stop) => !stop.isFinal);
    await render(visibleStops, progressWithCurrentStop());
    const initialSourceCount = mapState.addSource.mock.calls.length;
    mapState.positionSetData.mockClear();

    const firstLocation = { latitude: 51.69, longitude: 5.3, accuracy: 12 };
    await render(visibleStops, progressWithCurrentStop(), firstLocation);

    expect(mapState.addSource).toHaveBeenCalledTimes(initialSourceCount);
    expect(mapState.positionSetData).toHaveBeenCalledWith({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [firstLocation.longitude, firstLocation.latitude] }
    });
    expect(mapState.easeTo).not.toHaveBeenCalled();

    const latestLocation = { latitude: 51.691, longitude: 5.301, accuracy: 8 };
    await render(visibleStops, progressWithCurrentStop(), latestLocation);
    const centerButton = container.querySelector<HTMLButtonElement>('.map-location-button--secondary');
    expect(centerButton).not.toBeNull();
    await act(async () => {
      centerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mapState.easeTo).toHaveBeenCalledWith({
      center: [latestLocation.longitude, latestLocation.latitude],
      duration: 300
    });
  });
});
