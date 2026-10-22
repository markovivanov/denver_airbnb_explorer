import { distanceMeters } from './transit-model.ts';
import type { Location } from './transit-model.ts';

export interface Attraction {
  id: string;
  name: string;
  kind: 'Park' | 'Museum' | 'Garden';
  lat: number;
  lng: number;
  website: string;
}

// Approximate reference points for a small classroom demo, not verified entrances.
export const ATTRACTIONS: readonly Attraction[] = [
  {
    id: 'confluence-park',
    name: 'Confluence Park',
    kind: 'Park',
    lat: 39.7547,
    lng: -105.0085,
    website:
      'https://visitdenver.com/things-to-do/sports-recreation/city-parks/',
  },
  {
    id: 'commons-park',
    name: 'Commons Park',
    kind: 'Park',
    lat: 39.7581,
    lng: -105.0074,
    website:
      'https://visitdenver.com/things-to-do/sports-recreation/city-parks/',
  },
  {
    id: 'civic-center-park',
    name: 'Civic Center Park',
    kind: 'Park',
    lat: 39.7393,
    lng: -104.9892,
    website: 'https://civiccenterpark.org/visit/',
  },
  {
    id: 'denver-art-museum',
    name: 'Denver Art Museum',
    kind: 'Museum',
    lat: 39.7372,
    lng: -104.9898,
    website: 'https://www.denverartmuseum.org/en/plan-your-visit',
  },
  {
    id: 'botanic-gardens',
    name: 'Denver Botanic Gardens',
    kind: 'Garden',
    lat: 39.7321,
    lng: -104.9619,
    website: 'https://www.botanicgardens.org/york-street',
  },
  {
    id: 'nature-science-museum',
    name: 'Museum of Nature & Science',
    kind: 'Museum',
    lat: 39.7475,
    lng: -104.9428,
    website: 'https://www.dmns.org/visit/',
  },
];

export const MAX_WALK_MINUTES = 45;
export const WALKING_METERS_PER_MINUTE = 80; // 4.8 km/h; illustrative pace.
export const WALKING_DISTANCE_FACTOR = 1.3; // Allow for indirect streets, without routing.

export interface AttractionWalk {
  attraction: Attraction;
  meters: number;
  minutes: number;
}

export function hasWalkingLocation(location: Location): boolean {
  return (
    location.lat !== null &&
    location.lng !== null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lng) <= 180
  );
}

export function nearbyAttractions(
  from: Location,
  attractions: readonly Attraction[] = ATTRACTIONS,
): AttractionWalk[] {
  if (!hasWalkingLocation(from)) return [];
  return attractions
    .flatMap((attraction) => {
      if (!hasWalkingLocation(attraction)) return [];
      const meters = distanceMeters(from, attraction)!;
      const minutes =
        (meters * WALKING_DISTANCE_FACTOR) / WALKING_METERS_PER_MINUTE;
      if (minutes > MAX_WALK_MINUTES) return [];
      return [
        {
          attraction,
          meters,
          // Round up to five-minute steps instead of implying exact route times.
          minutes: Math.max(5, Math.ceil(minutes / 5) * 5),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.meters - b.meters || a.attraction.id.localeCompare(b.attraction.id),
    );
}

export function walkingDirectionsUrl(
  from: Location,
  attraction: Attraction,
): string | null {
  if (!hasWalkingLocation(from)) return null;
  const destinationName =
    attraction.id === 'nature-science-museum'
      ? 'Denver Museum of Nature & Science'
      : attraction.name;
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${destinationName}, Denver, CO`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
