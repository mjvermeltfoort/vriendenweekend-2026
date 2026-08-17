import { useEffect, useState } from 'react';
import { bellChallengeAudio, bellChallengeImages } from '../features/audio/audioConfig';
import { useAudio } from '../features/audio/audioContext';
import { GameIcon } from './GameUi';

const patternBells = bellChallengeAudio.pattern.map((number) => bellChallengeAudio.bells[number - 1]);
const messageSequence = [
  patternBells[0],
  bellChallengeAudio.telephone,
  patternBells[1],
  patternBells[2],
  bellChallengeAudio.awaken,
  patternBells[3]
];
const bellLabels = ['Engel', 'Draak', 'Sleutel', 'Schild'];
type ActivePlayback = 'message' | 'alternative' | `bell-${number}`;

export function BellChallengeAudio() {
  const { effectPlaying, playEffectSequence, stopEffects } = useAudio();
  const [activePlayback, setActivePlayback] = useState<ActivePlayback | null>(null);

  useEffect(() => {
    if (!effectPlaying) setActivePlayback(null);
  }, [effectPlaying]);

  const togglePlayback = (playback: ActivePlayback, sources: readonly string[], gapMs: number) => {
    if (effectPlaying && activePlayback === playback) {
      stopEffects();
      setActivePlayback(null);
      return;
    }
    setActivePlayback(playback);
    playEffectSequence(sources, gapMs);
  };

  const messagePlaying = effectPlaying && activePlayback === 'message';
  const alternativePlaying = effectPlaying && activePlayback === 'alternative';

  return (
    <section className="bell-challenge stack" aria-labelledby="bell-challenge-title">
      <div>
        <p className="eyebrow">De Bellende Engel</p>
        <h2 id="bell-challenge-title">Luister naar het hemelse bericht</h2>
        <p>Speel het bericht af en herken welke klokken je hoort. Gebruik de vier losse klokken om te vergelijken.</p>
      </div>

      <div className="bell-challenge__message">
        <img src={bellChallengeImages.callingAngel} alt="" width="303" height="324" />
        <div className="stack">
          <strong>De engel heeft een bericht</strong>
          <button
            className="button primary"
            type="button"
            aria-pressed={messagePlaying}
            onClick={() => togglePlayback('message', messageSequence, 260)}
          >
            <GameIcon name={messagePlaying ? 'pause' : 'play'} size={18} />
            {messagePlaying ? 'Stop het bericht' : 'Speel het bericht af'}
          </button>
        </div>
      </div>

      <div className="bell-reference" aria-label="Losse klokken">
        {bellChallengeAudio.bells.map((source, index) => (
          <button
            className="button bell-reference__button"
            type="button"
            key={source}
            aria-label={`Bel ${index + 1}, ${bellLabels[index]}, afspelen`}
            aria-pressed={effectPlaying && activePlayback === `bell-${index}`}
            onClick={() => togglePlayback(`bell-${index}`, [source], 0)}
          >
            <img src={bellChallengeImages.bells[index]} alt="" width="335" height="457" />
            <span className="bell-reference__label">
              <span>Bel {index + 1}</span>
              <strong>{bellLabels[index]}</strong>
              <GameIcon name={effectPlaying && activePlayback === `bell-${index}` ? 'pause' : 'play'} size={17} />
            </span>
          </button>
        ))}
      </div>

      <details className="bell-alternative">
        <summary>Moeilijk te horen?</summary>
        <p>Speel dezelfde klokkenreeks zonder de tussengeluiden af.</p>
        <button className="button secondary" type="button" aria-pressed={alternativePlaying} onClick={() => togglePlayback('alternative', patternBells, 220)}>
          <GameIcon name={alternativePlaying ? 'pause' : 'volume'} size={17} /> {alternativePlaying ? 'Stop de klokkenreeks' : 'Speel zonder tussengeluiden'}
        </button>
      </details>
    </section>
  );
}
