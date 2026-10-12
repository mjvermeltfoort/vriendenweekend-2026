import { describe, expect, it } from 'vitest';
import { gamePack } from './game';
import { challengeAnswerIsCorrect } from '../../features/game/gameState';

describe('Moerasdraak player copy', () => {
  it('asks players to count all five dragons, including the golden dragon', () => {
    const stop = gamePack.stops.find((item) => item.id === 'drakenfontein')!;
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;

    expect(stop.challenge.prompt).toContain('inclusief de gouden draak');
    expect(stop.challenge.options.map((option) => option.label)).toEqual([
      '3 draken', '4 draken', '5 draken', '6 draken'
    ]);
    expect(stop.challenge.options.map((option) => option.correct)).toEqual([false, false, true, false]);
    // Supabase validates choice id 'a'; keep it while moving the answer to the third visual option.
    expect(stop.challenge.options.find((option) => option.correct)?.id).toBe('a');
    expect(challengeAnswerIsCorrect(stop.challenge, 'a')).toBe(true);
    for (const wrongAnswer of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(stop.challenge, wrongAnswer)).toBe(false);
    }
    expect(stop.challenge.correctFeedback).toMatch(/vijf draken.*vijf wachters/i);
    expect(stop.hints).toHaveLength(1);
    expect(stop.hints[0].id).toBe('h1'); // Supabase allows only the existing paid hint.
    expect(stop.hints[0].text).toContain('gouden draak');
    expect(stop.hints[0].text).toMatch(/om de fontein heen/i);
    expect(stop.hints[0].text).not.toMatch(/vijf|vier|5|4|tel de donkere draken/i);
    expect(stop.challenge.wrongFeedback).toMatch(/gemist of dubbel hebt geteld/i);
    expect(stop.reward.title).toBe('Vuur');
  });

  it('asks which song line is inscribed behind Zoete Lieve Gerritje', () => {
    const stop = gamePack.stops.find((item) => item.id === 'zoete-lieve-gerritje')!;
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;

    expect(stop.challenge.prompt).toMatch(/muur achter Zoete Lieve Gerritje/);
    expect(stop.challenge.options.map((option) => option.label)).toEqual([
      'Brandewijn met suiker',
      'Dat gaat naar Den Bosch toe',
      'Wie zal dat betalen?',
      'Den eerste boer den beste'
    ]);
    // De Supabase-antwoordsleutel voor deze stop is 'b'; de antwoordcode blijft gelijk.
    expect(stop.challenge.options.find((option) => option.correct)).toMatchObject({
      id: 'b', label: 'Dat gaat naar Den Bosch toe'
    });
    expect(challengeAnswerIsCorrect(stop.challenge, 'b')).toBe(true);
    for (const wrong of ['a', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(stop.challenge, wrong)).toBe(false);
    }
    expect(stop.hints).toHaveLength(1);
    expect(stop.hints[0].id).toBe('h1');
    expect(stop.hints[0].text).toMatch(/woorden.*achter Gerritje/i);
    expect(stop.hints[0].text).not.toMatch(/Dat gaat naar Den Bosch toe/i);
    expect(stop.reward.title).toBe('Legende');
  });

  it('does not repeat manual verification questions as bonus challenge prompts', () => {
    for (const bonus of gamePack.bonusLocations ?? []) {
      expect(bonus.challenge.prompt).not.toBe(bonus.manualVerification.question);
    }
  });

  it('uses different facts for the first four manual checks and challenges', () => {
    const expectedAnswers = new Map([
      ['bonus:bolwerk-sint-jan', ['a', 'Stadsentree en verdedigingspoort']],
      ['bonus:halve-peer', ['b', 'Carnavalsvereniging De Oetels']],
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
      ['bonus:halve-peer', /twee verenigingen.*halve Peer/i],
      ['bonus:de-moriaan', /woonhuis.*oudste bakstenen/i],
      ['bonus:zwanenbroedershuis', /Illustre Lieve Vrouwe Broederschap/i]
    ]);

    for (const [id, context] of expectedContext) {
      const bonus = gamePack.bonusLocations?.find((item) => item.id === id);
      expect(bonus?.intro.text).toMatch(context);
    }
  });
});
