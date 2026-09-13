import * as THREE from "three";
import { GLOBE_RADIUS, latLngToVector3 } from "./geo";
import { lines, stations, type MetroStation } from "./metro-data";

export interface GlobeSceneOptions {
  container: HTMLElement;
  onStationHover: (station: MetroStation | null) => void;
  onStationClick: (station: MetroStation) => void;
}

const STATION_ALTITUDE = 0.35;
const LINE_ALTITUDE = 0.25;
const DELHI_CENTER = { lat: 28.5352, lng: 77.1675 };

export class GlobeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private stationMeshes: THREE.Mesh[] = [];
  private stationByMesh = new Map<THREE.Mesh, MetroStation>();
  private hoveredMesh: THREE.Mesh | null = null;
  private selectedMesh: THREE.Mesh | null = null;

  // orbit/rotation state
  private minDistance = GLOBE_RADIUS * 1.15;
  private maxDistance = GLOBE_RADIUS * 6;
  private distance = GLOBE_RADIUS * 2.1;
  private theta: number; // azimuth
  private phi: number; // polar
  private isDragging = false;
  private dragDistance = 0;
  private lastPointer = { x: 0, y: 0 };
  private velocity = { theta: 0, phi: 0 };
  private autoRotate = true;
  private autoRotateSpeed = 0.02;

  private pinchStartDist = 0;
  private pinchStartDistance = 0;
  private isPinching = false;

  private onStationHover: (s: MetroStation | null) => void;
  private onStationClick: (s: MetroStation) => void;

  private animationHandle = 0;
  private disposed = false;

  private highlightedLine: string | null = null;
  private lineMeshes: { line: string; mesh: THREE.Object3D }[] = [];
  private routeGroup: THREE.Group;
  private lineGroup: THREE.Group;
  private markerGroup: THREE.Group;

  constructor(opts: GlobeSceneOptions) {
    this.container = opts.container;
    this.onStationHover = opts.onStationHover;
    this.onStationClick = opts.onStationClick;

    // camera starts looking at Delhi
    const target = latLngToVector3(DELHI_CENTER.lat, DELHI_CENTER.lng, 0, 1);
    this.phi = Math.acos(THREE.MathUtils.clamp(target.y, -1, 1));
    this.theta = Math.atan2(target.x, target.z);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000,
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.lineGroup = new THREE.Group();
    this.markerGroup = new THREE.Group();
    this.routeGroup = new THREE.Group();
    this.scene.add(this.lineGroup, this.markerGroup, this.routeGroup);

    this.setupLights();
    this.setupStars();
    this.buildEarth();
    this.buildMetroLines();
    this.buildStationMarkers();
    this.updateCamera();

    this.bindEvents();
    this.animate();
  }

  // ---------------------------------------------------------------------
  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(60, 40, 80);
    this.scene.add(ambient, sun);
  }

  private setupStars() {
    const starGeo = new THREE.BufferGeometry();
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 300 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });
    this.scene.add(new THREE.Points(starGeo, starMat));
  }

  private buildEarth() {
    const loader = new THREE.TextureLoader();
    const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);

    const material = new THREE.MeshPhongMaterial({
      color: 0x0b1a2a,
      shininess: 4,
    });
    const earth = new THREE.Mesh(geometry, material);
    this.scene.add(earth);

    loader.load("/textures/earth-night.jpg", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });

    // subtle atmosphere glow
    const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    this.scene.add(new THREE.Mesh(glowGeo, glowMat));
  }

  private buildMetroLines() {
    for (const line of lines) {
      const pts = line.stations
        .map((id) => stations.find((s) => s.id === id))
        .filter((s): s is MetroStation => Boolean(s))
        .map((s) => latLngToVector3(s.latitude, s.longitude, LINE_ALTITUDE));

      if (pts.length < 2) continue;

      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.15);
      const tubeGeo = new THREE.TubeGeometry(
        curve,
        Math.max(pts.length * 6, 32),
        0.12,
        6,
        false,
      );
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(line.color),
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(tubeGeo, mat);
      mesh.userData.lineId = line.id;
      mesh.userData.baseOpacity = 0.92;
      this.lineGroup.add(mesh);
      this.lineMeshes.push({ line: line.id, mesh });
    }
  }

  private buildStationMarkers() {
    const geoNormal = new THREE.SphereGeometry(0.42, 12, 12);
    const geoInterchange = new THREE.SphereGeometry(0.62, 14, 14);

    for (const station of stations) {
      const pos = latLngToVector3(station.latitude, station.longitude, STATION_ALTITUDE);
      const color = station.isInterchange
        ? 0xffffff
        : new THREE.Color(lines.find((l) => l.id === station.lines[0])?.color ?? "#ffffff").getHex();

      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(station.isInterchange ? geoInterchange : geoNormal, mat);
      mesh.position.copy(pos);
      mesh.userData.baseScale = 1;
      this.markerGroup.add(mesh);
      this.stationMeshes.push(mesh);
      this.stationByMesh.set(mesh, station);
    }
  }

  // ---------------------------------------------------------------------
  private bindEvents() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";

    el.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    el.addEventListener("wheel", this.handleWheel, { passive: false });
    el.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    el.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    el.addEventListener("touchend", this.handleTouchEnd);
    el.addEventListener("click", this.handleClick);
    window.addEventListener("resize", this.handleResize);
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (this.isPinching) return;
    this.isDragging = true;
    this.dragDistance = 0;
    this.autoRotate = false;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.updatePointerNDC(e.clientX, e.clientY);

    if (this.isDragging && !this.isPinching) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.dragDistance += Math.hypot(dx, dy);
      this.lastPointer = { x: e.clientX, y: e.clientY };

      const rotSpeed = 0.005;
      this.velocity.theta = -dx * rotSpeed;
      this.velocity.phi = -dy * rotSpeed;
      this.theta += this.velocity.theta;
      this.phi = THREE.MathUtils.clamp(this.phi + this.velocity.phi, 0.15, Math.PI - 0.15);
      this.updateCamera();
    } else if (!this.isDragging) {
      this.updateHover();
    }
  };

  private handlePointerUp = () => {
    this.isDragging = false;
    this.renderer.domElement.style.cursor = "grab";
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.autoRotate = false;
    const zoomSpeed = 0.0015;
    this.distance = THREE.MathUtils.clamp(
      this.distance * (1 + e.deltaY * zoomSpeed),
      this.minDistance,
      this.maxDistance,
    );
    this.updateCamera();
  };

  private handleTouchStart = (e: TouchEvent) => {
    // single-finger drag is already handled by pointer events (which fire for
    // touch too); this handler exists only to detect the two-finger pinch
    // gesture, which pointer events can't express.
    if (e.touches.length === 2) {
      this.isDragging = false;
      this.autoRotate = false;
      this.isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchStartDist = Math.hypot(dx, dy);
      this.pinchStartDistance = this.distance;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = this.pinchStartDist / Math.max(dist, 1);
      this.distance = THREE.MathUtils.clamp(
        this.pinchStartDistance * scale,
        this.minDistance,
        this.maxDistance,
      );
      this.updateCamera();
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) this.isPinching = false;
  };

  private handleClick = (e: MouseEvent) => {
    // a real drag (rotate) shouldn't also register as a station click/tap
    if (this.dragDistance > 6) return;
    this.updatePointerNDC(e.clientX, e.clientY);
    const hit = this.raycastStation();
    if (hit) {
      this.setSelected(hit.mesh);
      this.onStationClick(this.stationByMesh.get(hit.mesh)!);
    }
  };

  private handleResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private updatePointerNDC(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastStation(): { mesh: THREE.Mesh } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points = { threshold: 1 };
    const intersects = this.raycaster.intersectObjects(this.stationMeshes, false);
    if (intersects.length > 0) {
      return { mesh: intersects[0].object as THREE.Mesh };
    }
    return null;
  }

  private updateHover() {
    const hit = this.raycastStation();
    const mesh = hit?.mesh ?? null;

    if (mesh !== this.hoveredMesh) {
      if (this.hoveredMesh && this.hoveredMesh !== this.selectedMesh) {
        this.hoveredMesh.scale.setScalar(1);
      }
      this.hoveredMesh = mesh;
      if (mesh) {
        mesh.scale.setScalar(1.8);
        this.renderer.domElement.style.cursor = "pointer";
        this.onStationHover(this.stationByMesh.get(mesh)!);
      } else {
        this.renderer.domElement.style.cursor = this.isDragging ? "grabbing" : "grab";
        this.onStationHover(null);
      }
    }
  }

  private setSelected(mesh: THREE.Mesh | null) {
    if (this.selectedMesh && this.selectedMesh !== mesh) {
      this.selectedMesh.scale.setScalar(this.selectedMesh === this.hoveredMesh ? 1.8 : 1);
    }
    this.selectedMesh = mesh;
    if (mesh) mesh.scale.setScalar(2.2);
  }

  // ---------------------------------------------------------------------
  private updateCamera() {
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animationHandle = requestAnimationFrame(this.animate);

    if (this.autoRotate && !this.isDragging) {
      this.theta += this.autoRotateSpeed * 0.02;
      this.updateCamera();
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ---------------------------------------------------------------------
  /** Public API for React layer */

  focusOnStation(station: MetroStation, distance = this.minDistance * 1.6) {
    this.autoRotate = false;
    const target = latLngToVector3(station.latitude, station.longitude, 0, 1);
    this.phi = Math.acos(THREE.MathUtils.clamp(target.y, -1, 1));
    this.theta = Math.atan2(target.x, target.z);
    this.distance = THREE.MathUtils.clamp(distance, this.minDistance, this.maxDistance);
    this.updateCamera();

    const mesh = this.stationMeshes.find((m) => this.stationByMesh.get(m)?.id === station.id);
    if (mesh) this.setSelected(mesh);
  }

  resetView() {
    this.autoRotate = true;
    this.setSelected(null);
    this.clearRoute();
    this.setLineFilter(null);
    const target = latLngToVector3(DELHI_CENTER.lat, DELHI_CENTER.lng, 0, 1);
    this.phi = Math.acos(THREE.MathUtils.clamp(target.y, -1, 1));
    this.theta = Math.atan2(target.x, target.z);
    this.distance = GLOBE_RADIUS * 2.1;
    this.updateCamera();
  }

  zoomIn() {
    this.autoRotate = false;
    this.distance = THREE.MathUtils.clamp(this.distance * 0.8, this.minDistance, this.maxDistance);
    this.updateCamera();
  }

  zoomOut() {
    this.autoRotate = false;
    this.distance = THREE.MathUtils.clamp(this.distance * 1.25, this.minDistance, this.maxDistance);
    this.updateCamera();
  }

  setLineFilter(lineId: string | null) {
    this.highlightedLine = lineId;
    for (const { line, mesh } of this.lineMeshes) {
      const m = mesh as THREE.Mesh;
      const mat = m.material as THREE.MeshBasicMaterial;
      const active = !lineId || line === lineId;
      mat.opacity = active ? 0.92 : 0.08;
    }
    for (const mesh of this.stationMeshes) {
      const station = this.stationByMesh.get(mesh)!;
      const active = !lineId || station.lines.includes(lineId);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = active ? 1 : 0.15;
      mat.transparent = true;
    }
  }

  /** Draw a highlighted route path (array of station ids in order) with pulsing markers. */
  showRoute(stationIds: string[]) {
    this.clearRoute();
    if (stationIds.length < 2) return;

    const pts = stationIds
      .map((id) => stations.find((s) => s.id === id))
      .filter((s): s is MetroStation => Boolean(s))
      .map((s) => latLngToVector3(s.latitude, s.longitude, LINE_ALTITUDE + 0.5));

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(pts.length * 8, 32), 0.28, 8, false);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(tubeGeo, mat);
    this.routeGroup.add(mesh);

    // endpoint markers
    for (const [i, p] of pts.entries()) {
      if (i !== 0 && i !== pts.length - 1) continue;
      const geo = new THREE.SphereGeometry(0.9, 16, 16);
      const m2 = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x22c55e : 0xef4444 });
      const marker = new THREE.Mesh(geo, m2);
      marker.position.copy(p);
      this.routeGroup.add(marker);
    }

    // fade non-route stations
    const routeSet = new Set(stationIds);
    for (const mesh2 of this.stationMeshes) {
      const station = this.stationByMesh.get(mesh2)!;
      const mat2 = mesh2.material as THREE.MeshBasicMaterial;
      mat2.transparent = true;
      mat2.opacity = routeSet.has(station.id) ? 1 : 0.2;
    }
    for (const { mesh: lmesh } of this.lineMeshes) {
      const mat3 = (lmesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat3.opacity = 0.15;
    }

    // frame the route
    if (pts.length > 0) {
      const mid = stationIds[Math.floor(stationIds.length / 2)];
      const midStation = stations.find((s) => s.id === mid);
      if (midStation) this.focusOnStation(midStation, this.minDistance * 2.2);
    }
  }

  clearRoute() {
    while (this.routeGroup.children.length > 0) {
      const obj = this.routeGroup.children[0];
      this.routeGroup.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }
    for (const mesh of this.stationMeshes) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1;
    }
    // restore line/station opacity to whatever the current line filter dictates
    this.setLineFilter(this.highlightedLine);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationHandle);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    el.removeEventListener("wheel", this.handleWheel);
    el.removeEventListener("touchstart", this.handleTouchStart);
    el.removeEventListener("touchmove", this.handleTouchMove);
    el.removeEventListener("touchend", this.handleTouchEnd);
    el.removeEventListener("click", this.handleClick);
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    if (el.parentElement === this.container) this.container.removeChild(el);
  }
}
