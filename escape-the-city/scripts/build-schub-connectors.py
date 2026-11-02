"""Build offline walking connectors from an OSM XML map extract.

Usage: python3 scripts/build-schub-connectors.py --osm-dir /path/to/osm-chunks
Input: overlapping OSM API /api/0.6/map extracts covering the game area.
Output: src/game-data/moerasdraak/schub-connectors.json (ODbL, OSM contributors).
No routing service or GPS uploads are used in the app.
"""
import argparse
import heapq
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--osm-dir', type=Path, required=True)
args = parser.parse_args()
nodes, ways = {}, {}
for file in sorted(args.osm_dir.glob('*.osm')):
    doc = ET.parse(file).getroot()
    nodes.update({int(n.attrib['id']): (float(n.attrib['lon']), float(n.attrib['lat'])) for n in doc.findall('node')})
    for way in doc.findall('way'):
        ways[int(way.attrib['id'])] = ([int(n.attrib['ref']) for n in way.findall('nd')], {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')})


def distance(a, b):
    return math.hypot((a[0] - b[0]) * 111_195 * math.cos(math.radians((a[1] + b[1]) / 2)), (a[1] - b[1]) * 111_195)


allowed = {'footway', 'pedestrian', 'steps', 'path', 'living_street', 'residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary'}
graph = {}
for way_id, (refs, tags) in ways.items():
    if tags.get('highway') not in allowed or tags.get('foot') in {'no', 'private', 'use_sidepath'}:
        continue
    if tags.get('access') in {'no', 'private', 'customers'} and tags.get('foot') not in {'yes', 'designated', 'permissive'}:
        continue
    for a, b in zip(refs, refs[1:]):
        if a not in nodes or b not in nodes:
            continue
        length = distance(nodes[a], nodes[b])
        for start, end in [(a, b), (b, a)]:
            graph.setdefault(start, {})[end] = (length, way_id)

# Disconnected courtyard/indoor footways must not become artificial shortcuts.
unseen = set(graph)
components = []
while unseen:
    component, queue = set(), [next(iter(unseen))]
    while queue:
        n = queue.pop()
        if n not in unseen:
            continue
        unseen.remove(n)
        component.add(n)
        queue.extend(graph[n])
    components.append(component)
main = max(components, key=len)


def nearest(coordinate):
    node = min(main, key=lambda n: distance(coordinate, nodes[n]))
    return node, distance(coordinate, nodes[node])


route = json.loads((ROOT / 'public/routes/moerasdraak-den-bosch.geojson').read_text())
source = (ROOT / 'src/game-data/moerasdraak/bonusLocations.ts').read_text()
bonuses = [(bonus, (float(lon), float(lat))) for bonus, lat, lon in re.findall(r"id: '(bonus:[^']+)'.*?coordinates: coordinate\(([\d.]+), ([\d.]+),", source, re.S)]
# Project the landmark onto a permitted street segment instead of jumping to a
# distant intersection (which could cut across a building or canal bank).
edges = [(a, b, way_id) for a in main for b, (_, way_id) in graph[a].items() if a < b]


def snap_to_street(coordinate):
    longitude_scale = 111_195 * math.cos(math.radians(coordinate[1]))
    best = None
    for a, b, way_id in edges:
        x, y = (nodes[a][0] - coordinate[0]) * longitude_scale, (nodes[a][1] - coordinate[1]) * 111_195
        dx, dy = (nodes[b][0] - nodes[a][0]) * longitude_scale, (nodes[b][1] - nodes[a][1]) * 111_195
        length_squared = dx * dx + dy * dy
        t = max(0, min(1, -(x * dx + y * dy) / length_squared)) if length_squared else 0
        point = (nodes[a][0] + t * (nodes[b][0] - nodes[a][0]), nodes[a][1] + t * (nodes[b][1] - nodes[a][1]))
        candidate = (distance(coordinate, point), a, b, way_id, point)
        if best is None or candidate[0] < best[0]:
            best = candidate
    return best


features = []
for bonus_id, coordinate in bonuses:
    start_gap, a, b, street_id, point = snap_to_street(coordinate)
    start = -1
    nodes[start] = point
    graph[start] = {a: (distance(point, nodes[a]), street_id), b: (distance(point, nodes[b]), street_id)}
    if start_gap > 30:
        raise ValueError(f'{bonus_id}: road connection too far away ({start_gap:.1f} m)')
    # Dijkstra follows connected pedestrian-permitted OSM ways, never a straight
    # shortcut to a route polyline across a canal, building or private grounds.
    costs, previous, queue = {start: 0}, {}, [(0, start)]
    while queue:
        cost, current = heapq.heappop(queue)
        if cost != costs[current]:
            continue
        for end, (length, way_id) in graph[current].items():
            candidate = cost + length
            if candidate < costs.get(end, math.inf):
                costs[end] = candidate
                previous[end] = (current, way_id)
                heapq.heappush(queue, (candidate, end))
    for leg in route['features']:
        candidates = []
        for index, point in enumerate(leg['geometry']['coordinates']):
            end, end_gap = nearest(point)
            if end_gap <= 10 and end in costs:
                candidates.append((costs[end] + end_gap, index, end, point))
        if not candidates:
            raise ValueError(f'No walking connection: {bonus_id} / {leg["properties"]["legIndex"]}')
        _, join_index, end, join_point = min(candidates)
        path, way_ids = [end], []
        while path[-1] != start:
            parent, way_id = previous[path[-1]]
            path.append(parent)
            way_ids.append(way_id)
        path.reverse()
        way_ids.reverse()
        coordinates = [list(coordinate)]
        for n in path:
            point = [round(x, 7) for x in nodes[n]]
            if distance(point, coordinates[-1]) > 0.1:
                coordinates.append(point)
        if coordinates[-1] != join_point:
            coordinates.append(join_point)
        if len(coordinates) < 2:
            coordinates.append(join_point)
        corridors = list(dict.fromkeys(ways[w][1].get('name', ways[w][1]['highway']) for w in way_ids))
        bridges = list(dict.fromkeys(w for w in way_ids if ways[w][1].get('bridge') not in {None, 'no'}))
        feature = {'type': 'Feature', 'properties': {'bonusId': bonus_id, 'legIndex': leg['properties']['legIndex'], 'joinIndex': join_index, 'osmWayIds': list(dict.fromkeys(way_ids)), 'bridgeWayIds': bridges, 'corridor': ' → '.join(corridors)}, 'geometry': {'type': 'LineString', 'coordinates': coordinates}}
        features.append(feature)
        print(bonus_id, 'leg', leg['properties']['legIndex'], f'snap={start_gap:.1f}m length={start_gap+costs[end]:.0f}m', 'join', join_point, feature['properties']['corridor'], 'bridges', bridges)

out = {'type': 'FeatureCollection', 'source': 'https://www.openstreetmap.org/copyright', 'license': 'ODbL-1.0', 'features': features}
file = ROOT / 'src/game-data/moerasdraak/schub-connectors.json'
file.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Wrote', len(features), 'connectors,', file.stat().st_size, 'bytes')
