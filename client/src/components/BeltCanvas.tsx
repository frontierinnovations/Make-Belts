/**
 * BeltCanvas — HTML5 Canvas renderer for belt drive systems
 *
 * Style: Clean utilitarian with light grid background, filled pulley bodies,
 * dashed guide circles, and on-canvas parameter annotations.
 * Matches Make-Gears visual language exactly.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PulleyParams,
  type BeltSystemParams,
  type BeltGeometry,
  type BeltWarning,
  computePulleyGeometry,
  computeBeltGeometry,
  TIMING_PROFILES,
} from "@/lib/beltMath";
import { CheckCircle2, XCircle, AlertTriangle, Maximize2 } from "lucide-react";

/**
 * Compute the signed angular delta for a canvas arc.
 * Returns a signed angle (radians) such that:
 *   startAngle + delta = endAngle  (going in the specified direction)
 *
 * Canvas arc(start, end, anticlockwise):
 *   anticlockwise=false → goes in the direction of INCREASING angle (CW on screen, Y-down)
 *   anticlockwise=true  → goes in the direction of DECREASING angle (CCW on screen, Y-down)
 */
function arcAngleDelta(start: number, end: number, anticlockwise: boolean): number {
  const TWO_PI = Math.PI * 2;
  if (anticlockwise) {
    // Going from start toward decreasing angle to reach end
    let delta = start - end;
    delta = ((delta % TWO_PI) + TWO_PI) % TWO_PI; // normalize to [0, 2π)
    return -delta; // negative = decreasing angle
  } else {
    // Going from start toward increasing angle to reach end
    let delta = end - start;
    delta = ((delta % TWO_PI) + TWO_PI) % TWO_PI; // normalize to [0, 2π)
    return delta; // positive = increasing angle
  }
}

interface BeltCanvasProps {
  driver: PulleyParams;
  driven: PulleyParams;
  system: BeltSystemParams;
  selectedPulleyId: string | null;
  onSelectPulley: (id: string | null) => void;
  animating: boolean;
  warnings: BeltWarning[];
}

export default function BeltCanvas({
  driver,
  driven,
  system,
  selectedPulleyId,
  onSelectPulley,
  animating,
  warnings,
}: BeltCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const beltOffsetRef = useRef(0); // for belt animation
  const lastTimeRef = useRef<number>(0);

  // Touch state
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const scale = system.pixelsPerMm * zoom;

  const worldToScreen = useCallback(
    (wx: number, wy: number) => ({
      x: canvasSize.width / 2 + wx * scale + pan.x,
      y: canvasSize.height / 2 + wy * scale + pan.y,
    }),
    [canvasSize, pan, scale]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - canvasSize.width / 2 - pan.x) / scale,
      y: (sy - canvasSize.height / 2 - pan.y) / scale,
    }),
    [canvasSize, pan, scale]
  );

  // ── Drawing ────────────────────────────────────────────────────────────────

  const drawPulley = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      pulley: PulleyParams,
      rotDeg: number,
      isSelected: boolean,
      geo: ReturnType<typeof computePulleyGeometry>
    ) => {
      const pos = worldToScreen(pulley.centerX, pulley.centerY);
      const r = geo.pitchRadius * scale;
      const boreR = (pulley.bore / 2) * scale;
      const rotRad = (rotDeg * Math.PI) / 180;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = "#2563eb";
        ctx.shadowBlur = 12;
      }

      // Main pulley body
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = pulley.color + "cc";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#2563eb" : pulley.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Spokes
      if (pulley.spokes > 0 && r > 20) {
        const hubR = Math.max(boreR * 1.8, r * 0.15);
        const rimR = r * 0.88;
        ctx.strokeStyle = pulley.color;
        ctx.lineWidth = Math.max(1.5, r * 0.06);
        ctx.lineCap = "round";
        for (let i = 0; i < pulley.spokes; i++) {
          const angle = rotRad + (i * 2 * Math.PI) / pulley.spokes;
          ctx.beginPath();
          ctx.moveTo(hubR * Math.cos(angle), hubR * Math.sin(angle));
          ctx.lineTo(rimR * Math.cos(angle), rimR * Math.sin(angle));
          ctx.stroke();
        }
        ctx.lineCap = "butt";

        // Hub circle
        ctx.beginPath();
        ctx.arc(0, 0, hubR, 0, 2 * Math.PI);
        ctx.fillStyle = pulley.color + "99";
        ctx.fill();
        ctx.strokeStyle = pulley.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Bore hole
      if (boreR > 2) {
        ctx.beginPath();
        ctx.arc(0, 0, boreR, 0, 2 * Math.PI);
        ctx.fillStyle = "#f8f8f8";
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center mark
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 0.8;
      const cm = 4;
      ctx.beginPath();
      ctx.moveTo(-cm, 0); ctx.lineTo(cm, 0);
      ctx.moveTo(0, -cm); ctx.lineTo(0, cm);
      ctx.stroke();

      // Guide circles (pitch circle)
      if (system.showGuides) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2 * Math.PI);
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 0.7;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    },
    [worldToScreen, scale, system.showGuides]
  );

  const drawBelt = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      geo: BeltGeometry,
      beltOffset: number
    ) => {
      const tp = geo.tangentPoints;
      const driverPos = worldToScreen(driver.centerX, driver.centerY);
      const drivenPos = worldToScreen(driven.centerX, driven.centerY);
      const driverGeo = computePulleyGeometry(driver, system);
      const drivenGeo = computePulleyGeometry(driven, system);
      const r1 = driverGeo.pitchRadius * scale;
      const r2 = drivenGeo.pitchRadius * scale;

      // Convert world tangent points to screen
      const uS = worldToScreen(tp.upperStart.x, tp.upperStart.y);
      const uE = worldToScreen(tp.upperEnd.x, tp.upperEnd.y);
      const lS = worldToScreen(tp.lowerStart.x, tp.lowerStart.y);
      const lE = worldToScreen(tp.lowerEnd.x, tp.lowerEnd.y);

      // Belt visual thickness in pixels
      const beltThicknessMm = system.beltType === "flat" ? system.flatBeltThickness :
                               system.beltType === "vbelt" ? 8 :
                               system.beltType === "timing" ? 4 : 5;
      const beltThicknessPx = Math.max(3, beltThicknessMm * scale * 0.5);

      // Belt color based on type
      const beltColor = system.beltType === "timing" ? "#1a1a1a" :
                        system.beltType === "vbelt" ? "#2a2a2a" :
                        system.beltType === "flat" ? "#444" : "#333";
      const beltHighlight = system.beltType === "timing" ? "#444" :
                             system.beltType === "vbelt" ? "#555" : "#666";

      ctx.save();

      // ── Draw filled belt loop ──────────────────────────────────────────────
      // Belt path: upper span → driven arc → lower span → driver arc
      // Each arc uses the anticlockwise flag from the geometry to ensure the belt
      // wraps around the correct side of each pulley without clipping through it.
      ctx.beginPath();
      ctx.moveTo(uS.x, uS.y);
      ctx.lineTo(uE.x, uE.y);
      ctx.arc(drivenPos.x, drivenPos.y, r2, tp.drivenArcStart, tp.drivenArcEnd, tp.drivenArcAnticlockwise);
      ctx.lineTo(lE.x, lE.y);
      ctx.arc(driverPos.x, driverPos.y, r1, tp.driverArcStart, tp.driverArcEnd, tp.driverArcAnticlockwise);
      ctx.closePath();

      // Subtle fill for belt interior
      ctx.fillStyle = beltColor + "18";
      ctx.fill();

      // ── Draw belt edges as thick stroked lines ─────────────────────────────
      ctx.strokeStyle = beltColor;
      ctx.lineWidth = beltThicknessPx;
      ctx.lineCap = "butt";

      // Upper span
      ctx.beginPath();
      ctx.moveTo(uS.x, uS.y);
      ctx.lineTo(uE.x, uE.y);
      ctx.stroke();

      // Lower span
      ctx.beginPath();
      ctx.moveTo(lS.x, lS.y);
      ctx.lineTo(lE.x, lE.y);
      ctx.stroke();

      // Driven arc (wraps the front/right side of the driven pulley)
      ctx.beginPath();
      ctx.arc(drivenPos.x, drivenPos.y, r2, tp.drivenArcStart, tp.drivenArcEnd, tp.drivenArcAnticlockwise);
      ctx.stroke();

      // Driver arc (wraps the back/left side of the driver pulley)
      ctx.beginPath();
      ctx.arc(driverPos.x, driverPos.y, r1, tp.driverArcStart, tp.driverArcEnd, tp.driverArcAnticlockwise);
      ctx.stroke();

      // ── Belt highlight (top edge sheen) ────────────────────────────────────
      if (beltThicknessPx > 4) {
        ctx.strokeStyle = beltHighlight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(uS.x, uS.y);
        ctx.lineTo(uE.x, uE.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lS.x, lS.y);
        ctx.lineTo(lE.x, lE.y);
        ctx.stroke();
      }

      // ── V-belt groove indicator ────────────────────────────────────────────
      if (system.beltType === "vbelt" && beltThicknessPx > 6) {
        // Draw a center line on the belt spans
        ctx.strokeStyle = beltColor + "88";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(uS.x, uS.y);
        ctx.lineTo(uE.x, uE.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lS.x, lS.y);
        ctx.lineTo(lE.x, lE.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Timing belt teeth ──────────────────────────────────────────────────
      if (system.beltType === "timing") {
        // Draw timing teeth inline to avoid hoisting issue
        const profile = TIMING_PROFILES[system.timingProfile];
        const pitchPx = profile.pitch * scale;
        const toothH = profile.toothHeight * scale * 0.8;
        const toothW = pitchPx * 0.5;
        ctx.save();
        ctx.fillStyle = beltColor;
        const drawSpanTeeth = (
          x1: number, y1: number, x2: number, y2: number,
          normalSign: number
        ) => {
          const sdx = x2 - x1, sdy = y2 - y1;
          const slen = Math.sqrt(sdx * sdx + sdy * sdy);
          if (slen < 1) return;
          const stx = sdx / slen, sty = sdy / slen;
          const snx = -sty * normalSign, sny = stx * normalSign;
          const startOff = (beltOffset % pitchPx + pitchPx) % pitchPx;
          for (let d = -startOff; d < slen; d += pitchPx) {
            const pos = d + pitchPx / 2;
            if (pos < 0 || pos > slen) continue;
            const cx = x1 + stx * pos, cy = y1 + sty * pos;
            const hw = toothW / 2;
            ctx.beginPath();
            ctx.moveTo(cx - stx * hw, cy - sty * hw);
            ctx.lineTo(cx - stx * hw + snx * toothH, cy - sty * hw + sny * toothH);
            ctx.lineTo(cx + stx * hw + snx * toothH, cy + sty * hw + sny * toothH);
            ctx.lineTo(cx + stx * hw, cy + sty * hw);
            ctx.closePath();
            ctx.fill();
          }
        };
        drawSpanTeeth(uS.x, uS.y, uE.x, uE.y, 1);
        drawSpanTeeth(lS.x, lS.y, lE.x, lE.y, -1);
        ctx.restore();
      }

      ctx.restore();
    },
    [driver, driven, system, worldToScreen, scale]
  );

  /**
   * Draw a motion marker dot that travels along the belt loop.
   *
   * The belt loop consists of four segments in order:
   *   1. Upper span:  uS → uE  (straight line)
   *   2. Driven arc:  uE → lS  (arc on driven pulley)
   *   3. Lower span:  lS → lE  (straight line)
   *   4. Driver arc:  lE → uS  (arc on driver pulley)
   *
   * beltOffset is the cumulative pixel distance the belt has moved.
   * We compute the dot position by walking along the loop segments.
   */
  const drawMotionMarker = useCallback(
    (ctx: CanvasRenderingContext2D, geo: BeltGeometry, beltOffset: number) => {
      const tp = geo.tangentPoints;
      const driverPos = worldToScreen(driver.centerX, driver.centerY);
      const drivenPos = worldToScreen(driven.centerX, driven.centerY);
      const driverGeo = computePulleyGeometry(driver, system);
      const drivenGeo = computePulleyGeometry(driven, system);
      const r1 = driverGeo.pitchRadius * scale;
      const r2 = drivenGeo.pitchRadius * scale;

      const uS = worldToScreen(tp.upperStart.x, tp.upperStart.y);
      const uE = worldToScreen(tp.upperEnd.x, tp.upperEnd.y);
      const lS = worldToScreen(tp.lowerStart.x, tp.lowerStart.y);
      const lE = worldToScreen(tp.lowerEnd.x, tp.lowerEnd.y);

      // ── Compute arc lengths for each segment ──────────────────────────────
      const upperSpanLen = Math.sqrt((uE.x - uS.x) ** 2 + (uE.y - uS.y) ** 2);
      const lowerSpanLen = Math.sqrt((lE.x - lS.x) ** 2 + (lE.y - lS.y) ** 2);

      // Arc length = r × |angle|
      // Driven arc: from drivenArcStart to drivenArcEnd
      const drivenArcAngle = arcAngleDelta(
        tp.drivenArcStart, tp.drivenArcEnd, tp.drivenArcAnticlockwise
      );
      const drivenArcLen = r2 * Math.abs(drivenArcAngle);

      // Driver arc: from driverArcStart to driverArcEnd
      const driverArcAngle = arcAngleDelta(
        tp.driverArcStart, tp.driverArcEnd, tp.driverArcAnticlockwise
      );
      const driverArcLen = r1 * Math.abs(driverArcAngle);

      const totalLen = upperSpanLen + drivenArcLen + lowerSpanLen + driverArcLen;
      if (totalLen < 1) return;

      // Wrap beltOffset into [0, totalLen)
      const pos = ((beltOffset % totalLen) + totalLen) % totalLen;

      // ── Walk along segments to find dot position ───────────────────────────
      let dotX = 0, dotY = 0;

      if (pos < upperSpanLen) {
        // Segment 1: upper span
        const t = pos / upperSpanLen;
        dotX = uS.x + (uE.x - uS.x) * t;
        dotY = uS.y + (uE.y - uS.y) * t;
      } else if (pos < upperSpanLen + drivenArcLen) {
        // Segment 2: driven arc
        const arcPos = pos - upperSpanLen;
        const arcFrac = arcPos / drivenArcLen;
        const angle = tp.drivenArcStart + drivenArcAngle * arcFrac;
        dotX = drivenPos.x + r2 * Math.cos(angle);
        dotY = drivenPos.y + r2 * Math.sin(angle);
      } else if (pos < upperSpanLen + drivenArcLen + lowerSpanLen) {
        // Segment 3: lower span
        const t = (pos - upperSpanLen - drivenArcLen) / lowerSpanLen;
        dotX = lS.x + (lE.x - lS.x) * t;
        dotY = lS.y + (lE.y - lS.y) * t;
      } else {
        // Segment 4: driver arc
        const arcPos = pos - upperSpanLen - drivenArcLen - lowerSpanLen;
        const arcFrac = arcPos / driverArcLen;
        const angle = tp.driverArcStart + driverArcAngle * arcFrac;
        dotX = driverPos.x + r1 * Math.cos(angle);
        dotY = driverPos.y + r1 * Math.sin(angle);
      }

      // ── Draw the dot ───────────────────────────────────────────────────────
      const dotR = Math.max(4, Math.min(8, scale * 2.5));
      ctx.save();
      // White halo
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR + 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      // Colored dot
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4444";
      ctx.fill();
      // Inner highlight
      ctx.beginPath();
      ctx.arc(dotX - dotR * 0.25, dotY - dotR * 0.25, dotR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();
      ctx.restore();
    },
    [driver, driven, system, worldToScreen, scale]
  );

  const drawLabels = useCallback(
    (ctx: CanvasRenderingContext2D, geo: BeltGeometry) => {
      if (!system.showLabels) return;

      const driverPos = worldToScreen(driver.centerX, driver.centerY);
      const drivenPos = worldToScreen(driven.centerX, driven.centerY);
      const driverGeo = computePulleyGeometry(driver, system);
      const drivenGeo = computePulleyGeometry(driven, system);

      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";

      const drawLabel = (x: number, y: number, lines: string[], bgColor = "rgba(255,255,255,0.85)") => {
        const lineH = 14;
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const padX = 6, padY = 4;
        const totalH = lines.length * lineH + padY * 2 - 2;
        const bx = x - maxW / 2 - padX;
        const by = y - padY;

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(bx, by, maxW + padX * 2, totalH, 3);
        ctx.fill();
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.fillStyle = "#333";
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * lineH + lineH - 2);
        });
      };

      // Driver label
      const dr1 = driverGeo.pitchRadius * scale;
      drawLabel(driverPos.x, driverPos.y - dr1 - 28, [
        driver.name || "Driver",
        `⌀${driverGeo.pitchDiameter.toFixed(1)} mm`,
        `${driver.rpm} RPM`,
      ]);

      // Driven label
      const dr2 = drivenGeo.pitchRadius * scale;
      drawLabel(drivenPos.x, drivenPos.y - dr2 - 28, [
        driven.name || "Driven",
        `⌀${drivenGeo.pitchDiameter.toFixed(1)} mm`,
        `${geo.outputRpm.toFixed(0)} RPM`,
      ]);

      // Center distance label
      const midX = (driverPos.x + drivenPos.x) / 2;
      const midY = (driverPos.y + drivenPos.y) / 2;
      drawLabel(midX, midY + 20, [
        `C = ${geo.centerDistance.toFixed(1)} mm`,
        `i = ${geo.speedRatio.toFixed(2)}:1`,
      ]);

      // Belt speed label
      const tp = geo.tangentPoints;
      const uS = worldToScreen(tp.upperStart.x, tp.upperStart.y);
      const uE = worldToScreen(tp.upperEnd.x, tp.upperEnd.y);
      const beltMidX = (uS.x + uE.x) / 2;
      const beltMidY = (uS.y + uE.y) / 2;
      drawLabel(beltMidX, beltMidY - 18, [
        `v = ${geo.beltSpeed.toFixed(2)} m/s`,
      ]);
    },
    [driver, driven, system, worldToScreen, scale]
  );

  const drawCenterDistanceLine = useCallback(
    (ctx: CanvasRenderingContext2D, geo: BeltGeometry) => {
      const p1 = worldToScreen(driver.centerX, driver.centerY);
      const p2 = worldToScreen(driven.centerX, driven.centerY);

      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 0.7;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [driver, driven, worldToScreen]
  );

  const draw = useCallback(
    (beltOffset: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvasSize.width * dpr;
      canvas.height = canvasSize.height * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Grid
      if (system.showGrid) {
        const gridMm = 10;
        let gridPx = gridMm * scale;
        while (gridPx < 15) gridPx *= 5;
        while (gridPx > 200) gridPx /= 5;

        const origin = worldToScreen(0, 0);

        ctx.strokeStyle = "#e2e2e2";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        const sx = ((origin.x % gridPx) + gridPx) % gridPx;
        for (let x = sx; x < canvasSize.width; x += gridPx) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasSize.height);
        }
        const sy = ((origin.y % gridPx) + gridPx) % gridPx;
        for (let y = sy; y < canvasSize.height; y += gridPx) {
          ctx.moveTo(0, y);
          ctx.lineTo(canvasSize.width, y);
        }
        ctx.stroke();

        // Origin axes
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, canvasSize.height);
        ctx.moveTo(0, origin.y);
        ctx.lineTo(canvasSize.width, origin.y);
        ctx.stroke();
      }

      // Compute geometry
      const geo = computeBeltGeometry(driver, driven, system);

      // Center distance line
      drawCenterDistanceLine(ctx, geo);

      // Belt
      drawBelt(ctx, geo, beltOffset);

      // Pulleys (drawn on top of belt)
      const driverGeo = computePulleyGeometry(driver, system);
      const drivenGeo = computePulleyGeometry(driven, system);

      drawPulley(ctx, driver, driver.rotationDeg, selectedPulleyId === driver.id, driverGeo);
      drawPulley(ctx, driven, driven.rotationDeg, selectedPulleyId === driven.id, drivenGeo);

      // Motion marker dot (drawn on top of belt, below labels)
      drawMotionMarker(ctx, geo, beltOffset);

      // Labels
      drawLabels(ctx, geo);
    },
    [
      canvasSize, system, scale, worldToScreen, driver, driven,
      selectedPulleyId, drawBelt, drawPulley, drawLabels, drawCenterDistanceLine, drawMotionMarker
    ]
  );

  // ── Animation loop ─────────────────────────────────────────────────────────

  const driverRotRef = useRef(0);
  const drivenRotRef = useRef(0);

  useEffect(() => {
    if (!animating) {
      draw(beltOffsetRef.current);
      return;
    }

    const geo = computeBeltGeometry(driver, driven, system);
    const driverGeo = computePulleyGeometry(driver, system);

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const omega1 = (2 * Math.PI * driver.rpm * system.animationSpeed) / 60;
      const omega2 = omega1 / geo.speedRatio;
      void omega2; // used for rotation direction only

      driverRotRef.current += (omega1 * dt * 180) / Math.PI;
      drivenRotRef.current += (omega1 / geo.speedRatio * dt * 180) / Math.PI;

      // Belt offset: belt moves at belt speed
      const beltSpeedPx = driverGeo.pitchRadius * scale * omega1 * dt;
      beltOffsetRef.current += beltSpeedPx;

      // Update pulley rotations by mutating the objects (canvas reads them)
      driver.rotationDeg = driverRotRef.current;
      driven.rotationDeg = system.beltConfig === "open"
        ? -drivenRotRef.current  // open belt: opposite rotation
        : drivenRotRef.current;  // crossed belt: same rotation

      draw(beltOffsetRef.current);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = 0;
    };
  }, [animating, driver, driven, system, draw, scale]);

  useEffect(() => {
    if (!animating) {
      draw(beltOffsetRef.current);
    }
  }, [draw, animating]);

  // ── Mouse interactions ─────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);

      // Check if clicking on a pulley
      const driverGeo = computePulleyGeometry(driver, system);
      const drivenGeo = computePulleyGeometry(driven, system);

      const distDriver = Math.sqrt(
        (world.x - driver.centerX) ** 2 + (world.y - driver.centerY) ** 2
      );
      const distDriven = Math.sqrt(
        (world.x - driven.centerX) ** 2 + (world.y - driven.centerY) ** 2
      );

      if (distDriver <= driverGeo.pitchRadius) {
        onSelectPulley(driver.id);
        return;
      }
      if (distDriven <= drivenGeo.pitchRadius) {
        onSelectPulley(driven.id);
        return;
      }

      // Start panning
      onSelectPulley(null);
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    },
    [driver, driven, system, screenToWorld, onSelectPulley]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => {
        const newZ = Math.max(0.2, Math.min(10, z * factor));
        zoomRef.current = newZ;
        return newZ;
      });
    },
    []
  );

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    zoomRef.current = 1;
  };

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDistRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / lastPinchDistRef.current;
      lastPinchDistRef.current = dist;
      setZoom((z) => {
        const newZ = Math.max(0.2, Math.min(10, z * factor));
        zoomRef.current = newZ;
        return newZ;
      });
    }
  }, []);

  // ── Warnings badge ─────────────────────────────────────────────────────────
  const errors = warnings.filter((w) => w.severity === "error");
  const warningsList = warnings.filter((w) => w.severity === "warning");
  const infos = warnings.filter((w) => w.severity === "info");

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#f8f8f8] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { lastPinchDistRef.current = null; }}
      />

      {/* Reset view button */}
      <button
        onClick={handleResetView}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-gray-500 transition-colors"
        title="Reset view"
      >
        <Maximize2 size={14} />
      </button>

      {/* Warnings badge */}
      {warnings.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-1 max-w-[300px]">
          {errors.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1.5 text-xs text-red-700">
              <XCircle size={12} className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
          {warningsList.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs text-amber-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
          {infos.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-xs text-blue-700">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* No warnings badge */}
      {warnings.length === 0 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs text-green-700">
          <CheckCircle2 size={11} />
          <span>Valid configuration</span>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute top-3 left-3 text-[10px] text-gray-400 bg-white/70 rounded px-1.5 py-0.5 border border-gray-100">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
