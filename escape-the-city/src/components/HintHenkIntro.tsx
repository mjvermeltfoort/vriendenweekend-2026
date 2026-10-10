import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { useAudio } from '../features/audio/audioContext';
import { narrationAudio } from '../features/audio/audioConfig';
import { hintHenkTranscript } from '../features/audio/hintHenkTranscript';

const INTRO_DISMISSED_KEY = 'moerasdraak-hint-henk-intro-dismissed-v1';

function shouldShowIntro() {
  try {
    return sessionStorage.getItem(INTRO_DISMISSED_KEY) !== '1';
  } catch {
    return true;
  }
}

function HenkPortrait() {
  return (
    <svg className="hint-henk__portrait" viewBox="0 0 180 180" role="img" aria-label="Hint Henk met een grote bril en een eigenwijze glimlach">
      <circle cx="90" cy="90" r="85" fill="#16392d" stroke="#c4974d" strokeWidth="3" />
      <path d="M36 165c8-30 28-40 54-40s46 10 54 40" fill="#37554c" stroke="#e0bc78" strokeWidth="3" />
      <path d="M69 128l21 26 21-26" fill="#f4e6c5" stroke="#bba17a" strokeWidth="2" />
      <path d="M80 147l10 10 10-10-10-6z" fill="#c4974d" />
      <ellipse cx="90" cy="86" rx="49" ry="57" fill="#efc99e" stroke="#75583c" strokeWidth="2" />
      <path d="M45 75c-4-25 4-43 27-47l9 10 12-19 8 20 16-12c14 8 20 26 18 48-7-17-15-26-27-27-22 15-41 19-63 27z" fill="#5f4936" />
      <path d="M54 80q17-10 32 0M97 80q17-10 32 0" fill="none" stroke="#583e31" strokeWidth="5" strokeLinecap="round" />
      <circle cx="69" cy="94" r="21" fill="#a7d7d5" fillOpacity=".28" stroke="#302e2c" strokeWidth="7" />
      <circle cx="113" cy="94" r="21" fill="#a7d7d5" fillOpacity=".28" stroke="#302e2c" strokeWidth="7" />
      <path d="M90 91h3M47 90l-6-5m94 5 6-5" stroke="#302e2c" strokeWidth="6" strokeLinecap="round" />
      <circle cx="72" cy="95" r="4" fill="#302e2c" /><circle cx="111" cy="95" r="4" fill="#302e2c" />
      <path d="M91 97l-5 18 11 1" fill="none" stroke="#a56f51" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 126q18 14 34-2" fill="none" stroke="#7d4839" strokeWidth="4" strokeLinecap="round" />
      <path d="M65 168h49" stroke="#c4974d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HintHenkIntro() {
  const [open, setOpen] = useState(shouldShowIntro);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { narration, stopNarration } = useAudio();

  const dismiss = useCallback(() => {
    if (narration.source === narrationAudio.hintHenk) stopNarration();
    try {
      sessionStorage.setItem(INTRO_DISMISSED_KEY, '1');
    } catch {
      // Private browsing may disable storage; closing still works.
    }
    setOpen(false);
  }, [narration.source, stopNarration]);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss, open]);

  useEffect(() => {
    if (
      open &&
      narration.source === narrationAudio.hintHenk &&
      !narration.playing &&
      narration.duration > 0 &&
      narration.currentTime >= narration.duration - 0.15
    ) dismiss();
  }, [dismiss, narration, open]);

  return (
    <>
      <button type="button" className="text-link hint-henk__replay" onClick={() => setOpen(true)}>
        Luister naar Hint Henk
      </button>
      {open ? (
        <div className="hint-henk__overlay">
          <section className="hint-henk__dialog" role="dialog" aria-modal="true" aria-labelledby="hint-henk-title" aria-describedby="hint-henk-description">
            <button type="button" className="hint-henk__close" aria-label="Uitleg van Hint Henk sluiten" onClick={dismiss}>×</button>
            <HenkPortrait />
            <p className="eyebrow center hint-henk__eyebrow">Jullie onmisbare hulp</p>
            <h2 id="hint-henk-title" tabIndex={-1} ref={headingRef}>Hint Henk</h2>
            <p id="hint-henk-description" className="hint-henk__tagline">
              Ahum... ik zal het jullie nog één keer uitleggen. Tik op afspelen om te beginnen!
            </p>
            <AudioPlayer
              source={narrationAudio.hintHenk}
              title="Henk legt het avontuur uit"
              transcript={hintHenkTranscript}
              durationSeconds={144}
            />
            <button type="button" className="button secondary hint-henk__skip" onClick={dismiss}>
              Bedankt Henk, ik snap het wel
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
