/**
 * pulleyMath.ts — Parametric Pulley Geometry Library
 *
 * Design Philosophy: Clean Utilitarian, matching Make-Gears/Make-Belts
 * Standards: ISO 22, RMA/MPTA, ISO 5294 (timing belts), Shigley's Ch.17
 *
 * Groove geometry sourced from:
 *  - RMA/MPTA IP-20: Classical V-belt sheave groove dimensions
 *  - ISO 4183: Classical and narrow V-belt pulleys
 *  - ISO 5294: Synchronous belt pulleys (timing)
 *  - O-ring groove: AS568 / ISO 3601 standard cross-sections
 */

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type GrooveType = "vbelt" | "obelt" | "flat" | "timing";
export type VBeltSection = "Z" | "A" | "B" | "C" | "D" | "E" | "SPZ" | "SPA" | "SPB" | "SPC";
export type TimingProfile = "GT2" | "GT3" | "GT5" | "HTD3M" | "HTD5M" | "HTD8M" | "T5" | "T10";
export type BoreType = "through" | "dshaft" | "keyway" | "setscrew";
export type SetScrewSize = "M3" | "M4" | "M5" | "M6" | "M8" | "M10";
export type WebStyle = "solid" | "spokes" | "fins" | "lightening";
export type PrintOrientation = "flat" | "upright";

/** V-belt groove geometry per RMA/MPTA IP-20 and ISO 4183 */
export interface VBeltGrooveSpec {
  section: VBeltSection;
  /** Top width of groove at pitch line (mm) */
  topWidth: number;
  /** Groove depth below pitch line (mm) */
  depth: number;
  /** Groove angle (included, degrees) — 34° or 38° depending on diameter */
  angle34: number; // used for smaller pulleys
  angle38: number; // used for larger pulleys
  /** Diameter threshold below which 34° applies (mm) */
  angleBreakDiameter: number;
  /** Minimum recommended pitch diameter (mm) */
  minPitchDiameter: number;
  /** Pitch line offset above groove bottom (mm) — belt pitch line sits here */
  pitchOffset: number;
  /** Belt cross-section width × height (mm) */
  beltWidth: number;
  beltHeight: number;
}

/** O-belt (round belt) groove geometry */
export interface OBeltGrooveSpec {
  /** Belt diameter (mm) */
  beltDiameter: number;
  /** Groove radius (slightly larger than belt radius for clearance) */
  grooveRadius: number;
  /** Groove depth (mm) */
  grooveDepth: number;
}

/** Timing belt pulley geometry per ISO 5294 / Gates/Bando datasheets */
export interface TimingGrooveSpec {
  profile: TimingProfile;
  /** Tooth pitch (mm) */
  pitch: number;
  /** Tooth depth (mm) */
  toothDepth: number;
  /** Tooth half-angle (degrees) */
  halfAngle: number;
  /** Root radius (mm) */
  rootRadius: number;
  /** Tip radius (mm) */
  tipRadius: number;
  /** Belt pitch line above tooth root (mm) */
  pitchLineOffset: number;
}

/** Keyway dimensions per ISO 773 / DIN 6885 */
export interface KeywaySpec {
  /** Shaft diameter range this applies to (mm) */
  shaftDiamMin: number;
  shaftDiamMax: number;
  /** Keyway width (mm) */
  width: number;
  /** Keyway depth in hub (mm) */
  hubDepth: number;
  /** Keyway depth in shaft (mm) */
  shaftDepth: number;
}

export interface PulleyParams {
  // ── Groove ──────────────────────────────────
  grooveType: GrooveType;
  vbeltSection: VBeltSection;
  timingProfile: TimingProfile;
  timingTeeth: number;         // for timing pulleys: number of teeth
  pitchDiameter: number;       // mm — outer/pitch diameter for V/flat/O, pitch circle for timing
  faceWidth: number;           // mm — total width of belt contact face
  numGrooves: number;          // number of parallel grooves (V-belt multi-groove)
  grooveSpacing: number;       // mm — center-to-center of grooves
  obeltDiameter: number;       // mm — O-belt cross-section diameter
  flatCrown: number;           // mm — crown height for flat belt pulleys (0 = no crown)

  // ── Bore ────────────────────────────────────
  boreType: BoreType;
  boreDiameter: number;        // mm — bore diameter
  bossHeight: number;          // mm — boss protrusion on one side (0 = flush)
  bossDiameter: number;        // mm — boss outer diameter
  dShaftFlatDepth: number;     // mm — flat cut depth from bore surface for D-profile
  keywaySizeLocked: boolean;   // if true, auto-select keyway from ISO 773
  setScrewSize: SetScrewSize;   // set screw size for setscrew bore type
  grooveAngle: 34 | 36 | 38 | 40; // V-belt groove angle override

  // ── Web ─────────────────────────────────────
  webStyle: WebStyle;
  hubDiameter: number;         // mm — hub outer diameter (around bore)
  hubLength: number;           // mm — hub axial length
  numSpokes: number;           // number of spokes (webStyle=spokes)
  spokeWidth: number;          // mm — spoke width
  numLighteningHoles: number;  // number of lightening holes (webStyle=lightening)
  lighteningHoleDiameter: number; // mm
  webThickness: number;        // mm — solid web thickness

  // ── 3D Print ────────────────────────────────
  printOptimized: boolean;
  printOrientation: PrintOrientation;
  wallThickness: number;       // mm — minimum wall thickness for FDM
  infillPercent: number;       // % — recommended infill
  addBrimNotch: boolean;       // add a notch at base for brim removal

  // ── Display ─────────────────────────────────
  showDimensions: boolean;
  showCenterlines: boolean;
  material: string;            // display only: "PLA" | "PETG" | "Nylon" | "Aluminum" | "Steel"
}

// ─────────────────────────────────────────────
// GROOVE LOOKUP TABLES
// ─────────────────────────────────────────────

/**
 * V-belt groove dimensions per RMA/MPTA IP-20 and ISO 4183.
 * Groove angle: 34° for small pulleys, 38° for large pulleys.
 * The pitch line sits at the neutral axis of the belt.
 */
export const V_BELT_GROOVES: Record<VBeltSection, VBeltGrooveSpec> = {
  Z: {
    section: "Z", topWidth: 10, depth: 8, angle34: 34, angle38: 38,
    angleBreakDiameter: 63, minPitchDiameter: 50,
    pitchOffset: 2.5, beltWidth: 10, beltHeight: 6,
  },
  A: {
    section: "A", topWidth: 13, depth: 10, angle34: 34, angle38: 38,
    angleBreakDiameter: 100, minPitchDiameter: 75,
    pitchOffset: 3.3, beltWidth: 13, beltHeight: 8,
  },
  B: {
    section: "B", topWidth: 17, depth: 13, angle34: 34, angle38: 38,
    angleBreakDiameter: 125, minPitchDiameter: 100,
    pitchOffset: 4.2, beltWidth: 17, beltHeight: 11,
  },
  C: {
    section: "C", topWidth: 22, depth: 17, angle34: 34, angle38: 38,
    angleBreakDiameter: 200, minPitchDiameter: 150,
    pitchOffset: 5.7, beltWidth: 22, beltHeight: 14,
  },
  D: {
    section: "D", topWidth: 32, depth: 24, angle34: 34, angle38: 38,
    angleBreakDiameter: 315, minPitchDiameter: 250,
    pitchOffset: 8.1, beltWidth: 32, beltHeight: 19,
  },
  E: {
    section: "E", topWidth: 38, depth: 29, angle34: 34, angle38: 38,
    angleBreakDiameter: 450, minPitchDiameter: 355,
    pitchOffset: 9.6, beltWidth: 38, beltHeight: 23,
  },
  SPZ: {
    section: "SPZ", topWidth: 10, depth: 8, angle34: 34, angle38: 38,
    angleBreakDiameter: 80, minPitchDiameter: 63,
    pitchOffset: 2.0, beltWidth: 10, beltHeight: 8,
  },
  SPA: {
    section: "SPA", topWidth: 13, depth: 10, angle34: 34, angle38: 38,
    angleBreakDiameter: 118, minPitchDiameter: 90,
    pitchOffset: 2.8, beltWidth: 13, beltHeight: 10,
  },
  SPB: {
    section: "SPB", topWidth: 17, depth: 14, angle34: 34, angle38: 38,
    angleBreakDiameter: 190, minPitchDiameter: 140,
    pitchOffset: 3.5, beltWidth: 17, beltHeight: 14,
  },
  SPC: {
    section: "SPC", topWidth: 22, depth: 18, angle34: 34, angle38: 38,
    angleBreakDiameter: 315, minPitchDiameter: 224,
    pitchOffset: 4.8, beltWidth: 22, beltHeight: 18,
  },
};

/**
 * O-belt groove specs. Standard O-belt cross-sections (mm diameter):
 * 3, 4, 5, 6, 8, 10, 12 mm.
 * Groove radius = belt radius + 0.5 mm clearance.
 * Groove depth = belt diameter × 0.6 (belt sits 40% proud of groove).
 */
export function getOBeltGrooveSpec(beltDiameter: number): OBeltGrooveSpec {
  const r = beltDiameter / 2;
  return {
    beltDiameter,
    grooveRadius: r + 0.3,
    grooveDepth: beltDiameter * 0.6,
  };
}

/**
 * Timing belt pulley tooth profiles per ISO 5294, Gates PowerGrip GT3,
 * and HTD (High Torque Drive) standards.
 */
export const TIMING_GROOVES: Record<TimingProfile, TimingGrooveSpec> = {
  GT2: {
    profile: "GT2", pitch: 2.0, toothDepth: 0.75, halfAngle: 20,
    rootRadius: 0.555, tipRadius: 0.15, pitchLineOffset: 0.254,
  },
  GT3: {
    profile: "GT3", pitch: 3.0, toothDepth: 1.14, halfAngle: 20,
    rootRadius: 0.85, tipRadius: 0.25, pitchLineOffset: 0.381,
  },
  GT5: {
    profile: "GT5", pitch: 5.0, toothDepth: 1.91, halfAngle: 20,
    rootRadius: 1.44, tipRadius: 0.42, pitchLineOffset: 0.635,
  },
  HTD3M: {
    profile: "HTD3M", pitch: 3.0, toothDepth: 1.17, halfAngle: 0,
    rootRadius: 1.0, tipRadius: 0.5, pitchLineOffset: 0.381,
  },
  HTD5M: {
    profile: "HTD5M", pitch: 5.0, toothDepth: 2.06, halfAngle: 0,
    rootRadius: 1.49, tipRadius: 0.75, pitchLineOffset: 0.635,
  },
  HTD8M: {
    profile: "HTD8M", pitch: 8.0, toothDepth: 3.36, halfAngle: 0,
    rootRadius: 2.4, tipRadius: 1.14, pitchLineOffset: 1.016,
  },
  T5: {
    profile: "T5", pitch: 5.0, toothDepth: 1.2, halfAngle: 25,
    rootRadius: 0.4, tipRadius: 0.4, pitchLineOffset: 0.6,
  },
  T10: {
    profile: "T10", pitch: 10.0, toothDepth: 2.5, halfAngle: 25,
    rootRadius: 0.8, tipRadius: 0.8, pitchLineOffset: 1.1,
  },
};

/**
 * Keyway dimensions per ISO 773 / DIN 6885 Sheet 1.
 * Parallel key (square/rectangular), form A.
 */
// Per ISO 773 / DIN 6885 Sheet 1 — Parallel keys, Form A
// hubDepth = keyway depth in hub (t2), shaftDepth = keyway depth in shaft (t1)
// Note: t1 + t2 = key height. For square keys (d ≤ 22): t1 = t2 = b/2.
// For rectangular keys (d > 22): t1 < t2 (shaft gets less depth).
export const KEYWAY_TABLE: KeywaySpec[] = [
  { shaftDiamMin: 6,   shaftDiamMax: 8,   width: 2,  hubDepth: 1.0, shaftDepth: 1.0 },
  { shaftDiamMin: 8,   shaftDiamMax: 10,  width: 3,  hubDepth: 1.4, shaftDepth: 1.4 },
  { shaftDiamMin: 10,  shaftDiamMax: 12,  width: 4,  hubDepth: 1.8, shaftDepth: 1.8 },
  { shaftDiamMin: 12,  shaftDiamMax: 17,  width: 5,  hubDepth: 2.3, shaftDepth: 2.3 },
  { shaftDiamMin: 17,  shaftDiamMax: 22,  width: 6,  hubDepth: 2.8, shaftDepth: 2.8 },
  { shaftDiamMin: 22,  shaftDiamMax: 30,  width: 8,  hubDepth: 3.3, shaftDepth: 3.0 },
  { shaftDiamMin: 30,  shaftDiamMax: 38,  width: 10, hubDepth: 3.3, shaftDepth: 3.0 },
  { shaftDiamMin: 38,  shaftDiamMax: 44,  width: 12, hubDepth: 3.3, shaftDepth: 3.0 },
  { shaftDiamMin: 44,  shaftDiamMax: 50,  width: 14, hubDepth: 3.8, shaftDepth: 3.5 },
  { shaftDiamMin: 50,  shaftDiamMax: 58,  width: 16, hubDepth: 4.3, shaftDepth: 4.0 },
  { shaftDiamMin: 58,  shaftDiamMax: 65,  width: 18, hubDepth: 4.4, shaftDepth: 4.0 },
  { shaftDiamMin: 65,  shaftDiamMax: 75,  width: 20, hubDepth: 4.9, shaftDepth: 4.5 },
  { shaftDiamMin: 75,  shaftDiamMax: 85,  width: 22, hubDepth: 5.4, shaftDepth: 5.0 },
  { shaftDiamMin: 85,  shaftDiamMax: 95,  width: 25, hubDepth: 5.4, shaftDepth: 5.0 },
  { shaftDiamMin: 95,  shaftDiamMax: 110, width: 28, hubDepth: 6.4, shaftDepth: 6.0 },
];

export function getKeyway(boreDiameter: number): KeywaySpec | null {
  return KEYWAY_TABLE.find(k => boreDiameter > k.shaftDiamMin && boreDiameter <= k.shaftDiamMax) ?? null;
}

// ─────────────────────────────────────────────
// COMPUTED GEOMETRY
// ─────────────────────────────────────────────

export interface PulleyGeometry {
  // Core dimensions
  pitchDiameter: number;
  outerDiameter: number;
  rootDiameter: number;
  faceWidth: number;
  totalWidth: number;       // including hub/boss overhang
  hubDiameter: number;
  hubLength: number;
  boreDiameter: number;

  // Groove
  grooveAngle: number;      // degrees (V-belt)
  grooveDepth: number;
  grooveTopWidth: number;

  // Timing
  numTeeth: number;
  toothPitch: number;

  // Bore
  keyway: KeywaySpec | null;
  dFlatChordWidth: number;  // chord width of D-flat cut

  // Web
  webThickness: number;
  spokeCount: number;
  spokeWidth: number;
  lighteningHoleCount: number;
  lighteningHoleDiameter: number;
  lighteningHolePCD: number; // pitch circle diameter of lightening holes

  // 3D print
  minWallOK: boolean;
  printWarnings: string[];

  // Mass/volume estimates
  estimatedMass: number;     // grams (based on material density)
  estimatedVolume: number;   // cm³

  // Validation
  warnings: string[];
  errors: string[];
}

export function computePulleyGeometry(p: PulleyParams): PulleyGeometry {
  const warnings: string[] = [];
  const errors: string[] = [];
  const printWarnings: string[] = [];

  let outerDiameter = p.pitchDiameter;
  let rootDiameter = p.pitchDiameter;
  let grooveAngle = 38;
  let grooveDepth = 0;
  let grooveTopWidth = 0;
  let numTeeth = 0;
  let toothPitch = 0;

  // ── Groove geometry ──────────────────────────
  if (p.grooveType === "vbelt") {
    const spec = V_BELT_GROOVES[p.vbeltSection];
    // Per ISO 4183: groove angle is 34° for small pulleys (PD < threshold), 38° for large.
    // User can override via grooveAngle param. Standard values: 34°, 36°, 38°, 40°.
    grooveAngle = p.grooveAngle ?? (p.pitchDiameter < spec.angleBreakDiameter ? spec.angle34 : spec.angle38);
    // Validate: 34° groove on large pulley is non-standard and may cause belt tracking issues
    if (p.grooveAngle === 34 && p.pitchDiameter >= spec.angleBreakDiameter) {
      warnings.push(`34° groove angle on PD ${p.pitchDiameter}mm exceeds the ${spec.angleBreakDiameter}mm threshold. Standard requires 38° for this diameter.`);
    }
    grooveDepth = spec.depth;
    grooveTopWidth = spec.topWidth;

    // Per ISO 4183 / RMA IP-20:
    // The pitch line of the belt sits at the OUTER diameter of the sheave (datum surface).
    // OD = PD (pitch diameter IS the outer reference for V-belt sheaves)
    // Root diameter = OD - 2 × groove depth
    // The pitchOffset is the distance from the belt's neutral axis to the belt's outer face,
    // which equals the distance from the groove datum to the groove bottom = groove depth.
    outerDiameter = p.pitchDiameter;  // per ISO 4183: datum diameter = pitch diameter
    rootDiameter = p.pitchDiameter - 2 * spec.depth;

    if (p.pitchDiameter < spec.minPitchDiameter) {
      warnings.push(`Pitch diameter ${p.pitchDiameter} mm is below minimum ${spec.minPitchDiameter} mm for ${p.vbeltSection} section. Belt life will be reduced.`);
    }
  } else if (p.grooveType === "obelt") {
    const spec = getOBeltGrooveSpec(p.obeltDiameter);
    grooveDepth = spec.grooveDepth;
    grooveTopWidth = p.obeltDiameter + 1;
    outerDiameter = p.pitchDiameter + p.obeltDiameter * 0.4; // belt sits 40% proud
    rootDiameter = p.pitchDiameter - spec.grooveDepth * 2;
  } else if (p.grooveType === "flat") {
    // Flat belt: OD = PD, no groove. Crown adds to OD at center.
    outerDiameter = p.pitchDiameter + p.flatCrown * 2;
    rootDiameter = p.pitchDiameter;
    grooveDepth = 0;
    grooveTopWidth = p.faceWidth;
  } else if (p.grooveType === "timing") {
    const spec = TIMING_GROOVES[p.timingProfile];
    toothPitch = spec.pitch;
    numTeeth = p.timingTeeth;
    // Pitch diameter from tooth count and pitch
    const pd = (numTeeth * spec.pitch) / Math.PI;
    outerDiameter = pd + 2 * spec.pitchLineOffset;
    rootDiameter = pd - 2 * spec.toothDepth;
    grooveDepth = spec.toothDepth;
    grooveTopWidth = spec.pitch * 0.6;

    if (numTeeth < 10) {
      errors.push(`Timing pulley must have at least 10 teeth. ${numTeeth} teeth will cause excessive polygon effect and belt skip.`);
    }
    if (numTeeth < 18) {
      warnings.push(`Fewer than 18 teeth increases chordal action and reduces belt life. Minimum 18 teeth recommended for GT/HTD profiles.`);
    }
  }

  // ── Hub geometry ─────────────────────────────
  const hubDiameter = Math.max(p.hubDiameter, p.boreDiameter + 2 * p.wallThickness * 2);
  const hubLength = Math.max(p.hubLength, p.faceWidth * 0.5);

  // ── Bore geometry ────────────────────────────
  let keyway: KeywaySpec | null = null;
  let dFlatChordWidth = 0;

  if (p.boreType === "keyway") {
    keyway = p.keywaySizeLocked ? getKeyway(p.boreDiameter) : getKeyway(p.boreDiameter);
    if (!keyway) {
      warnings.push(`No standard ISO 773 keyway found for bore diameter ${p.boreDiameter} mm. Check bore size.`);
    }
  } else if (p.boreType === "dshaft") {
    // D-shaft flat: chord width = 2 * sqrt(r² - (r-d)²) where d = flat depth
    const r = p.boreDiameter / 2;
    const d = p.dShaftFlatDepth;
    dFlatChordWidth = 2 * Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)));
    if (p.dShaftFlatDepth < 0.5) {
      warnings.push(`D-shaft flat depth is very small (${p.dShaftFlatDepth} mm). Minimum 1 mm recommended for adequate torque transmission.`);
    }
  }

  // ── Web geometry ─────────────────────────────
  const webThickness = Math.max(p.webThickness, p.wallThickness);
  const lighteningHolePCD = (outerDiameter / 2 + hubDiameter / 2) / 2;

  // ── 3D print validation ───────────────────────
  const minWallOK = p.wallThickness >= 1.6; // 4× 0.4 mm nozzle = structural minimum per FDM best practice
  if (p.printOptimized) {
    if (p.wallThickness < 0.8) {
      printWarnings.push(`Wall thickness ${p.wallThickness} mm is below 0.8 mm (2× nozzle). Part will not print reliably.`);
    } else if (p.wallThickness < 1.6) {
      printWarnings.push(`Wall ${p.wallThickness} mm is below recommended 1.6 mm (4× 0.4mm nozzle). Increase perimeter count to 4+ in slicer for structural integrity.`);
    }
    if (p.grooveType === "vbelt" && p.printOrientation === "flat") {
      printWarnings.push(`V-belt groove walls are parallel to print layers when printing flat. Consider printing upright for stronger groove walls, or increase perimeter count to 6+.`);
    }
    if (p.grooveType === "timing" && p.printOrientation === "upright") {
      printWarnings.push(`Timing belt teeth printed upright have layer lines perpendicular to tooth load — teeth may shear. Print flat (teeth parallel to bed) for maximum tooth strength.`);
    }
    if (p.boreDiameter > 0 && p.boreType === "keyway" && p.printOptimized) {
      printWarnings.push(`Keyway geometry requires support material when printing upright. Consider printing flat or using a separate metal insert.`);
    }
    if (p.infillPercent < 40) {
      printWarnings.push(`Infill ${p.infillPercent}% is low for a functional pulley. Recommend 60–100% with Gyroid or Rectilinear pattern.`);
    }
  }

  // ── General validation ────────────────────────
  if (p.boreDiameter >= outerDiameter - 4) {
    errors.push(`Bore diameter (${p.boreDiameter} mm) is too large relative to outer diameter (${outerDiameter.toFixed(1)} mm). Minimum 4 mm wall required.`);
  }
  if (hubDiameter >= outerDiameter) {
    errors.push(`Hub diameter (${hubDiameter} mm) exceeds outer diameter (${outerDiameter.toFixed(1)} mm).`);
  }
  if (p.grooveType === "vbelt" && p.numGrooves > 1) {
    const requiredFace = p.numGrooves * p.grooveSpacing + V_BELT_GROOVES[p.vbeltSection].topWidth;
    if (p.faceWidth < requiredFace) {
      warnings.push(`Face width ${p.faceWidth} mm may be too narrow for ${p.numGrooves} grooves at ${p.grooveSpacing} mm spacing. Minimum: ${requiredFace.toFixed(1)} mm.`);
    }
  }

  const totalWidth = p.faceWidth + (p.bossHeight > 0 ? p.bossHeight : 0);

  // ── Mass/volume estimate ─────────────────────
  // Approximate as solid cylinder minus bore, scaled by web fraction
  // Volume in mm³, then convert to cm³ (÷1000)
  const rimVolMm3 = Math.PI * ((outerDiameter / 2) ** 2 - (rootDiameter / 2) ** 2) * p.faceWidth;
  const webVolMm3 = Math.PI * ((rootDiameter / 2) ** 2 - (p.boreDiameter / 2) ** 2) * webThickness;
  const hubVolMm3 = Math.PI * ((hubDiameter / 2) ** 2 - (p.boreDiameter / 2) ** 2) * totalWidth;
  const webFraction = p.webStyle === "spokes" ? 0.35 : p.webStyle === "lightening" ? 0.65 : p.webStyle === "fins" ? 0.55 : 1.0;
  const totalVolCm3 = Math.max(0.1, (rimVolMm3 + webVolMm3 * webFraction + hubVolMm3) / 1000);
  const densityGcm3 = p.material === "Aluminum" ? 2.7 : p.material === "Steel" ? 7.85 :
    p.material === "Nylon" ? 1.14 : p.material === "PC" ? 1.2 : p.material === "ASA" ? 1.07 : 1.24; // PLA/PETG default
  const estimatedMass = totalVolCm3 * densityGcm3;

  return {
    pitchDiameter: p.pitchDiameter,
    outerDiameter,
    rootDiameter,
    faceWidth: p.faceWidth,
    totalWidth,
    hubDiameter,
    hubLength,
    boreDiameter: p.boreDiameter,
    grooveAngle,
    grooveDepth,
    grooveTopWidth,
    numTeeth,
    toothPitch,
    keyway,
    dFlatChordWidth,
    webThickness,
    spokeCount: p.numSpokes,
    spokeWidth: p.spokeWidth,
    lighteningHoleCount: p.numLighteningHoles,
    lighteningHoleDiameter: p.lighteningHoleDiameter,
    lighteningHolePCD,
    minWallOK,
    printWarnings,
    estimatedMass: Math.round(estimatedMass * 10) / 10,
    estimatedVolume: Math.round(totalVolCm3 * 100) / 100,
    warnings,
    errors,
  };
}

// ─────────────────────────────────────────────
// DEFAULT PARAMS
// ─────────────────────────────────────────────

export function defaultPulleyParams(): PulleyParams {
  return {
    grooveType: "vbelt",
    vbeltSection: "A",
    timingProfile: "GT2",
    timingTeeth: 20,
    pitchDiameter: 80,
    faceWidth: 25,
    numGrooves: 1,
    grooveSpacing: 15,
    obeltDiameter: 5,
    flatCrown: 0.5,

    boreType: "through",
    boreDiameter: 10,
    bossHeight: 5,
    bossDiameter: 22,
    dShaftFlatDepth: 2,
    keywaySizeLocked: true,
    setScrewSize: "M5",
    grooveAngle: 38,

    webStyle: "spokes",
    hubDiameter: 22,
    hubLength: 20,
    numSpokes: 5,
    spokeWidth: 6,
    numLighteningHoles: 5,
    lighteningHoleDiameter: 15,
    webThickness: 4,

    printOptimized: true,
    printOrientation: "flat",
    wallThickness: 2.0,
    infillPercent: 80,
    addBrimNotch: false,

    showDimensions: true,
    showCenterlines: true,
    material: "PETG",
  };
}
