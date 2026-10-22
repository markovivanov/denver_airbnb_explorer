"""Fetch RTD's public GIS snapshot for this noncommercial classroom explorer."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
service = 'https://services5.arcgis.com/1fZoXlzLW6FCIUcE/arcgis/rest/services/RTD_GIS_Current_Runboard/FeatureServer'
item_url = 'https://www.arcgis.com/sharing/rest/content/items/e14366d810644a3c95a4f3770799bd54?f=json'
commuter_lines = {'A', 'B', 'G', 'N'}

def download(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result

def features(layer):
    result = []
    offset = 0
    while True:
        params = urllib.parse.urlencode({
            'f': 'geojson', 'where': '1=1', 'outFields': '*', 'outSR': 4326,
            'returnGeometry': 'true', 'geometryPrecision': 5,
            'maxAllowableOffset': 0.00003, 'resultRecordCount': 2000,
            'resultOffset': offset, 'orderByFields': 'OBJECTID',
        })
        page = download(f'{service}/{layer}/query?{params}')
        rows = page['features']
        result.extend(rows)
        if len(rows) < 2000:
            return result
        offset += len(rows)

routes = []
# Despite its legacy name "BusRoutes", layer 4 contains current bus AND rail routes.
# TYPE=LRT includes both commuter and light rail. CNR is on-demand FlexRide.
for feature in features(4):
    p = feature['properties']
    if not p.get('NAME') or not feature['geometry'] or p.get('TYPE') == 'CNR':
        continue
    ref = p['ROUTE']
    mode = 'bus'
    if p.get('TYPE') == 'LRT':
        mode = 'train' if ref in commuter_lines else 'light_rail'
    geometry = feature['geometry']
    coordinates = geometry['coordinates']
    if geometry['type'] == 'LineString':
        coordinates = [coordinates]
    routes.append({'id': f'4-{p["OBJECTID"]}', 'mode': mode, 'refs': [ref],
                   'name': p['NAME'], 'coordinates': coordinates})
active_rail = {ref for route in routes if route['mode'] != 'bus' for ref in route['refs']}

stops = []
for layer in [1, 2]:
    for feature in features(layer):
        p = feature['properties']
        if not feature['geometry']:
            continue
        lng, lat = feature['geometry']['coordinates'][:2]
        refs = [part for part in (p.get('RAIL_LINE') or '').split('-') if part in active_rail]
        modes = ['bus'] if layer == 2 else sorted({'train' if ref in commuter_lines else 'light_rail' for ref in refs})
        if not modes:
            continue
        stops.append({'id': f'{layer}-{p["OBJECTID"]}', 'name': p.get('NAME') or p.get('STOPNAME') or 'RTD stop',
                      'modes': modes, 'lines': ' · '.join(refs) if layer == 1 else p.get('ROUTES') or '', 'lat': lat, 'lng': lng})

item = download(item_url)
data = {'source': service, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'sourceModifiedAt': datetime.fromtimestamp(item['modified'] / 1000, timezone.utc).isoformat(),
        'license': item['licenseInfo'], 'routes': routes, 'stops': stops}
assert all(any(route['mode'] == mode for route in routes) for mode in ['bus', 'light_rail', 'train'])
target = root / 'data' / 'transit.json'
temporary = target.with_suffix('.tmp')
temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
temporary.replace(target)
print(f'Prepared {len(routes)} route segments and {len(stops)} stops / stations from RTD.')
for mode in ['bus', 'light_rail', 'train']:
    print(mode, sorted({ref for route in routes if route['mode'] == mode for ref in route['refs']}))
