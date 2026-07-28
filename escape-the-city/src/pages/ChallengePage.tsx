import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GamePack } from '../features/game/gameTypes';
import { useGame } from '../app/gameContext';
import { isFinaleLocationRevealed, stopById } from '../features/game/gameState';
import { GameIcon, HintDialog, PageShell } from '../components/GameUi';
import { AudioPlayer } from '../components/AudioPlayer';
import { BellChallengeAudio } from '../components/BellChallengeAudio';
import { narrationAudio } from '../features/audio/audioConfig';
import { audioTranscripts } from '../features/audio/audioTranscripts';

export function ChallengePage({ pack }: { pack: GamePack }) {
  const { stopId } = useParams();
  const navigate = useNavigate();
  const { progress, attemptAnswer, useHint, completeFinale } = useGame();
  const stop = stopId ? stopById(pack, stopId) : null;
  const [choice, setChoice] = useState('');
  const [code, setCode] = useState('');
  const [list, setList] = useState<string[]>(stop?.challenge.kind === 'reorder' ? [...stop.challenge.items] : []);
  const [composite, setComposite] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  if (!stop) return <PageShell title="Opdracht" backTo="/route"><p>Opdracht niet gevonden.</p></PageShell>;

  const currentStop = stop;
  if (currentStop.isFinal && (!progress || !isFinaleLocationRevealed(progress, pack))) {
    return (
      <PageShell title="Finale vergrendeld" backTo="/route" navigation={false}>
        <section className="card stack center">
          <GameIcon name="lock" size={32} />
          <h1>Eindlocatie nog verborgen</h1>
          <p>Voltooi eerst alle eerdere opdrachten.</p>
        </section>
      </PageShell>
    );
  }
  const hintCount = progress?.stopProgress[currentStop.id]?.hintsUsed ?? 0;
  const activeHint = currentStop.hints[hintCount];
  const revealedHint = hintCount > 0 ? currentStop.hints[Math.min(hintCount, currentStop.hints.length) - 1] : null;
  const isFinal = currentStop.isFinal;
  const penalty = pack.scoring.hintPenalty[hintCount] ?? pack.scoring.hintPenalty.at(-1) ?? 0;

  const canSubmit = (() => {
    if (currentStop.challenge.kind === 'choice') return choice.length > 0;
    if (currentStop.challenge.kind === 'code') return code.length >= 3;
    if (currentStop.challenge.kind === 'reorder') return list.length === currentStop.challenge.correctOrder.length;
    if (currentStop.challenge.kind === 'composite') return Object.keys(composite).length === Object.keys(currentStop.challenge.categories).length;
    return false;
  })();

  async function submit() {
    setBusy(true);
    try {
      const answer = currentStop.challenge.kind === 'choice' ? choice : currentStop.challenge.kind === 'code' ? code : currentStop.challenge.kind === 'reorder' ? list : composite;
      const result = await attemptAnswer(currentStop.id, currentStop.challenge, answer);
      setMessage(result.message);
      if (result.correct) {
        if (isFinal) {
          await completeFinale();
          navigate('/resultaat');
        } else {
          navigate(`/stop/${currentStop.id}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Opdracht" backTo={`/stop/${currentStop.id}`} navigation={false}>
      <p className="eyebrow center">{currentStop.order} / {pack.stops.length}</p>
      <section className="parchment-card stack stack--large">
        {isFinal ? (
          <AudioPlayer
            source={narrationAudio.finale}
            title="Luister naar de finale"
            transcript={audioTranscripts.finale}
          />
        ) : null}
        <div>
          <h1>{currentStop.title}</h1>
          <p>{currentStop.challenge.prompt}</p>
        </div>

        <div className="audio-panel" aria-label="Opdrachtillustratie niet beschikbaar">
          <span className="audio-icon"><GameIcon name="scroll" /></span>
          <div>
            <strong>Bekijk de plek</strong>
            <p>Gebruik details op locatie om deze opdracht op te lossen.</p>
          </div>
        </div>

        {currentStop.id === 'sint-jan' ? <BellChallengeAudio /> : null}

        {currentStop.challenge.kind === 'choice' ? (
          <fieldset className="stack">
            <legend className="eyebrow">Kies één antwoord</legend>
            {currentStop.challenge.options.map((option) => (
              <label key={option.id} className="choice-option">
                <input type="radio" name="choice" value={option.id} checked={choice === option.id} onChange={() => setChoice(option.id)} />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {currentStop.challenge.kind === 'code' ? (
          <label className="field">
            <span>Voer de code in</span>
            <input
              className="code-input"
              value={code}
              maxLength={currentStop.challenge.answerLength + 4}
              onChange={(event) => setCode(event.target.value)}
              inputMode={currentStop.challenge.keyboard === 'numeric' ? 'numeric' : 'text'}
              autoComplete="off"
              aria-describedby={message ? 'answer-feedback' : undefined}
            />
          </label>
        ) : null}

        {currentStop.challenge.kind === 'reorder' ? (
          <div className="stack">
            <p className="eyebrow">Zet in juiste volgorde</p>
            {list.map((item, index) => {
              const move = (direction: -1 | 1) => {
                setList((current) => {
                  const copy = [...current];
                  const nextIndex = Math.max(0, Math.min(copy.length - 1, index + direction));
                  copy.splice(index, 1);
                  copy.splice(nextIndex, 0, item);
                  return copy;
                });
              };
              return (
                <div key={item} className="reorder-item">
                  <span>{index + 1}. {item}</span>
                  <button className="button" type="button" aria-label={`${item} omhoog`} disabled={index === 0} onClick={() => move(-1)}>↑</button>
                  <button className="button" type="button" aria-label={`${item} omlaag`} disabled={index === list.length - 1} onClick={() => move(1)}>↓</button>
                </div>
              );
            })}
          </div>
        ) : null}

        {currentStop.challenge.kind === 'composite' ? (
          <div className="stack">
            {Object.entries(currentStop.challenge.categories).map(([category, options]) => (
              <label key={category} className="field">
                <span>{category}</span>
                <select value={composite[category] ?? ''} onChange={(event) => setComposite((current) => ({ ...current, [category]: event.target.value }))}>
                  <option value="">Kies</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {revealedHint ? <p className="revealed-hint"><strong>Hint:</strong> {revealedHint.text}</p> : null}
        {message ? <p className="feedback" id="answer-feedback" role="alert">{message}</p> : null}

        <div className="stack">
          <button className="button primary" disabled={busy || !canSubmit} onClick={() => void submit()}>
            {busy ? 'Antwoord controleren…' : 'Controleer antwoord'}
          </button>
          {activeHint ? (
            <button className="button secondary" type="button" onClick={() => setHintOpen(true)}>
              <GameIcon name="lightbulb" size={18} /> Hint gebruiken · −{penalty} punten
            </button>
          ) : <p className="center muted small">Geen extra hints beschikbaar.</p>}
        </div>
      </section>

      <HintDialog
        open={hintOpen}
        hint={activeHint?.text ?? ''}
        penalty={penalty}
        onClose={() => setHintOpen(false)}
        onConfirm={() => {
          if (activeHint) void useHint(currentStop.id, activeHint.id);
        }}
      />
    </PageShell>
  );
}
