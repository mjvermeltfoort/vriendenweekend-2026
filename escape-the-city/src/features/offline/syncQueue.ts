export interface SyncAction {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export function dedupeActions(actions: SyncAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}
