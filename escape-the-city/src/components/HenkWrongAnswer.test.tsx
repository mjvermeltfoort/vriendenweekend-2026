import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HenkWrongAnswer, wrongAnswerAudio } from './HenkWrongAnswer';

const audio = vi.hoisted(() => ({ soundEnabled: true, narration: { source: null as string | null, playing: false, error: '' }, stopNarration: vi.fn(), toggleNarration: vi.fn(), toggleSound: vi.fn() }));
vi.mock('../features/audio/audioContext', () => ({ useAudio: () => audio }));
describe('Hint Henk wrong answer notice', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const render = (seconds = 60, deadline = '2026-10-14T18:01:00Z', penalty = 25, reopenRequest = 0) => act(() => root.render(<HenkWrongAnswer teamId="a" stopId="main" deadline={deadline} seconds={seconds} penalty={penalty} reopenRequest={reopenRequest} />));
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks(); sessionStorage.clear(); audio.soundEnabled = true; audio.narration = { source: null, playing: false, error: '' };
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false; });
  it('shows the actual penalty and countdown; ticking never restarts speech', () => {
    render(); expect(container.textContent).toContain('−25 punten'); expect(container.textContent).toContain('01:00');
    expect(audio.toggleNarration).toHaveBeenCalledWith(wrongAnswerAudio);
    render(59); render(58); expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
  });
  it('remembers dismissal across reloads, but opens for a new wrong attempt', () => {
    render(); act(() => container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    act(() => root.render(null)); render(50); expect(container.querySelector('dialog')).toBeNull();
    render(60, '2026-10-14T18:03:00Z'); expect(container.querySelector('dialog')).not.toBeNull();
  });
  it('removes the replay link and explicitly reopens the existing warning on a retry-button request', () => {
    render();
    expect(container.textContent).not.toContain('Bekijk Henks foutmelding');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Foutmelding van Henk sluiten"]')!.click());
    expect(container.querySelector('dialog')).toBeNull();

    audio.toggleNarration.mockClear();
    render(45, '2026-10-14T18:01:00Z', 25, 1);
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.textContent).toContain('00:45');
    expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
    render(44, '2026-10-14T18:01:00Z', 25, 1);
    expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
  });
  it('respects mute and the existing score floors', () => {
    audio.soundEnabled = false; render(60, undefined, 0);
    expect(audio.toggleNarration).not.toHaveBeenCalled(); expect(container.textContent).toContain('Geen extra puntenaftrek');
  });
  it('closes and stops its voice when the cooldown expires', () => {
    render(); audio.narration.source = wrongAnswerAudio; render(1); audio.stopNarration.mockClear(); render(0);
    expect(container.querySelector('dialog')).toBeNull(); expect(audio.stopNarration).toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });
});
