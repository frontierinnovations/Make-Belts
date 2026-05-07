/**
 * PulleyCanvas.tsx — Three.js 3D parametric pulley viewer
 *
 * Design: Clean Utilitarian matching Make-Gears/Make-Belts
 * - Dark canvas with subtle grid
 * - Orbit controls (mouse drag = rotate, scroll = zoom)
 * - Live mesh rebuild on param change
 * - Section view toggle (cut plane)
 */

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { PulleyParams, PulleyGeometry } from "@/lib/pulleyMath";
import { V_BELT_GROOVES, TIMING_GROOVES, getOBeltGrooveSpec } from "@/lib/pulleyMath";

// ─────────────────────────────────────────────
// ORBIT CONTROLS (inline, no import needed)
// ─────────────────────────────────────────────

class SimpleOrbitControls {
  private isDragging = false;
  private isRightDragging = false;
  private lastX = 0;
  private lastY = 0;
  private theta = Math.PI / 4;
  private phi = Math.PI / 3;
  private radius = 200;
  private panX = 0;
  private panY = 0;
  private readonly minRadius = 30;
  private readonly maxRadius = 1000;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement,
  ) {
    this.addListeners();
    this.update();
  }

  // Touch state
  private touchStartDist = 0;
  private touchStartRadius = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private lastTouchMidX = 0;
  private lastTouchMidY = 0;

  private addListeners() {
    this.domElement.addEventListener("mousedown", this.onMouseDown);
    this.domElement.addEventListener("mousemove", this.onMouseMove);
    this.domElement.addEventListener("mouseup", this.onMouseUp);
    this.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
    // Touch events
    this.domElement.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.domElement.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.domElement.addEventListener("touchend", this.onTouchEnd);
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.domElement.removeEventListener("mousemove", this.onMouseMove);
    this.domElement.removeEventListener("mouseup", this.onMouseUp);
    this.domElement.removeEventListener("wheel", this.onWheel);
    this.domElement.removeEventListener("touchstart", this.onTouchStart);
    this.domElement.removeEventListener("touchmove", this.onTouchMove);
    this.domElement.removeEventListener("touchend", this.onTouchEnd);
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      this.touchStartDist = Math.sqrt(dx * dx + dy * dy);
      this.touchStartRadius = this.radius;
      this.lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      this.lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      // Single finger: rotate
      const dx = e.touches[0].clientX - this.lastTouchX;
      const dy = e.touches[0].clientY - this.lastTouchY;
      this.theta -= dx * 0.007;
      this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi - dy * 0.007));
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
      this.update();
    } else if (e.touches.length === 2) {
      // Two fingers: pinch to zoom + pan
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (this.touchStartDist > 0) {
        this.radius = Math.max(this.minRadius, Math.min(this.maxRadius,
          this.touchStartRadius * (this.touchStartDist / dist)
        ));
      }
      // Pan with midpoint
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.panX -= (midX - this.lastTouchMidX) * 0.15;
      this.panY += (midY - this.lastTouchMidY) * 0.15;
      this.lastTouchMidX = midX;
      this.lastTouchMidY = midY;
      this.update();
    }
  };

  private onTouchEnd = (_e: TouchEvent) => {
    this.touchStartDist = 0;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) { this.isDragging = true; }
    if (e.button === 2) { this.isRightDragging = true; }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (this.isDragging) {
      this.theta -= dx * 0.005;
      this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi - dy * 0.005));
    }
    if (this.isRightDragging) {
      this.panX -= dx * 0.1;
      this.panY += dy * 0.1;
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.update();
  };

  private onMouseUp = () => {
    this.isDragging = false;
    this.isRightDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + e.deltaY * 0.3));
    this.update();
  };

  update() {
    const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    this.camera.position.set(x + this.panX, y + this.panY, z);
    this.camera.lookAt(this.panX, this.panY, 0);
  }

  setRadius(r: number) {
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, r));
    this.update();
  }
}

// ─────────────────────────────────────────────
// PULLEY MESH BUILDER
// ─────────────────────────────────────────────

interface ProfilePoint { r: number; z: number; }

function buildVBeltProfile(p: PulleyParams, geo: PulleyGeometry): ProfilePoint[] {
  const od = geo.outerDiameter / 2;
  const rd = geo.rootDiameter / 2;
  const fw = geo.faceWidth;
  const hubR = geo.hubDiameter / 2;
  const boreR = geo.boreDiameter / 2;
  const webT = geo.webThickness;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const spec = V_BELT_GROOVES[p.vbeltSection];
  const topW = spec.topWidth / 2;
  const openWeb = p.webStyle === "spokes";

  const pts: ProfilePoint[] = [];

  // Build rim profile with groove(s)
  const rimPts: ProfilePoint[] = [{ r: od, z: 0 }];
  for (let i = 0; i < p.numGrooves; i++) {
    const zc = fw / 2 + (i - (p.numGrooves - 1) / 2) * p.grooveSpacing;
    const z1 = Math.max(0.5, zc - topW);
    const z2 = Math.min(fw - 0.5, zc + topW);
    rimPts.push({ r: od, z: z1 });
    rimPts.push({ r: rd, z: zc });
    rimPts.push({ r: od, z: z2 });
  }
  rimPts.push({ r: od, z: fw });

  // Web inner radius (where web meets rim)
  const webOuterR = Math.max(hubR + 5, rd - 2);

  if (openWeb) {
    // Open web: hub cylinder + rim ring only — no solid disk between them.
    // Left face: bore → hub (flat, no step)
    // Web edges: hub steps out at web start/end, rim connects at web edges
    pts.push(
      { r: boreR, z: 0 },
      // Left face is flat — bore goes directly to web edge
      { r: hubR, z: (fw - webT) / 2 },
      { r: webOuterR, z: (fw - webT) / 2 },
      ...rimPts,
      { r: webOuterR, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
    );
  } else {
    // Solid web: hub steps on both sides
    pts.push(
      { r: boreR, z: 0 },
      { r: hubR, z: 0 },
      { r: hubR, z: (fw - webT) / 2 },
      { r: webOuterR, z: (fw - webT) / 2 },
      ...rimPts,
      { r: webOuterR, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
      { r: hubR, z: fw },
    );
  }

  if (bossH > 0) {
    pts.push(
      { r: bossR, z: fw },
      { r: bossR, z: fw + bossH },
      { r: boreR, z: fw + bossH },
    );
  } else {
    pts.push({ r: boreR, z: fw });
  }

  return pts;
}

function buildFlatProfile(p: PulleyParams, geo: PulleyGeometry): ProfilePoint[] {
  const od = geo.outerDiameter / 2;
  const fw = geo.faceWidth;
  const hubR = geo.hubDiameter / 2;
  const boreR = geo.boreDiameter / 2;
  const webT = geo.webThickness;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const crownR = od + p.flatCrown;
  const openWeb = p.webStyle === "spokes";

  const pts: ProfilePoint[] = openWeb ? [
    // Open web: flat left face, no hub step on left
    { r: boreR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: od, z: (fw - webT) / 2 },
    { r: crownR, z: fw / 2 },
    { r: od, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
  ] : [
    // Solid web: hub steps on both sides
    { r: boreR, z: 0 },
    { r: hubR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: od, z: (fw - webT) / 2 },
    { r: crownR, z: fw / 2 },
    { r: od, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
    { r: hubR, z: fw },
  ];

  if (bossH > 0) {
    pts.push({ r: bossR, z: fw }, { r: bossR, z: fw + bossH }, { r: boreR, z: fw + bossH });
  } else {
    pts.push({ r: boreR, z: fw });
  }
  return pts;
}

function buildOBeltProfile(p: PulleyParams, geo: PulleyGeometry): ProfilePoint[] {
  const od = geo.outerDiameter / 2;
  const fw = geo.faceWidth;
  const hubR = geo.hubDiameter / 2;
  const boreR = geo.boreDiameter / 2;
  const webT = geo.webThickness;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const spec = getOBeltGrooveSpec(p.obeltDiameter);
  const gr = spec.grooveRadius;
  const gd = spec.grooveDepth;

  // Approximate semicircular groove with 16 points
  const groovePts: ProfilePoint[] = [];
  const zc = fw / 2;
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const angle = Math.PI - (i / N) * Math.PI;
    groovePts.push({
      r: od - gd + gr * Math.sin(angle),
      z: zc + gr * Math.cos(angle),
    });
  }

  const openWeb = p.webStyle === "spokes";
  const pts: ProfilePoint[] = openWeb ? [
    // Open web: flat left face
    { r: boreR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: od, z: (fw - webT) / 2 },
    { r: od, z: zc - gr },
    ...groovePts,
    { r: od, z: zc + gr },
    { r: od, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
  ] : [
    // Solid web: hub steps on both sides
    { r: boreR, z: 0 },
    { r: hubR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: od, z: (fw - webT) / 2 },
    { r: od, z: zc - gr },
    ...groovePts,
    { r: od, z: zc + gr },
    { r: od, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
    { r: hubR, z: fw },
  ];

  if (bossH > 0) {
    pts.push({ r: bossR, z: fw }, { r: bossR, z: fw + bossH }, { r: boreR, z: fw + bossH });
  } else {
    pts.push({ r: boreR, z: fw });
  }
  return pts;
}

function buildTimingProfile(p: PulleyParams, geo: PulleyGeometry): ProfilePoint[] {
  const od = geo.outerDiameter / 2;
  const rd = geo.rootDiameter / 2;
  const fw = geo.faceWidth;
  const hubR = geo.hubDiameter / 2;
  const boreR = geo.boreDiameter / 2;
  const webT = geo.webThickness;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const openWeb = p.webStyle === "spokes";

  const pts: ProfilePoint[] = openWeb ? [
    // Open web: flat left face
    { r: boreR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: rd, z: (fw - webT) / 2 },
    { r: rd, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
  ] : [
    // Solid web: hub steps on both sides
    { r: boreR, z: 0 },
    { r: hubR, z: 0 },
    { r: hubR, z: (fw - webT) / 2 },
    { r: rd, z: (fw - webT) / 2 },
    { r: rd, z: (fw + webT) / 2 },
    { r: hubR, z: (fw + webT) / 2 },
    { r: hubR, z: fw },
  ];

  if (bossH > 0) {
    pts.push({ r: bossR, z: fw }, { r: bossR, z: fw + bossH }, { r: boreR, z: fw + bossH });
  } else {
    pts.push({ r: boreR, z: fw });
  }
  return pts;
}

/**
 * Build a lathe geometry from a 2D profile.
 * The profile is in the r-z plane (r = radius, z = axial).
 * THREE.LatheGeometry expects points in the x-y plane where x=r, y=z.
 */
function buildLatheGeometry(profile: ProfilePoint[], segments = 128): THREE.LatheGeometry {
  const points = profile.map(pt => new THREE.Vector2(pt.r, pt.z));
  return new THREE.LatheGeometry(points, segments);
}

/**
 * Build timing belt tooth geometry as individual tooth meshes.
 * Each tooth is a swept profile around the pitch circle.
 */
function buildTimingTeethGeometry(p: PulleyParams, geo: PulleyGeometry): THREE.BufferGeometry {
  const spec = TIMING_GROOVES[p.timingProfile];
  const pd = geo.pitchDiameter / 2;
  const td = spec.toothDepth;
  const tp = spec.pitch;
  const fw = geo.faceWidth;
  const numTeeth = geo.numTeeth;

  const mergedGeo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];

  // Each tooth: a rectangular prism on the pitch circle
  const toothW = tp * 0.55; // tooth width at base
  const toothH = td;

  for (let i = 0; i < numTeeth; i++) {
    const angle = (i / numTeeth) * Math.PI * 2;
    const cx = pd * Math.cos(angle);
    const cy = pd * Math.sin(angle);
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -Math.sin(angle);
    const ty = Math.cos(angle);

    // 8 corners of the tooth box
    const corners: [number, number, number][] = [
      [cx + nx * toothH + tx * toothW / 2, cy + ny * toothH + ty * toothW / 2, 0],
      [cx + nx * toothH - tx * toothW / 2, cy + ny * toothH - ty * toothW / 2, 0],
      [cx - tx * toothW / 2, cy - ty * toothW / 2, 0],
      [cx + tx * toothW / 2, cy + ty * toothW / 2, 0],
      [cx + nx * toothH + tx * toothW / 2, cy + ny * toothH + ty * toothW / 2, fw],
      [cx + nx * toothH - tx * toothW / 2, cy + ny * toothH - ty * toothW / 2, fw],
      [cx - tx * toothW / 2, cy - ty * toothW / 2, fw],
      [cx + tx * toothW / 2, cy + ty * toothW / 2, fw],
    ];

    // 6 faces × 2 triangles × 3 vertices
    const faces = [
      [0,1,2,3], [4,7,6,5], [0,4,5,1], [2,6,7,3], [0,3,7,4], [1,5,6,2]
    ];
    for (const face of faces) {
      const [a,b,c,d] = face;
      const v = [corners[a], corners[b], corners[c], corners[d]];
      // Two triangles: abc, acd
      for (const tri of [[0,1,2],[0,2,3]] as [number,number,number][]) {
        for (const idx of tri) {
          positions.push(...v[idx]);
          normals.push(nx, ny, 0);
        }
      }
    }
  }

  mergedGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mergedGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  mergedGeo.computeVertexNormals();
  return mergedGeo;
}

/**
 * Build keyway geometry as a box to subtract visually.
 */
function buildKeywayCutGeometry(p: PulleyParams, geo: PulleyGeometry): THREE.BoxGeometry | null {
  if (p.boreType !== "keyway" || !geo.keyway) return null;
  const kw = geo.keyway;
  const totalLen = geo.faceWidth + p.bossHeight + 2;
  return new THREE.BoxGeometry(kw.width, kw.hubDepth + geo.boreDiameter / 2, totalLen);
}

/**
 * Build D-shaft flat as a box to subtract visually.
 */
function buildDShaftCutGeometry(p: PulleyParams, geo: PulleyGeometry): THREE.BoxGeometry | null {
  if (p.boreType !== "dshaft") return null;
  const totalLen = geo.faceWidth + p.bossHeight + 2;
  const boreR = geo.boreDiameter / 2;
  return new THREE.BoxGeometry(geo.boreDiameter + 2, p.dShaftFlatDepth + 0.5, totalLen);
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface PulleyCanvasProps {
  params: PulleyParams;
  geometry: PulleyGeometry;
  sectionView: boolean;
}

export default function PulleyCanvas({ params, geometry, sectionView }: PulleyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef<SimpleOrbitControls | null>(null);
  const frameRef = useRef<number>(0);
  const pulleyGroupRef = useRef<THREE.Group | null>(null);

  // ── Init Three.js ─────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1a2e, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.002);
    sceneRef.current = scene;

    // Grid
    const grid = new THREE.GridHelper(400, 40, 0x2a2a4a, 0x222240);
    grid.position.y = -60;
    scene.add(grid);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(100, 150, 100);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-100, 50, -100);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(0, -100, 100);
    scene.add(rim);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    camera.position.set(150, 100, 150);
    cameraRef.current = camera;

    // Orbit
    const orbit = new SimpleOrbitControls(camera, renderer.domElement);
    orbitRef.current = orbit;

    // Pulley group
    const group = new THREE.Group();
    scene.add(group);
    pulleyGroupRef.current = group;

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      orbit.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // ── Rebuild mesh on param change ──────────────
  const rebuildMesh = useCallback(() => {
    const group = pulleyGroupRef.current;
    const scene = sceneRef.current;
    if (!group || !scene) return;

    // Clear old meshes
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        (child.material as THREE.Material)?.dispose();
      }
      group.remove(child);
    }

    const p = params;
    const geo = geometry;

    if (geo.errors.length > 0) return; // Don't render invalid geometry

    // ── Materials ────────────────────────────────
    const bodyMat = new THREE.MeshStandardMaterial({
      color: p.material === "Aluminum" ? 0xb8c4cc :
             p.material === "Steel" ? 0x8899aa :
             p.material === "PLA" ? 0x4a90d9 :
             p.material === "PETG" ? 0x5ba85b :
             p.material === "Nylon" ? 0xe8c87a : 0x4a90d9,
      metalness: (p.material === "Aluminum" || p.material === "Steel") ? 0.7 : 0.1,
      roughness: (p.material === "Aluminum" || p.material === "Steel") ? 0.3 : 0.6,
      side: THREE.FrontSide,
    });

    const boreMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      metalness: 0.1,
      roughness: 0.8,
    });

    const toothMat = new THREE.MeshStandardMaterial({
      color: bodyMat.color,
      metalness: bodyMat.metalness,
      roughness: bodyMat.roughness,
    });

    // ── Build profile ────────────────────────────
    let profile: ProfilePoint[];
    if (p.grooveType === "vbelt") profile = buildVBeltProfile(p, geo);
    else if (p.grooveType === "flat") profile = buildFlatProfile(p, geo);
    else if (p.grooveType === "obelt") profile = buildOBeltProfile(p, geo);
    else profile = buildTimingProfile(p, geo);

    // Lathe geometry (outer body)
    const latheGeo = buildLatheGeometry(profile, 128);
    latheGeo.computeVertexNormals();

    // Apply section view clipping
    if (sectionView) {
      const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      bodyMat.clippingPlanes = [clippingPlane];
      bodyMat.clipShadows = true;
      if (rendererRef.current) {
        rendererRef.current.localClippingEnabled = true;
      }
    } else {
      bodyMat.clippingPlanes = [];
      if (rendererRef.current) {
        rendererRef.current.localClippingEnabled = false;
      }
    }

    // Rotate so axis is along Y (Three.js Y-up, lathe is around Y by default)
    // LatheGeometry revolves around Y axis, points are in X-Z plane
    // We want axis along Z for our convention, so rotate -90° around X
    const bodyMesh = new THREE.Mesh(latheGeo, bodyMat);
    bodyMesh.rotation.x = -Math.PI / 2;
    bodyMesh.position.z = -geo.faceWidth / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // ── Timing teeth ─────────────────────────────
    if (p.grooveType === "timing" && geo.numTeeth > 0) {
      const teethGeo = buildTimingTeethGeometry(p, geo);
      teethGeo.computeVertexNormals();
      const teethMesh = new THREE.Mesh(teethGeo, toothMat);
      teethMesh.rotation.x = -Math.PI / 2;
      teethMesh.position.z = -geo.faceWidth / 2;
      group.add(teethMesh);
    }

    // ── Bore face disks ────────────────────────────
    // Coordinate system after lathe rotation.x=-PI/2 and position.z=-faceWidth/2:
    //   Pulley axis = Z, pulley spans z = -faceWidth/2 to z = +faceWidth/2
    //   Boss (if any) extends from z = +faceWidth/2 to z = +faceWidth/2 + bossHeight
    //   Web centre = z = 0
    const boreR = geo.boreDiameter / 2;
    const halfFW = geo.faceWidth / 2;
    const boreDiskGeo = new THREE.RingGeometry(boreR - 0.5, boreR + 1.5, 64);
    const boreDisk1 = new THREE.Mesh(boreDiskGeo, boreMat);
    boreDisk1.rotation.x = Math.PI / 2;
    boreDisk1.position.z = -halfFW + 0.1;
    group.add(boreDisk1);
    const boreDisk2 = new THREE.Mesh(boreDiskGeo.clone(), boreMat);
    boreDisk2.rotation.x = -Math.PI / 2;
    boreDisk2.position.z = halfFW + p.bossHeight - 0.1;
    group.add(boreDisk2);

    // ── Keyway visual ─────────────────────────────
    // Pulley spans z = -faceWidth/2 to z = +faceWidth/2 + bossHeight
    // Slot runs the full bore length, centred at z = bossHeight/2
    if (p.boreType === "keyway" && geo.keyway) {
      const kw = geo.keyway;
      const boreR2 = geo.boreDiameter / 2;
      const kwLength = geo.faceWidth + p.bossHeight + 1.0;
      const kwCentreZ = p.bossHeight / 2; // centred between -faceWidth/2 and +faceWidth/2+bossHeight
      const kwGeo = new THREE.BoxGeometry(kw.hubDepth + 0.5, kw.width, kwLength);
      const kwMesh = new THREE.Mesh(kwGeo, boreMat);
      kwMesh.position.x = boreR2 + kw.hubDepth / 2;
      kwMesh.position.y = 0;
      kwMesh.position.z = kwCentreZ;
      group.add(kwMesh);
      const kwCapGeo = new THREE.BoxGeometry(0.5, kw.width + 0.2, kwLength);
      const kwCapMat = new THREE.MeshStandardMaterial({
        color: bodyMat.color,
        metalness: bodyMat.metalness,
        roughness: bodyMat.roughness,
      });
      const kwCapMesh = new THREE.Mesh(kwCapGeo, kwCapMat);
      kwCapMesh.position.x = boreR2 + kw.hubDepth + 0.1;
      kwCapMesh.position.y = 0;
      kwCapMesh.position.z = kwCentreZ;
      group.add(kwCapMesh);
    }

    // ── D-shaft flat visual ───────────────────────
    // Pulley spans z = -faceWidth/2 to z = +faceWidth/2 + bossHeight
    if (p.boreType === "dshaft") {
      const boreR2 = geo.boreDiameter / 2;
      const flatX = boreR2 - p.dShaftFlatDepth;
      const chordWidth = 2 * Math.sqrt(Math.max(0, boreR2 * boreR2 - flatX * flatX));
      const kwLength = geo.faceWidth + p.bossHeight + 1.0;
      const kwCentreZ = p.bossHeight / 2;
      const flatGeo = new THREE.BoxGeometry(p.dShaftFlatDepth + 0.5, chordWidth, kwLength);
      const flatMesh = new THREE.Mesh(flatGeo, boreMat);
      flatMesh.position.x = flatX + p.dShaftFlatDepth / 2;
      flatMesh.position.y = 0;
      flatMesh.position.z = kwCentreZ;
      group.add(flatMesh);
    }

    // ── Spokes ────────────────────────────────────
    // Real geometry approach: the lathe profile already has an open web (no solid
    // disk between hub and rim when webStyle=="spokes"). We add BoxGeometry spoke
    // ribs using the body material. Each spoke is a box whose long axis is radial,
    // positioned between hubR and rimR at the web centre (z=0 in world space).
    // Pulley axis = Z, web centre = z=0.
    if (p.webStyle === "spokes" && p.numSpokes > 0) {
      const hubR = geo.hubDiameter / 2;
      // rimInnerR: inner surface of the rim where spokes attach.
      // The lathe profile connects the hub to the rim at webOuterR = max(hubR+5, rootR-2).
      // Use rootDiameter/2 - 2 as the inner rim radius (same as webOuterR in profile builders).
      const rootR = geo.rootDiameter / 2;
      const rimInnerR = Math.max(hubR + 5, rootR - 2);
      // Spoke runs from hub outer surface to rim inner surface
      const spokeStart = hubR + 0.5;
      const spokeEnd = rimInnerR - 0.5;
      const spokeLen = Math.max(2, spokeEnd - spokeStart);
      const spokeThick = Math.max(2, geo.webThickness); // axial thickness = web thickness
      const spokeMat = new THREE.MeshStandardMaterial({
        color: bodyMat.color,
        metalness: bodyMat.metalness,
        roughness: bodyMat.roughness,
      });
      for (let i = 0; i < p.numSpokes; i++) {
        const angle = (i / p.numSpokes) * Math.PI * 2;
        // BoxGeometry: width=spokeLen (radial), height=spokeWidth (tangential), depth=spokeThick (axial)
        const spokeGeo = new THREE.BoxGeometry(spokeLen, p.spokeWidth, spokeThick);
        const spokeMesh = new THREE.Mesh(spokeGeo, spokeMat);
        // Centre of spoke is at midpoint between hub surface and rim inner surface
        const midR = spokeStart + spokeLen / 2;
        spokeMesh.position.x = Math.cos(angle) * midR;
        spokeMesh.position.y = Math.sin(angle) * midR;
        spokeMesh.position.z = 0; // web centre in world space
        spokeMesh.rotation.z = angle; // rotate so length axis points radially
        group.add(spokeMesh);
      }
    }

    // ── Lightening holes (visual rings) ──────────
    // Pulley axis = Z. Holes are positioned in XY plane at web Z centre.
    if (p.webStyle === "lightening" && p.numLighteningHoles > 0) {
      const pcd = geo.lighteningHolePCD / 2;
      const webZ = 0; // pulley centred at z=0
      for (let i = 0; i < p.numLighteningHoles; i++) {
        const angle = (i / p.numLighteningHoles) * Math.PI * 2;
        const holeGeo = new THREE.CylinderGeometry(
          p.lighteningHoleDiameter / 2,
          p.lighteningHoleDiameter / 2,
          geo.webThickness + 1,
          32
        );
        const holeMat = new THREE.MeshStandardMaterial({ color: 0x111122 });
        const holeMesh = new THREE.Mesh(holeGeo, holeMat);
        // CylinderGeometry default axis is Y; rotate so it aligns with Z
        holeMesh.rotation.x = Math.PI / 2;
        holeMesh.position.x = Math.cos(angle) * pcd;
        holeMesh.position.y = Math.sin(angle) * pcd;
        holeMesh.position.z = webZ;
        group.add(holeMesh);
      }
    }

    // ── Axis line removed — clutters the view ────

    // ── Auto-fit camera ───────────────────────────
    const maxDim = Math.max(geo.outerDiameter, geo.faceWidth + p.bossHeight);
    orbitRef.current?.setRadius(maxDim * 1.5);

  }, [params, geometry, sectionView]);

  useEffect(() => {
    rebuildMesh();
  }, [rebuildMesh]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#1a1a2e", cursor: "grab" }}
    />
  );
}
