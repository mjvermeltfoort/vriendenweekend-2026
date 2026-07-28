import type { LocationOutcome, LocationProvider } from './provider';

export const browserLocationProvider: LocationProvider = {
  getCurrentPosition(options?: PositionOptions) {
    return new Promise<LocationOutcome>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ kind: 'unavailable', message: 'Locatie is niet beschikbaar.' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) resolve({ kind: 'permission-denied', message: 'Locatie toestemming geweigerd.' });
          else if (error.code === error.TIMEOUT) resolve({ kind: 'timeout', message: 'Locatie duurde te lang.' });
          else resolve({ kind: 'unavailable', message: 'Locatie niet beschikbaar.' });
        },
        options
      );
    });
  }
};
