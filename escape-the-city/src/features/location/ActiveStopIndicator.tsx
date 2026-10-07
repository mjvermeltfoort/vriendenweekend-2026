import { useEffect, useRef, useState } from 'react';
import { hasLocationUnlock, type GameProgress } from '../game/gameState';
import type { GamePack } from '../game/gameTypes';
import type { TeamLocation } from '../../lib/supabase/sync';
import {
  activeRouteLeg,
  filterWalkingDistance,
  formattedWalkingDistance,
  loadRouteGeoJson,
  remainingRouteDistance,
  routeLegLength,
  walkingStatus,
  type DistanceFilterState
} from './routeDistance';
import type { RouteGeoJson } from '../map/mapTypes';

export function ActiveStopIndicator({
  pack,
  progress,
  location,
  showOpenButton = false,
  onOpenChallenge
}: {
  pack: GamePack;
  progress: GameProgress | null;
  location: TeamLocation | null;
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
    if (!stop || !route || !location?.isCurrent || verified) return;
    const leg = activeRouteLeg(route, stop.id);
    if (!leg) return;
    filterRef.current = filterWalkingDistance(
      filterRef.current,
      remainingRouteDistance(leg, location)
    );
    setDisplayedDistance(filterRef.current.displayed);
  }, [location?.capturedAt, location?.isCurrent, route, stop, verified]);

  if (!stop || state === 'locked') return null;
  const leg = route ? activeRouteLeg(route, stop.id) : null;
  const totalDistance = leg ? routeLegLength(leg) : 0;
  const progressValue = displayedDistance === null || totalDistance === 0
    ? 0
    : Math.max(0, Math.min(100, (1 - displayedDistance / totalDistance) * 100));
  const gpsStatus = !location?.isCurrent
    ? 'Locatie zoeken…'
    : location.accuracyM <= 20
      ? 'Locatie nauwkeurig'
      : location.accuracyM <= 40
        ? 'Locatie redelijk'
        : 'Locatie nog onnauwkeurig';

  // Compacte presentatie: één hoofdregel met status/afstand en eventueel een subtitel
  let mainLine: string;
  let subLine: string | null = null;

  if (verified) {
    mainLine = 'Locatie bereikt';
  } else if (stop.id === pack.startStopId) {
    mainLine = `Startlocatie: ${stop.locationName}`;
    subLine = 'GPS wordt automatisch gecontroleerd.';
  } else if (displayedDistance !== null) {
    mainLine = `Nog ${formattedWalkingDistance(displayedDistance)}`;
    subLine = walkingStatus(displayedDistance);
  } else {
    mainLine = routeError ? 'Loopafstand tijdelijk niet beschikbaar.' : 'Loopafstand bepalen…';
  }

  return (
    <section className="active-stop-indicator" aria-label="Afstand tot actuele stop">
      <p className="eyebrow">Actuele stop</p>
      <h2>{stop.title}</h2>
      <div aria-live="polite">
        <p className={verified ? 'active-stop-indicator__status' : 'active-stop-indicator__distance'}>{mainLine}</p>
        {!verified && displayedDistance !== null ? (
          <progress max="100" value={progressValue} aria-label="Voortgang naar de stop" />
        ) : null}
        {subLine ? <p className="muted small">{subLine}</p> : null}
        {!verified ? <p className="muted small">{gpsStatus}</p> : null}
      </div>
      {verified && showOpenButton ? (
        <button className="button primary" type="button" onClick={onOpenChallenge}>
          Opdracht openen
        </button>
      ) : null}
    </section>
  );
}

