import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { buildAssetManifest } from '../offline/offlinePack';
import { allHenkAudio, henkConfirmation, henkHint } from './hintHenkAudio';
import clips from './hintHenkClips.json';

describe('Hint Henk production recordings', () => {
  it('covers every main and bonus hint with matching speech, a local mp3 and offline preparation', () => {
    const assets = buildAssetManifest(gamePack);
    for (const stop of [...gamePack.stops, ...(gamePack.bonusLocations ?? [])]) {
      for (const hint of stop.hints) {
        const recording = henkHint(stop.id, hint.id)!;
        expect(recording.transcript).toContain(hint.text);
        expect(recording.durationSeconds).toBeGreaterThan(1);
        expect(assets).toContain(recording.source);
      }
    }
    expect(allHenkAudio()).toHaveLength(14);
    expect(assets).toContain(henkConfirmation.source);
    for (const entry of Object.values(clips)) {
      const path = resolve('public/audio/hint-henk', entry.file);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path).byteLength).toBeGreaterThan(1000);
    }
  });
});
