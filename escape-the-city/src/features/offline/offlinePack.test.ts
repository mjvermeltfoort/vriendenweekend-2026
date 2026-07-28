import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { buildAssetManifest, ROUTE_OFFLINE_ASSETS } from './offlinePack';

describe('route offline assets', () => {
  it('adds GeoJSON and WebP to the preparation manifest', () => {
    const manifest = buildAssetManifest(gamePack);

    expect(manifest).toEqual(expect.arrayContaining([...ROUTE_OFFLINE_ASSETS]));
  });

  it('includes GeoJSON in the PWA precache glob', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(config).toContain('webp,geojson');
  });

  it('ships both route assets in public', () => {
    expect(readFileSync(resolve(process.cwd(), 'public/routes/moerasdraak-den-bosch.geojson')).byteLength).toBeGreaterThan(1000);
    expect(readFileSync(resolve(process.cwd(), 'public/maps/route-map-fallback.webp')).byteLength).toBeGreaterThan(10000);
  });
});
