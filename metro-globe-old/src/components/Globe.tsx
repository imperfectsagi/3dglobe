import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { GlobeScene } from "../lib/globe-scene";
import type { MetroStation } from "../lib/metro-data";

export interface GlobeHandle {
  focusOnStation: (station: MetroStation, distance?: number) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setLineFilter: (lineId: string | null) => void;
  showRoute: (stationIds: string[]) => void;
  clearRoute: () => void;
}

interface GlobeProps {
  onStationHover: (station: MetroStation | null) => void;
  onStationClick: (station: MetroStation) => void;
}

export const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  { onStationHover, onStationClick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new GlobeScene({
      container: containerRef.current,
      onStationHover,
      onStationClick,
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    focusOnStation: (station, distance) => sceneRef.current?.focusOnStation(station, distance),
    resetView: () => sceneRef.current?.resetView(),
    zoomIn: () => sceneRef.current?.zoomIn(),
    zoomOut: () => sceneRef.current?.zoomOut(),
    setLineFilter: (lineId) => sceneRef.current?.setLineFilter(lineId),
    showRoute: (stationIds) => sceneRef.current?.showRoute(stationIds),
    clearRoute: () => sceneRef.current?.clearRoute(),
  }));

  return <div ref={containerRef} className="globe-canvas" aria-label="Interactive 3D map of the Delhi Metro network" />;
});
