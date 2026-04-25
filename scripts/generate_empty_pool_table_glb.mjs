import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const outPath = path.resolve('assets/glb/billiards/empty_pool_table.glb');

globalThis.FileReader ??= class FileReader {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

const scene = new THREE.Scene();
scene.name = 'empty_pool_table_scene';

const wood = new THREE.MeshStandardMaterial({
  name: 'dark_walnut_wood',
  color: 0x4b2614,
  roughness: 0.48,
  metalness: 0.0,
});

const railTop = new THREE.MeshStandardMaterial({
  name: 'polished_dark_rail',
  color: 0x2c160c,
  roughness: 0.32,
  metalness: 0.0,
});

const felt = new THREE.MeshStandardMaterial({
  name: 'clean_green_felt',
  color: 0x0f6b3f,
  roughness: 0.86,
  metalness: 0.0,
});

const black = new THREE.MeshStandardMaterial({
  name: 'black_rubber_pocket',
  color: 0x020202,
  roughness: 0.72,
  metalness: 0.0,
});

const leather = new THREE.MeshStandardMaterial({
  name: 'dark_leather_pocket_liner',
  color: 0x070504,
  roughness: 0.9,
  metalness: 0.0,
});

const brass = new THREE.MeshStandardMaterial({
  name: 'subtle_brass_trim',
  color: 0xb68a35,
  roughness: 0.28,
  metalness: 0.65,
});

function box(name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function cyl(name, radiusTop, radiusBottom, height, position, rotation, material, segments = 48) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Main dimensions are in meters. The top is intentionally empty: no balls,
// cue sticks, rack, chalk, score markers, or decorative loose objects.
const length = 2.84;
const width = 1.56;
const height = 0.78;
const railWidth = 0.18;
const railHeight = 0.16;
const bedThickness = 0.08;
const feltY = height + bedThickness / 2 + 0.006;

box('solid_table_bed_under_felt', [length, bedThickness, width], [0, height, 0], wood);
box('empty_single_piece_green_felt_playfield', [length - railWidth * 2, 0.018, width - railWidth * 2], [0, feltY, 0], felt);

box('left_long_wood_rail', [length, railHeight, railWidth], [0, height + railHeight / 2, -width / 2 + railWidth / 2], railTop);
box('right_long_wood_rail', [length, railHeight, railWidth], [0, height + railHeight / 2, width / 2 - railWidth / 2], railTop);
box('near_short_wood_rail', [railWidth, railHeight, width], [-length / 2 + railWidth / 2, height + railHeight / 2, 0], railTop);
box('far_short_wood_rail', [railWidth, railHeight, width], [length / 2 - railWidth / 2, height + railHeight / 2, 0], railTop);

box('left_long_outer_apron', [length + 0.12, 0.22, 0.08], [0, height - 0.15, -width / 2 - 0.04], wood);
box('right_long_outer_apron', [length + 0.12, 0.22, 0.08], [0, height - 0.15, width / 2 + 0.04], wood);
box('near_short_outer_apron', [0.08, 0.22, width + 0.12], [-length / 2 - 0.04, height - 0.15, 0], wood);
box('far_short_outer_apron', [0.08, 0.22, width + 0.12], [length / 2 + 0.04, height - 0.15, 0], wood);

// Six empty pockets, represented as recessed dark cups set into the rails.
const pocketY = height + railHeight + 0.006;
const pocketPositions = [
  ['corner_pocket_near_left', -length / 2 + railWidth * 0.58, -width / 2 + railWidth * 0.58],
  ['corner_pocket_near_right', -length / 2 + railWidth * 0.58, width / 2 - railWidth * 0.58],
  ['corner_pocket_far_left', length / 2 - railWidth * 0.58, -width / 2 + railWidth * 0.58],
  ['corner_pocket_far_right', length / 2 - railWidth * 0.58, width / 2 - railWidth * 0.58],
  ['side_pocket_left_middle', 0, -width / 2 + railWidth * 0.42],
  ['side_pocket_right_middle', 0, width / 2 - railWidth * 0.42],
];

for (const [name, x, z] of pocketPositions) {
  cyl(name, 0.085, 0.07, 0.028, [x, pocketY, z], [Math.PI / 2, 0, 0], black);
  cyl(`${name}_liner`, 0.067, 0.052, 0.032, [x, pocketY + 0.003, z], [Math.PI / 2, 0, 0], leather);
}

// Low-profile cushion bands on the inner rail edges.
box('left_inner_cushion_band', [length - 0.36, 0.045, 0.045], [0, height + 0.17, -width / 2 + railWidth + 0.015], black);
box('right_inner_cushion_band', [length - 0.36, 0.045, 0.045], [0, height + 0.17, width / 2 - railWidth - 0.015], black);
box('near_inner_cushion_band', [0.045, 0.045, width - 0.36], [-length / 2 + railWidth + 0.015, height + 0.17, 0], black);
box('far_inner_cushion_band', [0.045, 0.045, width - 0.36], [length / 2 - railWidth - 0.015, height + 0.17, 0], black);

// Simple sturdy legs and brass corner caps. These are part of the table, not loose props.
const legX = length / 2 - 0.34;
const legZ = width / 2 - 0.28;
for (const x of [-legX, legX]) {
  for (const z of [-legZ, legZ]) {
    box(`tapered_square_leg_${x > 0 ? 'far' : 'near'}_${z > 0 ? 'right' : 'left'}`, [0.16, height, 0.16], [x, height / 2 - 0.04, z], wood);
    box(`brass_foot_${x > 0 ? 'far' : 'near'}_${z > 0 ? 'right' : 'left'}`, [0.20, 0.035, 0.20], [x, 0.02, z], brass);
  }
}

for (const x of [-length / 2 + 0.09, length / 2 - 0.09]) {
  for (const z of [-width / 2 + 0.09, width / 2 - 0.09]) {
    box(`small_brass_corner_cap_${x > 0 ? 'far' : 'near'}_${z > 0 ? 'right' : 'left'}`, [0.13, 0.018, 0.13], [x, height + railHeight + 0.012, z], brass);
  }
}

const exporter = new GLTFExporter();
const arrayBuffer = await exporter.parseAsync(scene, { binary: true });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
console.log(outPath);
