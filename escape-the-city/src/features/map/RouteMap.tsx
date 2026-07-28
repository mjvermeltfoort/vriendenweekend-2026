import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { GameIcon } from '../../components/GameUi';
import { haversineDistanceMeters } from '../location/distance';
import type { LocationOutcome, LocationResult } from '../location/provider';
import { applyMoerasdraakTheme, legFilter, MAP_STYLE_URL, mapColors } from './mapStyle';
import {
  createAccuracyPolygon,
  externalNavigationUrl,
  getRoutePresentation,
  isLocationResult,
  markerStatus,
  shouldUseFallbackForMapError,
  startLocationPolling,
  validateRouteGeoJson,
  type LngLat,
  type RouteGeoJson,
  type RouteMapProps
} from './mapTypes';
import { RouteMarker } from './RouteMarker';

type MapMode = 'loading' | 'live' | 'fallback';
type MarkerPosition = { left: string; top: string };

const MAP_BOUNDS = {
  minLongitude: 5.2945,
  maxLongitude: 5.3115,
  minLatitude: 51.6865,
  maxLatitude: 51.6982
};

const stopStatusLabels = {
  locked: 'Vergrendeld',
  available: 'Beschikbaar',
  arrived: 'Locatie gevonden',
  started: 'Bezig',
  completed: 'Voltooid'
} as const;

const emptyFeatureCollection: FeatureCollection = { type: 'FeatureCollection', features: [] };

function pointFeature(location: LocationResult): Feature<Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [location.longitude, location.latitude]
    }
  };
}

function accuracyFeature(location: LocationResult): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: createAccuracyPolygon(location)
  };
}

function projectFallback([longitude, latitude]: LngLat): MarkerPosition {
  const x = (longitude - MAP_BOUNDS.minLongitude) / (MAP_BOUNDS.maxLongitude - MAP_BOUNDS.minLongitude) * 100;
  const y = (MAP_BOUNDS.maxLatitude - latitude) / (MAP_BOUNDS.maxLatitude - MAP_BOUNDS.minLatitude) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

function polylinePoints(feature: RouteGeoJson['features'][number]) {
  return feature.geometry.coordinates.map((coordinate) => {
    const point = projectFallback(coordinate);
    return `${Number.parseFloat(point.left)},${Number.parseFloat(point.top)}`;
  }).join(' ');
}

function distanceLabel(distance: number) {
  if (distance < 1000) return `${Math.round(distance)} meter`;
  return `${(distance / 1000).toFixed(1).replace('.', ',')} km`;
}

function hiddenLegFilter() {
  return ['==', ['get', 'legIndex'], -1] as FilterSpecification;
}

export function RouteMap({ gamePack, progress, visibleStops, locationProvider }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const [mode, setMode] = useState<MapMode>('loading');
  const [route, setRoute] = useState<RouteGeoJson | null>(null);
  const [markerPositions, setMarkerPositions] = useState<Record<string, MarkerPosition>>({});
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const presentation = useMemo(() => getRoutePresentation(gamePack, progress), [gamePack, progress]);

  const selectedStop = visibleStops.find((stop) => stop.id === selectedStopId) ?? null;
  const selectedState = selectedStop ? progress?.stopProgress?.[selectedStop.id]?.state ?? 'locked' : 'locked';
  const selectedDistance = selectedStop && location
    ? haversineDistanceMeters(location, {
      latitude: selectedStop.coordinates.latitude!,
      longitude: selectedStop.coordinates.longitude!
    })
    : null;

  useEffect(() => {
    let cancelled = false;
    void fetch(`${import.meta.env.BASE_URL}routes/moerasdraak-den-bosch.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error('Het lokale routebestand kon niet worden geladen.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setRoute(validateRouteGeoJson(data, gamePack));
      })
      .catch(() => {
        if (!cancelled) setMode('fallback');
      });
    return () => { cancelled = true; };
  }, [gamePack]);

  useEffect(() => {
    if (!route || !containerRef.current || mode === 'fallback') return;
    let cancelled = false;
    let ready = false;
    let fallbackTimer = 0;

    const activateFallback = () => {
      if (cancelled) return;
      mapRef.current?.remove();
      mapRef.current = null;
      setMode('fallback');
    };

    if (!hasWebGlSupport()) {
      activateFallback();
      return;
    }

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [5.3042, 51.692],
        zoom: 14.3,
        minZoom: 12,
        maxZoom: 19,
        maxPitch: 0,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      const updateMarkerPositions = () => {
        const positions: Record<string, MarkerPosition> = {};
        for (const stop of visibleStops) {
          const projected = map.project([stop.coordinates.longitude!, stop.coordinates.latitude!]);
          positions[stop.id] = { left: `${projected.x}px`, top: `${projected.y}px` };
        }
        setMarkerPositions(positions);
      };

      map.on('load', () => {
        if (cancelled) return;
        ready = true;
        window.clearTimeout(fallbackTimer);
        applyMoerasdraakTheme(map);
        map.addSource('moerasdraak-route', { type: 'geojson', data: route });
        map.addSource('route-accuracy', { type: 'geojson', data: emptyFeatureCollection });
        map.addSource('route-position', { type: 'geojson', data: emptyFeatureCollection });
        map.addLayer({
          id: 'route-full',
          type: 'line',
          source: 'moerasdraak-route',
          layout: { visibility: presentation.fullRouteVisible ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': mapColors.completed, 'line-width': 4, 'line-opacity': 0.72 }
        });
        map.addLayer({
          id: 'route-completed',
          type: 'line',
          source: 'moerasdraak-route',
          filter: presentation.completedLegIndices.length ? legFilter(presentation.completedLegIndices) : hiddenLegFilter(),
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': mapColors.completed, 'line-width': 5, 'line-opacity': 0.95 }
        });
        map.addLayer({
          id: 'route-active-outline',
          type: 'line',
          source: 'moerasdraak-route',
          filter: presentation.activeLegIndex === null ? hiddenLegFilter() : legFilter([presentation.activeLegIndex]),
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': mapColors.completed, 'line-width': 9, 'line-opacity': 0.96 }
        });
        map.addLayer({
          id: 'route-active',
          type: 'line',
          source: 'moerasdraak-route',
          filter: presentation.activeLegIndex === null ? hiddenLegFilter() : legFilter([presentation.activeLegIndex]),
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': mapColors.active, 'line-width': 5, 'line-opacity': 1 }
        });
        map.addLayer({
          id: 'route-accuracy',
          type: 'fill',
          source: 'route-accuracy',
          paint: { 'fill-color': mapColors.accuracy, 'fill-opacity': 0.16, 'fill-outline-color': mapColors.accuracy }
        });
        map.addLayer({
          id: 'route-position',
          type: 'circle',
          source: 'route-position',
          paint: {
            'circle-radius': 7,
            'circle-color': mapColors.active,
            'circle-stroke-color': '#f4e6c5',
            'circle-stroke-width': 3
          }
        });

        const coordinates = visibleStops.map((stop) => [
          stop.coordinates.longitude!,
          stop.coordinates.latitude!
        ] as LngLat);
        if (coordinates.length) {
          const bounds = coordinates.reduce(
            (result, coordinate) => result.extend(coordinate),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
          );
          map.fitBounds(bounds, { padding: 46, maxZoom: 15.8, duration: 0 });
        }
        updateMarkerPositions();
        setMode('live');
      });
      map.on('move', updateMarkerPositions);
      map.on('resize', updateMarkerPositions);
      map.on('error', (event) => {
        if (shouldUseFallbackForMapError(event.error, ready)) activateFallback();
      });

      fallbackTimer = window.setTimeout(() => {
        if (!ready || !map.loaded()) activateFallback();
      }, 10000);
    }).catch(activateFallback);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [route, gamePack, visibleStops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'live' || !map.getLayer('route-active')) return;
    map.setLayoutProperty('route-full', 'visibility', presentation.fullRouteVisible ? 'visible' : 'none');
    map.setFilter(
      'route-completed',
      presentation.completedLegIndices.length ? legFilter(presentation.completedLegIndices) : hiddenLegFilter()
    );
    const activeFilter = presentation.activeLegIndex === null
      ? hiddenLegFilter()
      : legFilter([presentation.activeLegIndex]);
    map.setFilter('route-active-outline', activeFilter);
    map.setFilter('route-active', activeFilter);
  }, [mode, presentation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'live' || !map.getSource('route-position')) return;
    const positionSource = map.getSource('route-position') as GeoJSONSource | undefined;
    const accuracySource = map.getSource('route-accuracy') as GeoJSONSource | undefined;
    positionSource?.setData(location ? pointFeature(location) : emptyFeatureCollection);
    accuracySource?.setData(location ? accuracyFeature(location) : emptyFeatureCollection);
  }, [location, mode]);

  useEffect(() => () => stopPollingRef.current?.(), []);

  function handleLocationOutcome(outcome: LocationOutcome) {
    if (isLocationResult(outcome)) {
      setLocation(outcome);
      setLocationMessage(`Locatie bijgewerkt, nauwkeurig tot ongeveer ${Math.round(outcome.accuracy)} meter.`);
    } else {
      setLocationMessage(outcome.message);
    }
  }

  function enableLocation() {
    if (locationEnabled) return;
    setLocationEnabled(true);
    stopPollingRef.current = startLocationPolling(locationProvider, handleLocationOutcome);
  }

  const fallbackLocationPosition = location
    ? projectFallback([location.longitude, location.latitude])
    : null;
  const fallbackAccuracyPoints = location
    ? createAccuracyPolygon(location).coordinates[0].map((coordinate) => {
      const point = projectFallback(coordinate);
      return `${Number.parseFloat(point.left)},${Number.parseFloat(point.top)}`;
    }).join(' ')
    : '';

  return (
    <section className="route-map-view" aria-label="Interactieve routekaart">
      <div className={`interactive-route-map interactive-route-map--${mode}`}>
        <div
          ref={containerRef}
          className="interactive-route-map__canvas"
          role="region"
          aria-label="Kaart van de wandelroute door Den Bosch"
        />

        {mode === 'fallback' ? (
          <div className="fallback-route-map" role="region" aria-label="Offline routekaart van Den Bosch">
            <img src={`${import.meta.env.BASE_URL}maps/route-map-fallback.webp`} alt="" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {presentation.fullRouteVisible ? route?.features.map((feature) => (
                <polyline className="fallback-route-map__full" key={`full-${feature.properties.legIndex}`} points={polylinePoints(feature)} />
              )) : null}
              {route?.features
                .filter((feature) => presentation.completedLegIndices.includes(feature.properties.legIndex))
                .map((feature) => (
                  <polyline className="fallback-route-map__completed" key={`completed-${feature.properties.legIndex}`} points={polylinePoints(feature)} />
                ))}
              {route && presentation.activeLegIndex !== null ? (
                <>
                  <polyline className="fallback-route-map__active-outline" points={polylinePoints(route.features[presentation.activeLegIndex])} />
                  <polyline className="fallback-route-map__active" points={polylinePoints(route.features[presentation.activeLegIndex])} />
                </>
              ) : null}
              {fallbackAccuracyPoints ? <polygon className="fallback-route-map__accuracy" points={fallbackAccuracyPoints} /> : null}
            </svg>
            {fallbackLocationPosition ? (
              <span className="fallback-route-map__position" style={fallbackLocationPosition} aria-label="Jouw GPS-positie" />
            ) : null}
            <a
              className="fallback-route-map__attribution"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              Route © OpenStreetMap-bijdragers
            </a>
          </div>
        ) : null}

        {mode === 'loading' ? (
          <div className="route-map-loading" role="status">
            <GameIcon name="map" size={24} />
            <span>Kaart laden…</span>
          </div>
        ) : null}

        <div className="route-marker-layer">
          {visibleStops.map((stop) => {
            const state = progress?.stopProgress?.[stop.id]?.state ?? 'locked';
            const position = mode === 'fallback'
              ? projectFallback([stop.coordinates.longitude!, stop.coordinates.latitude!])
              : markerPositions[stop.id];
            if (!position) return null;
            return (
              <RouteMarker
                key={stop.id}
                stop={stop}
                status={markerStatus(stop, state, progress?.currentStopId)}
                selected={selectedStopId === stop.id}
                style={position}
                onSelect={(selected) => setSelectedStopId(selected.id)}
              />
            );
          })}
        </div>

        <button className="map-location-button" type="button" onClick={enableLocation} aria-pressed={locationEnabled}>
          <GameIcon name="location" size={18} />
          {locationEnabled ? 'Locatie aan' : 'Mijn locatie'}
        </button>
        {mode === 'fallback' ? <span className="map-fallback-badge">Offline kaart</span> : null}
      </div>

      <p className="map-location-message" aria-live="polite">{locationMessage}</p>

      {selectedStop && selectedState !== 'locked' ? (
        <section className="route-bottom-sheet" aria-label={`Stop ${selectedStop.order}: ${selectedStop.title}`}>
          <button className="route-bottom-sheet__close" type="button" aria-label="Stopinformatie sluiten" onClick={() => setSelectedStopId(null)}>×</button>
          <span className="route-stop__meta">
            {selectedStop.isFinal ? 'Finale' : `Opdracht ${selectedStop.order}`} · {stopStatusLabels[selectedState]}
          </span>
          <h2>{selectedStop.title}</h2>
          <p>{selectedStop.navigation.clue}</p>
          {selectedDistance !== null ? <p className="route-bottom-sheet__distance">Hemelsbreed: {distanceLabel(selectedDistance)}</p> : null}
          <div className="route-bottom-sheet__actions">
            <a
              className="button secondary"
              href={externalNavigationUrl(selectedStop)}
              target="_blank"
              rel="noreferrer"
            >
              Open navigatie
            </a>
            <Link className="button primary" to={`/stop/${selectedStop.id}`}>Bekijk stop</Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function visibleRouteFeatures(route: RouteGeoJson, presentation: ReturnType<typeof getRoutePresentation>) {
  return route.features.filter((feature) => {
    const legIndex = Number(feature.properties?.legIndex);
    return legIndex !== route.features.length - 1 || presentation.finalLegVisible;
  });
}

export function hasWebGlSupport() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}
