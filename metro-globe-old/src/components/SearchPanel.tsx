import { useMemo, useState } from "react";
import { lineById, stations, type MetroStation } from "../lib/metro-data";
import { SearchIcon } from "./icons";

interface SearchPanelProps {
  onSelectStation: (station: MetroStation) => void;
}

export function SearchPanel({ onSelectStation }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return stations
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [query]);

  const interchangeStations = useMemo(
    () => stations.filter((s) => s.isInterchange).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div>
      <div className="search-box">
        <span className="search-icon">
          <SearchIcon />
        </span>
        <input
          className="search-input"
          type="text"
          inputMode="search"
          placeholder="Search any of 243 stations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {results ? (
        results.length > 0 ? (
          <div>
            {results.map((s) => (
              <StationRow key={s.id} station={s} onClick={() => onSelectStation(s)} />
            ))}
          </div>
        ) : (
          <div className="empty-hint">No stations match "{query}"</div>
        )
      ) : (
        <>
          <div className="section-label">Interchange stations</div>
          {interchangeStations.map((s) => (
            <StationRow key={s.id} station={s} onClick={() => onSelectStation(s)} />
          ))}
        </>
      )}
    </div>
  );
}

export function StationRow({ station, onClick }: { station: MetroStation; onClick: () => void }) {
  return (
    <button className="station-row" onClick={onClick}>
      <span className="station-row-dots">
        {station.lines.slice(0, 3).map((lid: string) => (
          <span key={lid} className="dot" style={{ background: lineById.get(lid)?.color ?? "#888" }} />
        ))}
      </span>
      <span className="station-row-text">
        <div className="station-row-name">{station.name}</div>
        <div className="station-row-meta">
          {station.lines.map((lid: string) => lineById.get(lid)?.name.replace(/\s*\(Line.*?\)/, "")).join(" · ")}
        </div>
      </span>
      {station.isInterchange && <span className="interchange-badge">Interchange</span>}
    </button>
  );
}
