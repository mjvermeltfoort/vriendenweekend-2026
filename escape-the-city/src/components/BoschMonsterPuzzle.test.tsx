import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BoschMonsterPuzzle } from './BoschMonsterPuzzle';
import { correctMonster, type MonsterSelection } from './BoschMonsterArt';
import { gamePack } from '../game-data/moerasdraak/game';
import { challengeAnswerIsCorrect } from '../features/game/gameState';
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Harness() {
  const [selection, setSelection] = useState<MonsterSelection>({});
  return <BoschMonsterPuzzle unlocked onUnlock={() => {}} selection={selection}
    onSelect={(slot, value) => setSelection(previous => ({ ...previous, [slot]: value }))} />;
}
function button(label: string) { return container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!; }
function pointer(element: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  act(() => element.dispatchEvent(event));
}
function swipe(dx: number, dy = 0, cancelled = false) {
  const target = button('Wissel hoofd');
  pointer(target, 'pointerdown', 100, 100);
  pointer(target, cancelled ? 'pointercancel' : 'pointerup', 100 + dx, 100 + dy);
  act(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
}
function description() { return container.querySelector('[role="img"]')!.getAttribute('aria-label')!; }
describe('Bosch interactions', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container); act(() => root.render(<Harness />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('cycles taps on image and preserves live announcements', () => {
    expect(description()).toContain('vogelkop');
    act(() => button('Wissel hoofd').click()); expect(description()).toContain('vissenkop');
    act(() => button('Wissel hoofd').click()); expect(description()).toContain('mensenkop');
    act(() => button('Wissel hoofd').click()); expect(description()).toContain('vogelkop');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Vogelkop');
    expect(container.querySelector('.bosch-puzzle__selectors')).toBeNull();
    expect(container.querySelectorAll('.bosch-puzzle__stage button')).toHaveLength(3);
    expect(container.querySelectorAll('.bosch-art img')).toHaveLength(3);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('swipes both directions without also tapping and supports repeated swipes', () => {
    swipe(-60); expect(description()).toContain('vissenkop');
    swipe(60); expect(description()).toContain('vogelkop');
    swipe(60); expect(description()).toContain('mensenkop');
    swipe(-60); expect(description()).toContain('vogelkop');
  });
  it('ignores vertical, diagonal and cancelled gestures and permits the next tap', () => {
    swipe(5, 70); expect(description()).toContain('vogelkop');
    swipe(50, 60); expect(description()).toContain('vogelkop');
    swipe(-60, 0, true); expect(description()).toContain('vogelkop');
    pointer(button('Wissel hoofd'), 'pointerdown', 100, 100);
    pointer(button('Wissel hoofd'), 'pointerup', 100, 100);
    act(() => button('Wissel hoofd').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    expect(description()).toContain('vissenkop');
  });
  it('provides focusable semantic keyboard buttons directly on the artwork', () => {
    for (const part of ['hoofd', 'lijf', 'benen']) {
      expect(button(`Wissel ${part}`).tagName).toBe('BUTTON');
      expect(button(`Wissel ${part}`).type).toBe('button');
      act(() => button(`Wissel ${part}`).focus()); expect(document.activeElement).toBe(button(`Wissel ${part}`));
    }
  });
  it('accepts exactly one of all 27 combinations and rejects missing parts', () => {
    const challenge = gamePack.stops.find(stop => stop.id === 'bosch-wezen')!.challenge;
    if (challenge.kind !== 'composite') throw new Error('Missing composite');
    let accepted = 0;
    for (const head of challenge.categories.head) for (const body of challenge.categories.body) for (const object of challenge.categories.object) {
      const answer = { head, body, object }, correct = challengeAnswerIsCorrect(challenge, answer);
      expect(correct).toBe(JSON.stringify(answer) === JSON.stringify(correctMonster));
      if (correct) accepted++;
    }
    expect(accepted).toBe(1);
    expect(challengeAnswerIsCorrect(challenge, {})).toBe(false);
    expect(challengeAnswerIsCorrect(challenge, { head: 'human', body: 'egg' })).toBe(false);
  });
});
