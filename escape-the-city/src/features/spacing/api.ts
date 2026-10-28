import { ensureAnonymousSession, supabase } from '../../lib/supabase/client';

export interface SpacingSchedule {
  eventId: string;
  enabled: boolean;
  scheduledAt: string;
  departedAt: string | null;
}
export interface SpacingStatus {
  serverNow: string;
  schedule: SpacingSchedule | null;
  noticeId: string | null;
}
export interface DashboardSpacing extends SpacingSchedule {
  teamId: string;
  eventName: string;
  aheadTeamId: string | null;
  gapM: number | null;
  closeSince: string | null;
}
export async function spacingRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Teamsynchronisatie is niet beschikbaar.');
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message.includes('TEAM_ALREADY_STARTED')
    ? 'Een van deze teams is al gestart. Kies alleen teams die nog moeten vertrekken.'
    : error.message.includes('START_NOT_RELEASED') ? 'Jullie vertrekmoment is nog niet aangebroken.'
    : 'De spreiding kon niet worden bijgewerkt. Probeer het opnieuw.');
  return data as T;
}
export function getTeamSpacing(sessionId: string, depart = false, acknowledge: string | null = null) {
  return spacingRpc<SpacingStatus>('get_team_spacing', { p_session_id: sessionId, p_depart: depart, p_acknowledge: acknowledge });
}
export function countdown(scheduledAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(scheduledAt) - now) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
