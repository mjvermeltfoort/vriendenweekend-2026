import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardTeam } from './types';

const mocks = vi.hoisted(() => ({
  spacingRpc: vi.fn()
}));

vi.mock('../features/spacing/api', () => ({
  spacingRpc: mocks.spacingRpc
}));

import { SpacingPanel } from './SpacingPanel';

const team = { id: 'team-1', name: 'Team Draak', status: 'active', stopProgress: [] } as unknown as DashboardTeam;
const schedule = {
  teamId: 'team-1',
  eventName: 'Vriendenweekend',
  eventId: 'event-1',
  enabled: true,
  scheduledAt: '2026-12-31T14:00:00.000Z',
  departedAt: null,
  aheadTeamId: null,
  gapM: null,
  closeSince: null
};

describe('SpacingPanel', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.spacingRpc.mockResolvedValue([schedule]);
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('starts collapsed and opens through its summary', async () => {
    await act(async () => root.render(<SpacingPanel teams={[team]} />));

    const details = container.querySelector<HTMLDetailsElement>('details');
    const summary = container.querySelector<HTMLElement>('summary');
    expect(details?.open).toBe(false);
    expect(summary?.textContent).toContain('Teamspreiding');

    act(() => summary?.click());
    expect(details?.open).toBe(true);
  });

  it('marks both date-time pickers as Dutch', async () => {
    await act(async () => root.render(<SpacingPanel teams={[team]} />));

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    expect(inputs).toHaveLength(2);
    expect([...inputs].map((input) => input.lang)).toEqual(['nl-NL', 'nl-NL']);
  });
});
