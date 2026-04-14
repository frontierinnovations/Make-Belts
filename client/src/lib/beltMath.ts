/**
 * Belt Drive Mathematics Library
 *
 * Implements geometry, kinematics, and power transmission formulas
 * for flat belts, V-belts, and timing (synchronous) belts.
 *
 * Key references:
 * - ISO 22: V-belt cross-sections
 * - ISO 5294: Synchronous belt drives
 * - Shigley's Mechanical Engineering Design, Chapter 17
 * - tec-science.com belt drive series
 *
 * Coordinate system: mm, radians internally; degrees for UI display.
 * Canvas: world origin at center, Y-axis points down (canvas convention).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BeltType = "flat" | "vbelt" | "timing" | "round";
export type BeltConfig = "open" | "crossed";

export type VBeltSection = "Z" | "A" | "B" | "C" | "D" | "E" | "SPZ" | "SPA" | "SPB" | "SPC";
export type TimingProfile = "GT2" | "GT3" | "HTD3M" | "HTD5M" | "GT5" | "HTD8M" | "HTD14M" | "T5" | "T10" | "AT5" | "AT10";

export const PULLEY_COLORS = [
  "#4a90d9",
  "#e8734a",
  "#5cb85c",
  "#9b59b6",
  "#f0ad4e",
  "#d9534f",
  "#5bc0de",
  "#e91e8c",
];

// ─── Standard Data Tables ─────────────────────────────────────────────────────

export interface VBeltSectionData {
  section: VBeltSection;
  topWidth: number;   // mm
  height: number;     // mm
  grooveAngle: number; // degrees (half-angle of groove)
  pitchOffset: number; // mm from bottom (pitch line offset)
  minPulleyDiameter: number; // mm
}

export const V_BELT_SECTIONS: Record<VBeltSection, VBeltSectionData> = {
  Z:   { section: "Z",   topWidth: 10,   height: 6,  grooveAngle: 20, pitchOffset: 2.0, minPulleyDiameter: 50  },
  A:   { section: "A",   topWidth: 13,   height: 8,  grooveAngle: 20, pitchOffset: 2.8, minPulleyDiameter: 75  },
  B:   { section: "B",   topWidth: 17,   height: 11, grooveAngle: 20, pitchOffset: 3.5, minPulleyDiameter: 125 },
  C:   { section: "C",   topWidth: 22,   height: 14, grooveAngle: 20, pitchOffset: 4.8, minPulleyDiameter: 200 },
  D:   { section: "D",   topWidth: 32,   height: 19, grooveAngle: 20, pitchOffset: 6.9, minPulleyDiameter: 355 },
  E:   { section: "E",   topWidth: 38,   height: 23, grooveAngle: 20, pitchOffset: 8.1, minPulleyDiameter: 500 },
  SPZ: { section: "SPZ", topWidth: 10,   height: 8,  grooveAngle: 17, pitchOffset: 2.0, minPulleyDiameter: 63  },
  SPA: { section: "SPA", topWidth: 13,   height: 10, grooveAngle: 17, pitchOffset: 2.8, minPulleyDiameter: 90  },
  SPB: { section: "SPB", topWidth: 17,   height: 13, grooveAngle: 17, pitchOffset: 3.5, minPulleyDiameter: 140 },
  SPC: { section: "SPC", topWidth: 22,   height: 18, grooveAngle: 17, pitchOffset: 4.8, minPulleyDiameter: 224 },
};

export interface TimingProfileData {
  profile: TimingProfile;
  pitch: number;      // mm
  minTeeth: number;
  maxPower: number;   // kW (approximate)
  description: string;
  toothHeight: number; // mm (approximate for drawing)
  toothWidth: number;  // mm (at pitch line)
}

export const TIMING_PROFILES: Record<TimingProfile, TimingProfileData> = {
  GT2:   { profile: "GT2",   pitch: 2,    minTeeth: 12, maxPower: 0.5,  description: "GT2 2mm — 3D printers, light robotics",  toothHeight: 0.75, toothWidth: 1.0  },
  GT3:   { profile: "GT3",   pitch: 3,    minTeeth: 12, maxPower: 5,    description: "GT3 3mm — small drives up to 5 kW",       toothHeight: 1.14, toothWidth: 1.5  },
  HTD3M: { profile: "HTD3M", pitch: 3,    minTeeth: 12, maxPower: 4,    description: "HTD 3M — small drives",                  toothHeight: 1.17, toothWidth: 1.5  },
  HTD5M: { profile: "HTD5M", pitch: 5,    minTeeth: 14, maxPower: 30,   description: "HTD 5M — general industrial 2–30 kW",    toothHeight: 2.06, toothWidth: 2.5  },
  GT5:   { profile: "GT5",   pitch: 5,    minTeeth: 14, maxPower: 35,   description: "GT5 5mm — improved HTD5M",               toothHeight: 2.06, toothWidth: 2.5  },
  HTD8M: { profile: "HTD8M", pitch: 8,    minTeeth: 22, maxPower: 100,  description: "HTD 8M — heavy industrial 10–100 kW",    toothHeight: 3.36, toothWidth: 4.0  },
  HTD14M:{ profile: "HTD14M",pitch: 14,   minTeeth: 28, maxPower: 250,  description: "HTD 14M — very heavy duty 50–250+ kW",   toothHeight: 6.02, toothWidth: 7.0  },
  T5:    { profile: "T5",    pitch: 5,    minTeeth: 10, maxPower: 5,    description: "T5 5mm — office machines",               toothHeight: 1.2,  toothWidth: 2.5  },
  T10:   { profile: "T10",   pitch: 10,   minTeeth: 12, maxPower: 20,   description: "T10 10mm — medium industrial",           toothHeight: 2.5,  toothWidth: 5.0  },
  AT5:   { profile: "AT5",   pitch: 5,    minTeeth: 12, maxPower: 8,    description: "AT5 5mm — high torque",                  toothHeight: 1.2,  toothWidth: 2.5  },
  AT10:  { profile: "AT10",  pitch: 10,   minTeeth: 12, maxPower: 40,   description: "AT10 10mm — high torque heavy",          toothHeight: 2.5,  toothWidth: 5.0  },
};

// ─── Pulley Parameters ────────────────────────────────────────────────────────

export interface PulleyParams {
  id: string;
  name: string;
  /** Number of teeth (timing belt) or 0 for friction belts */
  teeth: number;
  /** Pitch diameter in mm (for friction belts). For timing: computed from teeth × pitch / π */
  diameter: number;
  centerX: number;
  centerY: number;
  rotationDeg: number;
  color: string;
  bore: number;
  /** Number of spokes for visual rendering (0 = solid disc) */
  spokes: number;
  /** Input RPM (only meaningful for driver pulley) */
  rpm: number;
  /** Whether this is the driver (input) pulley */
  isDriver: boolean;
  /** For timing belt: number of teeth on this pulley */
  timingTeeth: number;
}

export interface BeltSystemParams {
  id: string;
  beltType: BeltType;
  beltConfig: BeltConfig;
  /** V-belt section (only for beltType === "vbelt") */
  vbeltSection: VBeltSection;
  /** Timing belt profile (only for beltType === "timing") */
  timingProfile: TimingProfile;
  /** Flat belt thickness in mm */
  flatBeltThickness: number;
  /** Belt width in mm */
  beltWidth: number;
  /** Friction coefficient (flat/V-belt) */
  frictionCoeff: number;
  /** Belt mass per unit length (kg/m) for centrifugal force calc */
  beltMassPerMeter: number;
  /** Input power in watts */
  inputPower: number;
  /** Whether to show guide circles */
  showGuides: boolean;
  /** Whether to show labels */
  showLabels: boolean;
  /** Whether to show grid */
  showGrid: boolean;
  /** Pixels per mm for canvas scale */
  pixelsPerMm: number;
  /** Animation speed multiplier */
  animationSpeed: number;
  /** Number of belt strands (for V-belt multi-strand) */
  numBelts: number;
}

// ─── Computed Geometry ────────────────────────────────────────────────────────

export interface PulleyGeometry {
  pitchDiameter: number;
  pitchRadius: number;
  outsideDiameter: number;
  outsideRadius: number;
}

export interface BeltGeometry {
  /** Center distance (mm) */
  centerDistance: number;
  /** Inclination angle α (radians) */
  inclinationAngle: number;
  /** Wrap angle on small pulley (radians) */
  wrapAngleSmall: number;
  /** Wrap angle on large pulley (radians) */
  wrapAngleLarge: number;
  /** Belt length (mm) */
  beltLength: number;
  /** For timing belt: belt length in teeth (rounded) */
  beltTeeth: number;
  /** Actual belt length after rounding to teeth (mm) */
  actualBeltLength: number;
  /** Actual center distance after belt tooth rounding */
  actualCenterDistance: number;
  /** Belt speed (m/s) */
  beltSpeed: number;
  /** Speed ratio */
  speedRatio: number;
  /** Output RPM */
  outputRpm: number;
  /** Effective (tangential) force (N) */
  effectiveTension: number;
  /** Tight side tension (N) */
  tightSideTension: number;
  /** Slack side tension (N) */
  slackSideTension: number;
  /** Centrifugal force (N) */
  centrifugalForce: number;
  /** Initial (pre-tension) (N) */
  initialTension: number;
  /** Shaft bearing force (N) */
  shaftLoad: number;
  /** Transmitted power (W) */
  transmittedPower: number;
  /** Efficiency (0–1) */
  efficiency: number;
  /** Driver torque (N·m) */
  driverTorque: number;
  /** Driven torque (N·m) */
  drivenTorque: number;
  /** Tangent points for drawing */
  tangentPoints: TangentPoints;
}

export interface TangentPoints {
  /** Upper tangent: from driver to driven */
  upperStart: { x: number; y: number };
  upperEnd: { x: number; y: number };
  /** Lower tangent: from driven to driver */
  lowerStart: { x: number; y: number };
  lowerEnd: { x: number; y: number };
  /** Arc start/end angles on driver pulley (radians) */
  driverArcStart: number;
  driverArcEnd: number;
  /** Arc start/end angles on driven pulley (radians) */
  drivenArcStart: number;
  drivenArcEnd: number;
  /**
   * Canvas arc direction flags.
   * true  = anticlockwise in canvas coords (= clockwise in math, Y-down)
   * false = clockwise in canvas coords (= counterclockwise in math, Y-down)
   */
  driverArcAnticlockwise: boolean;
  drivenArcAnticlockwise: boolean;
}

export interface BeltWarning {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

// ─── Geometry Computation ─────────────────────────────────────────────────────

export function computePulleyGeometry(
  pulley: PulleyParams,
  system: BeltSystemParams
): PulleyGeometry {
  let pitchDiameter: number;
  let outsideDiameter: number;

  if (system.beltType === "timing") {
    const profile = TIMING_PROFILES[system.timingProfile];
    const teeth = pulley.timingTeeth > 0 ? pulley.timingTeeth : Math.max(profile.minTeeth, 20);
    pitchDiameter = (teeth * profile.pitch) / Math.PI;
    outsideDiameter = pitchDiameter - 2 * profile.toothHeight * 0.5; // approximate OD
  } else {
    pitchDiameter = pulley.diameter;
    outsideDiameter = pulley.diameter;
  }

  return {
    pitchDiameter,
    pitchRadius: pitchDiameter / 2,
    outsideDiameter,
    outsideRadius: outsideDiameter / 2,
  };
}

/**
 * Compute effective friction coefficient for V-belt (wedging effect)
 * μ_eff = μ / sin(β/2) where β = groove angle (full angle)
 */
export function effectiveFrictionCoeff(
  mu: number,
  beltType: BeltType,
  vbeltSection: VBeltSection
): number {
  if (beltType !== "vbelt") return mu;
  const sectionData = V_BELT_SECTIONS[vbeltSection];
  const halfGrooveAngle = (sectionData.grooveAngle * Math.PI) / 180;
  return mu / Math.sin(halfGrooveAngle);
}

/**
 * Compute all belt drive geometry given two pulleys and system parameters.
 */
export function computeBeltGeometry(
  driver: PulleyParams,
  driven: PulleyParams,
  system: BeltSystemParams
): BeltGeometry {
  const driverGeo = computePulleyGeometry(driver, system);
  const drivenGeo = computePulleyGeometry(driven, system);

  const r1 = driverGeo.pitchRadius;
  const r2 = drivenGeo.pitchRadius;
  const d1 = driverGeo.pitchDiameter;
  const d2 = drivenGeo.pitchDiameter;

  const dx = driven.centerX - driver.centerX;
  const dy = driven.centerY - driver.centerY;
  const C = Math.sqrt(dx * dx + dy * dy);
  const centerAngle = Math.atan2(dy, dx);

  // ── Inclination angle ──────────────────────────────────────────────────────
  let alpha: number;
  let wrapSmall: number;
  let wrapLarge: number;

  if (system.beltConfig === "open") {
    // sin(α) = (r2 - r1) / C  (or (d2-d1)/(2C))
    const sinAlpha = Math.abs(r2 - r1) / C;
    alpha = sinAlpha >= 1 ? Math.PI / 2 : Math.asin(Math.min(1, sinAlpha));
    // Wrap angles
    wrapSmall = Math.PI - 2 * alpha;  // smaller pulley always gets less wrap
    wrapLarge = Math.PI + 2 * alpha;
    // Assign correctly based on which is smaller
    if (r1 <= r2) {
      wrapSmall = Math.PI - 2 * alpha;
      wrapLarge = Math.PI + 2 * alpha;
    } else {
      wrapSmall = Math.PI - 2 * alpha;
      wrapLarge = Math.PI + 2 * alpha;
    }
  } else {
    // Crossed belt: sin(α) = (r1 + r2) / C
    const sinAlpha = (r1 + r2) / C;
    alpha = sinAlpha >= 1 ? Math.PI / 2 : Math.asin(Math.min(1, sinAlpha));
    wrapSmall = Math.PI + 2 * alpha;
    wrapLarge = Math.PI + 2 * alpha;
  }

  // ── Belt length ────────────────────────────────────────────────────────────
  let beltLength: number;
  if (system.beltConfig === "open") {
    // Exact: L = 2·C·cos(α) + π(d1+d2)/2 + (d2-d1)·α
    beltLength = 2 * C * Math.cos(alpha) + (Math.PI / 2) * (d1 + d2) + (d2 - d1) * alpha;
  } else {
    // Crossed: L = 2·C·cos(α) + π(d1+d2)/2 + (d1+d2)·α
    beltLength = 2 * C * Math.cos(alpha) + (Math.PI / 2) * (d1 + d2) + (d1 + d2) * alpha;
  }

  // ── Timing belt: round to integer teeth ───────────────────────────────────
  let beltTeeth = 0;
  let actualBeltLength = beltLength;
  let actualCenterDistance = C;

  if (system.beltType === "timing") {
    const profile = TIMING_PROFILES[system.timingProfile];
    beltTeeth = Math.ceil(beltLength / profile.pitch);
    // Round to even number (standard practice)
    if (beltTeeth % 2 !== 0) beltTeeth += 1;
    actualBeltLength = beltTeeth * profile.pitch;
    // Recompute actual center distance from rounded belt length
    actualCenterDistance = computeCenterDistanceFromBeltLength(
      actualBeltLength, d1, d2
    );
  }

  // ── Kinematics ─────────────────────────────────────────────────────────────
  const speedRatio = d2 / d1; // > 1 means speed reduction
  const outputRpm = driver.rpm / speedRatio;
  const beltSpeed = (Math.PI * d1 * driver.rpm) / (60 * 1000); // m/s (d1 in mm → /1000)

  // ── Forces ─────────────────────────────────────────────────────────────────
  const muEff = effectiveFrictionCoeff(
    system.frictionCoeff,
    system.beltType,
    system.vbeltSection
  );
  // Use wrap angle of the smaller pulley (limiting factor)
  const limitingWrap = Math.min(wrapSmall, wrapLarge);
  const eulerRatio = Math.exp(muEff * limitingWrap);

  // Centrifugal force: Fc = m' × v²
  const centrifugalForce = system.beltMassPerMeter * beltSpeed * beltSpeed;

  // Effective tension from power
  const effectiveTension = beltSpeed > 0 ? system.inputPower / beltSpeed : 0;

  // From Euler: (F_tight - Fc) / (F_slack - Fc) = e^(μφ)
  // F_tight - F_slack = F_e
  // F_tight = F_e × e^(μφ) / (e^(μφ) - 1) + Fc
  // F_slack = F_e / (e^(μφ) - 1) + Fc
  let tightSideTension: number;
  let slackSideTension: number;

  if (system.beltType === "timing") {
    // Timing belts: no slip, tension calculated differently
    tightSideTension = effectiveTension * 0.6 + centrifugalForce;
    slackSideTension = effectiveTension * 0.4 + centrifugalForce;
  } else {
    tightSideTension = effectiveTension * eulerRatio / (eulerRatio - 1) + centrifugalForce;
    slackSideTension = effectiveTension / (eulerRatio - 1) + centrifugalForce;
  }

  // Initial tension (pre-tension)
  const initialTension = (tightSideTension + slackSideTension) / 2;

  // Shaft load (bearing force) — approximate for open belt
  const shaftLoad = Math.sqrt(
    tightSideTension * tightSideTension +
    slackSideTension * slackSideTension +
    2 * tightSideTension * slackSideTension * Math.cos(Math.PI - limitingWrap)
  );

  // Efficiency
  let efficiency: number;
  if (system.beltType === "timing") {
    efficiency = 0.98 + 0.01 * Math.random() * 0; // ~98%
    efficiency = 0.98;
  } else if (system.beltType === "flat") {
    efficiency = 0.97;
  } else if (system.beltType === "vbelt") {
    efficiency = 0.94;
  } else {
    efficiency = 0.95;
  }

  const transmittedPower = system.inputPower * efficiency;

  // Torques
  const omega1 = (2 * Math.PI * driver.rpm) / 60;
  const omega2 = (2 * Math.PI * outputRpm) / 60;
  const driverTorque = omega1 > 0 ? system.inputPower / omega1 : 0;
  const drivenTorque = omega2 > 0 ? transmittedPower / omega2 : 0;

  // ── Tangent points ─────────────────────────────────────────────────────────
  const tangentPoints = computeTangentPoints(
    driver.centerX, driver.centerY, r1,
    driven.centerX, driven.centerY, r2,
    system.beltConfig, centerAngle, alpha
  );

  return {
    centerDistance: C,
    inclinationAngle: alpha,
    wrapAngleSmall: wrapSmall,
    wrapAngleLarge: wrapLarge,
    beltLength,
    beltTeeth,
    actualBeltLength,
    actualCenterDistance,
    beltSpeed,
    speedRatio,
    outputRpm,
    effectiveTension,
    tightSideTension,
    slackSideTension,
    centrifugalForce,
    initialTension,
    shaftLoad,
    transmittedPower,
    efficiency,
    driverTorque,
    drivenTorque,
    tangentPoints,
  };
}

/**
 * Compute center distance from a known belt length (approximate formula).
 * Inverse of belt length formula.
 */
export function computeCenterDistanceFromBeltLength(
  L: number,
  d1: number,
  d2: number
): number {
  // Approximate: e ≈ (1/4)[L - π(d1+d2)/2] + sqrt{[(1/4)(L - π(d1+d2)/2)]² - (d2-d1)²/8}
  const A = L / 4 - (Math.PI / 8) * (d1 + d2);
  const discriminant = A * A - (d2 - d1) * (d2 - d1) / 8;
  if (discriminant < 0) return A; // fallback
  return A + Math.sqrt(discriminant);
}

/**
 * Compute tangent points for drawing the belt.
 *
 * OPEN BELT — external tangent of two circles:
 *   The line connecting centers makes angle θ = atan2(dy, dx).
 *   The tangent offset angle from the center line is:
 *     α = asin((r2 − r1) / C)   (positive when r2 > r1)
 *
 *   On the DRIVER (circle 1, left):
 *     upper tangent point: angle = θ + π/2 + α   (belt leaves going "up-right")
 *     lower tangent point: angle = θ − π/2 − α   (belt leaves going "down-right")
 *
 *   On the DRIVEN (circle 2, right):
 *     upper tangent point: angle = θ + π/2 + α   (belt arrives from "up-left")
 *     lower tangent point: angle = θ − π/2 − α   (belt arrives from "down-left")
 *
 *   The belt wraps around the BACK of each pulley (the side away from the other pulley):
 *     Driver arc: from upper-tangent-angle going CW (anticlockwise in math, clockwise visually
 *                 in canvas Y-down) around the back to lower-tangent-angle.
 *     Driven arc: from upper-tangent-angle going CCW (clockwise in canvas) around the front
 *                 to lower-tangent-angle.
 *
 * CROSSED BELT — internal tangent:
 *   α = asin((r1 + r2) / C)
 *   Driver upper: θ + π/2 − α
 *   Driver lower: θ − π/2 + α
 *   Driven upper: θ + π/2 + α  (flipped)
 *   Driven lower: θ − π/2 − α
 */
function computeTangentPoints(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number,
  config: BeltConfig,
  centerAngle: number,
  alpha: number  // already computed by caller; sign convention: always ≥ 0
): TangentPoints {
  if (config === "open") {
    // alpha = asin(|r2 - r1| / C), but we need signed alpha:
    // positive when r2 > r1 (driven larger), negative when r1 > r2
    const signedAlpha = r2 >= r1 ? alpha : -alpha;

    // Tangent point angles on each pulley
    // Upper span: belt runs from driver (upper) to driven (upper)
    const driverUpperAngle = centerAngle + Math.PI / 2 + signedAlpha;
    const drivenUpperAngle = centerAngle + Math.PI / 2 + signedAlpha;

    // Lower span: belt runs from driven (lower) back to driver (lower)
    const driverLowerAngle = centerAngle - Math.PI / 2 - signedAlpha;
    const drivenLowerAngle = centerAngle - Math.PI / 2 - signedAlpha;

    const upperStart = {
      x: x1 + r1 * Math.cos(driverUpperAngle),
      y: y1 + r1 * Math.sin(driverUpperAngle),
    };
    const upperEnd = {
      x: x2 + r2 * Math.cos(drivenUpperAngle),
      y: y2 + r2 * Math.sin(drivenUpperAngle),
    };
    const lowerStart = {
      x: x2 + r2 * Math.cos(drivenLowerAngle),
      y: y2 + r2 * Math.sin(drivenLowerAngle),
    };
    const lowerEnd = {
      x: x1 + r1 * Math.cos(driverLowerAngle),
      y: y1 + r1 * Math.sin(driverLowerAngle),
    };

    // Arc angles for canvas drawing (Y-axis points DOWN in canvas):
    //
    // Driver arc: belt wraps around the LEFT/BACK side of the driver.
    //   We go from the lower tangent point, around the back (increasing angle, i.e.
    //   counterclockwise in math = clockwise visually), to the upper tangent point.
    //   canvas arc(cx, cy, r, startAngle, endAngle, anticlockwise=false) draws CW in screen.
    //   To go from driverLowerAngle → driverUpperAngle the short way around the back:
    //   Use anticlockwise = true (math CCW = screen CW when Y is flipped).
    //
    // Driven arc: belt wraps around the RIGHT/FRONT side of the driven.
    //   We go from the upper tangent point, around the front (decreasing angle),
    //   to the lower tangent point.
    //   Use anticlockwise = false (math CW = screen CCW when Y is flipped).
    //
    // We encode the anticlockwise flag in the TangentPoints by storing
    // the angles in the order that canvas ctx.arc() should use them with
    // anticlockwise = false for driven and anticlockwise = true for driver.
    // The BeltCanvas drawBelt function must use these flags.

    return {
      upperStart,
      upperEnd,
      lowerStart,
      lowerEnd,
      // Driver arc: goes from upper tangent point ANTICLOCKWISE (in canvas Y-down coords)
      // around the back of the driver to the lower tangent point.
      // In canvas: anticlockwise=true means going in the direction of decreasing angle
      // (which is the "back" side when driver is to the left of driven).
      driverArcStart: driverUpperAngle,
      driverArcEnd: driverLowerAngle,
      driverArcAnticlockwise: true,
      // Driven arc: goes from upper tangent point CLOCKWISE (in canvas Y-down coords)
      // around the front of the driven to the lower tangent point.
      // In canvas: anticlockwise=false means going in the direction of increasing angle.
      drivenArcStart: drivenUpperAngle,
      drivenArcEnd: drivenLowerAngle,
      drivenArcAnticlockwise: false,
    };
  } else {
    // ── Crossed belt ──────────────────────────────────────────────────────────
    // alpha = asin((r1 + r2) / C)
    // Internal tangent: the two spans cross between the pulleys.
    //
    // Driver upper: belt leaves at θ + π/2 − α
    // Driver lower: belt leaves at θ − π/2 + α
    // Driven upper: belt arrives at θ − π/2 + α  (same side as driver lower — they cross)
    // Driven lower: belt arrives at θ + π/2 − α

    const driverUpperAngle = centerAngle + Math.PI / 2 - alpha;
    const driverLowerAngle = centerAngle - Math.PI / 2 + alpha;
    const drivenUpperAngle = centerAngle - Math.PI / 2 + alpha + Math.PI; // π offset = other side
    const drivenLowerAngle = centerAngle + Math.PI / 2 - alpha + Math.PI;

    const upperStart = {
      x: x1 + r1 * Math.cos(driverUpperAngle),
      y: y1 + r1 * Math.sin(driverUpperAngle),
    };
    const upperEnd = {
      x: x2 + r2 * Math.cos(drivenUpperAngle),
      y: y2 + r2 * Math.sin(drivenUpperAngle),
    };
    const lowerStart = {
      x: x2 + r2 * Math.cos(drivenLowerAngle),
      y: y2 + r2 * Math.sin(drivenLowerAngle),
    };
    const lowerEnd = {
      x: x1 + r1 * Math.cos(driverLowerAngle),
      y: y1 + r1 * Math.sin(driverLowerAngle),
    };

    return {
      upperStart,
      upperEnd,
      lowerStart,
      lowerEnd,
      driverArcStart: driverUpperAngle,
      driverArcEnd: driverLowerAngle,
      driverArcAnticlockwise: true,
      drivenArcStart: drivenUpperAngle,
      drivenArcEnd: drivenLowerAngle,
      drivenArcAnticlockwise: true,
    };
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateBeltSystem(
  driver: PulleyParams,
  driven: PulleyParams,
  system: BeltSystemParams,
  geo: BeltGeometry
): BeltWarning[] {
  const warnings: BeltWarning[] = [];
  const driverGeo = computePulleyGeometry(driver, system);
  const drivenGeo = computePulleyGeometry(driven, system);

  // Center distance check
  const dSum = driverGeo.pitchDiameter + drivenGeo.pitchDiameter;
  if (geo.centerDistance < 0.7 * dSum) {
    warnings.push({
      severity: "error",
      code: "CENTER_DIST_TOO_SMALL",
      message: `Center distance (${geo.centerDistance.toFixed(1)} mm) is too small. Minimum: ${(0.7 * dSum).toFixed(1)} mm`,
    });
  } else if (geo.centerDistance > 2 * dSum) {
    warnings.push({
      severity: "warning",
      code: "CENTER_DIST_TOO_LARGE",
      message: `Center distance (${geo.centerDistance.toFixed(1)} mm) may be too large. Maximum recommended: ${(2 * dSum).toFixed(1)} mm`,
    });
  }

  // Wrap angle check
  const wrapDeg = (geo.wrapAngleSmall * 180) / Math.PI;
  if (wrapDeg < 120) {
    warnings.push({
      severity: "error",
      code: "WRAP_ANGLE_TOO_SMALL",
      message: `Wrap angle on small pulley (${wrapDeg.toFixed(1)}°) is below 120°. Risk of slipping.`,
    });
  } else if (wrapDeg < 150) {
    warnings.push({
      severity: "warning",
      code: "WRAP_ANGLE_LOW",
      message: `Wrap angle on small pulley (${wrapDeg.toFixed(1)}°) is below 150°. Consider increasing center distance.`,
    });
  }

  // Speed ratio check
  const maxRatio = system.beltType === "timing" ? 10 : 7;
  if (geo.speedRatio > maxRatio) {
    warnings.push({
      severity: "warning",
      code: "SPEED_RATIO_HIGH",
      message: `Speed ratio ${geo.speedRatio.toFixed(2)}:1 exceeds recommended maximum of ${maxRatio}:1.`,
    });
  }

  // Belt speed check
  const maxSpeed = system.beltType === "timing" ? 80 : system.beltType === "flat" ? 50 : 30;
  if (geo.beltSpeed > maxSpeed) {
    warnings.push({
      severity: "warning",
      code: "BELT_SPEED_HIGH",
      message: `Belt speed (${geo.beltSpeed.toFixed(1)} m/s) exceeds recommended maximum of ${maxSpeed} m/s.`,
    });
  } else if (geo.beltSpeed < 5 && system.beltType === "vbelt") {
    warnings.push({
      severity: "info",
      code: "BELT_SPEED_LOW",
      message: `Belt speed (${geo.beltSpeed.toFixed(1)} m/s) is below optimal range for V-belts (5–30 m/s).`,
    });
  }

  // Minimum pulley diameter for V-belt
  if (system.beltType === "vbelt") {
    const sectionData = V_BELT_SECTIONS[system.vbeltSection];
    if (driverGeo.pitchDiameter < sectionData.minPulleyDiameter) {
      warnings.push({
        severity: "error",
        code: "PULLEY_TOO_SMALL",
        message: `Driver pulley diameter (${driverGeo.pitchDiameter.toFixed(0)} mm) is below minimum for ${system.vbeltSection} section (${sectionData.minPulleyDiameter} mm).`,
      });
    }
    if (drivenGeo.pitchDiameter < sectionData.minPulleyDiameter) {
      warnings.push({
        severity: "error",
        code: "PULLEY_TOO_SMALL",
        message: `Driven pulley diameter (${drivenGeo.pitchDiameter.toFixed(0)} mm) is below minimum for ${system.vbeltSection} section (${sectionData.minPulleyDiameter} mm).`,
      });
    }
  }

  // Timing belt minimum teeth
  if (system.beltType === "timing") {
    const profile = TIMING_PROFILES[system.timingProfile];
    if (driver.timingTeeth < profile.minTeeth) {
      warnings.push({
        severity: "error",
        code: "TOO_FEW_TEETH",
        message: `Driver pulley has ${driver.timingTeeth} teeth, below minimum of ${profile.minTeeth} for ${system.timingProfile}.`,
      });
    }
    if (driven.timingTeeth < profile.minTeeth) {
      warnings.push({
        severity: "error",
        code: "TOO_FEW_TEETH",
        message: `Driven pulley has ${driven.timingTeeth} teeth, below minimum of ${profile.minTeeth} for ${system.timingProfile}.`,
      });
    }
  }

  // Pulley overlap check
  const minClearance = (driverGeo.pitchRadius + drivenGeo.pitchRadius) * 1.05;
  if (geo.centerDistance < minClearance) {
    warnings.push({
      severity: "error",
      code: "PULLEYS_OVERLAP",
      message: "Pulleys overlap! Increase center distance.",
    });
  }

  return warnings;
}

// ─── Default Factories ────────────────────────────────────────────────────────

export function createDefaultPulley(id: string, overrides: Partial<PulleyParams> = {}): PulleyParams {
  return {
    id,
    name: "Pulley",
    teeth: 0,
    diameter: 80,
    centerX: 0,
    centerY: 0,
    rotationDeg: 0,
    color: PULLEY_COLORS[0],
    bore: 20,
    spokes: 5,
    rpm: 1450,
    isDriver: false,
    timingTeeth: 20,
    ...overrides,
  };
}

export function createDefaultSystem(overrides: Partial<BeltSystemParams> = {}): BeltSystemParams {
  return {
    id: "system-1",
    beltType: "vbelt",
    beltConfig: "open",
    vbeltSection: "A",
    timingProfile: "HTD5M",
    flatBeltThickness: 5,
    beltWidth: 25,
    frictionCoeff: 0.35,
    beltMassPerMeter: 0.3,
    inputPower: 1500,
    showGuides: true,
    showLabels: true,
    showGrid: true,
    pixelsPerMm: 3,
    animationSpeed: 1,
    numBelts: 1,
    ...overrides,
  };
}

// ─── SVG Export ───────────────────────────────────────────────────────────────

export function exportBeltSystemToSvg(
  driver: PulleyParams,
  driven: PulleyParams,
  system: BeltSystemParams,
  geo: BeltGeometry
): string {
  const driverGeo = computePulleyGeometry(driver, system);
  const drivenGeo = computePulleyGeometry(driven, system);

  const padding = 40;
  const allX = [
    driver.centerX - driverGeo.pitchRadius,
    driver.centerX + driverGeo.pitchRadius,
    driven.centerX - drivenGeo.pitchRadius,
    driven.centerX + drivenGeo.pitchRadius,
  ];
  const allY = [
    driver.centerY - driverGeo.pitchRadius,
    driver.centerY + driverGeo.pitchRadius,
    driven.centerY - drivenGeo.pitchRadius,
    driven.centerY + drivenGeo.pitchRadius,
  ];
  const minX = Math.min(...allX) - padding;
  const minY = Math.min(...allY) - padding;
  const maxX = Math.max(...allX) + padding;
  const maxY = Math.max(...allY) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  const tp = geo.tangentPoints;

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`,
    `<title>Belt Drive — ${system.beltType} ${system.beltConfig}</title>`,
    `<g id="belt" stroke="#555" stroke-width="3" fill="none">`,
    `  <line x1="${tp.upperStart.x}" y1="${tp.upperStart.y}" x2="${tp.upperEnd.x}" y2="${tp.upperEnd.y}"/>`,
    `  <line x1="${tp.lowerStart.x}" y1="${tp.lowerStart.y}" x2="${tp.lowerEnd.x}" y2="${tp.lowerEnd.y}"/>`,
    `</g>`,
    `<g id="pulleys">`,
    `  <circle cx="${driver.centerX}" cy="${driver.centerY}" r="${driverGeo.pitchRadius}" fill="${driver.color}" fill-opacity="0.8" stroke="${driver.color}" stroke-width="1.5"/>`,
    `  <circle cx="${driver.centerX}" cy="${driver.centerY}" r="${driver.bore / 2}" fill="white" stroke="#555" stroke-width="1"/>`,
    `  <circle cx="${driven.centerX}" cy="${driven.centerY}" r="${drivenGeo.pitchRadius}" fill="${driven.color}" fill-opacity="0.8" stroke="${driven.color}" stroke-width="1.5"/>`,
    `  <circle cx="${driven.centerX}" cy="${driven.centerY}" r="${driven.bore / 2}" fill="white" stroke="#555" stroke-width="1"/>`,
    `</g>`,
    `</svg>`,
  ];

  return lines.join("\n");
}

export function downloadSvg(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── DXF Export ───────────────────────────────────────────────────────────────

export function exportBeltSystemToDxf(
  driver: PulleyParams,
  driven: PulleyParams,
  system: BeltSystemParams,
  geo: BeltGeometry
): string {
  const driverGeo = computePulleyGeometry(driver, system);
  const drivenGeo = computePulleyGeometry(driven, system);
  const tp = geo.tangentPoints;

  const lines: string[] = [
    "0\nSECTION\n2\nHEADER\n0\nENDSEC",
    "0\nSECTION\n2\nENTITIES",
    // Driver pulley circle
    `0\nCIRCLE\n8\nDRIVER\n10\n${driver.centerX.toFixed(4)}\n20\n${(-driver.centerY).toFixed(4)}\n30\n0.0\n40\n${driverGeo.pitchRadius.toFixed(4)}`,
    // Driven pulley circle
    `0\nCIRCLE\n8\nDRIVEN\n10\n${driven.centerX.toFixed(4)}\n20\n${(-driven.centerY).toFixed(4)}\n30\n0.0\n40\n${drivenGeo.pitchRadius.toFixed(4)}`,
    // Bore holes
    `0\nCIRCLE\n8\nBORES\n10\n${driver.centerX.toFixed(4)}\n20\n${(-driver.centerY).toFixed(4)}\n30\n0.0\n40\n${(driver.bore / 2).toFixed(4)}`,
    `0\nCIRCLE\n8\nBORES\n10\n${driven.centerX.toFixed(4)}\n20\n${(-driven.centerY).toFixed(4)}\n30\n0.0\n40\n${(driven.bore / 2).toFixed(4)}`,
    // Belt tangent lines
    `0\nLINE\n8\nBELT\n10\n${tp.upperStart.x.toFixed(4)}\n20\n${(-tp.upperStart.y).toFixed(4)}\n30\n0.0\n11\n${tp.upperEnd.x.toFixed(4)}\n21\n${(-tp.upperEnd.y).toFixed(4)}\n31\n0.0`,
    `0\nLINE\n8\nBELT\n10\n${tp.lowerStart.x.toFixed(4)}\n20\n${(-tp.lowerStart.y).toFixed(4)}\n30\n0.0\n11\n${tp.lowerEnd.x.toFixed(4)}\n21\n${(-tp.lowerEnd.y).toFixed(4)}\n31\n0.0`,
    "0\nENDSEC\n0\nEOF",
  ];

  return lines.join("\n");
}

export function downloadDxf(dxfContent: string, filename: string): void {
  const blob = new Blob([dxfContent], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
