'use client';

import { BusFront, TrainFront, TramFront, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistance, TRANSIT_MODES } from '@/lib/transit-model';
import type { TransitConnection, TransitMode } from '@/lib/transit-model';
import type { CSSProperties } from 'react';

export default function NearbyTransit({
  nearest,
  connection,
  loading,
  hasLocation,
  showStops,
  onSelect,
}: {
  nearest: TransitConnection[];
  connection: TransitConnection | null;
  loading: boolean;
  hasLocation: boolean;
  showStops: boolean;
  onSelect: (id: string, mode?: TransitMode) => void;
}) {
  const icons = { bus: BusFront, light_rail: TramFront, train: TrainFront };
  const custom =
    connection && !nearest.some((item) => item.stop.id === connection.stop.id);
  return (
    <section
      className="nearby-transit"
      aria-label="Distance to nearby public transportation"
    >
      <div className="nearby-heading">
        <h4>From your doorstep</h4>
        <span>NEAREST BY MODE</span>
      </div>
      {loading ? (
        <p>Loading nearby stops…</p>
      ) : !hasLocation ? (
        <p>This listing has no map coordinates.</p>
      ) : !nearest.length ? (
        <p>Turn on a transit mode above the map to find its nearest stop.</p>
      ) : (
        <>
          <div className="nearby-options">
            {nearest.map((item) => {
              const mode = TRANSIT_MODES.find(
                (value) => value.id === item.mode,
              )!;
              const Icon = icons[item.mode];
              const active =
                showStops &&
                connection?.stop.id === item.stop.id &&
                connection.mode === item.mode;
              return (
                <Button
                  key={item.mode}
                  variant="outline"
                  className={`nearby-stop ${active ? 'is-active' : ''}`}
                  style={{ '--mode-color': mode.color } as CSSProperties}
                  aria-pressed={active}
                  onClick={() => onSelect(item.stop.id, item.mode)}
                >
                  <Icon size={21} />
                  <span>
                    <small>{mode.label}</small>
                    <strong>{item.stop.name}</strong>
                  </span>
                  <b>{formatDistance(item.meters)}</b>
                  <ArrowUpRight size={14} />
                </Button>
              );
            })}
          </div>
          {custom && (
            <div className="custom-stop-distance">
              <small>Selected on the map</small>
              <strong>{connection.stop.name}</strong>
              <b>{formatDistance(connection.meters)}</b>
            </div>
          )}
          <p className="distance-note">
            Approximate straight-line distances, not walking routes. Tap a stop
            to draw the connection
            {showStops ? '.' : ' and show stations on the map.'}
          </p>
        </>
      )}
    </section>
  );
}
