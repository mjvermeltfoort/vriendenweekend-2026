import { describe, expect, it } from 'vitest';
import { gamePack } from './game';
import { validateGamePack } from '../../features/game/dataValidation';
import { challengeAnswerIsCorrect } from '../../features/game/gameState';
import { haversineDistanceMeters } from '../../features/location/distance';

describe('Verborgen Schubben game data', () => {
  it('contains six unique and on-site-verification-required bonuses', () => {
    expect(gamePack.bonusLocations).toHaveLength(6);
    expect(new Set(gamePack.bonusLocations?.map((bonus) => bonus.id)).size).toBe(6);
    expect(gamePack.bonusLocations?.every((bonus) => bonus.coordinates.needsOnSiteVerification)).toBe(true);
    expect(validateGamePack(gamePack)).toEqual({ valid: true, message: 'OK' });
  });

  it('asks the Koepoort question without changing server answer id or the verification question', () => {
    const bonus = gamePack.bonusLocations!.find((location) => location.id === 'bonus:bolwerk-sint-jan')!;
    expect(bonus.challenge.kind).toBe('choice');
    if (bonus.challenge.kind !== 'choice') return;
    expect(bonus.challenge.prompt).toBe('De Moerasdraak bewaakt een toegang die al eeuwen verdwenen is. Maar niet alle sporen zijn uitgewist. Hoe heette de middeleeuwse stadspoort op deze plek?');
    expect(bonus.challenge.prompt).not.toMatch(/plaat|bestrating/i);
    expect(bonus.navigation.clue).not.toMatch(/plaat|steen.*voeten/i);
    expect(bonus.challenge.options.map((option) => option.label)).toEqual([
      'De Vughterpoort', 'De Koepoort', 'De Orthenpoort', 'De Hinthamerpoort'
    ]);
    // Supabase validates answer id 'a' for this bonus, even though it is visually second.
    expect(bonus.challenge.options.find((option) => option.correct)).toMatchObject({ id: 'a', label: 'De Koepoort' });
    expect(challengeAnswerIsCorrect(bonus.challenge, 'a')).toBe(true);
    for (const wrong of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(bonus.challenge, wrong)).toBe(false);
    }
    expect(bonus.manualVerification.question).toBe('Welke twee materialen ontmoeten elkaar hier het duidelijkst?');
    expect(bonus.hints).toHaveLength(1);
    expect(bonus.hints[0].id).toBe('h1');
    expect(bonus.hints[0].text).toBe('Niet alles wat verdwenen is, ligt onder de grond. Soms vertelt een steen je precies wat hier vroeger stond. Kijk eens bij je voeten!');
    expect(bonus.hints[0].text).not.toMatch(/Koepoort/i);
    expect(bonus.answerExplanation).toMatch(/De Koepoort.*Sint-Jansstraat.*1528.*Sint-Janspoort/);
    expect(bonus.reward.title).toBe('Poortschub');
    expect(bonus.maximumPoints).toBe(100);
  });

  it('asks an on-site observation about De Moriaan corner turret, keeping answer id a', () => {
    const bonus = gamePack.bonusLocations!.find((location) => location.id === 'bonus:de-moriaan')!;
    expect(bonus.challenge.kind).toBe('choice');
    if (bonus.challenge.kind !== 'choice') return;
    expect(bonus.intro.text).toContain('De Moriaan');
    expect(bonus.intro.text).not.toMatch(/torentje|hoek/i);
    expect(bonus.challenge.prompt).toMatch(/boven aan de hoek van De Moriaan/);
    expect(bonus.challenge.options.map((option) => option.label)).toEqual([
      'Een stenen leeuw', 'Een grote klok', 'Een klein rond torentje', 'Een houten balkon'
    ]);
    // Supabase validates answer id 'a'; retain it even though the correct option is third.
    expect(bonus.challenge.options.find((option) => option.correct)).toMatchObject({
      id: 'a', label: 'Een klein rond torentje'
    });
    expect(challengeAnswerIsCorrect(bonus.challenge, 'a')).toBe(true);
    for (const wrong of ['b', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(bonus.challenge, wrong)).toBe(false);
    }
    expect(bonus.hints).toHaveLength(1);
    expect(bonus.hints[0].id).toBe('h1');
    expect(bonus.hints[0].text).toMatch(/omhoog.*hoek/);
    expect(bonus.hints[0].text).not.toMatch(/torentje/i);
    expect(bonus.answerExplanation).toMatch(/hoektorentje.*13e eeuw.*jaren vijftig.*jaren zestig/);
    expect(bonus.reward.title).toBe('Steenschub');
    expect(bonus.maximumPoints).toBe(150);
    expect(bonus.coordinates).toMatchObject({ latitude: 51.689615, longitude: 5.303141 });
  });

  it('asks players to count four human statues on the Zwanenbroedershuis façade, keeping server answer id b', () => {
    const bonus = gamePack.bonusLocations!.find((item) => item.id === 'bonus:zwanenbroedershuis')!;
    expect(bonus.challenge.kind).toBe('choice');
    if (bonus.challenge.kind !== 'choice') return;

    expect(bonus.intro.text).toContain('De Moerasdraak');
    expect(bonus.intro.text).not.toMatch(/vier|4|vierde/);
    expect(bonus.challenge.prompt).toBe('Hoeveel menselijke beelden staan er aan de voorgevel van het Zwanenbroedershuis?');
    expect(bonus.challenge.options.map((item) => item.label)).toEqual(['Twee', 'Drie', 'Vier', 'Vijf']);
    // Supabase valideert choice-id b; deze is bewust de derde visuele keuze.
    expect(bonus.challenge.options.find((item) => item.correct)).toMatchObject({ id: 'b', label: 'Vier' });
    expect(challengeAnswerIsCorrect(bonus.challenge, 'b')).toBe(true);
    for (const wrong of ['a', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(bonus.challenge, wrong)).toBe(false);
    }
    expect(bonus.manualVerification.question).toBe('Welk dier staat helemaal boven op de gevel?');
    expect(bonus.hints).toHaveLength(1);
    expect(bonus.hints[0].id).toBe('h1');
    expect(bonus.hints[0].text).toContain('Kijk eens een stukje lager');
    expect(bonus.hints[0].text).not.toMatch(/vier|4/);
    expect(bonus.answerExplanation).toMatch(/1962.*Marius van Beek/);
    expect(bonus.answerExplanation).toMatch(/Willem van Oranje.*Gerardus van Uden.*Gijsbertus van der Poorten.*Floris van Egmond/);
    expect(bonus.answerExplanation).toContain('1846–1847');
    expect(bonus.answerExplanation).toContain('Jheronimus Bosch');
    expect(bonus.reward.title).toBe('Veerschub');
    expect(bonus.maximumPoints).toBe(150);
    expect(bonus.coordinates).toMatchObject({ latitude: 51.688710, longitude: 5.309535, radiusMeters: 60 });
  });

  it('uses the exact on-site Halve Peer GPS point instead of the earlier inaccurate map pins', () => {
    const halvePeer = gamePack.bonusLocations!.find((item) => item.id === 'bonus:halve-peer')!;
    const gerritje = gamePack.stops.find((item) => item.id === 'zoete-lieve-gerritje')!;
    expect(halvePeer.coordinates).toMatchObject({
      latitude: 51.68961800908911,
      longitude: 5.299956048272589,
      radiusMeters: 55,
      discoveryRadiusMeters: 120
    });
    expect(halvePeer.locationName).toMatch(/Binnendieze/);
    expect(halvePeer.navigation.fallbackDirections).toMatch(/gevel boven het water/);
    // Zowel de vroegere oude pin als de in migratie 035 gebruikte kaartlocatie wijkt af.
    expect(haversineDistanceMeters(
      { latitude: 51.689444, longitude: 5.299722 },
      { latitude: halvePeer.coordinates.latitude!, longitude: halvePeer.coordinates.longitude! }
    )).toBeGreaterThan(20);
    expect(haversineDistanceMeters(
      { latitude: 51.688846, longitude: 5.300058 },
      { latitude: halvePeer.coordinates.latitude!, longitude: halvePeer.coordinates.longitude! }
    )).toBeGreaterThan(80);
    // Deze bonus ligt dicht bij Gerritje, dus automatische selectie vereist precisie.
    const distanceToGerritje = haversineDistanceMeters(
      { latitude: gerritje.coordinates.latitude!, longitude: gerritje.coordinates.longitude! },
      { latitude: halvePeer.coordinates.latitude!, longitude: halvePeer.coordinates.longitude! }
    );
    expect(distanceToGerritje).toBeGreaterThan(20);
    expect(distanceToGerritje).toBeLessThan(25);
  });

  it('asks players to identify De Oetels and provides a hidden historical explanation', () => {
    const bonus = gamePack.bonusLocations!.find((location) => location.id === 'bonus:halve-peer')!;
    expect(bonus.challenge.kind).toBe('choice');
    if (bonus.challenge.kind !== 'choice') return;
    expect(bonus.challenge.prompt).toMatch(/Welke vereniging heeft deze halve Peer laten maken/);
    expect(bonus.challenge.options.map((option) => option.label)).toEqual([
      'De Oeteldonksche Club van 1882',
      'Carnavalsvereniging De Oetels',
      "De gemeente 's-Hertogenbosch",
      'Het Bossche Schuttersgilde'
    ]);
    expect(bonus.challenge.options.find((option) => option.correct)).toMatchObject({
      id: 'b', label: 'Carnavalsvereniging De Oetels'
    });
    // Supabase validates this bonus answer against choice id 'b'.
    expect(challengeAnswerIsCorrect(bonus.challenge, 'b')).toBe(true);
    for (const wrong of ['a', 'c', 'd']) {
      expect(challengeAnswerIsCorrect(bonus.challenge, wrong)).toBe(false);
    }
    expect(bonus.hints).toHaveLength(1);
    expect(bonus.hints[0].id).toBe('h1');
    expect(bonus.hints[0].text).not.toMatch(/de Oetels/i);
    expect(bonus.answerExplanation).toMatch(/Frans Vennix.*De Oetels/);
    expect(bonus.answerExplanation).toMatch(/in 1988.*halve Peer/);
    expect(bonus.reward.title).toBe('Narrenschub');
  });
});
