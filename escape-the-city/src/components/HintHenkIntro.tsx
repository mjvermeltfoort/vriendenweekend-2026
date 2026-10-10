import { useCallback, useEffect, useRef, useState } from 'react';
// Source of truth for the flame character also used in the main game.
import '../../../games/game-assistant.css';
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

/**
 * Original Hint Henk flame from the main Vriendenweekend game.
 * Reuses the same .asst-* markup and stylesheet rather than drawing a second mascot.
 */
export function HenkFlame({ speaking = false }: { speaking?: boolean }) {
  return (
    <span
      className={speaking ? 'hint-henk__mascot hint-henk__mascot--speaking' : 'hint-henk__mascot'}
      role="img"
      aria-label="Hint Henk, het oranje vlammetje uit het hoofdspel"
    >
      <span className="asst-character" aria-hidden="true">
        <span className="asst-body" />
        <span className="asst-eye asst-eye-l" />
        <span className="asst-eye asst-eye-r" />
        <span className="asst-mouth" />
      </span>
    </span>
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
            <HenkFlame speaking={narration.source === narrationAudio.hintHenk && narration.playing} />
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
