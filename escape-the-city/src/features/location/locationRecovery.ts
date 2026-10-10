import type { LocationOutcome, LocationProvider } from './provider';

export const GPS_RECOVERY_RETRY_MS = 8_000;

// Houd één hoge-nauwkeurigheids-watch actief. Als Chrome een time-out meldt,
// probeer dan tijdelijk een minder strenge GPS-meting zonder een tweede watch.
export function watchLocationWithRecovery(
  provider: LocationProvider,
  onOutcome: (outcome: LocationOutcome) => void
): () => void {
  let disposed = false;
  let needsRecovery = false;
  let recoveryRunning = false;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRecoveryTimer = () => {
    if (recoveryTimer !== null) {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  };

  const scheduleRecovery = () => {
    if (disposed || !needsRecovery || recoveryRunning || recoveryTimer !== null) return;
    recoveryTimer = window.setTimeout(() => {
      recoveryTimer = null;
      void recover();
    }, GPS_RECOVERY_RETRY_MS);
  };

  const receive = (outcome: LocationOutcome) => {
    if (disposed) return;
    onOutcome(outcome);
    if ('kind' in outcome) {
      needsRecovery = outcome.kind !== 'permission-denied';
      if (!needsRecovery) clearRecoveryTimer();
      else scheduleRecovery();
    } else {
      needsRecovery = false;
      clearRecoveryTimer();
    }
  };

  const recover = async () => {
    if (disposed || recoveryRunning || !needsRecovery) return;
    recoveryRunning = true;
    try {
      // Met hoge nauwkeurigheid kan Android blijven wachten op een satellietfix;
      // sta bij een herstelpoging ook een recente, grovere telefoonpositie toe.
      const outcome = await provider.getCurrentPosition({
        enableHighAccuracy: false,
        maximumAge: 30_000,
        timeout: 12_000
      });
      receive(outcome);
    } catch {
      receive({ kind: 'unavailable', message: 'GPS tijdelijk niet beschikbaar.' });
    } finally {
      recoveryRunning = false;
      scheduleRecovery();
    }
  };

  const stopWatching = provider.watchPosition?.(receive, {
    enableHighAccuracy: true,
    maximumAge: 3_000,
    timeout: 15_000
  });

  if (!stopWatching) {
    needsRecovery = true;
    void recover();
  }

  const onVisibilityChange = () => {
    if (document.hidden || !needsRecovery || recoveryRunning) return;
    clearRecoveryTimer();
    void recover();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    disposed = true;
    clearRecoveryTimer();
    stopWatching?.();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
