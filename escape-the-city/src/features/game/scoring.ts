import type { GamePack } from './gameTypes';

export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function calculateStopScore(pack: GamePack, hintsUsed: number, wrongAttempts: number) {
  const hintPenalty = pack.scoring.hintPenalty.slice(0, hintsUsed).reduce((sum, value) => sum + value, 0);
  const wrongPenalty = wrongAttempts * pack.scoring.wrongAnswerPenalty;
  return Math.max(pack.scoring.minimumPerStop, pack.scoring.basePoints - hintPenalty - wrongPenalty);
}

export function calculateTotalScore(pack: GamePack, progress: { hintsUsed: number; wrongAttempts: number }[]) {
  return progress.reduce((sum, item) => sum + calculateStopScore(pack, item.hintsUsed, item.wrongAttempts), 0);
}

export function calculateBonusScore(input: {
  maximumPoints: number;
  attempts: number;
  hintsUsed: number;
}) {
  const attemptFactor = input.attempts <= 1 ? 1 : input.attempts === 2 ? 0.75 : 0.5;
  const hintFactor = input.hintsUsed > 0 ? 0.5 : 1;
  return Math.max(50, Math.round(input.maximumPoints * Math.min(attemptFactor, hintFactor)));
}
