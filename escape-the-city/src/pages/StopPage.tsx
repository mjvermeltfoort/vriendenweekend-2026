import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { canStartFinale, hasLocationUnlock, isFinaleLocationRevealed, nextStop, stopById } from '../features/game/gameState';
import { browserLocationProvider } from '../features/location/browserProvider';
import { createSimulatorProvider, defaultSimulatorState, type SimulatorState } from '../features/location/simulator';
import { checkGeofence } from '../features/location/geolocation';
import { GameIcon, PageShell } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';

export function StopPage({ pack }: { pack: GamePack }) {
  const navigate = useNavigate();
  const { stopId } = useParams();
  const { progress, unlockStop, startStop, teamLocation, activeGameRun } = useGame();
  const stop = stopId ? stopById(pack, stopId) : null;
  const [gpsMessage, setGpsMessage] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [devState, setDevState] = useState<SimulatorState>(defaultSimulatorState);
  const provider = useMemo(() => (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true') ? createSimulatorProvider(() => devState) : browserLocationProvider, [devState]);
  const hiddenFinale = Boolean(stop?.isFinal && (!progress || !isFinaleLocationRevealed(progress, pack)));

  useEffect(() => {
    if (stop) document.title = hiddenFinale ? 'Finale vergrendeld' : stop.title;
  }, [hiddenFinale, stop]);

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

  async function checkGps() {
    setGpsBusy(true);
    setGpsMessage('Je locatie wordt bepaald…');
    try {
      const result = isDev
        ? await provider.getCurrentPosition({ timeout: 8000, enableHighAccuracy: true })
        : teamLocation?.isCurrent
          ? {
              latitude: teamLocation.latitude,
              longitude: teamLocation.longitude,
              accuracy: teamLocation.accuracyM,
              capturedAt: teamLocation.capturedAt
            }
          : { kind: 'unavailable' as const, message: 'We ontvangen momenteel geen actuele locatie van het team.' };
      if ('kind' in result) {
        setGpsMessage(result.message);
        return;
      }
      const target = currentStop.coordinates.latitude !== null && currentStop.coordinates.longitude !== null
        ? {
            latitude: currentStop.coordinates.latitude,
            longitude: currentStop.coordinates.longitude,
            radiusMeters: currentStop.coordinates.radiusMeters,
            maximumAccuracyMeters: currentStop.coordinates.maximumAccuracyMeters
          }
        : null;
      if (!target) {
        setGpsMessage('Deze plek gebruikt handmatige locatiecontrole.');
        await unlockStop(currentStop.id, 'manual');
        return;
      }
      const check = checkGeofence(result, target);
      if (!check.accuracyOk) {
        setGpsMessage(`Je locatiesignaal is nog te onnauwkeurig (${Math.round(result.accuracy)} meter). Probeer het buiten opnieuw.`);
        return;
      }
      if (!check.withinRadius) {
        const roundedDistance = Math.round(check.distanceMeters);
        const distance = roundedDistance >= 1000
          ? `${(roundedDistance / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kilometer`
          : `${roundedDistance} meter`;
        setGpsMessage(`Je bent nog ongeveer ${distance} van deze plek verwijderd.`);
        return;
      }
      setGpsMessage('Locatie gevonden. De opdracht is ontgrendeld.');
      await unlockStop(currentStop.id, 'gps');
    } finally {
      setGpsBusy(false);
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

        {gpsMessage ? (
          <div className="location-status" role="status" aria-live="polite">
            <GameIcon name={gpsMessage.startsWith('Locatie gevonden') ? 'check' : 'location'} />
            <p>{gpsMessage}</p>
          </div>
        ) : null}

        {!isCompleted ? (
          <>
            <button className="button primary" disabled={gpsBusy || isCompleted} onClick={() => void checkGps()}>
              <GameIcon name="location" size={18} /> {gpsBusy ? 'Locatie bepalen…' : 'GPS controleren'}
            </button>
            {mapsUrl ? <a className="button secondary" href={mapsUrl} target="_blank" rel="noreferrer">Open in kaart</a> : null}
            {isDev ? <button className="button ghost" onClick={() => void unlockStop(currentStop.id, 'manual')}>Handmatig controleren (development)</button> : null}
          </>
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
              Opdracht starten
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
