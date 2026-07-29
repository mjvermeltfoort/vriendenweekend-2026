import type { LocationOutcome, LocationProvider } from './provider';

function toOutcome(position: GeolocationPosition): LocationOutcome {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
    capturedAt: new Date(position.timestamp).toISOString()
  };
}

function toError(error: GeolocationPositionError): LocationOutcome {
  if (error.code === error.PERMISSION_DENIED) return { kind: 'permission-denied', message: 'Locatie toestemming geweigerd.' };
  if (error.code === error.TIMEOUT) return { kind: 'timeout', message: 'Locatie duurde te lang.' };
  return { kind: 'unavailable', message: 'Locatie niet beschikbaar.' };
}

export const browserLocationProvider: LocationProvider = {
  getCurrentPosition(options?: PositionOptions) {
    return new Promise<LocationOutcome>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ kind: 'unavailable', message: 'Locatie is niet beschikbaar.' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(toOutcome(position)),
        (error) => resolve(toError(error)),
        options
      );
    });
  },
  watchPosition(onResult, options) {
    if (!navigator.geolocation) {
      onResult({ kind: 'unavailable', message: 'Locatie is niet beschikbaar.' });
      return () => undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (position) => onResult(toOutcome(position)),
      (error) => onResult(toError(error)),
      options
    );
    return () => navigator.geolocation.clearWatch(id);
  }
};
