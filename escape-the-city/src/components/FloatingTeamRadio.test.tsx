import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseGame = vi.fn();

vi.mock('../app/gameContext', () => ({
  useGame: () => mockUseGame()
}));

vi.mock('./TeamRadioPanel', () => ({
  TeamRadioPanel: () => <div>Radio-inhoud</div>
}));

import { FloatingTeamRadio } from './FloatingTeamRadio';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('FloatingTeamRadio', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container.innerHTML = '';
    mockUseGame.mockReturnValue({ activeTeam: { id: 'team-1' } });
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('uses the provided Meldkamer icon and closes from the close button', () => {
    act(() => root.render(<FloatingTeamRadio />));

    const openButton = container.querySelector<HTMLButtonElement>('[aria-label="Meldkamer openen"]');
    const icon = openButton?.querySelector('img');
    expect(icon?.getAttribute('src')).toContain('assets/icons/meldkamer-audio-64.png');
    expect(openButton?.querySelector('source')?.getAttribute('srcset')).toContain('assets/icons/meldkamer-audio-64.webp');
    expect(icon?.getAttribute('alt')).toBe('');
    act(() => openButton?.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    const closeButton = container.querySelector<HTMLButtonElement>('[aria-label="Meldkamer sluiten"]');
    act(() => closeButton?.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
