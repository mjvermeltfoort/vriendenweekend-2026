import { describe, expect, it } from 'vitest';
import { gamePack } from './game';
import { validateGamePack } from '../../features/game/dataValidation';
import { challengeAnswerIsCorrect } from '../../features/game/gameState';

describe('Verborgen Schubben game data', () => {
  it('contains six unique and on-site-verification-required bonuses', () => {
    expect(gamePack.bonusLocations).toHaveLength(6);
    expect(new Set(gamePack.bonusLocations?.map((bonus) => bonus.id)).size).toBe(6);
    expect(gamePack.bonusLocations?.every((bonus) => bonus.coordinates.needsOnSiteVerification)).toBe(true);
    expect(validateGamePack(gamePack)).toEqual({ valid: true, message: 'OK' });
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
