import LandingPage from '@/components/landing-page';
import listings from '@/data/listings.json';
import transit from '@/data/transit.json';
import {
  DEFAULT_FILTERS,
  filterListings,
  type Listing,
} from '@/lib/explorer-model';
import {
  ALL_TRANSIT,
  nearestStopsByMode,
  type TransitData,
} from '@/lib/transit-model';
import { storyPoint, type StoryData } from '@/lib/story-model';

export const dynamic = 'force-static';

export default function Home() {
  const matching = filterListings(listings as Listing[], DEFAULT_FILTERS);
  const network = transit as unknown as TransitData;
  const story: StoryData = {
    totalListings: listings.length,
    stays: matching.map((stay) => {
      const distances = {
        bus: null,
        light_rail: null,
        train: null,
      } as StoryData['stays'][number]['distances'];
      for (const connection of nearestStopsByMode(
        stay,
        network.stops,
        ALL_TRANSIT,
      )) {
        distances[connection.mode] = connection.meters;
      }
      return {
        id: stay.id,
        neighborhood: stay.neighborhood,
        price: stay.price,
        point:
          stay.lat === null || stay.lng === null
            ? null
            : storyPoint(stay.lat, stay.lng),
        distances,
      };
    }),
    railPaths: network.routes
      .filter((route) => route.mode !== 'bus')
      .flatMap((route) =>
        route.coordinates.map((line) => ({
          mode: route.mode,
          path: line
            .map(([lng, lat], index) => {
              const [x, y] = storyPoint(lat, lng);
              return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' '),
        })),
      ),
  };
  return <LandingPage data={story} />;
}
