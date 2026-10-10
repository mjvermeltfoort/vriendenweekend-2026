// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
import type { LocationResult } from './provider';

vi.mock('./routeDistance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./routeDistance')>();
  return {
    ...actual,
    loadRouteGeoJson: vi.fn(async () => ({ type: 'FeatureCollection', features: [] }))
  };
});

import { ActiveStopIndicator } from './ActiveStopIndicator';

describe('ActiveStopIndicator for regular stops', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const progress = createInitialProgress('team-1', gamePack);
  progress.currentStopId = 'drakenfontein';
  progress.stopProgress.drakenfontein.state = 'available';

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function show(location: LocationResult | null) {
    await act(async () => root.render(
      <ActiveStopIndicator pack={gamePack} progress={progress} location={location} />
    ));
  }

  it('shows a single location-searching message without repeating the stop title', async () => {
    await show(null);
    expect(container.textContent?.split('Locatie zoeken…').length).toBe(2);
    expect(container.textContent).not.toContain('De Drakenfontein');
    expect(container.textContent).toContain('Afstand tot de locatie');
  });

  it('explains that GPS is retrying instead of endlessly showing location searching', async () => {
    await act(async () => root.render(
      <ActiveStopIndicator
        pack={gamePack}
        progress={progress}
        location={null}
        locationError={{ kind: 'timeout', message: 'Locatie duurde te lang.' }}
      />
    ));
    expect(container.textContent).toContain('GPS tijdelijk niet beschikbaar – er wordt opnieuw gezocht…');
    expect(container.textContent).not.toContain('Locatie zoeken…');
  });

  it('shows a usable distance when a new device GPS fix arrives', async () => {
    await show({
      latitude: 51.6900,
      longitude: 5.2960,
      accuracy: 12,
      capturedAt: new Date().toISOString()
    });
    expect(container.textContent).toContain('Nog ongeveer');
    expect(container.textContent).toContain('Locatie nauwkeurig');
    expect(container.textContent).not.toContain('Locatie zoeken…');
  });
});
