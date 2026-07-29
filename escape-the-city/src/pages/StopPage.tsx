import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { canStartFinale, hasLocationUnlock, isFinaleLocationRevealed, nextStop, stopById } from '../features/game/gameState';
import { createSimulatorProvider, defaultSimulatorState, type SimulatorState } from '../features/location/simulator';
import { GameIcon, PageShell } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';
import { ActiveStopIndicator } from '../features/location/ActiveStopIndicator';
import {
  observationFallbackAvailable,
  OBSERVATION_FALLBACK_DELAY_MS
} from '../features/location/observationFallback';

export function StopPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { stopId } = useParams();
  const {
    progress,
    startStop,
    teamLocation,
    activeGameRun,
    locationError,
    currentObservation,
    observationStatus,
    submitObservation,
    selectBackupObservation,
    submitSimulatedLocation
  } = useGame();
  const stop = stopId ? stopById(pack, stopId) : null;
  const [gpsMessage, setGpsMessage] = useState('');
  const [fallbackReady, setFallbackReady] = useState(false);
  const [answer, setAnswer] = useState('');
  const [observationBusy, setObservationBusy] = useState(false);
  const [devState, setDevState] = useState<SimulatorState>(defaultSimulatorState);
  const fallbackStartedAtRef = useRef(Date.now());
  const hiddenFinale = Boolean(stop?.isFinal && (!progress || !isFinaleLocationRevealed(progress, pack)));

  useEffect(() => {
    if (stop) document.title = hiddenFinale ? 'Finale vergrendeld' : stop.title;
  }, [hiddenFinale, stop]);

  useEffect(() => {
    setFallbackReady(false);
    if (!stop || progress?.stopProgress[stop.id]?.state !== 'available') {
      fallbackStartedAtRef.current = Date.now();
      return;
    }
    if (teamLocation?.isCurrent && teamLocation.accuracyM <= 40) {
      fallbackStartedAtRef.current = Date.now();
      return;
    }
    const update = () => setFallbackReady(observationFallbackAvailable({
      now: Date.now(),
      waitingSince: fallbackStartedAtRef.current,
      errorKind: locationError?.kind,
      location: teamLocation
    }));
    update();
    const elapsed = Date.now() - fallbackStartedAtRef.current;
    const timer = window.setTimeout(update, Math.max(0, OBSERVATION_FALLBACK_DELAY_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [
    locationError?.kind,
    progress?.stopProgress[stop?.id ?? '']?.state,
    stop?.id,
    teamLocation?.accuracyM,
    teamLocation?.isCurrent
  ]);

  if (!stop) return <PageShell title="Verhaal" backTo="/route"><p>Stop niet gevonden.</p></PageShell>;
  if (hiddenFinale) {
    return (
      <PageShell title="Finale vergrendeld" backTo="/route">
        <section className="card stack center">
          <GameIcon name="lock" size={32} />
          <h1>Eindlocatie nog verborgen</h1>
          <p>Voltooi eerst alle eerdere opdrachten. Daarna verschijnt de finale automatisch op de route.</p>
        </section>
      </PageShell>
    );
  }

  const currentStop = stop;
  const stopState = progress?.stopProgress[currentStop.id]?.state ?? 'locked';
  const canPlay = progress ? hasLocationUnlock(progress, currentStop.id) : false;
  const isCompleted = stopState === 'completed';
  const finaleEligibility = currentStop.isFinal && progress ? canStartFinale(progress, pack) : { eligible: true, missingCount: 0, missingTitles: [] as string[] };
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
  const followingStop = nextStop(pack, currentStop.id);
  const otherActiveGame = activeGameRun?.status === 'active' && activeGameRun.gameId !== currentStop.id
    ? stopById(pack, activeGameRun.gameId)
    : null;

  async function sendSimulatedLocation() {
    const provider = createSimulatorProvider(() => devState);
    const result = await provider.getCurrentPosition();
    if ('kind' in result) {
      setGpsMessage(result.message);
      return;
    }
    try {
      await submitSimulatedLocation(result);
      setGpsMessage('Gesimuleerde GPS-meting is via de teamsynchronisatie verstuurd.');
    } catch (error) {
      setGpsMessage(error instanceof Error ? error.message : 'De GPS-meting kon niet worden verstuurd.');
    }
  }

  async function checkObservation() {
    if (!currentObservation || !answer.trim()) return;
    setObservationBusy(true);
    setGpsMessage('');
    try {
      const result = await submitObservation(
        currentStop.id,
        currentObservation.questionId,
        answer
      );
      if (result.pending) {
        setGpsMessage('Je antwoord is bewaard. Zodra er verbinding is, controleren we de locatie.');
      } else if (!result.verified) {
        setGpsMessage('Dat antwoord klopt nog niet. Kijk nog eens goed naar het detail.');
      } else {
        setGpsMessage('Locatie bereikt. De opdracht is vrijgegeven voor het hele team.');
      }
      setAnswer('');
    } catch (error) {
      setGpsMessage(error instanceof Error ? error.message : 'Het antwoord kon niet worden gecontroleerd.');
    } finally {
      setObservationBusy(false);
    }
  }

  const mapsUrl = currentStop.navigation.externalMapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentStop.navigation.externalMapsQuery)}`
    : null;

  return (
    <PageShell title={isCompleted ? 'Herinnering' : 'Verhaal'} backTo="/route">
      <section className="parchment-card stack">
        <p className="eyebrow">Opdracht {currentStop.order} van {pack.stops.length}</p>
        <h1>{currentStop.intro.title}</h1>
        <p>{currentStop.intro.text}</p>
        {currentStop.intro.audioSrc ? (
          <AudioPlayer
            source={currentStop.intro.audioSrc}
            title="Luister naar het verhaal"
            transcript={currentStop.intro.transcript ?? currentStop.intro.text}
          />
        ) : <p>{currentStop.intro.transcript ?? currentStop.intro.text}</p>}
      </section>

      <section className="card stack" style={{ marginTop: '1rem' }}>
        <p className="eyebrow">Vind de locatie</p>
        <h2>{currentStop.title}</h2>
        <p>{currentStop.navigation.clue}</p>
        <p className="muted small">{currentStop.locationName}</p>

        {progress?.currentStopId === currentStop.id
          ? <ActiveStopIndicator pack={pack} progress={progress} location={teamLocation} />
          : null}

        {gpsMessage || (!canPlay && locationError) ? (
          <div className="location-status" role="status" aria-live="polite">
            <GameIcon name={canPlay ? 'check' : 'location'} />
            <p>{gpsMessage || (!canPlay ? locationError?.message : '')}</p>
          </div>
        ) : null}

        {!isCompleted ? (
          <>
            {!canPlay ? <p className="muted">We controleren automatisch de beste actuele GPS van jullie team.</p> : null}
            {mapsUrl ? <a className="button secondary" href={mapsUrl} target="_blank" rel="noreferrer">Open in kaart</a> : null}
          </>
        ) : null}

        {!canPlay && fallbackReady ? (
          <section className="observation-fallback stack" aria-label="Locatie bevestigen zonder GPS">
            <h3>Locatie bevestigen zonder GPS</h3>
            {currentObservation ? (
              <>
                <p>{currentObservation.question}</p>
                <label className="field">
                  <span>Jullie antwoord</span>
                  <input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                {currentObservation.hint ? <p className="hint">Hint: {currentObservation.hint}</p> : null}
                <button
                  className="button primary"
                  type="button"
                  disabled={observationBusy || !answer.trim()}
                  onClick={() => void checkObservation()}
                >
                  {observationBusy ? 'Controleren…' : 'Antwoord controleren'}
                </button>
                {currentObservation.canSelectBackup ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void selectBackupObservation(currentStop.id).catch((error) => {
                      setGpsMessage(error instanceof Error ? error.message : 'De reservevraag kon niet worden geladen.');
                    })}
                  >
                    Detail niet zichtbaar
                  </button>
                ) : currentObservation.isBackup ? (
                  <p>Vraag de organisatie om deze stop vrij te geven als ook dit detail niet zichtbaar is.</p>
                ) : null}
              </>
            ) : (
              <p>
                {observationStatus === 'validation_required'
                  ? 'De vragen voor deze plek worden nog fysiek gecontroleerd. Vraag de organisatie om deze stop vrij te geven.'
                  : 'Vraag de organisatie om deze stop vrij te geven.'}
              </p>
            )}
          </section>
        ) : null}

        {isDev ? (
          <details>
            <summary>GPS-devsimulator</summary>
            <div className="stack">
              <label className="field"><span>Mode</span>
                <select value={devState.mode} onChange={(e) => setDevState((state) => ({ ...state, mode: e.target.value as SimulatorState['mode'] }))}>
                  <option value="exact">Exact</option>
                  <option value="outside">Buiten geofence</option>
                  <option value="denied">Toegang geweigerd</option>
                  <option value="timeout">Timeout</option>
                  <option value="unavailable">Niet beschikbaar</option>
                </select>
              </label>
              <label className="field"><span>Latitude</span><input value={devState.latitude} onChange={(e) => setDevState((state) => ({ ...state, latitude: Number(e.target.value) }))} /></label>
              <label className="field"><span>Longitude</span><input value={devState.longitude} onChange={(e) => setDevState((state) => ({ ...state, longitude: Number(e.target.value) }))} /></label>
              <label className="field"><span>Nauwkeurigheid</span><input value={devState.accuracy} onChange={(e) => setDevState((state) => ({ ...state, accuracy: Number(e.target.value) }))} /></label>
              <button className="button secondary" type="button" onClick={() => void sendSimulatedLocation()}>
                GPS-meting versturen
              </button>
            </div>
          </details>
        ) : null}

        {isCompleted ? (
          <div className="card card--success center">
            <span style={{ fontSize: '2rem' }}>{currentStop.reward.symbol}</span>
            <h2>Herinnering hersteld</h2>
            <p><strong>{currentStop.reward.title}</strong><br />{currentStop.reward.text}</p>
          </div>
        ) : (
          <>
            {otherActiveGame ? (
              <div className="location-status" role="status">
                <GameIcon name="team" />
                <p>Jullie team is al bezig met een andere opdracht. Rond die opdracht eerst af.</p>
                <button className="button secondary" onClick={() => navigate(`/challenge/${otherActiveGame.id}`)}>
                  Ga naar actieve opdracht
                </button>
              </div>
            ) : null}
            <button
              className="button primary"
              disabled={!canPlay || !finaleEligibility.eligible || Boolean(otherActiveGame)}
              onClick={() => void startStop(currentStop.id).then((started) => {
                if (started) navigate(`/challenge/${currentStop.id}`);
              }).catch((error) => setGpsMessage(error instanceof Error ? error.message : 'De opdracht kon niet worden gestart.'))}
            >
              Opdracht openen
            </button>
          </>
        )}

        {currentStop.isFinal && !finaleEligibility.eligible ? <p className="error">Nog {finaleEligibility.missingCount} opdrachten te voltooien.</p> : null}
        {isCompleted && followingStop ? <Link className="button secondary" to={`/stop/${followingStop.id}`}>Volgende routepunt</Link> : null}
        {isCompleted && !followingStop ? <Link className="button primary" to="/resultaat">Bekijk resultaat</Link> : null}
      </section>
    </PageShell>
  );
}
