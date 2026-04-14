/**
 * Belt Catalog & McMaster-Carr Deep Link Generator
 *
 * Provides:
 * 1. Standard belt part number lookup (Gates, Bando, Optibelt conventions)
 * 2. McMaster-Carr filtered search URLs for pulleys and belts
 * 3. Belt catalog table matching computed belt length to standard sizes
 */

import type {
  BeltType,
  VBeltSection,
  TimingProfile,
  PulleyParams,
  BeltSystemParams,
  BeltGeometry,
} from "./beltMath";
import { computePulleyGeometry } from "./beltMath";

// ─── McMaster-Carr URL Builder ────────────────────────────────────────────────

/**
 * McMaster-Carr URL patterns (confirmed from live site inspection):
 *   /products/{category}/
 *   /products/{category}/{filter-name}~{filter-value}/
 *   /products/{category}/{filter1}~{val1}/{filter2}~{val2}/
 *
 * Category slugs:
 *   v-belt-pulleys, v-belts
 *   timing-belt-pulleys, timing-belts
 *   flat-belt-pulleys, flat-belts
 */

export interface McMasterLinks {
  driverPulley: string;
  drivenPulley: string;
  belt: string;
  /** Human-readable description of what the link filters for */
  driverPulleyDesc: string;
  drivenPulleyDesc: string;
  beltDesc: string;
}

/** Convert mm to nearest standard inch fraction string for McMaster filter */
function mmToInchStr(mm: number): string {
  const inches = mm / 25.4;
  // Round to nearest 0.05"
  const rounded = Math.round(inches * 20) / 20;
  return rounded.toFixed(2).replace(/\.?0+$/, "") + '"';
}

/** Convert mm bore to McMaster shaft-diameter filter value */
function boreToMcMasterFilter(boreMm: number): string {
  const inches = boreMm / 25.4;
  // Standard bore sizes in inches
  const standards = [0.25, 0.3125, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25, 1.375, 1.5, 1.75, 2.0];
  const closest = standards.reduce((prev, curr) =>
    Math.abs(curr - inches) < Math.abs(prev - inches) ? curr : prev
  );
  // Format as fraction string
  const fractions: Record<number, string> = {
    0.25: "1/4", 0.3125: "5/16", 0.375: "3/8", 0.5: "1/2",
    0.625: "5/8", 0.75: "3/4", 0.875: "7/8", 1.0: "1",
    1.125: "1-1/8", 1.25: "1-1/4", 1.375: "1-3/8", 1.5: "1-1/2",
    1.75: "1-3/4", 2.0: "2",
  };
  return fractions[closest] ?? closest.toFixed(2);
}

/** V-belt section to McMaster belt-trade-size filter */
const VBELT_MCMASTER_SECTION: Record<VBeltSection, string> = {
  Z: "z", A: "a", B: "b", C: "c", D: "d", E: "e",
  SPZ: "spz", SPA: "spa", SPB: "spb", SPC: "spc",
};

/** Timing profile to McMaster category and filter */
const TIMING_MCMASTER: Record<TimingProfile, { category: string; filter: string }> = {
  GT2:    { category: "timing-belts", filter: "series~gt2" },
  GT3:    { category: "timing-belts", filter: "series~gt3" },
  HTD3M:  { category: "timing-belts", filter: "pitch~3mm" },
  HTD5M:  { category: "timing-belts", filter: "pitch~5mm" },
  GT5:    { category: "timing-belts", filter: "series~gt5" },
  HTD8M:  { category: "timing-belts", filter: "pitch~8mm" },
  HTD14M: { category: "timing-belts", filter: "pitch~14mm" },
  T5:     { category: "timing-belts", filter: "series~t5" },
  T10:    { category: "timing-belts", filter: "series~t10" },
  AT5:    { category: "timing-belts", filter: "series~at5" },
  AT10:   { category: "timing-belts", filter: "series~at10" },
};

const BASE = "https://www.mcmaster.com/products";

export function buildMcMasterLinks(
  driver: PulleyParams,
  driven: PulleyParams,
  system: BeltSystemParams,
  geo: BeltGeometry
): McMasterLinks {
  const driverGeo = computePulleyGeometry(driver, system);
  const drivenGeo = computePulleyGeometry(driven, system);

  if (system.beltType === "vbelt") {
    const sec = VBELT_MCMASTER_SECTION[system.vbeltSection];
    const driverBore = boreToMcMasterFilter(driver.bore);
    const drivenBore = boreToMcMasterFilter(driven.bore);

    // Pitch diameter in inches for filter
    const driverPD = mmToInchStr(driverGeo.pitchDiameter);
    const drivenPD = mmToInchStr(drivenGeo.pitchDiameter);

    // Belt length in inches (outer circumference for V-belt catalog)
    const beltLengthIn = (geo.actualBeltLength / 25.4).toFixed(0);

    return {
      driverPulley: `${BASE}/v-belt-pulleys/belt-trade-size~${sec}/`,
      drivenPulley: `${BASE}/v-belt-pulleys/belt-trade-size~${sec}/`,
      belt: `${BASE}/v-belts/belt-trade-size~${sec}/`,
      driverPulleyDesc: `V-belt pulleys, ${system.vbeltSection} section, ~${driverPD} PD, bore ~${driverBore}"`,
      drivenPulleyDesc: `V-belt pulleys, ${system.vbeltSection} section, ~${drivenPD} PD, bore ~${drivenBore}"`,
      beltDesc: `V-belts, ${system.vbeltSection} section, ~${beltLengthIn}" length`,
    };
  }

  if (system.beltType === "timing") {
    const { category, filter } = TIMING_MCMASTER[system.timingProfile];
    const driverTeeth = driver.timingTeeth;
    const drivenTeeth = driven.timingTeeth;
    const beltTeeth = geo.beltTeeth;

    return {
      driverPulley: `${BASE}/timing-belt-pulleys/${filter}/`,
      drivenPulley: `${BASE}/timing-belt-pulleys/${filter}/`,
      belt: `${BASE}/${category}/${filter}/`,
      driverPulleyDesc: `Timing pulleys, ${system.timingProfile}, ${driverTeeth} teeth`,
      drivenPulleyDesc: `Timing pulleys, ${system.timingProfile}, ${drivenTeeth} teeth`,
      beltDesc: `Timing belt, ${system.timingProfile}, ${beltTeeth} teeth`,
    };
  }

  if (system.beltType === "flat") {
    return {
      driverPulley: `${BASE}/flat-belt-pulleys/`,
      drivenPulley: `${BASE}/flat-belt-pulleys/`,
      belt: `${BASE}/flat-belts/`,
      driverPulleyDesc: `Flat belt pulleys, ~${mmToInchStr(driverGeo.pitchDiameter)} diameter`,
      drivenPulleyDesc: `Flat belt pulleys, ~${mmToInchStr(drivenGeo.pitchDiameter)} diameter`,
      beltDesc: `Flat belt, ${system.beltWidth} mm wide`,
    };
  }

  // Round belt
  return {
    driverPulley: `${BASE}/round-belt-pulleys/`,
    drivenPulley: `${BASE}/round-belt-pulleys/`,
    belt: `${BASE}/round-belts/`,
    driverPulleyDesc: `Round belt pulleys`,
    drivenPulleyDesc: `Round belt pulleys`,
    beltDesc: `Round belt`,
  };
}

// ─── Standard Belt Part Number Catalog ───────────────────────────────────────

export interface BeltCatalogEntry {
  /** Manufacturer part number */
  partNumber: string;
  /** Manufacturer name */
  manufacturer: string;
  /** Belt type */
  type: BeltType;
  /** Section / profile */
  section: string;
  /** Nominal belt length (mm) */
  nominalLength: number;
  /** Actual pitch length (mm) */
  pitchLength: number;
  /** Width (mm) */
  width: number;
  /** McMaster-Carr search URL */
  mcmasterUrl: string;
  /** How close this is to the computed belt length (mm difference) */
  delta: number;
}

/**
 * Standard V-belt lengths by section (ISO 4184 / RMA IP-20).
 * Format: [section, partSuffix, pitchLength_mm]
 * Part number = section + suffix (e.g., "A45" = A section, 45" outside circumference)
 */
const V_BELT_CATALOG: Array<[VBeltSection, string, number]> = [
  // A section (pitch length ≈ outside circumference - 1.3")
  ["A", "26",  673], ["A", "28",  724], ["A", "30",  775], ["A", "31",  800],
  ["A", "32",  826], ["A", "33",  851], ["A", "34",  876], ["A", "35",  902],
  ["A", "36",  927], ["A", "38",  978], ["A", "39", 1003], ["A", "40", 1029],
  ["A", "42", 1080], ["A", "44", 1131], ["A", "45", 1156], ["A", "46", 1181],
  ["A", "48", 1232], ["A", "50", 1283], ["A", "51", 1308], ["A", "52", 1334],
  ["A", "53", 1359], ["A", "54", 1384], ["A", "55", 1410], ["A", "57", 1461],
  ["A", "58", 1486], ["A", "60", 1537], ["A", "62", 1588], ["A", "64", 1639],
  ["A", "65", 1664], ["A", "66", 1689], ["A", "68", 1740], ["A", "70", 1791],
  ["A", "72", 1842], ["A", "75", 1918], ["A", "78", 1994], ["A", "80", 2045],
  ["A", "85", 2172], ["A", "90", 2299], ["A", "96", 2451], ["A", "100", 2553],
  ["A", "105", 2680], ["A", "112", 2858], ["A", "120", 3063],
  // B section (pitch length ≈ outside circumference - 1.6")
  ["B", "35",  902], ["B", "36",  927], ["B", "38",  978], ["B", "39", 1003],
  ["B", "40", 1029], ["B", "41", 1054], ["B", "42", 1080], ["B", "44", 1131],
  ["B", "45", 1156], ["B", "46", 1181], ["B", "48", 1232], ["B", "50", 1283],
  ["B", "51", 1308], ["B", "52", 1334], ["B", "53", 1359], ["B", "54", 1384],
  ["B", "55", 1410], ["B", "56", 1435], ["B", "57", 1461], ["B", "58", 1486],
  ["B", "60", 1537], ["B", "62", 1588], ["B", "64", 1639], ["B", "65", 1664],
  ["B", "66", 1689], ["B", "68", 1740], ["B", "70", 1791], ["B", "72", 1842],
  ["B", "75", 1918], ["B", "78", 1994], ["B", "80", 2045], ["B", "81", 2070],
  ["B", "82", 2096], ["B", "84", 2147], ["B", "85", 2172], ["B", "90", 2299],
  ["B", "96", 2451], ["B", "100", 2553], ["B", "105", 2680], ["B", "108", 2756],
  ["B", "112", 2858], ["B", "120", 3063], ["B", "128", 3267], ["B", "136", 3472],
  // C section (pitch length ≈ outside circumference - 2.0")
  ["C", "51", 1308], ["C", "54", 1384], ["C", "55", 1410], ["C", "60", 1537],
  ["C", "62", 1588], ["C", "64", 1639], ["C", "66", 1689], ["C", "68", 1740],
  ["C", "70", 1791], ["C", "72", 1842], ["C", "75", 1918], ["C", "78", 1994],
  ["C", "80", 2045], ["C", "81", 2070], ["C", "84", 2147], ["C", "85", 2172],
  ["C", "90", 2299], ["C", "96", 2451], ["C", "100", 2553], ["C", "105", 2680],
  ["C", "108", 2756], ["C", "112", 2858], ["C", "120", 3063], ["C", "128", 3267],
  ["C", "136", 3472], ["C", "144", 3676], ["C", "158", 4033], ["C", "162", 4135],
  ["C", "173", 4415], ["C", "180", 4593], ["C", "195", 4974], ["C", "210", 5358],
  // D section
  ["D", "105", 2680], ["D", "112", 2858], ["D", "120", 3063], ["D", "128", 3267],
  ["D", "144", 3676], ["D", "158", 4033], ["D", "162", 4135], ["D", "173", 4415],
  ["D", "180", 4593], ["D", "195", 4974], ["D", "210", 5358], ["D", "240", 6121],
  ["D", "270", 6883], ["D", "300", 7645],
  // Z section (metric)
  ["Z", "10",  250], ["Z", "12",  300], ["Z", "13",  325], ["Z", "14",  350],
  ["Z", "15",  375], ["Z", "16",  400], ["Z", "17",  425], ["Z", "18",  450],
  ["Z", "20",  500], ["Z", "22",  550], ["Z", "24",  600], ["Z", "25",  625],
  ["Z", "26",  650], ["Z", "28",  700], ["Z", "30",  750], ["Z", "32",  800],
  ["Z", "34",  850], ["Z", "36",  900], ["Z", "38",  950], ["Z", "40", 1000],
  // SPZ section
  ["SPZ", "630",  630], ["SPZ", "670",  670], ["SPZ", "710",  710],
  ["SPZ", "750",  750], ["SPZ", "800",  800], ["SPZ", "850",  850],
  ["SPZ", "900",  900], ["SPZ", "950",  950], ["SPZ", "1000", 1000],
  ["SPZ", "1060", 1060], ["SPZ", "1120", 1120], ["SPZ", "1180", 1180],
  ["SPZ", "1250", 1250], ["SPZ", "1320", 1320], ["SPZ", "1400", 1400],
  ["SPZ", "1500", 1500], ["SPZ", "1600", 1600], ["SPZ", "1700", 1700],
  ["SPZ", "1800", 1800], ["SPZ", "2000", 2000],
  // SPA section
  ["SPA", "800",  800], ["SPA", "850",  850], ["SPA", "900",  900],
  ["SPA", "950",  950], ["SPA", "1000", 1000], ["SPA", "1060", 1060],
  ["SPA", "1120", 1120], ["SPA", "1180", 1180], ["SPA", "1250", 1250],
  ["SPA", "1320", 1320], ["SPA", "1400", 1400], ["SPA", "1500", 1500],
  ["SPA", "1600", 1600], ["SPA", "1700", 1700], ["SPA", "1800", 1800],
  ["SPA", "2000", 2000], ["SPA", "2120", 2120], ["SPA", "2240", 2240],
  ["SPA", "2360", 2360], ["SPA", "2500", 2500], ["SPA", "2650", 2650],
  ["SPA", "2800", 2800], ["SPA", "3000", 3000],
  // SPB section
  ["SPB", "1250", 1250], ["SPB", "1320", 1320], ["SPB", "1400", 1400],
  ["SPB", "1500", 1500], ["SPB", "1600", 1600], ["SPB", "1700", 1700],
  ["SPB", "1800", 1800], ["SPB", "2000", 2000], ["SPB", "2120", 2120],
  ["SPB", "2240", 2240], ["SPB", "2360", 2360], ["SPB", "2500", 2500],
  ["SPB", "2650", 2650], ["SPB", "2800", 2800], ["SPB", "3000", 3000],
  ["SPB", "3150", 3150], ["SPB", "3350", 3350], ["SPB", "3550", 3550],
  ["SPB", "3750", 3750], ["SPB", "4000", 4000], ["SPB", "4250", 4250],
  // SPC section
  ["SPC", "2000", 2000], ["SPC", "2120", 2120], ["SPC", "2240", 2240],
  ["SPC", "2360", 2360], ["SPC", "2500", 2500], ["SPC", "2650", 2650],
  ["SPC", "2800", 2800], ["SPC", "3000", 3000], ["SPC", "3150", 3150],
  ["SPC", "3350", 3350], ["SPC", "3550", 3550], ["SPC", "3750", 3750],
  ["SPC", "4000", 4000], ["SPC", "4250", 4250], ["SPC", "4500", 4500],
  ["SPC", "5000", 5000], ["SPC", "5600", 5600], ["SPC", "6300", 6300],
];

/**
 * Standard timing belt lengths by profile (pitch × teeth = pitch length).
 * We store common tooth counts; pitch length = teeth × pitch.
 */
const TIMING_BELT_TEETH: Record<TimingProfile, number[]> = {
  GT2:    [100,110,122,124,130,140,144,150,158,160,170,180,200,220,240,260,280,300,320,340,360,380,400,420,440,460,480,500],
  GT3:    [100,110,120,130,140,150,160,170,180,200,220,240,260,280,300,320,340,360,380,400,420,440,460,480,500],
  HTD3M:  [100,111,117,120,123,126,129,132,135,138,141,144,150,153,156,159,162,165,168,171,174,177,180,186,192,198,204,210,225,240,255,270,285,300],
  HTD5M:  [150,155,160,165,170,175,180,185,190,195,200,210,220,225,230,240,250,255,260,270,280,290,300,315,330,345,360,375,390,405,420,450,480,510,540,570,600],
  GT5:    [150,160,170,180,190,200,210,220,230,240,250,260,270,280,300,320,340,360,380,400,420,450,480,510,540,600],
  HTD8M:  [64,72,80,88,96,104,112,120,128,136,144,152,160,168,176,184,192,200,210,220,240,260,280,300,320,340,360,400,440,480,540,600],
  HTD14M: [40,46,50,56,64,72,80,90,100,110,120,130,140,150,160,170,180,200,220,240,260,280,300],
  T5:     [100,110,120,130,140,150,160,170,180,190,200,210,220,240,260,280,300,320,340,360,400,450,500],
  T10:    [50,55,60,65,70,75,80,85,90,95,100,110,120,130,140,150,160,170,180,200,220,240,260,280,300],
  AT5:    [100,110,120,130,140,150,160,170,180,200,220,240,260,280,300,320,340,360,400,450,500],
  AT10:   [50,55,60,65,70,75,80,85,90,95,100,110,120,130,140,150,160,180,200,220,240,260,280,300],
};

/**
 * Find the closest matching standard belt(s) for the computed belt length.
 * Returns up to `limit` closest matches.
 */
export function findMatchingBelts(
  system: BeltSystemParams,
  geo: BeltGeometry,
  limit = 5
): BeltCatalogEntry[] {
  const targetLength = geo.actualBeltLength;
  const results: BeltCatalogEntry[] = [];

  if (system.beltType === "vbelt") {
    const sec = system.vbeltSection;
    const mcUrl = `${BASE}/v-belts/belt-trade-size~${VBELT_MCMASTER_SECTION[sec]}/`;

    for (const [section, suffix, pitchLength] of V_BELT_CATALOG) {
      if (section !== sec) continue;
      results.push({
        partNumber: `${section}${suffix}`,
        manufacturer: "Gates / Bando / Optibelt",
        type: "vbelt",
        section,
        nominalLength: pitchLength,
        pitchLength,
        width: 0,
        mcmasterUrl: mcUrl,
        delta: Math.abs(pitchLength - targetLength),
      });
    }
  } else if (system.beltType === "timing") {
    const profile = system.timingProfile;
    const pitch = getPitchForProfile(profile);
    const { category, filter } = TIMING_MCMASTER[profile];
    const mcUrl = `${BASE}/${category}/${filter}/`;

    for (const teeth of TIMING_BELT_TEETH[profile]) {
      const pitchLength = teeth * pitch;
      results.push({
        partNumber: `${profile}-${pitchLength.toFixed(0)}-${system.beltWidth}`,
        manufacturer: "Gates / Bando / Optibelt",
        type: "timing",
        section: profile,
        nominalLength: pitchLength,
        pitchLength,
        width: system.beltWidth,
        mcmasterUrl: mcUrl,
        delta: Math.abs(pitchLength - targetLength),
      });
    }
  } else if (system.beltType === "flat") {
    // Flat belts are typically custom cut; show length in standard increments
    const mcUrl = `${BASE}/flat-belts/`;
    for (let len = 500; len <= 5000; len += 50) {
      results.push({
        partNumber: `FLAT-${len}x${system.beltWidth}`,
        manufacturer: "Custom / Habasit",
        type: "flat",
        section: "flat",
        nominalLength: len,
        pitchLength: len,
        width: system.beltWidth,
        mcmasterUrl: mcUrl,
        delta: Math.abs(len - targetLength),
      });
    }
  }

  return results
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);
}

function getPitchForProfile(profile: TimingProfile): number {
  const pitches: Record<TimingProfile, number> = {
    GT2: 2, GT3: 3, HTD3M: 3, HTD5M: 5, GT5: 5,
    HTD8M: 8, HTD14M: 14, T5: 5, T10: 10, AT5: 5, AT10: 10,
  };
  return pitches[profile];
}

// ─── Pulley Catalog Lookup ────────────────────────────────────────────────────

export interface PulleyCatalogEntry {
  description: string;
  pitchDiameter: string;
  bore: string;
  section: string;
  mcmasterUrl: string;
  notes: string;
}

/**
 * Generate a pulley catalog entry for a given pulley configuration.
 * Returns a description and McMaster-Carr search link.
 */
export function buildPulleyCatalogEntry(
  pulley: PulleyParams,
  system: BeltSystemParams
): PulleyCatalogEntry {
  const geo = computePulleyGeometry(pulley, system);
  const pdIn = mmToInchStr(geo.pitchDiameter);
  const boreIn = boreToMcMasterFilter(pulley.bore);

  if (system.beltType === "vbelt") {
    const sec = system.vbeltSection;
    const mcUrl = `${BASE}/v-belt-pulleys/belt-trade-size~${VBELT_MCMASTER_SECTION[sec]}/`;
    return {
      description: `${sec} V-belt pulley, ${geo.pitchDiameter.toFixed(1)} mm PD`,
      pitchDiameter: `${geo.pitchDiameter.toFixed(1)} mm (${pdIn})`,
      bore: `${pulley.bore} mm (~${boreIn}")`,
      section: sec,
      mcmasterUrl: mcUrl,
      notes: `Min pulley diameter for ${sec}: see V_BELT_SECTIONS table`,
    };
  }

  if (system.beltType === "timing") {
    const { category, filter } = TIMING_MCMASTER[system.timingProfile];
    const mcUrl = `${BASE}/${category.replace("belts", "belt-pulleys")}/${filter}/`;
    return {
      description: `${system.timingProfile} timing pulley, ${pulley.timingTeeth} teeth`,
      pitchDiameter: `${geo.pitchDiameter.toFixed(2)} mm`,
      bore: `${pulley.bore} mm (~${boreIn}")`,
      section: system.timingProfile,
      mcmasterUrl: mcUrl,
      notes: `Pitch: ${geo.pitchDiameter.toFixed(2)} mm = ${pulley.timingTeeth} teeth × pitch / π`,
    };
  }

  return {
    description: `Flat belt pulley, ${geo.pitchDiameter.toFixed(1)} mm diameter`,
    pitchDiameter: `${geo.pitchDiameter.toFixed(1)} mm (${pdIn})`,
    bore: `${pulley.bore} mm (~${boreIn}")`,
    section: "flat",
    mcmasterUrl: `${BASE}/flat-belt-pulleys/`,
    notes: "",
  };
}
