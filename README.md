# Carless · Denver Airbnb & transit explorer

## Run locally

Requires Node 22.13 or newer and npm.

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://localhost:4173 for the landing page, or http://localhost:4173/explore/ for the app. No API key is needed. Internet access is needed for the app's street tiles; transit features and all landing-page charts are bundled locally.

To serve the production HTML, JavaScript, CSS, and image files with a plain static server:

```sh
npm run build
npm run serve
```

Then open http://localhost:8000. The static website is in `dist/client/`; it can be hosted by any static web server at the domain root.

## Landing page

The home page tells a scroll-driven story through neighborhood counts, a nightly-price histogram, and proximity to bus, light rail, and commuter rail. The chart stays in view as its chapter changes; chapter buttons also navigate the story. Budget presets update all three comparisons. Distance presets update transit coverage, and the introductory geographic plot can toggle rail routes. Reduced-motion preferences disable animated transitions.

The story uses the app's default trip population. The histogram keeps fixed $100 bins and a final $600+ bin, excludes missing prices, and keeps the full distribution visible behind a budget selection. Transit percentages use matching stays with coordinates as the denominator and exact haversine distances before display rounding. Stops can qualify for multiple modes. These are snapshot proximity comparisons, not walking times, accessibility measures, or service-frequency scores.

The bottom “View Carless” link opens `/explore/`. The app's logo returns to the landing page. Routes export to `index.html` and `explore/index.html`, so either route can be opened or refreshed directly on the local static server.

The build's `postbuild` step verifies both route exports and copies `explore.html` to `explore/index.html` for Python's directory routing. This avoids a trailing-slash redirect issue in the current Vinext prerenderer. Both route pages are explicitly static, so missing exports fail the build.

## Explore

- Filter by guests, nights, room type, price, neighborhood, rating, and listing title.
- Use the large Bus, Light rail, and Commuter rail controls above the map. Each mode toggles independently; its button color matches its routes. Click a route for details and enable stops/stations. Rail stations appear from zoom 10; bus stops from zoom 12. Icons grow as you zoom in. Crowded bus stops are grouped through zoom 15; zoom 16+ shows individual locations. The measured stop stays prominent.
- Click numbered listing clusters to zoom in; select an individual marker or list card to see its details. Click the selected house/card again, click empty map space, press Escape, or use “Clear stay” to deselect it.
- Turn on “In map view” to restrict the list and summary to the visible bounds.
- Selecting a stay automatically connects it to the nearest stop among enabled transit modes. The detail panel compares the nearest bus stop, light rail station, and commuter rail station. Click a distance row or another stop on the map to draw its connection and fit both endpoints. Distances use the haversine formula and are approximate straight-line distances; they are not walking directions or travel times.
- Show an 800 m straight-line circle around a selected stay. This is not a walking route or a verified transit-access score.
- Save stays using the hearts. The shortlist persists in this browser, with a session-only fallback when browser storage is unavailable.
- Compare all saved stays, including those hidden by the current filters. Nightly and trip estimates exclude fees and taxes.
- Export all current results as CSV, including results beyond the first 25 shown. Import the listing ID column as text in spreadsheets to preserve long IDs.

## Data and interpretation

### Walking times demo

Listing cards show two nearby attractions; selecting a stay shows up to three,
with links to walking directions in Google Maps. The six examples are Confluence
Park, Commons Park, Civic Center Park, Denver Art Museum, Denver Botanic Gardens,
and Denver Museum of Nature & Science. Names and visitor links are recorded in
`lib/attractions-model.ts`; coordinates are approximate demo reference points.

Times use straight-line distance × 1.3 at 4.8 km/h, rounded up to five-minute
steps (minimum five minutes). Only estimates within 45 minutes are included.
They are illustrative, not routed travel times, and do not verify entrances,
crossings, accessibility, or opening hours. Missing coordinates show an unavailable
state; no nearby demo spots does not mean an area has no attractions.
Calculations are local; directions open externally only when clicked.

Sources: [Denver parks](https://visitdenver.com/things-to-do/sports-recreation/city-parks/),
[Civic Center Park](https://civiccenterpark.org/visit/),
[Art Museum](https://www.denverartmuseum.org/en/plan-your-visit),
[Botanic Gardens](https://www.botanicgardens.org/york-street),
[Nature & Science Museum](https://www.dmns.org/visit/).

### Listings and transit

The 4,939 listings come from the classroom copy of the Inside Airbnb Denver release labeled June 30, 2026. The default trip (2 guests, 3 nights, entire place) reproduces the notebook's 2,033 matches. Listed price is available for 1,905 of these, with a median of $285.50. Listing IDs remain strings throughout the app.

Guest capacity and minimum-stay filters do not check date-specific availability. Prices are a dataset snapshot; coordinates published by Airbnb are approximate. Missing prices and ratings are labeled and are excluded when the corresponding limit is set. The “Any budget” slider endpoint applies no price cap.

The review evidence counts sampled reviews containing the classroom walking and transit keywords. Each review can count once in each topic. These counts are not sentiment analysis or proof of walkability. Full review text is not bundled in the website. Neighborhood context uses all listings matching the trip filters, before shortlist or visible-map restrictions; the main header summarizes the current result list.

- Listing and review data: [Inside Airbnb](https://insideairbnb.com/get-the-data/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Street data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
- Transit routes and stops: [RTD public GIS Current Runboard](https://www.arcgis.com/home/item.html?id=e14366d810644a3c95a4f3770799bd54), © Regional Transportation District. RTD permits personal, noncommercial planning use and prohibits commercial redistribution. The complete source terms and retrieval/modification timestamps are preserved in `data/transit.json`. This independent classroom tool is not endorsed by RTD. Network locations are generalized; verify current operations. No live arrival or schedule feed is used.
- Verify journeys and service with [RTD](https://app.rtd-denver.com/).

## Code guide

The app uses the Sites React/vinext scaffold and Leaflet. The production output is static HTML/JS; there is no application server or database.

- `components/explorer.tsx`: filters, listing cards, saved comparisons, and detail panel.
- `components/landing-page.tsx` and `components/landing-page.css`: scroll story, chart controls, and responsive presentation.
- `lib/story-model.ts`: neighborhood aggregation, price bins, transit coverage, and local geographic projection.
- `app/page.tsx`: computes landing-page transit distances from bundled data during rendering/export; only the compact story data reaches the client.
- `app/explore/page.tsx`: the existing interactive app.
- `components/explorer-map.tsx`: map tiles, visible markers, grid clustering, and the distance circle.
- `lib/explorer-model.ts`: explicit filtering, sorting, summaries, and CSV export.
- `app/globals.css`: layout, colors, typography, and responsive styles.
- `components/transit-controls.tsx`: the prominent mode buttons and stop visibility switch.
- `scripts/prepare-transit.py`: refreshes the cached RTD GIS data using paginated API queries; no API key required.
- `data/transit.json`: routes, stops, source timestamps, and RTD terms. The legacy `BusRoutes` layer includes rail records (`TYPE=LRT`), which are classified into light rail and A/B/G/N commuter rail. On-demand FlexRide records are omitted. Rail stations are restricted to lines in that same route snapshot.
- `data/listings.json`: compact listing data and sampled-review counts.
- `scripts/prepare-data.py`: regenerates JSON from `../data/denver/` without changing the classroom CSVs.

```sh
npm run data
npm run transit
npm test
npm run typecheck
npm run lint
```

Optional browser agent tools expose reading results, applying trip filters, toggling transit layers, and saving a batch of stays through feature-detected WebMCP. The visible app does not require it. No supported WebMCP browser context was available during development, so actual registry execution is unverified. Automated checks cover the dataset and core calculations; browser interaction and visual QA have not been performed in this environment.
