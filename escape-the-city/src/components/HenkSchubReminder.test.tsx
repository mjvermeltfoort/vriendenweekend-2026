import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gamePack } from '../game-data/moerasdraak/game';
import { createInitialProgress } from '../features/game/gameState';
import type { LocationResult } from '../features/location/provider';
import { HenkSchubReminder } from './HenkSchubReminder';

const mock = vi.hoisted(() => ({ game: {} as Record<string, unknown>, audio: {
  soundEnabled: false, effectPlaying: false,
  narration: { source: null as string | null, playing: false, error: '' },
  toggleNarration: vi.fn(), stopNarration: vi.fn(), toggleSound: vi.fn()
} }));
vi.mock('../app/gameContext', () => ({ useGame: () => mock.game }));
vi.mock('../features/audio/audioContext', () => ({ useAudio: () => mock.audio }));
function Harness() {
  const location = useLocation();
  return <><output>{location.pathname}{location.search}</output><Link to="/route">Route testen</Link><HenkSchubReminder pack={gamePack} /></>;
}
describe('Hint Henk schub reminders', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let progress: ReturnType<typeof createInitialProgress>;
  const bonus = gamePack.bonusLocations![0];
  const render = (path = '/route') => act(() => root.render(<MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter>));
  const tick = () => act(() => vi.advanceTimersByTime(1000));
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
  function position(distance: number) {
    const deviceLocation: LocationResult = { latitude: bonus.coordinates.latitude! + distance / 111195, longitude: bonus.coordinates.longitude!, accuracy: 5, capturedAt: new Date().toISOString() };
    mock.game = { ...mock.game, deviceLocation };
    render(); tick();
  }
  function pass() { position(10); position(bonus.coordinates.discoveryRadiusMeters + 150); }
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T18:00:00Z')); vi.clearAllMocks(); localStorage.clear();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    progress = createInitialProgress('a', gamePack); progress.stopProgress.drakenfontein.state = 'arrived';
    mock.game = { activeTeam: { id: 'a' }, progress, deviceLocation: null, locationError: null };
    mock.audio.soundEnabled = false; mock.audio.narration = { source: null, playing: false, error: '' };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false; });

  it('shows a free reminder after passing, respects mute and focuses the schub on the map', () => {
    render(); pass();
    expect(container.querySelector('.henk-hint')).not.toBeNull();
    expect(container.textContent).toContain('kost geen punten');
    expect(mock.audio.toggleNarration).not.toHaveBeenCalled();
    act(() => button('Laat zien op de kaart').click());
    expect(container.querySelector('output')!.textContent).toBe(`/route?schub=${encodeURIComponent(bonus.id)}`);
    expect(container.querySelector('.henk-hint')).toBeNull();
    expect(progress.totalHintsUsed).toBe(0);
    tick(); expect(container.querySelector('.henk-hint')).toBeNull();
  });
  it('defers to other dialogs and narration, then shows the pending reminder', () => {
    const other = document.createElement('div'); other.setAttribute('role', 'dialog'); document.body.append(other);
    try { render(); pass(); expect(container.querySelector('.henk-hint')).toBeNull(); } finally { other.remove(); }
    mock.audio.narration.playing = true; render(); tick(); expect(container.querySelector('.henk-hint')).toBeNull();
    mock.audio.narration.playing = false; render(); tick(); expect(container.querySelector('.henk-hint')).not.toBeNull();
  });
  it('does not interrupt a challenge, but can remind on returning to the route', () => {
    render('/challenge/drakenfontein'); pass(); expect(container.querySelector('.henk-hint')).toBeNull();
    act(() => container.querySelector('a')!.click()); tick(); expect(container.querySelector('.henk-hint')).not.toBeNull();
  });
  it('dismisses via Escape and never repeats after reloading this team', () => {
    render(); pass();
    act(() => container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
    act(() => root.render(null)); render(); tick();
    expect(container.querySelector('.henk-hint')).toBeNull();
  });
  it('shows the correct final count once and lets the team proceed', () => {
    for (const stop of gamePack.stops.slice(0, -1)) progress.stopProgress[stop.id].state = 'completed';
    progress.stopProgress[gamePack.finalStopId].state = 'available';
    render();
    expect(container.textContent).toContain('6 schubben');
    act(() => button('Door naar de finale').click());
    expect(container.querySelector('output')!.textContent).toBe(`/stop/${gamePack.finalStopId}`);
    tick(); expect(container.querySelector('.henk-hint')).toBeNull();
  });
  it('opens the missing-schub overview from the final summary', () => {
    for (const stop of gamePack.stops.slice(0, -1)) progress.stopProgress[stop.id].state = 'completed';
    progress.stopProgress[gamePack.finalStopId].state = 'available'; render();
    act(() => button('Bekijk ontbrekende schubben').click());
    expect(container.querySelector('output')!.textContent).toBe('/route?schubben=ontbrekend');
  });
  it('does not show a final summary when every schub is completed', () => {
    for (const stop of [...gamePack.stops.slice(0, -1), ...gamePack.bonusLocations!]) progress.stopProgress[stop.id].state = 'completed';
    progress.stopProgress[gamePack.finalStopId].state = 'available'; render(); tick();
    expect(container.querySelector('.henk-hint')).toBeNull();
  });
});
