import { useEffect, useRef, useState } from 'react';
import { hasLocationUnlock, type GameProgress } from '../game/gameState';
import type { GamePack } from '../game/gameTypes';
import type { LocationErrorResult, LocationResult } from './provider';
import {
  activeRouteLeg,
  filterWalkingDistance,
  formattedWalkingDistance,
  loadRouteGeoJson,
  remainingRouteDistance,
  routeLegLength,
  stopDistanceMeters,
  walkingStatus,
  type DistanceFilterState
} from './routeDistance';
import type { RouteGeoJson } from '../map/mapTypes';

export function ActiveStopIndicator({
  pack,
  progress,
  location,
  locationError,
  showOpenButton = false,
  onOpenChallenge
}: {
  pack: GamePack;
  progress: GameProgress | null;
  location: LocationResult | null;
  locationError?: LocationErrorResult | null;
  showOpenButton?: boolean;
  onOpenChallenge?: () => void;
}) {
  const [route, setRoute] = useState<RouteGeoJson | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [displayedDistance, setDisplayedDistance] = useState<number | null>(null);
  const filterRef = useRef<DistanceFilterState>({ samples: [], displayed: null, increaseCount: 0 });
  const stop = pack.stops.find((item) => item.id === progress?.currentStopId) ?? null;
  const state = stop ? progress?.stopProgress[stop.id]?.state ?? 'locked' : 'locked';
  const verified = progress && stop ? hasLocationUnlock(progress, stop.id) : false;

  useEffect(() => {
    let cancelled = false;
    void loadRouteGeoJson(pack)
      .then((value) => { if (!cancelled) setRoute(value); })
      .catch(() => { if (!cancelled) setRouteError(true); });
    return () => { cancelled = true; };
  }, [pack]);

  useEffect(() => {
    filterRef.current = { samples: [], displayed: null, increaseCount: 0 };
    setDisplayedDistance(null);
  }, [stop?.id]);

  useEffect(() => {
    if (!stop || !location || verified) {
      filterRef.current = { samples: [], displayed: null, increaseCount: 0 };
      setDisplayedDistance(null);
      return;
    }
    const leg = route ? activeRouteLeg(route, stop.id) : null;
    const measurement = leg
      ? remainingRouteDistance(leg, location)
      : stop.id === pack.startStopId
        ? stopDistanceMeters(stop, location)
        : null;
    if (measurement === null) return;
    filterRef.current = filterWalkingDistance(
      filterRef.current,
      measurement
    );
    setDisplayedDistance(filterRef.current.displayed);
  }, [location?.capturedAt, location?.latitude, location?.longitude, pack.startStopId, route, stop, verified]);
  if (!stop || state === 'locked') return null;
  const leg = route ? activeRouteLeg(route, stop.id) : null;
  const totalDistance = leg ? routeLegLength(leg) : 0;
  const progressValue = displayedDistance === null || totalDistance === 0
    ? 0
    : Math.max(0, Math.min(100, (1 - displayedDistance / totalDistance) * 100));
  const gpsStatus = !location ? null
    : location.accuracy <= 20
      ? 'Locatie nauwkeurig'
      : location.accuracy <= 40
        ? 'Locatie redelijk'
        : 'Locatie nog onnauwkeurig';

  // Compacte presentatie: één hoofdregel met status/afstand en eventueel een subtitel
  let mainLine: string;
  let subLine: string | null = null;

  if (verified) {
    mainLine = 'Locatie bereikt';
  } else if (displayedDistance !== null) {
    const isStartStop = stop.id === pack.startStopId;
    mainLine = isStartStop
      ? `Nog ongeveer ${formattedWalkingDistance(displayedDistance)} hemelsbreed tot ${stop.title}`
      : `Nog ${formattedWalkingDistance(displayedDistance)}`;
    subLine = isStartStop
      ? 'Hemelsbrede afstand tot de eerste stop.'
      : walkingStatus(displayedDistance);
  } else {
    mainLine = !location
      ? locationError?.kind === 'timeout' || locationError?.kind === 'unavailable'
        ? 'GPS tijdelijk niet beschikbaar – er wordt opnieuw gezocht…'
        : locationError?.kind === 'permission-denied'
          ? 'Geef Chrome toestemming om je locatie te gebruiken.'
          : 'Locatie zoeken…'
      : routeError ? 'Loopafstand tijdelijk niet beschikbaar.' : 'Afstand bepalen…';
  }

  return (
    <section className="active-stop-indicator" aria-label="Afstand tot actuele stop">
      <p className="eyebrow">Afstand tot de locatie</p>
      <div aria-live="polite">
        <p className={verified ? 'active-stop-indicator__status' : 'active-stop-indicator__distance'}>{mainLine}</p>
        {!verified && displayedDistance !== null && totalDistance > 0 ? (
          <progress max="100" value={progressValue} aria-label="Voortgang naar de stop" />
        ) : null}
        {subLine ? <p className="muted small">{subLine}</p> : null}
        {!verified && gpsStatus ? <p className="muted small">{gpsStatus}</p> : null}
      </div>
      {verified && showOpenButton ? (
        <button className="button primary" type="button" onClick={onOpenChallenge}>
          Opdracht openen
        </button>
      ) : null}
    </section>
  );
}

