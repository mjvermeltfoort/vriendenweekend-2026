import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const progress = createInitialProgress('team-1', gamePack);
progress.stopProgress.drakenfontein.state = 'completed';
progress.stopProgress.drakenfontein.unlockMethod = 'gps';
progress.stopProgress['bonus:bolwerk-sint-jan'].state = 'completed';
progress.stopProgress['bonus:bolwerk-sint-jan'].unlockMethod = 'gps';

const selectBonus = vi.fn().mockResolvedValue(undefined);

vi.mock('../app/gameContext', () => ({
  useGame: () => ({
    progress,
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
  })
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
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('uses schub wording and returns a completed bonus to the route', async () => {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/stop/bonus:bolwerk-sint-jan']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Drakenschub gevonden');
    expect(container.querySelector('header')?.textContent).toBe('Drakenschub');
    expect(container.textContent).toContain('De oude poort is verdwenen');
    expect(container.textContent).toContain('Terug naar hoofdroute');
    expect(container.textContent).not.toContain('Bekijk resultaat');
    expect(container.textContent).not.toContain('Hier beschermden een stadspoort en bolwerk');
    expect(container.textContent).toContain('Vind de locatie');
    expect(container.textContent?.match(/De Poortschub is gevonden\./g) ?? []).toHaveLength(0);
  });

  it('keeps a completed main memory story replayable without location controls', async () => {
    await act(async () => root.render(
      <MemoryRouter key="main" initialEntries={['/stop/drakenfontein']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.querySelector('header')?.textContent).toBe('Herinnering');
    expect(container.textContent).toContain('De Moerasdraak heeft zeven herinneringen');
    expect(container.textContent).toContain('Goed: bij het water vinden jullie de herinnering aan vuur.');
    expect(container.textContent).toContain('Vind de locatie');
  });

  it('shows the result action without a zero-opportunities error after the finale', async () => {
    for (const stop of gamePack.stops) {
      progress.stopProgress[stop.id].state = 'completed';
      progress.stopProgress[stop.id].unlockMethod = 'gps';
    }

    await act(async () => root.render(
      <MemoryRouter key="finale" initialEntries={['/stop/bossche-brouwers']}>
        <Routes><Route path="/stop/:stopId" element={<StopPage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Bekijk resultaat');
    expect(container.textContent).not.toContain('Nog 0 opdrachten');
  });
});
