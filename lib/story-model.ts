import type { TransitMode } from './transit-model';

export interface StoryStay {
  id: string;
  neighborhood: string;
  price: number | null;
  point: [number, number] | null;
  distances: Record<TransitMode, number | null>;
}

export interface StoryData {
  totalListings: number;
  stays: StoryStay[];
  railPaths: { mode: TransitMode; path: string }[];
}

// A local equirectangular projection: north is up, with equal distance scales.
// Keep the full default listing extent in a 640 × 490 view box.
export function storyPoint(lat: number, lng: number): [number, number] {
  const scale = 1750;
  return [
    320 + (lng + 104.91732) * Math.cos((39.72 * Math.PI) / 180) * scale,
    245 - (lat - 39.7184) * scale,
  ];
}

export function storySummary(stays: StoryStay[], budget: number) {
  // Match the explorer: 1000 is the uncapped "Any budget" endpoint.
  const matching = stays.filter(
    (stay) => budget === 1000 || (stay.price !== null && stay.price <= budget),
  );
  const counts = new Map<string, number>();
  for (const stay of matching) {
    counts.set(stay.neighborhood, (counts.get(stay.neighborhood) ?? 0) + 1);
  }
  const neighborhoods = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const prices = matching
    .flatMap((stay) => (stay.price === null ? [] : [stay.price]))
    .sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median =
    prices.length === 0
      ? null
      : prices.length % 2
        ? prices[middle]
        : (prices[middle - 1] + prices[middle]) / 2;
  return { matching, neighborhoods, pricedCount: prices.length, median };
}

export function priceDistribution(stays: StoryStay[], budget: number) {
  // Fixed $100 bins make comparisons honest as the budget changes.
  // The final bin includes every price at or above $600.
  const bins = Array.from({ length: 7 }, (_, index) => ({
    label:
      index === 6 ? '$600+' : `$${index * 100} to under $${(index + 1) * 100}`,
    tick: index === 6 ? '$600+' : `$${index * 100}`,
    total: 0,
    matching: 0,
  }));
  for (const stay of stays) {
    if (stay.price === null) continue;
    const bin = bins[Math.min(6, Math.floor(stay.price / 100))];
    bin.total += 1;
    if (budget === 1000 || stay.price <= budget) bin.matching += 1;
  }
  return bins;
}

export function transitCoverage(stays: StoryStay[], meters: number) {
  const located = stays.filter((stay) => stay.point !== null);
  return (['bus', 'light_rail', 'train'] as const).map((mode) => {
    const count = located.filter((stay) => {
      const distance = stay.distances[mode];
      return distance !== null && distance <= meters;
    }).length;
    return {
      mode,
      count,
      total: located.length,
      percent: located.length ? (count / located.length) * 100 : 0,
    };
  });
}
