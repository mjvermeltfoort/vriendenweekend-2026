import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { applyMoerasdraakTheme, MAP_STYLE_URL } from '../features/map/mapStyle';
import { accuracyFeatures, stopFeatures, teamMarkerFeatures } from './mapData';
import type { DashboardTeam } from './types';

interface DashboardMapProps {
  teams: DashboardTeam[];
  selectedTeamId: string | null;
  now: number;
  onSelect: (teamId: string) => void;
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const dashboardBounds: [[number, number], [number, number]] = [
  [5.2925, 51.6855],
  [5.3135, 51.699]
];

function interpolateMarkers(
  from: FeatureCollection<Point>,
  to: FeatureCollection<Point>,
  progress: number
): FeatureCollection<Point> {
  const oldCoordinates = new Map(from.features.map((feature) => [
    String(feature.id),
    feature.geometry.coordinates
  ]));
  return {
    type: 'FeatureCollection',
    features: to.features.map((feature) => {
      const previous = oldCoordinates.get(String(feature.id));
      if (!previous) return feature;
      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [
            previous[0] + (feature.geometry.coordinates[0] - previous[0]) * progress,
            previous[1] + (feature.geometry.coordinates[1] - previous[1]) * progress
          ]
        }
      };
    })
  };
}

export function DashboardMap({ teams, selectedTeamId, now, onSelect }: DashboardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latestSelectRef = useRef(onSelect);
  const markerDataRef = useRef<FeatureCollection<Point>>(empty as FeatureCollection<Point>);
  const animationRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  latestSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let map: MapLibreMap | null = null;

    void Promise.all([
      import('maplibre-gl'),
      fetch('/escape-the-city/routes/moerasdraak-den-bosch.geojson').then((response) => {
        if (!response.ok) throw new Error('Routebestand kon niet worden geladen.');
        return response.json();
      })
    ]).then(([maplibre, route]) => {
      if (disposed || !containerRef.current) return;
      map = new maplibre.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        bounds: dashboardBounds,
        fitBoundsOptions: { padding: 54 },
        attributionControl: false
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      map.once('load', () => {
        if (!map || disposed) return;
        applyMoerasdraakTheme(map);
        map.addSource('dashboard-route', { type: 'geojson', data: route });
        map.addSource('dashboard-stops', { type: 'geojson', data: stopFeatures() });
        map.addSource('dashboard-accuracy', { type: 'geojson', data: empty });
        map.addSource('dashboard-teams', { type: 'geojson', data: empty });
        map.addLayer({
          id: 'dashboard-route',
          type: 'line',
          source: 'dashboard-route',
          paint: { 'line-color': '#d8aa55', 'line-width': 4, 'line-opacity': 0.75 }
        });
        map.addLayer({
          id: 'dashboard-accuracy',
          type: 'fill',
          source: 'dashboard-accuracy',
          paint: {
            'fill-color': ['case', ['get', 'selected'], '#f3ca76', '#35d4c7'],
            'fill-opacity': ['case', ['get', 'selected'], 0.24, 0.1]
          }
        });
        map.addLayer({
          id: 'dashboard-accuracy-outline',
          type: 'line',
          source: 'dashboard-accuracy',
          paint: {
            'line-color': ['case', ['get', 'selected'], '#f3ca76', '#35d4c7'],
            'line-width': ['case', ['get', 'selected'], 3, 1.5],
            'line-opacity': 0.7
          }
        });
        map.addLayer({
          id: 'dashboard-stops',
          type: 'circle',
          source: 'dashboard-stops',
          paint: {
            'circle-radius': 6,
            'circle-color': '#10251c',
            'circle-stroke-color': '#e0bc78',
            'circle-stroke-width': 2
          }
        });
        map.addLayer({
          id: 'dashboard-stop-labels',
          type: 'symbol',
          source: 'dashboard-stops',
          layout: {
            'text-field': ['concat', ['to-string', ['get', 'order']], '. ', ['get', 'title']],
            'text-size': 11,
            'text-offset': [0, 1.25],
            'text-anchor': 'top'
          },
          paint: { 'text-color': '#f4e6c5', 'text-halo-color': '#07100d', 'text-halo-width': 2 }
        });
        map.addLayer({
          id: 'dashboard-teams',
          type: 'circle',
          source: 'dashboard-teams',
          paint: {
            'circle-radius': ['case', ['get', 'selected'], 11, 8],
            'circle-color': [
              'match', ['get', 'health'],
              'healthy', '#35d4c7',
              'location-problem', '#e0a84f',
              'completed', '#d8aa55',
              '#77857d'
            ],
            'circle-opacity': ['case', ['==', ['get', 'health'], 'inactive'], 0.55, 1],
            'circle-stroke-color': ['case', ['get', 'selected'], '#fff0bd', '#07100d'],
            'circle-stroke-width': ['case', ['get', 'selected'], 4, 2]
          }
        });
        map.addLayer({
          id: 'dashboard-team-labels',
          type: 'symbol',
          source: 'dashboard-teams',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-offset': [0, -1.3],
            'text-anchor': 'bottom'
          },
          paint: { 'text-color': '#f4e6c5', 'text-halo-color': '#07100d', 'text-halo-width': 2 }
        });
        map.on('click', 'dashboard-teams', (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === 'string') latestSelectRef.current(id);
        });
        map.on('mouseenter', 'dashboard-teams', () => { if (map) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'dashboard-teams', () => { if (map) map.getCanvas().style.cursor = ''; });
        setReady(true);
      });
    }).catch((reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : 'Kaart kon niet worden geladen.');
    });

    return () => {
      disposed = true;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const nextMarkers = teamMarkerFeatures(teams, selectedTeamId, now);
    const fromMarkers = markerDataRef.current;
    const markerSource = map.getSource('dashboard-teams') as GeoJSONSource;
    const accuracySource = map.getSource('dashboard-accuracy') as GeoJSONSource;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    const startedAt = performance.now();
    const animate = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / 500);
      markerSource.setData(interpolateMarkers(fromMarkers, nextMarkers, progress));
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
      else {
        markerDataRef.current = nextMarkers;
        animationRef.current = null;
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    accuracySource.setData(accuracyFeatures(teams, selectedTeamId, now));
  }, [teams, selectedTeamId, now, ready]);

  useEffect(() => {
    const selected = teams.find((team) => team.id === selectedTeamId);
    if (selected?.location && mapRef.current && ready) {
      mapRef.current.easeTo({
        center: [selected.location.longitude, selected.location.latitude],
        duration: 500
      });
    }
  }, [selectedTeamId, teams, ready]);

  const showAll = () => mapRef.current?.fitBounds(dashboardBounds, { padding: 54, duration: 500 });

  return (
    <section className="dashboard-map-panel" aria-label="Realtime teamkaart">
      <div ref={containerRef} className="dashboard-map" />
      <button className="dashboard-map__all" type="button" onClick={showAll}>Toon alle teams</button>
      {error ? <p className="dashboard-map__error" role="alert">{error}</p> : null}
    </section>
  );
}
