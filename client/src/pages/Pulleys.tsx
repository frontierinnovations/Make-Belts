/**
 * Pulleys.tsx — Parametric Pulley Generator Page
 *
 * Design: Clean Utilitarian, matching Make-Belts/Make-Gears
 * Layout: Fixed sidebar (left) + full-height 3D canvas (right)
 *
 * Mobile UX (ui-ux-pro review applied):
 * - Bottom-right FAB toggle (thumb zone, Fitts's Law)
 * - Full-width slide-in sidebar with backdrop
 * - Info overlay on canvas (OD/PD/W visible at all times)
 * - Bottom nav link to belt drive page
 * - Safe-area padding (pb-safe)
 * - Touch-manipulation on all interactive elements
 */

import { useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, SlidersHorizontal, X, Scissors } from "lucide-react";
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
              <button className="text-white/40 hover:text-white transition-colors p-1.5 rounded active:scale-95 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center">
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
            {/* Section view toggle */}
            <button
              onClick={handleToggleSectionView}
              className={`flex items-center gap-1 text-[9px] px-2 py-1.5 rounded border transition-colors font-mono touch-manipulation min-h-[32px] ${
                sectionView
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-white/20 text-white/40 hover:border-white/40"
              }`}
              title="Toggle section view"
            >
              <Scissors size={10} />
              <span className="hidden sm:inline">{sectionView ? "SECTION ✓" : "SECTION"}</span>
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
              aria-label="Close controls"
            >
              <X size={18} />
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
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
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

        {/* ── Top-left: back link on desktop ────── */}
        <div className="hidden md:flex absolute top-3 left-3 z-10">
          {/* intentionally empty on desktop — sidebar has back button */}
        </div>

        {/* ── Errors / warnings overlay ─────────── */}
        {(geometry.errors.length > 0 || geometry.warnings.length > 0) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 space-y-1 w-[90%] max-w-sm pointer-events-none">
            {geometry.errors.map((e, i) => (
              <div
                key={`e${i}`}
                className="bg-red-900/90 border border-red-500/60 text-red-200 text-[10px] px-3 py-1.5 rounded font-mono text-center"
              >
                ⚠ {e}
              </div>
            ))}
            {geometry.errors.length === 0 && geometry.warnings.map((w, i) => (
              <div
                key={`w${i}`}
                className="bg-yellow-900/80 border border-yellow-500/50 text-yellow-200 text-[10px] px-3 py-1.5 rounded font-mono text-center"
              >
                ⚠ {w}
              </div>
            ))}
          </div>
        )}

        {/* ── Info overlay — always visible ─────── */}
        {/* Desktop: bottom-right */}
        <div className="hidden sm:block absolute bottom-4 right-4 text-[9px] text-white/40 font-mono space-y-0.5 text-right pointer-events-none">
          <div className="text-white/60 font-semibold text-[10px]">
            {params.grooveType.toUpperCase()} · {params.material}
          </div>
          <div>OD: {geometry.outerDiameter.toFixed(1)} mm</div>
          <div>PD: {geometry.pitchDiameter.toFixed(1)} mm</div>
          <div>W: {geometry.faceWidth.toFixed(1)} mm</div>
          <div>Hub Ø: {geometry.hubDiameter.toFixed(1)} mm</div>
          <div className="text-white/20 mt-1">Drag · Scroll · Right-drag</div>
        </div>

        {/* Mobile: top-right compact badge */}
        <div className="sm:hidden absolute top-3 right-3 z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-white/60 space-y-0.5">
            <div className="text-white/80 font-semibold text-[10px]">
              {params.grooveType.toUpperCase()} · {params.material}
            </div>
            <div>OD {geometry.outerDiameter.toFixed(1)} · PD {geometry.pitchDiameter.toFixed(1)} · W {geometry.faceWidth.toFixed(1)} mm</div>
          </div>
        </div>

        {/* ── Mobile FAB — bottom-right (thumb zone) */}
        <button
          className="md:hidden fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/50 flex items-center justify-center touch-manipulation"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open controls"
          style={{ display: mobileSidebarOpen ? "none" : undefined }}
        >
          <SlidersHorizontal size={22} className="text-white" />
        </button>

        {/* ── Mobile bottom nav ─────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#1e1e1e]/95 backdrop-blur-sm"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <Link href="/">
            <button className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors touch-manipulation py-1 px-2 rounded active:bg-white/10">
              <ArrowLeft size={14} />
              <span className="text-[10px] font-mono">BELT DRIVE</span>
            </button>
          </Link>
          <div className="text-[9px] font-mono text-white/30">
            {params.grooveType.toUpperCase()} PULLEY
          </div>
          <button
            onClick={handleToggleSectionView}
            className={`flex items-center gap-1 text-[10px] font-mono touch-manipulation py-1 px-2 rounded transition-colors ${
              sectionView ? "text-blue-400" : "text-white/50 hover:text-white"
            }`}
          >
            <Scissors size={12} />
            <span>SECTION</span>
          </button>
        </div>
      </div>
    </div>
  );
}
