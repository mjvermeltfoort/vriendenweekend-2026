import { Link } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { useInstallPrompt } from '../features/pwa/useInstallPrompt';
import { AudioControl, GameIcon, SyncStatus } from '../components/GameUi';
import { useAudio } from '../features/audio/audioContext';

export function HomePage({ pack }: { pack: GamePack }) {
  const { teams, activeTeam, progress, syncStatus, syncMessage } = useGame();
  const install = useInstallPrompt();
  const { unlockAudio } = useAudio();
  const current = activeTeam && progress ? { team: activeTeam, progress } : null;
  const lastTeam = current ?? (teams[0] ? { team: teams[0], progress: null } : null);

  return (
    <main className="page shell home-page">
      <div className="page-content">
        <section className="home-hero">
          <AudioControl className="home-audio-control" />
          <div className="home-hero__visual">
            <img
              className="home-welcome-image"
              src={`${import.meta.env.BASE_URL}images/welkom-image.png`}
              alt=""
              fetchPriority="high"
              decoding="async"
            />
            <h1 className="visually-hidden">Het Geheim van de Moerasdraak — Den Bosch</h1>
          </div>
          <div className="home-hero__content">
            <p className="home-subtitle">Een escape the city-avontuur vol raadsels, geheimen en Bossche legendes.</p>
            <div className="home-actions">
              {lastTeam ? (
                <Link className="button primary" to="/voorbereiden" onClick={unlockAudio}>Verder met team {lastTeam.team.name}</Link>
              ) : (
                <Link className="button primary" to="/team" onClick={unlockAudio}>Begin avontuur</Link>
              )}
              {lastTeam ? <Link className="button secondary" to="/team">Nieuw team</Link> : null}
              <a className="text-link" href="#uitleg">Hoe werkt het?</a>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <SyncStatus status={syncStatus} message={syncMessage} />
            </div>
          </div>
        </section>

        <div className="home-details stack stack--large" id="uitleg">
          <section>
            <p className="eyebrow center">Jullie avontuur</p>
            <div className="fact-grid">
              <div className="fact"><GameIcon name="time" /><strong>2–2,5 uur</strong><span>speelduur</span></div>
              <div className="fact"><GameIcon name="compass" /><strong>{pack.estimatedDistanceKm} km</strong><span>door de stad</span></div>
              <div className="fact"><GameIcon name="scroll" /><strong>{pack.stops.length} opdrachten</strong><span>raadsels en verhalen</span></div>
              <div className="fact"><GameIcon name="dragon" /><strong>Samen spelen</strong><span>één team, één missie</span></div>
            </div>
          </section>

          <section className="card stack">
            <p className="eyebrow">De legende</p>
            <h2>Herstel zeven herinneringen</h2>
            <p>Reis door Den Bosch, vind bijzondere plekken en ontrafel het verhaal van de Moerasdraak. De eindlocatie wordt pas na alle opdrachten onthuld.</p>
            <Link className="button primary" to={lastTeam ? '/voorbereiden' : '/team'}>{lastTeam ? 'Verder spelen' : 'Team maken'}</Link>
          </section>

          {!install.isStandalone && !install.dismissed ? (
            <section className="card stack" aria-labelledby="install-title">
              <div className="row">
                <GameIcon name="dragon" size={32} />
                <div>
                  <h2 id="install-title">Installeer de Moerasdraak</h2>
                  <p className="muted small">Sneller openen en beter offline spelen.</p>
                </div>
              </div>
              {install.isiOS ? <p>Open het deelmenu en kies ‘Zet op beginscherm’.</p> : null}
              {!install.isiOS && install.event ? <button className="button primary" onClick={() => void install.prompt()}>Installeren</button> : null}
              <button className="button ghost" onClick={() => install.setDismissed(true)}>Later</button>
            </section>
          ) : null}

          {lastTeam ? (
            <section className="card stack">
              <p className="eyebrow">Laatst gebruikt</p>
              <h2>{lastTeam.team.name}</h2>
              <p className="muted small">Laatste activiteit: {new Date(lastTeam.team.lastActivityAt).toLocaleString('nl-NL')}</p>
              {lastTeam.progress ? <p>Voortgang: {lastTeam.progress.collectedRewards.length} van {pack.stops.length} herinneringen.</p> : null}
              <Link className="button secondary" to="/route">Bekijk route</Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
