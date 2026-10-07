import { describe, expect, it } from 'vitest';
import { gamePack } from './game';

describe('Moerasdraak player copy', () => {
  it('keeps the Drakenfontein water clue connected to the fire memory', () => {
    const stop = gamePack.stops.find((item) => item.id === 'drakenfontein')!;
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;

    expect(stop.challenge.options.find((option) => option.correct)?.label).toBe('Water');
    expect(stop.challenge.correctFeedback).toMatch(/water.*vuur/i);
    expect(stop.reward.title).toBe('Vuur');
  });

  it('asks a statement that agrees with the Gerritje answer key', () => {
    const stop = gamePack.stops.find((item) => item.id === 'zoete-lieve-gerritje')!;
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;

    expect(stop.challenge.prompt).toBe('Welke verklaring past bij deze plek?');
    expect(stop.challenge.options.find((option) => option.correct)?.label).toBe('Er stroomt water onder de stad');
    expect(stop.challenge.correctFeedback).toContain('past bij de plek');
  });

  it('does not repeat manual verification questions as bonus challenge prompts', () => {
    for (const bonus of gamePack.bonusLocations ?? []) {
      expect(bonus.challenge.prompt).not.toBe(bonus.manualVerification.question);
    }
  });

  it('uses different facts for the first four manual checks and challenges', () => {
    const expectedAnswers = new Map([
      ['bonus:bolwerk-sint-jan', ['a', 'Stadsentree en verdedigingspoort']],
      ['bonus:halve-peer', ['b', 'Slechts een van de twee partijen betaalde mee']],
      ['bonus:de-moriaan', ['a', 'Het is een van de oudste bakstenen woonhuizen']],
      ['bonus:zwanenbroedershuis', ['b', 'De Illustre Lieve Vrouwe Broederschap']]
    ]);

    for (const [id, [answerId, label]] of expectedAnswers) {
      const bonus = gamePack.bonusLocations?.find((item) => item.id === id);
      expect(bonus?.challenge.kind).toBe('choice');
      if (!bonus || bonus.challenge.kind !== 'choice') continue;

      expect(bonus.challenge.options.find((option) => option.correct)).toMatchObject({ id: answerId, label });
      expect(bonus.manualVerification.question.toLowerCase()).not.toContain(label.toLowerCase());
    }
  });

  it('grounds historical bonus answers in the story shown before each challenge', () => {
    const expectedContext = new Map<string, RegExp>([
      ['bonus:bolwerk-sint-jan', /stadspoort.*bolwerk/i],
      ['bonus:halve-peer', /twee partijen.*één partij/i],
      ['bonus:de-moriaan', /woonhuis.*oudste bakstenen/i],
      ['bonus:zwanenbroedershuis', /Illustre Lieve Vrouwe Broederschap/i]
    ]);

    for (const [id, context] of expectedContext) {
      const bonus = gamePack.bonusLocations?.find((item) => item.id === id);
      expect(bonus?.intro.text).toMatch(context);
    }
  });
});
