import { useState } from 'react';
import { BoschMonsterArt, type MonsterSelection } from './BoschMonsterArt';
import './BoschMonsterPuzzle.css';

type Slot = 'head' | 'body' | 'object';

const pieces: { slot: Slot; title: string; choices: { value: string; label: string }[] }[] = [
  { slot: 'head', title: 'Hoofd', choices: [
    { value: 'Demon', label: 'Demon' }, { value: 'Kikker', label: 'Kikker' }, { value: 'Vogel', label: 'Vogel' }
  ] },
  { slot: 'body', title: 'Lijf', choices: [
    { value: 'Ton', label: 'Ton' }, { value: 'Boek', label: 'Boek' }, { value: 'Vis', label: 'Vis' }
  ] },
  { slot: 'object', title: 'Onderkant', choices: [
    { value: 'Wielen', label: 'Wielen' }, { value: 'Vogelpoten', label: 'Vogelpoten' }, { value: 'Mens', label: 'Mensenbenen' }
  ] }
];

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
  onSelect: (slot: Slot, value: string) => void;
}) {
  const [tool, setTool] = useState('');
  const [year, setYear] = useState('');
  const [wrongObservation, setWrongObservation] = useState(false);

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
      <p className="bosch-puzzle__story">Drie gescheurde onderdelen vormen een vreemd wezen. Herstel Boschs fantasie: <strong>een snavel, een geschubd lijf en mensenvoeten.</strong> Tik op de stukken om jouw monster samen te stellen.</p>
      <div className="bosch-puzzle__stage">
        <span className="bosch-puzzle__seal" aria-hidden="true">✧</span>
        <BoschMonsterArt selection={selection} />
        <span className="bosch-puzzle__caption">Het schetsboek van de Moerasdraak</span>
      </div>
      {pieces.map(({ slot, title, choices }) => (
        <fieldset className="bosch-puzzle__fieldset" key={slot}>
          <legend>{title}</legend>
          <div className="bosch-puzzle__options">
            {choices.map(({ value, label }) => (
              <button type="button" key={value}
                className={`bosch-puzzle__part ${selection[slot] === value ? 'bosch-puzzle__part--selected' : ''}`}
                aria-label={`Kies ${title.toLowerCase()}: ${label}`}
                aria-pressed={selection[slot] === value}
                onClick={() => onSelect(slot, value)}>
                <span className="bosch-puzzle__part-icon" aria-hidden="true">
                  {slot === 'head' ? (value === 'Vogel' ? '♧' : value === 'Kikker' ? '◉' : '♜')
                    : slot === 'body' ? (value === 'Vis' ? '≋' : value === 'Ton' ? '▤' : '▣')
                    : value === 'Mens' ? '♙' : value === 'Wielen' ? '⚙' : '♢'}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="muted small center">Kies een hoofd, een lijf en een onderkant. De illustratie verandert direct.</p>
    </section>
  );
}
