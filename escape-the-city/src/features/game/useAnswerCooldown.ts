import { useEffect, useState } from 'react';
import { answerRetrySeconds } from './answerCooldown';

export function useAnswerCooldown(retryAvailableAt?: string, offset = 0) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!answerRetrySeconds(retryAvailableAt, offset)) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (!answerRetrySeconds(retryAvailableAt, offset)) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [retryAvailableAt, offset]);
  return answerRetrySeconds(retryAvailableAt, offset, now);
}
