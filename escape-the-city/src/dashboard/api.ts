import type { RealtimeChannel } from '@supabase/supabase-js';
import { ensureAnonymousSession, supabase } from '../lib/supabase/client';
import { normalizeDashboardSnapshot, normalizeDashboardTeam, type DashboardSnapshot, type DashboardTeam } from './types';

export class DashboardApiError extends Error {
  constructor(message: string, readonly code = 'DASHBOARD_ERROR') {
    super(message);
  }
}

function requireClient() {
  if (!supabase) throw new DashboardApiError('Supabase is niet geconfigureerd.', 'NOT_CONFIGURED');
  return supabase;
}

export function dashboardClientId() {
  const key = 'moerasdraak-dashboard-client-id';
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export async function initializeDashboard() {
  await ensureAnonymousSession();
  return getDashboardSnapshot();
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const client = requireClient();
  const { data, error } = await client.rpc('get_dashboard_snapshot');
  if (error) throw new DashboardApiError(error.message, error.code);
  return normalizeDashboardSnapshot(data);
}

async function mutate(functionName: string, parameters: Record<string, unknown>): Promise<DashboardTeam> {
  const client = requireClient();
  const { data, error } = await client.rpc(functionName, {
    ...parameters,
    p_client_id: dashboardClientId()
  });
  if (error) throw new DashboardApiError(error.message, error.code);
  return normalizeDashboardTeam(data);
}

export const dashboardActions = {
  createTeam: (name: string, code?: string) => mutate('dashboard_create_team', {
    p_name: name,
    p_join_code: code?.trim() || null
  }),
  renameTeam: (teamId: string, name: string) => mutate('dashboard_update_team_name', {
    p_team_id: teamId,
    p_name: name
  }),
  rotateCode: (teamId: string) => mutate('dashboard_rotate_team_code', { p_team_id: teamId }),
  setStatus: (teamId: string, status: 'active' | 'disabled') => mutate(
    'dashboard_set_team_status',
    { p_team_id: teamId, p_status: status }
  ),
  resetProgress: (teamId: string) => mutate('dashboard_reset_team_progress', { p_team_id: teamId }),
  abandonGame: (teamId: string) => mutate('dashboard_abandon_active_game', { p_team_id: teamId }),
  revokeSession: (teamId: string, sessionId: string) => mutate(
    'dashboard_revoke_team_session',
    { p_team_id: teamId, p_session_id: sessionId }
  )
};

export type RealtimeStatus = 'connected' | 'disconnected';

export function subscribeToDashboard(
  onTeam: (team: DashboardTeam) => void,
  onStatus: (status: RealtimeStatus) => void
) {
  const client = requireClient();
  let channel: RealtimeChannel | null = client
    .channel('moerasdraak-public-dashboard')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dashboard_team_projection' },
      (event) => {
        const record = event.new as { payload?: unknown };
        if (record?.payload) onTeam(normalizeDashboardTeam(record.payload));
      }
    )
    .subscribe((status) => {
      onStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
    });

  return () => {
    if (!channel) return;
    const current = channel;
    channel = null;
    void client.removeChannel(current);
  };
}
