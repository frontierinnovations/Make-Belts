/**
 * Pulleys.tsx — Parametric Pulley Generator Page
 *
 * Design: Clean Utilitarian, matching Make-Belts/Make-Gears
 * Layout: Fixed sidebar (left) + full-height 3D canvas (right)
 * Mobile: Slide-in sidebar overlay with toggle button
 */

import { useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import PulleyCanvas from "@/components/PulleyCanvas";
import PulleyControls from "@/components/PulleyControls";
import { defaultPulleyParams, computePulleyGeometry } from "@/lib/pulleyMath";
import type { PulleyParams } from "@/lib/pulleyMath";

export default function Pulleys() {
  const [params, setParams] = useState<PulleyParams>(defaultPulleyParams);
  const [sectionView, setSectionView] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const geometry = computePulleyGeometry(params);

  const handleChange = useCallback((partial: Partial<PulleyParams>) => {
    setParams(prev => ({ ...prev, ...partial }));
  }, []);

  const handleToggleSectionView = useCallback(() => {
    setSectionView(v => !v);
  }, []);

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white overflow-hidden">

      {/* Mobile sidebar toggle — shown only when sidebar is closed */}
      {!mobileSidebarOpen && (
        <button
          className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#252525] border border-white/20 rounded-lg shadow-md active:scale-95 transition-transform"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open controls"
        >
          <ChevronRight size={18} className="text-white/70" />
        </button>
      )}

      {/* ── Sidebar ─────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 flex flex-col border-r border-white/10 overflow-hidden
          w-full md:w-[280px]
          transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          fixed md:relative z-40 md:z-auto h-full
        `}
        style={{ background: "#1e1e1e" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 flex-shrink-0"
          style={{ background: "#252525" }}
        >
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="text-white/40 hover:text-white transition-colors p-1 rounded active:scale-95">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide font-mono">
                MAKE-PULLEYS
              </div>
              <div className="text-[9px] text-white/40">
                Parametric Pulley Generator
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleSectionView}
              className={`text-[9px] px-2 py-1 rounded border transition-colors font-mono touch-manipulation ${
                sectionView
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-white/20 text-white/40 hover:border-white/40"
              }`}
            >
              {sectionView ? "SECTION ✓" : "SECTION"}
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
              aria-label="Close controls"
            >
              <X size={16} />
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

      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── 3D Canvas ───────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <PulleyCanvas
          params={params}
          geometry={geometry}
          sectionView={sectionView}
        />

        {/* Errors overlay */}
        {geometry.errors.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 space-y-1 w-[90%] max-w-sm">
            {geometry.errors.map((e, i) => (
              <div
                key={i}
                className="bg-red-900/90 border border-red-500/60 text-red-200 text-[10px] px-3 py-1.5 rounded font-mono text-center"
              >
                ⚠ {e}
              </div>
            ))}
          </div>
        )}

        {/* Warnings overlay */}
        {geometry.warnings.length > 0 && geometry.errors.length === 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 space-y-1 w-[90%] max-w-sm">
            {geometry.warnings.map((w, i) => (
              <div
                key={i}
                className="bg-yellow-900/80 border border-yellow-500/50 text-yellow-200 text-[10px] px-3 py-1.5 rounded font-mono text-center"
              >
                ⚠ {w}
              </div>
            ))}
          </div>
        )}

        {/* Corner info — hidden on very small screens */}
        <div className="hidden sm:block absolute bottom-3 right-3 text-[9px] text-white/30 font-mono space-y-0.5 text-right">
          <div>OD: {geometry.outerDiameter.toFixed(1)} mm</div>
          <div>PD: {geometry.pitchDiameter.toFixed(1)} mm</div>
          <div>W: {geometry.faceWidth.toFixed(1)} mm</div>
          <div className="text-white/20">Drag to rotate · Scroll to zoom · Right-drag to pan</div>
        </div>

        {/* Mobile corner info — compact */}
        <div className="sm:hidden absolute bottom-3 right-3 text-[9px] text-white/30 font-mono space-y-0.5 text-right">
          <div>OD {geometry.outerDiameter.toFixed(1)} · PD {geometry.pitchDiameter.toFixed(1)} · W {geometry.faceWidth.toFixed(1)} mm</div>
        </div>
      </div>
    </div>
  );
}
