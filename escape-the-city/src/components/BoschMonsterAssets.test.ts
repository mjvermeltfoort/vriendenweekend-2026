import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../assets/bosch/manifest.json';
import { gamePack } from '../game-data/moerasdraak/game';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
describe('Bosch asset and release contract', () => {
  it('ships nine transparent 512×640 WebP canvases with manifest paths', () => {
    const paths = Object.values(manifest.files).map(file => file.webp);
    expect(paths).toHaveLength(9);
    for (const path of paths) {
      const file = readFileSync(resolve(process.cwd(), 'src/assets/bosch', path));
      expect(file.toString('ascii', 0, 4)).toBe('RIFF');
      expect(file.toString('ascii', 8, 12)).toBe('WEBP');
      // Extended WebP header: alpha bit and 24-bit canvas dimensions.
      expect(file.toString('ascii', 12, 16)).toBe('VP8X');
      expect(file[20] & 0x10).toBe(0x10);
      expect(file.readUIntLE(24, 3) + 1).toBe(512);
      expect(file.readUIntLE(27, 3) + 1).toBe(640);
    }
    expect(manifest.renderOrder).toEqual(['legs', 'head', 'body']);
  });
  it('uses the identical manifest answer in the pack and forward-only server update', () => {
    const challenge = gamePack.stops.find(stop => stop.id === 'bosch-wezen')!.challenge;
    if (challenge.kind !== 'composite') throw new Error('Missing composite');
    expect(challenge.correctAnswer).toEqual(manifest.correctAnswer);
    const migration = read('../supabase/migrations/039_bosch_boomman_assets.sql');
    expect(migration).toContain("'head', 'human', 'body', 'egg', 'object', 'trees'");
    expect(migration).not.toMatch(/latitude\s*=|longitude\s*=|grant |create |delete /i);
    expect(read('../supabase/migrations/038_bosch_statue_monster_challenge.sql')).toContain("'head', 'Vogel'");
  });
  it('keeps compact 44px controls, shared canvases, vertical touch scrolling and reduced motion', () => {
    const css = read('src/components/BoschMonsterPuzzle.css');
    expect(css).toContain('touch-action: pan-y');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('width: min(100%, 240px)');
    expect(css).toContain('aspect-ratio: 4 / 5');
    expect(css).toContain('.bosch-art--alive, .bosch-art img { animation: none; }');
    expect(read('vite.config.ts')).toContain('png,jpg,svg,webp');
    expect(readdirSync(resolve(process.cwd(), 'src/assets/bosch'))).toContain('original.jpg');
  });
});
