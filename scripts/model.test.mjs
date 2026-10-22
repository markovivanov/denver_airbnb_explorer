import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_FILTERS,
  filterListings,
  inBounds,
  listingsCSV,
  sortListings,
  summarize,
} from '../lib/explorer-model.ts';
import { priceDistribution, storyPoint, storySummary, transitCoverage } from '../lib/story-model.ts';
import {
  ATTRACTIONS,
  nearbyAttractions,
  walkingDirectionsUrl,
} from '../lib/attractions-model.ts';

test('walking estimates sort by distance, round to five minutes, and exclude distant spots', () => {
  const spot = ATTRACTIONS[0];
  const sample = [
    { ...spot, id: 'far', lat: 0.009, lng: 0 },
    { ...spot, id: 'beyond-limit', lat: 0.0252, lng: 0 },
    { ...spot, id: 'near', lat: 0.004, lng: 0 },
    { ...spot, id: 'at-stay', lat: 0, lng: 0 },
    { ...spot, id: 'inside-limit', lat: 0.0247, lng: 0 },
  ];
  const before = structuredClone(sample);
  const walks = nearbyAttractions({ lat: 0, lng: 0 }, sample);
  assert.deepEqual(walks.map(({ attraction, minutes }) => [attraction.id, minutes]), [
    ['at-stay', 5], ['near', 10], ['far', 20], ['inside-limit', 45],
  ]);
  assert.deepEqual(sample, before);
  assert.ok(walks.every((walk, index) => index === 0 || walk.meters >= walks[index - 1].meters));
});

test('walking times are unavailable for missing or invalid coordinates', () => {
  for (const location of [
    { lat: null, lng: -105 }, { lat: 39.7, lng: null },
    { lat: NaN, lng: -105 }, { lat: Infinity, lng: 0 },
    { lat: 91, lng: 0 }, { lat: 0, lng: -181 },
  ]) {
    assert.deepEqual(nearbyAttractions(location), []);
    assert.equal(walkingDirectionsUrl(location, ATTRACTIONS[0]), null);
  }
  assert.deepEqual(nearbyAttractions({ lat: 39.7, lng: -105 }, []), []);
  assert.deepEqual(nearbyAttractions({ lat: 39.7, lng: -105 }, [{ ...ATTRACTIONS[0], lat: NaN }]), []);
  assert.deepEqual(nearbyAttractions({ lat: 40.5, lng: -105 }), []);
});

test('the six demo destinations include parks, gardens, and museums with source links', () => {
  assert.equal(ATTRACTIONS.length, 6);
  assert.equal(new Set(ATTRACTIONS.map((spot) => spot.id)).size, 6);
  assert.deepEqual([...new Set(ATTRACTIONS.map((spot) => spot.kind))].sort(), ['Garden', 'Museum', 'Park']);
  for (const spot of ATTRACTIONS) {
    assert.ok(spot.lat > 39.7 && spot.lat < 39.8 && spot.lng > -105.1 && spot.lng < -104.9);
    assert.equal(new URL(spot.website).protocol, 'https:');
    assert.equal(nearbyAttractions(spot)[0].attraction.id, spot.id);
  }
});

test('directions use walking mode and the chosen stay and destination', () => {
  const url = new URL(walkingDirectionsUrl({ lat: 39.75, lng: -105 }, ATTRACTIONS[3]));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(url.searchParams.get('origin'), '39.75,-105');
  assert.equal(url.searchParams.get('destination'), 'Denver Art Museum, Denver, CO');
  const museumUrl = new URL(walkingDirectionsUrl({ lat: 39.75, lng: -105 }, ATTRACTIONS[5]));
  assert.equal(museumUrl.searchParams.get('destination'), 'Denver Museum of Nature & Science, Denver, CO');
});

const listings = JSON.parse(
  readFileSync(new URL('../data/listings.json', import.meta.url)),
);
const matching = filterListings(listings, DEFAULT_FILTERS);

const storyStays = matching.map((row) => ({
  id: row.id,
  neighborhood: row.neighborhood,
  price: row.price,
  point: row.lat === null || row.lng === null ? null : storyPoint(row.lat, row.lng),
  distances: { bus: null, light_rail: null, train: null },
}));

test('landing budgets use the same population and medians as the explorer', () => {
  for (const budget of [150, 250, 400, 1000]) {
    const story = storySummary(storyStays, budget);
    const app = filterListings(listings, { ...DEFAULT_FILTERS, maxPrice: budget });
    assert.deepEqual(story.matching.map((row) => row.id), app.map((row) => row.id));
    assert.equal(story.median, summarize(app).median);
    assert.equal(story.neighborhoods.reduce((sum, row) => sum + row.count, 0), app.length);
  }
  assert.deepEqual(storySummary(storyStays, 1000).neighborhoods[0], { name: 'Five Points', count: 179 });
  assert.equal(storySummary([], 150).median, null);
});

test('price chart preserves fractional boundaries, missing prices, and expensive outliers', () => {
  const prices = [null, 0, 99.99, 100, 150, 150.01, 599.99, 600, 10000];
  const sample = prices.map((price) => ({ ...storyStays[0], price }));
  const capped = priceDistribution(sample, 150);
  assert.deepEqual(capped.map((bin) => bin.total), [2, 3, 0, 0, 0, 1, 2]);
  assert.deepEqual(capped.map((bin) => bin.matching), [2, 2, 0, 0, 0, 0, 0]);
  assert.equal(priceDistribution(sample, 1000).reduce((sum, bin) => sum + bin.matching, 0), 8);
});

test('transit chart uses located stays, exact thresholds, and overlapping modes', () => {
  const sample = [
    { ...storyStays[0], point: [10, 10], distances: { bus: 800, light_rail: 800.01, train: 350 } },
    { ...storyStays[0], point: [20, 20], distances: { bus: 400, light_rail: 700, train: null } },
    { ...storyStays[0], point: null, distances: { bus: null, light_rail: null, train: null } },
  ];
  assert.deepEqual(transitCoverage(sample, 800), [
    { mode: 'bus', count: 2, total: 2, percent: 100 },
    { mode: 'light_rail', count: 1, total: 2, percent: 50 },
    { mode: 'train', count: 1, total: 2, percent: 50 },
  ]);
  assert.ok(transitCoverage([], 800).every((row) => row.percent === 0 && row.total === 0));
});

test('overview includes every located default match with north up', () => {
  assert.ok(storyStays.every((stay) => !stay.point ||
    (stay.point[0] >= 0 && stay.point[0] <= 640 && stay.point[1] >= 0 && stay.point[1] <= 490)));
  assert.ok(storyPoint(39.8, -105)[1] < storyPoint(39.7, -105)[1]);
  assert.ok(storyPoint(39.7, -105)[0] < storyPoint(39.7, -104.9)[0]);
});

test('default trip reproduces the classroom notebook population', () => {
  assert.equal(listings.length, 4939);
  assert.equal(matching.length, 2033);
  assert.deepEqual(summarize(matching), {
    count: 2033,
    median: 285.5,
    pricedCount: 1905,
    neighborhoods: 75,
    sampleCount: 7639,
    walkingCount: 1505,
    transitCount: matching.reduce((sum, row) => sum + row.transitCount, 0),
  });
});
test('large listing IDs remain exact strings and are unique', () => {
  assert.equal(new Set(listings.map((row) => row.id)).size, listings.length);
  assert.ok(listings.every((row) => typeof row.id === 'string'));
  assert.ok(
    listings.some((row) => BigInt(row.id) > BigInt(Number.MAX_SAFE_INTEGER)),
  );
});
test('budget and rating limits exclude missing values without excluding zero prices', () => {
  const row = matching[0];
  const sample = [
    { ...row, id: '1', price: null, rating: null },
    { ...row, id: '2', price: 0, rating: 4.9 },
    { ...row, id: '3', price: 151, rating: 4.8 },
  ];
  assert.deepEqual(
    filterListings(sample, {
      ...DEFAULT_FILTERS,
      maxPrice: 150,
      minRating: 4.8,
    }).map((row) => row.id),
    ['2'],
  );
  assert.equal(filterListings(sample, DEFAULT_FILTERS).length, 3);
});
test('neighborhood and search compose with guest capacity and minimum stay', () => {
  const results = filterListings(listings, {
    ...DEFAULT_FILTERS,
    neighborhood: 'Highland',
    query: 'HIGHLAND',
    guests: 4,
    nights: 2,
  });
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (row) =>
        row.neighborhood === 'Highland' &&
        row.guests >= 4 &&
        row.minNights <= 2,
    ),
  );
});
test('map bounds include edge points and exclude missing coordinates', () => {
  const bounds = { south: 39, north: 40, west: -105, east: -104 };
  assert.equal(inBounds({ ...matching[0], lat: 39, lng: -105 }, bounds), true);
  assert.equal(inBounds({ ...matching[0], lat: null }, bounds), false);
  assert.equal(inBounds({ ...matching[0], lat: 41 }, bounds), false);
});
test('summary handles missing prices, an even median, and empty results', () => {
  assert.equal(summarize([]).median, null);
  assert.equal(
    summarize([0, 20, null].map((price) => ({ ...matching[0], price }))).median,
    10,
  );
});
test('price sort puts missing prices last and does not mutate source', () => {
  const sample = [null, 200, 0].map((price) => ({ ...matching[0], price }));
  assert.deepEqual(
    sortListings(sample, 'price').map((row) => row.price),
    [0, 200, null],
  );
  assert.deepEqual(
    sample.map((row) => row.price),
    [null, 200, 0],
  );
});
test('CSV keeps full ID text, escapes quotes, and neutralizes formula titles', () => {
  const csv = listingsCSV([
    { ...matching[0], id: '1234567890123456789', title: '=A1,"stay"' },
  ]);
  assert.ok(csv.includes('"1234567890123456789"'));
  assert.ok(csv.includes('"\'=A1,""stay"""'));
  assert.ok(csv.includes('https://www.airbnb.com/rooms/1234567890123456789'));
});

const transit = JSON.parse(
  readFileSync(new URL('../data/transit.json', import.meta.url)),
);
const { visibleTransit, ALL_TRANSIT } = await import('../lib/transit-model.ts');

test('every transit mode toggles routes and stops independently', () => {
  for (const mode of ['bus', 'light_rail', 'train']) {
    const selected = visibleTransit(transit, {
      bus: false,
      light_rail: false,
      train: false,
      [mode]: true,
    });
    assert.ok(selected.routes.length > 0);
    assert.ok(selected.routes.every((route) => route.mode === mode));
    assert.ok(selected.stops.length > 0);
    assert.ok(selected.stops.every((stop) => stop.modes.includes(mode)));
  }
  assert.equal(
    visibleTransit(transit, ALL_TRANSIT).routes.length,
    transit.routes.length,
  );
  assert.deepEqual(
    visibleTransit(transit, { bus: false, light_rail: false, train: false }),
    { routes: [], stops: [] },
  );
});
test('RTD commuter rail is separated from buses and light rail', () => {
  const commuter = transit.routes
    .filter((route) => route.mode === 'train')
    .flatMap((route) => route.refs)
    .sort();
  assert.deepEqual(commuter, ['A', 'B', 'G', 'N']);
  assert.ok(
    transit.routes
      .filter((route) => route.mode === 'bus')
      .every(
        (route) =>
          !['A', 'B', 'G', 'N', 'C', 'E', 'R', 'T', 'W'].includes(
            route.refs[0],
          ),
      ),
  );
});
test('paginated stops are complete beyond the 2,000 record API limit and unique', () => {
  assert.ok(transit.stops.length > 7000);
  assert.equal(
    new Set(transit.stops.map((stop) => stop.id)).size,
    transit.stops.length,
  );
  assert.ok(
    transit.stops.every(
      (stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng),
    ),
  );
  assert.ok(
    transit.routes.every((route) =>
      route.coordinates.every(
        (line) =>
          line.length >= 2 &&
          line.every(
            ([lng, lat]) => lng > -107 && lng < -103 && lat > 38 && lat < 41,
          ),
      ),
    ),
  );
});

const { distanceMeters, formatDistance, nearestStopsByMode, connectionToStop } =
  await import('../lib/transit-model.ts');

test('straight-line distances use spherical distance and handle missing coordinates', () => {
  const start = { lat: 0, lng: 0 };
  const end = { lat: 0, lng: 1 };
  assert.ok(Math.abs(distanceMeters(start, end) - 111194.9) < 1);
  assert.equal(distanceMeters(start, end), distanceMeters(end, start));
  assert.equal(distanceMeters(start, start), 0);
  assert.equal(distanceMeters({ lat: null, lng: 0 }, end), null);
  assert.equal(distanceMeters({ lat: NaN, lng: 0 }, end), null);
});
test('nearest stops are chosen separately for enabled modes', () => {
  const origin = { lat: 39.75, lng: -104.99 };
  const stop = (id, lat, modes) => ({
    id,
    lat,
    lng: -104.99,
    modes,
    name: id,
    lines: '',
  });
  const stops = [
    stop('bus-far', 39.76, ['bus']),
    stop('bus-near', 39.751, ['bus']),
    stop('rail', 39.752, ['light_rail', 'train']),
  ];
  const all = nearestStopsByMode(origin, stops, ALL_TRANSIT);
  assert.deepEqual(
    all.map((connection) => [connection.mode, connection.stop.id]),
    [
      ['bus', 'bus-near'],
      ['light_rail', 'rail'],
      ['train', 'rail'],
    ],
  );
  assert.ok(all[0].meters < all[1].meters);
  assert.deepEqual(
    nearestStopsByMode(origin, stops, {
      bus: false,
      light_rail: false,
      train: true,
    }).map((connection) => connection.stop.id),
    ['rail'],
  );
  assert.deepEqual(
    nearestStopsByMode({ lat: null, lng: 0 }, stops, ALL_TRANSIT),
    [],
  );
  assert.deepEqual(
    nearestStopsByMode(origin, stops, {
      bus: false,
      light_rail: false,
      train: false,
    }),
    [],
  );
});
test('a selected shared station preserves the requested mode and respects hidden modes', () => {
  const stop = {
    id: 'shared',
    name: 'Shared station',
    lines: '',
    lat: 39.75,
    lng: -104.99,
    modes: ['light_rail', 'train'],
  };
  const origin = { lat: 39.751, lng: -104.99 };
  assert.equal(
    connectionToStop(origin, stop, ALL_TRANSIT, 'train').mode,
    'train',
  );
  assert.equal(
    connectionToStop(origin, stop, {
      bus: true,
      light_rail: false,
      train: true,
    }).mode,
    'train',
  );
  assert.equal(
    connectionToStop(origin, stop, {
      bus: true,
      light_rail: false,
      train: false,
    }),
    null,
  );
});
test('distance labels avoid false precision and awkward units at a kilometer', () => {
  assert.equal(formatDistance(4), '<10 m');
  assert.equal(formatDistance(247), '250 m');
  assert.equal(formatDistance(996), '1.0 km');
  assert.equal(formatDistance(1260), '1.3 km');
});

const { stopMarkerSize, groupBusStops } =
  await import('../lib/transit-model.ts');

test('transit icons grow with zoom while the measured stop remains prominent', () => {
  for (const mode of ['bus', 'light_rail', 'train']) {
    assert.ok(stopMarkerSize(mode, 14) < stopMarkerSize(mode, 18));
    assert.ok(stopMarkerSize(mode, 12, true) >= 26);
    assert.ok(stopMarkerSize(mode, 18, true) <= 40);
  }
  assert.ok(stopMarkerSize('bus', 14) <= 14);
});
test('crowded stops collapse into groups at wide zooms and all reappear at street zoom', () => {
  const stops = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    name: String(i),
    modes: ['bus'],
    lines: '',
    lat: 39.75,
    lng: -104.99 + i / 100000,
  }));
  const project = (stop) => ({ x: 100 + Number(stop.id), y: 100 });
  const groups = groupBusStops(stops, 14, project);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].stops.length, 10);
  assert.ok(Math.abs(groups[0].lat - 39.75) < 0.000001);
  const expanded = groupBusStops(stops, 16, project);
  assert.equal(expanded.length, 10);
  assert.deepEqual(
    expanded.flatMap((group) => group.stops.map((stop) => stop.id)),
    stops.map((stop) => stop.id),
  );
  assert.deepEqual(groupBusStops([], 14, project), []);
});
