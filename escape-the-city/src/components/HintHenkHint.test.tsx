import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HintHenkHint } from './HintHenkHint';
import { henkConfirmation, henkHint } from '../features/audio/hintHenkAudio';

const audio = vi.hoisted(() => ({
  soundEnabled: true,
  narration: { source: null as string | null, playing: false, error: '' },
  stopNarration: vi.fn(), toggleNarration: vi.fn(), toggleSound: vi.fn()
}));
vi.mock('../features/audio/audioContext', () => ({ useAudio: () => audio }));

describe('Hint Henk paid hints', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const pay = vi.fn<() => Promise<void>>();
  const close = vi.fn();
  const hint = { id: 'h1', text: 'De gouden draak trekt alle aandacht.' };
  const render = (replay = false, value: typeof hint | undefined = hint) => act(() => root.render(
    <HintHenkHint open stopId="drakenfontein" hint={value} penalty={100} replay={replay} onConfirm={pay} onClose={close} />
  ));
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    audio.soundEnabled = true;
    audio.narration = { source: null, playing: false, error: '' };
    pay.mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shows and speaks only the cost warning before payment; cancel is free', () => {
    render();
    expect(container.textContent).toContain('Kosten: 100 punten');
    expect(container.textContent).not.toContain(hint.text);
    expect(audio.toggleNarration).toHaveBeenCalledWith(henkConfirmation.source);
    act(() => button('Annuleren').click());
    expect(close).toHaveBeenCalledOnce();
    expect(pay).not.toHaveBeenCalled();
  });

  it('waits for payment, blocks double taps and preserves the hint after progress updates', async () => {
    let resolve!: () => void;
    pay.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    render();
    act(() => { const confirm = button('Hint tonen'); confirm.click(); confirm.click(); });
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith('h1');
    expect(container.textContent).not.toContain(hint.text);
    await act(async () => { resolve(); });
    act(() => root.render(<HintHenkHint open stopId="drakenfontein" hint={undefined} penalty={100} onConfirm={pay} onClose={close} />));
    expect(container.textContent).toContain(hint.text);
    expect(audio.toggleNarration).toHaveBeenLastCalledWith(henkHint('drakenfontein', 'h1')!.source);
    act(() => button('Opnieuw beluisteren').click());
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('keeps the hint hidden on payment failure and supports retry', async () => {
    pay.mockRejectedValueOnce(new Error('offline'));
    render();
    await act(async () => button('Hint tonen').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Probeer het opnieuw');
    expect(container.textContent).not.toContain(hint.text);
    await act(async () => button('Hint tonen').click());
    expect(container.textContent).toContain(hint.text);
  });

  it('replays a purchased hint without charging or playing the warning', () => {
    render(true);
    expect(container.textContent).toContain(hint.text);
    expect(container.textContent).not.toContain('Kosten:');
    expect(audio.toggleNarration).toHaveBeenCalledWith(henkHint('drakenfontein', 'h1')!.source);
    expect(pay).not.toHaveBeenCalled();
  });

  it('respects mute while still displaying the complete text', async () => {
    audio.soundEnabled = false;
    render();
    await act(async () => button('Hint tonen').click());
    expect(container.textContent).toContain(hint.text);
    expect(audio.toggleNarration).not.toHaveBeenCalled();
  });

  it('shows updated paid hint text instead of stale recorded speech', () => {
    const updated = { id: 'h1', text: 'Een toekomstige hint waarvoor nog geen nieuwe opname bestaat.' };
    act(() => root.render(<HintHenkHint open stopId="bossche-brouwers" hint={updated} penalty={100} replay onConfirm={pay} onClose={close} />));
    expect(container.textContent).toContain(updated.text);
    expect(container.textContent).not.toContain('Mijn brein staat nog niet op de tap');
    expect(container.textContent).not.toContain('Opnieuw beluisteren');
    expect(audio.toggleNarration).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
  });

  it('does not restart warning or paid speech when sync refreshes audio callbacks', async () => {
    render();
    expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
    const originalToggle = audio.toggleNarration;
    const originalStop = audio.stopNarration;
    try {
      audio.narration.source = henkConfirmation.source;
      audio.toggleNarration = vi.fn();
      audio.stopNarration = vi.fn();
      render();
      expect(audio.toggleNarration).not.toHaveBeenCalled();
      expect(audio.stopNarration).not.toHaveBeenCalled();
      await act(async () => button('Hint tonen').click());
      expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
      audio.narration.source = henkHint('drakenfontein', 'h1')!.source;
      audio.toggleNarration = vi.fn();
      audio.stopNarration = vi.fn();
      render();
      expect(audio.toggleNarration).not.toHaveBeenCalled();
      expect(audio.stopNarration).not.toHaveBeenCalled();
      act(() => button('Opnieuw beluisteren').click());
      expect(audio.toggleNarration).toHaveBeenCalledTimes(1);
    } finally {
      audio.toggleNarration = originalToggle;
      audio.stopNarration = originalStop;
      render();
    }
  });

  it('stops its recording on Escape and on unmount', () => {
    render();
    audio.narration.source = henkConfirmation.source;
    render();
    act(() => container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(close).toHaveBeenCalled();
    expect(audio.stopNarration).toHaveBeenCalled();
    audio.stopNarration.mockClear();
    act(() => root.render(null));
    expect(audio.stopNarration).toHaveBeenCalled();
  });

  it('does not start a late hint after closing during payment', async () => {
    let resolve!: () => void;
    pay.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    render();
    act(() => button('Hint tonen').click());
    act(() => button('Annuleren').click());
    await act(async () => { resolve(); });
    expect(audio.toggleNarration).not.toHaveBeenCalledWith(henkHint('drakenfontein', 'h1')!.source);
  });
});
