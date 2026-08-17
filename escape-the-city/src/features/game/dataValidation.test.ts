import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { validateGamePack } from './dataValidation';

describe('game data validation', () => {
  it('accepts current pack', () => {
    expect(validateGamePack(gamePack).valid).toBe(true);
  });

  it('keeps every answer presentation valid and non-predictable', () => {
    const locations = [...gamePack.stops, ...(gamePack.bonusLocations ?? [])];

    for (const { challenge } of locations) {
      if (challenge.kind === 'choice') expect(challenge.options[0].correct).toBe(false);
      if (challenge.kind === 'reorder') {
        expect(challenge.items).not.toEqual(challenge.correctOrder);
        expect([...challenge.items].sort()).toEqual([...challenge.correctOrder].sort());
      }
      if (challenge.kind === 'composite') {
        for (const [category, options] of Object.entries(challenge.categories)) {
          expect(options[0]).not.toBe(challenge.correctAnswer[category]);
        }
      }
    }
  });

  it('rejects solved or first-position answer presentations', () => {
    const solvedReorder = structuredClone(gamePack);
    const reorder = solvedReorder.stops.find((stop) => stop.challenge.kind === 'reorder')!.challenge;
    if (reorder.kind === 'reorder') reorder.items = [...reorder.correctOrder];
    expect(validateGamePack(solvedReorder).valid).toBe(false);

    const firstChoice = structuredClone(gamePack);
    const choice = firstChoice.stops.find((stop) => stop.challenge.kind === 'choice')!.challenge;
    if (choice.kind === 'choice') choice.options.sort((left) => left.correct ? -1 : 1);
    expect(validateGamePack(firstChoice).valid).toBe(false);

    const firstComposite = structuredClone(gamePack);
    const composite = firstComposite.stops.find((stop) => stop.challenge.kind === 'composite')!.challenge;
    if (composite.kind === 'composite') {
      const category = Object.keys(composite.categories)[0];
      composite.categories[category] = [
        composite.correctAnswer[category],
        ...composite.categories[category].filter((option) => option !== composite.correctAnswer[category])
      ];
    }
    expect(validateGamePack(firstComposite).valid).toBe(false);
  });
});
