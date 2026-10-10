// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';
import type { TeamLocation } from '../lib/supabase/sync';
import type { LocationErrorResult, LocationResult } from '../features/location/provider';

const createProgress = () => {
  const value = createInitialProgress('team-1', gamePack);
  value.stopProgress.drakenfontein.state = 'completed';
  value.stopProgress.drakenfontein.unlockMethod = 'gps';
  value.stopProgress['bonus:bolwerk-sint-jan'].state = 'completed';
  value.stopProgress['bonus:bolwerk-sint-jan'].unlockMethod = 'gps';
  return value;
};

const selectBonus = vi.fn().mockResolvedValue(undefined);

const setTeamLocation = (overrides: Partial<TeamLocation> = {}): TeamLocation => ({
  sourceSessionId: 'session-1',
  capturedAt: '2026-10-10T18:17:00.000Z',
  selectedAt: '2026-10-10T18:17:00.000Z',
  isCurrent: true,
  latitude: 51.69,
  longitude: 5.3,
  accuracyM: 12,
  ...overrides
});

let gameState = {
  progress: createProgress(),
  startStop: vi.fn(),
  teamLocation: null as TeamLocation | null,
  deviceLocation: null as LocationResult | null,
  activeGameRun: null,
  locationError: null as LocationErrorResult | null,
  currentObservation: null,
  observationStatus: 'unavailable' as const,
  submitObservation: vi.fn(),
  selectBackupObservation: vi.fn(),
  selectBonus,
  submitBonusObservation: vi.fn(),
  submitSimulatedLocation: vi.fn()
};

vi.mock('../app/gameContext', () => ({
  useGame: () => gameState
}));

vi.mock('../components/GameUi', () => ({
  PageShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><header>{title}</header>{children}</main>,
  GameIcon: () => <span aria-hidden="true" />
}));
vi.mock('../components/AudioPlayer', () => ({ AudioPlayer: ({ transcript }: { transcript: string }) => <p>{transcript}</p> }));
vi.mock('../features/location/ActiveStopIndicator', () => ({
  ActiveStopIndicator: ({ location }: { location: LocationResult | null }) => (
    <div data-testid="active-stop-gps">{location ? `${location.latitude},${location.longitude}` : 'Locatie zoeken…'}</div>
  )
}));

import { StopPage } from './StopPage';

describe('StopPage completion copy', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'innerWidth', { value: 390, writable: true });
  });

  beforeEach(() => {
    gameState = {
      ...gameState,
      progress: createProgress(),
      startStop: vi.fn(),
      teamLocation: null as TeamLocation | null,
      deviceLocation: null as LocationResult | null,
      activeGameRun: null,
      locationError: null as LocationErrorResult | null,
      currentObservation: null,
      observationStatus: 'unavailable',
      submitObservation: vi.fn(),
      selectBackupObservation: vi.fn(),
      selectBonus,
      submitBonusObservation: vi.fn(),
      submitSimulatedLocation: vi.fn()
    };
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('hides story and location after a completed main stop', async () => {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/stop/drakenfontein']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.querySelector('header')?.textContent).toBe('Herinnering');
    const links = Array.from(container.querySelectorAll('a.button')).map((link) => ({ href: link.getAttribute('href'), text: link.textContent }));

    expect(container.textContent).toContain('Herinnering hersteld');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: '/route', text: 'Bekijk volgende routepunt op kaart' });
    expect(container.textContent).not.toContain('Vind de locatie');
    expect(container.textContent).not.toContain('Opdracht 1 van 7');
    expect(container.textContent).not.toContain('GPS-devsimulator');
  });

  it('uses route mode for a completed middle stop', async () => {
    const progress = createProgress();
    progress.stopProgress['sint-jan'].state = 'completed';
    progress.stopProgress['sint-jan'].unlockMethod = 'gps';
    gameState = { ...gameState, progress };

    await act(async () => root.render(
      <MemoryRouter key="mid" initialEntries={['/stop/sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    const links = Array.from(container.querySelectorAll('a.button')).map((link) => ({ href: link.getAttribute('href'), text: link.textContent }));

    expect(container.textContent).toContain('Bekijk volgende routepunt op kaart');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: '/route', text: 'Bekijk volgende routepunt op kaart' });
    expect(container.textContent).not.toContain('Volgende routepunt');
    expect(container.textContent).not.toContain('Vind de locatie');
  });

  it('shows the result action without route duplication after the finale', async () => {
    const finaleProgress = createProgress();
    for (const stop of gamePack.stops) {
      finaleProgress.stopProgress[stop.id].state = 'completed';
      finaleProgress.stopProgress[stop.id].unlockMethod = 'gps';
    }
    gameState = { ...gameState, progress: finaleProgress };

    await act(async () => root.render(
      <MemoryRouter key="finale" initialEntries={['/stop/bossche-brouwers']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    const links = Array.from(container.querySelectorAll('a.button')).map((link) => ({ href: link.getAttribute('href'), text: link.textContent }));

    expect(container.textContent).toContain('Bekijk resultaat');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: '/resultaat', text: 'Bekijk resultaat' });
    expect(container.textContent).not.toContain('Bekijk routekaart');
    expect(container.textContent).not.toContain('Volgende routepunt');
  });

  it('shows intro text once without audio and preserves audio transcript content', async () => {
    gameState = { ...gameState, progress: createProgress() };

    await act(async () => root.render(
      <MemoryRouter key="bonus-text" initialEntries={['/stop/bonus:halve-peer']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Zoek een belangrijk man die maar voor de helft aanwezig is.');
    expect(container.textContent?.split('Zoek een belangrijk man die maar voor de helft aanwezig is.').length).toBe(2);
    expect(container.textContent).not.toContain('Luister naar het verhaal');
  });

  it('keeps bonus completion separate from main stop controls', async () => {
    gameState = { ...gameState, progress: createProgress() };

    await act(async () => root.render(
      <MemoryRouter key="bonus" initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    const links = Array.from(container.querySelectorAll('a.button')).map((link) => ({ href: link.getAttribute('href'), text: link.textContent }));

    expect(container.textContent).toContain('Drakenschub gevonden');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: '/route', text: 'Terug naar hoofdroute' });
    expect(container.textContent).not.toContain('Opdracht 1 van 7');
    expect(container.textContent).not.toContain('Vind de locatie');
  });

  it('uses phone GPS for main stops and hides redundant status copy', async () => {
    const progress = createProgress();
    progress.currentStopId = 'kruithuis';
    progress.stopProgress.kruithuis.state = 'available';
    gameState = {
      ...gameState,
      progress,
      teamLocation: null,
      deviceLocation: {
        latitude: 51.693,
        longitude: 5.305,
        accuracy: 11,
        capturedAt: new Date().toISOString()
      }
    };
    await act(async () => root.render(
      <MemoryRouter key="main-device" initialEntries={['/stop/kruithuis']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));
    expect(container.querySelector('[data-testid="active-stop-gps"]')?.textContent).toBe('51.693,5.305');
    expect(container.textContent).not.toContain('We controleren automatisch de beste actuele GPS van jullie team.');
    expect(container.textContent?.split('Vuur en Water').length).toBe(2);
  });

  it('shows bonus arrival and verification text by distance and unlock state', async () => {
    const progress = createProgress();
    progress.currentStopId = 'bonus:bolwerk-sint-jan';
    progress.stopProgress['bonus:bolwerk-sint-jan'].state = 'available';
    progress.stopProgress['bonus:bolwerk-sint-jan'].unlockMethod = 'gps';

    gameState = { ...gameState, progress, teamLocation: setTeamLocation({ latitude: 51.6902, longitude: 5.3002 }) };

    await act(async () => root.render(
      <MemoryRouter key="bonus-arrival" initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Nog ongeveer 120 m (hemelsbreed)');
    expect(container.textContent).not.toContain('Nog ongeveer 0 m lopen');
    expect(container.textContent).toContain('Opdracht openen');

    const lockedProgress = createProgress();
    lockedProgress.currentStopId = 'bonus:bolwerk-sint-jan';
    lockedProgress.stopProgress['bonus:bolwerk-sint-jan'].state = 'locked';
    gameState = { ...gameState, progress: lockedProgress, teamLocation: setTeamLocation({ latitude: 51.6902, longitude: 5.3002 }) };

    await act(async () => root.render(
      <MemoryRouter key="bonus-check" initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Nog ongeveer 120 m (hemelsbreed)');
    expect(container.textContent).not.toContain('Nog ongeveer 0 m lopen');
    expect(container.textContent).toContain('Opdracht openen');
  });

  it('shows hemelsbrede distance for positive bonus distance', async () => {
    const progress = createProgress();
    progress.currentStopId = 'bonus:bolwerk-sint-jan';
    progress.stopProgress['bonus:bolwerk-sint-jan'].state = 'available';
    progress.stopProgress['bonus:bolwerk-sint-jan'].unlockMethod = 'gps';

    gameState = { ...gameState, progress, teamLocation: setTeamLocation({ latitude: 51.6905, longitude: 5.301 }) };

    await act(async () => root.render(
      <MemoryRouter key="bonus-distance" initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Nog ongeveer');
    expect(container.textContent).toContain('(hemelsbreed)');
    expect(container.textContent).not.toContain('lopen');
  });

  it('keeps GPS fallback text when no usable location exists', async () => {
    const progress = createProgress();
    progress.currentStopId = 'bonus:bolwerk-sint-jan';
    progress.stopProgress['bonus:bolwerk-sint-jan'].state = 'available';
    gameState = { ...gameState, progress, teamLocation: null };

    await act(async () => root.render(
      <MemoryRouter key="bonus-no-gps" initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Afstand bepalen…');
  });

  it('updates bonus distance from live device GPS without a current team location', async () => {
    const progress = createProgress();
    progress.stopProgress.binnendieze.state = 'completed';
    progress.stopProgress['bonus:zwanenbroedershuis'].state = 'available';
    const first: LocationResult = {
      latitude: 51.6905,
      longitude: 5.306,
      accuracy: 12,
      capturedAt: new Date().toISOString()
    };
    gameState = { ...gameState, progress, teamLocation: null, deviceLocation: first };

    const screen = (key: string) => (
      <MemoryRouter key={key} initialEntries={['/stop/bonus:zwanenbroedershuis']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    );
    await act(async () => root.render(screen('device-first')));
    const distanceLabel = () => container.querySelector('.active-stop-indicator__distance')?.textContent;
    const initial = distanceLabel();
    expect(initial).toContain('Nog ongeveer');
    expect(container.textContent).toContain('Hemelsbrede afstand vanaf jouw actuele GPS-positie.');
    expect(container.textContent).not.toContain('Afstand bepalen…');
    expect(container.textContent).not.toContain('We controleren automatisch de beste actuele GPS van jullie team.');

    gameState = {
      ...gameState,
      deviceLocation: { ...first, latitude: 51.688710, longitude: 5.309535, capturedAt: new Date().toISOString() }
    };
    await act(async () => root.render(screen('device-updated')));
    expect(distanceLabel()).not.toBe(initial);
    expect(container.textContent).not.toContain('Afstand bepalen…');
  });

  it('explains denied GPS instead of showing endless distance loading', async () => {
    const progress = createProgress();
    progress.stopProgress.binnendieze.state = 'completed';
    progress.stopProgress['bonus:zwanenbroedershuis'].state = 'available';
    gameState = {
      ...gameState,
      progress,
      teamLocation: null,
      deviceLocation: null,
      locationError: { kind: 'permission-denied', message: 'Locatietoegang geweigerd.' }
    };
    await act(async () => root.render(
      <MemoryRouter key="device-denied" initialEntries={['/stop/bonus:zwanenbroedershuis']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));
    expect(container.textContent).toContain('Geef Chrome locatietoegang om de afstand te zien.');
    expect(container.textContent).not.toContain('Locatietoegang geweigerd.');
    expect(container.textContent).not.toContain('Kom dichter bij de schub.');
  });
});
