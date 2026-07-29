export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt?: string;
}

export type LocationErrorKind = 'permission-denied' | 'timeout' | 'unavailable';

export interface LocationErrorResult {
  kind: LocationErrorKind;
  message: string;
}

export type LocationOutcome = LocationResult | LocationErrorResult;

export interface LocationProvider {
  getCurrentPosition(options?: PositionOptions): Promise<LocationOutcome>;
  watchPosition?(
    onResult: (result: LocationOutcome) => void,
    options?: PositionOptions
  ): () => void;
}
