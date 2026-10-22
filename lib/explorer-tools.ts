'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { filterListings, summarize } from './explorer-model';
import type { Filters, Listing } from './explorer-model';
import type { TransitVisibility } from './transit-model';

interface ExplorerState {
  transitModes: TransitVisibility;
  showStops: boolean;
  setTransitModes: (modes: TransitVisibility) => void;
  setShowStops: (value: boolean) => void;
  listings: Listing[];
  filters: Filters;
  visible: Listing[];
  saved: string[];
  setFilters: (filters: Filters) => void;
  setSaved: (ids: string[]) => void;
  resetView: () => void;
}
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface Registry {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected an object.');
  return input as Record<string, unknown>;
}

export function validateFilterInput(
  input: unknown,
  current: Filters,
  listings: Listing[],
): Filters {
  const patch = objectInput(input);
  const result = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(current, key)) throw new Error(`Unknown filter: ${key}`);
    if (key === 'guests' || key === 'nights') {
      const allowed =
        key === 'guests'
          ? [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]
          : [1, 2, 3, 4, 5, 7, 14, 30];
      if (typeof value !== 'number' || !allowed.includes(value))
        throw new Error(`Unsupported ${key}.`);
      result[key] = value;
    } else if (key === 'maxPrice') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 50 ||
        value > 1000 ||
        value % 25 !== 0
      )
        throw new Error(
          'maxPrice must be a multiple of 25 from 50 to 1000. 1000 means no limit.',
        );
      result.maxPrice = value;
    } else if (key === 'minRating') {
      if (typeof value !== 'number' || ![0, 4, 4.5, 4.8, 4.9].includes(value))
        throw new Error('Unsupported rating.');
      result.minRating = value;
    } else if (
      key === 'query' ||
      key === 'neighborhood' ||
      key === 'roomType'
    ) {
      if (typeof value !== 'string' || value.length > 200)
        throw new Error(`Invalid ${key}.`);
      if (
        key !== 'query' &&
        value &&
        !listings.some((listing) => listing[key] === value)
      )
        throw new Error(`Unknown ${key}.`);
      result[key] = value;
    }
  }
  return result;
}

export function useExplorerTools(state: ExplorerState) {
  const current = useRef(state);
  useLayoutEffect(() => {
    current.current = state;
  });
  useEffect(() => {
    const registry = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!registry?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'read_denver_exploration',
        description:
          'Read current filters, visible result totals, saved listing IDs, and the first 20 visible listings.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (Object.keys(objectInput(input)).length)
            throw new Error('No parameters accepted.');
          const view = current.current;
          return {
            filters: view.filters,
            transitModes: view.transitModes,
            showStops: view.showStops,
            summary: summarize(view.visible),
            savedIds: view.saved,
            listings: view.visible
              .slice(0, 20)
              .map(({ id, title, neighborhood, price }) => ({
                id,
                title,
                neighborhood,
                price,
              })),
          };
        },
      },
      {
        name: 'configure_denver_filters',
        description:
          'Apply supplied trip filters, exit shortlist and map-only modes, and fit matching stays on the map. Omitted filters keep their values. maxPrice 1000 means no budget limit.',
        inputSchema: {
          type: 'object',
          properties: {
            guests: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16],
            },
            nights: { type: 'integer', enum: [1, 2, 3, 4, 5, 7, 14, 30] },
            roomType: {
              type: 'string',
              enum: [
                '',
                'Entire home/apt',
                'Private room',
                'Shared room',
                'Hotel room',
              ],
            },
            maxPrice: {
              type: 'number',
              minimum: 50,
              maximum: 1000,
              multipleOf: 25,
            },
            minRating: { type: 'number', enum: [0, 4, 4.5, 4.8, 4.9] },
            neighborhood: { type: 'string' },
            query: { type: 'string', maxLength: 200 },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const view = current.current;
          const filters = validateFilterInput(
            input,
            view.filters,
            view.listings,
          );
          flushSync(() => {
            view.setFilters(filters);
            view.resetView();
          });
          return {
            filters,
            summary: summarize(filterListings(view.listings, filters)),
          };
        },
      },
      {
        name: 'configure_denver_transit',
        description:
          'Toggle bus, light rail, commuter rail, or stop visibility using the same large controls shown above the map. Omitted values stay unchanged.',
        inputSchema: {
          type: 'object',
          properties: {
            bus: { type: 'boolean' },
            light_rail: { type: 'boolean' },
            train: { type: 'boolean' },
            showStops: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const args = objectInput(input);
          if (
            Object.entries(args).some(
              ([key, value]) =>
                !['bus', 'light_rail', 'train', 'showStops'].includes(key) ||
                typeof value !== 'boolean',
            )
          )
            throw new Error(
              'Transit controls accept boolean values for bus, light_rail, train, and showStops.',
            );
          const view = current.current;
          const modes = { ...view.transitModes };
          for (const key of ['bus', 'light_rail', 'train'] as const)
            if (typeof args[key] === 'boolean') modes[key] = args[key];
          const showStops =
            typeof args.showStops === 'boolean'
              ? args.showStops
              : view.showStops;
          flushSync(() => {
            view.setTransitModes(modes);
            view.setShowStops(showStops);
          });
          return { transitModes: modes, showStops };
        },
      },
      {
        name: 'save_denver_stays',
        description:
          'Add a batch of listing IDs to the personal shortlist. Keeps existing saved stays and never makes a booking.',
        inputSchema: {
          type: 'object',
          properties: {
            listingIds: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 50,
            },
          },
          required: ['listingIds'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const args = objectInput(input);
          const ids = args.listingIds;
          const view = current.current;
          if (
            Object.keys(args).some((key) => key !== 'listingIds') ||
            !Array.isArray(ids) ||
            ids.length > 50 ||
            ids.some(
              (id) =>
                typeof id !== 'string' ||
                !view.listings.some((listing) => listing.id === id),
            )
          )
            throw new Error('Supply up to 50 known string listing IDs.');
          const saved = [...new Set([...view.saved, ...(ids as string[])])];
          flushSync(() => view.setSaved(saved));
          return { savedIds: saved };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          registry.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* The visible interface works without browser tool support. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
