import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const gameState = vi.hoisted(() => ({ current: {} }));

vi.mock('../app/gameContext', () => ({ useGame: () => gameState.current }));
vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  ProgressBar: () => null,
  SyncStatus: () => null,
  GameIcon: () => <span aria-hidden="true" />
}));
vi.mock('../features/map/RouteMap', () => ({ RouteMap: () => <div>Routekaart</div> }));

import { RoutePage } from './RoutePage';

function contextWith(progress: ReturnType<typeof createInitialProgress>) {
  return {
    activeTeam: { id: 'team-1', name: 'Testteam' },
    progress,
    syncStatus: 'saved',
    syncMessage: 'Alles opgeslagen',
    teamLocation: null,
    activeSessionCount: 1
  };
}

describe('RoutePage finale states', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem('moerasdraak-bonus-intro:team-1', 'seen');
  });

  afterAll(() => {
    act(() => root.unmount());
    localStorage.clear();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function render(progress: ReturnType<typeof createInitialProgress>, key: string) {
    gameState.current = contextWith(progress);
    await act(async () => root.render(
      <MemoryRouter key={key}><RoutePage pack={gamePack} /></MemoryRouter>
    ));
  }

  it('keeps the endpoint hidden while main memories are missing', async () => {
    await render(createInitialProgress('team-1', gamePack), 'missing');

    expect(container.textContent).toContain('Verborgen eindlocatie');
    expect(container.textContent).toMatch(/Nog 6 opdrachten te voltooien/);
    expect(container.textContent).toContain('Eindlocatie verborgen');
  });

  it('reveals the finale after the first six memories', async () => {
    const progress = createInitialProgress('team-1', gamePack);
    for (const stop of gamePack.stops.slice(0, -1)) progress.stopProgress[stop.id].state = 'completed';
    progress.stopProgress[gamePack.finalStopId].state = 'available';
    await render(progress, 'revealed');

    expect(container.textContent).toContain('Bossche Brouwers');
    expect(container.textContent).toContain('Zes herinneringen zijn hersteld');
    expect(container.textContent).toContain('Naar finale');
  });

  it('prioritizes the result after the game is finalized', async () => {
    const progress = createInitialProgress('team-1', gamePack);
    for (const stop of gamePack.stops) progress.stopProgress[stop.id].state = 'completed';
    progress.finalized = true;
    await render(progress, 'finalized');

    expect(container.textContent).toContain('Alle zeven herinneringen zijn hersteld.');
    expect(container.textContent).toContain('Bekijk resultaat');
    expect(container.textContent).not.toContain('Naar finale');
  });

  it('shows route hero before details on mobile-sized route view', async () => {
    await render(createInitialProgress('team-1', gamePack), 'hero');

    const text = container.textContent ?? '';
    expect(text).toContain('Route');
    expect(text).toContain('Routekaart');
    expect(text).toContain('Verborgen eindlocatie');
  });

  it('opens route map by default from the completed stop link', async () => {
    const progress = createInitialProgress('team-1', gamePack);
    progress.stopProgress.drakenfontein.state = 'completed';
    gameState.current = contextWith(progress);

    await act(async () => root.render(
      <MemoryRouter initialEntries={[{ pathname: '/route', state: { view: 'route' } }]}>
        <Routes><Route path="/route" element={<RoutePage pack={gamePack} />} /></Routes>
      </MemoryRouter>
    ));

    expect(container.textContent).toContain('Routekaart');
    expect(container.textContent).toContain('Route');
  });
});
