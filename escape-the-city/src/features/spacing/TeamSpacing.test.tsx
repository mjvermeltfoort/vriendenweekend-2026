import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeamSpacing } from './TeamSpacing';
import { createInitialProgress } from '../game/gameState';
import { gamePack } from '../../game-data/moerasdraak/game';
const mocks = vi.hoisted(() => ({ context: {} as Record<string, unknown>, get: vi.fn(), audio: { narration: { playing: false, source: '' }, effectPlaying: false, soundEnabled: true, toggleNarration: vi.fn(), stopNarration: vi.fn() } }));
vi.mock('../../app/gameContext', () => ({ useGame: () => mocks.context }));
vi.mock('../audio/audioContext', () => ({ useAudio: () => mocks.audio }));
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), getTeamSpacing: (...args: unknown[]) => mocks.get(...args) }));
vi.mock('../../components/GameUi', () => ({ PageShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/HintHenkIntro', () => ({ HenkFlame: () => <span>Henk</span> }));
let host: HTMLDivElement; let root: Root;
const schedule = { eventId: 'event', scheduledAt: '2026-10-28T12:05:00Z', departedAt: null, enabled: true };
async function render(path = '/route') {
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}><TeamSpacing><p>Spelscherm</p></TeamSpacing></MemoryRouter>); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.context = { activeTeam: { id: 'team', name: 'Speurneuzen' }, teamSessionId: 'session', progress: createInitialProgress('team', gamePack), syncNow: vi.fn() };
  mocks.get.mockResolvedValue({ serverNow: new Date().toISOString(), schedule: null, noticeId: null });
  mocks.audio.toggleNarration.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.clearAllMocks(); });
it('gates direct challenge links with a countdown before departure', async () => {
  mocks.get.mockResolvedValue({ serverNow: new Date().toISOString(), schedule, noticeId: null });
  await render('/challenge/drakenfontein');
  expect(host.textContent).toContain('05:00');
  expect(host.textContent).not.toContain('Spelscherm');
  expect(host.querySelector('button')?.disabled).toBe(true);
});
it('records departure when due and returns to the game', async () => {
  const due = { ...schedule, scheduledAt: new Date().toISOString() };
  mocks.get.mockResolvedValueOnce({ serverNow: new Date().toISOString(), schedule: due, noticeId: null })
    .mockResolvedValue({ serverNow: new Date().toISOString(), schedule: { ...due, departedAt: new Date().toISOString() }, noticeId: null });
  await render(); await act(async () => host.querySelector('button')?.click());
  expect(mocks.get).toHaveBeenCalledWith('session', true);
  expect(host.textContent).toContain('Spelscherm');
});
it('does not interrupt a puzzle with Henk', async () => {
  mocks.get.mockResolvedValue({ serverNow: new Date().toISOString(), schedule: null, noticeId: 'notice' });
  await render('/challenge/drakenfontein'); await act(async () => { vi.advanceTimersByTime(2000); });
  expect(host.textContent).not.toContain('Even ruimte geven');
  expect(mocks.audio.toggleNarration).not.toHaveBeenCalled();
});
it('shows Henk on the route once and shares dismissal', async () => {
  mocks.get.mockResolvedValue({ serverNow: new Date().toISOString(), schedule: null, noticeId: 'notice' });
  await render(); await act(async () => { vi.advanceTimersByTime(1000); });
  expect(host.textContent).toContain('Even ruimte geven');
  expect(mocks.audio.toggleNarration).toHaveBeenCalledTimes(1);
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === 'Begrepen, Henk');
  await act(async () => button?.click());
  expect(mocks.get).toHaveBeenCalledWith('session', false, 'notice');
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(host.textContent).not.toContain('Even ruimte geven');
});
it('allows play if the advisory service fails or the device is offline', async () => {
  mocks.get.mockRejectedValue(new Error('offline')); await render();
  expect(host.textContent).toContain('Spelscherm');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await act(async () => window.dispatchEvent(new Event('offline')));
  expect(host.textContent).toContain('Spelscherm');
});
