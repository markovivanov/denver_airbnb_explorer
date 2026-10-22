export interface Listing {
  id: string;
  title: string;
  neighborhood: string;
  roomType: string;
  guests: number | null;
  bedrooms: number | null;
  price: number | null;
  minNights: number | null;
  rating: number | null;
  locationRating: number | null;
  reviewCount: number | null;
  lat: number | null;
  lng: number | null;
  sampleCount: number;
  walkingCount: number;
  transitCount: number;
}
export interface Filters {
  guests: number;
  nights: number;
  roomType: string;
  maxPrice: number;
  minRating: number;
  neighborhood: string;
  query: string;
}
export const DEFAULT_FILTERS: Filters = {
  guests: 2,
  nights: 3,
  roomType: 'Entire home/apt',
  maxPrice: 1000,
  minRating: 0,
  neighborhood: '',
  query: '',
};
export type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};
export type SortKey = 'reviewed' | 'price' | 'rating';

export function filterListings(
  listings: Listing[],
  filters: Filters,
): Listing[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return listings.filter((listing) => {
    if (listing.guests === null || listing.guests < filters.guests)
      return false;
    if (listing.minNights === null || listing.minNights > filters.nights)
      return false;
    if (filters.roomType && listing.roomType !== filters.roomType) return false;
    if (filters.neighborhood && listing.neighborhood !== filters.neighborhood)
      return false;
    if (
      filters.maxPrice < 1000 &&
      (listing.price === null || listing.price > filters.maxPrice)
    )
      return false;
    if (
      filters.minRating > 0 &&
      (listing.rating === null || listing.rating < filters.minRating)
    )
      return false;
    if (
      query &&
      !`${listing.title} ${listing.neighborhood}`
        .toLocaleLowerCase()
        .includes(query)
    )
      return false;
    return true;
  });
}
export function inBounds(listing: Listing, bounds: Bounds): boolean {
  return (
    listing.lat !== null &&
    listing.lng !== null &&
    listing.lat >= bounds.south &&
    listing.lat <= bounds.north &&
    listing.lng >= bounds.west &&
    listing.lng <= bounds.east
  );
}
export function sortListings(listings: Listing[], sort: SortKey): Listing[] {
  return [...listings].sort((a, b) => {
    if (sort === 'price')
      return (
        (a.price ?? Infinity) - (b.price ?? Infinity) ||
        a.id.localeCompare(b.id)
      );
    if (sort === 'rating')
      return (
        (b.rating ?? -1) - (a.rating ?? -1) ||
        (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
      );
    return (
      (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || a.id.localeCompare(b.id)
    );
  });
}
export function summarize(listings: Listing[]) {
  const prices = listings
    .flatMap((listing) => (listing.price === null ? [] : [listing.price]))
    .sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = !prices.length
    ? null
    : prices.length % 2
      ? prices[middle]
      : (prices[middle - 1] + prices[middle]) / 2;
  return {
    count: listings.length,
    median,
    pricedCount: prices.length,
    neighborhoods: new Set(listings.map((listing) => listing.neighborhood))
      .size,
    sampleCount: listings.reduce(
      (sum, listing) => sum + listing.sampleCount,
      0,
    ),
    walkingCount: listings.reduce(
      (sum, listing) => sum + listing.walkingCount,
      0,
    ),
    transitCount: listings.reduce(
      (sum, listing) => sum + listing.transitCount,
      0,
    ),
  };
}
export function priceLabel(price: number | null, exact = false) {
  return price === null
    ? 'Price unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: exact ? 2 : 0,
      }).format(price);
}
export function listingsCSV(listings: Listing[]) {
  const escape = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      'Listing ID',
      'Title',
      'Neighborhood',
      'Room type',
      'Guests',
      'Listed nightly USD',
      'Overall rating',
      'Minimum nights',
      'Airbnb URL',
    ],
    ...listings.map((listing) => [
      listing.id,
      listing.title,
      listing.neighborhood,
      listing.roomType,
      listing.guests,
      listing.price,
      listing.rating,
      listing.minNights,
      `https://www.airbnb.com/rooms/${listing.id}`,
    ]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
}
