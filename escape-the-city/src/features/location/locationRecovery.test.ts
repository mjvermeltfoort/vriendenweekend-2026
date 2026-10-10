import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GPS_RECOVERY_RETRY_MS, watchLocationWithRecovery } from './locationRecovery';
import type { LocationOutcome, LocationProvider } from './provider';

describe('watchLocationWithRecovery', () => {
  let watcher: ((outcome: LocationOutcome) => void) | null = null;
  const stopWatcher = vi.fn();
  const onOutcome = vi.fn();
  const getCurrentPosition = vi.fn<LocationProvider['getCurrentPosition']>();

  beforeEach(() => {
    vi.useFakeTimers();
    watcher = null;
    stopWatcher.mockClear();
    onOutcome.mockClear();
    getCurrentPosition.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start() {
    const provider: LocationProvider = {
      getCurrentPosition,
      watchPosition: (callback) => {
        watcher = callback;
        return stopWatcher;
      }
    };
    return watchLocationWithRecovery(provider, onOutcome);
  }

  it('gets a fresh, less strict fix after timeout without creating another watch', async () => {
    const stop = start();
    getCurrentPosition.mockResolvedValue({
      latitude: 51.69, longitude: 5.3, accuracy: 35, capturedAt: new Date().toISOString()
    });

    watcher!({ kind: 'timeout', message: 'Locatie duurde te lang.' });
    expect(onOutcome).toHaveBeenCalledWith({ kind: 'timeout', message: 'Locatie duurde te lang.' });
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS);
    expect(getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: false, maximumAge: 30_000, timeout: 12_000
    });
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ latitude: 51.69 }));
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS * 3);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    stop();
    expect(stopWatcher).toHaveBeenCalledTimes(1);
  });

  it('continues recovering after a failed retry and stops after permission denial', async () => {
    const stop = start();
    getCurrentPosition.mockResolvedValue({ kind: 'timeout', message: 'Locatie duurde te lang.' });
    watcher!({ kind: 'unavailable', message: 'GPS niet beschikbaar.' });
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS * 2);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);

    watcher!({ kind: 'permission-denied', message: 'Geen locatietoegang.' });
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS * 2);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    stop();
  });

  it('cancels pending recoveries when the session stops or a watch fix arrives', async () => {
    const stop = start();
    watcher!({ kind: 'timeout', message: 'Locatie duurde te lang.' });
    watcher!({ latitude: 51.69, longitude: 5.3, accuracy: 12, capturedAt: new Date().toISOString() });
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS * 2);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    stop();
    watcher!({ kind: 'timeout', message: 'Locatie duurde te lang.' });
    await vi.advanceTimersByTimeAsync(GPS_RECOVERY_RETRY_MS * 2);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
