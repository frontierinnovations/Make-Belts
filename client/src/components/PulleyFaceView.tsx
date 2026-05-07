/**
 * PulleyFaceView.tsx — Front-face (end-on) view of the pulley
 *
 * Design: Engineering drawing style matching PulleyCrossSection
 * - Dark background, cyan outlines, dashed reference circles
 * - Shows: outer rim, pitch diameter, root diameter, hub, bore, spokes/lightening holes
 * - Dimension callouts for key diameters
 */
import { useMemo } from "react";
import type { PulleyParams, PulleyGeometry } from "@/lib/pulleyMath";
import type React from "react";

// ── Colour palette (matches cross-section) ──────────────────────────────────
const C = {
  bg: "#0a0d14",
  grid: "#1a2030",
  outline: "#c8d8e8",
  section: "#4a6080",
  sectionFill: "rgba(40,60,90,0.55)",
  bore: "#0a0d14",
  pitchLine: "#e8a020",
  rootLine: "#40b060",
  centreLine: "#3080c0",
  dimLine: "#607898",
  dimText: "#8aa8c8",
  hubFill: "rgba(40,60,90,0.55)",
  spokeFill: "#c8d8e8",
  spokeLine: "#c8d8e8",
  lighteningFill: "#0a0d14",
};

interface Props {
  params: PulleyParams;
  geometry: PulleyGeometry;
  width: number;
  height: number;
}

export default function PulleyFaceView({ params: p, geometry: geo, width, height }: Props) {
  const svgData = useMemo(() => {
    const od = geo.outerDiameter;
    const pd = geo.pitchDiameter;
    const rd = geo.rootDiameter;
    const hubD = geo.hubDiameter;
    const boreD = geo.boreDiameter;

    // Scale: fit OD in available space with margins
    const margin = 60;
    const availR = Math.min(width, height) / 2 - margin;
    const scale = availR / (od / 2); // px per mm

    const cx = width / 2;
    const cy = height / 2;

    const s = (mm: number) => mm * scale; // mm → px radius

    // Spoke geometry
    const numSpokes = p.numSpokes ?? 5;
    const spokeW = (p.spokeWidth ?? 6) * scale;
    const hubR = s(hubD / 2);
    const rimInnerR = s(rd / 2 - 2); // inner edge of rim
    const spokeLen = rimInnerR - hubR;

    // Lightening holes
    const lighteningR = s(hubD / 2 + (rd / 2 - hubD / 2) * 0.5); // midpoint radius
    const lighteningHoleR = s(Math.min((rd / 2 - hubD / 2) * 0.3, 8));

    return { od, pd, rd, hubD, boreD, scale, cx, cy, s, numSpokes, spokeW, hubR, rimInnerR, spokeLen, lighteningR, lighteningHoleR };
  }, [p, geo, width, height]);

  const { od, pd, rd, hubD, boreD, scale, cx, cy, s, numSpokes, spokeW, hubR, rimInnerR, spokeLen, lighteningR, lighteningHoleR } = svgData;

  // Grid lines
  const gridLines: React.ReactElement[] = [];
  const gridSpacing = Math.max(10, Math.round(20 / scale)) * scale; // ~20px spacing
  for (let x = cx % gridSpacing; x < width; x += gridSpacing) {
    gridLines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={height} stroke={C.grid} strokeWidth={0.5} />);
  }
  for (let y = cy % gridSpacing; y < height; y += gridSpacing) {
    gridLines.push(<line key={`gy${y}`} x1={0} y1={y} x2={width} y2={y} stroke={C.grid} strokeWidth={0.5} />);
  }

  // Spoke paths
  const spokePaths: React.ReactElement[] = [];
  if (p.webStyle === "spokes" && numSpokes > 0 && spokeLen > 0) {
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Spoke as a rectangle: perpendicular to radial direction
      const perp = angle + Math.PI / 2;
      const pc = Math.cos(perp);
      const ps = Math.sin(perp);
      const hw = spokeW / 2;
      // Four corners of the spoke rectangle
      const x1 = cx + cos * hubR - pc * hw;
      const y1 = cy + sin * hubR - ps * hw;
      const x2 = cx + cos * (hubR + spokeLen) - pc * hw;
      const y2 = cy + sin * (hubR + spokeLen) - ps * hw;
      const x3 = cx + cos * (hubR + spokeLen) + pc * hw;
      const y3 = cy + sin * (hubR + spokeLen) + ps * hw;
      const x4 = cx + cos * hubR + pc * hw;
      const y4 = cy + sin * hubR + ps * hw;
      spokePaths.push(
        <polygon
          key={`spoke${i}`}
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
          fill={C.spokeFill}
          stroke={C.spokeLine}
          strokeWidth={0.8}
        />
      );
    }
  }

  // Lightening holes
  const lighteningHoles: React.ReactElement[] = [];
  if (p.webStyle === "lightening" && numSpokes > 0 && lighteningHoleR > 2) {
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2 - Math.PI / 2;
      const hx = cx + Math.cos(angle) * lighteningR;
      const hy = cy + Math.sin(angle) * lighteningR;
      lighteningHoles.push(
        <circle key={`lh${i}`} cx={hx} cy={hy} r={lighteningHoleR} fill={C.lighteningFill} stroke={C.outline} strokeWidth={0.8} />
      );
    }
  }

  // Dimension callouts: small leader lines with text
  const dimR = s(od / 2) + 18;
  const dims = [
    { r: s(od / 2), label: `OD Ø${od.toFixed(1)}`, angle: -45 },
    { r: s(pd / 2), label: `PD Ø${pd.toFixed(1)}`, angle: -20 },
    { r: s(rd / 2), label: `RD Ø${rd.toFixed(1)}`, angle: 10 },
    { r: s(hubD / 2), label: `Hub Ø${hubD.toFixed(1)}`, angle: 40 },
    { r: s(boreD / 2), label: `Bore Ø${boreD.toFixed(1)}`, angle: 65 },
  ].filter(d => d.r > 2);

  return (
    <svg
      width={width}
      height={height}
      style={{ background: C.bg, display: "block" }}
      fontFamily="'JetBrains Mono', 'Fira Mono', 'Consolas', monospace"
    >
      {/* Grid */}
      <g opacity={0.6}>{gridLines}</g>

      {/* Centrelines */}
      <line x1={cx - s(od / 2) - 12} y1={cy} x2={cx + s(od / 2) + 12} y2={cy}
        stroke={C.centreLine} strokeWidth={0.8} strokeDasharray="8,4,2,4" />
      <line x1={cx} y1={cy - s(od / 2) - 12} x2={cx} y2={cy + s(od / 2) + 12}
        stroke={C.centreLine} strokeWidth={0.8} strokeDasharray="8,4,2,4" />

      {/* Pitch diameter circle */}
      <circle cx={cx} cy={cy} r={s(pd / 2)} fill="none"
        stroke={C.pitchLine} strokeWidth={1} strokeDasharray="10,5" />

      {/* Root diameter circle */}
      <circle cx={cx} cy={cy} r={s(rd / 2)} fill="none"
        stroke={C.rootLine} strokeWidth={1} strokeDasharray="6,4" />

      {/* Outer rim — filled with section material */}
      <circle cx={cx} cy={cy} r={s(od / 2)} fill={C.sectionFill} stroke={C.outline} strokeWidth={1.5} />

      {/* Inner rim edge (root/groove bottom) */}
      <circle cx={cx} cy={cy} r={s(rd / 2)} fill={C.bg} stroke={C.outline} strokeWidth={0.8} />

      {/* Web: solid disk between hub and rim inner */}
      {p.webStyle === "solid" && (
        <circle cx={cx} cy={cy} r={rimInnerR} fill={C.sectionFill} stroke="none" />
      )}

      {/* Spokes */}
      {p.webStyle === "spokes" && (
        <>
          {/* Dark gap between hub and rim */}
          <circle cx={cx} cy={cy} r={rimInnerR} fill={C.bg} stroke="none" />
          {spokePaths}
        </>
      )}

      {/* Fins (solid web with thin radial fins) */}
      {p.webStyle === "fins" && (
        <circle cx={cx} cy={cy} r={rimInnerR} fill={C.sectionFill} stroke="none" />
      )}

      {/* Lightening holes */}
      {p.webStyle === "lightening" && (
        <>
          <circle cx={cx} cy={cy} r={rimInnerR} fill={C.sectionFill} stroke="none" />
          {lighteningHoles}
        </>
      )}

      {/* Hub circle */}
      <circle cx={cx} cy={cy} r={hubR} fill={C.sectionFill} stroke={C.outline} strokeWidth={1} />

      {/* Bore hole */}
      <circle cx={cx} cy={cy} r={s(boreD / 2)} fill={C.bore} stroke={C.outline} strokeWidth={1.2} />

      {/* Keyway slot */}
      {p.boreType === "keyway" && geo.keyway && (() => {
        const kw = geo.keyway!.width * scale;
        const kd = geo.keyway!.hubDepth * scale;
        const boreRpx = s(boreD / 2);
        return (
          <rect
            x={cx - kw / 2}
            y={cy - boreRpx - kd}
            width={kw}
            height={kd + 2}
            fill={C.bore}
            stroke={C.outline}
            strokeWidth={0.8}
          />
        );
      })()}

      {/* D-shaft flat */}
      {p.boreType === "dshaft" && (() => {
        const boreRpx = s(boreD / 2);
        const flatY = cy - boreRpx * 0.75;
        return (
          <line x1={cx - boreRpx * 0.9} y1={flatY} x2={cx + boreRpx * 0.9} y2={flatY}
            stroke={C.outline} strokeWidth={1.2} />
        );
      })()}

      {/* Dimension leaders — right side */}
      {dims.map((d, i) => {
        const ang = (d.angle * Math.PI) / 180;
        const ex = cx + Math.cos(ang) * d.r;
        const ey = cy + Math.sin(ang) * d.r;
        const lx = cx + Math.cos(ang) * (d.r + 20);
        const ly = cy + Math.sin(ang) * (d.r + 20);
        const tx = lx + (Math.cos(ang) >= 0 ? 4 : -4);
        return (
          <g key={i}>
            <line x1={ex} y1={ey} x2={lx} y2={ly} stroke={C.dimLine} strokeWidth={0.7} />
            <circle cx={ex} cy={ey} r={1.5} fill={C.dimLine} />
            <text
              x={tx} y={ly}
              fill={C.dimText}
              fontSize={8}
              textAnchor={Math.cos(ang) >= 0 ? "start" : "end"}
              dominantBaseline="middle"
            >{d.label}</text>
          </g>
        );
      })}

      {/* Title block */}
      <g>
        <text x={12} y={height - 28} fill={C.dimText} fontSize={8.5} fontWeight="bold">
          FACE VIEW
        </text>
        <text x={12} y={height - 17} fill={C.dimLine} fontSize={7.5}>
          {`OD Ø${od.toFixed(1)} · PD Ø${pd.toFixed(1)} · Bore Ø${boreD.toFixed(1)} mm`}
        </text>
      </g>
    </svg>
  );
}
