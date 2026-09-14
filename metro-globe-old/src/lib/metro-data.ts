import rawData from "../data/delhi-metro.json";
import { haversineKm } from "./geo";
import type {
  MetroEdge,
  MetroLine,
  MetroStation,
  RawMetroData,
} from "./metro-types";

export type { MetroStation, MetroLine, MetroEdge };

const raw = rawData as RawMetroData;

// --- Timing model -----------------------------------------------------
// DMRC doesn't publish per-segment timetables in the open dataset, so travel
// time is estimated from geography using standard metro operating
// parameters. This keeps numbers realistic without inventing precision the
// source data doesn't have.
const AVERAGE_SPEED_KMH = 32; // typical DMRC commercial (incl. accel/decel)
const DWELL_SECONDS_PER_STATION = 25; // stop time, applied at each hop's arrival
const INTERCHANGE_PENALTY_MIN = 4; // walking + wait when switching lines

export const stations: MetroStation[] = raw.stations.map((s) => ({
  ...s,
  isInterchange: s.lines.length > 1,
}));

export const stationById = new Map(stations.map((s) => [s.id, s]));

export const lines: MetroLine[] = raw.lines.map((l) => {
  let lengthKm = 0;
  for (let i = 0; i < l.stations.length - 1; i++) {
    const a = stationById.get(l.stations[i]);
    const b = stationById.get(l.stations[i + 1]);
    if (a && b) lengthKm += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return { ...l, lengthKm };
});

export const lineById = new Map(lines.map((l) => [l.id, l]));

export const interchanges = raw.interchanges;
export const metadata = raw.metadata;

function edgeTimeMin(distanceKm: number): number {
  const runMin = (distanceKm / AVERAGE_SPEED_KMH) * 60;
  const dwellMin = DWELL_SECONDS_PER_STATION / 60;
  return runMin + dwellMin;
}

/** Bidirectional edge list, one entry per direction, with estimated time. */
export const edges: MetroEdge[] = raw.connections.flatMap((c) => {
  const a = stationById.get(c.from);
  const b = stationById.get(c.to);
  if (!a || !b) return [];
  const distanceKm = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  const timeMin = edgeTimeMin(distanceKm);
  return [
    { from: c.from, to: c.to, line: c.line, distanceKm, timeMin },
    { from: c.to, to: c.from, line: c.line, distanceKm, timeMin },
  ];
});

const adjacency = new Map<string, MetroEdge[]>();
for (const e of edges) {
  if (!adjacency.has(e.from)) adjacency.set(e.from, []);
  adjacency.get(e.from)!.push(e);
}

export interface RouteStep {
  from: MetroStation;
  to: MetroStation;
  line: MetroLine;
  timeMin: number;
  distanceKm: number;
  isInterchangeHop: boolean;
}

export interface RouteResult {
  steps: RouteStep[];
  totalTimeMin: number;
  totalDistanceKm: number;
  interchangeCount: number;
  lineSequence: MetroLine[];
}

/**
 * Dijkstra shortest path by estimated time, penalizing line switches.
 * Returns null if no path exists.
 */
export function findRoute(fromId: string, toId: string): RouteResult | null {
  if (fromId === toId) return null;
  if (!stationById.has(fromId) || !stationById.has(toId)) return null;

  // State key: `${stationId}|${lineId}` so cost accounts for which line
  // you'd need to switch from.
  const dist = new Map<string, number>();
  const prev = new Map<string, { state: string; edge: MetroEdge }>();
  const visited = new Set<string>();

  const startState = `${fromId}|__start__`;
  dist.set(startState, 0);

  // simple binary-heap-less priority queue (network is small: 243 nodes)
  const queue: string[] = [startState];

  const stateStation = (state: string) => state.split("|")[0];
  const stateLine = (state: string) => state.split("|")[1];

  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentStation = stateStation(current);
    if (currentStation === toId) break;

    const currentEdges = adjacency.get(currentStation) ?? [];
    for (const e of currentEdges) {
      const nextState = `${e.to}|${e.line}`;
      const switchPenalty =
        stateLine(current) !== "__start__" && stateLine(current) !== e.line
          ? INTERCHANGE_PENALTY_MIN
          : 0;
      const newDist = (dist.get(current) ?? Infinity) + e.timeMin + switchPenalty;
      if (newDist < (dist.get(nextState) ?? Infinity)) {
        dist.set(nextState, newDist);
        prev.set(nextState, { state: current, edge: e });
        queue.push(nextState);
      }
    }
  }

  // find best final state among all lines arriving at toId
  let bestState: string | null = null;
  let bestDist = Infinity;
  for (const [state, d] of dist.entries()) {
    if (stateStation(state) === toId && d < bestDist) {
      bestDist = d;
      bestState = state;
    }
  }
  if (!bestState) return null;

  // reconstruct path
  const edgesUsed: MetroEdge[] = [];
  let cur: string | undefined = bestState;
  while (cur !== undefined && prev.has(cur)) {
    const entry: { state: string; edge: MetroEdge } = prev.get(cur)!;
    edgesUsed.unshift(entry.edge);
    cur = entry.state;
  }

  const steps: RouteStep[] = [];
  let totalDistanceKm = 0;
  let prevLine: string | null = null;
  let interchangeCount = 0;
  const lineSequence: MetroLine[] = [];

  for (const e of edgesUsed) {
    const from = stationById.get(e.from)!;
    const to = stationById.get(e.to)!;
    const line = lineById.get(e.line)!;
    const isInterchangeHop = prevLine !== null && prevLine !== e.line;
    if (isInterchangeHop) {
      interchangeCount++;
    }
    if (prevLine !== e.line) {
      lineSequence.push(line);
    }
    prevLine = e.line;
    totalDistanceKm += e.distanceKm;
    steps.push({
      from,
      to,
      line,
      timeMin: e.timeMin + (isInterchangeHop ? INTERCHANGE_PENALTY_MIN : 0),
      distanceKm: e.distanceKm,
      isInterchangeHop,
    });
  }

  const totalTimeMin = steps.reduce((sum, s) => sum + s.timeMin, 0);

  return { steps, totalTimeMin, totalDistanceKm, interchangeCount, lineSequence };
}

export const TIMING_MODEL_NOTE =
  `Times are estimates based on station geography (avg ${AVERAGE_SPEED_KMH} km/h commercial speed, ` +
  `${DWELL_SECONDS_PER_STATION}s dwell/stop, +${INTERCHANGE_PENALTY_MIN} min per interchange) — DMRC does not publish official segment timetables.`;
