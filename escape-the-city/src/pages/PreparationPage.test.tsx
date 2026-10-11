import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gamePack } from '../game-data/moerasdraak/game';

vi.mock('../app/gameContext', () => ({
  useGame: () => ({
    activeTeam: { id: 'team-3', name: 'Team 3' },
    progress: null,
    syncStatus: 'saved',
    syncMessage: 'Alles opgeslagen',
    syncNow: vi.fn()
  })
}));
vi.mock('../lib/supabase/sync', () => ({ isSupabaseAvailable: () => true }));
vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  GameIcon: () => null,
  ProgressBar: () => null,
  SyncStatus: () => null
}));
vi.mock('../components/AudioPlayer', () => ({ AudioPlayer: () => null }));

import { PreparationPage } from './PreparationPage';

describe('PreparationPage', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('reuses the golden finale emblem above the preparation content', () => {
    act(() => root.render(<MemoryRouter><PreparationPage pack={gamePack} /></MemoryRouter>));
    const emblem = container.querySelector<HTMLImageElement>('img.preparation-hero__emblem');
    expect(emblem?.getAttribute('src')).toContain('assets/moerasdraak-result-emblem.svg');
    expect(emblem?.getAttribute('alt')).toBe('Gouden embleem van de Moerasdraak');
    expect(container.textContent).toContain('Spel voorbereiden');
    expect(container.textContent).toContain('Team 3');
  });
});
