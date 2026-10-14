import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { buildAssetManifest } from '../offline/offlinePack';
import { allHenkReminderAudio, henkReminderAudio } from './henkReminderAudio';
import clips from './henkReminderClips.json';

describe('Hint Henk reminder recordings', () => {
  it('provides the passage and all six spoken counts as local offline audio', () => {
    const manifest = buildAssetManifest(gamePack);
    expect(allHenkReminderAudio()).toHaveLength(7);
    expect(henkReminderAudio().transcript).toContain('nog een drakenschub');
    for (let count = 1; count <= 6; count += 1) {
      const clip = henkReminderAudio(count);
      expect(clip.transcript).toContain(`${count} ${count === 1 ? 'schub!' : 'schubben!'}`);
      expect(manifest).toContain(clip.source);
      expect(clip.durationSeconds).toBeGreaterThan(1);
    }
    for (const source of allHenkReminderAudio()) expect(manifest).toContain(source);
    for (const entry of Object.values(clips)) {
      expect(readFileSync(resolve('public/audio/hint-henk/reminders', entry.file)).byteLength).toBeGreaterThan(1000);
    }
  });
});
