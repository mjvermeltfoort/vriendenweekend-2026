import { ensureAnonymousSession, supabase } from './client';
import type { GameProgress, SyncQueueItem, TeamRecord } from '../../features/game/gameState';
import { createInitialProgress } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';

export function isSupabaseAvailable() {
  return Boolean(supabase);
}

export async function joinTeamByCode(joinCode: string) {
  if (!supabase) throw new Error('Cloudherstel is niet beschikbaar.');
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('join_city_game_team', { join_code: joinCode });
  if (error) throw error;
  const response = data as { team: TeamRecord; progress?: Record<string, unknown> };
  const progress = createInitialProgress(response.team.id, gamePack);
  if (response.progress) {
    for (const [stopId, value] of Object.entries(response.progress)) {
      progress.stopProgress[stopId] = { ...progress.stopProgress[stopId], ...(value as object) };
    }
  }
  return { team: response.team, progress };
}

export async function syncQueueItem(item: SyncQueueItem, team: TeamRecord, progress: GameProgress) {
  if (!supabase) return { synced: false as const, message: 'Supabase niet geconfigureerd' };
  await ensureAnonymousSession();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? team.id;
  const payload = { ...item.payload, event_id: item.id, team_id: item.teamId, game_slug: team.gameSlug, stop_id: item.stopId ?? null, occurred_at: item.occurredAt };
  const { error } = await supabase.from('city_game_events').insert({
    event_id: item.id,
    team_id: item.teamId,
    game_slug: team.gameSlug,
    stop_id: item.stopId ?? null,
    event_type: item.eventType,
    event_data: payload,
    occurred_at: item.occurredAt
  });
  if (error) throw error;
  await supabase.from('city_game_teams').upsert({
    id: team.id,
    game_slug: team.gameSlug,
    game_version: team.gameVersion,
    name: team.name,
    join_code: team.joinCode,
    owner_user_id: userId,
    status: progress.finalized ? 'completed' : 'active',
    score: progress.totalScore,
    started_at: progress.finalized ? progress.finalResult?.createdAt ?? null : null,
    completed_at: progress.finalized ? progress.finalResult?.createdAt ?? null : null,
    metadata: { memberNames: team.memberNames }
  });
  return { synced: true as const };
}
