import { describe, expect, it } from 'vitest';
import { allBellChallengeImages, allEffectAudio, allScenicAudio, allStandaloneNarration, bellChallengeAudio, scenicAudio, scenicForPath } from './audioConfig';
import { audioTranscripts } from './audioTranscripts';

describe('audio configuration', () => {
  it('selects contextual scenic tracks', () => {
    expect(scenicForPath('/')).toBe(scenicAudio.general);
    expect(scenicForPath('/stop/drakenfontein')).toBe(scenicAudio.drakenfontein);
    expect(scenicForPath('/challenge/binnendieze')).toBe(scenicAudio.binnendieze);
    expect(scenicForPath('/stop/bosch-wezen')).toBe(scenicAudio.jheronimusBosch);
    expect(scenicForPath('/stop/sint-jan')).toBe(scenicAudio.sintJan);
    expect(scenicForPath('/stop/kruithuis')).toBe(scenicAudio.general);
    expect(scenicForPath('/resultaat')).toBe(scenicAudio.bosscheBrouwers);
  });

  it('lists all standalone audio for offline preparation', () => {
    expect(allStandaloneNarration()).toHaveLength(3);
    expect(allScenicAudio()).toHaveLength(6);
    expect(allEffectAudio()).toHaveLength(10);
    expect(allBellChallengeImages()).toHaveLength(5);
    expect([...allStandaloneNarration(), ...allScenicAudio()].every((path) => path.endsWith('.mp3'))).toBe(true);
    expect(allEffectAudio().every((path) => /\.(?:mp3|wav)$/.test(path))).toBe(true);
    expect(allBellChallengeImages().every((path) => path.endsWith('.webp'))).toBe(true);
    expect(bellChallengeAudio.pattern).toEqual([3, 2, 1, 4, 3]);
    expect(new Set(bellChallengeAudio.pattern)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('provides a complete text version for every narration fragment', () => {
    expect(Object.values(audioTranscripts)).toHaveLength(10);
    expect(Object.values(audioTranscripts).every((transcript) => transcript.length > 100)).toBe(true);
  });
});
