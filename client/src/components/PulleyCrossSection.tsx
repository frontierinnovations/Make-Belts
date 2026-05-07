/**
 * PulleyCrossSection.tsx
 *
 * Renders an accurate 2D engineering half-section drawing of a pulley.
 *
 * Layout (standard engineering half-section convention):
 *   • Left half  = exterior profile (what you see from outside)
 *   • Right half = cut section (bore, keyway, web, boss internals)
 *   • Centreline runs vertically through the middle
 *   • Horizontal axis centreline runs through the bore centre
 *
 * Coordinate system:
 *   • SVG origin = top-left
 *   • cx, cy = centre of the drawing (bore axis intersection)
 *   • r-axis maps to SVG-Y (radius increases downward from centreline)
 *   • z-axis maps to SVG-X (axial direction, left = z=0, right = z=totalWidth)
 *
 * All dimensions are in mm; a `scale` factor converts mm → SVG px.
 */

import React, { useMemo } from "react";
import type { PulleyParams, PulleyGeometry } from "@/lib/pulleyMath";
import {
  V_BELT_GROOVES,
  TIMING_GROOVES,
  getOBeltGrooveSpec,
  getKeyway,
} from "@/lib/pulleyMath";

// ─────────────────────────────────────────────
// COLOUR / STYLE CONSTANTS
// ─────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  outline: "#e8e8e8",       // solid body outline
  section: "#c8d8e8",       // cut-section face fill
  hatch: "#7090a8",         // hatch lines on cut face
  centreline: "#4a90d9",    // blue centreline
  dimLine: "#a0b8c8",       // dimension lines
  dimText: "#c8dce8",       // dimension text
  pitchLine: "#f0a040",     // pitch diameter circle (orange)
  rootLine: "#60c060",      // root diameter (green)
  boreHatch: "#8090a0",     // bore/keyway hatch
  warning: "#f0a040",
  grid: "#1e2430",
};

// ─────────────────────────────────────────────
// HELPER: build the axial profile points
// Returns array of {z, r} in mm, describing the
// outer surface of the pulley from z=0 to z=totalWidth.
// ─────────────────────────────────────────────
interface Pt { z: number; r: number; }

function buildOuterProfile(p: PulleyParams, geo: PulleyGeometry): Pt[] {
  const od = geo.outerDiameter / 2;
  const rd = geo.rootDiameter / 2;
  const fw = geo.faceWidth;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;

  const pts: Pt[] = [];

  if (p.grooveType === "vbelt") {
    const spec = V_BELT_GROOVES[p.vbeltSection];
    const halfAngle = (geo.grooveAngle / 2) * (Math.PI / 180);
    const topW = spec.topWidth / 2;

    pts.push({ z: 0, r: od });
    for (let i = 0; i < p.numGrooves; i++) {
      const zc = fw / 2 + (i - (p.numGrooves - 1) / 2) * p.grooveSpacing;
      const z1 = Math.max(0.5, zc - topW);
      const z2 = Math.min(fw - 0.5, zc + topW);
      pts.push({ z: z1, r: od });
      pts.push({ z: zc, r: rd });
      pts.push({ z: z2, r: od });
    }
    pts.push({ z: fw, r: od });
  } else if (p.grooveType === "flat") {
    const crownR = od + p.flatCrown;
    pts.push({ z: 0, r: od });
    pts.push({ z: fw / 2 - 1, r: od });
    pts.push({ z: fw / 2, r: crownR });
    pts.push({ z: fw / 2 + 1, r: od });
    pts.push({ z: fw, r: od });
  } else if (p.grooveType === "obelt") {
    const spec = getOBeltGrooveSpec(p.obeltDiameter);
    const gr = spec.grooveRadius;
    const zc = fw / 2;
    pts.push({ z: 0, r: od });
    pts.push({ z: zc - gr, r: od });
    // Concave semicircle: arc centre at (zc, od), radius = gr.
    // Sweep from angle=π (left: z=zc-gr, r=od) to angle=0 (right: z=zc+gr, r=od)
    // going through angle=π/2 where sin=1 → r = od - gr (deepest point).
    // Using -sin so the arc dips BELOW od (into the material).
    for (let i = 0; i <= 16; i++) {
      const angle = Math.PI - (i / 16) * Math.PI; // π → 0
      pts.push({
        z: zc + gr * Math.cos(angle),   // zc-gr → zc+gr
        r: od - gr * Math.sin(angle),   // od → od-gr → od (concave dip)
      });
    }
    pts.push({ z: zc + gr, r: od });
    pts.push({ z: fw, r: od });
  } else {
    // timing — show simplified rectangular tooth profile
    const spec = TIMING_GROOVES[p.timingProfile];
    const N = Math.min(p.timingTeeth, 40); // cap for visual clarity
    const pitch = fw / N; // visual pitch scaled to face width
    pts.push({ z: 0, r: od });
    for (let i = 0; i < N; i++) {
      const z0 = i * pitch;
      const z1 = z0 + pitch * 0.35;
      const z2 = z0 + pitch * 0.65;
      const z3 = z0 + pitch;
      pts.push({ z: z0, r: od });
      pts.push({ z: z1, r: od });
      pts.push({ z: z1, r: rd });
      pts.push({ z: z2, r: rd });
      pts.push({ z: z2, r: od });
      pts.push({ z: z3, r: od });
    }
    pts.push({ z: fw, r: od });
  }

  // Add boss if present
  if (bossH > 0) {
    pts.push({ z: fw, r: bossR });
    pts.push({ z: fw + bossH, r: bossR });
  }

  return pts;
}

// ─────────────────────────────────────────────
// HELPER: build the inner (bore-side) profile
// Returns the bore + hub + web inner boundary
// ─────────────────────────────────────────────
function buildInnerProfile(p: PulleyParams, geo: PulleyGeometry): Pt[] {
  const boreR = geo.boreDiameter / 2;
  const hubR = geo.hubDiameter / 2;
  const fw = geo.faceWidth;
  const webT = geo.webThickness;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const totalW = fw + bossH;

  // Left face: flat (bore goes directly to web edge)
  // Right face: hub step then boss
  const webStart = (fw - webT) / 2;
  const webEnd = (fw + webT) / 2;

  const pts: Pt[] = [
    { z: 0, r: boreR },
    // Bore runs from z=0 to z=webStart at boreR
    { z: webStart, r: boreR },
    // Hub steps out at web
    { z: webStart, r: hubR },
    // Hub outer face at web end
    { z: webEnd, r: hubR },
    // Bore continues from web end to right face
    { z: webEnd, r: boreR },
  ];

  if (bossH > 0) {
    pts.push({ z: fw, r: boreR });
    // Boss inner = bore
    pts.push({ z: fw + bossH, r: boreR });
  } else {
    pts.push({ z: fw, r: boreR });
  }

  return pts;
}

// ─────────────────────────────────────────────
// SVG HELPERS
// ─────────────────────────────────────────────
function ptToSvg(pt: Pt, cx: number, cy: number, scale: number): [number, number] {
  return [cx + pt.z * scale, cy - pt.r * scale];
}

function ptsToPolyline(pts: Pt[], cx: number, cy: number, scale: number): string {
  return pts.map(pt => ptToSvg(pt, cx, cy, scale).join(",")).join(" ");
}

function ptsToPath(pts: Pt[], cx: number, cy: number, scale: number, close = false): string {
  if (pts.length === 0) return "";
  const [x0, y0] = ptToSvg(pts[0], cx, cy, scale);
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = ptToSvg(pts[i], cx, cy, scale);
    d += ` L ${x} ${y}`;
  }
  if (close) d += " Z";
  return d;
}

// Dimension line with arrows
interface DimProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  offset?: number;   // perpendicular offset for the dim line
  side?: "above" | "below" | "left" | "right";
  fontSize?: number;
}

function DimLine({ x1, y1, x2, y2, label, offset = 14, side = "above", fontSize = 8.5 }: DimProps) {
  // Determine direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  // Perpendicular direction
  const px = -dy / len;
  const py = dx / len;

  const sign = (side === "above" || side === "left") ? -1 : 1;
  const ox = px * offset * sign;
  const oy = py * offset * sign;

  // Extension lines
  const ex1x = x1 + ox;
  const ex1y = y1 + oy;
  const ex2x = x2 + ox;
  const ex2y = y2 + oy;

  // Arrow size
  const aw = 4;
  const ah = 2;

  // Arrow 1 (at ex1)
  const a1x = ex1x + (dx / len) * aw;
  const a1y = ex1y + (dy / len) * aw;
  const a2x = ex2x - (dx / len) * aw;
  const a2y = ex2y - (dy / len) * aw;

  // Label position
  const mx = (ex1x + ex2x) / 2;
  const my = (ex1y + ex2y) / 2;
  const textOffset = 5;

  return (
    <g>
      {/* Extension lines from geometry to dim line */}
      <line x1={x1} y1={y1} x2={ex1x} y2={ex1y} stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1={x2} y1={y2} x2={ex2x} y2={ex2y} stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Dim line */}
      <line x1={ex1x} y1={ex1y} x2={ex2x} y2={ex2y} stroke={C.dimLine} strokeWidth="0.7" />
      {/* Arrows */}
      <polygon
        points={`${ex1x},${ex1y} ${a1x + (py * ah)},${a1y + (-px * ah)} ${a1x - (py * ah)},${a1y - (-px * ah)}`}
        fill={C.dimLine}
      />
      <polygon
        points={`${ex2x},${ex2y} ${a2x + (py * ah)},${a2y + (-px * ah)} ${a2x - (py * ah)},${a2y - (-px * ah)}`}
        fill={C.dimLine}
      />
      {/* Label */}
      <text
        x={mx + px * textOffset * sign}
        y={my + py * textOffset * sign}
        fill={C.dimText}
        fontSize={fontSize}
        fontFamily="monospace"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

// Radius dimension (leader line from centre to surface)
function RadiusDim({ cx, cy, r, label, angle, scale, fontSize = 8.5 }: {
  cx: number; cy: number; r: number; label: string; angle: number; scale: number; fontSize?: number;
}) {
  const svgR = r * scale;
  const ex = cx + Math.cos(angle) * svgR;
  const ey = cy - Math.sin(angle) * svgR;
  const lx = cx + Math.cos(angle) * (svgR + 18);
  const ly = cy - Math.sin(angle) * (svgR + 18);
  return (
    <g>
      <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="3,2" />
      <line x1={ex} y1={ey} x2={lx} y2={ly} stroke={C.dimLine} strokeWidth="0.7" />
      <text x={lx + (Math.cos(angle) > 0 ? 3 : -3)} y={ly} fill={C.dimText} fontSize={fontSize}
        fontFamily="monospace" textAnchor={Math.cos(angle) > 0 ? "start" : "end"} dominantBaseline="middle">
        {label}
      </text>
    </g>
  );
}

// Hatch pattern fill (45° lines)
function HatchRect({ x, y, w, h, id }: { x: number; y: number; w: number; h: number; id: string }) {
  return (
    <g>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
          <line x1="0" y1="4" x2="4" y2="0" stroke={C.hatch} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
interface Props {
  params: PulleyParams;
  geometry: PulleyGeometry;
  width?: number;
  height?: number;
}

export default function PulleyCrossSection({ params: p, geometry: geo, width = 700, height = 500 }: Props) {
  const svgData = useMemo(() => {
    const totalW = geo.faceWidth + (p.bossHeight > 0 ? p.bossHeight : 0);
    const totalR = geo.outerDiameter / 2;

    // Compute scale to fit with margins
    // Reserve space: left for OD/PD labels (~55px), right for bore/hub labels (~70px)
    // top/bottom for dimension lines (~50px each)
    const leftMargin = 55;
    const rightMargin = 80;
    const topMargin = 50;
    const bottomMargin = 50;
    const availW = width - leftMargin - rightMargin;
    // The drawing is symmetric: cy is vertical centre, OD extends both up and down.
    // So the available half-height for the radius is (height/2 - topMargin).
    const availH = height / 2 - topMargin;
    const scaleX = availW / totalW;
    const scaleY = availH / totalR;
    const scale = Math.min(scaleX, scaleY, 6.0); // cap at 6 px/mm for very small pulleys

    // Centre of drawing (bore axis at vertical centre)
    // cx = left edge of pulley drawing (z=0 maps here)
    // We centre the drawing horizontally in the available space
    const drawingWidthPx = totalW * scale;
    const cx = leftMargin + (availW - drawingWidthPx) / 2;
    const cy = height / 2;

    const outerPts = buildOuterProfile(p, geo);
    const innerPts = buildInnerProfile(p, geo);

    // Build the closed section polygon (right half = section view)
    // The section polygon is: outer profile top + right edge + inner profile (reversed) + left edge
    const fw = geo.faceWidth;
    const bossH = p.bossHeight;
    const totalWmm = fw + bossH;
    const od = geo.outerDiameter / 2;
    const boreR = geo.boreDiameter / 2;
    const hubR = geo.hubDiameter / 2;
    const bossR = p.bossDiameter / 2;
    const webT = geo.webThickness;
    const webStart = (fw - webT) / 2;
    const webEnd = (fw + webT) / 2;

    // Section fill polygon: traces outer profile then inner profile back
    // This represents the solid material in cross-section
    const sectionPts: Pt[] = [
      ...outerPts,
      // Right face closing (from outer bottom to bore)
      { z: totalWmm, r: boreR },
      // Inner profile reversed
      ...innerPts.slice().reverse(),
      // Close back to start
      { z: 0, r: od },
    ];

    // Mirror: outer profile for the bottom half (r becomes -r, but in SVG we just go below cy)
    // We'll draw the full cross-section as a symmetric shape about cy

    return { scale, cx, cy, outerPts, innerPts, sectionPts, totalWmm, od, boreR, hubR, bossR, webT, webStart, webEnd, fw, bossH };
  }, [p, geo, width, height]);

  const { scale, cx, cy, outerPts, innerPts, sectionPts, totalWmm, od, boreR, hubR, bossR, webT, webStart, webEnd, fw, bossH } = svgData;

  // Convert mm to SVG px (z → x offset from cx, r → y offset from cy)
  const sx = (z: number) => cx + z * scale;
  const sy = (r: number) => cy - r * scale;   // positive r goes UP (above centreline)
  const sy2 = (r: number) => cy + r * scale;  // positive r goes DOWN (below centreline)

  const rightEdgeX = sx(totalWmm);
  const leftEdgeX = sx(0);

  // Build SVG path for the full cross-section outline (symmetric about centreline)
  // Top half = outer profile
  const topOuterPath = outerPts.map((pt, i) =>
    `${i === 0 ? "M" : "L"} ${sx(pt.z).toFixed(1)} ${sy(pt.r).toFixed(1)}`
  ).join(" ");

  // Bottom half = mirror of outer profile (r negated → sy2)
  const bottomOuterPath = [...outerPts].reverse().map((pt) =>
    `L ${sx(pt.z).toFixed(1)} ${sy2(pt.r).toFixed(1)}`
  ).join(" ");

  // Full outline closed path
  const fullOutlinePath = topOuterPath + " " + bottomOuterPath + " Z";

  // Section fill (right half only) — top inner profile
  const topInnerPath = innerPts.map((pt, i) =>
    `${i === 0 ? "M" : "L"} ${sx(pt.z).toFixed(1)} ${sy(pt.r).toFixed(1)}`
  ).join(" ");

  // Section fill polygon (right half, top): outer top → right edge → inner top reversed
  const sectionFillTop = [
    ...outerPts.map((pt, i) => `${i === 0 ? "M" : "L"} ${sx(pt.z).toFixed(1)} ${sy(pt.r).toFixed(1)}`),
    `L ${rightEdgeX.toFixed(1)} ${sy(boreR).toFixed(1)}`,
    ...[...innerPts].reverse().map(pt => `L ${sx(pt.z).toFixed(1)} ${sy(pt.r).toFixed(1)}`),
    "Z"
  ].join(" ");

  // Section fill polygon (right half, bottom): mirror
  const sectionFillBottom = [
    ...outerPts.map((pt, i) => `${i === 0 ? "M" : "L"} ${sx(pt.z).toFixed(1)} ${sy2(pt.r).toFixed(1)}`),
    `L ${rightEdgeX.toFixed(1)} ${sy2(boreR).toFixed(1)}`,
    ...[...innerPts].reverse().map(pt => `L ${sx(pt.z).toFixed(1)} ${sy2(pt.r).toFixed(1)}`),
    "Z"
  ].join(" ");

  // Centreline dashes
  const clX1 = leftEdgeX - 20;
  const clX2 = rightEdgeX + 30;

  // Pitch diameter line (dashed orange, at od for V-belt, at pd for timing)
  const pdR = p.grooveType === "timing"
    ? geo.pitchDiameter / 2
    : geo.outerDiameter / 2;

  // Keyway geometry for section view
  const keyway = geo.keyway;
  const kwW = keyway ? keyway.width : 0;
  const kwHubDepth = keyway ? keyway.hubDepth : 0;

  // D-shaft flat chord
  const dFlatY = p.boreType === "dshaft"
    ? boreR - p.dShaftFlatDepth
    : null;

  // Hatch pattern unique IDs
  const hatchIdTop = "hatch-top";
  const hatchIdBot = "hatch-bot";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: C.bg, display: "block" }}
      fontFamily="monospace"
    >
      <defs>
        {/* Hatch pattern for cut section */}
        <pattern id={hatchIdTop} patternUnits="userSpaceOnUse" width="5" height="5">
          <line x1="0" y1="5" x2="5" y2="0" stroke={C.hatch} strokeWidth="0.7" />
        </pattern>
        <pattern id={hatchIdBot} patternUnits="userSpaceOnUse" width="5" height="5">
          <line x1="0" y1="5" x2="5" y2="0" stroke={C.hatch} strokeWidth="0.7" />
        </pattern>
        {/* Clip to right half for section fill */}
        <clipPath id="right-half">
          <rect x={cx + fw / 2 * scale} y={0} width={width} height={height} />
        </clipPath>
        <clipPath id="left-half">
          <rect x={0} y={0} width={cx + fw / 2 * scale} height={height} />
        </clipPath>
      </defs>

      {/* ── Background grid ── */}
      {Array.from({ length: Math.ceil(width / 20) }).map((_, i) => (
        <line key={`gx${i}`} x1={i * 20} y1={0} x2={i * 20} y2={height} stroke={C.grid} strokeWidth="0.5" />
      ))}
      {Array.from({ length: Math.ceil(height / 20) }).map((_, i) => (
        <line key={`gy${i}`} x1={0} y1={i * 20} x2={width} y2={i * 20} stroke={C.grid} strokeWidth="0.5" />
      ))}

      {/* ── Full outline (both halves) ── */}
      <path d={fullOutlinePath} fill="none" stroke={C.outline} strokeWidth="1.5" />

      {/* ── Section fill (right half only — material cross-section) ── */}
      <g clipPath="url(#right-half)">
        <path d={sectionFillTop} fill={C.section} opacity="0.18" />
        <path d={sectionFillTop} fill={`url(#${hatchIdTop})`} opacity="0.6" />
        <path d={sectionFillBottom} fill={C.section} opacity="0.18" />
        <path d={sectionFillBottom} fill={`url(#${hatchIdBot})`} opacity="0.6" />
      </g>

      {/* ── Section divider line (vertical at fw/2) ── */}
      <line
        x1={cx + fw / 2 * scale} y1={sy(od) - 8}
        x2={cx + fw / 2 * scale} y2={sy2(od) + 8}
        stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="4,3"
      />

      {/* ── Centreline (horizontal, through bore axis) ── */}
      <line x1={clX1} y1={cy} x2={clX2} y2={cy}
        stroke={C.centreline} strokeWidth="0.8" strokeDasharray="8,3,2,3" />

      {/* ── Vertical centreline (at z=fw/2) ── */}
      <line
        x1={cx + fw / 2 * scale} y1={cy - od * scale - 20}
        x2={cx + fw / 2 * scale} y2={cy + od * scale + 20}
        stroke={C.centreline} strokeWidth="0.8" strokeDasharray="8,3,2,3"
      />

      {/* ── Bore hole (white fill to show it's empty) ── */}
      <rect
        x={leftEdgeX}
        y={sy(boreR)}
        width={(totalWmm) * scale}
        height={boreR * 2 * scale}
        fill={C.bg}
        stroke={C.outline}
        strokeWidth="1"
      />

      {/* ── Keyway slot (section view, right half) ── */}
      {p.boreType === "keyway" && keyway && (
        <g clipPath="url(#right-half)">
          {/* Top keyway slot */}
          <rect
            x={sx(webStart)}
            y={sy(boreR + kwHubDepth)}
            width={webT * scale}
            height={kwHubDepth * scale}
            fill={C.bg}
            stroke={C.outline}
            strokeWidth="0.8"
          />
          {/* Bottom keyway slot (mirror) */}
          <rect
            x={sx(webStart)}
            y={sy2(boreR)}
            width={webT * scale}
            height={kwHubDepth * scale}
            fill={C.bg}
            stroke={C.outline}
            strokeWidth="0.8"
          />
        </g>
      )}

      {/* ── D-shaft flat (section view) ── */}
      {p.boreType === "dshaft" && dFlatY !== null && (
        <g clipPath="url(#right-half)">
          <rect
            x={sx(webStart)}
            y={sy(boreR)}
            width={webT * scale}
            height={(boreR - dFlatY) * scale}
            fill={C.bg}
            stroke={C.outline}
            strokeWidth="0.8"
          />
        </g>
      )}

      {/* ── Web thickness indicator lines (section view) ── */}
      <g clipPath="url(#right-half)">
        <line x1={sx(webStart)} y1={sy(od)} x2={sx(webStart)} y2={sy2(od)}
          stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="3,2" />
        <line x1={sx(webEnd)} y1={sy(od)} x2={sx(webEnd)} y2={sy2(od)}
          stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="3,2" />
      </g>

      {/* ── Pitch diameter line (dashed, left half only) ── */}
      <g clipPath="url(#left-half)">
        <line x1={leftEdgeX - 5} y1={sy(pdR)} x2={sx(fw / 2) + 5} y2={sy(pdR)}
          stroke={C.pitchLine} strokeWidth="0.8" strokeDasharray="6,3" />
        <line x1={leftEdgeX - 5} y1={sy2(pdR)} x2={sx(fw / 2) + 5} y2={sy2(pdR)}
          stroke={C.pitchLine} strokeWidth="0.8" strokeDasharray="6,3" />
      </g>

      {/* ── Root diameter line (dashed green, left half only) ── */}
      {geo.rootDiameter < geo.outerDiameter && (
        <g clipPath="url(#left-half)">
          <line x1={leftEdgeX - 5} y1={sy(geo.rootDiameter / 2)} x2={sx(fw / 2) + 5} y2={sy(geo.rootDiameter / 2)}
            stroke={C.rootLine} strokeWidth="0.6" strokeDasharray="4,3" />
          <line x1={leftEdgeX - 5} y1={sy2(geo.rootDiameter / 2)} x2={sx(fw / 2) + 5} y2={sy2(geo.rootDiameter / 2)}
            stroke={C.rootLine} strokeWidth="0.6" strokeDasharray="4,3" />
        </g>
      )}

      {/* ── DIMENSION LINES ── */}

      {/* Overall diameter (OD) — left side, vertical */}
      <DimLine
        x1={leftEdgeX - 10} y1={sy(od)}
        x2={leftEdgeX - 10} y2={sy2(od)}
        label={`Ø${geo.outerDiameter.toFixed(1)}`}
        offset={28} side="left"
      />

      {/* Face width — top, horizontal */}
      <DimLine
        x1={leftEdgeX} y1={sy(od) - 8}
        x2={sx(fw)} y2={sy(od) - 8}
        label={`${fw.toFixed(1)}`}
        offset={16} side="above"
      />

      {/* Boss height — top, horizontal (if present) */}
      {bossH > 0 && (
        <DimLine
          x1={sx(fw)} y1={sy(bossR) - 8}
          x2={sx(totalWmm)} y2={sy(bossR) - 8}
          label={`${bossH.toFixed(1)}`}
          offset={12} side="above"
        />
      )}

      {/* Bore diameter — right side, vertical */}
      <DimLine
        x1={rightEdgeX + 10} y1={sy(boreR)}
        x2={rightEdgeX + 10} y2={sy2(boreR)}
        label={`Ø${geo.boreDiameter.toFixed(1)}`}
        offset={24} side="right"
      />

      {/* Hub diameter — right side, vertical */}
      {hubR > boreR + 2 && (
        <DimLine
          x1={rightEdgeX + 10} y1={sy(hubR)}
          x2={rightEdgeX + 10} y2={sy2(hubR)}
          label={`Ø${geo.hubDiameter.toFixed(1)}`}
          offset={44} side="right"
        />
      )}

      {/* Boss diameter — right side */}
      {bossH > 0 && bossR > boreR + 1 && (
        <DimLine
          x1={rightEdgeX + 10} y1={sy(bossR)}
          x2={rightEdgeX + 10} y2={sy2(bossR)}
          label={`Ø${p.bossDiameter.toFixed(1)}`}
          offset={64} side="right"
        />
      )}

      {/* Web thickness — bottom */}
      <DimLine
        x1={sx(webStart)} y1={sy2(od) + 8}
        x2={sx(webEnd)} y2={sy2(od) + 8}
        label={`${webT.toFixed(1)}`}
        offset={12} side="below"
      />

      {/* Pitch diameter label */}
      <text
        x={leftEdgeX - 35}
        y={sy(pdR) - 3}
        fill={C.pitchLine}
        fontSize={7.5}
        fontFamily="monospace"
        textAnchor="end"
      >
        PD
      </text>
      <text
        x={leftEdgeX - 35}
        y={sy(pdR) + 8}
        fill={C.pitchLine}
        fontSize={7.5}
        fontFamily="monospace"
        textAnchor="end"
      >
        Ø{geo.pitchDiameter.toFixed(1)}
      </text>

      {/* Root diameter label (if different from OD) */}
      {geo.rootDiameter < geo.outerDiameter && (
        <>
          <text x={leftEdgeX - 35} y={sy(geo.rootDiameter / 2) - 3}
            fill={C.rootLine} fontSize={7.5} fontFamily="monospace" textAnchor="end">
            RD
          </text>
          <text x={leftEdgeX - 35} y={sy(geo.rootDiameter / 2) + 8}
            fill={C.rootLine} fontSize={7.5} fontFamily="monospace" textAnchor="end">
            Ø{geo.rootDiameter.toFixed(1)}
          </text>
        </>
      )}

      {/* Keyway annotation */}
      {p.boreType === "keyway" && keyway && (
        <g clipPath="url(#right-half)">
          <text
            x={sx(webStart + webT / 2)}
            y={sy(boreR + kwHubDepth) - 5}
            fill={C.dimText}
            fontSize={7}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {`${kwW}×${kwHubDepth} KW`}
          </text>
        </g>
      )}

      {/* Groove angle annotation (V-belt) */}
      {p.grooveType === "vbelt" && (
        <text
          x={sx(fw / 2) - 5}
          y={sy(od) + 14}
          fill={C.dimText}
          fontSize={7.5}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {geo.grooveAngle}°
        </text>
      )}

      {/* ── Title block ── */}
      <rect x={width - 190} y={height - 58} width={185} height={53} fill="#0d1018" stroke="#2a3444" strokeWidth="0.8" />
      <text x={width - 98} y={height - 44} fill="#e8e8e8" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {p.grooveType.toUpperCase()} PULLEY — CROSS SECTION
      </text>
      <text x={width - 98} y={height - 32} fill="#a0b8c8" fontSize={7.5} fontFamily="monospace" textAnchor="middle">
        {p.grooveType === "vbelt" ? `${p.vbeltSection} section · ${p.numGrooves} groove${p.numGrooves > 1 ? "s" : ""}` :
          p.grooveType === "timing" ? `${p.timingProfile} · ${p.timingTeeth}T` :
          p.grooveType === "obelt" ? `Ø${p.obeltDiameter} round belt` :
          `Flat belt · crown ${p.flatCrown}mm`}
      </text>
      <text x={width - 98} y={height - 20} fill="#a0b8c8" fontSize={7.5} fontFamily="monospace" textAnchor="middle">
        {`OD ${geo.outerDiameter.toFixed(1)} · PD ${geo.pitchDiameter.toFixed(1)} · W ${fw.toFixed(1)} mm`}
      </text>
      <text x={width - 98} y={height - 10} fill="#607080" fontSize={6.5} fontFamily="monospace" textAnchor="middle">
        {`${p.material} · ${geo.estimatedMass.toFixed(1)}g · ISO 4183 / RMA IP-20`}
      </text>

      {/* ── Legend ── */}
      <g transform={`translate(${width - 190}, ${height - 120})`}>
        <rect x={0} y={0} width={185} height={58} fill="#0d1018" stroke="#2a3444" strokeWidth="0.8" />
        <line x1={8} y1={12} x2={28} y2={12} stroke={C.pitchLine} strokeWidth="1" strokeDasharray="5,3" />
        <text x={32} y={15} fill={C.pitchLine} fontSize={7} fontFamily="monospace">Pitch diameter</text>
        <line x1={8} y1={24} x2={28} y2={24} stroke={C.rootLine} strokeWidth="1" strokeDasharray="4,3" />
        <text x={32} y={27} fill={C.rootLine} fontSize={7} fontFamily="monospace">Root / tip diameter</text>
        <line x1={8} y1={36} x2={28} y2={36} stroke={C.centreline} strokeWidth="1" strokeDasharray="8,3,2,3" />
        <text x={32} y={39} fill={C.centreline} fontSize={7} fontFamily="monospace">Centreline</text>
        <rect x={8} y={44} width={12} height={8} fill={C.section} opacity="0.3" />
        <line x1={8} y1={52} x2={20} y2={44} stroke={C.hatch} strokeWidth="0.6" />
        <line x1={12} y1={52} x2={20} y2={46} stroke={C.hatch} strokeWidth="0.6" />
        <text x={32} y={51} fill={C.dimText} fontSize={7} fontFamily="monospace">Section material</text>
      </g>
    </svg>
  );
}
