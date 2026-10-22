'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BusFront,
  Check,
  Heart,
  MapPin,
  MoveUpRight,
  TrainFront,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { priceLabel } from '@/lib/explorer-model';
import { TRANSIT_MODES } from '@/lib/transit-model';
import {
  priceDistribution,
  storySummary,
  transitCoverage,
  type StoryData,
} from '@/lib/story-model';
import './landing-page.css';

const chapters = [
  'Find your neighborhood',
  'Find your price',
  'Find your connection',
];
const number = (value: number) => value.toLocaleString('en-US');
const percent = (value: number) => `${Math.round(value)}%`;
const barStyle = (value: number, delay = 0) =>
  ({
    '--bar-width': `${value}%`,
    '--bar-delay': `${delay}ms`,
  }) as CSSProperties;

export default function LandingPage({ data }: { data: StoryData }) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(1000);
  const [radius, setRadius] = useState(800);
  const [showRail, setShowRail] = useState(true);
  const storyRef = useRef<HTMLElement>(null);
  const summary = useMemo(
    () => storySummary(data.stays, budget),
    [data.stays, budget],
  );
  const bins = useMemo(
    () => priceDistribution(data.stays, budget),
    [data.stays, budget],
  );
  const coverage = useMemo(
    () => transitCoverage(summary.matching, radius),
    [summary.matching, radius],
  );
  const baseline = useMemo(() => storySummary(data.stays, 1000), [data.stays]);
  const busCoverage = coverage.find((row) => row.mode === 'bus')!;
  const maxBin = Math.max(1, ...bins.map((bin) => bin.total));

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections =
        storyRef.current?.querySelectorAll<HTMLElement>('[data-story-step]');
      if (!sections?.length) return;
      // The chapter crossing the lower middle of the viewport drives the chart.
      // Using position also handles reverse scrolling and large scroll jumps.
      let active = 0;
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top < window.innerHeight * 0.68)
          active = index;
      });
      setStep(active);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  function goToChapter(index: number) {
    setStep(index);
    const section = storyRef.current?.querySelector<HTMLElement>(
      `[data-story-step="${index}"]`,
    );
    section?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="carless-story">
      <a className="story-skip" href="#story">
        Skip to the data story
      </a>
      <header className="site-header story-header">
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
          <a className="story-nav-link" href="#story">
            The story in the data
          </a>
          <Button
            className="story-header-cta"
            render={<Link href="/explore/" />}
            nativeButton={false}
          >
            Explore Denver <ArrowRight size={16} />
          </Button>
        </nav>
      </header>

      <main>
        <section className="story-hero" aria-labelledby="story-title">
          <div className="story-hero-copy">
            <p className="story-kicker">
              <span /> DENVER, COLORADO · MEET CARLESS
            </p>
            <h1 id="story-title">
              A great stay.
              <br />A little closer
              <br />
              to <em>everything.</em>
            </h1>
            <p className="story-intro">
              Your Airbnb is only half the trip. Find the neighborhood, the
              price, and the public transit that bring the rest of Denver within
              reach.
            </p>
            <a className="story-scroll-link" href="#story">
              <span>
                <ArrowDown size={20} />
              </span>{' '}
              Scroll to explore the data
            </a>
            <div className="story-hero-facts">
              <div>
                <strong>{number(data.totalListings)}</strong>
                <span>Denver listings</span>
              </div>
              <div>
                <strong>{baseline.neighborhoods.length}</strong>
                <span>neighborhoods with matches</span>
              </div>
            </div>
          </div>
          <figure className="story-map-card">
            <figcaption>
              <span className="story-kicker">THE CITY, CONNECTED</span>
              <span className="story-map-live">
                <span /> Real Denver data
              </span>
            </figcaption>
            <div className="story-map-canvas">
              {/* An inline SVG needs its image role to expose the chart title. */}
              {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
              <svg
                viewBox="0 0 640 490"
                role="img"
                aria-labelledby="overview-title overview-description"
              >
                <title id="overview-title">
                  Locations of the {number(data.stays.length)} matching Denver
                  stays
                </title>
                <desc id="overview-description">
                  Each green dot is a listing matching 2 guests, 3 nights, and
                  an entire place. Purple and blue lines show RTD light rail and
                  commuter rail. Coordinates are approximate.
                </desc>
                <defs>
                  <pattern
                    id="story-map-grid"
                    width="46"
                    height="46"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 46 0 L 0 0 0 46"
                      fill="none"
                      stroke="#d7dfd2"
                      strokeWidth="0.65"
                    />
                  </pattern>
                  <clipPath id="story-map-clip">
                    <rect width="640" height="490" rx="12" />
                  </clipPath>
                </defs>
                <rect width="640" height="490" fill="url(#story-map-grid)" />
                <g clipPath="url(#story-map-clip)">
                  <g
                    className={`story-rail-lines ${showRail ? '' : 'is-hidden'}`}
                  >
                    {data.railPaths.map((route, index) => (
                      <path
                        key={index}
                        d={route.path}
                        fill="none"
                        stroke={route.mode === 'train' ? '#2570a8' : '#7857a7'}
                        strokeWidth="2.4"
                        opacity="0.65"
                      />
                    ))}
                  </g>
                  <g className="story-listing-dots">
                    {data.stays.map(
                      (stay) =>
                        stay.point && (
                          <circle
                            key={stay.id}
                            cx={stay.point[0]}
                            cy={stay.point[1]}
                            r="2.2"
                            fill="#215f55"
                            opacity="0.48"
                          />
                        ),
                    )}
                  </g>
                </g>
                <g fill="#61776b" fontFamily="Arial, sans-serif" fontSize="11">
                  <text x="602" y="33">
                    N
                  </text>
                  <path
                    d="M606 62V41m-4 5 4-5 4 5"
                    fill="none"
                    stroke="currentColor"
                  />
                </g>
                <g transform="translate(35, 449)">
                  <path d="M0 -5V0H41V-5" fill="none" stroke="#61776b" />
                  <text x="0" y="18" fill="#61776b" fontSize="11">
                    ≈ 2.6 km
                  </text>
                </g>
              </svg>
              {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
              <div className="story-map-note">
                <MapPin size={17} />
                <div>
                  <strong>{number(data.stays.length)} places to start.</strong>
                  <span>2 guests · 3 nights · entire place</span>
                </div>
              </div>
            </div>
            <div className="story-map-legend">
              <span>
                <i className="story-dot" /> Matching stays
              </span>
              <Button
                variant="outline"
                className="story-rail-toggle"
                aria-pressed={showRail}
                onClick={() => setShowRail(!showRail)}
              >
                {showRail ? <Check size={15} /> : <TrainFront size={15} />} Rail
                routes
              </Button>
            </div>
            <p className="story-map-source">
              Listing locations: Inside Airbnb · Rail routes: © RTD
            </p>
          </figure>
        </section>

        <section className="story-context" aria-label="Example trip">
          <p>One city. A few good questions.</p>
          <div>
            <span>OUR EXAMPLE TRIP</span>
            <strong>2 guests</strong>
            <i /> <strong>3 nights</strong>
            <i />
            <strong>Entire place</strong>
          </div>
        </section>

        <section
          className="story-layout"
          id="story"
          ref={storyRef}
          aria-label="Explore the story in three charts"
        >
          <div className="story-visual">
            <div className="story-chart-card">
              <nav className="story-chart-tabs" aria-label="Chart chapters">
                {chapters.map((chapter, index) => (
                  <Button
                    key={chapter}
                    variant="ghost"
                    className={step === index ? 'is-active' : ''}
                    aria-current={step === index ? 'step' : undefined}
                    onClick={() => goToChapter(index)}
                  >
                    <span>0{index + 1}</span>
                    <span>{['Neighborhood', 'Budget', 'Transit'][index]}</span>
                  </Button>
                ))}
              </nav>
              <div className="story-chart-body" key={step}>
                <div className="story-chart-heading">
                  <p className="story-kicker">
                    {
                      [
                        'WHERE TO BEGIN',
                        'ROOM FOR YOUR BUDGET',
                        'THE NEXT CONNECTION',
                      ][step]
                    }
                  </p>
                  <h3>
                    {
                      [
                        'Where should I stay?',
                        'What does a night in Denver cost?',
                        'How close is the nearest stop?',
                      ][step]
                    }
                  </h3>
                </div>
                {step === 0 && (
                  <div
                    className="story-neighborhood-chart"
                    aria-label="Top eight neighborhoods by matching listing count"
                  >
                    <div className="story-chart-axis">
                      <span>NEIGHBORHOOD</span>
                      <span>MATCHING STAYS</span>
                    </div>
                    {summary.neighborhoods.slice(0, 8).map((row, index) => (
                      <div className="story-neighborhood-row" key={row.name}>
                        <span>{row.name}</span>
                        <div className="story-bar-track">
                          <div
                            className={
                              index === 0 ? 'story-bar is-coral' : 'story-bar'
                            }
                            style={barStyle(
                              (row.count /
                                Math.max(
                                  1,
                                  baseline.neighborhoods[0]?.count ?? 1,
                                )) *
                                100,
                              index * 45,
                            )}
                          />
                        </div>
                        <strong>{number(row.count)}</strong>
                      </div>
                    ))}
                    {summary.matching.length === 0 && (
                      <p className="story-empty">No stays match this budget.</p>
                    )}
                    <p className="story-chart-note">
                      Top 8 of {summary.neighborhoods.length} neighborhoods.
                      Counts reflect listing supply, not neighborhood size.
                    </p>
                  </div>
                )}
                {step === 1 && (
                  <div className="story-price-chart">
                    <div className="story-price-stat">
                      <strong>{priceLabel(summary.median, true)}</strong>
                      <span>
                        median listed nightly price
                        <br />
                        {number(summary.pricedCount)} stays with a price
                      </span>
                    </div>
                    <figure
                      className="story-histogram"
                      aria-label={`Listed nightly prices. ${bins.map((bin) => `${bin.label}: ${bin.matching} matching of ${bin.total} stays`).join('; ')}`}
                    >
                      {bins.map((bin, index) => (
                        <div className="story-histogram-column" key={bin.label}>
                          <span>{number(bin.matching)}</span>
                          <div className="story-histogram-track">
                            <div
                              className="story-histogram-total"
                              style={{
                                height: `${(bin.total / maxBin) * 100}%`,
                              }}
                            />
                            <div
                              className="story-histogram-fill"
                              style={{
                                height: `${(bin.matching / maxBin) * 100}%`,
                                animationDelay: `${index * 55}ms`,
                              }}
                            />
                          </div>
                          <small>{bin.tick}</small>
                        </div>
                      ))}
                    </figure>
                    <div className="story-chart-legend">
                      <span>
                        <i className="story-dot" /> Within your budget
                      </span>
                      <span>
                        <i className="story-dot is-muted" /> All priced matches
                      </span>
                    </div>
                    <p className="story-chart-note">
                      $100 bins starting at each label; final bin $600+. USD per
                      night before fees and taxes.{' '}
                      {number(data.stays.length - baseline.pricedCount)} stays
                      have no listed price.
                    </p>
                  </div>
                )}
                {step === 2 && (
                  <div className="story-transit-chart">
                    <div className="story-chart-axis">
                      <span>
                        STAYS WITH A STOP WITHIN{' '}
                        {radius.toLocaleString('en-US')} M
                      </span>
                      <span>0–100%</span>
                    </div>
                    {coverage.map((row, index) => {
                      const mode = TRANSIT_MODES.find(
                        (item) => item.id === row.mode,
                      )!;
                      const Icon = row.mode === 'bus' ? BusFront : TrainFront;
                      return (
                        <div
                          className="story-transit-row"
                          key={row.mode}
                          style={
                            { '--mode-color': mode.color } as CSSProperties
                          }
                        >
                          <div className="story-transit-label">
                            <span>
                              <Icon size={20} /> {mode.label}
                            </span>
                            <strong>{percent(row.percent)}</strong>
                          </div>
                          <div className="story-transit-track">
                            <div
                              className="story-bar"
                              style={barStyle(row.percent, index * 100)}
                            />
                          </div>
                          <p>
                            {number(row.count)} of {number(row.total)} matching
                            stays with coordinates
                          </p>
                        </div>
                      );
                    })}
                    <p className="story-chart-note">
                      Straight-line distance to a stop in the RTD snapshot. A
                      stay can qualify for several modes. This does not measure
                      service frequency or a walking route.
                    </p>
                  </div>
                )}
              </div>
              <div className="story-chart-footer">
                <span>
                  <i className="story-dot" /> {number(summary.matching.length)}{' '}
                  matching stays
                </span>
                <span>
                  {budget === 1000 ? 'Any budget' : `Up to $${budget} / night`}
                </span>
              </div>
            </div>
          </div>

          <div className="story-chapters">
            <article
              id="neighborhood-story"
              className={`story-chapter ${step === 0 ? 'is-active' : ''}`}
              data-story-step="0"
            >
              <span className="story-chapter-number">
                01 / THE NEIGHBORHOOD
              </span>
              <h2>
                First, find your
                <br />
                <em>part of the city.</em>
              </h2>
              <p>
                Matching stays aren’t spread evenly across Denver. Start with
                the neighborhoods where you have more places to compare, then
                explore what’s around them.
              </p>
              <div className="story-insight">
                <strong>{number(summary.neighborhoods[0]?.count ?? 0)}</strong>
                <p>
                  matching stays in{' '}
                  <b>{summary.neighborhoods[0]?.name ?? 'this selection'}</b>,
                  the largest concentration for this example trip
                  {budget < 1000 ? ` under $${budget} a night` : ''}.
                </p>
              </div>
              <p className="story-product-note">
                <MapPin size={18} /> In Carless, filter by neighborhood and see
                every match on the map.
              </p>
            </article>

            <article
              id="budget-story"
              className={`story-chapter ${step === 1 ? 'is-active' : ''}`}
              data-story-step="1"
            >
              <span className="story-chapter-number">
                02 / THE NIGHTLY PRICE
              </span>
              <h2>
                A good fit.
                <br />
                <em>At your price.</em>
              </h2>
              <p>
                A citywide average can hide a lot. See the spread of listed
                prices, then bring the budget down to something that works for
                your trip.
              </p>
              <fieldset className="story-control-group">
                <legend>TRY A NIGHTLY BUDGET</legend>
                <div className="story-budget-buttons">
                  {[150, 250, 400, 1000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      className={budget === amount ? 'is-selected' : ''}
                      aria-pressed={budget === amount}
                      onClick={() => setBudget(amount)}
                    >
                      {amount === 1000 ? 'Any budget' : `Up to $${amount}`}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <output className="story-control-result">
                {number(summary.matching.length)} stays match
                {budget === 1000
                  ? ' with no price cap.'
                  : ` at $${budget} a night or less.`}
              </output>
              <p className="story-product-note">
                <Check size={18} /> Your budget carries through all three
                charts.
              </p>
            </article>

            <article
              id="transit-story"
              className={`story-chapter ${step === 2 ? 'is-active' : ''}`}
              data-story-step="2"
            >
              <span className="story-chapter-number">03 / THE WAY AROUND</span>
              <h2>
                Stay here.
                <br />
                <em>Go from there.</em>
              </h2>
              <p>
                Bus, light rail, or commuter rail? Those are different
                connections. Compare how many matching stays have each kind of
                stop nearby.
              </p>
              <fieldset className="story-control-group">
                <legend>CHOOSE A STRAIGHT-LINE DISTANCE</legend>
                <div className="story-radius-buttons">
                  {[400, 800, 1200].map((meters) => (
                    <Button
                      key={meters}
                      variant="outline"
                      className={radius === meters ? 'is-selected' : ''}
                      aria-pressed={radius === meters}
                      onClick={() => setRadius(meters)}
                    >
                      {meters < 1000 ? `${meters} m` : '1.2 km'}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <output className="story-control-result">
                {percent(busCoverage.percent)} of matching stays with
                coordinates have a bus stop within{' '}
                {radius < 1000 ? `${radius} m` : '1.2 km'}.
              </output>
              <p className="story-product-note">
                <MoveUpRight size={18} /> In the app, select a stay to draw its
                connection to a stop and compare distances.
              </p>
            </article>
          </div>
        </section>

        <section className="story-next" aria-labelledby="story-next-title">
          <p className="story-kicker">
            FROM THE BIG PICTURE TO YOUR FRONT DOOR
          </p>
          <h2 id="story-next-title">
            Make the map <em>your own.</em>
          </h2>
          <div className="story-feature-grid">
            <div>
              <MapPin size={25} />
              <h3>Find your stay</h3>
              <p>
                Set your guests, nights, and budget. Explore matching Airbnbs by
                neighborhood.
              </p>
            </div>
            <div>
              <TrainFront size={25} />
              <h3>Follow the connection</h3>
              <p>
                Switch transit modes on and off. Pick a stay and see the
                distance to a stop.
              </p>
            </div>
            <div>
              <Heart size={25} />
              <h3>Keep the contenders</h3>
              <p>
                Save your favorites and compare them together before choosing
                your place.
              </p>
            </div>
          </div>
        </section>

        <section className="story-finale" aria-labelledby="story-finale-title">
          <p className="story-kicker">
            A LITTLE LESS DRIVING. A LITTLE MORE DENVER.
          </p>
          <h2 id="story-finale-title">
            Where will you
            <br />
            <em>start?</em>
          </h2>
          <Button
            className="story-final-cta"
            render={<Link href="/explore/" />}
            nativeButton={false}
          >
            View Carless <ArrowRight size={23} />
          </Button>
          <p>The city is yours to explore.</p>
        </section>
      </main>

      <footer className="story-footer">
        <div>
          <span className="story-kicker">CARLESS · DENVER</span>
          <p>Take the scenic route.</p>
        </div>
        <p>
          June 2026 listings snapshot ·{' '}
          <a href="https://insideairbnb.com/get-the-data/">Inside Airbnb</a> ·
          Transit © <a href="https://www.rtd-denver.com/">RTD</a>
          <br />A classroom exploration. Approximate listing locations; prices
          and transit are snapshots. Trip filters don’t check availability.
          Verify current routes and service with RTD.
        </p>
      </footer>
    </div>
  );
}
