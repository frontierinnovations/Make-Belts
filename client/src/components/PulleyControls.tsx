/**
 * PulleyControls.tsx — Sidebar controls for the parametric pulley generator
 *
 * Design: Clean Utilitarian matching Make-Belts/Make-Gears
 * - Dark sidebar with section headers
 * - NumericField with +/- repeat buttons
 * - Collapsible sections
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown, ChevronRight, Download, AlertTriangle, Info,
  Layers, Settings, Cog, Printer, ExternalLink
} from "lucide-react";
import { useRepeatButton } from "@/hooks/useRepeatButton";
import type { PulleyParams, PulleyGeometry } from "@/lib/pulleyMath";
import { V_BELT_GROOVES, TIMING_GROOVES } from "@/lib/pulleyMath";
import { downloadPulleySTEP, downloadPulleyOpenSCAD } from "@/lib/pulleyStep";

// ─────────────────────────────────────────────
// NUMERIC FIELD
// ─────────────────────────────────────────────

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  decimals?: number;
  tooltip?: string;
}

function NumericField({ label, value, onChange, min = 0, max = 9999, step = 1, unit, decimals = 0, tooltip }: NumericFieldProps) {
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));

  const inc = useCallback(() => {
    onChange(Math.min(max, parseFloat((value + step).toFixed(decimals + 2))));
  }, [value, step, max, onChange, decimals]);

  const dec = useCallback(() => {
    onChange(Math.max(min, parseFloat((value - step).toFixed(decimals + 2))));
  }, [value, step, min, onChange, decimals]);

  const incBind = useRepeatButton(inc);
  const decBind = useRepeatButton(dec);

  const labelEl = tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider cursor-help flex items-center gap-1">
          {label} <Info className="w-2.5 h-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
  );

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      {labelEl}
      <div className="flex items-center gap-0">
        <button
          {...decBind}
          className="w-5 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-l text-xs font-mono border border-border select-none"
        >−</button>
        <div className="h-6 px-2 flex items-center justify-center bg-muted border-y border-border min-w-[52px] text-xs font-mono tabular-nums">
          {fmt(value)}{unit && <span className="text-muted-foreground ml-0.5 text-[10px]">{unit}</span>}
        </div>
        <button
          {...incBind}
          className="w-5 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-r text-xs font-mono border border-border select-none"
        >+</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────

function SectionHeader({ label, open, onToggle, icon }: { label: string; open: boolean; onToggle: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-1.5 px-0 text-left group"
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-primary">{icon}</span>}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">{label}</span>
      </div>
      {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ─────────────────────────────────────────────
// READ-ONLY FIELD
// ─────────────────────────────────────────────

function ReadOnlyField({ label, value, unit, highlight }: { label: string; value: string | number; unit?: string; highlight?: "ok" | "warn" | "error" }) {
  const color = highlight === "ok" ? "text-green-400" : highlight === "warn" ? "text-yellow-400" : highlight === "error" ? "text-red-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-mono tabular-nums ${color}`}>
        {typeof value === "number" ? value.toFixed(2) : value}
        {unit && <span className="text-muted-foreground ml-0.5 text-[10px]">{unit}</span>}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

interface PulleyControlsProps {
  params: PulleyParams;
  geometry: PulleyGeometry;
  onChange: (p: Partial<PulleyParams>) => void;
  sectionView: boolean;
  onToggleSectionView: () => void;
}

export default function PulleyControls({ params: p, geometry: geo, onChange, sectionView, onToggleSectionView }: PulleyControlsProps) {
  const [openSections, setOpenSections] = useState({
    groove: true,
    bore: true,
    hub: true,
    web: true,
    print: false,
    results: true,
    export: true,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const set = (patch: Partial<PulleyParams>) => onChange(patch);

  return (
    <div className="h-full flex flex-col bg-card border-r border-border text-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold tracking-wider text-foreground">MAKE-PULLEYS</div>
            <div className="text-[10px] text-muted-foreground">Parametric Pulley Generator</div>
          </div>
          <Button
            variant={sectionView ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={onToggleSectionView}
          >
            {sectionView ? "Section" : "Full"}
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0">

        {/* ── Groove Profile ─────────────────────── */}
        <SectionHeader label="Groove Profile" open={openSections.groove} onToggle={() => toggle("groove")} icon={<Cog className="w-3 h-3" />} />
        {openSections.groove && (
          <div className="space-y-1.5 pb-2">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</span>
              <Select value={p.grooveType} onValueChange={v => set({ grooveType: v as PulleyParams["grooveType"] })}>
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vbelt">V-Belt</SelectItem>
                  <SelectItem value="flat">Flat Belt</SelectItem>
                  <SelectItem value="obelt">O-Belt / Round</SelectItem>
                  <SelectItem value="timing">Timing Belt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {p.grooveType === "vbelt" && (
              <>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Section</span>
                  <Select value={p.vbeltSection} onValueChange={v => set({ vbeltSection: v as PulleyParams["vbeltSection"] })}>
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(V_BELT_GROOVES).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NumericField label="Num Grooves" value={p.numGrooves} onChange={v => set({ numGrooves: v })} min={1} max={8} step={1} />
                {p.numGrooves > 1 && (
                  <NumericField label="Groove Spacing" value={p.grooveSpacing} onChange={v => set({ grooveSpacing: v })} min={10} max={100} step={0.5} unit="mm" decimals={1}
                    tooltip="Center-to-center distance between grooves" />
                )}
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Groove Angle</span>
                  <Select value={String(p.grooveAngle)} onValueChange={v => set({ grooveAngle: Number(v) as 34 | 36 | 38 | 40 })}>
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="34">34° (large pulleys)</SelectItem>
                      <SelectItem value="36">36° (medium)</SelectItem>
                      <SelectItem value="38">38° (standard)</SelectItem>
                      <SelectItem value="40">40° (small pulleys)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {p.grooveType === "timing" && (
              <>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Profile</span>
                  <Select value={p.timingProfile} onValueChange={v => set({ timingProfile: v as PulleyParams["timingProfile"] })}>
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(TIMING_GROOVES).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NumericField label="Num Teeth" value={p.timingTeeth} onChange={v => set({ timingTeeth: v })} min={10} max={200} step={1}
                  tooltip="Number of teeth on the pulley" />
              </>
            )}

            {p.grooveType === "flat" && (
              <NumericField label="Crown Height" value={p.flatCrown} onChange={v => set({ flatCrown: v })} min={0} max={5} step={0.1} unit="mm" decimals={1}
                tooltip="Crown height above rim edge for belt tracking" />
            )}

            {p.grooveType === "obelt" && (
              <NumericField label="Belt Ø" value={p.obeltDiameter} onChange={v => set({ obeltDiameter: v })} min={3} max={20} step={0.5} unit="mm" decimals={1}
                tooltip="O-belt (round belt) cross-section diameter" />
            )}

            <NumericField label="Face Width" value={p.faceWidth} onChange={v => set({ faceWidth: v })} min={5} max={300} step={1} unit="mm"
              tooltip="Total axial width of the pulley rim" />
            <NumericField label="Pitch Diameter" value={p.pitchDiameter} onChange={v => set({ pitchDiameter: v })} min={20} max={1000} step={1} unit="mm"
              tooltip="Pitch diameter of the pulley (reference circle for belt contact)" />
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Bore ───────────────────────────────── */}
        <SectionHeader label="Bore & Hub" open={openSections.bore} onToggle={() => toggle("bore")} icon={<Settings className="w-3 h-3" />} />
        {openSections.bore && (
          <div className="space-y-1.5 pb-2">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bore Type</span>
              <Select value={p.boreType} onValueChange={v => set({ boreType: v as PulleyParams["boreType"] })}>
                <SelectTrigger className="h-6 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="through">Through Hole</SelectItem>
                  <SelectItem value="keyway">Keyway (DIN 6885)</SelectItem>
                  <SelectItem value="dshaft">D-Shaft Flat</SelectItem>
                  <SelectItem value="setscrew">Set Screw</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <NumericField label="Bore Diameter" value={p.boreDiameter} onChange={v => set({ boreDiameter: v })} min={3} max={200} step={0.5} unit="mm" decimals={1}
              tooltip="Inner bore diameter (shaft fit)" />

            {p.boreType === "keyway" && geo.keyway && (
              <div className="bg-muted/50 rounded p-1.5 space-y-0.5">
                <div className="text-[10px] text-primary font-semibold">Keyway (DIN 6885 / ISO 773)</div>
                <ReadOnlyField label="Width" value={geo.keyway.width} unit="mm" />
                <ReadOnlyField label="Hub Depth" value={geo.keyway.hubDepth} unit="mm" />
                <ReadOnlyField label="Shaft Depth" value={geo.keyway.shaftDepth} unit="mm" />
                <ReadOnlyField label="Fit" value="JS9/h9" />
              </div>
            )}

            {p.boreType === "dshaft" && (
              <>
                <NumericField label="Flat Depth" value={p.dShaftFlatDepth} onChange={v => set({ dShaftFlatDepth: v })} min={0.5} max={10} step={0.1} unit="mm" decimals={1}
                  tooltip="Depth of D-shaft flat from bore surface" />
                {geo.dFlatChordWidth > 0 && (
                  <ReadOnlyField label="Chord Width" value={geo.dFlatChordWidth} unit="mm" />
                )}
              </>
            )}

            {p.boreType === "setscrew" && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Screw Size</span>
                <Select value={p.setScrewSize} onValueChange={v => set({ setScrewSize: v as PulleyParams["setScrewSize"] })}>
                  <SelectTrigger className="h-6 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M3">M3</SelectItem>
                    <SelectItem value="M4">M4</SelectItem>
                    <SelectItem value="M5">M5</SelectItem>
                    <SelectItem value="M6">M6</SelectItem>
                    <SelectItem value="M8">M8</SelectItem>
                    <SelectItem value="M10">M10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <NumericField label="Hub Diameter" value={p.hubDiameter} onChange={v => set({ hubDiameter: v })} min={p.boreDiameter + 4} max={200} step={1} unit="mm"
              tooltip="Outer diameter of the hub (min = bore + 4mm wall)" />
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Boss ───────────────────────────────── */}
        <SectionHeader label="Boss" open={openSections.hub} onToggle={() => toggle("hub")} icon={<Layers className="w-3 h-3" />} />
        {openSections.hub && (
          <div className="space-y-1.5 pb-2">
            <NumericField label="Boss Height" value={p.bossHeight} onChange={v => set({ bossHeight: v })} min={0} max={100} step={1} unit="mm"
              tooltip="Height of boss extending from right face (0 = no boss)" />
            {p.bossHeight > 0 && (
              <NumericField label="Boss Diameter" value={p.bossDiameter} onChange={v => set({ bossDiameter: v })} min={p.boreDiameter + 4} max={200} step={1} unit="mm"
                tooltip="Outer diameter of boss (min = bore + 4mm wall)" />
            )}
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Web / Spokes ───────────────────────── */}
        <SectionHeader label="Web & Spokes" open={openSections.web} onToggle={() => toggle("web")} icon={<Cog className="w-3 h-3" />} />
        {openSections.web && (
          <div className="space-y-1.5 pb-2">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Web Style</span>
              <Select value={p.webStyle} onValueChange={v => set({ webStyle: v as PulleyParams["webStyle"] })}>
                <SelectTrigger className="h-6 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid Web</SelectItem>
                  <SelectItem value="spokes">Spokes</SelectItem>
                  <SelectItem value="lightening">Lightening Holes</SelectItem>
                  <SelectItem value="fins">Fins (3D Print)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <NumericField label="Web Thickness" value={p.webThickness} onChange={v => set({ webThickness: v })} min={2} max={50} step={0.5} unit="mm" decimals={1}
              tooltip="Axial thickness of the web/disc" />

            {(p.webStyle === "spokes" || p.webStyle === "fins") && (
              <>
                <NumericField label="Num Spokes" value={p.numSpokes} onChange={v => set({ numSpokes: v })} min={2} max={12} step={1} />
                <NumericField label="Spoke Width" value={p.spokeWidth} onChange={v => set({ spokeWidth: v })} min={3} max={30} step={0.5} unit="mm" decimals={1} />
              </>
            )}

            {p.webStyle === "lightening" && (
              <>
                <NumericField label="Num Holes" value={p.numLighteningHoles} onChange={v => set({ numLighteningHoles: v })} min={2} max={12} step={1} />
                <NumericField label="Hole Diameter" value={p.lighteningHoleDiameter} onChange={v => set({ lighteningHoleDiameter: v })} min={3} max={50} step={0.5} unit="mm" decimals={1} />
                {geo.lighteningHolePCD > 0 && (
                  <ReadOnlyField label="Hole PCD" value={geo.lighteningHolePCD} unit="mm" />
                )}
              </>
            )}
          </div>
        )}

        <Separator className="my-1" />

        {/* ── 3D Print Settings ──────────────────── */}
        <SectionHeader label="3D Print" open={openSections.print} onToggle={() => toggle("print")} icon={<Printer className="w-3 h-3" />} />
        {openSections.print && (
          <div className="space-y-1.5 pb-2">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Material</span>
              <Select value={p.material} onValueChange={v => set({ material: v as PulleyParams["material"] })}>
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLA">PLA</SelectItem>
                  <SelectItem value="PETG">PETG</SelectItem>
                  <SelectItem value="ASA">ASA</SelectItem>
                  <SelectItem value="Nylon">Nylon (PA12)</SelectItem>
                  <SelectItem value="PC">Polycarbonate</SelectItem>
                  <SelectItem value="Aluminum">Aluminum (CNC)</SelectItem>
                  <SelectItem value="Steel">Steel (CNC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Orientation</span>
              <Select value={p.printOrientation} onValueChange={v => set({ printOrientation: v as PulleyParams["printOrientation"] })}>
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat (belt face down)</SelectItem>
                  <SelectItem value="upright">Upright (axis vertical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <NumericField label="Infill %" value={p.infillPercent} onChange={v => set({ infillPercent: v })} min={20} max={100} step={5} unit="%" />
            <NumericField label="Wall Thickness" value={p.wallThickness} onChange={v => set({ wallThickness: v })} min={0.8} max={8} step={0.4} unit="mm" decimals={1}
              tooltip="Minimum wall thickness (1.6–2.4 mm = 4–6 perimeters at 0.4 mm nozzle)" />

            {geo.printWarnings.length > 0 && (
              <div className="space-y-1 mt-1">
                {geo.printWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1 text-[10px] text-yellow-400">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Print recommendations */}
            <div className="bg-muted/40 rounded p-1.5 space-y-0.5 mt-1">
              <div className="text-[10px] text-primary font-semibold">Print Notes</div>
              <div className="text-[10px] text-muted-foreground">
                Layer: {p.grooveType === "timing" ? "0.15mm" : "0.2mm"} for grooves
              </div>
              <div className="text-[10px] text-muted-foreground">
                Infill: Gyroid or Rectilinear
              </div>
              {p.printOrientation === "flat" && (
                <div className="text-[10px] text-muted-foreground">
                  Supports: Not needed (flat orientation)
                </div>
              )}
              {p.printOrientation === "upright" && (
                <div className="text-[10px] text-yellow-400">
                  Supports needed for bore overhang
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Results ────────────────────────────── */}
        <SectionHeader label="Computed Geometry" open={openSections.results} onToggle={() => toggle("results")} />
        {openSections.results && (
          <div className="space-y-0.5 pb-2">
            <ReadOnlyField label="Outer Diameter" value={geo.outerDiameter} unit="mm" />
            <ReadOnlyField label="Root Diameter" value={geo.rootDiameter} unit="mm" />
            {geo.pitchDiameter > 0 && <ReadOnlyField label="Pitch Diameter" value={geo.pitchDiameter} unit="mm" />}
            <ReadOnlyField label="Hub Diameter" value={geo.hubDiameter} unit="mm" />
            <ReadOnlyField label="Bore Diameter" value={geo.boreDiameter} unit="mm" />
            <ReadOnlyField label="Face Width" value={geo.faceWidth} unit="mm" />
            <ReadOnlyField label="Web Thickness" value={geo.webThickness} unit="mm" />
            {geo.numTeeth > 0 && <ReadOnlyField label="Num Teeth" value={String(geo.numTeeth)} />}
            {geo.grooveDepth > 0 && <ReadOnlyField label="Groove Depth" value={geo.grooveDepth} unit="mm" />}
            <ReadOnlyField label="Est. Mass" value={geo.estimatedMass} unit="g" />
            <ReadOnlyField label="Est. Volume" value={geo.estimatedVolume} unit="cm³" />

            {/* Errors */}
            {geo.errors.length > 0 && (
              <div className="space-y-1 mt-1">
                {geo.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {geo.warnings.length > 0 && (
              <div className="space-y-1 mt-1">
                {geo.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1 text-[10px] text-yellow-400">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator className="my-1" />

        {/* ── Export ─────────────────────────────── */}
        <SectionHeader label="Export" open={openSections.export} onToggle={() => toggle("export")} icon={<Download className="w-3 h-3" />} />
        {openSections.export && (
          <div className="space-y-1.5 pb-2">
            <Button
              variant="default"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => downloadPulleySTEP(p, geo)}
              disabled={geo.errors.length > 0}
            >
              <Download className="w-3 h-3 mr-1" />
              Download STEP (AP203)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => downloadPulleyOpenSCAD(p, geo)}
            >
              <Download className="w-3 h-3 mr-1" />
              Download OpenSCAD
            </Button>

            <Separator className="my-1" />

            {/* McMaster links */}
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source on McMaster-Carr</div>
            {p.grooveType === "vbelt" && (
              <a
                href={`https://www.mcmaster.com/products/v-belt-pulleys/belt-trade-size~${p.vbeltSection.toLowerCase()}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                V-Belt {p.vbeltSection} Pulleys
              </a>
            )}
            {p.grooveType === "timing" && (
              <a
                href={`https://www.mcmaster.com/products/timing-belt-pulleys/timing-belt-type~${p.timingProfile.toLowerCase()}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {p.timingProfile} Timing Pulleys
              </a>
            )}
            {p.grooveType === "flat" && (
              <a
                href="https://www.mcmaster.com/products/flat-belt-pulleys/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Flat Belt Pulleys
              </a>
            )}
            <a
              href={`https://www.mcmaster.com/products/shaft-collars/bore-diameter~${p.boreDiameter}mm/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Shaft Collars ⌀{p.boreDiameter}mm
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 pb-3 text-center">
          <div className="text-[9px] text-muted-foreground/50">Make-Pulleys v1.0 · frontierinnovations</div>
        </div>
      </div>
    </div>
  );
}
