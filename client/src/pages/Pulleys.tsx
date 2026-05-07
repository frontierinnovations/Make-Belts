/**
 * Pulleys.tsx — Parametric Pulley Generator Page
 *
 * Design: Clean Utilitarian / Engineering Drawing aesthetic
 * Layout: Fixed sidebar (left) + 2D cross-section drawing (right)
 *
 * Primary view: accurate 2D half-section engineering drawing
 *   Left half  = exterior profile
 *   Right half = cut section showing bore, keyway, web, boss
 *
 * Export: STEP (AP203) + OpenSCAD
 *
 * Mobile UX:
 *   - Bottom-right FAB toggle (thumb zone)
 *   - Full-width slide-in sidebar with backdrop
 *   - Bottom nav link to belt drive page
 *   - Safe-area padding
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, SlidersHorizontal, X, Download,
  FileCode2, ZoomIn, ZoomOut, Maximize2
} from "lucide-react";
import PulleyCrossSection from "@/components/PulleyCrossSection";
import PulleyControls from "@/components/PulleyControls";
import { defaultPulleyParams, computePulleyGeometry } from "@/lib/pulleyMath";
import { downloadPulleySTEP, downloadPulleyOpenSCAD } from "@/lib/pulleyStep";
import type { PulleyParams } from "@/lib/pulleyMath";

export default function Pulleys() {
  const [params, setParams] = useState<PulleyParams>(defaultPulleyParams);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 700, h: 500 });

  const geometry = computePulleyGeometry(params);

  const handleChange = useCallback((partial: Partial<PulleyParams>) => {
    setParams(prev => ({ ...prev, ...partial }));
  }, []);

  // Measure canvas container size
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 100 && height > 100) {
          setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 3.0));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.4));
  const handleZoomReset = () => setZoom(1.0);

  const handleExportSTEP = () => downloadPulleySTEP(params, geometry);
  const handleExportSCAD = () => downloadPulleyOpenSCAD(params, geometry);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f1117", color: "#e8e8e8" }}>

      {/* ── Sidebar ─────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 flex flex-col border-r overflow-hidden
          w-full md:w-[280px]
          transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          fixed md:relative z-40 md:z-auto h-full
        `}
        style={{ background: "#13161e", borderColor: "#1e2430" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0"
          style={{ background: "#181b24", borderColor: "#1e2430" }}
        >
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-1.5 rounded transition-colors active:scale-95 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                style={{ color: "#607080" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8e8e8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#607080")}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <div className="text-xs font-bold tracking-widest font-mono" style={{ color: "#4a90d9" }}>
                MAKE-PULLEYS
              </div>
              <div className="text-[9px] font-mono" style={{ color: "#4a5568" }}>
                Parametric Pulley Generator
              </div>
            </div>
          </div>
          {/* Mobile close */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-95 touch-manipulation"
            style={{ color: "#607080" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <PulleyControls
          params={params}
          geometry={geometry}
          onChange={handleChange}
          sectionView={false}
          onToggleSectionView={() => {}}
        />
      </div>

      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Main canvas area ─────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top toolbar ── */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ background: "#181b24", borderColor: "#1e2430" }}
        >
          {/* Left: title */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color: "#4a90d9" }}>
              CROSS-SECTION
            </span>
            <span className="text-[9px] font-mono hidden sm:inline" style={{ color: "#4a5568" }}>
              Half-section view · ISO 4183 / RMA IP-20
            </span>
          </div>

          {/* Right: zoom + export */}
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border rounded px-1.5 py-1" style={{ borderColor: "#1e2430" }}>
              <button onClick={handleZoomOut} className="p-0.5 rounded transition-colors touch-manipulation"
                style={{ color: "#607080" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8e8e8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#607080")}
              >
                <ZoomOut size={13} />
              </button>
              <button onClick={handleZoomReset} className="text-[9px] font-mono px-1.5 rounded transition-colors touch-manipulation"
                style={{ color: "#a0b8c8" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8e8e8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0b8c8")}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={handleZoomIn} className="p-0.5 rounded transition-colors touch-manipulation"
                style={{ color: "#607080" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8e8e8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#607080")}
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Export STEP */}
            <button
              onClick={handleExportSTEP}
              disabled={geometry.errors.length > 0}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border transition-all active:scale-95 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: geometry.errors.length > 0 ? "transparent" : "#1a3a5c",
                borderColor: "#2a5a8c",
                color: "#4a90d9",
              }}
              onMouseEnter={e => { if (geometry.errors.length === 0) e.currentTarget.style.background = "#1e4a74"; }}
              onMouseLeave={e => { if (geometry.errors.length === 0) e.currentTarget.style.background = "#1a3a5c"; }}
              title="Export STEP AP203 file for CAD import"
            >
              <Download size={12} />
              <span className="hidden sm:inline">STEP</span>
            </button>

            {/* Export OpenSCAD */}
            <button
              onClick={handleExportSCAD}
              disabled={geometry.errors.length > 0}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border transition-all active:scale-95 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "transparent",
                borderColor: "#1e2430",
                color: "#607080",
              }}
              onMouseEnter={e => { if (geometry.errors.length === 0) { e.currentTarget.style.borderColor = "#2a3444"; e.currentTarget.style.color = "#a0b8c8"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2430"; e.currentTarget.style.color = "#607080"; }}
              title="Export OpenSCAD script"
            >
              <FileCode2 size={12} />
              <span className="hidden sm:inline">SCAD</span>
            </button>
          </div>
        </div>

        {/* ── Errors / warnings ── */}
        {(geometry.errors.length > 0 || geometry.warnings.length > 0) && (
          <div className="flex-shrink-0 px-4 py-1.5 space-y-1 border-b" style={{ borderColor: "#1e2430" }}>
            {geometry.errors.map((e, i) => (
              <div key={`e${i}`} className="text-[10px] font-mono px-3 py-1.5 rounded border"
                style={{ background: "#2a1010", borderColor: "#7a2020", color: "#f08080" }}>
                ⚠ {e}
              </div>
            ))}
            {geometry.errors.length === 0 && geometry.warnings.map((w, i) => (
              <div key={`w${i}`} className="text-[10px] font-mono px-3 py-1.5 rounded border"
                style={{ background: "#2a1e08", borderColor: "#7a5010", color: "#f0b060" }}>
                ⚠ {w}
              </div>
            ))}
          </div>
        )}

        {/* ── Drawing canvas ── */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-auto flex items-center justify-center"
          style={{ background: "#0a0d12" }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease",
            }}
          >
            <PulleyCrossSection
              params={params}
              geometry={geometry}
              width={Math.max(600, canvasSize.w - 40)}
              height={Math.max(420, canvasSize.h - 40)}
            />
          </div>
        </div>

        {/* ── Status bar ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-t"
          style={{ background: "#181b24", borderColor: "#1e2430" }}
        >
          <div className="flex items-center gap-4 text-[9px] font-mono" style={{ color: "#4a5568" }}>
            <span>OD <span style={{ color: "#a0b8c8" }}>{geometry.outerDiameter.toFixed(1)} mm</span></span>
            <span>PD <span style={{ color: "#f0a040" }}>{geometry.pitchDiameter.toFixed(1)} mm</span></span>
            <span>W <span style={{ color: "#a0b8c8" }}>{geometry.faceWidth.toFixed(1)} mm</span></span>
            <span>Bore <span style={{ color: "#a0b8c8" }}>Ø{geometry.boreDiameter.toFixed(1)} mm</span></span>
            <span className="hidden sm:inline">
              ~<span style={{ color: "#a0b8c8" }}>{geometry.estimatedMass.toFixed(1)} g</span>
            </span>
          </div>
          <div className="text-[9px] font-mono" style={{ color: "#2a3444" }}>
            {params.material} · Make-Pulleys v1.0
          </div>
        </div>

        {/* ── Mobile bottom nav ── */}
        <div
          className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-2 border-t"
          style={{
            background: "#181b24",
            borderColor: "#1e2430",
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))"
          }}
        >
          <Link href="/">
            <button className="flex items-center gap-1.5 text-[10px] font-mono py-1 px-2 rounded active:bg-white/10 touch-manipulation"
              style={{ color: "#607080" }}>
              <ArrowLeft size={14} />
              BELT DRIVE
            </button>
          </Link>
          <div className="text-[9px] font-mono" style={{ color: "#2a3444" }}>
            {params.grooveType.toUpperCase()} PULLEY
          </div>
          <button
            onClick={handleExportSTEP}
            disabled={geometry.errors.length > 0}
            className="flex items-center gap-1 text-[10px] font-mono py-1 px-2 rounded touch-manipulation disabled:opacity-40"
            style={{ color: "#4a90d9" }}
          >
            <Download size={12} />
            STEP
          </button>
        </div>
      </div>

      {/* ── Mobile FAB ── */}
      <button
        className="md:hidden fixed bottom-16 right-5 z-50 w-14 h-14 rounded-full active:scale-95 transition-all shadow-lg flex items-center justify-center touch-manipulation"
        style={{
          background: "#1a3a5c",
          boxShadow: "0 4px 20px rgba(74,144,217,0.3)",
          display: mobileSidebarOpen ? "none" : undefined
        }}
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open controls"
      >
        <SlidersHorizontal size={22} style={{ color: "#4a90d9" }} />
      </button>
    </div>
  );
}
