import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const progress = createInitialProgress('team-1', gamePack);
for (const stop of [...gamePack.stops, ...(gamePack.bonusLocations ?? [])]) {
  progress.stopProgress[stop.id].state = 'completed';
  progress.stopProgress[stop.id].scoreAwarded = gamePack.bonusLocations?.find((bonus) => bonus.id === stop.id)?.maximumPoints ?? 1000;
}
progress.collectedRewards = gamePack.stops.map((stop) => stop.reward.symbol);
progress.finalized = true;
progress.finalResult = {
  title: gamePack.title,
  summary: 'Klaar',
  score: 8051,
  durationMinutes: 86,
  hintsUsed: 1,
  wrongAttempts: 7,
  symbols: progress.collectedRewards,
  createdAt: new Date(0).toISOString()
};

vi.mock('../app/gameContext', () => ({
  useGame: () => ({ loading: false, progress, activeTeam: { id: 'team-1', name: 'Testteam' } })
}));
vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  DragonEmblem: () => <span aria-hidden="true" />,
  GameIcon: () => <span aria-hidden="true" />,
  AudioControl: () => null
}));
vi.mock('../components/AudioPlayer', () => ({ AudioPlayer: () => null }));

import { ResultPage } from './ResultPage';

describe('ResultPage', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shows failures with the other final statistics', () => {
    act(() => root.render(<MemoryRouter><ResultPage pack={gamePack} /></MemoryRouter>));

    expect(container.textContent).toContain('Fouten');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('SCHUBBENJAGERS');
  });
});
