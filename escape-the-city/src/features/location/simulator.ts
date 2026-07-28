import type { LocationProvider } from './provider';

export interface SimulatorState {
  latitude: number;
  longitude: number;
  accuracy: number;
  mode: 'exact' | 'outside' | 'denied' | 'timeout' | 'unavailable';
}

export const defaultSimulatorState: SimulatorState = {
  latitude: 51.690,
  longitude: 5.304,
  accuracy: 25,
  mode: 'exact'
};

export function createSimulatorProvider(getState: () => SimulatorState): LocationProvider {
  return {
    async getCurrentPosition() {
      const state = getState();
      if (state.mode === 'denied') return { kind: 'permission-denied', message: 'Locatie toestemming geweigerd.' };
      if (state.mode === 'timeout') return { kind: 'timeout', message: 'Locatie duurde te lang.' };
      if (state.mode === 'unavailable') return { kind: 'unavailable', message: 'Locatie niet beschikbaar.' };
      const adjust = state.mode === 'outside' ? 0.01 : 0;
      return { latitude: state.latitude + adjust, longitude: state.longitude + adjust, accuracy: state.accuracy };
    }
  };
}
