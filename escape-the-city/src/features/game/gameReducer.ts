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

export function getProgressSummary(state: ProgressState, pack: GamePack) {
  const totalStops = pack.stops.length;
  const completedStops = state.completedStops.length;
  const remainingStops = Math.max(0, totalStops - completedStops);
  const currentIndex = pack.stops.findIndex((stop) => stop.id === state.currentStopId);
  const nextStop = currentIndex >= 0 ? pack.stops[currentIndex + 1] : undefined;

  return {
    totalStops,
    completedStops,
    remainingStops,
    currentStop: pack.stops.find((stop) => stop.id === state.currentStopId),
    nextStop,
    hintsUsed: state.hintsUsed,
    wrongAttempts: state.wrongAttempts,
  };
}

