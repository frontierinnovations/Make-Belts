/**
 * Pulleys.tsx — Parametric Pulley Generator Page
 *
 * Design: Clean Utilitarian, matching Make-Belts/Make-Gears
 * Layout: Fixed sidebar (left) + full-height 3D canvas (right)
 */

import { useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import PulleyCanvas from "@/components/PulleyCanvas";
import PulleyControls from "@/components/PulleyControls";
import { defaultPulleyParams, computePulleyGeometry } from "@/lib/pulleyMath";
import type { PulleyParams } from "@/lib/pulleyMath";

export default function Pulleys() {
  const [params, setParams] = useState<PulleyParams>(defaultPulleyParams);
  const [sectionView, setSectionView] = useState(false);

  const geometry = computePulleyGeometry(params);

  const handleChange = useCallback((partial: Partial<PulleyParams>) => {
    setParams(prev => ({ ...prev, ...partial }));
  }, []);

  const handleToggleSectionView = useCallback(() => {
    setSectionView(v => !v);
  }, []);

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white overflow-hidden">
      {/* ── Sidebar ─────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col border-r border-white/10 overflow-hidden"
        style={{ width: 280, background: "#1e1e1e" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0"
          style={{ background: "#252525" }}
        >
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="text-muted-foreground hover:text-white transition-colors p-0.5 rounded">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </Link>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide font-mono">
                MAKE-PULLEYS
              </div>
              <div className="text-[9px] text-muted-foreground">
                Parametric Pulley Generator
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleSectionView}
              className={`text-[9px] px-2 py-0.5 rounded border transition-colors font-mono ${
                sectionView
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-white/20 text-muted-foreground hover:border-white/40"
              }`}
            >
              {sectionView ? "SECTION ✓" : "SECTION"}
            </button>
          </div>
        </div>

        {/* Controls */}
        <PulleyControls
          params={params}
          geometry={geometry}
          onChange={handleChange}
          sectionView={sectionView}
          onToggleSectionView={handleToggleSectionView}
        />
      </div>

      {/* ── 3D Canvas ───────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <PulleyCanvas
          params={params}
          geometry={geometry}
          sectionView={sectionView}
        />

        {/* Errors overlay */}
        {geometry.errors.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 space-y-1">
            {geometry.errors.map((e, i) => (
              <div
                key={i}
                className="bg-red-900/90 border border-red-500/60 text-red-200 text-[10px] px-3 py-1.5 rounded font-mono max-w-sm text-center"
              >
                ⚠ {e}
              </div>
            ))}
          </div>
        )}

        {/* Warnings overlay */}
        {geometry.warnings.length > 0 && geometry.errors.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 space-y-1">
            {geometry.warnings.map((w, i) => (
              <div
                key={i}
                className="bg-yellow-900/80 border border-yellow-500/50 text-yellow-200 text-[10px] px-3 py-1.5 rounded font-mono max-w-sm text-center"
              >
                ⚠ {w}
              </div>
            ))}
          </div>
        )}

        {/* Corner info */}
        <div className="absolute bottom-3 right-3 text-[9px] text-white/30 font-mono space-y-0.5 text-right">
          <div>OD: {geometry.outerDiameter.toFixed(1)} mm</div>
          <div>PD: {geometry.pitchDiameter.toFixed(1)} mm</div>
          <div>W: {geometry.faceWidth.toFixed(1)} mm</div>
          <div className="text-white/20">Drag to rotate · Scroll to zoom · Right-drag to pan</div>
        </div>
      </div>
    </div>
  );
}
