import { describe, expect, it } from 'vitest';
import type { RouteGeoJson } from '../map/mapTypes';
import {
  activeRouteLeg,
  filterWalkingDistance,
  median,
  remainingRouteDistance,
  roundedWalkingDistance,
  routeLegLength,
  walkingStatus,
  type DistanceFilterState
} from './routeDistance';

const route: RouteGeoJson = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { legIndex: 0, fromStopId: 'a', toStopId: 'b', corridor: 'test' },
    geometry: {
      type: 'LineString',
      coordinates: [[5.3, 51.69], [5.301, 51.69], [5.301, 51.691]]
    }
  }]
};

describe('walking route distance', () => {
  it('selects the incoming leg and projects onto its closest segment', () => {
    const leg = activeRouteLeg(route, 'b')!;
    const total = routeLegLength(leg);
    const remaining = remainingRouteDistance(leg, { longitude: 5.3005, latitude: 51.69 });
    expect(total).toBeGreaterThan(170);
    expect(remaining).toBeGreaterThan(140);
    expect(remaining).toBeLessThan(total);
    expect(activeRouteLeg(route, 'a')).toBeNull();
  });

  it('rounds, takes the median and applies status boundaries', () => {
    expect(roundedWalkingDistance(437)).toBe(440);
    expect(roundedWalkingDistance(83)).toBe(85);
    expect(median([80, 900, 85])).toBe(85);
    expect([501, 500, 150, 60].map(walkingStatus)).toEqual([
      'Op weg', 'Je komt dichterbij', 'In de buurt', 'Bijna daar'
    ]);
  });

  it('accepts decreases immediately and delays meaningful increases', () => {
    let state: DistanceFilterState = { samples: [100, 100, 100], displayed: 100, increaseCount: 0 };
    state = filterWalkingDistance(state, 80);
    expect(state.displayed).toBe(80);
    state = filterWalkingDistance(state, 70);
    expect(state.displayed).toBe(70);
    state = { samples: [80, 80, 80], displayed: 80, increaseCount: 0 };
    state = filterWalkingDistance(state, 120);
    state = filterWalkingDistance(state, 120);
    expect(state.displayed).toBe(120);
  });
});
