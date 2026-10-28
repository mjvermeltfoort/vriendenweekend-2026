import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../../app/gameContext';
import { useAudio } from '../audio/audioContext';
import { HenkFlame } from '../../components/HintHenkIntro';
import { PageShell } from '../../components/GameUi';
import { gamePack } from '../../game-data/moerasdraak/game';
import { getTeamSpacing, countdown, type SpacingStatus } from './api';
import { spacingSchub } from './suggestion';

export const SPACING_TRANSCRIPT = 'Ho even, speurneuzen! Jullie zitten een ander team op de hielen. Geef ze wat voorsprong. Zelfs een Moerasdraak houdt van persoonlijke ruimte! Misschien ligt er nog een verborgen schub in de buurt. Ik zou even op de kaart kijken!';
const clip = `${import.meta.env.BASE_URL}audio/henk/spacing.mp3`;

export function TeamSpacing({ children }: { children: ReactNode }) {
  const { activeTeam, teamSessionId, progress, teamLocation, syncNow } = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const audio = useAudio();
  const [status, setStatus] = useState<SpacingStatus | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const offset = useRef(0);
  const dismissed = useRef(new Set<string>());
  const latest = useRef(audio);
  latest.current = audio;
  const generation = useRef(0);
  const currentStatus = useRef(status);
  currentStatus.current = status;

  useEffect(() => {
    const id = ++generation.current;
    let stopped = false;
    let pending = false;
    setStatus(null); setShown(null); dismissed.current.clear(); setError('');
    async function poll() {
      setOnline(navigator.onLine);
      if (pending || !teamSessionId || !navigator.onLine || document.hidden || progress?.finalized) return;
      pending = true;
      try {
        const next = await getTeamSpacing(teamSessionId);
        if (!stopped && generation.current === id) {
          offset.current = Date.parse(next.serverNow) - Date.now();
          setStatus(next);
        }
      } catch { if (!stopped && generation.current === id) setStatus(null); } // Advisory failures must never stall play.
      finally { pending = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    window.addEventListener('online', poll);
    window.addEventListener('offline', poll);
    document.addEventListener('visibilitychange', poll);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('online', poll); window.removeEventListener('offline', poll); document.removeEventListener('visibilitychange', poll); };
  }, [teamSessionId, activeTeam?.id, progress?.finalized]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now() + offset.current);
      const notice = currentStatus.current?.noticeId;
      if (!navigator.onLine || document.hidden || location.pathname !== '/route' || !notice || dismissed.current.has(notice)
        || latest.current.narration.playing || latest.current.effectPlaying
        || document.querySelector('dialog[open], [role="dialog"], .hint-henk__overlay')) return;
      setShown(notice);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  const visible = online && location.pathname === '/route' && shown && status?.noticeId === shown;
  useEffect(() => {
    if (!visible) return;
    const controller = latest.current;
    if (controller.soundEnabled) controller.toggleNarration(clip);
    return () => { if (latest.current.narration.source === clip) latest.current.stopNarration(); };
  }, [visible]);

  async function dismiss() {
    if (!shown) return;
    dismissed.current.add(shown); setShown(null);
    if (teamSessionId) { try { await getTeamSpacing(teamSessionId, false, shown); } catch { /* Local dismissal still applies. */ } }
  }
  const schedule = status?.schedule;
  const gate = online && schedule?.enabled && !schedule.departedAt && !progress?.finalized
    && /^\/(route|stop\/|challenge\/)/.test(location.pathname);
  const waiting = schedule ? Date.parse(schedule.scheduledAt) > now : false;
  const schub = progress ? spacingSchub(gamePack, progress, teamLocation && teamLocation.isCurrent ? teamLocation : null) : null;

  if (gate) return <PageShell title="Jullie vertrek" navigation={false}>
    <section className="card stack center">
      <h1>{waiting ? 'Nog even geduld, speurneuzen!' : 'Klaar voor jullie avontuur?'}</h1>
      <p>Team {activeTeam?.name}</p>
      <p>Jullie vertrekmoment: {new Date(schedule.scheduledAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
      <strong className="spacing-countdown" aria-label="Tijd tot vertrek">{countdown(schedule.scheduledAt, now)}</strong>
      <p>Zo krijgt ieder team de ruimte om zelf op onderzoek uit te gaan.</p>
      <button className="button primary" disabled={waiting || busy} onClick={() => {
        if (!teamSessionId) return;
        setBusy(true); setError('');
        const id = generation.current;
        void getTeamSpacing(teamSessionId, true).then(async next => {
          if (generation.current !== id) return;
          setStatus(next); await syncNow();
        }).catch(e => { if (generation.current === id) setError(e.message); })
          .finally(() => setBusy(false));
      }}>{waiting ? 'Wachten op vertrek' : busy ? 'Starten…' : 'Start jullie avontuur'}</button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  </PageShell>;

  return <>
    {children}
    {visible ? <aside className="spacing-henk card stack" role="region" aria-label="Bericht van Hint Henk" aria-live="polite">
      <button className="spacing-henk__close" aria-label="Bericht van Henk sluiten" onClick={() => void dismiss()}>×</button>
      <div className="spacing-henk__heading"><HenkFlame speaking={audio.narration.source === clip && audio.narration.playing} /><h2>Even ruimte geven!</h2></div>
      <p>{SPACING_TRANSCRIPT}</p>
      {schub ? <button className="button primary" onClick={() => { void dismiss(); navigate(`/route?schub=${encodeURIComponent(schub.id)}`); }}>Bekijk een schub in de buurt</button>
        : <p>Blijf even op een geschikte plek staan en geef het andere team wat voorsprong.</p>}
      <button className="text-link" onClick={() => { audio.stopNarration(); audio.toggleNarration(clip); }}>Opnieuw beluisteren</button>
      {audio.narration.source === clip && audio.narration.error ? <p role="status">Geluid kon niet worden afgespeeld. Lees Henks bericht hierboven.</p> : null}
      <button className="button ghost" onClick={() => void dismiss()}>Begrepen, Henk</button>
      <p className="small">Dit advies kost geen punten. Jullie kunnen verder spelen.</p>
    </aside> : null}
  </>;
}
