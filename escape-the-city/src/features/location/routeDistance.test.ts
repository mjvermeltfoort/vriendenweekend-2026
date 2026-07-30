import { describe, expect, it } from 'vitest';
import type { RouteGeoJson } from '../map/mapTypes';
import {
  activeRouteLeg,
  filterWalkingDistance,
  formattedWalkingDistance,
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

  it('includes perpendicular off-route distance in the total', () => {
    const leg = activeRouteLeg(route, 'b')!;
    // User 18 km north of the route (roughly 0.16 degrees latitude away)
    const farAway = remainingRouteDistance(leg, { longitude: 5.3005, latitude: 51.85 });
    // On-route projected distance is small, but off-route component pushes total >> 1000 m
    expect(farAway).toBeGreaterThan(10_000);
  });

  it('rounds, takes the median and applies status boundaries', () => {
    expect(roundedWalkingDistance(437)).toBe(440);
    expect(roundedWalkingDistance(83)).toBe(85);
    expect(median([80, 900, 85])).toBe(85);
    expect([501, 500, 150, 60].map(walkingStatus)).toEqual([
      'Op weg', 'Je komt dichterbij', 'In de buurt', 'Bijna daar'
    ]);
  });

  it('formats distances as meters below 1 km and km above', () => {
    expect(formattedWalkingDistance(80)).toBe('80 m');
    expect(formattedWalkingDistance(437)).toBe('440 m');
    expect(formattedWalkingDistance(1000)).toBe('1 km');
    expect(formattedWalkingDistance(1300)).toBe('1,5 km');
    expect(formattedWalkingDistance(18070)).toBe('18 km');
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
