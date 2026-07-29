import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DashboardDialog } from './DashboardApp';
import { accuracyFeatures, teamMarkerFeatures } from './mapData';
import { dashboardReducer, initialDashboardState } from './store';
import {
  activeParticipants,
  dashboardSummary,
  normalizeDashboardSnapshot,
  sortDashboardTeams,
  teamHealth,
  type DashboardTeam
} from './types';

const now = Date.parse('2026-07-29T12:00:00Z');

function team(overrides: Partial<DashboardTeam> = {}): DashboardTeam {
  return {
    id: crypto.randomUUID(),
    name: 'Team Draak',
    code: 'ABC234',
    status: 'active',
    score: 0,
    currentStopIndex: 1,
    currentStopId: 'drakenfontein',
    currentStepId: 'available',
    nextStopId: 'zoete-lieve-gerritje',
    progressVersion: 1,
    createdAt: '2026-07-29T10:00:00Z',
    updatedAt: '2026-07-29T11:59:55Z',
    stopProgress: [],
    activeGame: null,
    location: {
      latitude: 51.690506,
      longitude: 5.296208,
      accuracyM: 12,
      capturedAt: '2026-07-29T11:59:55Z',
      selectedAt: '2026-07-29T11:59:56Z',
      sourceSessionId: 'session-1'
    },
    participants: [{
      sessionId: 'session-1',
      joinedAt: '2026-07-29T11:00:00Z',
      lastSeenAt: '2026-07-29T11:59:50Z',
      deviceLabel: 'iPhone/iPad',
      browserLabel: 'Safari',
      locationAccuracyM: 12,
      isLocationSource: true
    }],
    ...overrides
  };
}

describe('dashboard data model', () => {
  it('normalizes a snapshot and rejects unsafe team codes', () => {
    const input = team();
    expect(normalizeDashboardSnapshot({
      generatedAt: '2026-07-29T12:00:00Z',
      serverNow: '2026-07-29T12:00:00Z',
      teams: [input]
    }).teams[0].name).toBe('Team Draak');
    expect(() => normalizeDashboardSnapshot({
      teams: [{ ...input, code: 'O01III' }]
    })).toThrow('Onvolledige teamgegevens');
  });

  it('derives health, sorting and summary from the local clock', () => {
    const healthy = team({ id: 'healthy', name: 'Zulu' });
    const inaccurate = team({
      id: 'inaccurate',
      name: 'Alpha',
      location: { ...team().location!, accuracyM: 80 }
    });
    const offline = team({
      id: 'offline',
      name: 'Beta',
      participants: [{ ...team().participants[0], lastSeenAt: '2026-07-29T11:58:00Z' }]
    });
    const completed = team({ id: 'completed', name: 'Aard', status: 'completed' });
    expect(sortDashboardTeams([completed, offline, inaccurate, healthy], now).map((item) => item.id))
      .toEqual(['healthy', 'inaccurate', 'offline', 'completed']);
    expect(teamHealth(inaccurate, now)).toBe('location-problem');
    expect(activeParticipants(offline, now)).toHaveLength(0);
    expect(dashboardSummary([healthy, inaccurate, offline, completed], now)).toEqual({
      teams: 4,
      activeTeams: 3,
      participants: 3,
      locationProblems: 1
    });
  });

  it('replaces exactly one team and preserves selection', () => {
    const first = team({ id: 'one' });
    const second = team({ id: 'two', name: 'Team Twee' });
    const initialized = dashboardReducer(initialDashboardState, { type: 'snapshot', teams: [first, second] });
    const replaced = dashboardReducer(initialized, {
      type: 'replace-team',
      team: { ...second, name: 'Team Gewijzigd' }
    });
    expect(replaced.teams.map((item) => item.name)).toEqual(['Team Draak', 'Team Gewijzigd']);
    expect(replaced.selectedTeamId).toBe('one');
    expect(dashboardReducer(replaced, { type: 'select', teamId: 'two' }).selectedTeamId).toBe('two');
  });

  it('creates marker and meter-correct capped accuracy GeoJSON', () => {
    const extreme = team({ location: { ...team().location!, accuracyM: 640 } });
    const markers = teamMarkerFeatures([extreme], extreme.id, now);
    const circles = accuracyFeatures([extreme], extreme.id, now);
    expect(markers.features[0].geometry.coordinates).toEqual([5.296208, 51.690506]);
    expect(circles.features[0].properties?.actualAccuracyM).toBe(640);
    expect(circles.features[0].properties?.visualAccuracyM).toBe(250);
    expect(circles.features[0].geometry.coordinates[0]).toHaveLength(65);
  });
});

describe('dashboard confirmations', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    act(() => root.unmount());
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('names the team in reset confirmation and submits explicitly', () => {
    const onSubmit = vi.fn();
    const selected = team({ name: 'Team Drakenvuur' });
    act(() => root.render(
      <DashboardDialog
        state={{ kind: 'reset', team: selected }}
        busy={false}
        error=""
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    ));
    expect(container.textContent).toContain('volledige voortgang van Team Drakenvuur');
    act(() => container.querySelector<HTMLFormElement>('form')?.requestSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('warns that rotating invalidates the old code', () => {
    act(() => root.render(
      <DashboardDialog
        state={{ kind: 'rotate', team: team() }}
        busy={false}
        error=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('De oude code werkt hierna niet meer');
  });
});
