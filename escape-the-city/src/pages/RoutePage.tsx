import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { canStartFinale, isFinaleLocationRevealed, visibleBonusLocations } from '../features/game/gameState';
import { GameIcon, PageShell, ProgressBar, SyncStatus } from '../components/GameUi';
import { RouteMap } from '../features/map/RouteMap';
import type { LocationProvider } from '../features/location/provider';

const statusLabels = {
  locked: 'Vergrendeld',
  available: 'Beschikbaar',
  arrived: 'Locatie gevonden',
  started: 'Bezig',
  completed: 'Voltooid'
};

export function RoutePage({ pack }: { pack: GamePack }) {
  const { activeTeam, progress, syncStatus, syncMessage, teamLocation, activeSessionCount } = useGame();
  const [view, setView] = useState<'list' | 'route'>('route');
  const [bonusIntroSeen, setBonusIntroSeen] = useState(true);
  const finale = progress ? canStartFinale(progress, pack) : { eligible: false, missingCount: pack.stops.length - 1, missingTitles: [] as string[] };
  const finaleLocationRevealed = progress ? isFinaleLocationRevealed(progress, pack) : false;
  const completed = pack.stops.filter((stop) => progress?.stopProgress?.[stop.id]?.state === 'completed').length;
  const visibleBonuses = visibleBonusLocations(pack, progress);
  const visibleStops = finaleLocationRevealed ? pack.stops : pack.stops.filter((stop) => !stop.isFinal);
  const teamLocationProvider = useMemo<LocationProvider>(() => ({
    async getCurrentPosition() {
      if (!teamLocation?.isCurrent) {
        return { kind: 'unavailable', message: 'Laatst bekende locatie — we wachten op een actuele teammeting.' };
      }
      return {
        latitude: teamLocation.latitude,
        longitude: teamLocation.longitude,
        accuracy: teamLocation.accuracyM,
        capturedAt: teamLocation.capturedAt
      };
    }
  }), [teamLocation]);
  const bonusIntroKey = activeTeam ? `moerasdraak-bonus-intro:${activeTeam.id}` : '';

  useEffect(() => {
    if (!bonusIntroKey) return;
    setBonusIntroSeen(localStorage.getItem(bonusIntroKey) === 'seen');
  }, [bonusIntroKey]);

  function dismissBonusIntro() {
    if (bonusIntroKey) localStorage.setItem(bonusIntroKey, 'seen');
    setBonusIntroSeen(true);
  }

  return (
    <PageShell title="Route" backTo="/">
      <div className="route-summary">
        <span>{activeTeam?.name ?? 'Geen actief team'}</span>
        <SyncStatus status={syncStatus} message={syncMessage} />
        {activeSessionCount > 0 ? <span className="muted small">{activeSessionCount} speler{activeSessionCount === 1 ? '' : 's'} actief</span> : null}
      </div>
      <div className="route-tabs" aria-label="Routeweergave">
        <button className={view === 'list' ? 'is-active' : ''} type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          <GameIcon name="location" size={16} /> Lijst
        </button>
        <button className={view === 'route' ? 'is-active' : ''} type="button" aria-pressed={view === 'route'} onClick={() => setView('route')}>
          <GameIcon name="map" size={16} /> Route
        </button>
      </div>
      <ProgressBar value={completed} max={pack.stops.length} label="Herinneringen hersteld" />

      {visibleBonuses.length > 0 && !bonusIntroSeen ? (
        <section className="card stack" aria-label="Introductie Verborgen Schubben">
          <p>Niet alle herinneringen liggen op de hoofdroute. In de stad zijn zes verborgen Drakenschubben achtergebleven. Ze zijn niet nodig om het avontuur te voltooien, maar oplettende teams kunnen er extra punten mee verdienen.</p>
          <button className="button primary" type="button" onClick={dismissBonusIntro}>BEKIJK DE VERBORGEN SCHUBBEN</button>
        </section>
      ) : null}

      {view === 'list' ? (
        <ol className="route-list route-list--spaced" aria-label="Routepunten">
          {visibleStops.map((stop) => {
            const state = progress?.stopProgress?.[stop.id]?.state ?? 'locked';
            const unlocked = state !== 'locked';
            const isCurrent = progress?.currentStopId === stop.id && state !== 'completed';
            const classes = [
              'route-stop',
              `route-stop--${state}`,
              isCurrent ? 'route-stop--current' : ''
            ].filter(Boolean).join(' ');
            return (
              <li key={stop.id} className={classes}>
                <span className="route-marker" aria-label={`Stop ${stop.order}, ${statusLabels[state]}`}>
                  {state === 'completed' ? <GameIcon name="check" size={20} /> : state === 'locked' ? <GameIcon name="lock" size={18} /> : stop.order}
                </span>
                <section className="card route-stop__card">
                  <span className="route-stop__meta">{stop.isFinal ? 'Finale' : `Opdracht ${stop.order}`} · {statusLabels[state]}</span>
                  <h2>{unlocked ? stop.title : `Verborgen stop ${stop.order}`}</h2>
                  <p className="muted">{unlocked ? stop.navigation.clue : 'Voltooi vorige opdracht om deze plek te onthullen.'}</p>
                  {unlocked ? <Link className={`button ${isCurrent ? 'primary' : 'secondary'}`} to={`/stop/${stop.id}`}>{isCurrent ? 'Ga naar deze stop' : 'Bekijk stop'}</Link> : null}
                </section>
              </li>
            );
          })}
        </ol>
      ) : (
        <RouteMap
          gamePack={pack}
          progress={progress}
          visibleStops={visibleStops}
          locationProvider={teamLocationProvider}
        />
      )}

      <section className="card stack">
        <div className="row">
          <span className="route-marker"><GameIcon name="star" size={20} /></span>
          <div>
            <p className="eyebrow">Finale</p>
            <h2>{finaleLocationRevealed ? 'Bossche Brouwers' : 'Verborgen eindlocatie'}</h2>
          </div>
        </div>
        <p>{finaleLocationRevealed ? 'Alle herinneringen zijn hersteld. De eindlocatie is onthuld.' : `Nog ${finale.missingCount} opdrachten te voltooien voordat de eindlocatie wordt onthuld.`}</p>
        {finale.eligible ? <Link className="button primary" to="/stop/bossche-brouwers">Naar finale</Link> : progress?.finalized ? <Link className="button secondary" to="/resultaat">Bekijk resultaat</Link> : <span className="button" aria-disabled="true">Eindlocatie verborgen</span>}
      </section>
    </PageShell>
  );
}
