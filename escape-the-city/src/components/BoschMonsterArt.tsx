import type { ReactElement } from 'react';
import manifest from '../assets/bosch/manifest.json';
import './BoschMonsterPuzzle.css';

export type MonsterSelection = { head?: string; body?: string; object?: string };
export type MonsterSlot = keyof MonsterSelection;
const assets = import.meta.glob('../assets/bosch/*/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const monsterPieces = (['head', 'body', 'object'] as const).map(slot => ({
  slot, title: { head: 'Hoofd', body: 'Lijf', object: 'Benen' }[slot],
  choices: manifest.choices[slot].map(choice => ({ value: choice.id, label: choice.label }))
}));
export const correctMonster = manifest.correctAnswer;
export function monsterChoice(selection: MonsterSelection, slot: MonsterSlot) {
  const choices = monsterPieces.find(piece => piece.slot === slot)!.choices;
  return choices.find(choice => choice.value === selection[slot]) ?? choices[1];
}

/** Full shared canvases preserve the manifest anchors in all 27 combinations. */
export function BoschMonsterArt({ selection, animated = false }: {
  selection: MonsterSelection; animated?: boolean;
}): ReactElement {
  const head = monsterChoice(selection, 'head');
  const body = monsterChoice(selection, 'body');
  const legs = monsterChoice(selection, 'object');
  return <div className={`bosch-art${animated ? ' bosch-art--alive' : ''}`} role="img"
    aria-label={`Monster met ${head.label.toLowerCase()} als hoofd, ${body.label.toLowerCase()} als lijf en ${legs.label.toLowerCase()} als benen`}>
    {manifest.renderOrder.map(group => {
      const choice = group === 'legs' ? legs : group === 'head' ? head : body;
      return <img key={`${group}-${choice.value}`} src={assets[`../assets/bosch/${group}/${choice.value}.webp`]}
        width="512" height="640" alt="" draggable={false} />;
    })}
  </div>;
}
