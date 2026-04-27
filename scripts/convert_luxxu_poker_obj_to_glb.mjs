import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const objPath = '/Users/alpha/Downloads/uploads_files_6061405_Luxxu_Darian_Poker_table_Large+obj (1).obj';
const textureDir = '/Users/alpha/Downloads/Textures';
const outPath = '/Users/alpha/Downloads/uploads_files_6061405_Luxxu_Darian_Poker_table_Large_dark_wood.glb';
const scale = 0.001;
const generatedTextureDir = '/tmp/bisetka-luxxu-textures';
const greenGoldTablePrint = path.join(generatedTextureDir, 'green_gold_table_print.jpg');
const darkCharcoalWood = path.join(generatedTextureDir, 'dark_charcoal_wood.jpg');

const groupMaterials = [
  {
    match: /Card_03/i,
    name: 'card_03_karta_2',
    baseColor: 'karta_2.jpg',
    normal: 'karta_2_bump.jpg',
    color: [1, 1, 1, 1],
    roughness: 0.55,
    metallic: 0,
  },
  {
    match: /Card_02/i,
    name: 'card_02_karta',
    baseColor: 'karta.jpg',
    normal: 'karta_2_bump.jpg',
    color: [1, 1, 1, 1],
    roughness: 0.55,
    metallic: 0,
  },
  {
    match: /Card_01/i,
    name: 'card_01_karta',
    baseColor: 'karta.jpg',
    normal: 'karta_2_bump.jpg',
    color: [1, 1, 1, 1],
    roughness: 0.55,
    metallic: 0,
  },
  {
    match: /poker_chips/i,
    name: 'poker_chips_fishki',
    baseColor: 'fishki.jpg',
    color: [1, 1, 1, 1],
    roughness: 0.45,
    metallic: 0,
  },
  {
    match: /Whiskey_Glass/i,
    name: 'whiskey_glass',
    baseColor: 'Glass_Displacement.jpg',
    color: [0.82, 0.94, 1, 0.38],
    roughness: 0.08,
    metallic: 0,
    alphaMode: 'BLEND',
  },
  {
    match: /Whisky_decanter/i,
    name: 'whisky_decanter',
    baseColor: 'wisky decainer mix.jpg',
    color: [1, 1, 1, 0.72],
    roughness: 0.12,
    metallic: 0,
    alphaMode: 'BLEND',
  },
  {
    match: /Ashtray/i,
    name: 'ashtray_brushed_metal',
    baseColor: 'brushed_met.jpg',
    color: [0.9, 0.9, 0.9, 1],
    roughness: 0.28,
    metallic: 0.8,
  },
  {
    match: /Cigar_Smoke/i,
    name: 'cigar_smoke',
    baseColor: 'Smoke.jpg',
    color: [1, 1, 1, 0.45],
    roughness: 1,
    metallic: 0,
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  {
    match: /Cigar/i,
    name: 'cigar',
    baseColor: 'Sigar dif.jpg',
    normal: 'Sigar dif b.jpg',
    color: [1, 1, 1, 1],
    roughness: 0.7,
    metallic: 0,
  },
  {
    match: /Luxxu_Darian_Poker_table_Large$/i,
    name: 'large_poker_table_print',
    baseColor: greenGoldTablePrint,
    normal: 'NormalMapf.png',
    color: [1, 1, 1, 1],
    roughness: 0.82,
    metallic: 0,
  },
];

const tableFeltMaterial = {
  name: 'green_felt_with_gold_texas_holdem_lines',
  baseColor: greenGoldTablePrint,
  normal: 'NormalMapf.png',
  color: [1, 1, 1, 1],
  roughness: 0.88,
  metallic: 0,
};

const tableDarkRailMaterial = {
  name: 'dark_charcoal_wood_outer_rail',
  baseColor: darkCharcoalWood,
  normal: 'NormalMapf.png',
  color: [0.88, 0.84, 0.78, 1],
  roughness: 0.5,
  metallic: 0,
};

const tableDarkWoodMaterial = {
  name: 'dark_charcoal_wood_table_body',
  baseColor: darkCharcoalWood,
  normal: 'NormalMapf.png',
  color: [0.9, 0.86, 0.78, 1],
  roughness: 0.54,
  metallic: 0,
};

const tableGoldMaterial = {
  name: 'gold_metal_foot_trim',
  color: [1.0, 0.68, 0.23, 1],
  roughness: 0.22,
  metallic: 1,
};

const fallbackMaterial = {
  name: 'fallback_okavango',
  baseColor: 'Okavango_dif.jpg',
  color: [1, 1, 1, 1],
  roughness: 0.6,
  metallic: 0,
};

function materialForGroup(name) {
  return groupMaterials.find(def => def.match.test(name)) ?? fallbackMaterial;
}

async function createGreenGoldTablePrint() {
  fs.mkdirSync(generatedTextureDir, { recursive: true });
  const source = path.join(textureDir, 'Large_Pocker_Table_Print.jpg');
  const { data, info } = await sharp(source)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const green = [28, 132, 72];
  const darkGreen = [18, 92, 52];
  const gold = [214, 174, 84];

  for (let i = 0; i < data.length; i += info.channels) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const lineAmount = Math.max(0, Math.min(1, (luminance - 22) / 185));
    const feltNoise = ((i / info.channels) % 37) / 37;
    const base = luminance < 6 ? darkGreen : green;
    data[i] = Math.round(base[0] * (1 - lineAmount) + gold[0] * lineAmount + feltNoise * 4);
    data[i + 1] = Math.round(base[1] * (1 - lineAmount) + gold[1] * lineAmount + feltNoise * 3);
    data[i + 2] = Math.round(base[2] * (1 - lineAmount) + gold[2] * lineAmount + feltNoise * 2);
  }

  await sharp(data, { raw: info }).jpeg({ quality: 92 }).toFile(greenGoldTablePrint);
}

async function createDarkCharcoalWood() {
  fs.mkdirSync(generatedTextureDir, { recursive: true });
  const source = path.join(textureDir, 'Okavango_dif.jpg');
  const { data, info } = await sharp(source)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const darkBrown = [20, 19, 17];
  const charcoal = [74, 72, 66];

  for (let i = 0; i < data.length; i += info.channels) {
    const luminance = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    const grain = Math.max(0, Math.min(1, (luminance - 0.18) * 1.65));
    data[i] = Math.round(darkBrown[0] * (1 - grain) + charcoal[0] * grain);
    data[i + 1] = Math.round(darkBrown[1] * (1 - grain) + charcoal[1] * grain);
    data[i + 2] = Math.round(darkBrown[2] * (1 - grain) + charcoal[2] * grain);
  }

  await sharp(data, { raw: info }).jpeg({ quality: 94 }).toFile(darkCharcoalWood);
}

function align4(buffer) {
  const pad = (4 - (buffer.length % 4)) % 4;
  return pad ? Buffer.concat([buffer, Buffer.alloc(pad)]) : buffer;
}

function alignJson(buffer) {
  const pad = (4 - (buffer.length % 4)) % 4;
  return pad ? Buffer.concat([buffer, Buffer.alloc(pad, 0x20)]) : buffer;
}

function pushBufferView(gltf, chunks, buffer, target) {
  const byteOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const aligned = align4(buffer);
  chunks.push(aligned);
  const view = { buffer: 0, byteOffset, byteLength: buffer.length };
  if (target) view.target = target;
  gltf.bufferViews.push(view);
  return gltf.bufferViews.length - 1;
}

function pushAccessor(gltf, chunks, array, componentType, type, target, min, max) {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const bufferView = pushBufferView(gltf, chunks, bytes, target);
  const accessor = {
    bufferView,
    byteOffset: 0,
    componentType,
    count: array.length / ({ SCALAR: 1, VEC2: 2, VEC3: 3 }[type]),
    type,
  };
  if (min) accessor.min = min;
  if (max) accessor.max = max;
  gltf.accessors.push(accessor);
  return gltf.accessors.length - 1;
}

function parseObj(filePath) {
  const positions = [null];
  const uvs = [null];
  const groups = [];
  let current = null;

  function ensureGroup(name = 'default') {
    if (!current || current.name !== name) {
      current = { name, triangles: [] };
      groups.push(current);
    }
    return current;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line[0] === '#') continue;
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      positions.push([
        Number(parts[1]) * scale,
        Number(parts[2]) * scale,
        Number(parts[3]) * scale,
      ]);
    } else if (parts[0] === 'vt') {
      uvs.push([Number(parts[1]), 1 - Number(parts[2])]);
    } else if (parts[0] === 'g' || parts[0] === 'o') {
      ensureGroup(parts.slice(1).join('_') || 'default');
    } else if (parts[0] === 'f') {
      const group = current ?? ensureGroup();
      const verts = parts.slice(1).map(token => {
        const [v, vt] = token.split('/');
        return { v: Number(v), vt: vt ? Number(vt) : 0 };
      });
      for (let i = 1; i < verts.length - 1; i += 1) {
        group.triangles.push([verts[0], verts[i], verts[i + 1]]);
      }
    }
  }

  return { positions, uvs, groups: groups.filter(group => group.triangles.length > 0) };
}

function buildPrimitiveData(group, positions, uvs) {
  const vertexMap = new Map();
  const outPositions = [];
  const outUvs = [];
  const normals = [];
  const indices = [];

  function getVertex(ref) {
    const key = `${ref.v}/${ref.vt}`;
    if (vertexMap.has(key)) return vertexMap.get(key);

    const index = outPositions.length / 3;
    const position = positions[ref.v] ?? [0, 0, 0];
    const uv = uvs[ref.vt] ?? [0, 0];
    outPositions.push(position[0], position[1], position[2]);
    outUvs.push(uv[0], uv[1]);
    normals.push(0, 0, 0);
    vertexMap.set(key, index);
    return index;
  }

  for (const tri of group.triangles) {
    const ids = tri.map(getVertex);
    indices.push(...ids);

    const p0 = outPositions.slice(ids[0] * 3, ids[0] * 3 + 3);
    const p1 = outPositions.slice(ids[1] * 3, ids[1] * 3 + 3);
    const p2 = outPositions.slice(ids[2] * 3, ids[2] * 3 + 3);
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    for (const id of ids) {
      normals[id * 3] += nx;
      normals[id * 3 + 1] += ny;
      normals[id * 3 + 2] += nz;
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < outPositions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = outPositions[i + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }

  return {
    positions: new Float32Array(outPositions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(outUvs),
    indices: new Uint32Array(indices),
    min,
    max,
  };
}

function mimeFor(fileName) {
  return /\.png$/i.test(fileName) ? 'image/png' : 'image/jpeg';
}

function textureIndex(gltf, chunks, fileName, textureCache) {
  if (!fileName) return undefined;
  if (textureCache.has(fileName)) return textureCache.get(fileName);
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(textureDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing texture: ${filePath}`);
    return undefined;
  }

  const imageBytes = fs.readFileSync(filePath);
  const bufferView = pushBufferView(gltf, chunks, imageBytes, undefined);
  gltf.images.push({ name: path.parse(fileName).name, bufferView, mimeType: mimeFor(fileName) });
  const source = gltf.images.length - 1;
  gltf.textures.push({ source, sampler: 0 });
  const index = gltf.textures.length - 1;
  textureCache.set(fileName, index);
  return index;
}

function materialIndex(gltf, chunks, materialDef, materialCache, textureCache) {
  const key = JSON.stringify(materialDef);
  if (materialCache.has(key)) return materialCache.get(key);

  const material = {
    name: materialDef.name,
    pbrMetallicRoughness: {
      baseColorFactor: materialDef.color,
      metallicFactor: materialDef.metallic,
      roughnessFactor: materialDef.roughness,
    },
  };

  const baseColorTexture = textureIndex(gltf, chunks, materialDef.baseColor, textureCache);
  if (baseColorTexture !== undefined) {
    material.pbrMetallicRoughness.baseColorTexture = { index: baseColorTexture };
  }

  const normalTexture = textureIndex(gltf, chunks, materialDef.normal, textureCache);
  if (normalTexture !== undefined) {
    material.normalTexture = { index: normalTexture, scale: 0.7 };
  }

  if (materialDef.alphaMode) material.alphaMode = materialDef.alphaMode;
  if (materialDef.doubleSided) material.doubleSided = true;

  gltf.materials.push(material);
  const index = gltf.materials.length - 1;
  materialCache.set(key, index);
  return index;
}

function averageTriangle(triangle, positions) {
  let x = 0, y = 0, z = 0;
  for (const ref of triangle) {
    const position = positions[ref.v] ?? [0, 0, 0];
    x += position[0];
    y += position[1];
    z += position[2];
  }
  x /= 3;
  y /= 3;
  z /= 3;
  return { x, y, z, radius: Math.hypot(x, z) };
}

function splitTableGroup(group, positions) {
  if (group.name !== 'Luxxu_Darian_Poker_table_Large') return [group];

  const buckets = {
    felt: { name: `${group.name}_green_felt`, materialDef: tableFeltMaterial, triangles: [] },
    rail: { name: `${group.name}_black_rail`, materialDef: tableDarkRailMaterial, triangles: [] },
    wood: { name: `${group.name}_dark_wood_body`, materialDef: tableDarkWoodMaterial, triangles: [] },
    gold: { name: `${group.name}_gold_foot_trim`, materialDef: tableGoldMaterial, triangles: [] },
  };

  for (const triangle of group.triangles) {
    const avg = averageTriangle(triangle, positions);
    if (avg.y < 0.045 && avg.radius > 0.18) {
      buckets.gold.triangles.push(triangle);
    } else if (avg.y > 0.735 && avg.radius < 0.585) {
      buckets.felt.triangles.push(triangle);
    } else if (avg.y > 0.735) {
      buckets.rail.triangles.push(triangle);
    } else {
      buckets.wood.triangles.push(triangle);
    }
  }

  return Object.values(buckets).filter(bucket => bucket.triangles.length > 0);
}

async function buildGlb() {
  await createGreenGoldTablePrint();
  await createDarkCharcoalWood();
  const { positions, uvs, groups } = parseObj(objPath);
  const chunks = [];
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Bisetka OBJ + Downloads texture converter',
    },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
    materials: [],
    images: [],
    textures: [],
    samplers: [{
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    }],
  };

  const materialCache = new Map();
  const textureCache = new Map();

  const renderGroups = groups.flatMap(group => splitTableGroup(group, positions));

  for (const group of renderGroups) {
    const primitive = buildPrimitiveData(group, positions, uvs);
    const posAccessor = pushAccessor(gltf, chunks, primitive.positions, 5126, 'VEC3', 34962, primitive.min, primitive.max);
    const normalAccessor = pushAccessor(gltf, chunks, primitive.normals, 5126, 'VEC3', 34962);
    const uvAccessor = pushAccessor(gltf, chunks, primitive.uvs, 5126, 'VEC2', 34962);
    const indexAccessor = pushAccessor(gltf, chunks, primitive.indices, 5125, 'SCALAR', 34963);
    const matAccessor = materialIndex(gltf, chunks, group.materialDef ?? materialForGroup(group.name), materialCache, textureCache);

    gltf.meshes.push({
      name: group.name,
      primitives: [{
        attributes: {
          POSITION: posAccessor,
          NORMAL: normalAccessor,
          TEXCOORD_0: uvAccessor,
        },
        indices: indexAccessor,
        material: matAccessor,
        mode: 4,
      }],
    });
    const meshIndex = gltf.meshes.length - 1;
    gltf.nodes.push({ name: group.name, mesh: meshIndex });
    gltf.scenes[0].nodes.push(gltf.nodes.length - 1);
  }

  const bin = Buffer.concat(chunks);
  gltf.buffers[0].byteLength = bin.length;

  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadded = alignJson(json);
  const binPadded = align4(bin);
  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const glb = Buffer.alloc(totalLength);
  glb.write('glTF', 0, 'ascii');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(totalLength, 8);
  glb.writeUInt32LE(jsonPadded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonPadded.copy(glb, 20);
  const binHeader = 20 + jsonPadded.length;
  glb.writeUInt32LE(binPadded.length, binHeader);
  glb.writeUInt32LE(0x004e4942, binHeader + 4);
  binPadded.copy(glb, binHeader + 8);

  fs.writeFileSync(outPath, glb);
  return {
    outPath,
    groups: groups.map(group => group.name),
    renderGroups: renderGroups.map(group => group.name),
    textures: [...textureCache.keys()],
    bytes: glb.length,
  };
}

console.log(JSON.stringify(await buildGlb(), null, 2));
