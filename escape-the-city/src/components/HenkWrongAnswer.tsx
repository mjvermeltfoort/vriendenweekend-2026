import { useEffect, useRef, useState } from 'react';
import { useAudio } from '../features/audio/audioContext';
import { audioAsset } from '../features/audio/audioConfig';
import clip from '../features/audio/henkWrongAnswerClip.json';
import { formatAnswerWait } from '../features/game/answerCooldown';
import { HenkFlame } from './HintHenkIntro';

export const wrongAnswerAudio = audioAsset(`hint-henk/${clip.file}`);

export function HenkWrongAnswer({ teamId, stopId, deadline, seconds, penalty }: {
  teamId: string; stopId: string; deadline?: string; seconds: number; penalty?: number;
}) {
  const [open, setOpen] = useState(false);
  const seen = useRef('');
  const key = `moerasdraak-henk-wrong-answer:${teamId}:${stopId}`;
  useEffect(() => {
    if (!seconds) { setOpen(false); return; }
    if (!deadline || seen.current === deadline || document.querySelector('dialog[open], [role="dialog"]')) return;
    seen.current = deadline;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(key) === deadline; } catch { /* Still suppress repeat renders in memory. */ }
    if (!dismissed) setOpen(true);
  }, [deadline, seconds, key]);

  function close() {
    if (deadline) try { sessionStorage.setItem(key, deadline); } catch { /* Optional UI storage. */ }
    setOpen(false);
  }
  if (!seconds) return null;
  return <>
    <button className="text-link" type="button" onClick={() => setOpen(true)}>Bekijk Henks foutmelding</button>
    {open ? <WrongAnswerDialog seconds={seconds} penalty={penalty} onClose={close} /> : null}
  </>;
}

function WrongAnswerDialog({ seconds, penalty, onClose }: { seconds: number; penalty?: number; onClose: () => void }) {
  const audio = useAudio();
  const latest = useRef(audio); latest.current = audio;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const returnFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    if (latest.current.soundEnabled) { latest.current.stopNarration(); latest.current.toggleNarration(wrongAnswerAudio); }
    return () => {
      if (latest.current.narration.source === wrongAnswerAudio) latest.current.stopNarration();
      if (element?.open) element.close();
      returnFocus?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="henk-hint henk-hint--reminder" aria-labelledby="henk-wrong-title" onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <button className="hint-henk__close" type="button" aria-label="Foutmelding van Henk sluiten" onClick={onClose}>×</button>
    <div className="henk-hint__character"><HenkFlame speaking={audio.narration.source === wrongAnswerAudio && audio.narration.playing} /><h2 id="henk-wrong-title">Hint Henk</h2></div>
    <div className="henk-hint__bubble"><p>{clip.transcript}</p>
      <p className="henk-hint__cost"><strong>{penalty === undefined ? 'Puntenstraf verwerkt door de server.' : penalty > 0 ? `Puntenaftrek: −${penalty} punten` : 'Geen extra puntenaftrek volgens de puntentelling.'}</strong></p>
    </div>
    <p className="answer-cooldown">Nieuwe poging over <strong>{formatAnswerWait(seconds)}</strong></p>
    <div className="henk-hint__audio">
      <button className="text-link" type="button" onClick={() => { audio.stopNarration(); audio.toggleNarration(wrongAnswerAudio); }}>Opnieuw beluisteren</button>
      <button className="text-link" type="button" onClick={() => {
        audio.toggleSound(); if (!audio.soundEnabled) { audio.stopNarration(); audio.toggleNarration(wrongAnswerAudio); }
      }}>{audio.soundEnabled ? 'Geluid uit' : 'Geluid aan'}</button>
    </div>
    {audio.narration.source === wrongAnswerAudio && audio.narration.error ? <p role="status">{audio.narration.error} Je kunt het bericht hierboven lezen.</p> : null}
    <button className="button primary" type="button" onClick={onClose}>Ik denk er nog even over na</button>
    <p className="small center">Je kunt ondertussen de opdracht bekijken, een hint vragen of terug naar de kaart.</p>
  </dialog>;
}
