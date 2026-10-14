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

  it('asks what the blue stones reveal about the Marktstroom at Waterpoort', () => {
    const stop = gamePack.stops.find((item) => item.id === 'binnendieze')!;
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;

    expect(stop.challenge.prompt).toMatch(/blauwe stenen.*deze plek/);
    expect(stop.challenge.options.map((option) => option.label)).toEqual([
      'Hier stond vroeger de buitenste stadsmuur.',
      'Hier liep de oude handelsroute naar de Markt.',
      'Hier stroomde vroeger de Marktstroom, een tak van de Binnendieze.',
      'Hier lag een aanlegplaats voor handelsschepen.'
    ]);
    // De nieuwe Supabase-migratie 037 gebruikt choice-id a, visueel het derde antwoord.
    expect(stop.challenge.options.find((option) => option.correct)).toMatchObject({
      id: 'a', label: 'Hier stroomde vroeger de Marktstroom, een tak van de Binnendieze.'
    });
    expect(challengeAnswerIsCorrect(stop.challenge, 'a')).toBe(true);
    for (const answer of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(stop.challenge, answer)).toBe(false);
    }
    expect(stop.intro.text).not.toMatch(/blauwe stenen|Marktstroom/);
    expect(stop.navigation.clue).not.toMatch(/blauwe stenen|Marktstroom/);
    expect(stop.hints).toHaveLength(1);
    expect(stop.hints[0].id).toBe('h1');
    expect(stop.hints[0].text).toContain('Een rivier zonder water');
    expect(stop.hints[0].text).not.toMatch(/Marktstroom/);
    expect(stop.answerExplanation).toMatch(/Marktstroom.*Binnendieze.*1962 en 1966.*opengelegd/i);
    expect(stop.reward.title).toBe('Water');
    expect(stop.coordinates).toMatchObject({ latitude: 51.689641, longitude: 5.305190 });
  });

  it('uses the Falise statue and a server-compatible composite answer for the Bosch monster', () => {
    const stop = gamePack.stops.find((item) => item.id === 'bosch-wezen')!;
    expect(stop.locationName).toContain('Standbeeld Jheronimus Bosch');
    expect(stop.locationName).toContain('August Falise');
    expect(stop.coordinates).toMatchObject({ latitude: 51.689089, longitude: 5.30375, radiusMeters: 35, maximumAccuracyMeters: 40 });
    expect(stop.navigation.fallbackDirections).not.toContain('Markt 29,');
    expect(stop.intro.title).toBe('Het Monster van Bosch');
    expect(stop.intro.audioSrc).toMatch(/\/audio\/04-jheronimus-bosch\.mp3$/);
    expect(stop.intro.text).not.toMatch(/schetsboek|sokkel|aanwijzing|penseel|palet|1516|boomman|snavel|schubben/i);
    expect(stop.intro.transcript?.split('\n\n')).toHaveLength(5);
    expect(stop.intro.transcript).toContain('Hier groeide een jongen op die de wereld anders zag dan ieder ander.');
    expect(stop.intro.transcript).toContain('Bouw het wezen dat alleen jullie kunnen zien.');
    expect(stop.challenge.kind).toBe('composite');
    if (stop.challenge.kind !== 'composite') return;
    expect(stop.challenge.categories).toEqual({
      head: ['bird','human','fish'],
      body: ['barrel','egg','tower'],
      object: ['human','trees','bird']
    });
    expect(stop.challenge.correctAnswer).toEqual({ head: 'human', body: 'egg', object: 'trees' });
    expect(challengeAnswerIsCorrect(stop.challenge, { head: 'human', body: 'egg', object: 'trees' })).toBe(true);
    expect(challengeAnswerIsCorrect(stop.challenge, { head: 'bird', body: 'egg', object: 'trees' })).toBe(false);
    expect(stop.hints).toHaveLength(1);
    expect(stop.hints[0].id).toBe('h1');
    expect(stop.answerExplanation).toMatch(/August Falise.*1930/);
    expect(stop.reward.title).toBe('Verbeelding');
  });

  it('asks how the Kruithuis directed the force of an explosion away from the city', () => {
    const stop = gamePack.stops.find((item) => item.id === 'kruithuis')!;
    expect(stop.title).toBe('Vuur en Water');
    expect(stop.intro.title).toBe('Het geheim van het Kruithuis');
    expect(stop.intro.audioSrc).toMatch(/\/audio\/06-kruithuis\.mp3$/);
    expect(stop.intro.transcript).toMatch(/bouwmeester.*slimme oplossing/s);
    expect(stop.intro.transcript).not.toMatch(/kies de juiste route|vermijd het water/i);
    expect(stop.challenge.kind).toBe('choice');
    if (stop.challenge.kind !== 'choice') return;
    expect(stop.challenge.prompt).toMatch(/kracht van een explosie/);
    expect(stop.challenge.options).toHaveLength(4);
    expect(stop.challenge.options.map((option) => option.correct)).toEqual([false, false, true, false]);
    // Supabase still validates choice 'a'; do not change it.
    expect(stop.challenge.options.find((option) => option.correct)).toMatchObject({
      id: 'a', label: 'De kracht moest vooral omhoog, door het lichtere dak.'
    });
    expect(challengeAnswerIsCorrect(stop.challenge, 'a')).toBe(true);
    for (const wrong of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(stop.challenge, wrong)).toBe(false);
    }
    expect(stop.hints).toHaveLength(1);
    expect(stop.hints[0].id).toBe('h1');
    expect(stop.hints[0].text).toMatch(/daar gaat mijn kapsel/i);
    expect(stop.answerExplanation).toMatch(/1618 en 1620.*zeshoekige.*dunnere muren.*omhoog.*Tachtigjarige Oorlog/i);
    expect(stop.reward.title).toBe('Moed');
  });

  it('uses the reclaimed yellow floor tiles as the Verkadefabriek secret', () => {
    const bonus = gamePack.bonusLocations?.find((item) => item.id === 'bonus:verkadefabriek');
    expect(bonus).toBeDefined();
    if (!bonus) return;

    expect(bonus.title).toBe('Verkadefabriek');
    expect(bonus.intro.title).toBe('Van Koek naar Cultuur');
    expect(bonus.intro.text).not.toMatch(/vloer|tegels|schoenen/i);
    expect(bonus.challenge.kind).toBe('choice');
    if (bonus.challenge.kind !== 'choice') return;

    expect(bonus.challenge.prompt).toContain('18.000 onderdelen');
    expect(bonus.challenge.options.map((option) => option.label)).toEqual([
      'De oude gele vloertegels',
      'De metalen bakvormen van de koekjes',
      'De houten transportkisten',
      'De stenen van de fabrieksschoorsteen'
    ]);
    expect(bonus.challenge.options.map((option) => option.correct)).toEqual([true, false, false, false]);
    // Migration 040 changes the Supabase answer_spec from reorder to choice id 'a'.
    expect(bonus.challenge.options.find((option) => option.correct)?.id).toBe('a');
    expect(challengeAnswerIsCorrect(bonus.challenge, 'a')).toBe(true);
    for (const wrong of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(bonus.challenge, wrong)).toBe(false);
    }
    expect(bonus.manualVerification.question).toMatch(/oorspronkelijke functie/i);
    expect(bonus.hints).toHaveLength(1);
    expect(bonus.hints[0].id).toBe('h1');
    expect(bonus.hints[0].text).toMatch(/onder je schoenen/i);
    expect(bonus.answerExplanation).toMatch(/1993.*18[.]000.*gele vloertegels.*sheddaken.*2004/i);
    expect(bonus.reward.title).toBe('Machineschub');
  });

  it('does not repeat manual verification questions as bonus challenge prompts', () => {
    for (const bonus of gamePack.bonusLocations ?? []) {
      expect(bonus.challenge.prompt).not.toBe(bonus.manualVerification.question);
    }
  });

  it('uses different facts for the first four manual checks and challenges', () => {
    const expectedAnswers = new Map([
      ['bonus:bolwerk-sint-jan', ['a', 'De Koepoort']],
      ['bonus:halve-peer', ['b', 'Carnavalsvereniging De Oetels']],
      ['bonus:de-moriaan', ['a', 'Een klein rond torentje']],
      ['bonus:zwanenbroedershuis', ['b', 'Vier']]
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
      ['bonus:bolwerk-sint-jan', /stadspoort.*Moerasdraak/i],
      ['bonus:halve-peer', /twee verenigingen.*halve Peer/i],
      ['bonus:de-moriaan', /De Moriaan.*woonhuis.*slopershamer/i],
      ['bonus:zwanenbroedershuis', /Hinthamerstraat.*zwaan.*Moerasdraak/i]
    ]);

    for (const [id, context] of expectedContext) {
      const bonus = gamePack.bonusLocations?.find((item) => item.id === id);
      expect(bonus?.intro.text).toMatch(context);
    }
  });
});
