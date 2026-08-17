import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const playEffectSequence = vi.fn();
const stopEffects = vi.fn();
const audioState = { effectPlaying: false };

vi.mock('../features/audio/audioContext', () => ({
  useAudio: () => ({
    effectPlaying: audioState.effectPlaying,
    playEffectSequence,
    stopEffects
  })
}));

import { bellChallengeAudio } from '../features/audio/audioConfig';
import { BellChallengeAudio } from './BellChallengeAudio';

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('BellChallengeAudio', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = () => act(() => root.render(<BellChallengeAudio />));

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container.innerHTML = '';
    audioState.effectPlaying = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('switches and stops message and individual-bell playback consistently', () => {
    render();
    const messageButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Speel het bericht'))!;

    act(() => messageButton.click());
    expect(playEffectSequence).toHaveBeenLastCalledWith([
      bellChallengeAudio.bells[2],
      bellChallengeAudio.telephone,
      bellChallengeAudio.bells[0],
      bellChallengeAudio.bells[3],
      bellChallengeAudio.awaken,
      bellChallengeAudio.bells[1]
    ], 260);

    audioState.effectPlaying = true;
    render();
    expect(messageButton.getAttribute('aria-pressed')).toBe('true');

    const firstBell = container.querySelector<HTMLButtonElement>('[aria-label^="Bel 1"]')!;
    act(() => firstBell.click());
    expect(playEffectSequence).toHaveBeenLastCalledWith([bellChallengeAudio.bells[0]], 0);
    expect(messageButton.getAttribute('aria-pressed')).toBe('false');
    expect(firstBell.getAttribute('aria-pressed')).toBe('true');

    act(() => firstBell.click());
    expect(stopEffects).toHaveBeenCalledOnce();
    expect(firstBell.getAttribute('aria-pressed')).toBe('false');
  });

  it('tracks the alternative sequence separately and stops it on a second click', () => {
    render();
    const alternative = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Speel zonder tussengeluiden'))!;

    act(() => alternative.click());
    expect(playEffectSequence).toHaveBeenLastCalledWith([
      bellChallengeAudio.bells[2],
      bellChallengeAudio.bells[0],
      bellChallengeAudio.bells[3],
      bellChallengeAudio.bells[1]
    ], 220);

    audioState.effectPlaying = true;
    render();
    expect(alternative.getAttribute('aria-pressed')).toBe('true');
    expect(alternative.textContent).toContain('Stop de klokkenreeks');

    act(() => alternative.click());
    expect(stopEffects).toHaveBeenCalledOnce();
    expect(alternative.getAttribute('aria-pressed')).toBe('false');
  });
});
