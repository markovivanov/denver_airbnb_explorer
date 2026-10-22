'use client';

import { BusFront, Check, TrainFront, TramFront } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ALL_TRANSIT, TRANSIT_MODES } from '@/lib/transit-model';
import type { TransitVisibility } from '@/lib/transit-model';
import type { CSSProperties } from 'react';

export default function TransitControls({
  modes,
  onChange,
  stops,
  onStops,
}: {
  modes: TransitVisibility;
  onChange: (modes: TransitVisibility) => void;
  stops: boolean;
  onStops: (value: boolean) => void;
}) {
  const icons = { bus: BusFront, light_rail: TramFront, train: TrainFront };
  const active = Object.values(modes).filter(Boolean).length;
  return (
    <section className="transit-controls" aria-labelledby="transit-title">
      <div className="transit-heading">
        <div>
          <span className="eyebrow">EXPLORE THE CONNECTIONS</span>
          <h2 id="transit-title">How will you get around?</h2>
        </div>
        <Button
          variant="ghost"
          onClick={() =>
            onChange(
              active
                ? { bus: false, light_rail: false, train: false }
                : ALL_TRANSIT,
            )
          }
        >
          {active ? 'Hide all' : 'Show all'}
        </Button>
      </div>
      <div className="transit-mode-buttons">
        {TRANSIT_MODES.map((mode) => {
          const Icon = icons[mode.id];
          return (
            <Button
              key={mode.id}
              variant="outline"
              className={`transit-mode-button ${modes[mode.id] ? 'is-on' : ''}`}
              style={{ '--mode-color': mode.color } as CSSProperties}
              aria-pressed={modes[mode.id]}
              onClick={() => onChange({ ...modes, [mode.id]: !modes[mode.id] })}
            >
              <Icon className="transport-icon" />
              <span className="mode-copy">
                <strong>{mode.label}</strong>
                <small>{mode.description}</small>
              </span>
              <span className="mode-state">
                {modes[mode.id] ? <Check size={14} /> : null}
                {modes[mode.id] ? 'On' : 'Off'}
              </span>
            </Button>
          );
        })}
      </div>
      <div className="transit-control-footer">
        <label htmlFor="stops-toggle">
          <Switch
            id="stops-toggle"
            checked={stops}
            onCheckedChange={onStops}
            size="sm"
          />{' '}
          Show stops & stations
        </label>
        <span>
          {active
            ? 'Select a stay, then a stop to see the distance'
            : 'All transit hidden · Choose a mode above'}
        </span>
      </div>
    </section>
  );
}
