export interface AnswerAttemptResult {
  correct: boolean;
  message: string;
  retryAvailableAt?: string;
  penaltyPoints?: number;
  serverTimeOffsetMs?: number;
}

export function answerRetrySeconds(retryAvailableAt?: string, serverTimeOffsetMs = 0, now = Date.now()) {
  const deadline = Date.parse(retryAvailableAt ?? '');
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now - serverTimeOffsetMs) / 1000)) : 0;
}

export function formatAnswerWait(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
