import { ensureAnonymousSession, supabase } from './client';
import type { GameProgress, SyncQueueItem, TeamRecord } from '../../features/game/gameState';
import { createInitialProgress } from '../../features/game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';

export function isSupabaseAvailable() {
  return Boolean(supabase);
}

function readableRpcError(error: { message: string; code?: string }) {
  if (error.code === 'PGRST202' || /could not find.*function/i.test(error.message)) {
    return new Error('Cloudherstel is nog niet ingericht. Voer Supabase-migratie 016 uit.');
  }
  if (/team not found/i.test(error.message)) {
    return new Error('Geen team gevonden met deze code.');
  }
  if (/authentication required/i.test(error.message)) {
    return new Error('Anoniem aanmelden bij Supabase is mislukt.');
  }
  return new Error(error.message);
}

export async function joinTeamByCode(joinCode: string) {
  if (!supabase) throw new Error('Cloudherstel is niet beschikbaar.');
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('join_city_game_team', { join_code: joinCode });
  if (error) throw readableRpcError(error);
  const response = data as { team?: TeamRecord; progress?: Partial<GameProgress> };
  if (!response?.team?.id || !response.team.joinCode) {
    throw new Error('Teamcode gaf geen geldig team terug.');
  }
  const progress = mergeRemoteProgress(response.team, response.progress);
  return { team: response.team, progress };
}

export function mergeRemoteProgress(team: TeamRecord, remote?: Partial<GameProgress>) {
  const initial = createInitialProgress(team.id, gamePack);
  const stopProgress = { ...initial.stopProgress };
  for (const [stopId, value] of Object.entries(remote?.stopProgress ?? {})) {
    if (stopProgress[stopId] && value) {
      stopProgress[stopId] = { ...stopProgress[stopId], ...value };
    }
  }
  return {
    ...initial,
    ...remote,
    teamId: team.id,
    gameSlug: team.gameSlug,
    gameVersion: team.gameVersion,
    stopProgress
  };
}

export function buildSyncRpcPayload(item: SyncQueueItem, team: TeamRecord, progress: GameProgress) {
  return {
    p_team: {
      id: team.id,
      gameSlug: team.gameSlug,
      gameVersion: team.gameVersion,
      name: team.name,
      joinCode: team.joinCode,
      memberNames: team.memberNames,
      privacyAccepted: team.privacyAccepted,
      createdAt: team.createdAt,
      status: progress.finalized ? 'completed' : 'active',
      completedAt: progress.finalized ? progress.finalResult?.createdAt ?? null : null
    },
    p_progress: progress,
    p_event: {
      id: item.id,
      eventType: item.eventType,
      stopId: item.stopId ?? null,
      payload: item.payload,
      occurredAt: item.occurredAt
    }
  };
}

export async function syncQueueItem(item: SyncQueueItem, team: TeamRecord, progress: GameProgress) {
  if (!supabase) return { synced: false as const, message: 'Supabase niet geconfigureerd' };
  await ensureAnonymousSession();
  const { error } = await supabase.rpc('sync_city_game_state', buildSyncRpcPayload(item, team, progress));
  if (error) throw readableRpcError(error);
  return { synced: true as const };
}
