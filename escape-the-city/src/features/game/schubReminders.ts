import type { BonusLocation } from './gameTypes';
import type { LocationResult } from '../location/provider';
import { haversineDistanceMeters } from '../location/distance';

export const REMINDER_COOLDOWN_MS = 10 * 60_000;
export const REMINDER_STORAGE_PREFIX = 'moerasdraak-henk-schub-reminders:v1:';
const MAX_FIX_AGE_MS = 30_000;
const ENCOUNTER_LIFETIME_MS = 6 * 60 * 60_000;

interface Encounter {
  closest: number;
  previous: number;
  fixAt: number;
  passed: boolean;
}
export interface SchubReminderState {
  encounters: Record<string, Encounter>;
  notified: string[];
  lastShownAt: number;
  finaleShown: boolean;
}
export type SchubReminder = { kind: 'passed'; bonusId: string } | { kind: 'finale'; bonusIds: string[] };

export function emptySchubReminders(): SchubReminderState {
  return { encounters: {}, notified: [], lastShownAt: 0, finaleShown: false };
}

export function loadSchubReminders(teamId: string): SchubReminderState {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDER_STORAGE_PREFIX + teamId) ?? 'null');
    if (!raw || !Array.isArray(raw.notified) || !raw.encounters || !Number.isFinite(raw.lastShownAt)) return emptySchubReminders();
    const encounters = Object.fromEntries(Object.entries(raw.encounters).filter(([, value]) => {
      const e = value as Encounter | null;
      return e && Number.isFinite(e.closest) && e.closest >= 0 && Number.isFinite(e.previous) && Number.isFinite(e.fixAt) && typeof e.passed === 'boolean';
    }));
    return { encounters: encounters as Record<string, Encounter>, notified: raw.notified.filter((id: unknown) => typeof id === 'string'), lastShownAt: raw.lastShownAt, finaleShown: raw.finaleShown === true };
  } catch { return emptySchubReminders(); }
}

export function saveSchubReminders(teamId: string, state: SchubReminderState) {
  try { localStorage.setItem(REMINDER_STORAGE_PREFIX + teamId, JSON.stringify(state)); } catch { /* In-memory limits still apply when storage is unavailable. */ }
}

export function reliableReminderFix(fix: LocationResult | null, now: number) {
  if (!fix || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 || !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180
    || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 40) return false;
  const timestamp = Date.parse(fix.capturedAt ?? '');
  return Number.isFinite(timestamp) && timestamp <= now + 5000 && now - timestamp <= MAX_FIX_AGE_MS;
}

/** Only confirmed close approaches can become a passed schub; GPS uncertainty is subtracted from movement. */
export function observeSchubs(state: SchubReminderState, missing: BonusLocation[], fix: LocationResult | null, now: number): SchubReminderState {
  if (!reliableReminderFix(fix, now) || !fix) return state;
  const fixAt = Date.parse(fix.capturedAt!);
  let next = state;
  for (const bonus of missing) {
    if (state.notified.includes(bonus.id) || fix.accuracy > bonus.coordinates.maximumAccuracyMeters
      || bonus.coordinates.latitude === null || bonus.coordinates.longitude === null) continue;
    const distance = haversineDistanceMeters(fix, { latitude: bonus.coordinates.latitude, longitude: bonus.coordinates.longitude });
    const previous = state.encounters[bonus.id];
    if (previous && fixAt <= previous.fixAt) continue;
    const recent = previous && now - previous.fixAt <= ENCOUNTER_LIFETIME_MS ? previous : undefined;
    const near = distance + fix.accuracy <= bonus.coordinates.discoveryRadiusMeters;
    if (!recent && !near) continue;
    const closest = Math.min(recent?.closest ?? distance, distance);
    const turningBack = recent && distance + 15 < recent.previous;
    const passed = !near && !turningBack && distance - fix.accuracy >= closest + 100
      && distance - fix.accuracy > bonus.coordinates.discoveryRadiusMeters
      && Boolean(recent && (recent.passed || distance > recent.previous + 5));
    if (next === state) next = { ...state, encounters: { ...state.encounters } };
    next.encounters[bonus.id] = { closest, previous: distance, fixAt, passed };
  }
  return next;
}

export function nextSchubReminder(state: SchubReminderState, missing: BonusLocation[], finaleEligible: boolean, fix: LocationResult | null, now: number): SchubReminder | null {
  if (!missing.length || (state.lastShownAt > 0 && now - state.lastShownAt < REMINDER_COOLDOWN_MS)) return null;
  if (finaleEligible && !state.finaleShown) return { kind: 'finale', bonusIds: missing.map((b) => b.id) };
  if (!reliableReminderFix(fix, now)) return null;
  const passed = missing.find((b) => !state.notified.includes(b.id) && state.encounters[b.id]?.passed
    && now - state.encounters[b.id].fixAt <= MAX_FIX_AGE_MS);
  return passed ? { kind: 'passed', bonusId: passed.id } : null;
}

export function markSchubReminderShown(state: SchubReminderState, reminder: SchubReminder, now: number): SchubReminderState {
  return { ...state, lastShownAt: now, finaleShown: state.finaleShown || reminder.kind === 'finale',
    notified: reminder.kind === 'passed' ? [...new Set([...state.notified, reminder.bonusId])] : state.notified };
}
