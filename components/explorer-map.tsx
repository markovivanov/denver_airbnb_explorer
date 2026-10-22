'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { LocateFixed, Minus, Plus, X, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Bounds, Listing } from '@/lib/explorer-model';
import { priceLabel } from '@/lib/explorer-model';
import {
  TRANSIT_MODES,
  visibleTransit,
  formatDistance,
  stopMarkerSize,
  groupBusStops,
} from '@/lib/transit-model';
import type {
  TransitConnection,
  TransitData,
  TransitMode,
  TransitStop,
  TransitVisibility,
} from '@/lib/transit-model';

const TRANSPORT_SYMBOLS = {
  bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 10h14M8 18v3M16 18v3"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
  light_rail:
    '<rect x="6" y="5" width="12" height="13" rx="3"/><path d="M8 2h8M12 2v3M6 11h12M9 18l-2 3M15 18l2 3"/>',
  train:
    '<rect x="5" y="3" width="14" height="15" rx="5"/><path d="M5 10h14M12 3v7M8 18l-2 3M16 18l2 3"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
};
function stopIcon(
  L: typeof Leaflet,
  modeId: TransitMode,
  zoom: number,
  focused = false,
) {
  const mode = TRANSIT_MODES.find((item) => item.id === modeId)!;
  const size = stopMarkerSize(modeId, zoom, focused);
  const target = Math.max(24, size);
  return L.divIcon({
    className: 'transit-stop-shell',
    iconSize: [target, target],
    iconAnchor: [target / 2, target / 2],
    html: `<span class="transit-stop-icon ${modeId === 'bus' ? 'bus-stop-icon' : ''} ${focused ? 'is-focused' : ''}" style="--mode-color:${mode.color};--stop-size:${size}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRANSPORT_SYMBOLS[modeId]}</svg></span>`,
  });
}

interface Props {
  connection: TransitConnection | null;
  onStopSelect: (id: string) => void;
  onTransitData: (data: TransitData) => void;
  listings: Listing[];
  selected: Listing | null;
  modes: TransitVisibility;
  showStops: boolean;
  fitRequest: number;
  radius: boolean;
  onSelect: (listing: Listing) => void;
  onClearSelection: () => void;
  onBounds: (bounds: Bounds) => void;
}

export default function ExplorerMap(props: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const highlight = useRef<Leaflet.LayerGroup | null>(null);
  const transitLayer = useRef<Leaflet.LayerGroup | null>(null);
  const stopLayer = useRef<Leaflet.LayerGroup | null>(null);
  const transitData = useRef<TransitData | null>(null);
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver | undefined;
    Promise.all([import('leaflet'), import('@/data/transit.json')])
      .then(([L, data]) => {
        if (cancelled || !element.current) return;
        library.current = L;
        transitData.current = data.default as unknown as TransitData;
        callbacks.current.onTransitData(transitData.current);
        const instance = L.map(element.current, {
          zoomControl: false,
          // SVG lets clicks pass through empty areas between shapes in separate panes.
          // A canvas covers the whole map and blocks interactive layers below it.
          preferCanvas: false,
          minZoom: 9,
          maxZoom: 18,
        }).setView([39.749, -104.988], 12);
        map.current = instance;
        const streets = L.tileLayer(
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Transit © <a href="https://www.rtd-denver.com/">RTD</a>',
          },
        ).addTo(instance);
        streets.on('tileerror', () => setTileError(true));
        streets.on('tileload', () => setTileError(false));
        instance.createPane('transit-routes').style.zIndex = '350';
        const distancePane = instance.createPane('distance-lines');
        distancePane.style.zIndex = '430';
        distancePane.style.pointerEvents = 'none';
        instance.createPane('transit-stops').style.zIndex = '610';
        instance.createPane('selected-stops').style.zIndex = '640';
        transitLayer.current = L.layerGroup().addTo(instance);
        stopLayer.current = L.layerGroup().addTo(instance);
        markers.current = L.layerGroup().addTo(instance);
        highlight.current = L.layerGroup().addTo(instance);
        const reportBounds = () => {
          const bounds = instance.getBounds();
          callbacks.current.onBounds({
            south: bounds.getSouth(),
            north: bounds.getNorth(),
            west: bounds.getWest(),
            east: bounds.getEast(),
          });
        };
        instance.on('moveend', reportBounds);
        instance.on('click', () => callbacks.current.onClearSelection());
        resize = new ResizeObserver(() => instance.invalidateSize());
        resize.observe(element.current);
        L.control
          .scale({ position: 'bottomleft', imperial: false })
          .addTo(instance);
        reportBounds();
        setReady(true);
      })
      .catch(() =>
        setError(
          'The map could not load. You can still explore every listing in the list.',
        ),
      );
    return () => {
      cancelled = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    const routes = transitLayer.current;
    const stops = stopLayer.current;
    const data = transitData.current;
    if (!ready || !L || !instance || !routes || !stops || !data) return;
    routes.clearLayers();
    const visible = visibleTransit(data, props.modes);
    for (const route of visible.routes) {
      const mode = TRANSIT_MODES.find((item) => item.id === route.mode)!;
      const tooltip = document.createElement('span');
      tooltip.textContent = `${mode.label} · ${route.refs.join(' / ')} · ${route.name}`;
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${mode.label} · ${route.refs.join(' / ')}`;
      const description = document.createElement('p');
      description.textContent = route.name;
      const note = document.createElement('p');
      note.textContent =
        'RTD network snapshot. Verify current service and schedules.';
      const link = document.createElement('a');
      link.href = 'https://app.rtd-denver.com/';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Plan a trip with RTD ↗';
      popup.append(title, description, note, link);
      L.polyline(
        route.coordinates.map((line) =>
          line.map(([lng, lat]) => [lat, lng] as [number, number]),
        ),
        {
          pane: 'transit-routes',
          bubblingMouseEvents: false,
          color: mode.color,
          weight: route.mode === 'bus' ? 2.3 : 4,
          opacity: route.mode === 'bus' ? 0.58 : 0.85,
          dashArray: route.mode === 'train' ? '10 4' : undefined,
        },
      )
        .bindTooltip(tooltip, { sticky: true })
        .bindPopup(popup)
        .addTo(routes);
    }
    const updateStops = () => {
      stops.clearLayers();
      if (!props.showStops) return;
      const bounds = instance.getBounds().pad(0.1);
      const zoom = instance.getZoom();
      const visibleBusStops: TransitStop[] = [];
      const addStop = (stop: TransitStop, modeId: TransitMode) => {
        const mode = TRANSIT_MODES.find((item) => item.id === modeId)!;
        const content = document.createElement('span');
        content.textContent = `${stop.name} · ${mode.label}${stop.lines ? ' · ' + stop.lines : ''}`;
        const marker = L.marker([stop.lat, stop.lng], {
          icon: stopIcon(L, modeId, zoom),
          pane: 'transit-stops',
          bubblingMouseEvents: false,
          title: `${mode.label}: ${stop.name}. Select to measure from your Airbnb.`,
        })
          .bindTooltip(content, {
            direction: 'top',
            offset: [0, -stopMarkerSize(modeId, zoom) / 2],
          })
          .addTo(stops);
        marker.on('click', () => {
          if (callbacks.current.selected)
            callbacks.current.onStopSelect(stop.id);
          else {
            const popup = document.createElement('div');
            const details = content.cloneNode(true);
            const hint = document.createElement('p');
            hint.textContent =
              'Select an Airbnb first to see its distance to this stop.';
            popup.append(details, hint);
            marker.bindPopup(popup).openPopup();
          }
        });
      };
      for (const stop of visible.stops) {
        // The measured stop gets its own prominent marker in the highlight layer.
        if (
          stop.id === props.connection?.stop.id ||
          !bounds.contains([stop.lat, stop.lng])
        )
          continue;
        const modeId = stop.modes.find((mode) => props.modes[mode])!;
        if (zoom < (modeId === 'bus' ? 12 : 10)) continue;
        if (modeId === 'bus') visibleBusStops.push(stop);
        else addStop(stop, modeId);
      }
      const busGroups = groupBusStops(visibleBusStops, zoom, (stop) =>
        instance.project([stop.lat, stop.lng], zoom),
      );
      for (const group of busGroups) {
        if (group.stops.length === 1) {
          addStop(group.stops[0], 'bus');
          continue;
        }
        const icon = L.divIcon({
          className: 'bus-stop-group-shell',
          iconSize: [36, 24],
          iconAnchor: [18, 12],
          html: `<span class="bus-stop-group"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${TRANSPORT_SYMBOLS.bus}</svg><b>${group.stops.length}</b></span>`,
        });
        L.marker([group.lat, group.lng], {
          icon,
          pane: 'transit-stops',
          bubblingMouseEvents: false,
          title: `${group.stops.length} bus stops — click to zoom in`,
        })
          .bindTooltip(`${group.stops.length} bus stops · click to zoom in`)
          .on('click', () =>
            instance.fitBounds(
              L.latLngBounds(group.stops.map((stop) => [stop.lat, stop.lng])),
              { padding: [70, 70], maxZoom: 17 },
            ),
          )
          .addTo(stops);
      }
    };
    updateStops();
    instance.on('moveend', updateStops);
    return () => {
      instance.off('moveend', updateStops);
      routes.clearLayers();
      stops.clearLayers();
    };
  }, [ready, props.modes, props.showStops, props.connection?.stop.id]);

  useEffect(() => {
    const instance = map.current;
    const L = library.current;
    const group = markers.current;
    if (!ready || !instance || !L || !group) return;
    const redraw = () => {
      group.clearLayers();
      const zoom = instance.getZoom();
      const buckets = new Map<string, Listing[]>();
      const bounds = instance.getBounds().pad(0.12);
      for (const listing of props.listings) {
        if (
          listing.lat === null ||
          listing.lng === null ||
          !bounds.contains([listing.lat, listing.lng])
        )
          continue;
        const point = instance.project([listing.lat, listing.lng], zoom);
        const key =
          zoom >= 15
            ? listing.id
            : `${Math.floor(point.x / 44)},${Math.floor(point.y / 44)}`;
        const items = buckets.get(key) ?? [];
        items.push(listing);
        buckets.set(key, items);
      }
      for (const items of buckets.values()) {
        if (items.length > 1) {
          const center: [number, number] = [
            items.reduce((sum, item) => sum + item.lat!, 0) / items.length,
            items.reduce((sum, item) => sum + item.lng!, 0) / items.length,
          ];
          const marker = L.marker(center, {
            title: `${items.length} matching listings — zoom in`,
            icon: L.divIcon({
              className: 'cluster-shell',
              html: `<span class="map-cluster ${items.length >= 20 ? 'map-cluster-large' : ''}">${items.length}</span>`,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            }),
          });
          marker.on('click', () =>
            instance.fitBounds(
              L.latLngBounds(items.map((item) => [item.lat!, item.lng!])),
              { padding: [70, 70], maxZoom: 15 },
            ),
          );
          marker.addTo(group);
        } else {
          const listing = items[0];
          const tooltip = document.createElement('div');
          tooltip.className = 'listing-tooltip';
          const price = document.createElement('strong');
          price.textContent = priceLabel(listing.price);
          const title = document.createElement('span');
          title.textContent = listing.title;
          tooltip.append(price, title);
          const marker = L.circleMarker([listing.lat!, listing.lng!], {
            radius: 5,
            color: '#ffffff',
            weight: 1.5,
            fillColor: '#146d66',
            fillOpacity: 0.93,
            bubblingMouseEvents: false,
          });
          marker.bindTooltip(tooltip, {
            direction: 'top',
            offset: [0, -7],
            className: 'carless-tooltip',
          });
          marker.on('click', () => callbacks.current.onSelect(listing));
          marker.addTo(group);
        }
      }
    };
    redraw();
    instance.on('moveend', redraw);
    return () => {
      instance.off('moveend', redraw);
      group.clearLayers();
    };
  }, [ready, props.listings]);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    if (!ready || !L || !instance || !highlight.current) return;
    highlight.current.clearLayers();
    const selected = props.selected;
    if (!selected || selected.lat === null || selected.lng === null) return;
    const home = L.divIcon({
      className: 'selected-home-shell',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: '<span class="selected-home-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></svg></span>',
    });
    L.marker([selected.lat, selected.lng], {
      icon: home,
      pane: 'selected-stops',
      title: 'Your selected Airbnb — click to clear',
      bubblingMouseEvents: false,
    })
      .on('click', () => callbacks.current.onClearSelection())
      .bindTooltip('Your Airbnb', {
        permanent: true,
        direction: 'bottom',
        offset: [0, 20],
        className: 'home-map-label',
      })
      .addTo(highlight.current);
    let focusedStation: Leaflet.Marker | null = null;
    if (props.connection) {
      const { stop, mode: modeId, meters } = props.connection;
      const mode = TRANSIT_MODES.find((item) => item.id === modeId)!;
      L.polyline(
        [
          [selected.lat, selected.lng],
          [stop.lat, stop.lng],
        ],
        {
          pane: 'distance-lines',
          interactive: false,
          color: mode.color,
          weight: 4,
          dashArray: '8 7',
          opacity: 1,
        },
      )
        .bindTooltip(`≈ ${formatDistance(meters)} · straight-line`, {
          permanent: true,
          direction: 'center',
          className: 'distance-map-label',
          opacity: 1,
          offset: [0, -12],
        })
        .addTo(highlight.current);
      const name = document.createElement('span');
      name.textContent = stop.name;
      focusedStation = L.marker([stop.lat, stop.lng], {
        icon: stopIcon(L, modeId, instance.getZoom(), true),
        pane: 'selected-stops',
        zIndexOffset: 500,
        title: `${mode.label}: ${stop.name}`,
      })
        .bindTooltip(name, {
          permanent: true,
          direction: 'top',
          offset: [0, -25],
          className: 'station-map-label',
        })
        .addTo(highlight.current);
    }
    if (props.radius)
      L.circle([selected.lat, selected.lng], {
        pane: 'distance-lines',
        radius: 800,
        color: '#de644f',
        weight: 1.5,
        dashArray: '5 6',
        fillColor: '#de644f',
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(highlight.current);
    const resizeFocusedStation = () => {
      if (focusedStation && props.connection)
        focusedStation.setIcon(
          stopIcon(L, props.connection.mode, instance.getZoom(), true),
        );
    };
    instance.on('zoomend', resizeFocusedStation);
    return () => {
      instance.off('zoomend', resizeFocusedStation);
    };
  }, [ready, props.selected, props.radius, props.connection]);

  useEffect(() => {
    const instance = map.current;
    const L = library.current;
    const selected = props.selected;
    if (
      !ready ||
      !instance ||
      !L ||
      !selected ||
      selected.lat === null ||
      selected.lng === null
    )
      return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    if (props.connection) {
      const stop = props.connection.stop;
      instance.fitBounds(
        L.latLngBounds([
          [selected.lat, selected.lng],
          [stop.lat, stop.lng],
        ]),
        {
          paddingTopLeft: [65, 85],
          paddingBottomRight: [65, 110],
          maxZoom: 16,
          animate,
        },
      );
    } else
      instance.setView(
        [selected.lat, selected.lng],
        Math.max(instance.getZoom(), 15),
        { animate },
      );
  }, [ready, props.selected, props.connection]);

  function fitAll() {
    const L = library.current;
    if (!L || !map.current) return;
    const points = callbacks.current.listings
      .filter((listing) => listing.lat !== null && listing.lng !== null)
      .map((listing) => [listing.lat!, listing.lng!] as [number, number]);
    if (points.length)
      map.current.fitBounds(L.latLngBounds(points), {
        padding: [45, 45],
        maxZoom: 14,
      });
  }
  useEffect(() => {
    if (ready && props.fitRequest > 0) fitAll();
  }, [ready, props.fitRequest]);

  return (
    <section
      className="map-stage"
      aria-label="Interactive Denver listing and public transit map"
    >
      <div ref={element} className="leaflet-surface" />
      {!ready && (
        <div className="map-loading">
          <MapIcon size={28} />
          <span>{error || 'Finding your bearings…'}</span>
        </div>
      )}
      <div className="map-topline">
        <span className="location-pill">
          <span className="live-dot" /> DENVER, COLORADO
        </span>
        {props.selected && (
          <Button
            className="clear-stay-button"
            variant="outline"
            onClick={props.onClearSelection}
          >
            <X size={14} /> Clear stay
          </Button>
        )}
      </div>
      {tileError && (
        <output className="tile-notice">
          Street tiles are unavailable. Transit routes and listings still work;
          check your connection.
        </output>
      )}
      <div className="map-buttons">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Fit all matching listings"
          onClick={fitAll}
        >
          <LocateFixed />
        </Button>
      </div>
      <div className="map-key">
        <span>
          <i className="key-dot" /> Matching stays
        </span>
        <span>
          <i className="key-dot selected" /> Selected stay
        </span>
        {props.radius && <span>Dashed circle: 800 m, straight-line</span>}
        <small>
          Click a group to zoom in. Click empty map space to clear a stay.
        </small>
      </div>
    </section>
  );
}
