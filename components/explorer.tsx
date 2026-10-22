'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BedDouble,
  Bookmark,
  ChevronRight,
  Compass,
  Download,
  Heart,
  Info,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ExplorerMap from '@/components/explorer-map';
import TransitControls from '@/components/transit-controls';
import NearbyTransit from '@/components/nearby-transit';
import NearbyAttractions, { WalkingPreview } from '@/components/nearby-attractions';
import {
  ALL_TRANSIT,
  nearestStopsByMode,
  connectionToStop,
} from '@/lib/transit-model';
import type {
  TransitData,
  TransitMode,
  TransitVisibility,
} from '@/lib/transit-model';
import {
  DEFAULT_FILTERS,
  filterListings,
  inBounds,
  listingsCSV,
  priceLabel,
  sortListings,
  summarize,
} from '@/lib/explorer-model';
import { useExplorerTools } from '@/lib/explorer-tools';
import type { Bounds, Filters, Listing, SortKey } from '@/lib/explorer-model';

export default function Explorer({ listings }: { listings: Listing[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [transitModes, setTransitModes] =
    useState<TransitVisibility>(ALL_TRANSIT);
  const [showStops, setShowStops] = useState(true);
  const [transitData, setTransitData] = useState<TransitData | null>(null);
  const [stopChoice, setStopChoice] = useState<{
    listingId: string;
    stopId: string;
    mode?: TransitMode;
  } | null>(null);
  const [selection, setSelected] = useState<Listing | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [mapOnly, setMapOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('reviewed');
  const [fitRequest, setFitRequest] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [radius, setRadius] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [limit, setLimit] = useState(25);
  const neighborhoods = useMemo(
    () => [...new Set(listings.map((listing) => listing.neighborhood))].sort(),
    [listings],
  );
  const matching = useMemo(
    () => filterListings(listings, filters),
    [listings, filters],
  );
  const mapListings = useMemo(
    () =>
      savedOnly
        ? matching.filter((listing) => saved.includes(listing.id))
        : matching,
    [matching, savedOnly, saved],
  );
  const selected =
    selection && mapListings.some((listing) => listing.id === selection.id)
      ? selection
      : null;
  const nearest = useMemo(
    () =>
      selected && transitData
        ? nearestStopsByMode(selected, transitData.stops, transitModes)
        : [],
    [selected, transitData, transitModes],
  );
  const connection = useMemo(() => {
    if (!selected || !transitData) return null;
    const chosen =
      stopChoice?.listingId === selected.id
        ? transitData.stops.find((stop) => stop.id === stopChoice.stopId)
        : null;
    const explicit = chosen
      ? connectionToStop(selected, chosen, transitModes, stopChoice?.mode)
      : null;
    return (
      explicit ?? [...nearest].sort((a, b) => a.meters - b.meters)[0] ?? null
    );
  }, [selected, transitData, stopChoice, transitModes, nearest]);
  const selectStop = useCallback(
    (stopId: string, mode?: TransitMode) => {
      if (!selected) return;
      setStopChoice({ listingId: selected.id, stopId, mode });
      setShowStops(true);
    },
    [selected],
  );
  const visible = useMemo(
    () =>
      sortListings(
        mapOnly && bounds
          ? mapListings.filter((listing) => inBounds(listing, bounds))
          : mapListings,
        sort,
      ),
    [mapListings, mapOnly, bounds, sort],
  );
  const stats = useMemo(() => summarize(visible), [visible]);
  const savedListings = useMemo(
    () => listings.filter((listing) => saved.includes(listing.id)),
    [listings, saved],
  );
  const areaStats = useMemo(
    () =>
      summarize(
        matching.filter(
          (listing) => listing.neighborhood === selected?.neighborhood,
        ),
      ),
    [matching, selected],
  );
  const onBounds = useCallback((value: Bounds) => setBounds(value), []);
  const clearSelection = useCallback(() => {
    setSelected(null);
    setStopChoice(null);
    setRadius(false);
  }, []);
  const selectListing = useCallback((listing: Listing) => {
    setSelected((current) => (current?.id === listing.id ? null : listing));
    setStopChoice(null);
  }, []);
  useEffect(() => {
    const clearOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !showInfo &&
        !showCompare &&
        !showFilters
      )
        clearSelection();
    };
    document.addEventListener('keydown', clearOnEscape);
    return () => document.removeEventListener('keydown', clearOnEscape);
  }, [clearSelection, showInfo, showCompare, showFilters]);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem('carless-shortlist-v1') ?? '[]',
      );
      const knownIds = new Set(listings.map((listing) => listing.id));
      // Browser storage is external state, loaded after server hydration.
      if (Array.isArray(stored))
        // oxlint-disable-next-line react/react-compiler
        setSaved([
          ...new Set(
            stored.filter(
              (id): id is string => typeof id === 'string' && knownIds.has(id),
            ),
          ),
        ]);
    } catch {
      // oxlint-disable-next-line react/react-compiler -- Reflect an external storage failure.
      setStorageError(true);
    }
    // oxlint-disable-next-line react/react-compiler -- Hydration finished reading browser storage.
    setStorageReady(true);
  }, [listings]);
  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem('carless-shortlist-v1', JSON.stringify(saved));
    } catch {
      // oxlint-disable-next-line react/react-compiler -- Reflect an external storage failure.
      setStorageError(true);
    }
  }, [saved, storageReady]);
  useEffect(() => {
    if (!showFilters) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFilters(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [showFilters]);
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setLimit(25);
  }
  function save(id: string) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function reset() {
    setFilters(DEFAULT_FILTERS);
    setSavedOnly(false);
    setMapOnly(false);
    setSelected(null);
    setLimit(25);
    setFitRequest((value) => value + 1);
  }
  function exportListings() {
    const url = URL.createObjectURL(
      new Blob([listingsCSV(visible)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'denver-stays.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useExplorerTools({
    transitModes,
    setTransitModes,
    showStops,
    setShowStops,
    listings,
    filters,
    visible,
    saved,
    setFilters,
    setSaved,
    resetView: () => {
      setMapOnly(false);
      setSavedOnly(false);
      setSelected(null);
      setLimit(25);
      setFitRequest((value) => value + 1);
    },
  });

  return (
    <main className="explorer-app">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Carless home">
          <Image
            className="brand-logo"
            src="/logo.png"
            alt="Carless"
            width={1532}
            height={1424}
            unoptimized
            priority
          />
        </Link>
        <span className="header-context">A DIFFERENT WAY TO STAY</span>
        <nav aria-label="Main navigation">
          <Button
            variant="ghost"
            className={!savedOnly ? 'header-link current' : 'header-link'}
            onClick={() => setSavedOnly(false)}
          >
            Explore Denver
          </Button>
          <Button
            variant="ghost"
            className={savedOnly ? 'header-link current' : 'header-link'}
            onClick={() => setSavedOnly(true)}
          >
            <Bookmark size={15} /> Shortlist{' '}
            <span className="count-badge">{saved.length}</span>
          </Button>
          <Button
            variant="outline"
            className="compare-button"
            disabled={!saved.length}
            onClick={() => setShowCompare(true)}
          >
            Compare
          </Button>
          <Button
            variant="outline"
            className="about-button"
            onClick={() => setShowInfo(true)}
          >
            <Info size={16} />
            <span>About the data</span>
          </Button>
        </nav>
      </header>
      <div className="workspace">
        {showFilters && (
          <button
            className="filter-backdrop"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />
        )}
        <aside
          id="listing-filters"
          className={`filter-panel ${showFilters ? 'mobile-open' : ''}`}
          aria-label="Listing filters"
        >
          <div className="filter-intro">
            <div className="eyebrow">
              <span /> DENVER, WITHOUT A CAR
            </div>
            <h1>
              Stay here.
              <br />
              <em>Go anywhere.</em>
            </h1>
            <p>
              A little less driving.
              <br />A little more discovering.
            </p>
            <Button
              className="mobile-filter-close"
              variant="ghost"
              size="icon"
              aria-label="Close filters"
              onClick={() => setShowFilters(false)}
            >
              <X />
            </Button>
          </div>
          <div className="filter-section">
            <div className="section-label">
              <span>01</span>
              <h2>Make it your trip</h2>
            </div>
            <div className="two-fields">
              <label>
                Guests
                <NativeSelect
                  value={filters.guests}
                  onChange={(event) =>
                    update('guests', Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value} {value === 1 ? 'guest' : 'guests'}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label>
                Nights
                <NativeSelect
                  value={filters.nights}
                  onChange={(event) =>
                    update('nights', Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5, 7, 14, 30].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value} {value === 1 ? 'night' : 'nights'}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <label>
              Place to stay
              <NativeSelect
                value={filters.roomType}
                onChange={(event) => update('roomType', event.target.value)}
              >
                <NativeSelectOption value="">Any room type</NativeSelectOption>
                {[
                  'Entire home/apt',
                  'Private room',
                  'Shared room',
                  'Hotel room',
                ].map((room) => (
                  <NativeSelectOption key={room}>{room}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <div className="budget-label">
              <label htmlFor="budget">Nightly budget</label>
              <strong>
                {filters.maxPrice === 1000
                  ? 'Any budget'
                  : `Up to $${filters.maxPrice}`}
              </strong>
            </div>
            <Slider
              id="budget"
              aria-label="Maximum listed nightly price"
              value={[filters.maxPrice]}
              min={50}
              max={1000}
              step={25}
              onValueChange={(value) =>
                update('maxPrice', Array.isArray(value) ? value[0] : value)
              }
            />
            <div className="slider-labels">
              <span>$50</span>
              <span>No limit</span>
            </div>
          </div>
          <div className="filter-section">
            <div className="section-label">
              <span>02</span>
              <h2>Find your neighborhood</h2>
            </div>
            <label className="sr-only" htmlFor="neighborhood">
              Neighborhood
            </label>
            <NativeSelect
              id="neighborhood"
              value={filters.neighborhood}
              onChange={(event) => {
                update('neighborhood', event.target.value);
                setFitRequest((value) => value + 1);
              }}
            >
              <NativeSelectOption value="">
                All neighborhoods
              </NativeSelectOption>
              {neighborhoods.map((name) => (
                <NativeSelectOption key={name}>{name}</NativeSelectOption>
              ))}
            </NativeSelect>
            <label>
              Minimum guest rating
              <NativeSelect
                value={filters.minRating}
                onChange={(event) =>
                  update('minRating', Number(event.target.value))
                }
              >
                <NativeSelectOption value={0}>Any rating</NativeSelectOption>
                {[4, 4.5, 4.8, 4.9].map((rating) => (
                  <NativeSelectOption key={rating} value={rating}>
                    {rating.toFixed(1)} and above
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div className="filter-bottom">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={14} /> Reset filters
            </Button>
            <p>
              Explore a snapshot, then verify your stay.
              <br />
              Prices exclude fees. Availability is not confirmed.
            </p>
          </div>
        </aside>
        <div className="map-column">
          <div className="map-heading">
            <div>
              <span className="eyebrow">YOUR DENVER, AT A GLANCE</span>
              <h2 aria-live="polite">
                {stats.count.toLocaleString()} possibilities
                <span className="coral">.</span>
              </h2>
            </div>
            <div className="summary-pair">
              <span
                title={`Based on ${stats.pricedCount} listings with a price`}
              >
                <strong>
                  {stats.median === null ? '—' : priceLabel(stats.median)}
                </strong>
                <small>median / night</small>
              </span>
              <span>
                <strong>{stats.neighborhoods}</strong>
                <small>neighborhoods</small>
              </span>
            </div>
            <Button
              variant="outline"
              className="mobile-filter-button"
              aria-expanded={showFilters}
              aria-controls="listing-filters"
              onClick={() => setShowFilters(true)}
            >
              <SlidersHorizontal /> Filters
            </Button>
          </div>
          <TransitControls
            modes={transitModes}
            onChange={setTransitModes}
            stops={showStops}
            onStops={setShowStops}
          />
          <ExplorerMap
            listings={mapListings}
            selected={selected}
            modes={transitModes}
            showStops={showStops}
            fitRequest={fitRequest}
            radius={radius}
            onSelect={selectListing}
            onClearSelection={clearSelection}
            onBounds={onBounds}
            connection={showStops ? connection : null}
            onStopSelect={selectStop}
            onTransitData={setTransitData}
          />
          <div className="map-footer">
            <span>
              <i /> LISTINGS SNAPSHOT · JUN 2026
            </span>
            <span>Take the scenic route.</span>
          </div>
        </div>
        <aside className="results-panel" aria-label="Matching listings">
          <div className="results-heading">
            <div>
              <span className="eyebrow">FIND A PLACE TO BEGIN</span>
              <h2>
                {savedOnly ? 'Your shortlist' : 'Places to stay'}{' '}
                <span>{visible.length.toLocaleString()}</span>
              </h2>
            </div>
            <div className="search-field">
              <Search size={16} />
              <Input
                aria-label="Search listing titles and neighborhoods"
                placeholder="Search a place or neighborhood"
                value={filters.query}
                onChange={(event) => update('query', event.target.value)}
              />
            </div>
            <div className="results-controls">
              <NativeSelect
                aria-label="Sort listings"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                <NativeSelectOption value="reviewed">
                  Most reviewed
                </NativeSelectOption>
                <NativeSelectOption value="price">
                  Lowest price
                </NativeSelectOption>
                <NativeSelectOption value="rating">
                  Highest rated
                </NativeSelectOption>
              </NativeSelect>
              <label className="map-only" htmlFor="map-only-toggle">
                <Switch
                  size="sm"
                  id="map-only-toggle"
                  checked={mapOnly}
                  onCheckedChange={setMapOnly}
                  aria-label="Only show listings in the current map view"
                />
                <span>In map view</span>
              </label>
            </div>
            <div className="export-row">
              <span>
                {savedOnly
                  ? `${saved.length} saved · ${visible.length} match this view`
                  : 'Listed prices · before fees'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!visible.length}
                onClick={exportListings}
              >
                <Download size={13} /> CSV
              </Button>
            </div>
          </div>
          <div className="results-scroll">
            {!visible.length ? (
              <div className="empty-state">
                <Compass size={34} />
                <h3>
                  {savedOnly
                    ? 'A little room for possibility.'
                    : 'Try a wider search.'}
                </h3>
                <p>
                  {savedOnly
                    ? 'Save a few stays with the heart button. They’ll be here when you need them.'
                    : 'Adjust your budget, neighborhood, or map view to find more options.'}
                </p>
                <Button variant="outline" onClick={reset}>
                  Explore all stays
                </Button>
              </div>
            ) : (
              visible.slice(0, limit).map((listing) => (
                <article
                  className={`listing-card ${selected?.id === listing.id ? 'is-selected' : ''}`}
                  key={listing.id}
                >
                  <div className="listing-meta">
                    <span>
                      <MapPin size={12} /> {listing.neighborhood}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${saved.includes(listing.id) ? 'Remove' : 'Save'} ${listing.title}`}
                      aria-pressed={saved.includes(listing.id)}
                      onClick={() => save(listing.id)}
                    >
                      <Heart
                        size={16}
                        className={
                          saved.includes(listing.id) ? 'heart-saved' : ''
                        }
                      />
                    </Button>
                  </div>
                  <button
                    className="listing-main"
                    onClick={() => selectListing(listing)}
                    aria-pressed={selected?.id === listing.id}
                  >
                    <h3>{listing.title}</h3>
                    <p>
                      {listing.roomType.replace(
                        'Entire home/apt',
                        'Entire place',
                      )}
                      <span>·</span>
                      {listing.guests} guests<span>·</span>
                      {listing.bedrooms === null
                        ? 'Bedrooms unknown'
                        : `${listing.bedrooms} ${listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`}
                    </p>
                    <div className="listing-bottom">
                      <span className="listing-price">
                        {listing.price === null ? (
                          <small>Price unavailable</small>
                        ) : (
                          <>
                            <strong>{priceLabel(listing.price)}</strong>
                            <small> / night</small>
                          </>
                        )}
                      </span>
                      <span className="listing-rating">
                        <Star size={12} fill="currentColor" />{' '}
                        {listing.rating?.toFixed(2) ?? 'Unrated'}{' '}
                        <small>({listing.reviewCount ?? 0})</small>
                        <ChevronRight size={14} />
                      </span>
                    </div>
                    <WalkingPreview listing={listing} />
                  </button>
                </article>
              ))
            )}
            {visible.length > limit && (
              <Button
                variant="outline"
                className="show-more"
                onClick={() => setLimit((value) => value + 25)}
              >
                Show 25 more stays
              </Button>
            )}
          </div>
          <output className="results-footnote">
            <span className="mini-dot" />{' '}
            {storageError
              ? 'Shortlist is available for this session only.'
              : savedOnly
                ? 'Saved on this browser. Compare includes all saved stays.'
                : 'Click a stay to explore its surroundings.'}
          </output>
        </aside>
      </div>
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="information-dialog">
          <DialogTitle>Good trips start with good context.</DialogTitle>
          <DialogDescription>
            Carless is a Denver exploration tool, built from real accommodation
            data.
          </DialogDescription>
          <p>
            These are {listings.length.toLocaleString()} listings in the Inside
            Airbnb release labeled June 30, 2026. Trip filters check room type,
            guest capacity, and minimum stay. They do not verify date-specific
            availability.
          </p>
          <p>
            Prices are listed nightly amounts, not checkout totals. Published
            coordinates are approximate. Guest ratings describe past
            impressions, not walkability.
          </p>
          <p>
            Transit routes and stations come from RTD’s public GIS network
            snapshot. Toggle bus, light rail, and commuter rail separately.
            Locations are generalized, and the snapshot may include suspended
            lines. Verify current service, schedules, and accessibility with
            RTD. This independent classroom tool is not endorsed by RTD.
          </p>
          <p>
            Walking times cover six example parks, museums, and gardens.
            We multiply straight-line distance by 1.3, assume a 4.8 km/h pace,
            and round up to five-minute steps. Both stay and attraction locations
            are approximate. Estimates do not account for crossings, entrances,
            terrain, or accessibility. Check the linked walking directions and
            opening hours before going.
          </p>
          <a
            href="https://insideairbnb.com/get-the-data/"
            target="_blank"
            rel="noreferrer"
          >
            Inside Airbnb · CC BY 4.0 <ArrowUpRight size={14} />
          </a>
          <a
            href="https://app.rtd-denver.com/"
            target="_blank"
            rel="noreferrer"
          >
            Check connections with RTD <ArrowUpRight size={14} />
          </a>
        </DialogContent>
      </Dialog>
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="compare-dialog">
          <DialogTitle>A few places. A clearer picture.</DialogTitle>
          <DialogDescription>
            All saved stays, including those outside your filters. Estimated
            base prices exclude fees and taxes.
          </DialogDescription>
          {!savedListings.length ? (
            <p>Your shortlist is empty. Save a stay to compare it here.</p>
          ) : (
            <div className="compare-scroll">
              <table>
                <caption className="sr-only">
                  Comparison of saved Denver listings
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Your shortlist</th>
                    {savedListings.map((listing) => (
                      <th scope="col" key={listing.id}>
                        <span>{listing.neighborhood}</span>
                        <a
                          href={`https://www.airbnb.com/rooms/${listing.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {listing.title} <ArrowUpRight size={12} />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => save(listing.id)}
                        >
                          Remove
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      'Listed / night',
                      (listing: Listing) => priceLabel(listing.price, true),
                    ],
                    [
                      `${filters.nights}-night base price`,
                      (listing: Listing) =>
                        listing.price === null
                          ? 'Unavailable'
                          : priceLabel(listing.price * filters.nights, true),
                    ],
                    [
                      'Guest rating',
                      (listing: Listing) =>
                        listing.rating === null
                          ? 'Unrated'
                          : `${listing.rating.toFixed(2)} / 5 (${listing.reviewCount ?? 0} reviews)`,
                    ],
                    [
                      'Capacity / bedrooms',
                      (listing: Listing) =>
                        `${listing.guests ?? '—'} guests / ${listing.bedrooms ?? '—'} bedrooms`,
                    ],
                    [
                      'Minimum stay',
                      (listing: Listing) =>
                        `${listing.minNights ?? '—'} nights`,
                    ],
                    [
                      'Walking mentions',
                      (listing: Listing) =>
                        `${listing.walkingCount} / ${listing.sampleCount} sampled reviews`,
                    ],
                    [
                      'Transit mentions',
                      (listing: Listing) =>
                        `${listing.transitCount} / ${listing.sampleCount} sampled reviews`,
                    ],
                    [
                      'Matches trip filters',
                      (listing: Listing) =>
                        matching.some((item) => item.id === listing.id)
                          ? 'Yes'
                          : 'Outside current filters',
                    ],
                  ].map(([label, value]) => (
                    <tr key={label as string}>
                      <th scope="row">{label as string}</th>
                      {savedListings.map((listing) => (
                        <td key={listing.id}>
                          {(value as (listing: Listing) => string)(listing)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="fine-print">
            Mentions are keyword matches, not recommendations or evidence of
            service quality. A review can mention both topics.
          </p>
        </DialogContent>
      </Dialog>
      {selected && (
        <section className="selection-card" aria-label="Selected listing">
          <div>
            <span className="eyebrow">{selected.neighborhood}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close selected listing"
              onClick={clearSelection}
            >
              <X />
            </Button>
          </div>
          <h3>{selected.title}</h3>
          <NearbyAttractions listing={selected} />
          <NearbyTransit
            nearest={nearest}
            connection={connection}
            loading={!transitData}
            hasLocation={selected.lat !== null && selected.lng !== null}
            showStops={showStops}
            onSelect={selectStop}
          />
          <div className="selection-stats">
            <span>
              <BedDouble size={16} /> {selected.bedrooms ?? '—'} bedrooms
            </span>
            <span>
              <Users size={16} /> {selected.guests} guests
            </span>
            <strong>
              {priceLabel(selected.price)}
              {selected.price !== null && <small> / night</small>}
            </strong>
          </div>
          <div className="review-evidence">
            <h4>What guests mention</h4>
            <p>
              {selected.sampleCount
                ? `${selected.walkingCount} walking · ${selected.transitCount} transit`
                : 'No sampled reviews for this stay.'}
            </p>
            {selected.sampleCount > 0 && (
              <small>
                Out of {selected.sampleCount} sampled reviews. Keyword matches;
                not a walkability score.
              </small>
            )}
            <div className="neighborhood-context">
              <strong>{areaStats.count}</strong> matching stays in{' '}
              {selected.neighborhood}
              {areaStats.median !== null && (
                <span>
                  Median listed price: {priceLabel(areaStats.median)} / night
                </span>
              )}
            </div>
          </div>
          <label className="switch-row" htmlFor="radius-toggle">
            <span>Show 800 m around this stay</span>
            <Switch
              id="radius-toggle"
              checked={radius}
              onCheckedChange={setRadius}
              aria-label="Show an 800 meter straight-line radius"
            />
          </label>
          <small className="fine-print">
            Straight-line distance, not a walking route.
          </small>
          <div className="selection-actions">
            <Button
              variant="outline"
              size="icon"
              aria-label={saved.includes(selected.id) ? 'Unsave listing' : 'Save listing'}
              aria-pressed={saved.includes(selected.id)}
              onClick={() => save(selected.id)}
            >
              <Heart
                className={saved.includes(selected.id) ? 'heart-saved' : ''}
              />
            </Button>
            <a
              className="primary-link"
              href={`https://www.airbnb.com/rooms/${selected.id}`}
              target="_blank"
              rel="noreferrer"
            >
              View listing <ArrowUpRight size={15} />
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
