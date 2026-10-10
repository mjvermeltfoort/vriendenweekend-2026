import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { GameIcon } from '../../components/GameUi';
import type { LocationOutcome, LocationResult } from '../location/provider';
import { loadRouteGeoJson } from '../location/routeDistance';
import { haversineDistanceMeters } from '../location/distance';
import { applyMoerasdraakTheme, legFilter, MAP_STYLE_URL, mapColors } from './mapStyle';
import {
  createAccuracyPolygon,
  externalNavigationUrl,
  getRoutePresentation,
  isLocationResult,
  markerStatus,
  shouldUseFallbackForMapError,
  startLocationPolling,
  type LngLat,
  type RouteGeoJson,
  type RouteMapProps
} from './mapTypes';
import { RouteMarker } from './RouteMarker';
import { isBonusLocation, type BonusLocation, type RouteStop } from '../game/gameTypes';
import { visibleBonusLocations } from '../game/gameState';

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

function hiddenLegFilter() {
  return ['==', ['get', 'legIndex'], -1] as FilterSpecification;
}

// De eerste GPS-meting mag het startbeeld corrigeren wanneer de deelnemer
// werkelijk in de buurt van de route is. Latere metingen bewegen alleen de stip.
export function locationNearRoute(location: LocationResult, stops: RouteStop[]) {
  return stops.some((stop) => Number.isFinite(stop.coordinates.latitude)
    && Number.isFinite(stop.coordinates.longitude)
    && haversineDistanceMeters(location, {
      latitude: stop.coordinates.latitude!,
      longitude: stop.coordinates.longitude!
    }) < 3000);
}

export function autoSelectedStopId(
  currentStopId: string | undefined,
  progress: RouteMapProps['progress'],
  visibleStops: RouteMapProps['visibleStops']
) {
  if (!currentStopId) return null;
  const stop = visibleStops.find((item) => item.id === currentStopId);
  if (!stop) return null;
  const state = progress?.stopProgress?.[currentStopId]?.state ?? 'locked';
  return state === 'locked' ? null : currentStopId;
}

export function nearestUnfinishedBonus(
  location: LocationResult | null,
  bonuses: BonusLocation[],
  progress: RouteMapProps['progress'],
  previousId: string | null = null
): string | null {
  if (!location || !progress || !Number.isFinite(location.latitude)
    || !Number.isFinite(location.longitude) || !Number.isFinite(location.accuracy)) return null;

  const matches = bonuses
    .filter((bonus) => progress.stopProgress[bonus.id]?.state !== 'completed'
      && progress.stopProgress[bonus.id]?.state !== 'locked'
      && location.accuracy <= bonus.coordinates.maximumAccuracyMeters)
    .map((bonus) => ({
      bonus,
      distance: haversineDistanceMeters(location, {
        latitude: bonus.coordinates.latitude!,
        longitude: bonus.coordinates.longitude!
      })
    }))
    .filter(({ bonus, distance }) => distance <= bonus.coordinates.radiusMeters + (bonus.id === previousId ? 30 : 0))
    .sort((a, b) => a.distance - b.distance);

  return matches[0]?.bonus.id ?? null;
}

export function mapFocusStops(currentStopId: string | undefined, visibleStops: RouteStop[]) {
  const currentIndex = visibleStops.findIndex((stop) => stop.id === currentStopId);
  return currentIndex === -1 ? visibleStops : visibleStops.slice(currentIndex, currentIndex + 2);
}

export function RouteMap({ gamePack, progress, visibleStops, locationProvider, deviceLocation, locationError }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const autoStartedRef = useRef(false);
  const locationRef = useRef<LocationResult | null>(null);
  const hasIncludedLocationRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const fittingMapRef = useRef(false);
  const [gpsMarkerPosition, setGpsMarkerPosition] = useState<MarkerPosition | null>(null);
  const [mode, setMode] = useState<MapMode>('loading');
  const [route, setRoute] = useState<RouteGeoJson | null>(null);
  const [markerPositions, setMarkerPositions] = useState<Record<string, MarkerPosition>>({});
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const selectionOriginRef = useRef<'default' | 'gps' | 'manual'>('default');
  const nearbyBonusRef = useRef<string | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const revealSheetRef = useRef(false);
  const sheetDismissedRef = useRef(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  // Ook bij de initiële map.load-callback moet de nieuwste GPS-fix beschikbaar zijn.
  locationRef.current = location;
  const presentation = useMemo(() => getRoutePresentation(gamePack, progress), [gamePack, progress]);

  const visibleBonusLocationsMemo = useMemo(() => visibleBonusLocations(gamePack, progress), [gamePack, progress]);
  const visibleStopIdsKey = useMemo(() => visibleStops.map((stop) => stop.id).join('|'), [visibleStops]);
  const mapLocationIdsKey = useMemo(
    () => [...visibleStops, ...visibleBonusLocationsMemo].map((stop) => stop.id).join('|'),
    [visibleStops, visibleBonusLocationsMemo]
  );
  const mapLocations = useMemo<(RouteStop | BonusLocation)[]>(
    () => [...visibleStops, ...visibleBonusLocationsMemo],
    [mapLocationIdsKey]
  );
  const selectedStop = mapLocations.find((stop) => stop.id === selectedStopId) ?? null;
  const selectedState = selectedStop ? progress?.stopProgress?.[selectedStop.id]?.state ?? 'locked' : 'locked';
  const nearbyBonusId = nearestUnfinishedBonus(location, visibleBonusLocationsMemo, progress, nearbyBonusRef.current);
  const selectedNearbyBonus = selectedStopId !== null && selectedStopId === nearbyBonusId;

  useEffect(() => {
    if (selectedStopId || sheetDismissedRef.current || selectionOriginRef.current !== 'default') return;
    const suggestedStopId = autoSelectedStopId(progress?.currentStopId, progress, visibleStops);
    if (suggestedStopId) setSelectedStopId(suggestedStopId);
  }, [progress, selectedStopId, visibleStops]);

  useEffect(() => {
    // Alleen een verse, bruikbare positie activeert een schub. Een tijdelijke
    // GPS-time-out mag de gekozen opdracht niet laten verspringen.
    if (!location) return;
    if (nearbyBonusId === nearbyBonusRef.current) return;
    nearbyBonusRef.current = nearbyBonusId;
    if (nearbyBonusId) {
      selectionOriginRef.current = 'gps';
      sheetDismissedRef.current = false;
      // Automatische GPS-selectie mag niet zelf de pagina laten verspringen.
      revealSheetRef.current = false;
      setSelectedStopId(nearbyBonusId);
    } else if (selectionOriginRef.current === 'gps') {
      selectionOriginRef.current = 'default';
      setSelectedStopId(autoSelectedStopId(progress?.currentStopId, progress, visibleStops));
    }
  }, [nearbyBonusId, location, progress, visibleStops]);

  useEffect(() => {
    if (!selectedStopId || !revealSheetRef.current || !sheetRef.current) return;
    revealSheetRef.current = false;
    // Na een tik op een marker scrollt de pagina net genoeg om de kaartinformatie
    // inclusief knoppen boven de vaste mobiele ondernavigatie zichtbaar te maken.
    sheetRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [selectedStopId]);

  function selectMapStop(stop: RouteStop | BonusLocation) {
    selectionOriginRef.current = 'manual';
    sheetDismissedRef.current = false;
    revealSheetRef.current = true;
    setSelectedStopId(stop.id);
    if (selectedStopId === stop.id) {
      sheetRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
      revealSheetRef.current = false;
    }
  }

  function closeStopSheet() {
    selectionOriginRef.current = 'manual';
    sheetDismissedRef.current = true;
    revealSheetRef.current = false;
    setSelectedStopId(null);
  }

  useEffect(() => {
    let cancelled = false;
    void loadRouteGeoJson(gamePack)
      .then((data) => { if (!cancelled) setRoute(data); })
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
        for (const stop of mapLocations) {
          const projected = map.project([stop.coordinates.longitude!, stop.coordinates.latitude!]);
          positions[stop.id] = { left: `${projected.x}px`, top: `${projected.y}px` };
        }
        setMarkerPositions(positions);
        const userLocation = locationRef.current;
        if (userLocation) {
          const p = map.project([userLocation.longitude, userLocation.latitude]);
          setGpsMarkerPosition({ left: `${p.x}px`, top: `${p.y}px` });
        } else {
          setGpsMarkerPosition(null);
        }
      };

      map.on('load', () => {
        if (cancelled) return;
        ready = true;
        window.clearTimeout(fallbackTimer);
        applyMoerasdraakTheme(map);
        map.addSource('moerasdraak-route', { type: 'geojson', data: route });
        map.addSource('route-accuracy', { type: 'geojson', data: emptyFeatureCollection });
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
          paint: { 'fill-color': mapColors.accuracy, 'fill-opacity': 0.14 }
        });
        map.addLayer({
          id: 'route-accuracy-outline',
          type: 'line',
          source: 'route-accuracy',
          paint: { 'line-color': mapColors.accuracy, 'line-width': 2, 'line-opacity': 0.82 }
        });
        const coordinates = mapFocusStops(progress?.currentStopId, visibleStops).map((stop) => [
          stop.coordinates.longitude!,
          stop.coordinates.latitude!
        ] as LngLat);
        const initialLocation = locationRef.current;
        if (initialLocation && locationNearRoute(initialLocation, visibleStops)) {
          coordinates.push([initialLocation.longitude, initialLocation.latitude]);
          hasIncludedLocationRef.current = true;
        }
        if (coordinates.length) {
          const bounds = coordinates.reduce(
            (result, coordinate) => result.extend(coordinate),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
          );
          fittingMapRef.current = true;
          try {
            map.fitBounds(bounds, {
              padding: { top: 46, right: 46, bottom: 104, left: 46 },
              maxZoom: 16.8,
              duration: 0
            });
          } finally {
            fittingMapRef.current = false;
          }
        }
        updateMarkerPositions();
        setMode('live');
      });
      map.on('dragstart', () => { userMovedMapRef.current = true; });
      map.on('zoomstart', () => {
        if (!fittingMapRef.current) userMovedMapRef.current = true;
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
  }, [route, gamePack, mapLocationIdsKey]);

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
    if (!map || mode !== 'live') return;
    const accuracySource = map.getSource('route-accuracy') as GeoJSONSource | undefined;
    accuracySource?.setData(location ? accuracyFeature(location) : emptyFeatureCollection);
    if (!location) {
      setGpsMarkerPosition(null);
      return;
    }
    const projected = map.project([location.longitude, location.latitude]);
    setGpsMarkerPosition({ left: `${projected.x}px`, top: `${projected.y}px` });

    // Eenmalig GPS toevoegen aan het startbeeld, ook als de eerste fix pas na
    // het laden van de kaart arriveert. Niet bijwerken als iemand zelf heeft
    // gezoomd of gesleept; latere GPS-updates beïnvloeden de camera nooit.
    if (!hasIncludedLocationRef.current && !userMovedMapRef.current
      && locationNearRoute(location, visibleStops)) {
      const coordinates = mapFocusStops(progress?.currentStopId, visibleStops).map((stop) => [
        stop.coordinates.longitude!,
        stop.coordinates.latitude!
      ] as LngLat);
      coordinates.push([location.longitude, location.latitude]);
      void import('maplibre-gl').then(({ LngLatBounds }) => {
        if (mapRef.current !== map || userMovedMapRef.current) return;
        const bounds = coordinates.reduce(
          (result, coordinate) => result.extend(coordinate),
          new LngLatBounds(coordinates[0], coordinates[0])
        );
        hasIncludedLocationRef.current = true;
        fittingMapRef.current = true;
        try {
          map.fitBounds(bounds, {
            padding: { top: 46, right: 46, bottom: 104, left: 46 },
            maxZoom: 16.8,
            duration: 0
          });
        } finally {
          fittingMapRef.current = false;
        }
      });
    }
  }, [location, mode, progress?.currentStopId, visibleStopIdsKey]);

  useEffect(() => () => stopPollingRef.current?.(), []);

  // De gamecontext kijkt al continu naar de GPS van dit toestel. Gebruik die
  // metingen rechtstreeks zodat de marker niet aan een verouderde teampositie hangt.
  useEffect(() => {
    if (deviceLocation === undefined) return;
    const age = deviceLocation?.capturedAt ? Date.now() - Date.parse(deviceLocation.capturedAt) : Number.POSITIVE_INFINITY;
    const isCurrent = Boolean(deviceLocation && Number.isFinite(deviceLocation.latitude)
      && Number.isFinite(deviceLocation.longitude) && Number.isFinite(age) && age >= 0 && age <= 60_000);
    const current = isCurrent ? deviceLocation! : null;
    setLocation(current);
    setLocationEnabled(Boolean(current));
    setLocationMessage(current
      ? `Jij bent hier. Nauwkeurig tot ongeveer ${Math.round(current.accuracy)} meter.`
      : locationError?.message ?? 'GPS-positie bepalen…');
  }, [deviceLocation, locationError]);

  // Fallback voor losse kaartweergaven buiten de gamecontext (o.a. componenttests).
  useEffect(() => {
    if (deviceLocation !== undefined || autoStartedRef.current || stopPollingRef.current) return;
    autoStartedRef.current = true;
    stopPollingRef.current = startLocationPolling(locationProvider, handleLocationOutcome);
    setLocationEnabled(true);
  }, [locationProvider, deviceLocation]);

  function handleLocationOutcome(outcome: LocationOutcome) {
    if (isLocationResult(outcome)) {
      setLocation(outcome);
      setLocationMessage(`Jij bent hier. Nauwkeurig tot ongeveer ${Math.round(outcome.accuracy)} meter.`);
      return;
    }
    setLocationMessage(outcome.message);
  }

  function enableLocation() {
    if (deviceLocation !== undefined) {
      // Handmatige herpoging wanneer de browser nog geen geldige GPS-meting levert.
      void locationProvider.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
        .then(handleLocationOutcome);
      return;
    }
    if (locationEnabled) return;
    setLocationEnabled(true);
    stopPollingRef.current = startLocationPolling(locationProvider, handleLocationOutcome);
  }

  function centerOnLocation() {
    const map = mapRef.current;
    const current = location;
    if (!map || !current) return;
    map.easeTo({ center: [current.longitude, current.latitude], duration: 300 });
  }

  const activeLocation = location;
  const fallbackLocationPosition = activeLocation
    ? projectFallback([activeLocation.longitude, activeLocation.latitude])
    : null;
  const fallbackAccuracyPoints = activeLocation
    ? createAccuracyPolygon(activeLocation).coordinates[0].map((coordinate) => {
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
              {route && presentation.fullRouteVisible ? route.features.map((feature) => (
                <polyline className="fallback-route-map__full" key={`full-${feature.properties.legIndex}`} points={polylinePoints(feature)} />
              )) : null}
              {route?.features
                .filter((feature) => presentation.completedLegIndices.includes(feature.properties.legIndex))
                .map((feature) => (
                  <polyline className="fallback-route-map__completed" key={`completed-${feature.properties.legIndex}`} points={polylinePoints(feature)} />
                ))}
              {route && presentation.activeLegIndex !== null && route.features[presentation.activeLegIndex] ? (
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
          {mode === 'live' && location && gpsMarkerPosition ? (
            <span
              className="route-map__my-location"
              style={gpsMarkerPosition}
              role="img"
              aria-label="Jouw actuele GPS-positie"
              data-testid="route-gps-marker"
            />
          ) : null}
          {mapLocations.map((stop) => {
            const state = progress?.stopProgress?.[stop.id]?.state ?? 'locked';
            const position = mode === 'fallback'
              ? projectFallback([stop.coordinates.longitude!, stop.coordinates.latitude!])
              : markerPositions[stop.id];
            if (!position) return null;
            return (
              <RouteMarker
                key={stop.id}
                stop={stop}
                status={isBonusLocation(stop) && nearbyBonusId === stop.id ? 'current' : markerStatus(stop, state, progress?.currentStopId)}
                selected={selectedStopId === stop.id}
                style={position}
                onSelect={selectMapStop}
              />
            );
          })}
        </div>

        <button
          className="map-location-button"
          type="button"
          onClick={enableLocation}
          aria-pressed={locationEnabled}
          aria-label={locationEnabled ? 'Locatie aan' : 'Mijn locatie inschakelen'}
          title={locationEnabled ? 'Locatie aan' : 'Mijn locatie inschakelen'}
        >
          <GameIcon name="location" size={20} />
        </button>
        {activeLocation ? (
          <button
            className="map-location-button map-location-button--secondary"
            type="button"
            onClick={centerOnLocation}
            aria-label="Centreer op mijn locatie"
            title="Centreer op mijn locatie"
          >
            <GameIcon name="compass" size={20} />
          </button>
        ) : null}
        {mode === 'fallback' ? <span className="map-fallback-badge">Offline kaart</span> : null}
      </div>
      <p className="map-location-message" aria-live="polite">{locationMessage}</p>
      {selectedStop && (selectedState !== 'locked' || isBonusLocation(selectedStop)) ? (
        <section ref={sheetRef} className="route-bottom-sheet" aria-label={isBonusLocation(selectedStop) ? `Schub: ${selectedStop.title}` : `Stop ${selectedStop.order}: ${selectedStop.title}`}>
          <button className="route-bottom-sheet__close" type="button" aria-label="Stopinformatie sluiten" onClick={closeStopSheet}>×</button>
          <span className="route-stop__meta">{isBonusLocation(selectedStop)
            ? selectedNearbyBonus ? 'Verborgen schub · Jullie zijn hier' : 'Verborgen vondst'
            : selectedStop.isFinal ? 'Finale' : `Opdracht ${selectedStop.order}`} · {stopStatusLabels[selectedState]}</span>
          <h2>{isBonusLocation(selectedStop) && selectedState !== 'completed' && !selectedNearbyBonus ? 'Verborgen schub' : selectedStop.title}</h2>
          <p>{isBonusLocation(selectedStop) && selectedState !== 'completed' ? selectedStop.hiddenClue : selectedStop.navigation.clue}</p>
          {isBonusLocation(selectedStop) ? <p className="muted small">Omweg: circa {selectedStop.estimatedDetourMinutes} minuten · maximaal {selectedStop.maximumPoints} bonuspunten</p> : null}
          <div className="route-bottom-sheet__actions">
            <a
              className="button secondary"
              href={externalNavigationUrl(selectedStop)}
              target="_blank"
              rel="noreferrer"
            >
              Open navigatie
            </a>
            <Link className="button primary" to={`/stop/${selectedStop.id}`}>{isBonusLocation(selectedStop) ? selectedNearbyBonus ? 'Open schubopdracht' : 'Bekijk schub' : 'Bekijk stop'}</Link>
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


