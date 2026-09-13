import { useEffect, useMemo, useState } from "react";
import { findRoute, stations, TIMING_MODEL_NOTE, type MetroStation } from "../lib/metro-data";
import { formatKm, formatMinutes } from "../lib/format";
import { ClockIcon, InfoIcon, InterchangeIcon, SwapIcon } from "./icons";

interface RoutePanelProps {
  fromStation: MetroStation | null;
  toStation: MetroStation | null;
  onSetFrom: (s: MetroStation | null) => void;
  onSetTo: (s: MetroStation | null) => void;
  onRouteComputed: (stationIds: string[] | null) => void;
}

type ActiveField = "from" | "to" | null;

export function RoutePanel({ fromStation, toStation, onSetFrom, onSetTo, onRouteComputed }: RoutePanelProps) {
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const route = useMemo(() => {
    if (!fromStation || !toStation) return null;
    return findRoute(fromStation.id, toStation.id);
  }, [fromStation, toStation]);

  useEffect(() => {
    if (route) {
      onRouteComputed([route.steps[0].from.id, ...route.steps.map((s) => s.to.id)]);
    } else {
      onRouteComputed(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const suggestions = useMemo(() => {
    const q = (activeField === "from" ? fromQuery : toQuery).trim().toLowerCase();
    if (!q) return [];
    return stations
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [activeField, fromQuery, toQuery]);

  const pick = (s: MetroStation) => {
    if (activeField === "from") {
      onSetFrom(s);
      setFromQuery("");
    } else if (activeField === "to") {
      onSetTo(s);
      setToQuery("");
    }
    setActiveField(null);
  };

  const swap = () => {
    const f = fromStation;
    onSetFrom(toStation);
    onSetTo(f);
  };

  return (
    <div>
      <div className="route-inputs">
        <div className="route-field">
          <span className="route-dot from" />
          <input
            placeholder="From station"
            value={activeField === "from" ? fromQuery : (fromStation?.name ?? "")}
            onFocus={() => {
              setActiveField("from");
              setFromQuery("");
            }}
            onChange={(e) => setFromQuery(e.target.value)}
          />
        </div>

        {activeField === "from" && suggestions.length > 0 && (
          <div className="route-suggestions">
            {suggestions.map((s) => (
              <button key={s.id} className="station-row" onClick={() => pick(s)}>
                <span className="station-row-text">
                  <div className="station-row-name">{s.name}</div>
                </span>
              </button>
            ))}
          </div>
        )}

        <button className="swap-btn" onClick={swap} aria-label="Swap from and to" style={{ alignSelf: "center" }}>
          <SwapIcon />
        </button>

        <div className="route-field">
          <span className="route-dot to" />
          <input
            placeholder="To station"
            value={activeField === "to" ? toQuery : (toStation?.name ?? "")}
            onFocus={() => {
              setActiveField("to");
              setToQuery("");
            }}
            onChange={(e) => setToQuery(e.target.value)}
          />
        </div>

        {activeField === "to" && suggestions.length > 0 && (
          <div className="route-suggestions">
            {suggestions.map((s) => (
              <button key={s.id} className="station-row" onClick={() => pick(s)}>
                <span className="station-row-text">
                  <div className="station-row-name">{s.name}</div>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {fromStation && toStation && fromStation.id === toStation.id && (
        <div className="empty-hint">Pick two different stations to plan a route.</div>
      )}

      {route && (
        <>
          <div className="route-summary">
            <div>
              <div className="route-summary-time tabular">
                {formatMinutes(route.totalTimeMin)}
                <small>min</small>
              </div>
            </div>
            <div className="route-summary-meta">
              {formatKm(route.totalDistanceKm)} km · {route.steps.length} stops ·{" "}
              {route.interchangeCount === 0
                ? "no interchange"
                : `${route.interchangeCount} interchange${route.interchangeCount > 1 ? "s" : ""}`}
            </div>
          </div>

          <div className="route-line-sequence">
            {route.lineSequence.map((line, i) => (
              <span key={`${line.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span className="route-arrow">→</span>}
                <span className="route-line-pill">
                  <span className="dot" style={{ background: line.color }} />
                  {line.name.replace(/\s*\(Line.*?\)/, "")}
                </span>
              </span>
            ))}
          </div>

          <div className="route-steps">
            {route.steps.map((step, i) => (
              <div
                key={i}
                className="route-step"
                style={{ ["--line-color" as string]: step.line.color }}
              >
                <div className="route-step-station">
                  {i === 0 ? step.from.name : null}
                  {i === 0 && <br />}
                  {step.to.name}
                </div>
                <div className="route-step-meta tabular">
                  <ClockIcon /> {formatMinutes(step.timeMin)} min · {step.line.name.replace(/\s*\(Line.*?\)/, "")}
                </div>
                {step.isInterchangeHop && (
                  <div className="route-step-interchange">
                    <InterchangeIcon /> Change at {step.from.name}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="timing-note">
            <InfoIcon /> {TIMING_MODEL_NOTE}
          </div>
        </>
      )}

      {fromStation && toStation && fromStation.id !== toStation.id && !route && (
        <div className="empty-hint">No route found between these stations.</div>
      )}
    </div>
  );
}
