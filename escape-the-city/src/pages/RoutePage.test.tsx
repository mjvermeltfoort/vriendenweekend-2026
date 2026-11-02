import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const gameState = vi.hoisted(() => ({ current: {} }));

vi.mock('../app/gameContext', () => ({ useGame: () => gameState.current }));
vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  ProgressBar: () => <div>Herinneringen hersteld</div>,
  SyncStatus: () => null,
  GameIcon: () => <span aria-hidden="true" />
}));
vi.mock('../features/map/RouteMap', () => ({ RouteMap: () => <div data-testid="route-map">Routekaart</div> }));

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

  async function render(progress: ReturnType<typeof createInitialProgress>, key: string, path = "/route") {
    gameState.current = contextWith(progress);
    await act(async () => root.render(
      <MemoryRouter key={key} initialEntries={[path]}><RoutePage pack={gamePack} /></MemoryRouter>
    ));
  }

  it('keeps the endpoint hidden while main memories are missing', async () => {
    await render(createInitialProgress('team-1', gamePack), 'missing');

    expect(container.textContent).toContain('Verborgen eindlocatie');
    expect(container.textContent).toMatch(/Nog 6 opdrachten te voltooien/);
    expect(container.textContent).toContain('Eindlocatie verborgen');
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('[aria-label="Finale"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Bossche Brouwers');
  });

  it('reveals the finale after the first six memories', async () => {
    const progress = createInitialProgress('team-1', gamePack);
    for (const stop of gamePack.stops.slice(0, -1)) progress.stopProgress[stop.id].state = 'completed';
    progress.stopProgress[gamePack.finalStopId].state = 'available';
    await render(progress, 'revealed');

    expect(container.textContent).toContain('Bossche Brouwers');
    expect(container.textContent).toContain('Zes herinneringen zijn hersteld');
    expect(container.textContent).toContain('Naar finale');
    expect(container.querySelector('details [aria-label="Finale"]')).toBeNull();
    expect(container.querySelector('a[href="/stop/bossche-brouwers"]')).not.toBeNull();
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

  it('lists only visible unfinished schubs and links each to map selection', async () => {
    const progress = createInitialProgress('team-1', gamePack);
    for (const stop of gamePack.stops.slice(0, -1)) progress.stopProgress[stop.id].state = 'completed';
    const completed = gamePack.bonusLocations![0];
    progress.stopProgress[completed.id].state = 'completed';
    await render(progress, 'missing-schubs', '/route?schubben=ontbrekend');
    const section = container.querySelector('[aria-label="Ontbrekende schubben"]')!;
    expect(section.textContent).toContain('Ontbrekende schubben (5)');
    expect(section.textContent).not.toContain(completed.reward.resultLabel);
    const remaining = gamePack.bonusLocations![1];
    expect(section.querySelector(`a[href="#/route?schub=${encodeURIComponent(remaining.id)}"]`) ?? section.querySelector(`a[href="/route?schub=${encodeURIComponent(remaining.id)}"]`)).not.toBeNull();
  });

  it('places the map before progress, collapsed information and team status without a duplicate hero', async () => {
    await render(createInitialProgress('team-1', gamePack), 'map-first');
    const map = container.querySelector('[data-testid="route-map"]')!;
    for (const selector of ['[aria-label="Voortgang"]', 'details', '[aria-label="Teamstatus"]']) {
      expect(map.compareDocumentPosition(container.querySelector(selector)! ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(container.querySelector('.route-hero')).toBeNull();
    expect(container.querySelector('details')?.open).toBe(false);
    expect(container.querySelector('[aria-label="Routeweergave"]')).toBeNull();
  });

  it('opens the list through the bottom navigation URL and keeps progress below it', async () => {
    await render(createInitialProgress('team-1', gamePack), 'list-view', '/route?weergave=lijst');
    expect(container.querySelector('[aria-label="Routepunten"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="route-map"]')).toBeNull();
    expect(container.querySelector('[aria-label="Voortgang"]')).not.toBeNull();
    await render(createInitialProgress('team-1', gamePack), 'back-to-map', '/route');
    expect(container.querySelector('[data-testid="route-map"]')).not.toBeNull();
  });
});
