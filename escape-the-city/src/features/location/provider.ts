export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LocationErrorKind = 'permission-denied' | 'timeout' | 'unavailable';

export interface LocationErrorResult {
  kind: LocationErrorKind;
  message: string;
}

export type LocationOutcome = LocationResult | LocationErrorResult;

export interface LocationProvider {
  getCurrentPosition(options?: PositionOptions): Promise<LocationOutcome>;
}
