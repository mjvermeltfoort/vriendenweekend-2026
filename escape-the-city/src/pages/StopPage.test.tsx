// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const createProgress = () => {
  const value = createInitialProgress('team-1', gamePack);
  value.stopProgress.drakenfontein.state = 'completed';
  value.stopProgress.drakenfontein.unlockMethod = 'gps';
  value.stopProgress['bonus:bolwerk-sint-jan'].state = 'completed';
  value.stopProgress['bonus:bolwerk-sint-jan'].unlockMethod = 'gps';
  return value;
};

const selectBonus = vi.fn().mockResolvedValue(undefined);

let gameState = {
  progress: createProgress(),
  startStop: vi.fn(),
  teamLocation: null,
  activeGameRun: null,
  locationError: null,
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
vi.mock('../components/AudioPlayer', () => ({ AudioPlayer: () => null }));
vi.mock('../features/location/ActiveStopIndicator', () => ({ ActiveStopIndicator: () => null }));

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
      teamLocation: null,
      activeGameRun: null,
      locationError: null,
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
});
