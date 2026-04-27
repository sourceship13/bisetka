import fs from 'node:fs';
import path from 'node:path';

const input = path.resolve('assets/glb/game_boards/armenian_marble_gold_chessboard_equal_raised_flat_lowered_more.glb');
const output = path.resolve('assets/glb/game_boards/armenian_marble_silver_black_chessboard_no_eternity.glb');

const JSON_CHUNK = 0x4e4f534a;

function readGlb(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${filePath} is not a GLB file`);
  }

  const chunks = [];
  let offset = 12;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    chunks.push({ type, buffer: data.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }

  const jsonChunk = chunks.find(chunk => chunk.type === JSON_CHUNK);
  if (!jsonChunk) throw new Error('GLB is missing its JSON chunk');

  const json = JSON.parse(jsonChunk.buffer.toString('utf8').trim());
  return { chunks, json };
}

function writeGlb(filePath, chunks, json) {
  const jsonText = JSON.stringify(json);
  const padding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonBuffer = Buffer.from(jsonText + ' '.repeat(padding));
  const outChunks = chunks.map(chunk =>
    chunk.type === JSON_CHUNK ? { ...chunk, buffer: jsonBuffer } : chunk,
  );

  const totalLength = 12 + outChunks.reduce((total, chunk) => total + 8 + chunk.buffer.length, 0);
  const outputBuffer = Buffer.alloc(totalLength);
  outputBuffer.write('glTF', 0, 'ascii');
  outputBuffer.writeUInt32LE(2, 4);
  outputBuffer.writeUInt32LE(totalLength, 8);

  let offset = 12;
  for (const chunk of outChunks) {
    outputBuffer.writeUInt32LE(chunk.buffer.length, offset);
    outputBuffer.writeUInt32LE(chunk.type, offset + 4);
    chunk.buffer.copy(outputBuffer, offset + 8);
    offset += 8 + chunk.buffer.length;
  }

  fs.writeFileSync(filePath, outputBuffer);
}

function recolorMaterial(material, name, color, roughness, metallic) {
  material.name = name;
  material.pbrMetallicRoughness ??= {};
  material.pbrMetallicRoughness.baseColorFactor = color;
  material.pbrMetallicRoughness.roughnessFactor = roughness;
  material.pbrMetallicRoughness.metallicFactor = metallic;
}

const { chunks, json } = readGlb(input);

let removedNodes = 0;
let removedMeshes = 0;

// 1. Remove all visible eternity-symbol nodes and renumber the remaining nodes.
const keepNode = (node) => !/eternity/i.test(node.name ?? '');
const nodeMap = new Map();
const nextNodes = [];
json.nodes.forEach((node, index) => {
  if (keepNode(node)) {
    nodeMap.set(index, nextNodes.length);
    nextNodes.push({ ...node });
  } else {
    removedNodes += 1;
  }
});

for (const node of nextNodes) {
  if (node.children) {
    node.children = node.children
      .filter(childIndex => nodeMap.has(childIndex))
      .map(childIndex => nodeMap.get(childIndex));
  }
}

for (const scene of json.scenes ?? []) {
  if (scene.nodes) {
    scene.nodes = scene.nodes
      .filter(nodeIndex => nodeMap.has(nodeIndex))
      .map(nodeIndex => nodeMap.get(nodeIndex));
  }
}

json.nodes = nextNodes;

// 2. Drop mesh definitions no remaining node references. Binary buffer data can
// stay in place; the GLB will not render those unreferenced primitives.
const usedMeshIndices = new Set(json.nodes.map(node => node.mesh).filter(index => index != null));
const meshMap = new Map();
const nextMeshes = [];
(json.meshes ?? []).forEach((mesh, index) => {
  if (usedMeshIndices.has(index)) {
    meshMap.set(index, nextMeshes.length);
    nextMeshes.push(mesh);
  } else {
    removedMeshes += 1;
  }
});

for (const node of json.nodes) {
  if (node.mesh != null) node.mesh = meshMap.get(node.mesh);
}

json.meshes = nextMeshes;

// 3. Recolor material families.
for (const material of json.materials ?? []) {
  const name = material.name ?? '';
  if (/gold sides squares symbols/i.test(name)) {
    recolorMaterial(material, 'polished silver sides squares', [0.78, 0.80, 0.82, 1], 0.2, 1.0);
  } else if (/subtle gold side veins/i.test(name)) {
    recolorMaterial(material, 'subtle silver side veins', [0.62, 0.66, 0.70, 1], 0.26, 0.85);
  } else if (/white marble top squares/i.test(name)) {
    recolorMaterial(material, 'black marble top squares', [0.015, 0.016, 0.018, 1], 0.38, 0.0);
  } else if (/cream marble rails/i.test(name)) {
    recolorMaterial(material, 'black marble rails', [0.02, 0.018, 0.016, 1], 0.36, 0.0);
  }
}

json.asset ??= {};
json.asset.generator = 'Bisetka silver black marble no-eternity GLB variant';

writeGlb(output, chunks, json);

console.log(output);
console.log(`removedNodes=${removedNodes}`);
console.log(`removedMeshes=${removedMeshes}`);
