import { useEffect, useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "full";

interface SheetProps {
  tabs: { id: string; label: string; icon: ReactNode }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: ReactNode;
}

const SNAP_HEIGHT_VH: Record<SheetSnap, number> = {
  peek: 30,
  half: 55,
  full: 82,
};

export function Sheet({ tabs, activeTab, onTabChange, snap, onSnapChange, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startHeight: number; dragging: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 860);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 860);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // publish visible sheet height so floating controls can avoid overlap
    const vh = window.innerHeight;
    const px = isDesktop ? 0 : (SNAP_HEIGHT_VH[snap] / 100) * vh;
    document.documentElement.style.setProperty("--sheet-visible-offset", `${px}px`);
  }, [snap, isDesktop]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDesktop) return;
    dragState.current = { startY: e.clientY, startHeight: SNAP_HEIGHT_VH[snap], dragging: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current?.dragging) return;
    // dragging up (finger moves up, clientY decreases) should increase sheet height
    const dy = e.clientY - dragState.current.startY;
    setDragOffset(dy);
  };

  const handlePointerUp = () => {
    if (!dragState.current?.dragging) return;
    const vh = window.innerHeight;
    const deltaVh = (dragOffset / vh) * 100;
    const currentVh = dragState.current.startHeight - deltaVh;

    const snaps: SheetSnap[] = ["peek", "half", "full"];
    let closest: SheetSnap = "peek";
    let minDiff = Infinity;
    for (const s of snaps) {
      const diff = Math.abs(SNAP_HEIGHT_VH[s] - currentVh);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s;
      }
    }
    onSnapChange(closest);
    setDragOffset(0);
    dragState.current = null;
  };

  // live height while dragging: base snap height minus finger movement (up = taller)
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isDragging = Boolean(dragState.current?.dragging);
  const liveHeightVh = isDragging
    ? Math.min(95, Math.max(12, SNAP_HEIGHT_VH[snap] - (dragOffset / vh) * 100))
    : SNAP_HEIGHT_VH[snap];

  return (
    <div
      ref={sheetRef}
      className="sheet"
      style={
        isDesktop
          ? undefined
          : {
              height: `${liveHeightVh}vh`,
              transition: isDragging ? "none" : undefined,
            }
      }
    >
      <div
        className="sheet-handle-row"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="sheet-handle" />
      </div>

      <div className="sheet-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sheet-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => {
              onTabChange(tab.id);
              if (!isDesktop && snap === "peek") onSnapChange("half");
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sheet-body">{children}</div>
    </div>
  );
}
