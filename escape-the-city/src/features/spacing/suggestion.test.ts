import { expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { createInitialProgress } from '../game/gameState';
import { spacingSchub } from './suggestion';
import { countdown } from './api';
it('counts down with server-adjusted time, clamped at zero', () => {
  expect(countdown('2026-10-28T12:05:00Z', Date.parse('2026-10-28T12:01:18Z'))).toBe('03:42');
  expect(countdown('2026-10-28T12:05:00Z', Date.parse('2026-10-28T12:06:00Z'))).toBe('00:00');
});
it('only offers an unfinished visible schub on this leg near a current location', () => {
  const progress = createInitialProgress('test', gamePack);
  const b = gamePack.bonusLocations![0];
  const fix = { latitude: b.coordinates.latitude!, longitude: b.coordinates.longitude! };
  progress.currentStopId = b.recommendedBetween.beforeStopId;
  expect(spacingSchub(gamePack, progress, fix)).toBeNull();
  progress.stopProgress[b.visibleAfterStopId].state = 'completed';
  expect(spacingSchub(gamePack, progress, fix)?.id).toBe(b.id);
  expect(spacingSchub(gamePack, progress, null)).toBeNull();
  expect(spacingSchub(gamePack, progress, { latitude: 52, longitude: 5 })).toBeNull();
  progress.stopProgress[b.id].state = 'completed';
  expect(spacingSchub(gamePack, progress, fix)).toBeNull();
});
