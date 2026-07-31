import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockResumeWithJoinCode = vi.fn();
const mockRemoveActiveTeam = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  ProgressBar: () => <div />,
  SyncStatus: () => <div />,
  TeamAvatar: ({ name }: { name: string }) => <span>{name}</span>
}));

vi.mock('../lib/supabase/sync', () => ({
  isSupabaseAvailable: () => true
}));

vi.mock('../app/gameContext', () => ({
  useGame: () => ({
    resumeWithJoinCode: mockResumeWithJoinCode,
    removeActiveTeam: mockRemoveActiveTeam,
    activeTeam: null,
    progress: null,
    syncStatus: 'saved',
    syncMessage: 'Alles opgeslagen'
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import { TeamPage } from './TeamPage';
import { gamePack } from '../game-data/moerasdraak/game';

describe('TeamPage', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeEach(() => {
    container.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.render(null);
    });
    container.innerHTML = '';
  });

  it('only renders team-code join flow when there is no active team', () => {
    act(() => {
      root.render(<TeamPage pack={gamePack} />);
    });

    expect(container.textContent).toContain('Voer jullie teamcode in');
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('#team-code')).not.toBeNull();
    expect(container.querySelector('form')?.querySelector('button[type="submit"]')).not.toBeNull();
    expect(container.textContent).not.toContain('teamnaam');
    expect(container.textContent).not.toContain('Nieuw team');
  });
});
