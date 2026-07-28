# datagouv-3d-viz

Interactive 3D visualization of French traffic accident data (2005–2024), built with Three.js. Explore accident hotspots, severity levels, weather conditions, and time-of-day patterns across France.

**Data source**: [data.gouv.fr](https://www.data.gouv.fr) — ONISR / BAAC (French National Road Safety Authority)

## Features

- **Real accident data** fetched from data.gouv.fr BAAC datasets (2020–2024)
- **GPU-accelerated particles** rendered via custom GLSL shaders (no geometry rebuilds on filter changes)
- **Temporal navigation** — filter by year (2020–2024) and time of day (12-hour AM/PM format)
- **Weather filters** — isolate accidents by Clear Sky, Rain, Fog, or Snow
- **Severity color coding** — fatal (red), hospitalized (orange), minor (green)
- **French autoroute roadmap** overlay with city labels
- **Animated pulse waves** at major city hotspots (Paris, Marseille, Lyon, etc.)
- **Dynamic atmosphere** — scene lighting shifts with selected time of day
- **Interactive tooltips** — hover over particles for accident details
- **Live statistics panel** — totals update in real time as filters change

## Tech Stack

- **Three.js** — WebGL 3D rendering
- **Vite** — development server & build tooling
- **Vanilla JavaScript** (ES modules) — no framework dependencies

## Getting Started

### Prerequisites

- Node.js (v14+) and npm

### Install

```bash
npm install
```

### Fetch Data

```bash
npm run fetch-data   # Download BAAC accident CSVs → public/data/accidents.bin.gz
npm run fetch-geo    # Fetch France geographic boundaries
```

`fetch-data` joins the yearly `caracteristiques` and `usagers` CSVs, then packs the
result into a columnar binary file (see `src/data/accident-codec.js`). The committed
`accidents.bin.gz` is ~0.7 MB, versus ~95 MB of source CSV or ~27 MB as JSON — this is
what the browser downloads. Re-run it to refresh the data when a new year is published.

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000` with hot module reloading. The app loads the packed
dataset from `/data/accidents.bin.gz`; if that is missing it falls back to a legacy
`/data/accidents.json`, and failing that it downloads the CSVs from data.gouv.fr in the
browser (slow — several tens of megabytes).

### Production Build

```bash
npm run build
```

Output goes to `/dist`.

### Preview

```bash
npm run preview
```

## Project Structure

```
src/
├── core/           # Scene setup, camera, renderer, orbit controls
├── data/           # Data fetching (data.gouv.fr API) and CSV processing
├── viz/            # Particle system, France outline, roads, pulse waves, atmosphere
├── ui/             # Year/hour scrubbers, stats panel, tooltips, weather filters
├── utils/          # Geographic coordinate conversion
└── main.js         # Entry point and application state
scripts/
├── fetch-accidents.js  # Download BAAC data → public/data/accidents.bin.gz
└── fetch-france-geo.js # Fetch France geographic boundaries
```

## How It Works

1. **Data loading** — real BAAC accident records (2020–2024) are read from a pre-packed
   binary file committed to the repo, decompressed in the browser via `DecompressionStream`
   and decoded straight into typed arrays; downloading and parsing the source CSVs in the
   browser remains as a fallback
2. **GPU rendering** — all particles live in a single `BufferGeometry` with per-particle attributes (position, severity, year, hour, weather); filtering happens entirely on the GPU via shader uniforms
3. **Road overlay** — French autoroute network rendered as tube geometry with labeled city markers
4. **Atmosphere** — scene background, fog, and light colors interpolate based on the selected hour to simulate day/dusk/night cycles

## Controls

| Action | Input |
|--------|-------|
| Rotate | Click + drag |
| Zoom | Scroll wheel |
| Reset view | Reset button (top-right) |
| Auto-rotate | Toggle button (top-right) |
| Filter by year | Bottom slider (2020–2024) |
| Filter by hour | Bottom slider (ALL / 12AM–11PM) |
| Filter by weather | Left panel buttons (Clear Sky, Rain, Fog, Snow) |
| Toggle pulse waves | Button (top-right) |

## Browser Support

Requires a modern browser with WebGL support (Chrome, Firefox, Safari, Edge). Touch controls are supported on mobile.

## License

MIT
