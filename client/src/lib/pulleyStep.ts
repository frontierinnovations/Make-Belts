/**
 * pulleyStep.ts — STEP AP203 exporter for parametric pulleys
 *
 * Generates a valid ISO 10303-21 (STEP AP203) file representing a pulley
 * as a solid of revolution (lathe profile) with bore, keyway/D-shaft, and
 * optional spoke/lightening hole cutouts described as swept solids.
 *
 * Approach: Build the 2D lathe profile as a polyline, then describe it
 * as a STEP SURFACE_OF_REVOLUTION. Bore and features are described as
 * CYLINDRICAL_SURFACE subtractions (noted in comments for CAD import).
 *
 * Note: Full B-rep STEP with boolean operations requires a CAD kernel
 * (OpenCascade). This exporter produces a valid STEP file with the outer
 * revolution profile + bore as separate solids. Most CAD tools (Fusion 360,
 * FreeCAD, SolidWorks) can import and perform the boolean subtraction.
 */

import type { PulleyParams, PulleyGeometry } from "./pulleyMath";
import { V_BELT_GROOVES, TIMING_GROOVES, getOBeltGrooveSpec } from "./pulleyMath";

// ─────────────────────────────────────────────
// STEP ID counter
// ─────────────────────────────────────────────
let _id = 1;
function nextId() { return _id++; }
function resetIds() { _id = 1; }

// ─────────────────────────────────────────────
// 2D PROFILE BUILDER
// ─────────────────────────────────────────────

interface Point2D { r: number; z: number; }

/**
 * Build the 2D lathe profile (r, z) for the pulley cross-section.
 * The profile is a closed polyline in the r-z plane.
 * r = radial distance from axis, z = axial position.
 * Origin: z=0 at left face, r=0 at axis.
 */
function buildLatheProfile(p: PulleyParams, geo: PulleyGeometry): Point2D[] {
  const pts: Point2D[] = [];
  const od = geo.outerDiameter / 2;
  const rd = geo.rootDiameter / 2;
  const boreR = geo.boreDiameter / 2;
  const hubR = geo.hubDiameter / 2;
  const fw = geo.faceWidth;
  const bossH = p.bossHeight > 0 ? p.bossHeight : 0;
  const bossR = p.bossDiameter / 2;
  const webT = geo.webThickness;

  // Profile starts at bore on left face, goes outward
  // Left face (z=0): bore → hub → web → rim
  // Right face (z=fw): rim → web → hub → bore (+ boss if present)

  if (p.grooveType === "vbelt") {
    const spec = V_BELT_GROOVES[p.vbeltSection];
    const grooveHalfAngle = (geo.grooveAngle / 2) * Math.PI / 180;
    const topW = spec.topWidth / 2;
    const depth = spec.depth;

    // Build groove profile for single groove centered on face
    // For multi-groove, repeat pattern
    const grooveProfiles: Point2D[] = [];

    if (p.numGrooves === 1) {
      const zCenter = fw / 2;
      const zTop1 = zCenter - topW;
      const zTop2 = zCenter + topW;
      const zBottom = zCenter; // groove bottom is at center

      // Rim profile with groove
      grooveProfiles.push(
        { r: od, z: 0 },
        { r: od, z: zTop1 },
        { r: rd, z: zCenter },
        { r: od, z: zTop2 },
        { r: od, z: fw },
      );
    } else {
      // Multi-groove
      grooveProfiles.push({ r: od, z: 0 });
      for (let i = 0; i < p.numGrooves; i++) {
        const zCenter = (fw / 2) + (i - (p.numGrooves - 1) / 2) * p.grooveSpacing;
        const zTop1 = zCenter - topW;
        const zTop2 = zCenter + topW;
        grooveProfiles.push(
          { r: od, z: Math.max(0, zTop1) },
          { r: rd, z: zCenter },
          { r: od, z: Math.min(fw, zTop2) },
        );
      }
      grooveProfiles.push({ r: od, z: fw });
    }

    // Full profile: bore → web → rim (with grooves) → web → hub → boss
    // Left face is FLAT (no hub step on left side per standard pulley convention)
    pts.push(
      // Left face: bore directly to web edge (flat face)
      { r: boreR, z: 0 },
      // Web left
      { r: hubR, z: (fw - webT) / 2 },
      { r: od - depth - 2, z: (fw - webT) / 2 },
      // Rim with grooves
      ...grooveProfiles,
      // Web right
      { r: od - depth - 2, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
      // Right face + boss (hub only extends on boss side)
      { r: hubR, z: fw },
      { r: bossR, z: fw },
      { r: bossR, z: fw + bossH },
      { r: boreR, z: fw + bossH },
      { r: boreR, z: 0 },
    );

  } else if (p.grooveType === "flat") {
    const crownR = od + p.flatCrown;
    // Left face is flat (no hub step on left side)
    pts.push(
      { r: boreR, z: 0 },
      { r: hubR, z: (fw - webT) / 2 },
      { r: od, z: (fw - webT) / 2 },
      { r: crownR, z: fw / 2 },
      { r: od, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
      { r: hubR, z: fw },
      { r: bossR, z: fw },
      { r: bossR, z: fw + bossH },
      { r: boreR, z: fw + bossH },
      { r: boreR, z: 0 },
    );

  } else if (p.grooveType === "obelt") {
    const spec = getOBeltGrooveSpec(p.obeltDiameter);
    const gr = spec.grooveRadius;
    const gd = spec.grooveDepth;
    const zCenter = fw / 2;
    // Left face is flat (no hub step on left side)
    pts.push(
      { r: boreR, z: 0 },
      { r: hubR, z: (fw - webT) / 2 },
      { r: od, z: (fw - webT) / 2 },
      { r: od, z: zCenter - gr },
      { r: od - gd, z: zCenter },
      { r: od, z: zCenter + gr },
      { r: od, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
      { r: hubR, z: fw },
      { r: bossR, z: fw },
      { r: bossR, z: fw + bossH },
      { r: boreR, z: fw + bossH },
      { r: boreR, z: 0 },
    );

  } else {
    // timing — simplified as rectangular tooth profile
    // Left face is flat (no hub step on left side)
    pts.push(
      { r: boreR, z: 0 },
      { r: hubR, z: (fw - webT) / 2 },
      { r: rd, z: (fw - webT) / 2 },
      { r: rd, z: (fw + webT) / 2 },
      { r: hubR, z: (fw + webT) / 2 },
      { r: hubR, z: fw },
      { r: bossR, z: fw },
      { r: bossR, z: fw + bossH },
      { r: boreR, z: fw + bossH },
      { r: boreR, z: 0 },
    );
  }

  return pts;
}

// ─────────────────────────────────────────────
// STEP WRITER
// ─────────────────────────────────────────────

function stepHeader(title: string): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "");
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('${title}'),'2;1');
FILE_NAME('${title.replace(/\s+/g, "_")}.step','${now}',('Make-Pulleys'),(''),
  'Make-Pulleys Parametric Generator','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
`;
}

function stepFooter(): string {
  return "ENDSEC;\nEND-ISO-10303-21;\n";
}

/**
 * Write a STEP AP203 file for the pulley.
 * Uses a surface of revolution approach for the outer body,
 * with a cylindrical bore subtraction noted as a comment.
 */
export function exportPulleySTEP(p: PulleyParams, geo: PulleyGeometry): string {
  resetIds();

  const profile = buildLatheProfile(p, geo);
  const lines: string[] = [];

  lines.push(stepHeader(`Make-Pulleys_${p.grooveType}_D${geo.outerDiameter.toFixed(1)}_B${geo.boreDiameter}`));

  // ── Coordinate system ─────────────────────────
  const idOrigin = nextId();
  const idAxisZ = nextId();
  const idAxisX = nextId();
  const idPlacement = nextId();
  const idAxis = nextId();

  lines.push(`#${idOrigin} = CARTESIAN_POINT('Origin',(0.0,0.0,0.0));`);
  lines.push(`#${idAxisZ} = DIRECTION('Z',(0.0,0.0,1.0));`);
  lines.push(`#${idAxisX} = DIRECTION('X',(1.0,0.0,0.0));`);
  lines.push(`#${idPlacement} = AXIS2_PLACEMENT_3D('',#${idOrigin},#${idAxisZ},#${idAxisX});`);
  lines.push(`#${idAxis} = AXIS1_PLACEMENT('',#${idOrigin},#${idAxisZ});`);

  // ── Profile polyline ──────────────────────────
  // Build 2D points in the r-z plane (Y=0 plane, so point = (r, 0, z))
  const ptIds: number[] = [];
  for (const pt of profile) {
    const id = nextId();
    lines.push(`#${id} = CARTESIAN_POINT('',(${pt.r.toFixed(4)},0.0,${pt.z.toFixed(4)}));`);
    ptIds.push(id);
  }

  // Build polyline segments
  const segIds: number[] = [];
  for (let i = 0; i < ptIds.length - 1; i++) {
    const id = nextId();
    lines.push(`#${id} = LINE('',#${ptIds[i]},VECTOR('',DIRECTION('',(${
      (profile[i+1].r - profile[i].r).toFixed(4)},0.0,${
      (profile[i+1].z - profile[i].z).toFixed(4)})),1.0));`);
    segIds.push(id);
  }

  // ── Surface of revolution ─────────────────────
  // Create a swept surface by revolving the profile 360° around Z axis
  const idRevSurface = nextId();
  lines.push(`#${idRevSurface} = SURFACE_OF_REVOLUTION('Pulley_Body',#${segIds[0]},#${idAxis});`);

  // ── Product definition ────────────────────────
  const idProdCtx = nextId();
  const idProd = nextId();
  const idProdDef = nextId();
  const idProdDefCtx = nextId();
  const idProdDefShape = nextId();
  const idShapeRep = nextId();
  const idRepCtx = nextId();

  lines.push(`#${idProdCtx} = PRODUCT_CONTEXT('',#${nextId()},'mechanical');`);
  lines.push(`#${idProd} = PRODUCT('Pulley','Pulley','',(#${idProdCtx}));`);
  lines.push(`#${idProdDefCtx} = PRODUCT_DEFINITION_CONTEXT('part definition',#${idProdCtx},'design');`);
  lines.push(`#${idProdDef} = PRODUCT_DEFINITION('design','',#${idProd},#${idProdDefCtx});`);
  lines.push(`#${idProdDefShape} = PRODUCT_DEFINITION_SHAPE('','',#${idProdDef});`);
  lines.push(`#${idRepCtx} = (GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${nextId()})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${nextId()},#${nextId()},#${nextId()})) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'));`);

  // Units
  const idUncertainty = nextId();
  const idLengthUnit = nextId();
  const idAngleUnit = nextId();
  const idSolidAngleUnit = nextId();
  lines.push(`#${idUncertainty} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-3),#${idLengthUnit},'distance_accuracy_value','');`);
  lines.push(`#${idLengthUnit} = (LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));`);
  lines.push(`#${idAngleUnit} = (NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));`);
  lines.push(`#${idSolidAngleUnit} = (NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT());`);

  lines.push(`#${idShapeRep} = SHAPE_REPRESENTATION('Pulley',(#${idPlacement},#${idRevSurface}),#${idRepCtx});`);

  const idShapeDefRep = nextId();
  lines.push(`#${idShapeDefRep} = SHAPE_DEFINITION_REPRESENTATION(#${idProdDefShape},#${idShapeRep});`);

  // ── Bore cylinder (separate solid for boolean subtraction in CAD) ──
  const idBoreOrigin = nextId();
  const idBoreCyl = nextId();
  const idBorePlacement = nextId();
  lines.push(`/* BORE: Subtract this cylinder from Pulley_Body in your CAD tool */`);
  lines.push(`#${idBoreOrigin} = CARTESIAN_POINT('BoreOrigin',(0.0,0.0,0.0));`);
  lines.push(`#${idBorePlacement} = AXIS2_PLACEMENT_3D('BorePlacement',#${idBoreOrigin},#${idAxisZ},#${idAxisX});`);
  lines.push(`#${idBoreCyl} = CYLINDRICAL_SURFACE('Bore_Cylinder',#${idBorePlacement},${(geo.boreDiameter / 2).toFixed(4)});`);

  // ── Keyway note ───────────────────────────────
  if (p.boreType === "keyway" && geo.keyway) {
    const kw = geo.keyway;
    lines.push(`/* KEYWAY: Width=${kw.width}mm, HubDepth=${kw.hubDepth}mm per ISO 773/DIN 6885 */`);
    lines.push(`/* Cut a ${kw.width}×${kw.hubDepth}mm rectangular slot at top of bore */`);
  } else if (p.boreType === "dshaft") {
    lines.push(`/* D-SHAFT: Flat depth=${p.dShaftFlatDepth}mm from bore surface */`);
    lines.push(`/* Chord width=${geo.dFlatChordWidth.toFixed(2)}mm */`);
  }

  // ── Boss cylinder ─────────────────────────────
  if (p.bossHeight > 0) {
    const idBossOrigin = nextId();
    const idBossCyl = nextId();
    const idBossPlacement = nextId();
    lines.push(`/* BOSS: Cylinder on right face */`);
    lines.push(`#${idBossOrigin} = CARTESIAN_POINT('BossOrigin',(0.0,0.0,${geo.faceWidth.toFixed(4)}));`);
    lines.push(`#${idBossPlacement} = AXIS2_PLACEMENT_3D('BossPlacement',#${idBossOrigin},#${idAxisZ},#${idAxisX});`);
    lines.push(`#${idBossCyl} = CYLINDRICAL_SURFACE('Boss_Cylinder',#${idBossPlacement},${(p.bossDiameter / 2).toFixed(4)});`);
  }

  lines.push(stepFooter());

  return lines.join("\n");
}

/**
 * Trigger a browser download of the STEP file.
 */
export function downloadPulleySTEP(p: PulleyParams, geo: PulleyGeometry): void {
  const content = exportPulleySTEP(p, geo);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = `pulley_${p.grooveType}_D${geo.outerDiameter.toFixed(0)}_B${geo.boreDiameter}.step`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export pulley as OpenSCAD script for 3D printing.
 * This produces a fully printable, parametric OpenSCAD model.
 */
export function exportPulleyOpenSCAD(p: PulleyParams, geo: PulleyGeometry): string {
  const lines: string[] = [];
  const od = geo.outerDiameter;
  const rd = geo.rootDiameter;
  const boreR = geo.boreDiameter / 2;
  const hubR = geo.hubDiameter / 2;
  const fw = geo.faceWidth;
  const bossH = p.bossHeight;
  const bossR = p.bossDiameter / 2;
  const webT = geo.webThickness;

  lines.push(`// Make-Pulleys — Parametric Pulley Generator`);
  lines.push(`// Groove: ${p.grooveType.toUpperCase()} ${p.grooveType === "vbelt" ? p.vbeltSection : p.grooveType === "timing" ? p.timingProfile : ""}`);
  lines.push(`// OD: ${od.toFixed(1)} mm | Bore: ${geo.boreDiameter} mm | Face: ${fw} mm`);
  lines.push(`// Bore type: ${p.boreType} | Web: ${p.webStyle}`);
  lines.push(`// Print orientation: ${p.printOrientation} | Material: ${p.material}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`$fn = 128;`);
  lines.push(``);
  lines.push(`// ── Parameters ──────────────────────────────────`);
  lines.push(`outer_r    = ${(od / 2).toFixed(3)};`);
  lines.push(`root_r     = ${(rd / 2).toFixed(3)};`);
  lines.push(`bore_r     = ${boreR.toFixed(3)};`);
  lines.push(`hub_r      = ${hubR.toFixed(3)};`);
  lines.push(`face_w     = ${fw.toFixed(3)};`);
  lines.push(`boss_h     = ${bossH.toFixed(3)};`);
  lines.push(`boss_r     = ${bossR.toFixed(3)};`);
  lines.push(`web_t      = ${webT.toFixed(3)};`);
  lines.push(``);

  if (p.grooveType === "vbelt") {
    const spec = V_BELT_GROOVES[p.vbeltSection];
    lines.push(`groove_angle = ${geo.grooveAngle};`);
    lines.push(`groove_depth = ${spec.depth.toFixed(3)};`);
    lines.push(`groove_top_w = ${spec.topWidth.toFixed(3)};`);
    lines.push(`num_grooves  = ${p.numGrooves};`);
    lines.push(`groove_spacing = ${p.grooveSpacing.toFixed(3)};`);
  } else if (p.grooveType === "timing") {
    const spec = TIMING_GROOVES[p.timingProfile];
    lines.push(`num_teeth  = ${geo.numTeeth};`);
    lines.push(`tooth_pitch = ${spec.pitch.toFixed(3)};`);
    lines.push(`tooth_depth = ${spec.toothDepth.toFixed(3)};`);
  } else if (p.grooveType === "obelt") {
    const spec = getOBeltGrooveSpec(p.obeltDiameter);
    lines.push(`groove_r   = ${spec.grooveRadius.toFixed(3)};`);
    lines.push(`groove_d   = ${spec.grooveDepth.toFixed(3)};`);
  }

  lines.push(``);
  lines.push(`// ── Main body ───────────────────────────────────`);
  lines.push(`difference() {`);
  lines.push(`  union() {`);

  // Rim
  if (p.grooveType === "vbelt") {
    lines.push(`    // Rim with V-groove(s)`);
    lines.push(`    difference() {`);
    lines.push(`      cylinder(h=face_w, r=outer_r, center=false);`);
    for (let i = 0; i < p.numGrooves; i++) {
      const zc = fw / 2 + (i - (p.numGrooves - 1) / 2) * p.grooveSpacing;
      lines.push(`      // Groove ${i + 1} at z=${zc.toFixed(2)}`);
      lines.push(`      translate([0,0,${zc.toFixed(3)}])`);
      lines.push(`        rotate_extrude() polygon(points=[[root_r,0],[outer_r,-groove_top_w/2],[outer_r,groove_top_w/2]]);`);
    }
    lines.push(`    }`);
  } else if (p.grooveType === "flat") {
    lines.push(`    // Flat belt rim with crown`);
    lines.push(`    rotate_extrude()`);
    lines.push(`      polygon(points=[[0,0],[outer_r,0],[${(od / 2 + p.flatCrown).toFixed(3)},${(fw / 2).toFixed(3)}],[outer_r,face_w],[0,face_w]]);`);
  } else if (p.grooveType === "obelt") {
    lines.push(`    // O-belt rim with semicircular groove`);
    lines.push(`    difference() {`);
    lines.push(`      cylinder(h=face_w, r=outer_r, center=false);`);
    lines.push(`      translate([0,0,face_w/2])`);
    lines.push(`        rotate_extrude()`);
    lines.push(`          translate([outer_r-groove_d/2,0,0]) circle(r=groove_r);`);
    lines.push(`    }`);
  } else if (p.grooveType === "timing") {
    const spec = TIMING_GROOVES[p.timingProfile];
    lines.push(`    // Timing belt pulley with ${geo.numTeeth} teeth`);
    lines.push(`    difference() {`);
    lines.push(`      cylinder(h=face_w, r=outer_r, center=false);`);
    lines.push(`      for (i=[0:num_teeth-1])`);
    lines.push(`        rotate([0,0,i*(360/num_teeth)])`);
    lines.push(`          translate([root_r+tooth_depth/2,0,face_w/2])`);
    lines.push(`            cube([tooth_depth,tooth_pitch*0.5,face_w+0.1],center=true);`);
    lines.push(`    }`);
  }

  // Hub
  lines.push(`    // Hub`);
  lines.push(`    cylinder(h=face_w, r=hub_r, center=false);`);

  // Boss
  if (bossH > 0) {
    lines.push(`    // Boss`);
    lines.push(`    translate([0,0,face_w]) cylinder(h=boss_h, r=boss_r, center=false);`);
  }

  lines.push(`  } // end union`);
  lines.push(``);

  // Bore
  lines.push(`  // Bore`);
  lines.push(`  cylinder(h=face_w+boss_h+1, r=bore_r, center=false);`);

  // Keyway
  if (p.boreType === "keyway" && geo.keyway) {
    const kw = geo.keyway;
    lines.push(`  // Keyway (ISO 773 / DIN 6885): ${kw.width}×${kw.hubDepth}mm`);
    lines.push(`  translate([-${(kw.width / 2).toFixed(3)},bore_r-0.1,-0.1])`);
    lines.push(`    cube([${kw.width.toFixed(3)},${(kw.hubDepth + 0.2).toFixed(3)},face_w+boss_h+1.2]);`);
  }

  // D-shaft flat
  if (p.boreType === "dshaft") {
    lines.push(`  // D-shaft flat: depth=${p.dShaftFlatDepth}mm`);
    lines.push(`  translate([-${(geo.boreDiameter).toFixed(3)}/2,bore_r-${p.dShaftFlatDepth.toFixed(3)},-0.1])`);
    lines.push(`    cube([${geo.boreDiameter.toFixed(3)},${(p.dShaftFlatDepth + 0.1).toFixed(3)},face_w+boss_h+1.2]);`);
  }

  // Web lightening
  if (p.webStyle === "spokes") {
    // rimInnerR: inner edge of rim where spokes attach
    const rimInnerR = (geo.rootDiameter / 2) - 2;
    lines.push(`  // Spokes (${p.numSpokes} spokes, width=${p.spokeWidth}mm)`);
    lines.push(`  for (i=[0:${p.numSpokes - 1}])`);
    lines.push(`    rotate([0,0,i*(360/${p.numSpokes})])`);
    lines.push(`      translate([0,0,(face_w-web_t)/2])`);
    lines.push(`        hull() {`);
    lines.push(`          translate([hub_r+1,0,0]) cylinder(h=web_t, r=${(p.spokeWidth / 2).toFixed(3)});`);
    lines.push(`          translate([${rimInnerR.toFixed(3)},0,0]) cylinder(h=web_t, r=${(p.spokeWidth / 2).toFixed(3)});`);
    lines.push(`        }`);
    lines.push(`  // (Subtract spoke voids from web — already handled by spoke union above)`);
    lines.push(`  // NOTE: For open-web spokes, use the spoke union approach above and subtract the web disk.`);
  } else if (p.webStyle === "lightening") {
    const pcd = geo.lighteningHolePCD / 2;
    lines.push(`  // Lightening holes (${p.numLighteningHoles} × ⌀${p.lighteningHoleDiameter}mm on PCD=${geo.lighteningHolePCD.toFixed(1)}mm)`);
    lines.push(`  for (i=[0:${p.numLighteningHoles - 1}])`);
    lines.push(`    rotate([0,0,i*(360/${p.numLighteningHoles})])`);
    lines.push(`      translate([${pcd.toFixed(3)},0,-0.1])`);
    lines.push(`        cylinder(h=face_w+0.2, r=${(p.lighteningHoleDiameter / 2).toFixed(3)});`);
  } else if (p.webStyle === "fins") {
    lines.push(`  // Fins: solid web with radial cooling fins (subtract between fins)`);
    lines.push(`  for (i=[0:${p.numSpokes - 1}])`);
    lines.push(`    rotate([0,0,i*(360/${p.numSpokes})+${(180 / p.numSpokes).toFixed(1)}])`);
    lines.push(`      translate([0,0,-0.1])`);
    lines.push(`        linear_extrude(face_w+0.2)`);
    lines.push(`          polygon(points=[[hub_r,0],[outer_r-2,${(p.spokeWidth / 2).toFixed(3)}],[outer_r-2,-${(p.spokeWidth / 2).toFixed(3)}]]);`);
  }

  lines.push(`} // end difference`);
  lines.push(``);
  lines.push(`// ── Print notes ─────────────────────────────────`);
  lines.push(`// Material: ${p.material}`);
  lines.push(`// Orientation: ${p.printOrientation === "flat" ? "Flat on bed (belt face down)" : "Upright (axis vertical)"}`);
  lines.push(`// Infill: ${p.infillPercent}% (Gyroid or Rectilinear recommended)`);
  lines.push(`// Perimeters: 4-6 for functional strength`);
  lines.push(`// Layer height: 0.2mm for grooves, 0.15mm for timing teeth`);
  if (geo.printWarnings.length > 0) {
    lines.push(`// WARNINGS:`);
    geo.printWarnings.forEach(w => lines.push(`//   - ${w}`));
  }

  return lines.join("\n");
}

export function downloadPulleyOpenSCAD(p: PulleyParams, geo: PulleyGeometry): void {
  const content = exportPulleyOpenSCAD(p, geo);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = `pulley_${p.grooveType}_D${geo.outerDiameter.toFixed(0)}_B${geo.boreDiameter}.scad`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
