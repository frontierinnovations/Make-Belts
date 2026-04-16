/**
 * BeltControls — Sidebar control panel for belt drive parameters
 *
 * Style: Clean utilitarian matching Make-Gears exactly.
 * NumericField with +/- buttons, section headers, collapsible groups.
 */
import { useState, useMemo } from "react";
import { useRepeatButton } from "@/hooks/useRepeatButton";
import {
  type PulleyParams,
  type BeltSystemParams,
  type BeltGeometry,
  type BeltWarning,
  type VBeltSection,
  type TimingProfile,
  computePulleyGeometry,
  computeBeltGeometry,
  validateBeltSystem,
  computeAdvancedOutputs,
  V_BELT_SECTIONS,
  TIMING_PROFILES,
  PULLEY_COLORS,
  exportBeltSystemToSvg,
  exportBeltSystemToDxf,
  downloadSvg,
  downloadDxf,
} from "@/lib/beltMath";
import {
  buildMcMasterLinks,
  findMatchingBelts,
  buildPulleyCatalogEntry,
} from "@/lib/beltCatalog";
import {
  generatePulleyStep,
  downloadStep,
  generatePulleyOpenSCAD,
  downloadOpenSCAD,
} from "@/lib/stepExport";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Download,
  ChevronDown,
  ChevronRight,
  Share2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  ShoppingCart,
  Box,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── NumericField ─────────────────────────────────────────────────────────────

function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
  disabled = false,
  readOnly = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const clamp = (v: number) => {
    const rounded = Math.round(v * 1000) / 1000;
    return Math.max(min, Math.min(max, rounded));
  };

  const decrement = () => onChange(clamp(value - step));
  const increment = () => onChange(clamp(value + step));

  const decRepeat = useRepeatButton(decrement);
  const incRepeat = useRepeatButton(increment);

  const display = step < 1 ? value.toFixed(2) : String(Math.round(value * 10) / 10);
  const isLocked = disabled || readOnly;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);

  const commitEdit = (draftVal: string) => {
    setEditing(false);
    const raw = draftVal.replace(suffix, "").trim();
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, Math.round(parsed * 1000) / 1000)));
    }
  };

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-gray-600 w-[140px] shrink-0">{label}:</span>
      <div className="flex items-center gap-1 flex-1">
        {editing && !isLocked ? (
          <input
            type="text"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEdit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setEditing(false); setDraft(display); }
              if (e.key === "ArrowUp") { e.preventDefault(); setDraft(String(Math.round((parseFloat(draft) || value) + step) * 1000 / 1000)); }
              if (e.key === "ArrowDown") { e.preventDefault(); setDraft(String(Math.round((parseFloat(draft) || value) - step) * 1000 / 1000)); }
            }}
            className="w-[90px] h-8 px-2 text-sm border border-blue-400 rounded text-center bg-white text-gray-800 outline-none ring-1 ring-blue-300"
          />
        ) : (
          <input
            type="text"
            value={`${display}${suffix ? " " + suffix : ""}`}
            readOnly
            onClick={() => { if (!isLocked) { setDraft(display); setEditing(true); } }}
            className={`w-[90px] h-8 px-2 text-sm border rounded text-center ${
              isLocked
                ? "bg-gray-50 border-gray-100 text-gray-400 cursor-default"
                : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-white hover:border-blue-300 cursor-text"
            }`}
            disabled={disabled}
          />
        )}
        {!readOnly && (
          <>
            <button
              onClick={decrement}
              {...decRepeat}
              disabled={disabled || value <= min}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 disabled:opacity-40 transition-colors select-none"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={increment}
              {...incRepeat}
              disabled={disabled || value >= max}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 disabled:opacity-40 transition-colors select-none"
            >
              <Plus size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm text-gray-600 w-[140px] shrink-0">{label}:</span>
      <input
        type="text"
        value={value}
        readOnly
        disabled
        className="w-[90px] h-8 px-2 text-sm bg-gray-50 border border-gray-100 rounded text-gray-500 text-center"
      />
    </div>
  );
}

function SectionHeader({
  title,
  collapsible = false,
  open = true,
  onToggle,
}: {
  title: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 pt-3 pb-1 border-b border-gray-200 mb-1 ${collapsible ? "cursor-pointer select-none" : ""}`}
      onClick={collapsible ? onToggle : undefined}
    >
      {collapsible && (open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />)}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BeltControlsProps {
  driver: PulleyParams;
  driven: PulleyParams;
  system: BeltSystemParams;
  selectedPulleyId: string | null;
  onSelectPulley: (id: string) => void;
  onUpdateDriver: (updates: Partial<PulleyParams>) => void;
  onUpdateDriven: (updates: Partial<PulleyParams>) => void;
  onUpdateSystem: (updates: Partial<BeltSystemParams>) => void;
  animating: boolean;
  onToggleAnimation: () => void;
  onResetView: () => void;
  onShareConfig: () => void;
  warnings: BeltWarning[];
  geo: BeltGeometry | null;
}

export default function BeltControls({
  driver,
  driven,
  system,
  selectedPulleyId,
  onSelectPulley,
  onUpdateDriver,
  onUpdateDriven,
  onUpdateSystem,
  animating,
  onToggleAnimation,
  onResetView,
  onShareConfig,
  warnings,
  geo,
}: BeltControlsProps) {
  const [showDisplay, setShowDisplay] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSourcing, setShowSourcing] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const selectedPulley = selectedPulleyId === driver.id ? driver : driven;
  const updateSelected = selectedPulleyId === driver.id ? onUpdateDriver : onUpdateDriven;

  const driverGeo = useMemo(() => computePulleyGeometry(driver, system), [driver, system]);
  const drivenGeo = useMemo(() => computePulleyGeometry(driven, system), [driven, system]);

  // Advanced outputs
  const advanced = useMemo(() => {
    if (!geo) return null;
    return computeAdvancedOutputs(driver, driven, system, geo);
  }, [driver, driven, system, geo]);

  // Catalog matches
  const catalogMatches = useMemo(() => {
    if (!geo) return [];
    return findMatchingBelts(system, geo, 5);
  }, [system, geo]);

  // McMaster links
  const mcLinks = useMemo(() => {
    if (!geo) return null;
    return buildMcMasterLinks(driver, driven, system, geo);
  }, [driver, driven, system, geo]);

  // Pulley catalog entries
  const driverCatalog = useMemo(() => buildPulleyCatalogEntry(driver, system), [driver, system]);
  const drivenCatalog = useMemo(() => buildPulleyCatalogEntry(driven, system), [driven, system]);

  const handleExportSvg = () => {
    if (!geo) return;
    const svg = exportBeltSystemToSvg(driver, driven, system, geo);
    downloadSvg(svg, `belt-drive-${system.beltType}.svg`);
    toast.success("SVG exported");
  };

  const handleExportDxf = () => {
    if (!geo) return;
    const dxf = exportBeltSystemToDxf(driver, driven, system, geo);
    downloadDxf(dxf, `belt-drive-${system.beltType}.dxf`);
    toast.success("DXF exported");
  };

  const handleExportDriverStep = () => {
    const step = generatePulleyStep(driver, system);
    downloadStep(step, `${driver.name || "driver"}-pulley`);
    toast.success("Driver STEP exported");
  };

  const handleExportDrivenStep = () => {
    const step = generatePulleyStep(driven, system);
    downloadStep(step, `${driven.name || "driven"}-pulley`);
    toast.success("Driven STEP exported");
  };

  const handleExportDriverScad = () => {
    const scad = generatePulleyOpenSCAD(driver, system);
    downloadOpenSCAD(scad, `${driver.name || "driver"}-pulley`);
    toast.success("Driver OpenSCAD exported");
  };

  const handleExportDrivenScad = () => {
    const scad = generatePulleyOpenSCAD(driven, system);
    downloadOpenSCAD(scad, `${driven.name || "driven"}-pulley`);
    toast.success("Driven OpenSCAD exported");
  };

  const errorCount = warnings.filter((w) => w.severity === "error").length;
  const warnCount = warnings.filter((w) => w.severity === "warning").length;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-800 leading-tight">Make Belts</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Parametric Belt Drive Generator</p>
          </div>
          <div className="flex items-center gap-1">
            {errorCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                <XCircle size={9} /> {errorCount}
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <AlertTriangle size={9} /> {warnCount}
              </span>
            )}
            {errorCount === 0 && warnCount === 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                <CheckCircle2 size={9} /> OK
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">

        {/* Animation controls */}
        <div className="flex items-center gap-2 pt-2 pb-2 border-b border-gray-100">
          <button
            onClick={onToggleAnimation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              animating
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {animating ? <Pause size={12} /> : <Play size={12} />}
            {animating ? "Pause" : "Animate"}
          </button>
          <button
            onClick={onResetView}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Reset view"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={onShareConfig}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors ml-auto"
            title="Share configuration"
          >
            <Share2 size={12} />
          </button>
        </div>

        {/* Animation speed */}
        {animating && (
          <div className="flex items-center gap-2 py-1.5">
            <span className="text-xs text-gray-500 w-[140px] shrink-0">Speed:</span>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={system.animationSpeed}
              onChange={(e) => onUpdateSystem({ animationSpeed: parseFloat(e.target.value) })}
              className="flex-1 h-1.5 accent-blue-600"
            />
            <span className="text-xs text-gray-500 w-8 text-right">{system.animationSpeed.toFixed(1)}×</span>
          </div>
        )}

        {/* Belt Type */}
        <SectionHeader title="Belt System" />

        <div className="flex items-center gap-2 py-1">
          <span className="text-sm text-gray-600 w-[140px] shrink-0">Belt type:</span>
          <Select
            value={system.beltType}
            onValueChange={(v) => onUpdateSystem({ beltType: v as typeof system.beltType })}
          >
            <SelectTrigger className="h-8 text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat Belt</SelectItem>
              <SelectItem value="vbelt">V-Belt</SelectItem>
              <SelectItem value="timing">Timing Belt</SelectItem>
              <SelectItem value="round">Round Belt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 py-1">
          <span className="text-sm text-gray-600 w-[140px] shrink-0">Configuration:</span>
          <Select
            value={system.beltConfig}
            onValueChange={(v) => onUpdateSystem({ beltConfig: v as typeof system.beltConfig })}
          >
            <SelectTrigger className="h-8 text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open Belt</SelectItem>
              <SelectItem value="crossed">Crossed Belt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* V-Belt section selector */}
        {system.beltType === "vbelt" && (
          <>
            <div className="flex items-center gap-2 py-1">
              <span className="text-sm text-gray-600 w-[140px] shrink-0">Section:</span>
              <Select
                value={system.vbeltSection}
                onValueChange={(v) => onUpdateSystem({ vbeltSection: v as VBeltSection })}
              >
                <SelectTrigger className="h-8 text-sm flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(V_BELT_SECTIONS) as VBeltSection[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} — {V_BELT_SECTIONS[s].topWidth}×{V_BELT_SECTIONS[s].height} mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumericField
              label="No. of belts"
              value={system.numBelts}
              onChange={(v) => onUpdateSystem({ numBelts: v })}
              min={1}
              max={8}
              step={1}
            />
          </>
        )}

        {/* Timing belt profile selector */}
        {system.beltType === "timing" && (
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-600 w-[140px] shrink-0">Profile:</span>
            <Select
              value={system.timingProfile}
              onValueChange={(v) => onUpdateSystem({ timingProfile: v as TimingProfile })}
            >
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIMING_PROFILES) as TimingProfile[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p} — {TIMING_PROFILES[p].pitch} mm pitch
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Flat belt thickness */}
        {system.beltType === "flat" && (
          <NumericField
            label="Belt thickness"
            value={system.flatBeltThickness}
            onChange={(v) => onUpdateSystem({ flatBeltThickness: v })}
            min={1}
            max={20}
            step={0.5}
            suffix="mm"
          />
        )}

        <NumericField
          label="Belt width"
          value={system.beltWidth}
          onChange={(v) => onUpdateSystem({ beltWidth: v })}
          min={5}
          max={500}
          step={5}
          suffix="mm"
        />

        {/* Friction coefficient (not for timing) */}
        {system.beltType !== "timing" && (
          <NumericField
            label="Friction coeff. μ"
            value={system.frictionCoeff}
            onChange={(v) => onUpdateSystem({ frictionCoeff: v })}
            min={0.1}
            max={0.8}
            step={0.05}
          />
        )}

        <NumericField
          label="Input power"
          value={system.inputPower}
          onChange={(v) => onUpdateSystem({ inputPower: v })}
          min={0}
          max={1000000}
          step={100}
          suffix="W"
        />
        <NumericField
          label="Belt mass"
          value={system.beltMassPerMeter}
          onChange={(v) => onUpdateSystem({ beltMassPerMeter: v })}
          min={0.01}
          max={5}
          step={0.05}
          suffix="kg/m"
        />

        {/* Pulley selector tabs */}
        <SectionHeader title="Pulleys" />

        <div className="flex gap-1 mb-2">
          {[driver, driven].map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPulley(p.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                selectedPulleyId === p.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-2 py-1">
          <span className="text-sm text-gray-600 w-[140px] shrink-0">Color:</span>
          <div className="flex gap-1 flex-wrap">
            {PULLEY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateSelected({ color: c })}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  selectedPulley.color === c ? "border-gray-700 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Pulley name */}
        <div className="flex items-center gap-2 py-1">
          <span className="text-sm text-gray-600 w-[140px] shrink-0">Name:</span>
          <input
            type="text"
            value={selectedPulley.name}
            onChange={(e) => updateSelected({ name: e.target.value })}
            className="flex-1 h-8 px-2 text-sm bg-gray-100 border border-gray-200 rounded text-gray-800 hover:bg-white hover:border-blue-300 focus:outline-none focus:border-blue-400 focus:bg-white"
            maxLength={20}
          />
        </div>

        {/* Pulley diameter / teeth */}
        {system.beltType === "timing" ? (
          <NumericField
            label="Teeth"
            value={selectedPulley.timingTeeth}
            onChange={(v) => updateSelected({ timingTeeth: v })}
            min={TIMING_PROFILES[system.timingProfile].minTeeth}
            max={200}
            step={1}
          />
        ) : (
          <NumericField
            label="Diameter"
            value={selectedPulley.diameter}
            onChange={(v) => updateSelected({ diameter: v })}
            min={10}
            max={2000}
            step={5}
            suffix="mm"
          />
        )}

        {/* Computed pitch diameter for timing belt */}
        {system.beltType === "timing" && (
          <ReadOnlyField
            label="Pitch diameter"
            value={`${(selectedPulley.timingTeeth * TIMING_PROFILES[system.timingProfile].pitch / Math.PI).toFixed(2)} mm`}
          />
        )}

        {/* Driver RPM */}
        {selectedPulleyId === driver.id && (
          <NumericField
            label="Input RPM"
            value={driver.rpm}
            onChange={(v) => onUpdateDriver({ rpm: v })}
            min={1}
            max={50000}
            step={10}
            suffix="RPM"
          />
        )}

        {/* Driven RPM (read-only) */}
        {selectedPulleyId === driven.id && geo && (
          <ReadOnlyField
            label="Output RPM"
            value={`${geo.outputRpm.toFixed(1)} RPM`}
          />
        )}

        <NumericField
          label="Bore diameter"
          value={selectedPulley.bore}
          onChange={(v) => updateSelected({ bore: v })}
          min={0}
          max={selectedPulleyId === driver.id ? driverGeo.pitchDiameter * 0.8 : drivenGeo.pitchDiameter * 0.8}
          step={1}
          suffix="mm"
        />

        <NumericField
          label="Spokes"
          value={selectedPulley.spokes}
          onChange={(v) => updateSelected({ spokes: v })}
          min={0}
          max={12}
          step={1}
        />

        {/* Position */}
        <SectionHeader title="Position" />
        <NumericField
          label="Center X"
          value={selectedPulley.centerX}
          onChange={(v) => updateSelected({ centerX: v })}
          min={-2000}
          max={2000}
          step={5}
          suffix="mm"
        />
        <NumericField
          label="Center Y"
          value={selectedPulley.centerY}
          onChange={(v) => updateSelected({ centerY: v })}
          min={-2000}
          max={2000}
          step={5}
          suffix="mm"
        />

        {/* Computed Results */}
        <SectionHeader
          title="Results"
          collapsible
          open={showResults}
          onToggle={() => setShowResults((v) => !v)}
        />
        {showResults && geo && (
          <div className="space-y-0.5">
            <ReadOnlyField label="Center distance" value={`${geo.centerDistance.toFixed(1)} mm`} />
            <ReadOnlyField label="Speed ratio" value={`${geo.speedRatio.toFixed(3)}:1`} />
            <ReadOnlyField label="Output RPM" value={`${geo.outputRpm.toFixed(1)} RPM`} />
            <ReadOnlyField label="Belt speed" value={`${geo.beltSpeed.toFixed(2)} m/s`} />
            {system.beltType === "timing" ? (
              <>
                <ReadOnlyField label="Belt length" value={`${geo.actualBeltLength.toFixed(0)} mm`} />
                <ReadOnlyField label="Belt teeth" value={`${geo.beltTeeth} teeth`} />
                <ReadOnlyField label="Actual C" value={`${geo.actualCenterDistance.toFixed(1)} mm`} />
              </>
            ) : (
              <ReadOnlyField label="Belt length" value={`${geo.beltLength.toFixed(1)} mm`} />
            )}
            <ReadOnlyField label="Wrap angle (sm)" value={`${((geo.wrapAngleSmall * 180) / Math.PI).toFixed(1)}°`} />
            <ReadOnlyField label="Wrap angle (lg)" value={`${((geo.wrapAngleLarge * 180) / Math.PI).toFixed(1)}°`} />
            <ReadOnlyField label="Tight tension" value={`${geo.tightSideTension.toFixed(1)} N`} />
            <ReadOnlyField label="Slack tension" value={`${geo.slackSideTension.toFixed(1)} N`} />
            <ReadOnlyField label="Eff. tension" value={`${geo.effectiveTension.toFixed(1)} N`} />
            <ReadOnlyField label="Centrifugal F" value={`${geo.centrifugalForce.toFixed(1)} N`} />
            <ReadOnlyField label="Initial tension" value={`${geo.initialTension.toFixed(1)} N`} />
            <ReadOnlyField label="Shaft load" value={`${geo.shaftLoad.toFixed(1)} N`} />
            <ReadOnlyField label="Driver torque" value={`${geo.driverTorque.toFixed(2)} N·m`} />
            <ReadOnlyField label="Driven torque" value={`${geo.drivenTorque.toFixed(2)} N·m`} />
            <ReadOnlyField label="Efficiency" value={`${(geo.efficiency * 100).toFixed(1)}%`} />
            <ReadOnlyField label="Power out" value={`${(geo.transmittedPower / 1000).toFixed(3)} kW`} />
          </div>
        )}

        {/* Advanced Outputs */}
        <SectionHeader
          title="Advanced Outputs"
          collapsible
          open={showAdvanced}
          onToggle={() => setShowAdvanced((v) => !v)}
        />
        {showAdvanced && advanced && geo && (
          <div className="space-y-0.5">
            {/* Key limits summary — prominently shown */}
            <div className="grid grid-cols-2 gap-1 pt-1 pb-2">
              <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Max Torque (driver)</div>
                <div className="text-sm font-bold text-blue-800 mt-0.5">{advanced.maxDriverTorque.toFixed(2)} <span className="text-xs font-normal">N·m</span></div>
              </div>
              <div className="rounded border border-orange-100 bg-orange-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">Max Torque (driven)</div>
                <div className="text-sm font-bold text-orange-800 mt-0.5">{advanced.maxDrivenTorque.toFixed(2)} <span className="text-xs font-normal">N·m</span></div>
              </div>
              <div className="rounded border border-green-100 bg-green-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Max Belt Speed</div>
                <div className="text-sm font-bold text-green-800 mt-0.5">{advanced.maxBeltSpeed.toFixed(0)} <span className="text-xs font-normal">m/s</span></div>
              </div>
              <div className="rounded border border-purple-100 bg-purple-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-purple-500 font-semibold uppercase tracking-wide">Max Power</div>
                <div className="text-sm font-bold text-purple-800 mt-0.5">{(advanced.maxPower / 1000).toFixed(2)} <span className="text-xs font-normal">kW</span></div>
              </div>
            </div>
            {/* Strength & Capacity */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-1 pb-0.5">Strength &amp; Capacity</div>
            <ReadOnlyField label="Max power" value={`${(advanced.maxPower / 1000).toFixed(2)} kW`} />
            <ReadOnlyField label="Safety factor" value={`${advanced.safetyFactor.toFixed(2)}×`} />
            <ReadOnlyField label="Max driver τ" value={`${advanced.maxDriverTorque.toFixed(2)} N·m`} />
            <ReadOnlyField label="Max driven τ" value={`${advanced.maxDrivenTorque.toFixed(2)} N·m`} />
            <ReadOnlyField label="Tight stress" value={`${advanced.tightSideStress.toFixed(2)} MPa`} />
            {/* Center Distance */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">Center Distance Range</div>
            <ReadOnlyField label="C min" value={`${advanced.centerDistanceMin.toFixed(1)} mm`} />
            <ReadOnlyField label="C max" value={`${advanced.centerDistanceMax.toFixed(1)} mm`} />
            {/* Tensioning */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">Tensioning Guide</div>
            <ReadOnlyField label="Belt sag" value={`${advanced.beltSag.toFixed(2)} mm`} />
            <ReadOnlyField label="Deflection" value={`${advanced.recommendedDeflection.toFixed(1)} mm`} />
            <ReadOnlyField label="Defl. force min" value={`${advanced.deflectionForceMin.toFixed(1)} N`} />
            <ReadOnlyField label="Defl. force max" value={`${advanced.deflectionForceMax.toFixed(1)} N`} />
            {/* Life & Performance */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">Life &amp; Performance</div>
            <ReadOnlyField label="Fatigue life" value={advanced.fatigueLifeHours > 50000 ? ">50,000 hr" : `${advanced.fatigueLifeHours.toFixed(0)} hr`} />
            <ReadOnlyField label="Belt passes/hr" value={`${advanced.beltPassesPerHour.toFixed(0)}`} />
            <ReadOnlyField label="Specific power" value={`${advanced.specificPower.toFixed(1)} W/mm`} />
            <ReadOnlyField label="Driver v_s" value={`${advanced.driverSurfaceSpeed.toFixed(2)} m/s`} />
            <ReadOnlyField label="Driven v_s" value={`${advanced.drivenSurfaceSpeed.toFixed(2)} m/s`} />
            {/* Max speed limits */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">Speed Limits</div>
            <ReadOnlyField label="Max belt speed" value={`${advanced.maxBeltSpeed.toFixed(0)} m/s`} />
            <ReadOnlyField label="Max driver RPM" value={`${advanced.maxDriverRpm.toFixed(0)} RPM`} />
            <ReadOnlyField label="Max driven RPM" value={`${advanced.maxDrivenRpm.toFixed(0)} RPM`} />
            {/* Belt speed utilisation bar */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>Belt speed utilisation</span>
                <span className={`font-semibold ${
                  geo.beltSpeed / advanced.maxBeltSpeed >= 0.9 ? "text-red-600" :
                  geo.beltSpeed / advanced.maxBeltSpeed >= 0.7 ? "text-amber-600" : "text-green-600"
                }`}>
                  {((geo.beltSpeed / advanced.maxBeltSpeed) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    geo.beltSpeed / advanced.maxBeltSpeed >= 0.9 ? "bg-red-500" :
                    geo.beltSpeed / advanced.maxBeltSpeed >= 0.7 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (geo.beltSpeed / advanced.maxBeltSpeed) * 100)}%` }}
                />
              </div>
            </div>
            {/* Safety factor color bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>Safety factor: {advanced.safetyFactor.toFixed(2)}×</span>
                <span className={`font-semibold ${
                  advanced.safetyFactor >= 2 ? "text-green-600" :
                  advanced.safetyFactor >= 1.2 ? "text-amber-600" : "text-red-600"
                }`}>
                  {advanced.safetyFactor >= 2 ? "SAFE" : advanced.safetyFactor >= 1.2 ? "MARGINAL" : "OVERLOADED"}
                </span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    advanced.safetyFactor >= 2 ? "bg-green-500" :
                    advanced.safetyFactor >= 1.2 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(100, (advanced.safetyFactor / 3) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {showAdvanced && !advanced && (
          <p className="text-xs text-gray-400 py-1">No data — configure the belt system first.</p>
        )}

        {/* Belt Catalog */}
        <SectionHeader
          title="Belt Catalog"
          collapsible
          open={showCatalog}
          onToggle={() => setShowCatalog((v) => !v)}
        />
        {showCatalog && (
          <div className="space-y-1 pt-1">
            {catalogMatches.length > 0 ? (
              <>
                <p className="text-[10px] text-gray-400 pb-1">Closest standard belts to computed length ({geo ? geo.actualBeltLength.toFixed(0) : "—"} mm):</p>
                {catalogMatches.map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded border px-2 py-1.5 text-xs ${
                      i === 0
                        ? "bg-blue-50 border-blue-200 text-blue-800"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{entry.partNumber}</span>
                      <span className="text-[10px] text-gray-500">{entry.delta < 1 ? "exact" : `±${entry.delta.toFixed(0)} mm`}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{entry.nominalLength.toFixed(0)} mm pitch length</div>
                    <a
                      href={entry.mcmasterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-0.5"
                    >
                      <ShoppingCart size={9} /> McMaster-Carr
                      <ExternalLink size={8} />
                    </a>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-xs text-gray-400 py-1">No catalog data for this belt type.</p>
            )}
          </div>
        )}

        {/* Sourcing */}
        <SectionHeader
          title="Sourcing"
          collapsible
          open={showSourcing}
          onToggle={() => setShowSourcing((v) => !v)}
        />
        {showSourcing && mcLinks && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] text-gray-400">McMaster-Carr filtered search links for your drive configuration:</p>

            {/* Driver pulley */}
            <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                <Box size={9} /> Driver Pulley
              </div>
              <p className="text-xs text-gray-700 mb-1">{mcLinks.driverPulleyDesc}</p>
              <a
                href={mcLinks.driverPulley}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
              >
                <ShoppingCart size={11} /> Search McMaster-Carr
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Driven pulley */}
            <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                <Box size={9} /> Driven Pulley
              </div>
              <p className="text-xs text-gray-700 mb-1">{mcLinks.drivenPulleyDesc}</p>
              <a
                href={mcLinks.drivenPulley}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
              >
                <ShoppingCart size={11} /> Search McMaster-Carr
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Belt */}
            <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                <Zap size={9} /> Belt
              </div>
              <p className="text-xs text-gray-700 mb-1">{mcLinks.beltDesc}</p>
              <a
                href={mcLinks.belt}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
              >
                <ShoppingCart size={11} /> Search McMaster-Carr
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Pulley specs */}
            <div className="text-[10px] text-gray-400 pt-1 space-y-0.5">
              <p><span className="font-semibold">Driver:</span> {driverCatalog.pitchDiameter}, bore {driverCatalog.bore}</p>
              <p><span className="font-semibold">Driven:</span> {drivenCatalog.pitchDiameter}, bore {drivenCatalog.bore}</p>
              {driverCatalog.notes && <p className="text-gray-300">{driverCatalog.notes}</p>}
            </div>
          </div>
        )}
        {showSourcing && !mcLinks && (
          <p className="text-xs text-gray-400 py-1">Configure the belt system to see sourcing links.</p>
        )}

        {/* Display Options */}
        <SectionHeader
          title="Display"
          collapsible
          open={showDisplay}
          onToggle={() => setShowDisplay((v) => !v)}
        />
        {showDisplay && (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-0.5">
              <Label htmlFor="show-grid" className="text-sm text-gray-600 cursor-pointer">Grid</Label>
              <Switch
                id="show-grid"
                checked={system.showGrid}
                onCheckedChange={(v) => onUpdateSystem({ showGrid: v })}
              />
            </div>
            <div className="flex items-center justify-between py-0.5">
              <Label htmlFor="show-guides" className="text-sm text-gray-600 cursor-pointer">Guide circles</Label>
              <Switch
                id="show-guides"
                checked={system.showGuides}
                onCheckedChange={(v) => onUpdateSystem({ showGuides: v })}
              />
            </div>
            <div className="flex items-center justify-between py-0.5">
              <Label htmlFor="show-labels" className="text-sm text-gray-600 cursor-pointer">Labels</Label>
              <Switch
                id="show-labels"
                checked={system.showLabels}
                onCheckedChange={(v) => onUpdateSystem({ showLabels: v })}
              />
            </div>
            <NumericField
              label="Scale"
              value={system.pixelsPerMm}
              onChange={(v) => onUpdateSystem({ pixelsPerMm: v })}
              min={0.5}
              max={20}
              step={0.5}
              suffix="px/mm"
            />
          </div>
        )}

        {/* Export */}
        <SectionHeader
          title="Export"
          collapsible
          open={showExport}
          onToggle={() => setShowExport((v) => !v)}
        />
        {showExport && (
          <div className="flex flex-col gap-2 pt-1">
            {/* 2D Exports */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">2D Drawing</div>
            <button
              onClick={handleExportSvg}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-sm text-gray-700 transition-colors"
            >
              <Download size={13} />
              Export SVG (full drive)
            </button>
            <button
              onClick={handleExportDxf}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-sm text-gray-700 transition-colors"
            >
              <Download size={13} />
              Export DXF (full drive)
            </button>

            {/* 3D Exports */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-1">3D Pulley Models</div>
            <div className="text-[10px] text-gray-400 -mt-1">STEP (AP203) for CAD import; OpenSCAD for parametric editing &amp; STL export</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={handleExportDriverStep}
                className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-700 transition-colors"
              >
                <Download size={11} />
                Driver .STP
              </button>
              <button
                onClick={handleExportDrivenStep}
                className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-700 transition-colors"
              >
                <Download size={11} />
                Driven .STP
              </button>
              <button
                onClick={handleExportDriverScad}
                className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-700 transition-colors"
              >
                <Download size={11} />
                Driver .SCAD
              </button>
              <button
                onClick={handleExportDrivenScad}
                className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-700 transition-colors"
              >
                <Download size={11} />
                Driven .SCAD
              </button>
            </div>
            <div className="text-[10px] text-gray-400 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
              <span className="font-semibold text-blue-600">Tip:</span> Open .SCAD in OpenSCAD → Export → STL/STEP for full solid geometry. The STEP file contains surface definitions and key dimensions.
            </div>
          </div>
        )}

        {/* About */}
        <SectionHeader title="About" />
        <div className="text-xs text-gray-400 pb-2 space-y-1">
          <p>Make Belts v1.0 — Parametric Belt Drive Generator</p>
          <p>Supports flat, V-belt, timing, and round belt drives.</p>
          <p>Formulas: Euler belt equation, ISO 22, ISO 5294, Shigley's Ch.17</p>
          <p className="pt-1">
            <a
              href="https://github.com/frontierinnovations/Make-Gears"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Related: Make-Gears
            </a>
          </p>
        </div>

        {/* Validation warnings list */}
        {warnings.length > 0 && (
          <>
            <SectionHeader title="Validation" />
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 rounded px-2 py-1.5 text-xs ${
                    w.severity === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : w.severity === "warning"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {w.severity === "error" ? (
                    <XCircle size={11} className="mt-0.5 shrink-0" />
                  ) : w.severity === "warning" ? (
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  ) : (
                    <Info size={11} className="mt-0.5 shrink-0" />
                  )}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
