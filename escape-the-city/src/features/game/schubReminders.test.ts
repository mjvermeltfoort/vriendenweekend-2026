import { beforeEach, describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { emptySchubReminders, loadSchubReminders, markSchubReminderShown, nextSchubReminder, observeSchubs, REMINDER_COOLDOWN_MS, REMINDER_STORAGE_PREFIX, saveSchubReminders } from './schubReminders';

const bonus = gamePack.bonusLocations![0];
const now = Date.parse('2026-10-14T18:00:00Z');
function fix(distance: number, at = now, accuracy = 5) {
  return { latitude: bonus.coordinates.latitude! + distance / 111195, longitude: bonus.coordinates.longitude!, accuracy, capturedAt: new Date(at).toISOString() };
}
function passed() {
  const near = observeSchubs(emptySchubReminders(), [bonus], fix(10), now);
  return observeSchubs(near, [bonus], fix(bonus.coordinates.discoveryRadiusMeters + 150, now + 1000), now + 1000);
}

describe('schub reminder GPS and frequency rules', () => {
  beforeEach(() => localStorage.clear());
  it('requires a reliable close approach before walking about 100 metres away', () => {
    let state = observeSchubs(emptySchubReminders(), [bonus], fix(400), now);
    expect(nextSchubReminder(state, [bonus], false, fix(400), now)).toBeNull();
    state = observeSchubs(state, [bonus], fix(10, now + 1000), now + 1000);
    state = observeSchubs(state, [bonus], fix(80, now + 2000), now + 2000);
    expect(nextSchubReminder(state, [bonus], false, fix(80, now + 2000), now + 2000)).toBeNull();
    const far = fix(bonus.coordinates.discoveryRadiusMeters + 150, now + 3000);
    state = observeSchubs(state, [bonus], far, now + 3000);
    expect(nextSchubReminder(state, [bonus], false, far, now + 3000)).toEqual({ kind: 'passed', bonusId: bonus.id });
  });
  it('ignores inaccurate, missing, invalid, future and old GPS measurements', () => {
    for (const sample of [fix(10, now, 80), fix(10, now - 31_000), fix(10, now + 10_000), { ...fix(10), latitude: NaN }, { ...fix(10), accuracy: -1 }, { ...fix(10), capturedAt: undefined }, null]) {
      const initial = emptySchubReminders();
      expect(observeSchubs(initial, [bonus], sample, now)).toBe(initial);
    }
    expect(nextSchubReminder(passed(), [bonus], false, fix(400, now, 80), now + 1000)).toBeNull();
    expect(nextSchubReminder(passed(), [bonus], false, fix(400), now + 60_000)).toBeNull();
  });
  it('does not treat GPS uncertainty at the discovery boundary as a close approach', () => {
    const state = observeSchubs(emptySchubReminders(), [bonus], fix(bonus.coordinates.discoveryRadiusMeters - 5, now, 20), now);
    expect(state.encounters).toEqual({});
  });
  it('cancels a pending reminder when the team turns back', () => {
    const state = observeSchubs(passed(), [bonus], fix(50, now + 2000), now + 2000);
    expect(nextSchubReminder(state, [bonus], false, fix(50, now + 2000), now + 2000)).toBeNull();
  });
  it('never reminds about completed or still invisible schubs', () => {
    expect(nextSchubReminder(passed(), [], false, fix(400), now)).toBeNull();
  });
  it('remembers shown schubs across reloads and isolates teams', () => {
    const state = markSchubReminderShown(passed(), { kind: 'passed', bonusId: bonus.id }, now);
    saveSchubReminders('a', state);
    const later = now + REMINDER_COOLDOWN_MS;
    const reloaded = observeSchubs(loadSchubReminders('a'), [bonus], fix(500, later), later);
    expect(nextSchubReminder(reloaded, [bonus], false, fix(500, later), later)).toBeNull();
    expect(loadSchubReminders('b')).toEqual(emptySchubReminders());
  });
  it('enforces ten minutes between reminders, including the final summary', () => {
    const state = markSchubReminderShown(passed(), { kind: 'passed', bonusId: bonus.id }, now);
    expect(nextSchubReminder(state, [bonus], true, null, now + REMINDER_COOLDOWN_MS - 1)).toBeNull();
    expect(nextSchubReminder(state, [bonus], true, null, now + REMINDER_COOLDOWN_MS)).toEqual({ kind: 'finale', bonusIds: [bonus.id] });
  });
  it('prioritizes the final summary and shows it once, without requiring GPS', () => {
    const reminder = nextSchubReminder(passed(), [bonus], true, null, now + 1000)!;
    expect(reminder.kind).toBe('finale');
    const state = markSchubReminderShown(emptySchubReminders(), reminder, now);
    expect(nextSchubReminder(state, [bonus], true, null, now + REMINDER_COOLDOWN_MS)).toBeNull();
  });
  it('handles unavailable or corrupted storage', () => {
    localStorage.setItem(REMINDER_STORAGE_PREFIX + 'a', '{');
    expect(loadSchubReminders('a')).toEqual(emptySchubReminders());
    localStorage.setItem(REMINDER_STORAGE_PREFIX + 'a', JSON.stringify({ notified: [], encounters: { bad: {} }, lastShownAt: now }));
    expect(loadSchubReminders('a').encounters).toEqual({});
  });
});
