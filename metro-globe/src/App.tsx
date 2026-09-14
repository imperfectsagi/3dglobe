import { useEffect, useRef, useState } from "react";
import { Globe, type GlobeHandle } from "./components/Globe";
import { MetroMap } from "./components/MetroMap";
import { Sheet, type SheetSnap } from "./components/Sheet";
import { SearchPanel } from "./components/SearchPanel";
import { LinesPanel } from "./components/LinesPanel";
import { RoutePanel } from "./components/RoutePanel";
import { StationDetail } from "./components/StationDetail";
import {
  CompassIcon,
  CubeIcon,
  LinesIcon,
  MapIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  RouteIcon,
  SearchIcon,
  SunIcon,
} from "./components/icons";
import { lineById, type MetroStation, type RouteResult } from "./lib/metro-data";
import { useTheme } from "./lib/use-theme";

type Tab = "search" | "route" | "lines";
type View = "2d" | "3d";

export default function App() {
  const globeRef = useRef<GlobeHandle>(null);
  const [loading, setLoading] = useState(true);
  const [theme, toggleTheme] = useTheme();

  const [view, setView] = useState<View>("2d");
  const [activeTab, setActiveTab] = useState<Tab>("route");
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");

  const [hoveredStation, setHoveredStation] = useState<MetroStation | null>(null);
  const [selectedStation, setSelectedStation] = useState<MetroStation | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  const [activeLine, setActiveLine] = useState<string | null>(null);

  const [fromStation, setFromStation] = useState<MetroStation | null>(null);
  const [toStation, setToStation] = useState<MetroStation | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);

  const routeStationIds = route ? [route.steps[0].from.id, ...route.steps.map((s) => s.to.id)] : null;
  const routeLineIds = route ? Array.from(new Set(route.steps.map((s) => s.line.id))) : null;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => setPointerPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  // Re-apply route / line-filter state to the 3D globe whenever it (re)mounts —
  // switching into 3D view mounts a fresh GlobeScene, so its imperative state
  // needs to be synced from the React state that's shared with the 2D map.
  useEffect(() => {
    if (view !== "3d") return;
    if (routeStationIds) {
      globeRef.current?.showRoute(routeStationIds);
    } else if (activeLine) {
      globeRef.current?.setLineFilter(activeLine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleStationClick = (station: MetroStation) => {
    setSelectedStation(station);
    if (view === "3d") globeRef.current?.focusOnStation(station);
    setActiveTab("search");
    if (window.innerWidth < 860) setSheetSnap("half");
  };

  const handleSelectFromSearch = (station: MetroStation) => {
    setSelectedStation(station);
    if (view === "3d") globeRef.current?.focusOnStation(station);
    if (window.innerWidth < 860) setSheetSnap("half");
  };

  const handleToggleLine = (lineId: string) => {
    const next = activeLine === lineId ? null : lineId;
    setActiveLine(next);
    if (view === "3d") globeRef.current?.setLineFilter(next);
  };

  const handleRouteComputed = (result: RouteResult | null) => {
    setRoute(result);
    if (view === "3d") {
      if (result) {
        globeRef.current?.showRoute([result.steps[0].from.id, ...result.steps.map((s) => s.to.id)]);
      } else {
        globeRef.current?.clearRoute();
      }
    }
  };

  const handleReset = () => {
    setSelectedStation(null);
    setActiveLine(null);
    if (view === "3d") globeRef.current?.resetView();
  };

  const handleSetFrom = (s: MetroStation | null) => {
    setFromStation(s);
    setSelectedStation(null);
  };

  const handleSetTo = (s: MetroStation | null) => {
    setToStation(s);
    setSelectedStation(null);
  };

  const tabs = [
    { id: "route", label: "Plan route", icon: <RouteIcon /> },
    { id: "search", label: "Stations", icon: <SearchIcon /> },
    { id: "lines", label: "Lines", icon: <LinesIcon /> },
  ];

  return (
    <div className="app">
      {view === "2d" ? (
        <MetroMap
          hoveredStation={hoveredStation}
          selectedStation={selectedStation}
          onStationHover={setHoveredStation}
          onStationClick={handleStationClick}
          routeStationIds={routeStationIds}
          routeLineIds={routeLineIds}
          lineFilter={activeLine}
        />
      ) : (
        <Globe ref={globeRef} onStationHover={setHoveredStation} onStationClick={handleStationClick} />
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-ring" />
          <div className="loading-text">Loading Delhi Metro network…</div>
        </div>
      )}

      <div className="topbar">
        <div className="brand">
          <span className="brand-title">Delhi Metro</span>
          <span className="brand-sub">{view === "2d" ? "Network map" : "3D network map"}</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn view-toggle-btn"
            onClick={() => setView((v) => (v === "2d" ? "3d" : "2d"))}
            aria-label={view === "2d" ? "Switch to 3D globe view" : "Switch to 2D map view"}
          >
            {view === "2d" ? <CubeIcon /> : <MapIcon />}
            <span className="view-toggle-label">{view === "2d" ? "3D View" : "2D Map"}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={theme === "light"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button type="button" className="icon-btn" onClick={handleReset} aria-label="Reset view">
            <CompassIcon />
          </button>
        </div>
      </div>

      {hoveredStation && pointerPos && window.innerWidth >= 860 && (
        <div className="hover-card" style={{ left: pointerPos.x + 16, top: pointerPos.y - 10 }}>
          <div className="hover-card-name">{hoveredStation.name}</div>
          <div className="hover-card-lines">
            {hoveredStation.lines.map((lid: string) => (
              <span key={lid} className="line-chip" style={{ background: lineById.get(lid)?.color }} />
            ))}
          </div>
        </div>
      )}

      {view === "3d" && (
        <div className="zoom-controls">
          <button type="button" className="icon-btn" onClick={() => globeRef.current?.zoomIn()} aria-label="Zoom in">
            <PlusIcon />
          </button>
          <button type="button" className="icon-btn" onClick={() => globeRef.current?.zoomOut()} aria-label="Zoom out">
            <MinusIcon />
          </button>
        </div>
      )}

      <Sheet tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as Tab)} snap={sheetSnap} onSnapChange={setSheetSnap}>
        {selectedStation && activeTab === "search" ? (
          <StationDetail
            station={selectedStation}
            onClose={() => setSelectedStation(null)}
            onPlanFrom={() => {
              handleSetFrom(selectedStation);
              setActiveTab("route");
              setSheetSnap("half");
            }}
            onPlanTo={() => {
              handleSetTo(selectedStation);
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
            onSetFrom={handleSetFrom}
            onSetTo={handleSetTo}
            onRouteComputed={handleRouteComputed}
          />
        ) : (
          <LinesPanel activeLine={activeLine} onToggleLine={handleToggleLine} />
        )}
      </Sheet>
    </div>
  );
}
