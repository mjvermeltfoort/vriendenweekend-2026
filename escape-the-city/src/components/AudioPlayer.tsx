import { GameIcon } from './GameUi';
import { useAudio } from '../features/audio/audioContext';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function AudioPlayer({ source, title, transcript, showTranscript = true }: { source: string; title: string; transcript: string; showTranscript?: boolean }) {
  const { narration, toggleNarration, seekNarration } = useAudio();
  const active = narration.source === source;
  const playing = active && narration.playing;
  const currentTime = active ? narration.currentTime : 0;
  const duration = active ? narration.duration : 0;

  return (
    <section className="audio-player" aria-label={title}>
      <button
        className="audio-play-button"
        type="button"
        aria-label={playing ? `${title} pauzeren` : `${title} afspelen`}
        onClick={() => toggleNarration(source)}
      >
        <GameIcon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="audio-player__body">
        <div className="row row--between">
          <strong>{title}</strong>
          <span className="audio-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
        <input
          className="audio-progress"
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(currentTime, Math.max(duration, 1))}
          aria-label={`Positie in ${title}`}
          disabled={!duration}
          onChange={(event) => seekNarration(Number(event.target.value))}
        />
        {active && narration.error ? <p className="audio-error" role="alert">{narration.error}</p> : null}
        {showTranscript ? (
          <details className="audio-transcript">
            <summary>Tekstversie</summary>
            <p>{transcript}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
