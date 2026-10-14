import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../app/gameContext';
import { useAudio } from '../features/audio/audioContext';
import { henkReminderAudio } from '../features/audio/henkReminderAudio';
import { canStartFinale, visibleBonusLocations } from '../features/game/gameState';
import type { GamePack } from '../features/game/gameTypes';
import { loadSchubReminders, markSchubReminderShown, nextSchubReminder, observeSchubs, saveSchubReminders, type SchubReminder } from '../features/game/schubReminders';
import { HenkFlame } from './HintHenkIntro';

export function HenkSchubReminder({ pack }: { pack: GamePack }) {
  const { activeTeam, progress } = useGame();
  return activeTeam && progress && !progress.finalized
    ? <TeamSchubReminders key={activeTeam.id} teamId={activeTeam.id} pack={pack} /> : null;
}

function TeamSchubReminders({ teamId, pack }: { teamId: string; pack: GamePack }) {
  const { progress, deviceLocation, locationError } = useGame();
  const audio = useAudio();
  const location = useLocation();
  const navigate = useNavigate();
  const [memory] = useState(() => ({ current: loadSchubReminders(teamId) }));
  const [reminder, setReminder] = useState<SchubReminder | null>(null);
  const active = useRef<SchubReminder | null>(null);
  const latest = useRef({ progress, deviceLocation, locationError, audio, location });
  latest.current = { progress, deviceLocation, locationError, audio, location };

  useEffect(() => { active.current = null; setReminder(null); }, [location.key]);

  useEffect(() => {
    function check() {
      const { progress, deviceLocation, locationError, audio, location } = latest.current;
      if (!progress || progress.finalized) return;
      const now = Date.now();
      const missing = visibleBonusLocations(pack, progress).filter((b) => progress.stopProgress[b.id]?.state !== 'completed');
      const fix = locationError ? null : deviceLocation;
      const updated = observeSchubs(memory.current, missing, fix, now);
      if (updated !== memory.current) { memory.current = updated; saveSchubReminders(teamId, updated); }
      if (active.current) {
        const current = active.current;
        const relevant = current.kind === 'passed' ? missing.some((b) => b.id === current.bonusId)
          : current.bonusIds.every((id) => missing.some((b) => b.id === id));
        if (!relevant) { active.current = null; setReminder(null); }
        return;
      }
      // Automatic interruptions belong on the route, never inside a puzzle,
      // story, radio conversation or another dialog. Polling also retries when
      // these blockers disappear without a fresh GPS callback.
      if (document.hidden || !['/route', `/stop/${pack.finalStopId}`].includes(location.pathname)
        || audio.narration.playing || audio.effectPlaying
        || document.querySelector('dialog[open], [role="dialog"], .hint-henk__overlay')) return;
      const candidate = nextSchubReminder(memory.current, missing, canStartFinale(progress, pack).eligible, fix, now);
      if (!candidate || (candidate.kind === 'passed' && location.pathname !== '/route')) return;
      memory.current = markSchubReminderShown(memory.current, candidate, now);
      saveSchubReminders(teamId, memory.current);
      active.current = candidate;
      setReminder(candidate);
    }
    check();
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [memory, pack, teamId]);

  function close() { active.current = null; setReminder(null); }
  if (!reminder) return null;
  return <HenkSchubReminderDialog reminder={reminder} onClose={close} onMap={() => {
    close();
    navigate(reminder.kind === 'passed' ? `/route?schub=${encodeURIComponent(reminder.bonusId)}` : '/route?schubben=ontbrekend');
  }} onFinale={() => { close(); navigate(`/stop/${pack.finalStopId}`); }} />;
}

export function HenkSchubReminderDialog({ reminder, onClose, onMap, onFinale }: {
  reminder: SchubReminder; onClose: () => void; onMap: () => void; onFinale: () => void;
}) {
  const audio = useAudio();
  const latestAudio = useRef(audio);
  latestAudio.current = audio;
  const dialog = useRef<HTMLDialogElement>(null);
  const clip = henkReminderAudio(reminder.kind === 'finale' ? reminder.bonusIds.length : undefined);

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    if (latestAudio.current.soundEnabled) {
      latestAudio.current.stopNarration();
      latestAudio.current.toggleNarration(clip.source);
    }
    return () => {
      if (latestAudio.current.narration.source === clip.source) latestAudio.current.stopNarration();
      if (element?.open) element.close();
      returnFocus?.focus();
    };
  }, [clip.source]);

  return <dialog ref={dialog} className="henk-hint henk-hint--reminder" aria-labelledby="henk-schub-title" onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <button className="hint-henk__close" type="button" aria-label="Herinnering van Henk sluiten" onClick={onClose}>×</button>
    <div className="henk-hint__character"><HenkFlame speaking={audio.narration.source === clip.source && audio.narration.playing} /><h2 id="henk-schub-title">Hint Henk</h2></div>
    <div className="henk-hint__bubble"><p>{clip.transcript}</p></div>
    <div className="henk-hint__audio">
      <button className="text-link" type="button" onClick={() => { audio.stopNarration(); audio.toggleNarration(clip.source); }}>Opnieuw beluisteren</button>
      <button className="text-link" type="button" onClick={() => {
        audio.toggleSound();
        if (!audio.soundEnabled) { audio.stopNarration(); audio.toggleNarration(clip.source); }
      }}>{audio.soundEnabled ? 'Geluid uit' : 'Geluid aan'}</button>
    </div>
    {audio.narration.source === clip.source && audio.narration.error ? <p role="status">{audio.narration.error} Je kunt Henks bericht hierboven lezen.</p> : null}
    <button className="button primary" type="button" onClick={onMap}>{reminder.kind === 'passed' ? 'Laat zien op de kaart' : 'Bekijk ontbrekende schubben'}</button>
    <button className="button ghost" type="button" onClick={reminder.kind === 'passed' ? onClose : onFinale}>{reminder.kind === 'passed' ? 'We lopen door, Henk' : 'Door naar de finale'}</button>
    <p className="center small">Schubben zijn optioneel. Deze herinnering kost geen punten.</p>
  </dialog>;
}
