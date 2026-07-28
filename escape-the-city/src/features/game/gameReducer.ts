import type { GamePack } from './gameTypes';

export type ProgressState = {
  currentStopId: string;
  completedStops: string[];
  wrongAttempts: number;
  hintsUsed: number;
};

export function canAdvance(state: ProgressState, pack: GamePack) {
  const currentIndex = pack.stops.findIndex((stop) => stop.id === state.currentStopId);
  return currentIndex >= 0 && state.completedStops.length >= currentIndex;
}
