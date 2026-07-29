import type { FilterSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

export const mapColors = {
  background: '#07100d',
  land: '#10251c',
  park: '#183b2b',
  building: '#284638',
  water: '#12565a',
  road: '#81745f',
  roadMajor: '#b18a4e',
  label: '#f4e6c5',
  labelHalo: '#07100d',
  completed: '#d8aa55',
  active: '#35d4c7',
  accuracy: '#35d4c7'
};

function safePaint(map: MapLibreMap, layerId: string, property: string, value: unknown) {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Third-party styles can expose layer types with different paint properties.
  }
}

function safeLayout(map: MapLibreMap, layerId: string, property: string, value: unknown) {
  try {
    map.setLayoutProperty(layerId, property, value);
  } catch {
    // Third-party styles can expose different layout properties.
  }
}

export function applyMoerasdraakTheme(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification;
  for (const layer of style.layers ?? []) {
    const id = layer.id.toLowerCase();
    const commercial = /poi|shop|commercial|retail/.test(id);
    if (commercial) {
      safeLayout(map, layer.id, 'visibility', 'none');
      continue;
    }
    if (layer.type === 'background') {
      safePaint(map, layer.id, 'background-color', mapColors.background);
    } else if (layer.type === 'fill') {
      if (/water/.test(id)) safePaint(map, layer.id, 'fill-color', mapColors.water);
      else if (/building/.test(id)) safePaint(map, layer.id, 'fill-color', mapColors.building);
      else if (/park|wood|grass|landuse|landcover/.test(id)) safePaint(map, layer.id, 'fill-color', mapColors.park);
      else safePaint(map, layer.id, 'fill-color', mapColors.land);
      safePaint(map, layer.id, 'fill-opacity', 0.82);
    } else if (layer.type === 'line') {
      if (/water/.test(id)) safePaint(map, layer.id, 'line-color', mapColors.water);
      else if (/motorway|trunk|primary|secondary/.test(id)) safePaint(map, layer.id, 'line-color', mapColors.roadMajor);
      else if (/road|street|path|bridge/.test(id)) safePaint(map, layer.id, 'line-color', mapColors.road);
    } else if (layer.type === 'symbol') {
      safePaint(map, layer.id, 'text-color', mapColors.label);
      safePaint(map, layer.id, 'text-halo-color', mapColors.labelHalo);
      safePaint(map, layer.id, 'text-halo-width', 1.75);
      safePaint(map, layer.id, 'text-halo-blur', 0.25);
    }
  }
}

export function legFilter(indices: number[]) {
  return ['in', ['get', 'legIndex'], ['literal', indices]] as FilterSpecification;
}
