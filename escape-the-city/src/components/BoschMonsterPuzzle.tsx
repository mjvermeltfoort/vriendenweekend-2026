import { useRef, useState } from 'react';
import { BoschMonsterArt, monsterChoice, monsterPieces, type MonsterSlot, type MonsterSelection } from './BoschMonsterArt';
import './BoschMonsterPuzzle.css';

const tools = [
  { value: 'boek', label: 'Een boek en een ganzenveer' },
  { value: 'penseelpalet', label: 'Een penseel en een schilderspalet' },
  { value: 'schild', label: 'Een schild en een zwaard' }
];
const years = ['1450', '1516', '1930'];

/** Two-step, mobile-friendly Bosch puzzle. Observation is a local gate;
 *  only assembling a monster is submitted to the authoritative game scorer. */
export function BoschMonsterPuzzle({
  unlocked, onUnlock, selection, onSelect
}: {
  unlocked: boolean;
  onUnlock: () => void;
  selection: MonsterSelection;
  onSelect: (slot: MonsterSlot, value: string) => void;
}) {
  const [tool, setTool] = useState('');
  const [year, setYear] = useState('');
  const [wrongObservation, setWrongObservation] = useState(false);

  const gesture = useRef<{ slot: MonsterSlot; x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  function cycle(slot: MonsterSlot, direction: number) {
    const choices = monsterPieces.find(piece => piece.slot === slot)!.choices;
    const index = choices.findIndex(choice => choice.value === monsterChoice(selection, slot).value);
    onSelect(slot, choices[(index + direction + choices.length) % choices.length].value);
  }

  if (!unlocked) {
    return (
      <section className="bosch-puzzle stack" aria-label="Standbeeldonderzoek">
        <p className="eyebrow">Deel 1 van 2 · Onderzoek het standbeeld</p>
        <p className="bosch-puzzle__story">De Moerasdraak heeft het schetsboek verzegeld. Kijk goed naar het bronzen standbeeld van Jheronimus Bosch op de Markt. Twee aanwijzingen openen het boek.</p>
        <fieldset className="bosch-puzzle__fieldset">
          <legend>Wat houdt de schilder in zijn handen?</legend>
          {tools.map((option) => (
            <label className="bosch-puzzle__radio" key={option.value}>
              <input type="radio" name="bosch-tools" value={option.value} checked={tool === option.value}
                onChange={() => { setTool(option.value); setWrongObservation(false); }}/>
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="bosch-puzzle__fieldset">
          <legend>Welk jaartal staat als laatste op de sokkel?</legend>
          <div className="bosch-puzzle__years">
            {years.map((value) => (
              <label className="bosch-puzzle__year" key={value}>
                <input type="radio" name="bosch-year" value={value} checked={year === value}
                  onChange={() => { setYear(value); setWrongObservation(false); }}/>
                <span>{value}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {wrongObservation ? <p className="feedback" role="alert">Het schetsboek blijft gesloten. Kijk nog eens naar de handen van het standbeeld en de levensjaren op de sokkel.</p> : null}
        <button className="button primary" type="button" disabled={!tool || !year}
          onClick={() => { if (tool === 'penseelpalet' && year === '1516') onUnlock(); else setWrongObservation(true); }}>
          Open het schetsboek →
        </button>
        <p className="muted small">Deze observatie kost geen punten en telt niet als antwoordpoging.</p>
      </section>
    );
  }

  return (
    <section className="bosch-puzzle stack" aria-label="Monsterpuzzel">
      <div className="bosch-puzzle__unlocked" role="status">✦ Het schetsboek is geopend! · Deel 2 van 2</div>
      <p className="bosch-puzzle__story">Herstel de Boomman uit <em>De tuin der lusten</em>. Tik of swipe op hoofd, lijf en benen.</p>
      <div className="bosch-puzzle__stage">
        <BoschMonsterArt selection={selection} />
        <div className="bosch-puzzle__zones">
          {monsterPieces.map(({ slot, title }) => <button key={slot} type="button"
            className={`bosch-puzzle__zone bosch-puzzle__zone--${slot}`}
            aria-label={`Wissel ${title.toLowerCase()}`}
            onPointerDown={event => {
              if (!event.isPrimary || event.button !== 0) return;
              suppressClick.current = false;
              gesture.current = { slot, x: event.clientX, y: event.clientY, id: event.pointerId };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
            onPointerUp={event => {
              const start = gesture.current;
              gesture.current = null;
              if (!start || start.id !== event.pointerId || start.slot !== slot) return;
              const dx = event.clientX - start.x, dy = event.clientY - start.y;
              suppressClick.current = Math.abs(dx) > 10 || Math.abs(dy) > 10;
              if (Math.abs(dx) >= 40 && Math.abs(dx) > 1.3 * Math.abs(dy)) cycle(slot, dx < 0 ? 1 : -1);
            }}
            onClick={event => {
              if (!suppressClick.current || event.detail === 0) cycle(slot, 1);
              suppressClick.current = false;
            }} />)}
        </div>
      </div>
      <div className="bosch-puzzle__selectors">
        {monsterPieces.map(({ slot, title, choices }) => {
          const choice = monsterChoice(selection, slot);
          return <div className="bosch-puzzle__selector" role="group" aria-label={title} key={slot}>
            <button type="button" className="bosch-puzzle__part" aria-label={`Vorige ${title.toLowerCase()}`} onClick={() => cycle(slot, -1)}>‹</button>
            <button type="button" className="bosch-puzzle__part bosch-puzzle__current" onClick={() => cycle(slot, 1)} aria-label={`Kies ${title.toLowerCase()}: ${choice.label}`}>
              <span>{title}: {choice.label}</span><small>{choices.indexOf(choice) + 1}/3</small>
            </button>
            <button type="button" className="bosch-puzzle__part" aria-label={`Volgende ${title.toLowerCase()}`} onClick={() => cycle(slot, 1)}>›</button>
          </div>;
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{monsterPieces.map(({ slot, title }) => `${title}: ${monsterChoice(selection, slot).label}`).join(', ')}</p>
    </section>
  );
}
