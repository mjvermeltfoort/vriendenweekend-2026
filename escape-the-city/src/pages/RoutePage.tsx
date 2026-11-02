import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { canStartFinale, isFinaleLocationRevealed, visibleBonusLocations } from '../features/game/gameState';
import { GameIcon, PageShell, ProgressBar, SyncStatus } from '../components/GameUi';
import { RouteMap } from '../features/map/RouteMap';
import { browserLocationProvider } from '../features/location/browserProvider';

const statusLabels = {
  locked: 'Vergrendeld',
  available: 'Beschikbaar',
  arrived: 'Locatie gevonden',
  started: 'Bezig',
  completed: 'Voltooid'
};

export function RoutePage({ pack }: { pack: GamePack }) {
  const { activeTeam, progress, syncStatus, syncMessage, deviceLocation, locationError, activeSessionCount } = useGame();
  const [search] = useSearchParams();
  const view = search.get('weergave') === 'lijst' ? 'list' : 'route';
  const focusedLocationId = search.get('schub') ?? undefined;
  const showMissing = search.get('schubben') === 'ontbrekend';
  const missingRef = useRef<HTMLElement>(null);
  const finale = progress ? canStartFinale(progress, pack) : { eligible: false, missingCount: pack.stops.length - 1, missingTitles: [] as string[] };
  const finaleLocationRevealed = progress ? isFinaleLocationRevealed(progress, pack) : false;
  const completed = pack.stops.filter((stop) => progress?.stopProgress?.[stop.id]?.state === 'completed').length;
  const visibleBonuses = visibleBonusLocations(pack, progress);
  const missingBonuses = visibleBonuses.filter((b) => progress?.stopProgress[b.id]?.state !== 'completed');
  const visibleStops = finaleLocationRevealed ? pack.stops : pack.stops.filter((stop) => !stop.isFinal);

  useEffect(() => {
    if (showMissing) missingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [focusedLocationId, showMissing]);

  const finaleCard = (
    <section className="card stack route-finale" aria-label="Finale">
      <div className="row">
        <span className="route-marker"><GameIcon name="star" size={20} /></span>
        <div>
          <p className="eyebrow">Finale</p>
          <h2>{finaleLocationRevealed ? 'Bossche Brouwers' : 'Verborgen eindlocatie'}</h2>
        </div>
      </div>
      <p>{progress?.finalized
        ? 'Alle zeven herinneringen zijn hersteld.'
        : finaleLocationRevealed
          ? 'Zes herinneringen zijn hersteld'
          : `Nog ${finale.missingCount} opdrachten te voltooien voordat de eindlocatie wordt onthuld.`}</p>
      {progress?.finalized
        ? <Link className="button secondary" to="/resultaat">Bekijk resultaat</Link>
        : finale.eligible
          ? <Link className="button primary" to="/stop/bossche-brouwers">Naar finale</Link>
          : <span className="button" aria-disabled="true">Eindlocatie verborgen</span>}
    </section>
  );

  return (
    <PageShell title="Route" backTo="/" className="route-page">
      <h1 className="visually-hidden">Route</h1>
      <div id="route-content">
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
            locationProvider={browserLocationProvider}
            deviceLocation={deviceLocation}
            locationError={locationError}
            focusedLocationId={focusedLocationId}
          />
        )}
      </div>

      <section className="route-progress" aria-label="Voortgang">
        <ProgressBar value={completed} max={pack.stops.length} label="Herinneringen hersteld" />
      </section>

      {showMissing ? <section ref={missingRef} className="card stack" aria-label="Ontbrekende schubben">
        <h2>Ontbrekende schubben ({missingBonuses.length})</h2>
        <p>Deze schubben zijn optioneel. Kies een schub om die op de kaart te bekijken.</p>
        {missingBonuses.map((bonus) => <Link key={bonus.id} className="button secondary" to={`/route?schub=${encodeURIComponent(bonus.id)}`}>{bonus.reward.resultLabel}</Link>)}
        {!missingBonuses.length ? <p>Jullie hebben alle beschikbare schubben gevonden!</p> : null}
      </section> : null}

      {finaleLocationRevealed || progress?.finalized ? finaleCard : null}

      <details className="route-details route-more-info">
        <summary>Meer informatie</summary>
        <div className="stack">
          {visibleBonuses.length > 0 ? (
            <section className="stack" aria-label="Verborgen schubben">
              <p>In de stad liggen zes verborgen Drakenschubben. Ze zijn optioneel en leveren extra punten op.</p>
              <Link className="button secondary" to="/route?schubben=ontbrekend">Bekijk de verborgen schubben</Link>
            </section>
          ) : null}
          {!finaleLocationRevealed && !progress?.finalized ? finaleCard : null}
        </div>
      </details>

      <footer className="route-summary route-team-status" aria-label="Teamstatus">
        <span>{activeTeam?.name ?? 'Geen actief team'}</span>
        <SyncStatus status={syncStatus} message={syncMessage} />
        {activeSessionCount > 0 ? <span className="muted small">{activeSessionCount} speler{activeSessionCount === 1 ? '' : 's'} actief</span> : null}
      </footer>
    </PageShell>
  );
}

