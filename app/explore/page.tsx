import Explorer from '@/components/explorer';
import listings from '@/data/listings.json';
import type { Listing } from '@/lib/explorer-model';

export const dynamic = 'force-static';

export default function ExplorePage() {
  return <Explorer listings={listings as Listing[]} />;
}
