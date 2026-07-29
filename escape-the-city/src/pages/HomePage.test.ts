import { describe, expect, it } from 'vitest';
import { isHomeSyncStatusVisible } from './HomePage';

describe('HomePage sync status', () => {
  it('hides the saved status', () => {
    expect(isHomeSyncStatusVisible('saved')).toBe(false);
  });

  it.each(['failed', 'offline', 'local', 'syncing'] as const)('shows %s status', (status) => {
    expect(isHomeSyncStatusVisible(status)).toBe(true);
  });
});
