import type { DashboardTeam } from './types';

export interface DashboardState {
  teams: DashboardTeam[];
  selectedTeamId: string | null;
}

export type DashboardAction =
  | { type: 'snapshot'; teams: DashboardTeam[] }
  | { type: 'replace-team'; team: DashboardTeam }
  | { type: 'select'; teamId: string | null };

export const initialDashboardState: DashboardState = {
  teams: [],
  selectedTeamId: null
};

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  if (action.type === 'snapshot') {
    return {
      teams: action.teams,
      selectedTeamId: action.teams.some((team) => team.id === state.selectedTeamId)
        ? state.selectedTeamId
        : action.teams[0]?.id ?? null
    };
  }
  if (action.type === 'replace-team') {
    const exists = state.teams.some((team) => team.id === action.team.id);
    return {
      teams: exists
        ? state.teams.map((team) => team.id === action.team.id ? action.team : team)
        : [...state.teams, action.team],
      selectedTeamId: state.selectedTeamId ?? action.team.id
    };
  }
  return { ...state, selectedTeamId: action.teamId };
}
