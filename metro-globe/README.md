# Delhi Metro — 3D Network Map

An interactive 3D globe of the entire Delhi Metro network: 243 stations across
13 lines, built with React + Three.js. Search stations, plan a route between
any two stations with an estimated travel time, and explore the network by
line. Mobile-first, and runs entirely in the browser — no backend, no API
keys, no database.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Build

```bash
npm run build
```

Output goes to `dist/`. `npm run preview` serves that build locally to
double-check before deploying.

## Deploy to Vercel (free plan)

**Option A — Vercel dashboard**
1. Push this folder to a GitHub repo.
2. In Vercel, "Add New… → Project", import the repo.
3. Framework preset: Vite. Build command `npm run build`, output directory
   `dist` (Vercel usually detects this automatically; `vercel.json` in this
   project pins it either way).
4. Deploy — no environment variables needed.

**Option B — Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel        # first deploy, follow prompts
vercel --prod # promote to production
```

The app is a static SPA (single JS/CSS bundle + two texture images), so it
fits comfortably in Vercel's free hobby tier with no serverless functions.

## What's inside

- `src/data/delhi-metro.json` — station list, line colors, connections, and
  interchange points for the Delhi Metro network (DMRC Phase IV, verified
  March 2026).
- `src/lib/geo.ts` — lat/lng → 3D sphere coordinate conversion.
- `src/lib/metro-data.ts` — typed data loader, travel-time estimation per
  segment, and a Dijkstra shortest-path router (time-weighted, penalizes line
  changes).
- `src/lib/globe-scene.ts` — the Three.js scene: Earth sphere, station
  markers, line tubes, camera controls (drag/pinch/wheel to rotate and zoom),
  hover/click raycasting, route highlighting.
- `src/components/` — the UI shell: a draggable bottom sheet (side panel on
  desktop) with Search, Plan route, and Lines tabs.

## About the route times

DMRC doesn't publish an official per-segment timetable in open data, so
travel time is estimated from station geography: ~32 km/h average commercial
speed, ~25s dwell per stop, +4 min per line interchange. This is noted in the
app itself wherever a time is shown. Treat times as a reasonable planning
estimate, not an official DMRC figure.
