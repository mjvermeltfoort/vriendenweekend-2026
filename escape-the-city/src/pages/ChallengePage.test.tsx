import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../features/game/gameState';
import { gamePack } from '../game-data/moerasdraak/game';

const attemptAnswer = vi.fn();
const useHint = vi.fn().mockResolvedValue(undefined);
const completeFinale = vi.fn().mockResolvedValue(undefined);
const progress = createInitialProgress('team-1', gamePack);

for (const location of [...gamePack.stops, ...(gamePack.bonusLocations ?? [])]) {
  progress.stopProgress[location.id] = {
    state: 'completed',
    attempts: 0,
    hintsUsed: 0,
    scoreAwarded: 0,
    answerData: {},
    startedAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    unlockMethod: 'gps'
  };
}

vi.mock('../app/gameContext', () => ({
  useGame: () => ({ progress, attemptAnswer, useHint, completeFinale })
}));

vi.mock('../components/GameUi', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  GameIcon: () => <span aria-hidden="true" />,
  HintDialog: ({ open }: { open: boolean }) => open ? <div data-testid="hint-dialog">Hintdialoog</div> : null
}));

vi.mock('../components/AudioPlayer', () => ({ AudioPlayer: () => null }));
vi.mock('../components/BellChallengeAudio', () => ({ BellChallengeAudio: () => null }));

import { ChallengePage } from './ChallengePage';

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function TestApp({ initialStopId }: { initialStopId: string }) {
  return (
    <MemoryRouter initialEntries={[`/challenge/${initialStopId}`]}>
      <nav>
        {['drakenfontein', 'binnendieze', 'bosch-wezen', 'sint-jan', 'bonus:citadel'].map((id) => (
          <Link key={id} data-route={id} to={`/challenge/${id}`}>{id}</Link>
        ))}
      </nav>
      <Routes>
        <Route path="/challenge/:stopId" element={<ChallengePage pack={gamePack} />} />
        <Route path="/stop/:stopId" element={<p>Stopoverzicht</p>} />
        <Route path="/resultaat" element={<p>Resultaat</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function setFormValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('ChallengePage', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = (stopId: string) => act(() => root.render(<TestApp initialStopId={stopId} />));
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes(text))!;
  const routeTo = (stopId: string) => act(() => container.querySelector<HTMLAnchorElement>(`[data-route="${stopId}"]`)!.click());

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container.innerHTML = '';
    vi.clearAllMocks();
    attemptAnswer.mockResolvedValue({ correct: false, message: 'Probeer opnieuw.' });
  });

  afterEach(() => {
    act(() => root.render(null));
    container.innerHTML = '';
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('sanitizes and truncates numeric codes and requires exactly four digits', () => {
    render('sint-jan');
    const input = container.querySelector<HTMLInputElement>('.code-input')!;
    const submit = button('Controleer antwoord');

    expect(input.maxLength).toBe(4);
    expect(input.getAttribute('aria-describedby')).toBe('code-answer-help');
    expect(container.textContent).toContain('Voer precies 4 cijfers in.');
    expect(submit.disabled).toBe(true);

    act(() => setFormValue(input, '31-a4 25'));
    expect(input.value).toBe('3142');
    expect(submit.disabled).toBe(false);

    act(() => setFormValue(input, '314'));
    expect(submit.disabled).toBe(true);
  });

  it('clears stale answer feedback when the code changes', async () => {
    render('sint-jan');
    const input = container.querySelector<HTMLInputElement>('.code-input')!;
    act(() => setFormValue(input, '3142'));

    await act(async () => button('Controleer antwoord').click());
    expect(container.querySelector('#answer-feedback')?.textContent).toBe('Probeer opnieuw.');
    expect(input.getAttribute('aria-describedby')).toBe('code-answer-help answer-feedback');

    act(() => setFormValue(input, '314'));
    expect(container.querySelector('#answer-feedback')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe('code-answer-help');
  });

  it('resets answer, ordering, lens, feedback, busy, and dialog state on route changes', async () => {
    render('sint-jan');
    const code = container.querySelector<HTMLInputElement>('.code-input')!;
    act(() => setFormValue(code, '3142'));
    await act(async () => button('Controleer antwoord').click());
    act(() => button('Hint gebruiken').click());
    expect(container.querySelector('[data-testid="hint-dialog"]')).not.toBeNull();

    routeTo('binnendieze');
    expect(container.querySelector('#answer-feedback')).toBeNull();
    expect(container.querySelector('[data-testid="hint-dialog"]')).toBeNull();
    expect(container.querySelector('.reorder-item span')?.textContent).toContain('Sluis');
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Sluis omlaag"]')!.click());
    expect(container.querySelector('.reorder-item span')?.textContent).toContain('Bron');

    routeTo('drakenfontein');
    act(() => container.querySelector<HTMLInputElement>('input[value="a"]')!.click());
    expect(container.querySelector<HTMLInputElement>('input[value="a"]')!.checked).toBe(true);

    routeTo('bosch-wezen');
    const firstSelect = container.querySelector<HTMLSelectElement>('select')!;
    act(() => setFormValue(firstSelect, 'Masker'));
    expect(firstSelect.value).toBe('Masker');

    routeTo('bonus:citadel');
    expect(button('Controleer antwoord').disabled).toBe(true);
    act(() => button('Linkerlens draaien').click());
    expect(button('Controleer antwoord').disabled).toBe(false);

    routeTo('binnendieze');
    expect(container.querySelector('.reorder-item span')?.textContent).toContain('Sluis');
    routeTo('drakenfontein');
    expect(container.querySelector<HTMLInputElement>('input[value="a"]')!.checked).toBe(false);
    routeTo('bosch-wezen');
    expect(container.querySelector<HTMLSelectElement>('select')!.value).toBe('');
    routeTo('bonus:citadel');
    expect(button('Controleer antwoord').disabled).toBe(true);
    routeTo('sint-jan');
    expect(container.querySelector<HTMLInputElement>('.code-input')!.value).toBe('');

    let resolveAttempt!: (value: { correct: boolean; message: string }) => void;
    attemptAnswer.mockReturnValueOnce(new Promise((resolve) => { resolveAttempt = resolve; }));
    act(() => setFormValue(container.querySelector<HTMLInputElement>('.code-input')!, '3142'));
    act(() => button('Controleer antwoord').click());
    expect(button('Antwoord controleren').textContent).toContain('Antwoord controleren');
    routeTo('drakenfontein');
    expect(button('Controleer antwoord').textContent).toContain('Controleer antwoord');
    await act(async () => resolveAttempt({ correct: false, message: 'Verouderd bericht' }));
    expect(container.textContent).not.toContain('Verouderd bericht');
  });

  it('allows wrong and correct lens attempts without revealing the solution in button state', async () => {
    attemptAnswer.mockImplementation(async (_stopId, _challenge, answer) => ({
      correct: answer === 'vesting',
      message: answer === 'vesting' ? 'Goed.' : 'Nog niet.'
    }));
    render('bonus:citadel');
    const submit = button('Controleer antwoord');
    expect(submit.disabled).toBe(true);

    act(() => button('Linkerlens draaien').click());
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(attemptAnswer).toHaveBeenLastCalledWith('bonus:citadel', expect.anything(), '');
    expect(container.textContent).toContain('Nog niet.');

    act(() => button('Linkerlens draaien').click());
    for (let index = 0; index < 3; index += 1) act(() => button('Rechterlens draaien').click());
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(attemptAnswer).toHaveBeenLastCalledWith('bonus:citadel', expect.anything(), 'vesting');
  });
});
