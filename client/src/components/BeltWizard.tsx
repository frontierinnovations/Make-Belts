/**
 * BeltWizard — Belt selection wizard
 *
 * Given input power (W), driver RPM, speed ratio, and approximate center distance,
 * recommends the best belt type and section using standard power rating tables
 * (Shigley's Ch.17, Gates engineering manual, ISO 22/5294).
 *
 * Style: Clean utilitarian matching Make-Gears / BeltControls.
 */
import { useState, useMemo } from "react";
import {
  type BeltType,
  type VBeltSection,
  type TimingProfile,
  V_BELT_SECTIONS,
  TIMING_PROFILES,
} from "@/lib/beltMath";
import { Zap, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Info } from "lucide-react";

// ─── Power rating tables ──────────────────────────────────────────────────────
// V-belt base power ratings (kW) per belt at reference conditions:
//   Small pulley d_min, 1450 RPM, open belt, flat correction factors = 1.0
// Source: Gates Rubber Co. engineering manual & Shigley's Table 17-12
const V_BELT_BASE_POWER: Record<VBeltSection, { rpm: number[]; kw: number[] }> = {
  Z:   { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.04,0.07,0.12,0.19,0.24,0.31,0.35,0.37] },
  A:   { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.10,0.18,0.31,0.50,0.63,0.80,0.88,0.90] },
  B:   { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.20,0.36,0.63,1.00,1.27,1.60,1.75,1.78] },
  C:   { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.50,0.90,1.60,2.50,3.20,4.00,4.40,4.50] },
  D:   { rpm: [200,400,800,1450,2000,3000],           kw: [1.50,2.70,4.80,7.50,9.50,12.0] },
  E:   { rpm: [200,400,800,1450,2000,3000],           kw: [3.00,5.40,9.60,15.0,19.0,24.0] },
  SPZ: { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.12,0.22,0.38,0.60,0.76,0.96,1.05,1.07] },
  SPA: { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.28,0.50,0.88,1.40,1.78,2.24,2.46,2.50] },
  SPB: { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [0.60,1.08,1.90,3.00,3.81,4.80,5.25,5.34] },
  SPC: { rpm: [200,400,800,1450,2000,3000,4000,5000], kw: [1.50,2.70,4.75,7.50,9.50,12.0,13.1,13.3] },
};

// Timing belt max power per 10mm width (kW) at reference conditions
// Source: Gates HTD/GT catalog, approximate
const TIMING_BASE_POWER_PER_10MM: Record<TimingProfile, { rpm: number[]; kw: number[] }> = {
  GT2:    { rpm: [500,1000,3000,6000,10000], kw: [0.005,0.009,0.020,0.030,0.035] },
  GT3:    { rpm: [500,1000,3000,6000,10000], kw: [0.020,0.038,0.085,0.130,0.150] },
  HTD3M:  { rpm: [500,1000,3000,6000,10000], kw: [0.018,0.034,0.076,0.115,0.135] },
  HTD5M:  { rpm: [500,1000,3000,5000,8000],  kw: [0.10, 0.18, 0.40, 0.55, 0.70]  },
  GT5:    { rpm: [500,1000,3000,5000,8000],  kw: [0.11, 0.20, 0.44, 0.60, 0.76]  },
  HTD8M:  { rpm: [200,500,1000,3000,5000],   kw: [0.30, 0.65, 1.10, 2.20, 3.00]  },
  HTD14M: { rpm: [200,500,1000,3000],        kw: [1.20, 2.60, 4.40, 8.80]        },
  T5:     { rpm: [500,1000,3000,6000,10000], kw: [0.008,0.014,0.030,0.045,0.052] },
  T10:    { rpm: [500,1000,3000,5000,8000],  kw: [0.04, 0.07, 0.15, 0.20, 0.26]  },
  AT5:    { rpm: [500,1000,3000,6000,10000], kw: [0.010,0.018,0.040,0.060,0.070] },
  AT10:   { rpm: [500,1000,3000,5000,8000],  kw: [0.05, 0.09, 0.20, 0.27, 0.35]  },
};

// ─── Interpolation helper ─────────────────────────────────────────────────────
function interpolate(rpm: number, rpmArr: number[], kwArr: number[]): number {
  if (rpm <= rpmArr[0]) return kwArr[0] * (rpm / rpmArr[0]);
  if (rpm >= rpmArr[rpmArr.length - 1]) return kwArr[kwArr.length - 1];
  for (let i = 0; i < rpmArr.length - 1; i++) {
    if (rpm >= rpmArr[i] && rpm <= rpmArr[i + 1]) {
      const t = (rpm - rpmArr[i]) / (rpmArr[i + 1] - rpmArr[i]);
      return kwArr[i] + t * (kwArr[i + 1] - kwArr[i]);
    }
  }
  return kwArr[kwArr.length - 1];
}

// ─── Correction factors ───────────────────────────────────────────────────────
// Wrap angle correction factor Cθ for V-belts
function wrapCorrectionFactor(wrapDeg: number): number {
  // Shigley's Table 17-13
  if (wrapDeg >= 180) return 1.0;
  if (wrapDeg >= 170) return 0.98;
  if (wrapDeg >= 160) return 0.95;
  if (wrapDeg >= 150) return 0.92;
  if (wrapDeg >= 140) return 0.89;
  if (wrapDeg >= 130) return 0.86;
  if (wrapDeg >= 120) return 0.82;
  return 0.78;
}

// Service factor Ks (accounts for load type)
function serviceFactor(serviceClass: "light" | "medium" | "heavy"): number {
  return serviceClass === "light" ? 1.0 : serviceClass === "medium" ? 1.3 : 1.6;
}

// ─── Recommendation types ─────────────────────────────────────────────────────
export interface BeltRecommendation {
  beltType: BeltType;
  section?: VBeltSection;
  timingProfile?: TimingProfile;
  numBelts: number;
  powerPerBelt: number;   // kW
  powerCapacity: number;  // kW total
  utilizationPct: number; // %
  score: number;          // 0–100
  pros: string[];
  cons: string[];
  label: string;
  suitable: boolean;
}

// ─── Main wizard function ─────────────────────────────────────────────────────
export function runBeltWizard(
  powerW: number,
  driverRpm: number,
  speedRatio: number,
  centerDistanceMm: number,
  serviceClass: "light" | "medium" | "heavy"
): BeltRecommendation[] {
  const powerKw = powerW / 1000;
  const ks = serviceFactor(serviceClass);
  const designPower = powerKw * ks;

  // Estimate wrap angle on small pulley (approximate, open belt)
  const wrapDeg = 180 - 60 * (speedRatio - 1) / (centerDistanceMm / 100 + 1);
  const wrapCf = wrapCorrectionFactor(Math.max(90, wrapDeg));

  const recommendations: BeltRecommendation[] = [];

  // ── V-belt sections ─────────────────────────────────────────────────────────
  for (const section of Object.keys(V_BELT_SECTIONS) as VBeltSection[]) {
    const table = V_BELT_BASE_POWER[section];
    const basePowerPerBelt = interpolate(driverRpm, table.rpm, table.kw) * wrapCf;
    if (basePowerPerBelt <= 0) continue;

    const numBelts = Math.ceil(designPower / basePowerPerBelt);
    const totalCapacity = numBelts * basePowerPerBelt;
    const utilization = (designPower / totalCapacity) * 100;

    const pros: string[] = [];
    const cons: string[] = [];

    if (numBelts <= 2) pros.push("Compact — 1–2 belts");
    if (numBelts > 4) cons.push(`Requires ${numBelts} belts`);
    if (section.startsWith("SP")) pros.push("Narrow profile, higher speed rating");
    if (["D", "E"].includes(section)) cons.push("Large cross-section, heavy duty only");
    if (utilization < 60) cons.push("Over-specified (low utilisation)");
    if (utilization > 90) pros.push("Efficient use of belt capacity");

    // Score: prefer 1–2 belts, 70–90% utilisation, appropriate section for power
    let score = 100;
    score -= Math.abs(numBelts - 1) * 10;
    score -= Math.abs(utilization - 80) * 0.3;
    if (numBelts > 4) score -= 30;
    if (numBelts > 6) score -= 30;

    recommendations.push({
      beltType: "vbelt",
      section,
      numBelts,
      powerPerBelt: basePowerPerBelt,
      powerCapacity: totalCapacity,
      utilizationPct: utilization,
      score: Math.max(0, Math.min(100, score)),
      pros,
      cons,
      label: `V-Belt ${section}`,
      suitable: numBelts <= 6 && basePowerPerBelt > 0,
    });
  }

  // ── Timing belts ────────────────────────────────────────────────────────────
  const typicalWidthMm = 15; // assume 15mm width for comparison
  for (const profile of Object.keys(TIMING_PROFILES) as TimingProfile[]) {
    const table = TIMING_BASE_POWER_PER_10MM[profile];
    const powerPer10mm = interpolate(driverRpm, table.rpm, table.kw);
    const totalCapacity = (powerPer10mm * typicalWidthMm) / 10;
    const utilization = (designPower / totalCapacity) * 100;

    const pros: string[] = [];
    const cons: string[] = [];

    pros.push("No slip — synchronous drive");
    if (profile.startsWith("GT")) pros.push("Low noise, high efficiency");
    if (profile.startsWith("HTD")) pros.push("High torque capacity");
    if (utilization > 100) cons.push(`Needs wider belt (>${Math.ceil(typicalWidthMm * utilization / 100)} mm)`);
    if (utilization < 40) cons.push("Over-specified for this power");
    if (TIMING_PROFILES[profile].pitch >= 8) pros.push("Heavy industrial rating");
    if (TIMING_PROFILES[profile].pitch <= 3) pros.push("Compact, low-inertia");

    let score = 80;
    score -= Math.abs(utilization - 75) * 0.3;
    if (utilization > 100) score -= 20;
    if (utilization > 150) score -= 40;

    recommendations.push({
      beltType: "timing",
      timingProfile: profile,
      numBelts: 1,
      powerPerBelt: totalCapacity,
      powerCapacity: totalCapacity,
      utilizationPct: utilization,
      score: Math.max(0, Math.min(100, score)),
      pros,
      cons,
      label: `Timing ${profile}`,
      suitable: utilization <= 150,
    });
  }

  // ── Flat belt ───────────────────────────────────────────────────────────────
  const flatCapacity = 0.5 * (powerKw + 1); // rough estimate
  recommendations.push({
    beltType: "flat",
    numBelts: 1,
    powerPerBelt: flatCapacity,
    powerCapacity: flatCapacity,
    utilizationPct: (designPower / flatCapacity) * 100,
    score: 40,
    pros: ["Simple, low cost", "High speed capable"],
    cons: ["Slip possible", "Requires precise tensioning"],
    label: "Flat Belt",
    suitable: true,
  });

  // Sort by score descending, suitable first
  return recommendations
    .filter((r) => r.suitable)
    .sort((a, b) => b.score - a.score);
}

// ─── Component ────────────────────────────────────────────────────────────────
interface BeltWizardProps {
  currentPowerW: number;
  currentRpm: number;
  currentRatio: number;
  currentCenterMm: number;
  onApply: (beltType: BeltType, section?: VBeltSection, timingProfile?: TimingProfile, numBelts?: number) => void;
}

export default function BeltWizard({
  currentPowerW,
  currentRpm,
  currentRatio,
  currentCenterMm,
  onApply,
}: BeltWizardProps) {
  const [open, setOpen] = useState(false);
  const [powerW, setPowerW] = useState(currentPowerW);
  const [rpm, setRpm] = useState(currentRpm);
  const [ratio, setRatio] = useState(currentRatio);
  const [centerMm, setCenterMm] = useState(currentCenterMm);
  const [service, setService] = useState<"light" | "medium" | "heavy">("medium");
  const [showAll, setShowAll] = useState(false);

  const recommendations = useMemo(
    () => runBeltWizard(powerW, rpm, ratio, centerMm, service),
    [powerW, rpm, ratio, centerMm, service]
  );

  const displayed = showAll ? recommendations : recommendations.slice(0, 5);

  return (
    <div className="border-t border-gray-200">
      <div
        className="flex items-center gap-1 pt-3 pb-1 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        <Zap size={12} className="text-amber-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Belt Wizard</span>
        <span className="ml-auto text-[10px] text-gray-400">Auto-select</span>
      </div>

      {open && (
        <div className="pb-3 space-y-3">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Power (W)</label>
              <input
                type="number"
                value={powerW}
                onChange={(e) => setPowerW(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
                min={1}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Driver RPM</label>
              <input
                type="number"
                value={rpm}
                onChange={(e) => setRpm(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
                min={1}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Speed ratio</label>
              <input
                type="number"
                value={ratio}
                onChange={(e) => setRatio(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
                min={1}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Center dist (mm)</label>
              <input
                type="number"
                value={centerMm}
                onChange={(e) => setCenterMm(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
                min={50}
              />
            </div>
          </div>

          {/* Service class */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Service class</label>
            <div className="flex gap-1">
              {(["light", "medium", "heavy"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setService(s)}
                  className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                    service === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-0.5">
              {service === "light" ? "Ks=1.0 — Fans, centrifugal pumps, light conveyors"
               : service === "medium" ? "Ks=1.3 — Compressors, machine tools, general industrial"
               : "Ks=1.6 — Heavy compressors, crushers, hoists, reversing drives"}
            </p>
          </div>

          {/* Sync from current */}
          <button
            onClick={() => {
              setPowerW(currentPowerW);
              setRpm(currentRpm);
              setRatio(currentRatio);
              setCenterMm(currentCenterMm);
            }}
            className="w-full text-[10px] text-blue-600 hover:text-blue-800 py-0.5 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
          >
            ↺ Sync from current configuration
          </button>

          {/* Results */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-400 font-medium">
              Design power: {((powerW / 1000) * serviceFactor(service)).toFixed(2)} kW
              (Ks={serviceFactor(service).toFixed(1)})
            </p>
            {displayed.map((rec, i) => (
              <RecommendationCard key={`${rec.beltType}-${rec.section ?? rec.timingProfile ?? i}`} rec={rec} rank={i + 1} onApply={onApply} />
            ))}
            {recommendations.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full text-[10px] text-gray-500 hover:text-gray-700 py-1"
              >
                {showAll ? "Show top 5 only ▲" : `Show all ${recommendations.length} options ▼`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────
function RecommendationCard({
  rec,
  rank,
  onApply,
}: {
  rec: BeltRecommendation;
  rank: number;
  onApply: BeltWizardProps["onApply"];
}) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor =
    rec.score >= 75 ? "text-green-600 bg-green-50 border-green-200" :
    rec.score >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
                     "text-gray-500 bg-gray-50 border-gray-200";

  const utilColor =
    rec.utilizationPct > 100 ? "bg-red-500" :
    rec.utilizationPct > 80  ? "bg-amber-500" : "bg-green-500";

  return (
    <div className={`border rounded text-xs overflow-hidden ${rank === 1 ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white"}`}>
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border ${scoreColor}`}>
          {rank}
        </span>
        <span className="font-medium text-gray-800 flex-1">{rec.label}</span>
        {rec.numBelts > 1 && (
          <span className="text-[9px] text-gray-500">×{rec.numBelts}</span>
        )}
        <span className={`text-[9px] font-semibold px-1 rounded ${scoreColor}`}>
          {rec.score.toFixed(0)}
        </span>
        {expanded ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-100">
          {/* Utilisation bar */}
          <div className="pt-1">
            <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
              <span>Capacity utilisation</span>
              <span className={rec.utilizationPct > 100 ? "text-red-600 font-semibold" : "text-gray-600"}>
                {rec.utilizationPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded transition-all ${utilColor}`}
                style={{ width: `${Math.min(100, rec.utilizationPct)}%` }}
              />
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">
              Capacity: {rec.powerCapacity.toFixed(2)} kW
              {rec.numBelts > 1 ? ` (${rec.numBelts} × ${rec.powerPerBelt.toFixed(2)} kW)` : ""}
            </div>
          </div>

          {/* Pros / Cons */}
          {rec.pros.length > 0 && (
            <div className="space-y-0.5">
              {rec.pros.map((p, i) => (
                <div key={i} className="flex items-start gap-1 text-[9px] text-green-700">
                  <CheckCircle2 size={9} className="mt-0.5 flex-shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          )}
          {rec.cons.length > 0 && (
            <div className="space-y-0.5">
              {rec.cons.map((c, i) => (
                <div key={i} className="flex items-start gap-1 text-[9px] text-amber-700">
                  <AlertTriangle size={9} className="mt-0.5 flex-shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Source note */}
          <div className="flex items-start gap-1 text-[9px] text-gray-400">
            <Info size={9} className="mt-0.5 flex-shrink-0" />
            <span>Power ratings: Gates catalog / Shigley's Ch.17</span>
          </div>

          {/* Apply button */}
          <button
            onClick={() => onApply(rec.beltType, rec.section, rec.timingProfile, rec.numBelts)}
            className="w-full text-[10px] bg-blue-600 text-white rounded py-1 hover:bg-blue-700 transition-colors font-medium"
          >
            Apply this selection →
          </button>
        </div>
      )}
    </div>
  );
}
