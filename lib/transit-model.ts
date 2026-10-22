export type TransitMode = 'bus' | 'light_rail' | 'train';
export type TransitVisibility = Record<TransitMode, boolean>;
export const ALL_TRANSIT: TransitVisibility = {
  bus: true,
  light_rail: true,
  train: true,
};
export const TRANSIT_MODES = [
  {
    id: 'bus',
    label: 'Bus',
    description: 'Local & regional',
    color: '#a36316',
  },
  {
    id: 'light_rail',
    label: 'Light rail',
    description: 'City connections',
    color: '#7857a7',
  },
  {
    id: 'train',
    label: 'Commuter rail',
    description: 'A · B · G · N',
    color: '#2570a8',
  },
] as const;
export interface TransitRoute {
  id: string;
  mode: TransitMode;
  refs: string[];
  name: string;
  coordinates: [number, number][][];
}
export interface TransitStop {
  id: string;
  name: string;
  modes: TransitMode[];
  lines: string;
  lat: number;
  lng: number;
}
export interface TransitData {
  routes: TransitRoute[];
  stops: TransitStop[];
  sourceModifiedAt: string;
  retrievedAt: string;
}
export interface TransitConnection {
  stop: TransitStop;
  mode: TransitMode;
  meters: number;
}
export type Location = { lat: number | null; lng: number | null };

export function stopMarkerSize(
  mode: TransitMode,
  zoom: number,
  focused = false,
): number {
  const size =
    mode === 'bus'
      ? Math.min(32, Math.max(8, 8 + (zoom - 13) * 5))
      : Math.min(34, Math.max(14, 14 + (zoom - 10) * 2.5));
  return Math.round(focused ? Math.max(26, Math.min(40, size + 8)) : size);
}

export function groupBusStops(
  stops: TransitStop[],
  zoom: number,
  project: (stop: TransitStop) => { x: number; y: number },
) {
  // Group nearby bus stops at overview zooms; reveal every exact location at 16+.
  const cellSize = zoom <= 13 ? 56 : zoom === 14 ? 44 : 32;
  const groups = new Map<string, TransitStop[]>();
  for (const stop of stops) {
    const point = project(stop);
    const key =
      zoom >= 16
        ? stop.id
        : `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    const group = groups.get(key) ?? [];
    group.push(stop);
    groups.set(key, group);
  }
  return [...groups.values()].map((items) => ({
    stops: items,
    lat: items.reduce((sum, stop) => sum + stop.lat, 0) / items.length,
    lng: items.reduce((sum, stop) => sum + stop.lng, 0) / items.length,
  }));
}

export function distanceMeters(from: Location, to: Location): number | null {
  if (
    from.lat === null ||
    from.lng === null ||
    to.lat === null ||
    to.lng === null ||
    ![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)
  )
    return null;
  const radians = Math.PI / 180;
  const latitudeChange = (to.lat - from.lat) * radians;
  const longitudeChange = (to.lng - from.lng) * radians;
  const a =
    Math.sin(latitudeChange / 2) ** 2 +
    Math.cos(from.lat * radians) *
      Math.cos(to.lat * radians) *
      Math.sin(longitudeChange / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function formatDistance(meters: number): string {
  if (meters < 10) return '<10 m';
  if (meters < 995) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function nearestStopsByMode(
  from: Location,
  stops: TransitStop[],
  modes: TransitVisibility,
): TransitConnection[] {
  const nearest: Partial<Record<TransitMode, TransitConnection>> = {};
  for (const stop of stops) {
    const meters = distanceMeters(from, stop);
    if (meters === null) continue;
    for (const mode of stop.modes) {
      if (modes[mode] && (!nearest[mode] || meters < nearest[mode]!.meters))
        nearest[mode] = { stop, mode, meters };
    }
  }
  return TRANSIT_MODES.flatMap(({ id }) => (nearest[id] ? [nearest[id]!] : []));
}

export function connectionToStop(
  from: Location,
  stop: TransitStop,
  modes: TransitVisibility,
  preferredMode?: TransitMode,
): TransitConnection | null {
  const mode =
    preferredMode && modes[preferredMode] && stop.modes.includes(preferredMode)
      ? preferredMode
      : stop.modes.find((candidate) => modes[candidate]);
  const meters = distanceMeters(from, stop);
  return mode && meters !== null ? { stop, mode, meters } : null;
}
export function visibleTransit(data: TransitData, modes: TransitVisibility) {
  return {
    routes: data.routes.filter((route) => modes[route.mode]),
    stops: data.stops.filter((stop) => stop.modes.some((mode) => modes[mode])),
  };
}
