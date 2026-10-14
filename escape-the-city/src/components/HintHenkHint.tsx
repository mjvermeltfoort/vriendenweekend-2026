import { useEffect, useRef, useState } from 'react';
import type { HintConfig } from '../features/game/gameTypes';
import { useAudio } from '../features/audio/audioContext';
import { henkConfirmation, henkHint } from '../features/audio/hintHenkAudio';
import { HenkFlame } from './HintHenkIntro';

interface Props {
  open: boolean;
  stopId: string;
  hint?: HintConfig;
  penalty: number;
  replay?: boolean;
  onConfirm: (hintId: string) => Promise<void>;
  onClose: () => void;
}

/** Keep the selected hint fixed while the server advances hintsUsed. */
export function HintHenkHint({ open, stopId, hint, penalty, replay = false, onConfirm, onClose }: Props) {
  const { narration, soundEnabled, toggleSound, toggleNarration, stopNarration } = useAudio();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const request = useRef(0);
  const locked = useRef(false);
  const [selected, setSelected] = useState(hint);
  const [revealed, setRevealed] = useState(replay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef({ source: narration.source, soundEnabled, stopNarration, toggleNarration });
  audioRef.current = { source: narration.source, soundEnabled, stopNarration, toggleNarration };

  useEffect(() => {
    const dialog = dialogRef.current;
    request.current += 1;
    locked.current = false;
    setBusy(false);
    setError('');
    if (open) {
      setSelected(hint);
      setRevealed(replay);
      returnFocus.current = document.activeElement as HTMLElement;
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
    return () => {
      if (dialog?.open) dialog.close();
      returnFocus.current?.focus();
    };
    // Snapshot only when opening; a successful payment changes the hint prop.
  }, [open, stopId, replay]);

  const recording = revealed && selected ? henkHint(stopId, selected.id) : henkConfirmation;
  // A hint can change before its recorded MP3 is regenerated. Never play stale
  // speech (or show its old transcript) in place of a newly paid-for hint.
  const recordingIsStale = Boolean(revealed && selected && recording && !recording.transcript.includes(selected.text));
  const source = recordingIsStale ? undefined : recording?.source;
  const transcript = recordingIsStale ? selected?.text ?? '' : recording?.transcript ?? selected?.text ?? '';

  useEffect(() => {
    if (!open || !source) return;
    if (audioRef.current.soundEnabled) {
      audioRef.current.stopNarration();
      audioRef.current.toggleNarration(source);
    }
    return () => {
      if (audioRef.current.source === source) audioRef.current.stopNarration();
    };
    // Progress/sync renders may replace the audio callbacks. They must not
    // stop and restart this recording; only opening or changing clips does.
  }, [open, source]);

  useEffect(() => () => { request.current += 1; }, []);

  function close() {
    request.current += 1;
    if (audioRef.current.source === source) stopNarration();
    onClose();
  }

  async function confirm() {
    if (!selected || locked.current || revealed) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const currentRequest = request.current;
    try {
      await onConfirm(selected.id);
      if (currentRequest === request.current) setRevealed(true);
    } catch {
      if (currentRequest === request.current) setError('De hint kon niet worden opgehaald. Probeer het opnieuw.');
    } finally {
      if (currentRequest === request.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <dialog ref={dialogRef} className="henk-hint" aria-labelledby="henk-hint-title"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <button className="hint-henk__close" type="button" aria-label="Hint Henk sluiten" onClick={close}>×</button>
      <div className="henk-hint__character">
        <HenkFlame speaking={narration.source === source && narration.playing} />
        <h2 id="henk-hint-title">Hint Henk</h2>
      </div>
      <div className="henk-hint__bubble" aria-live="polite">
        <p>{transcript}</p>
        {!revealed ? <p className="henk-hint__cost"><strong>Kosten: {penalty} punten</strong></p> : null}
      </div>
      <div className="henk-hint__audio">
        {source ? <button className="text-link" type="button" onClick={() => {
          stopNarration();
          toggleNarration(source);
        }}>Opnieuw beluisteren</button> : null}
        <button className="text-link" type="button" onClick={() => {
          toggleSound();
          if (!soundEnabled && source) { stopNarration(); toggleNarration(source); }
        }}>{soundEnabled ? 'Geluid uit' : 'Geluid aan'}</button>
      </div>
      {narration.source === source && narration.error ? <p role="status">{narration.error} Je kunt de tekst hierboven lezen.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!revealed ? <button className="button primary" type="button" disabled={busy || !selected} onClick={() => void confirm()}>
        {busy ? 'Hint ophalen…' : 'Hint tonen'}
      </button> : null}
      <button className="button ghost" type="button" onClick={close}>{revealed ? 'Bedankt Henk, ik kan weer verder' : 'Annuleren'}</button>
    </dialog>
  );
}
