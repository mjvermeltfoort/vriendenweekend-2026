import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { createAccuracyPolygon } from '../features/map/mapTypes';
import { gamePack } from '../game-data/moerasdraak/game';
import { MAX_VISUAL_ACCURACY_M, teamHealth, type DashboardTeam } from './types';

export function stopFeatures(): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: gamePack.stops.map((stop) => ({
      type: 'Feature',
      properties: { id: stop.id, order: stop.order, title: stop.shortTitle },
      geometry: {
        type: 'Point',
        coordinates: [stop.coordinates.longitude!, stop.coordinates.latitude!]
      }
    }))
  };
}

export function teamMarkerFeatures(teams: DashboardTeam[], selectedTeamId: string | null, now = Date.now()): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: teams.flatMap((team): Feature<Point>[] => team.location ? [{
      type: 'Feature',
      id: team.id,
      properties: {
        id: team.id,
        name: team.name,
        selected: team.id === selectedTeamId,
        health: teamHealth(team, now),
        accuracyM: team.location.accuracyM
      },
      geometry: {
        type: 'Point',
        coordinates: [team.location.longitude, team.location.latitude]
      }
    }] : [])
  };
}

export function accuracyFeatures(teams: DashboardTeam[], selectedTeamId: string | null, now = Date.now()): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: teams.flatMap((team): Feature<Polygon>[] => team.location ? [{
      type: 'Feature',
      id: team.id,
      properties: {
        id: team.id,
        selected: team.id === selectedTeamId,
        health: teamHealth(team, now),
        actualAccuracyM: team.location.accuracyM,
        visualAccuracyM: Math.min(team.location.accuracyM, MAX_VISUAL_ACCURACY_M)
      },
      geometry: createAccuracyPolygon({
        latitude: team.location.latitude,
        longitude: team.location.longitude,
        accuracy: Math.min(team.location.accuracyM, MAX_VISUAL_ACCURACY_M)
      })
    }] : [])
  };
}
