import { useEffect, useRef, useState } from "react";
import { Globe, type GlobeHandle } from "./components/Globe";
import { Sheet, type SheetSnap } from "./components/Sheet";
import { SearchPanel } from "./components/SearchPanel";
import { LinesPanel } from "./components/LinesPanel";
import { RoutePanel } from "./components/RoutePanel";
import { StationDetail } from "./components/StationDetail";
import { CompassIcon, LinesIcon, MinusIcon, PlusIcon, RouteIcon, SearchIcon } from "./components/icons";
import { lineById, type MetroStation } from "./lib/metro-data";

type Tab = "search" | "route" | "lines";

export default function App() {
  const globeRef = useRef<GlobeHandle>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");

  const [hoveredStation, setHoveredStation] = useState<MetroStation | null>(null);
  const [selectedStation, setSelectedStation] = useState<MetroStation | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  const [activeLine, setActiveLine] = useState<string | null>(null);

  const [fromStation, setFromStation] = useState<MetroStation | null>(null);
  const [toStation, setToStation] = useState<MetroStation | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => setPointerPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const handleStationClick = (station: MetroStation) => {
    setSelectedStation(station);
    globeRef.current?.focusOnStation(station);
    if (window.innerWidth < 860) setSheetSnap("half");
  };

  const handleSelectFromSearch = (station: MetroStation) => {
    setSelectedStation(station);
    globeRef.current?.focusOnStation(station);
    if (window.innerWidth < 860) setSheetSnap("half");
  };

  const handleToggleLine = (lineId: string) => {
    const next = activeLine === lineId ? null : lineId;
    setActiveLine(next);
    globeRef.current?.setLineFilter(next);
  };

  const handleRouteComputed = (stationIds: string[] | null) => {
    if (stationIds) {
      globeRef.current?.showRoute(stationIds);
    } else {
      globeRef.current?.clearRoute();
    }
  };

  const handleReset = () => {
    setSelectedStation(null);
    setActiveLine(null);
    globeRef.current?.resetView();
  };

  const tabs = [
    { id: "search", label: "Stations", icon: <SearchIcon /> },
    { id: "route", label: "Plan route", icon: <RouteIcon /> },
    { id: "lines", label: "Lines", icon: <LinesIcon /> },
  ];

  return (
    <div className="app">
      <Globe ref={globeRef} onStationHover={setHoveredStation} onStationClick={handleStationClick} />

      {loading && (
        <div className="loading-overlay">
          <div className="loading-ring" />
          <div className="loading-text">Loading Delhi Metro network…</div>
        </div>
      )}

      <div className="topbar">
        <div className="brand">
          <span className="brand-title">Delhi Metro</span>
          <span className="brand-sub">3D network map</span>
        </div>
        <button className="icon-btn" onClick={handleReset} aria-label="Reset view">
          <CompassIcon />
        </button>
      </div>

      {hoveredStation && pointerPos && window.innerWidth >= 860 && (
        <div
          className="hover-card"
          style={{ left: pointerPos.x + 16, top: pointerPos.y - 10 }}
        >
          <div className="hover-card-name">{hoveredStation.name}</div>
          <div className="hover-card-lines">
            {hoveredStation.lines.map((lid: string) => (
              <span key={lid} className="line-chip" style={{ background: lineById.get(lid)?.color }} />
            ))}
          </div>
        </div>
      )}

      <div className="zoom-controls">
        <button className="icon-btn" onClick={() => globeRef.current?.zoomIn()} aria-label="Zoom in">
          <PlusIcon />
        </button>
        <button className="icon-btn" onClick={() => globeRef.current?.zoomOut()} aria-label="Zoom out">
          <MinusIcon />
        </button>
      </div>

      <Sheet tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as Tab)} snap={sheetSnap} onSnapChange={setSheetSnap}>
        {selectedStation && activeTab === "search" ? (
          <StationDetail
            station={selectedStation}
            onClose={() => setSelectedStation(null)}
            onPlanFrom={() => {
              setFromStation(selectedStation);
              setSelectedStation(null);
              setActiveTab("route");
              setSheetSnap("half");
            }}
            onPlanTo={() => {
              setToStation(selectedStation);
              setSelectedStation(null);
              setActiveTab("route");
              setSheetSnap("half");
            }}
          />
        ) : activeTab === "search" ? (
          <SearchPanel onSelectStation={handleSelectFromSearch} />
        ) : activeTab === "route" ? (
          <RoutePanel
            fromStation={fromStation}
            toStation={toStation}
            onSetFrom={setFromStation}
            onSetTo={setToStation}
            onRouteComputed={handleRouteComputed}
          />
        ) : (
          <LinesPanel activeLine={activeLine} onToggleLine={handleToggleLine} />
        )}
      </Sheet>
    </div>
  );
}
