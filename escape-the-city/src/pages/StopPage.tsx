import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { canAccessChallenge, canStartFinale, canViewResult, hasLocationUnlock, isBonusVisible, isFinaleLocationRevealed, locationById, nextStop, stopById } from '../features/game/gameState';
import { isBonusLocation } from '../features/game/gameTypes';
import { createSimulatorProvider, defaultSimulatorState, type SimulatorState } from '../features/location/simulator';
import { GameIcon, PageShell } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';
import { ActiveStopIndicator } from '../features/location/ActiveStopIndicator';
import {
  observationFallbackAvailable,
  observationFallbackDelayMs
} from '../features/location/observationFallback';
import { haversineDistanceMeters } from '../features/location/distance';
import { formattedWalkingDistance } from '../features/location/routeDistance';

export function StopPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { stopId } = useParams();
  const {
    progress,
    startStop,
    teamLocation,
    deviceLocation,
    activeGameRun,
    locationError,
    currentObservation,
    observationStatus,
    submitObservation,
    selectBackupObservation,
    selectBonus,
    submitBonusObservation,
    submitSimulatedLocation
  } = useGame();
  const stop = stopId ? locationById(pack, stopId) : null;
  const [gpsMessage, setGpsMessage] = useState('');
  const [fallbackReady, setFallbackReady] = useState(false);
  const [fallbackNow, setFallbackNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState('');
  const [observationBusy, setObservationBusy] = useState(false);
  const [devState, setDevState] = useState<SimulatorState>(defaultSimulatorState);
  const fallbackStartedAtRef = useRef(Date.now());
  const selectedBonusRef = useRef('');
  const selectingBonusRef = useRef('');
  const hiddenFinale = Boolean(stop?.isFinal && (!progress || !isFinaleLocationRevealed(progress, pack)));
  const bonusVisible = !stop || !isBonusLocation(stop) || isBonusVisible(progress, stop);

  useEffect(() => {
    if (stop && isBonusLocation(stop) && bonusVisible && selectedBonusRef.current !== stop.id && selectingBonusRef.current !== stop.id) {
      selectingBonusRef.current = stop.id;
      void selectBonus(stop.id)
        .then(() => { selectedBonusRef.current = stop.id; })
        .catch((error) => setGpsMessage(error instanceof Error ? error.message : 'De bonuslocatie kon niet worden geselecteerd.'))
        .finally(() => { selectingBonusRef.current = ''; });
    }
  }, [bonusVisible, stop?.id, selectBonus]);
  const outsideStopRadius = Boolean(
    stop
    && teamLocation?.isCurrent
    && Number.isFinite(teamLocation.latitude)
    && Number.isFinite(teamLocation.longitude)
    && Number.isFinite(stop.coordinates.latitude)
    && Number.isFinite(stop.coordinates.longitude)
    && haversineDistanceMeters(
      { latitude: teamLocation.latitude, longitude: teamLocation.longitude },
      {
        latitude: stop.coordinates.latitude!,
        longitude: stop.coordinates.longitude!
      }
    ) > stop.coordinates.radiusMeters
  );
  const fallbackDelayMs = stop
    ? observationFallbackDelayMs({
      errorKind: locationError?.kind,
      location: teamLocation,
      outsideStopRadius
    })
    : null;

  useEffect(() => {
    if (stop) document.title = hiddenFinale ? 'Finale vergrendeld' : stop.title;
  }, [hiddenFinale, stop]);

  useEffect(() => {
    setFallbackReady(false);
    if (!stop || progress?.stopProgress[stop.id]?.state !== 'available') {
      fallbackStartedAtRef.current = Date.now();
      return;
    }
    if (fallbackDelayMs === null) {
      fallbackStartedAtRef.current = Date.now();
      return;
    }
    const update = () => setFallbackReady(observationFallbackAvailable({
      now: Date.now(),
      waitingSince: fallbackStartedAtRef.current,
      errorKind: locationError?.kind,
      location: teamLocation,
      outsideStopRadius
    }));
    update();
    const elapsed = Date.now() - fallbackStartedAtRef.current;
    const timer = window.setTimeout(update, Math.max(0, fallbackDelayMs - elapsed));
    return () => window.clearTimeout(timer);
  }, [
    fallbackDelayMs,
    locationError?.kind,
    progress?.stopProgress[stop?.id ?? '']?.state,
    stop?.id,
    teamLocation?.accuracyM,
    teamLocation?.isCurrent,
    outsideStopRadius
  ]);

  useEffect(() => {
    if (!stop || progress?.stopProgress[stop.id]?.state !== 'available' || fallbackReady || fallbackDelayMs === null || fallbackDelayMs === 0) {
      return;
    }
    setFallbackNow(Date.now());
    const timer = window.setInterval(() => setFallbackNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [
    fallbackDelayMs,
    fallbackReady,
    progress?.stopProgress[stop?.id ?? '']?.state,
    stop?.id
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
  if (!bonusVisible) {
    return <PageShell title="Verborgen schub" backTo="/route"><section className="card stack center"><GameIcon name="lock" size={32} /><h1>Deze schub is nog verborgen</h1><p>Bereik eerst de volgende hoofdlocatie om dit spoor te onthullen.</p></section></PageShell>;
  }

  const currentStop = stop;
  const stopState = progress?.stopProgress[currentStop.id]?.state ?? 'locked';
  const canPlay = progress ? hasLocationUnlock(progress, currentStop.id) : false;
  const isCompleted = stopState === 'completed';
  const bonusQuestionAvailable = Boolean(
    isBonusLocation(currentStop)
    && teamLocation?.isCurrent
    && teamLocation.accuracyM <= currentStop.coordinates.maximumAccuracyMeters
    && haversineDistanceMeters(
      { latitude: teamLocation.latitude, longitude: teamLocation.longitude },
      { latitude: currentStop.coordinates.latitude!, longitude: currentStop.coordinates.longitude! }
    ) <= currentStop.coordinates.discoveryRadiusMeters
  );
  // De gedeelde teamlocatie is afhankelijk van server-sync en kan ontbreken of verouderen.
  // Voor het tonen van afstanden gebruiken we eerst de actuele GPS van dit toestel.
  // Toegang tot de bonusopdracht blijft apart via de bestaande teamverificatie verlopen.
  const deviceFixAgeMs = deviceLocation?.capturedAt
    ? Date.now() - Date.parse(deviceLocation.capturedAt)
    : Number.POSITIVE_INFINITY;
  const deviceFixIsCurrent = Boolean(
    deviceLocation
    && Number.isFinite(deviceLocation.latitude)
    && Number.isFinite(deviceLocation.longitude)
    && Number.isFinite(deviceFixAgeMs)
    && deviceFixAgeMs >= 0
    && deviceFixAgeMs <= 60_000
  );
  const teamFixIsCurrent = Boolean(
    teamLocation?.isCurrent
    && Number.isFinite(teamLocation.latitude)
    && Number.isFinite(teamLocation.longitude)
  );
  const bonusPosition = deviceFixIsCurrent ? deviceLocation : teamFixIsCurrent ? teamLocation : null;
  const mainStopPosition = deviceFixIsCurrent ? deviceLocation : teamFixIsCurrent && teamLocation
    ? {
      latitude: teamLocation.latitude,
      longitude: teamLocation.longitude,
      accuracy: teamLocation.accuracyM,
      capturedAt: teamLocation.capturedAt
    }
    : null;
  const bonusDistance = isBonusLocation(currentStop) && bonusPosition
    ? haversineDistanceMeters(
      { latitude: bonusPosition.latitude, longitude: bonusPosition.longitude },
      { latitude: currentStop.coordinates.latitude!, longitude: currentStop.coordinates.longitude! }
    )
    : null;
  const bonusDistanceText = bonusDistance === null
    ? null
    : bonusDistance === 0
      ? canPlay
        ? 'Locatie gevonden – opdracht beschikbaar'
        : 'Je bent vlak bij de schub – locatie wordt gecontroleerd'
      : `Nog ongeveer ${formattedWalkingDistance(bonusDistance)} (hemelsbreed)`;
  const finaleEligibility = currentStop.isFinal && progress ? canStartFinale(progress, pack) : { eligible: true, missingCount: 0, missingTitles: [] as string[] };
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
  const followingStop = isBonusLocation(currentStop) ? null : nextStop(pack, currentStop.id);
  const currentStopIsActive = !isBonusLocation(currentStop) && progress?.currentStopId === currentStop.id;
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

  async function checkBonusObservation() {
    if (!isBonusLocation(currentStop) || !bonusQuestionAvailable || !answer.trim()) {
      setGpsMessage('Kom eerst dichter bij de schub om de vraag te beantwoorden.');
      return;
    }
    setObservationBusy(true);
    try {
      const result = await submitBonusObservation(currentStop.id, currentStop.manualVerification.questionId, answer);
      setGpsMessage(result.pending ? 'Je antwoord is bewaard en wordt gecontroleerd zodra er verbinding is.' : result.verified ? 'Locatie bereikt. De bonusopdracht is vrijgegeven.' : 'Dat antwoord klopt nog niet. Kijk nog eens goed.');
      setAnswer('');
    } catch (error) {
      setGpsMessage(error instanceof Error ? error.message : 'Het antwoord kon niet worden gecontroleerd.');
    } finally {
      setObservationBusy(false);
    }
  }

  const hasDest = Number.isFinite(currentStop.coordinates.latitude)
    && Number.isFinite(currentStop.coordinates.longitude);
  const hasOrigin = Boolean(
    teamLocation?.isCurrent
    && Number.isFinite(teamLocation.latitude)
    && Number.isFinite(teamLocation.longitude)
  );
  const originParam = hasOrigin ? `&origin=${teamLocation!.latitude},${teamLocation!.longitude}` : '';
  const mapsUrl = hasDest
    ? `https://www.google.com/maps/dir/?api=1&destination=${currentStop.coordinates.latitude},${currentStop.coordinates.longitude}${originParam}&travelmode=walking`
    : currentStop.navigation.externalMapsQuery
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentStop.navigation.externalMapsQuery)}${originParam}&travelmode=walking`
      : null;
  const observationFallbackVisible = fallbackReady || fallbackDelayMs === 0;
  const fallbackRemainingSeconds = fallbackDelayMs === null
    ? null
    : Math.max(0, Math.ceil((fallbackDelayMs - (fallbackNow - fallbackStartedAtRef.current)) / 1000));
  const fallbackStatus = fallbackRemainingSeconds && fallbackRemainingSeconds > 0
    ? `Verificatievragen verschijnen over ${fallbackRemainingSeconds} seconden.`
    : 'Verificatievragen verschijnen bijna.';

  const showVerificationQuestions = ((!isBonusLocation(currentStop) && !canPlay && !isCompleted && observationFallbackVisible && Boolean(currentObservation))
    || (isBonusLocation(currentStop) && !canPlay && !isCompleted && bonusQuestionAvailable));

  const gameCompleted = progress ? canViewResult(progress, pack) : false;
  const showParchment = !gameCompleted && !isCompleted && (progress ? (hasLocationUnlock(progress, currentStop.id) || canAccessChallenge(progress, currentStop.id)) : false);
  const showStopDetails = !isCompleted;
  const completedRouteHref = followingStop ? '/route' : '/resultaat';
  const completedRouteLabel = followingStop ? 'Bekijk volgende routepunt op kaart' : 'Bekijk resultaat';

  return (
    <PageShell title={isCompleted ? (isBonusLocation(currentStop) ? 'Drakenschub' : 'Herinnering') : 'Verhaal'} backTo="/route">
      {showParchment ? (
        <section className="parchment-card stack">
          <p className="eyebrow">{isBonusLocation(currentStop) ? 'Verborgen vondst' : `Opdracht ${currentStop.order} van ${pack.stops.length}`}</p>
          {!isCompleted ? <p className="parchment-instruction small">Volgende stap: gebruik de aanwijzing hieronder en open daarna pas de opdracht.</p> : null}
          <h1>{currentStop.intro.title}</h1>
          {currentStop.intro.audioSrc ? (
            <>
              <p>{currentStop.intro.text}</p>
              <AudioPlayer
                source={currentStop.intro.audioSrc}
                title="Luister naar het verhaal"
                transcript={currentStop.intro.transcript ?? currentStop.intro.text}
              />
            </>
          ) : (
            <p>{currentStop.intro.transcript ?? currentStop.intro.text}</p>
          )}
        </section>
      ) : null}

      {showStopDetails ? (
      <section className="card card--compact stack stack--compact" style={{ marginTop: '0.5rem' }}>
        <p className="eyebrow">Vind de locatie</p>
        <h2>{currentStop.title}</h2>
        <p className="muted">{currentStop.navigation.clue}</p>
        <p className="muted small">{currentStop.locationName}</p>

        {isBonusLocation(currentStop) ? (
          <section className="active-stop-indicator" aria-label="Afstand tot verborgen schub">
            <p className="eyebrow">Afstand tot schub</p>
            {bonusDistance === null ? (
              <p role="status">{locationError?.kind === 'permission-denied'
                ? 'Geef Chrome locatietoegang om de afstand te zien.'
                : locationError?.message ?? 'Afstand bepalen… GPS-locatie zoeken.'}</p>
            ) : (
              <>
                <p className="active-stop-indicator__distance">{bonusDistanceText}</p>
                <p className="muted small">{deviceFixIsCurrent
                  ? 'Hemelsbrede afstand vanaf jouw actuele GPS-positie.'
                  : 'Hemelsbrede afstand vanaf de actuele teampositie.'}</p>
              </>
            )}
          </section>
        ) : currentStopIsActive ? (
          <ActiveStopIndicator
            pack={pack}
            progress={progress}
            location={mainStopPosition}
            locationError={locationError}
            showOpenButton
            onOpenChallenge={() => {
              void startStop(currentStop.id).then((started) => {
                if (started) navigate(`/challenge/${currentStop.id}`);
              }).catch((error) => {
                setGpsMessage(error instanceof Error ? error.message : 'De opdracht kon niet worden gestart.');
              });
            }}
          />
        ) : null}

        {gpsMessage || (!isBonusLocation(currentStop) && !currentStopIsActive && !canPlay && locationError) ? (
          <div className="location-status" role="status" aria-live="polite">
            <GameIcon name={canPlay ? 'check' : 'location'} />
            <p>{gpsMessage || (!canPlay ? locationError?.message : '')}</p>
          </div>
        ) : null}

        {!isCompleted ? (
          <>
            {mapsUrl ? <a className="button secondary" href={mapsUrl} target="_blank" rel="noreferrer">Open in kaart</a> : null}
          </>
        ) : null}
      </section>
      ) : null}

      {!isBonusLocation(currentStop) && !canPlay && !isCompleted && fallbackDelayMs !== null ? (
        <section className="observation-fallback stack" aria-label="Locatie bevestigen zonder GPS">
          <h3>Locatie bevestigen zonder GPS</h3>
          <p>{!observationFallbackVisible ? fallbackStatus : currentObservation ? currentObservation.question : observationStatus === 'validation_required' ? 'De vragen voor deze plek worden nog fysiek gecontroleerd. Vraag de organisatie om deze stop vrij te geven.' : 'Vraag de organisatie om deze stop vrij te geven.'}</p>
          {observationFallbackVisible && currentObservation ? (
            <>
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
          ) : null}
        </section>
      ) : null}

      {isBonusLocation(currentStop) && !canPlay && !isCompleted ? (
        bonusQuestionAvailable ? (
          <section className="observation-fallback stack" aria-label="Bonuslocatie handmatig bevestigen">
            <h3>Locatie bevestigen zonder GPS</h3>
            <p>{currentStop.manualVerification.question}</p>
            <label className="field"><span>Jullie antwoord</span><input value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" /></label>
            <button className="button primary" type="button" disabled={observationBusy || !answer.trim()} onClick={() => void checkBonusObservation()}>{observationBusy ? 'Controleren…' : 'Antwoord controleren'}</button>
          </section>
        ) : bonusDistance !== null ? (
          <section className="location-status" aria-live="polite">
            <GameIcon name="location" />
            <p>Kom dichter bij de schub. De verificatievraag verschijnt zodra jullie in de buurt zijn.</p>
          </section>
        ) : null
      ) : null}

      {showStopDetails && isDev ? (
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
            {isBonusLocation(currentStop) ? (
              <>
                <h2>Drakenschub gevonden</h2>
                <p><strong>{currentStop.reward.resultLabel}</strong><br />{currentStop.revealedDescription}</p>
                <Link className="button secondary" to="/route">Terug naar hoofdroute</Link>
              </>
            ) : (
              <>
                <h2>Herinnering hersteld</h2>
                <p><strong>{currentStop.reward.title}</strong><br />{currentStop.reward.text}</p>
                {currentStop.challenge.kind === 'choice' ? (
                  <p className="muted small">{currentStop.challenge.correctFeedback}</p>
                ) : null}
                <Link className="button secondary" to={completedRouteHref}>{completedRouteLabel}</Link>
              </>
            )}
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
            {!currentStopIsActive || !canPlay ? (
              <button
                className="button primary"
                disabled={!canPlay || !finaleEligibility.eligible || Boolean(otherActiveGame)}
                onClick={() => void startStop(currentStop.id).then((started) => {
                  if (started) navigate(`/challenge/${currentStop.id}`);
                }).catch((error) => setGpsMessage(error instanceof Error ? error.message : 'De opdracht kon niet worden gestart.'))}
              >
                Opdracht openen
              </button>
            ) : null}
        </>
      )}

      {currentStop.isFinal && !finaleEligibility.eligible ? <p className="error">Nog {finaleEligibility.missingCount} opdrachten te voltooien.</p> : null}
    </PageShell>
  );
}


