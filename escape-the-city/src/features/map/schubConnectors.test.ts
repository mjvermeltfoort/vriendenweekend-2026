import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gamePack } from '../../game-data/moerasdraak/game';
import { haversineDistanceMeters } from '../location/distance';
import { nearbyConnectorBonus, schubConnectorFor, schubConnectors } from './schubConnectors';
import type { RouteGeoJson } from './mapTypes';

const route = JSON.parse(readFileSync(resolve(process.cwd(), 'public/routes/moerasdraak-den-bosch.geojson'), 'utf8')) as RouteGeoJson;

describe('offline schub connectors', () => {
  it('connects every schub to an exact vertex on every possible active leg', () => {
    expect(schubConnectors).toHaveLength(gamePack.bonusLocations!.length * route.features.length);
    for (const bonus of gamePack.bonusLocations!) {
      for (const leg of route.features) {
        const feature = schubConnectorFor(bonus.id, leg.properties.legIndex)!;
        expect(feature).not.toBeNull();
        const points = feature.geometry.coordinates;
        expect(points.length).toBeGreaterThanOrEqual(2);
        expect(haversineDistanceMeters(bonus.coordinates as { latitude: number; longitude: number }, {
          longitude: points[0][0], latitude: points[0][1]
        })).toBeLessThan(1);
        expect(points.at(-1)).toEqual(leg.geometry.coordinates[feature.properties.joinIndex]);
        for (const [longitude, latitude] of points) {
          expect(longitude).toBeGreaterThan(5.29);
          expect(longitude).toBeLessThan(5.313);
          expect(latitude).toBeGreaterThan(51.685);
          expect(latitude).toBeLessThan(51.7);
        }
      }
    }
  });

  it('takes the street crossing at Bolwerk rather than a direct line across the canal', () => {
    const feature = schubConnectorFor('bonus:bolwerk-sint-jan', 1)!;
    expect(feature.geometry.coordinates.length).toBeGreaterThan(6);
    expect(feature.geometry.coordinates).toContainEqual([5.2992005, 51.6895433]);
    expect(feature.geometry.coordinates.at(-1)).toEqual([5.2998, 51.689722]);
  });

  it('does not expose a connector for an absent active leg or unknown schub', () => {
    expect(schubConnectorFor('bonus:citadel', null)).toBeNull();
    expect(schubConnectorFor(null, 1)).toBeNull();
    expect(schubConnectorFor('unknown', 1)).toBeNull();
  });

  it('recognises a visited schub from GPS without needing it to be unfinished', () => {
    const bonus = gamePack.bonusLocations![0];
    const fix = { latitude: bonus.coordinates.latitude!, longitude: bonus.coordinates.longitude!, accuracy: 8 };
    expect(nearbyConnectorBonus(fix, [bonus])).toBe(bonus.id);
    expect(nearbyConnectorBonus({ ...fix, accuracy: 80 }, [bonus])).toBeNull();
    expect(nearbyConnectorBonus(fix, [])).toBeNull();
  });
});
