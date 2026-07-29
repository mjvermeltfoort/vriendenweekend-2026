import { useEffect, useState } from 'react';
import { bellChallengeAudio, bellChallengeImages } from '../features/audio/audioConfig';
import { useAudio } from '../features/audio/audioContext';
import { GameIcon } from './GameUi';

const patternBells = bellChallengeAudio.pattern.map((number) => bellChallengeAudio.bells[number - 1]);
const patternTones = bellChallengeAudio.pattern.map((number) => bellChallengeAudio.tones[number - 1]);
const messageSequence = [
  patternBells[0],
  bellChallengeAudio.telephone,
  patternBells[1],
  patternBells[2],
  bellChallengeAudio.awaken,
  patternBells[3],
  patternBells[4]
];
const bellLabels = ['Engel', 'Draak', 'Sleutel', 'Schild'];

export function BellChallengeAudio() {
  const { effectPlaying, playEffectSequence, stopEffects } = useAudio();
  const [activeBell, setActiveBell] = useState<number | null>(null);

  useEffect(() => {
    if (!effectPlaying) setActiveBell(null);
  }, [effectPlaying]);

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
            aria-pressed={effectPlaying && activeBell === null}
            onClick={() => effectPlaying ? stopEffects() : playEffectSequence(messageSequence, 260)}
          >
            <GameIcon name={effectPlaying ? 'pause' : 'play'} size={18} />
            {effectPlaying ? 'Stop het bericht' : 'Speel het bericht af'}
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
            aria-pressed={effectPlaying && activeBell === index}
            onClick={() => {
              setActiveBell(index);
              playEffectSequence([source], 0);
            }}
          >
            <img src={bellChallengeImages.bells[index]} alt="" width="335" height="457" />
            <span className="bell-reference__label">
              <span>Bel {index + 1}</span>
              <strong>{bellLabels[index]}</strong>
              <GameIcon name={effectPlaying && activeBell === index ? 'pause' : 'play'} size={17} />
            </span>
          </button>
        ))}
      </div>

      <details className="bell-alternative">
        <summary>Moeilijk te horen?</summary>
        <p>Speel dezelfde reeks als heldere tonen af. Iedere klok heeft een eigen toonhoogte.</p>
        <button className="button secondary" type="button" onClick={() => playEffectSequence(patternTones, 220)}>
          <GameIcon name="volume" size={17} /> Speel heldere tonen
        </button>
      </details>
    </section>
  );
}
