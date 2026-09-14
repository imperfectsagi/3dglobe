import { lines } from "../lib/metro-data";
import { formatKm } from "../lib/format";

interface LinesPanelProps {
  activeLine: string | null;
  onToggleLine: (lineId: string) => void;
}

export function LinesPanel({ activeLine, onToggleLine }: LinesPanelProps) {
  return (
    <div>
      <div className="section-label">{lines.length} lines · tap to highlight on globe</div>
      {lines.map((line) => (
        <button
          key={line.id}
          className={`line-item${activeLine === line.id ? " active" : ""}`}
          onClick={() => onToggleLine(line.id)}
        >
          <span className="line-swatch" style={{ background: line.color }} />
          <span className="line-item-text">
            <div className="line-item-name">{line.name}</div>
            <div className="line-item-meta">
              {line.stations.length} stations · ~{formatKm(line.lengthKm)} km
            </div>
          </span>
        </button>
      ))}
    </div>
  );
}
