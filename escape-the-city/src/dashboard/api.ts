import type { RealtimeChannel } from '@supabase/supabase-js';
import { ensureAnonymousSession, supabase } from '../lib/supabase/client';
import { getTeamRadioMessageUrl, type TeamRadioMessage } from '../lib/supabase/sync';
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
  ),
  releaseCurrentStop: (teamId: string, reason: string) => mutate(
    'dashboard_release_current_stop',
    { p_team_id: teamId, p_reason: reason }
  )
};

export interface DashboardRadioMessage extends TeamRadioMessage {
  audioUrl: string;
}

function radioExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export async function getDashboardTeamRadioMessages(teamId: string): Promise<DashboardRadioMessage[]> {
  const client = requireClient();
  await ensureAnonymousSession();
  const { data, error } = await client.rpc('dashboard_get_team_radio_messages', {
    p_team_id: teamId,
    p_limit: 50
  });
  if (error) throw new DashboardApiError(error.message, error.code);
  const messages = data && typeof data === 'object' && 'messages' in data
    ? (data as { messages?: TeamRadioMessage[] }).messages ?? []
    : [];
  return messages.map((message) => ({
    ...message,
    audioUrl: getTeamRadioMessageUrl(message.storagePath)
  }));
}

export async function sendDashboardTeamRadioMessage(teamId: string, audio: Blob, durationMs: number) {
  const client = requireClient();
  await ensureAnonymousSession();
  const mimeType = audio.type || 'audio/webm';
  const storagePath = `${teamId}/dashboard/${Date.now()}-${crypto.randomUUID()}.${radioExtension(mimeType)}`;
  const { error: uploadError } = await client.storage
    .from('team-radio-messages')
    .upload(storagePath, audio, {
      upsert: false,
      contentType: mimeType,
      cacheControl: '3600'
    });
  if (uploadError) throw new DashboardApiError(uploadError.message, uploadError.name || 'UPLOAD_FAILED');

  const { data, error } = await client.rpc('dashboard_send_team_radio_message', {
    p_team_id: teamId,
    p_storage_path: storagePath,
    p_mime_type: mimeType,
    p_duration_ms: durationMs,
    p_client_id: dashboardClientId()
  });
  if (error) throw new DashboardApiError(error.message, error.code);
  return data;
}

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

export function subscribeToDashboardRadio(teamId: string, onChange: () => void) {
  const client = requireClient();
  let channel: RealtimeChannel | null = client
    .channel(`moerasdraak-dashboard-radio:${teamId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'city_game', table: 'team_radio_messages', filter: `team_id=eq.${teamId}` },
      onChange
    )
    .subscribe();

  return () => {
    if (!channel) return;
    const current = channel;
    channel = null;
    void client.removeChannel(current);
  };
}

export interface DashboardRadioNotification {
  teamId: string;
}

export function subscribeToDashboardRadioNotifications(onMessage: (notification: DashboardRadioNotification) => void) {
  const client = requireClient();
  let channel: RealtimeChannel | null = client
    .channel('moerasdraak-dashboard-radio-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dashboard_radio_notifications' },
      (event) => {
        const record = event.new as { team_id?: unknown };
        if (typeof record.team_id === 'string') {
          onMessage({ teamId: record.team_id });
        }
      }
    )
    .subscribe();

  return () => {
    if (!channel) return;
    const current = channel;
    channel = null;
    void client.removeChannel(current);
  };
}
