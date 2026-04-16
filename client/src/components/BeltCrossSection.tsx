/**
 * BeltCrossSection — SVG cross-section diagram for belt types
 *
 * Renders an accurate cross-sectional profile of the selected belt:
 *   - V-belt: trapezoid with groove angle, pitch line, dimensions
 *   - Timing belt: rectangular body with rounded teeth on inner face
 *   - Flat belt: rectangle with width/thickness labels
 *   - Round belt: circle with diameter label
 *
 * Style: Clean engineering drawing aesthetic — thin lines, dimension annotations,
 * matching Make-Gears visual language.
 */
import {
  type BeltType,
  type VBeltSection,
  type TimingProfile,
  V_BELT_SECTIONS,
  TIMING_PROFILES,
} from "@/lib/beltMath";

interface BeltCrossSectionProps {
  beltType: BeltType;
  vbeltSection: VBeltSection;
  timingProfile: TimingProfile;
  flatThickness: number;   // mm
  beltWidth: number;       // mm
  className?: string;
}

export default function BeltCrossSection({
  beltType,
  vbeltSection,
  timingProfile,
  flatThickness,
  beltWidth,
  className = "",
}: BeltCrossSectionProps) {
  const W = 200;
  const H = 140;

  return (
    <div className={`bg-white border border-gray-200 rounded overflow-hidden ${className}`}>
      <div className="px-2 py-1 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cross-Section</span>
        <span className="text-[10px] text-gray-400">
          {beltType === "vbelt" ? `V-Belt ${vbeltSection}`
           : beltType === "timing" ? `${timingProfile} Timing`
           : beltType === "flat" ? "Flat Belt"
           : "Round Belt"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        className="block"
        style={{ maxHeight: 140 }}
      >
        {beltType === "vbelt" && <VBeltSection section={vbeltSection} W={W} H={H} />}
        {beltType === "timing" && <TimingBeltSection profile={timingProfile} width={beltWidth} W={W} H={H} />}
        {beltType === "flat" && <FlatBeltSection thickness={flatThickness} width={beltWidth} W={W} H={H} />}
        {beltType === "round" && <RoundBeltSection diameter={beltWidth} W={W} H={H} />}
      </svg>
    </div>
  );
}

// ─── V-Belt cross-section ─────────────────────────────────────────────────────
function VBeltSection({ section, W, H }: { section: VBeltSection; W: number; H: number }) {
  const data = V_BELT_SECTIONS[section];
  const cx = W / 2;
  const cy = H / 2 + 5;

  // Scale to fit: top width should be ~100px
  const scale = Math.min(80 / data.topWidth, 60 / data.height);
  const tw = data.topWidth * scale;  // top width in px
  const h = data.height * scale;     // height in px
  const halfAngle = (data.grooveAngle * Math.PI) / 180;
  const bw = tw - 2 * h * Math.tan(halfAngle); // bottom width

  // Trapezoid points (top wider, bottom narrower)
  const x0 = cx - tw / 2;
  const x1 = cx + tw / 2;
  const x2 = cx + bw / 2;
  const x3 = cx - bw / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;

  // Pitch line (at pitchOffset from bottom)
  const pitchY = y1 - data.pitchOffset * scale;

  const points = `${x0},${y0} ${x1},${y0} ${x2},${y1} ${x3},${y1}`;

  return (
    <g>
      {/* Belt body */}
      <polygon points={points} fill="#2a2a2a" stroke="#555" strokeWidth="0.8" />

      {/* Pitch line */}
      <line x1={x0 - 8} y1={pitchY} x2={x1 + 8} y2={pitchY}
        stroke="#4a90d9" strokeWidth="0.8" strokeDasharray="4,2" />
      <text x={x1 + 10} y={pitchY + 3} fontSize="7" fill="#4a90d9" fontFamily="monospace">pitch</text>

      {/* Top width dimension */}
      <DimLine x1={x0} x2={x1} y={y0 - 10} label={`${data.topWidth} mm`} />

      {/* Height dimension */}
      <DimLineV y1={y0} y2={y1} x={x1 + 20} label={`${data.height} mm`} />

      {/* Groove angle annotation */}
      <text x={cx - 8} y={y1 + 14} fontSize="7" fill="#888" fontFamily="monospace" textAnchor="middle">
        {`β=${data.grooveAngle * 2}°`}
      </text>

      {/* Section label */}
      <text x={cx} y={cy + 3} fontSize="11" fill="white" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {section}
      </text>

      {/* Groove angle arc indicator */}
      <line x1={cx} y1={y1} x2={x3} y2={y0} stroke="#aaa" strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1={cx} y1={y1} x2={x2} y2={y0} stroke="#aaa" strokeWidth="0.5" strokeDasharray="2,2" />
    </g>
  );
}

// ─── Timing belt cross-section ────────────────────────────────────────────────
function TimingBeltSection({ profile, width, W, H }: { profile: TimingProfile; width: number; W: number; H: number }) {
  const data = TIMING_PROFILES[profile];
  const cx = W / 2;
  const cy = H / 2;

  // Scale: show ~3 teeth
  const numTeeth = 5;
  const pitchPx = Math.min(28, (W - 40) / numTeeth);
  const toothH = Math.min(20, data.toothHeight * pitchPx / data.pitch);
  const bodyH = Math.max(12, toothH * 1.5);
  const totalW = numTeeth * pitchPx;
  const startX = cx - totalW / 2;
  const bodyTop = cy - bodyH / 2;
  const bodyBot = cy + bodyH / 2;
  const toothBot = bodyBot + toothH;

  // Belt body (rectangle)
  const bodyPath = `M${startX},${bodyTop} L${startX + totalW},${bodyTop} L${startX + totalW},${bodyBot} L${startX},${bodyBot} Z`;

  // Teeth (rounded trapezoids on bottom face)
  const toothW = pitchPx * 0.6;
  const teeth: string[] = [];
  for (let i = 0; i < numTeeth; i++) {
    const tx = startX + i * pitchPx + (pitchPx - toothW) / 2;
    const r = toothH * 0.3;
    teeth.push(
      `M${tx},${bodyBot} L${tx},${toothBot - r} Q${tx},${toothBot} ${tx + r},${toothBot} L${tx + toothW - r},${toothBot} Q${tx + toothW},${toothBot} ${tx + toothW},${toothBot - r} L${tx + toothW},${bodyBot} Z`
    );
  }

  return (
    <g>
      {/* Belt body */}
      <path d={bodyPath} fill="#1a1a1a" stroke="#555" strokeWidth="0.8" />
      {/* Teeth */}
      {teeth.map((d, i) => (
        <path key={i} d={d} fill="#1a1a1a" stroke="#555" strokeWidth="0.8" />
      ))}
      {/* Pitch line (center of body) */}
      <line x1={startX - 8} y1={cy} x2={startX + totalW + 8} y2={cy}
        stroke="#4a90d9" strokeWidth="0.8" strokeDasharray="4,2" />

      {/* Pitch dimension */}
      <DimLine x1={startX} x2={startX + pitchPx} y={bodyTop - 10} label={`${data.pitch} mm`} />

      {/* Tooth height */}
      <DimLineV y1={bodyBot} y2={toothBot} x={startX + totalW + 18} label={`${data.toothHeight.toFixed(1)}`} />

      {/* Profile label */}
      <text x={cx} y={bodyTop - 18} fontSize="9" fill="#555" fontFamily="monospace" textAnchor="middle">
        {profile}
      </text>
      <text x={cx} y={cy + 4} fontSize="8" fill="white" fontFamily="monospace" textAnchor="middle">
        {`p=${data.pitch}mm`}
      </text>
    </g>
  );
}

// ─── Flat belt cross-section ──────────────────────────────────────────────────
function FlatBeltSection({ thickness, width, W, H }: { thickness: number; width: number; W: number; H: number }) {
  const cx = W / 2;
  const cy = H / 2;
  const scale = Math.min(120 / width, 40 / thickness, 3);
  const bw = Math.min(width * scale, W - 40);
  const bh = Math.max(8, Math.min(thickness * scale, 40));

  const x0 = cx - bw / 2;
  const y0 = cy - bh / 2;

  return (
    <g>
      <rect x={x0} y={y0} width={bw} height={bh} fill="#444" stroke="#666" strokeWidth="0.8" rx="1" />
      {/* Sheen */}
      <rect x={x0 + 2} y={y0 + 2} width={bw - 4} height={2} fill="white" opacity="0.15" rx="0.5" />

      <DimLine x1={x0} x2={x0 + bw} y={y0 - 10} label={`${width} mm`} />
      <DimLineV y1={y0} y2={y0 + bh} x={x0 + bw + 18} label={`${thickness} mm`} />

      <text x={cx} y={cy + 4} fontSize="8" fill="white" fontFamily="monospace" textAnchor="middle">
        Flat
      </text>
    </g>
  );
}

// ─── Round belt cross-section ─────────────────────────────────────────────────
function RoundBeltSection({ diameter, W, H }: { diameter: number; W: number; H: number }) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(diameter * 2.5, 40);

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#333" stroke="#555" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={r * 0.3} fill="none" stroke="#666" strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Diameter line */}
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#4a90d9" strokeWidth="0.6" strokeDasharray="3,2" />
      <text x={cx} y={cy + r + 16} fontSize="8" fill="#555" fontFamily="monospace" textAnchor="middle">
        ⌀{diameter} mm
      </text>
    </g>
  );
}

// ─── Dimension annotation helpers ─────────────────────────────────────────────
function DimLine({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mx = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#aaa" strokeWidth="0.6" />
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} stroke="#aaa" strokeWidth="0.6" />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke="#aaa" strokeWidth="0.6" />
      <text x={mx} y={y - 3} fontSize="7" fill="#888" fontFamily="monospace" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function DimLineV({ y1, y2, x, label }: { y1: number; y2: number; x: number; label: string }) {
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#aaa" strokeWidth="0.6" />
      <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} stroke="#aaa" strokeWidth="0.6" />
      <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} stroke="#aaa" strokeWidth="0.6" />
      <text x={x + 4} y={my + 3} fontSize="7" fill="#888" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}
