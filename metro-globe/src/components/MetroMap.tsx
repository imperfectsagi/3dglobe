import { useMemo, useRef, useState } from "react";
import { computeBounds, makeProjector } from "../lib/map-projection";
import { lines, stations, type MetroStation } from "../lib/metro-data";
import { CompassIcon, PlusIcon, MinusIcon } from "./icons";

const VIEW_W = 1000;
const VIEW_H = 760;
const PADDING = 46;

interface MetroMapProps {
  hoveredStation: MetroStation | null;
  selectedStation: MetroStation | null;
  onStationHover: (station: MetroStation | null) => void;
  onStationClick: (station: MetroStation) => void;
  /** Ordered station ids for the currently displayed route, or null. */
  routeStationIds: string[] | null;
  /** Set of line ids used anywhere along the route (for dimming unrelated lines). */
  routeLineIds: string[] | null;
  /** Single line filter from the Lines tab, or null. Mutually exclusive with an active route in practice. */
  lineFilter: string | null;
}

export function MetroMap({
  hoveredStation,
  selectedStation,
  onStationHover,
  onStationClick,
  routeStationIds,
  routeLineIds,
  lineFilter,
}: MetroMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; dragging: boolean; moved: number } | null>(null);
  const lastDragDistanceRef = useRef(0);

  const projector = useMemo(() => {
    const bounds = computeBounds(stations);
    return makeProjector(bounds, VIEW_W, VIEW_H, PADDING);
  }, []);

  const projected = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const s of stations) {
      map.set(s.id, projector(s.latitude, s.longitude));
    }
    return map;
  }, [projector]);

  const routeSet = useMemo(() => (routeStationIds ? new Set(routeStationIds) : null), [routeStationIds]);
  const routeLineSet = useMemo(() => (routeLineIds ? new Set(routeLineIds) : null), [routeLineIds]);
  const isDimmed = Boolean(routeSet || lineFilter);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(4, Math.max(1, zoom * (1 - e.deltaY * 0.0015)));
    setZoom(next);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    lastDragDistanceRef.current = 0;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, dragging: true, moved: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current?.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.moved = Math.hypot(dx, dy);
    lastDragDistanceRef.current = dragRef.current.moved;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const wasDragged = () => lastDragDistanceRef.current > 6;

  const zoomIn = () => setZoom((z) => Math.min(4, z * 1.35));
  const zoomOut = () => setZoom((z) => Math.max(1, z / 1.35));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const stationRadius = (s: MetroStation) => (s.isInterchange ? 6.5 : 4);

  return (
    <div className="metro-map-wrap">
      <svg
        ref={svgRef}
        className="metro-map-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="2D schematic map of the Delhi Metro network"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2}) scale(${zoom}) translate(${-VIEW_W / 2 + pan.x / zoom} ${-VIEW_H / 2 + pan.y / zoom})`}>
          {/* Line paths */}
          {lines.map((line) => {
            const pts = line.stations
              .map((id) => projected.get(id))
              .filter((p): p is { x: number; y: number } => Boolean(p));
            if (pts.length < 2) return null;
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
            const dimmed = isDimmed && !(routeLineSet?.has(line.id) || lineFilter === line.id);
            return (
              <path
                key={line.id}
                d={d}
                fill="none"
                stroke={line.color}
                strokeWidth={dimmed ? 3 : 5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dimmed ? 0.16 : 1}
                className="metro-line-path"
              />
            );
          })}

          {/* Route overlay: drawn on top, thicker, in travel order */}
          {routeStationIds && routeStationIds.length > 1 && (
            <path
              d={routeStationIds
                .map((id) => projected.get(id))
                .filter((p): p is { x: number; y: number } => Boolean(p))
                .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                .join(" ")}
              fill="none"
              stroke="currentColor"
              className="metro-route-outline"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          )}

          {/* Direction arrows along the route */}
          {routeStationIds &&
            routeStationIds.slice(0, -1).map((id, i) => {
              const a = projected.get(id);
              const b = projected.get(routeStationIds[i + 1]);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
              return (
                <polygon
                  key={`arrow-${id}-${i}`}
                  points="-5,-4 5,0 -5,4"
                  transform={`translate(${mx} ${my}) rotate(${angle})`}
                  className="metro-route-arrow"
                />
              );
            })}

          {/* Station markers */}
          {stations.map((s) => {
            const p = projected.get(s.id);
            if (!p) return null;
            const onRoute = routeSet?.has(s.id);
            const isFrom = routeStationIds && routeStationIds[0] === s.id;
            const isTo = routeStationIds && routeStationIds[routeStationIds.length - 1] === s.id;
            const dimmed = isDimmed && !onRoute && !(lineFilter && s.lines.includes(lineFilter));
            const isHovered = hoveredStation?.id === s.id;
            const isSelected = selectedStation?.id === s.id;
            const r = stationRadius(s) * (isFrom || isTo ? 1.6 : isHovered || isSelected ? 1.4 : 1);

            return (
              <g
                key={s.id}
                className={`metro-station${dimmed ? " dimmed" : ""}${onRoute ? " on-route" : ""}`}
                transform={`translate(${p.x} ${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${s.name}${s.isInterchange ? ", interchange station" : ""}${isFrom ? ", route start" : ""}${isTo ? ", route end" : ""}`}
                onMouseEnter={() => onStationHover(s)}
                onMouseLeave={() => onStationHover(null)}
                onClick={() => {
                  if (wasDragged()) return;
                  onStationClick(s);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStationClick(s);
                  }
                }}
              >
                {isFrom && <circle r={r + 5} className="metro-endpoint-ring from" />}
                {isTo && <circle r={r + 5} className="metro-endpoint-ring to" />}
                <circle
                  r={r}
                  className={`metro-station-dot${s.isInterchange ? " interchange" : ""}`}
                  fill={s.isInterchange ? undefined : s.lines[0] ? lineColor(s.lines[0]) : undefined}
                />
                {(isHovered || isSelected || s.isInterchange) && (
                  <text className="metro-station-label" x={r + 6} y={4}>
                    {s.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="map-zoom-controls">
        <button type="button" className="icon-btn" onClick={zoomIn} aria-label="Zoom in on map">
          <PlusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={zoomOut} aria-label="Zoom out on map">
          <MinusIcon />
        </button>
        <button type="button" className="icon-btn map-recenter-btn" onClick={resetView} aria-label="Reset map view">
          <CompassIcon />
        </button>
      </div>
    </div>
  );
}

function lineColor(lineId: string): string | undefined {
  return lines.find((l) => l.id === lineId)?.color;
}
