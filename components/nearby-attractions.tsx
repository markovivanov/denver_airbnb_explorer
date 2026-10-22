'use client';

import {
  ArrowUpRight,
  Flower2,
  Footprints,
  Landmark,
  Trees,
} from 'lucide-react';
import type { Listing } from '@/lib/explorer-model';
import {
  hasWalkingLocation,
  MAX_WALK_MINUTES,
  nearbyAttractions,
  walkingDirectionsUrl,
} from '@/lib/attractions-model';

export function WalkingPreview({ listing }: { listing: Listing }) {
  const walks = nearbyAttractions(listing).slice(0, 2);
  return (
    <span className="walking-preview">
      <span className="walking-preview-heading">
        <Footprints size={13} aria-hidden="true" /> Nearby on foot
        <small>Est. · demo</small>
      </span>
      {!hasWalkingLocation(listing) ? (
        <span className="walking-preview-empty">
          Walking times unavailable.
        </span>
      ) : !walks.length ? (
        <span className="walking-preview-empty">
          No demo spots within ~{MAX_WALK_MINUTES} min.
        </span>
      ) : (
        walks.map(({ attraction, minutes }) => (
          <span className="walking-preview-row" key={attraction.id}>
            <span>{attraction.name}</span>
            <b>~{minutes} min</b>
          </span>
        ))
      )}
    </span>
  );
}

export default function NearbyAttractions({ listing }: { listing: Listing }) {
  const walks = nearbyAttractions(listing).slice(0, 3);
  const icons = { Park: Trees, Museum: Landmark, Garden: Flower2 };
  return (
    <section
      className="nearby-attractions"
      aria-label="Estimated walking times to nearby attractions"
    >
      <div className="nearby-heading">
        <h4>
          <Footprints size={17} aria-hidden="true" /> Nearby on foot
        </h4>
        <span>DEMO ESTIMATES</span>
      </div>
      {!hasWalkingLocation(listing) ? (
        <p>Walking times need a location for this stay.</p>
      ) : !walks.length ? (
        <p>
          None of our six demo attractions is within an estimated{' '}
          {MAX_WALK_MINUTES}-minute walk.
        </p>
      ) : (
        <ul className="attraction-walks">
          {walks.map(({ attraction, minutes }) => {
            const Icon = icons[attraction.kind];
            return (
              <li key={attraction.id}>
                <a
                  className="attraction-walk"
                  href={walkingDirectionsUrl(listing, attraction)!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${attraction.name}, about ${minutes} minutes on foot. Check walking directions in Google Maps (opens a new tab).`}
                >
                  <span className="attraction-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="attraction-name">
                    <strong>{attraction.name}</strong>
                    <small>
                      {attraction.kind} · Check route{' '}
                      <ArrowUpRight size={11} aria-hidden="true" />
                    </small>
                  </span>
                  <b>
                    ~{minutes}
                    <small>min walk</small>
                  </b>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="walking-estimate-note">
        A few places to explore. Times are illustrative, not verified walking
        routes.
      </p>
    </section>
  );
}
