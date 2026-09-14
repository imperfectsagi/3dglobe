import { lineById, type MetroStation } from "../lib/metro-data";
import { RouteIcon, XIcon } from "./icons";

interface StationDetailProps {
  station: MetroStation;
  onClose: () => void;
  onPlanFrom: () => void;
  onPlanTo: () => void;
}

export function StationDetail({ station, onClose, onPlanFrom, onPlanTo }: StationDetailProps) {
  return (
    <div className="station-detail">
      <div className="station-detail-header">
        <div>
          <div className="station-detail-name">{station.name}</div>
          <div className="station-detail-coords tabular">
            {station.latitude.toFixed(4)}°N, {station.longitude.toFixed(4)}°E
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <XIcon />
        </button>
      </div>

      <div className="station-detail-lines">
        {station.lines.map((lid: string) => {
          const line = lineById.get(lid);
          if (!line) return null;
          return (
            <span key={lid} className="station-line-pill">
              <span className="dot" style={{ background: line.color }} />
              {line.name}
            </span>
          );
        })}
      </div>

      {station.isInterchange && (
        <div className="empty-hint" style={{ padding: "0 0 4px", textAlign: "left" }}>
          Interchange station — connects {station.lines.length} lines.
        </div>
      )}

      <div className="station-detail-actions">
        <button className="primary-btn" onClick={onPlanTo}>
          <RouteIcon /> Route here
        </button>
        <button className="secondary-btn" onClick={onPlanFrom}>
          Start here
        </button>
      </div>
    </div>
  );
}
