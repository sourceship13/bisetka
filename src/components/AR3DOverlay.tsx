/**
 * AR3DOverlay.tsx
 *
 * Renders a transparent Three.js scene on top of the Photosphere that shares
 * the same gyro attitude data via useSharedAttitude().
 *
 * ─── Why no require() for GLB? ───────────────────────────────────────────────
 *   require() of binary assets goes through Metro's module resolver, which
 *   requires a cache reset every time assetExts is changed.  Instead, we
 *   accept path strings (relative to the project's assets/ folder) and
 *   derive the correct URI at runtime:
 *     • Dev  — use NativeModules.SourceCode.scriptURL to get the Metro host
 *               (works on simulator AND physical device with correct IP)
 *               → http://<metro-host>:8081/assets/<path>
 *     • Prod — use RNFS to read the bundled file and return a base64 data URL
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <Photosphere360Background overlayOpacity={0.3}>
 *     <AR3DOverlay
 *       visible={arEnabled}
 *       pieces={arPieces}
 *       boardGlbPath="glb/chess/chess-board/source/ui.glb"
 *       piecesGlbPath="glb/checkers/checker_pieces.glb"
 *     />
 *   </Photosphere360Background>
 */

import React, {useRef, useEffect, useState, useMemo, useCallback} from 'react';
import {StyleSheet, View, NativeModules, Platform} from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import {useSharedAttitude} from './Photosphere360Background';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ARPiece {
  key: string;
  row: number;
  col: number;
  color: 'red' | 'black';
  isKing: boolean;
  isSelected?: boolean;
}

export interface ARMove {
  row: number;
  col: number;
}

export interface AR3DOverlayProps {
  visible?: boolean;
  pieces?: ARPiece[];
  /** Possible-move squares — shown as 3D glowing dots on the board */
  moves?: ARMove[];
  /** Camera FOV — should match your Photosphere viewer (default 75) */
  fov?: number;
  /**
   * Path relative to assets/ folder for the chess-board GLB.
   * e.g. "glb/chess/chess-board/source/ui.glb"
   * Falls back to procedural board if omitted or if load fails.
   */
  boardGlbPath?: string;
  /**
   * Path relative to assets/ folder for the checker piece GLB.
   * e.g. "glb/checkers/checker_pieces.glb"
   * Falls back to procedural disc geometry if omitted or if load fails.
   */
  piecesGlbPath?: string;
  /**
   * Path relative to assets/ folder for the park table GLB.
   * e.g. "glb/park/table.glb"
   * Table is placed at the centre of the 360° sphere; board sits on top of it.
   * Falls back to a simple procedural table if omitted or if load fails.
   */
  tableGlbPath?: string;
}

// ─── GLB URI resolver ─────────────────────────────────────────────────────────

/**
 * Turns a project-assets-relative path into a base64 data URI for the WebView.
 *
 * Dev  — Downloads from Metro's asset server via RNFS.downloadFile.
 *         Metro path format varies by version, so we try both:
 *           /assets/assets/<path>  (RN ≥ 0.73 / Metro ≥ 0.73)
 *           /assets/<path>         (legacy)
 *         Whichever returns HTTP 200 wins.
 * Prod — Reads directly from the app bundle via RNFS.
 */
async function resolveAssetUri(assetPath: string): Promise<string | null> {
  // Stable temp-file name reused across calls (avoids re-downloading same GLB)
  const safeFileName = assetPath.replace(/[\/\\]/g, '_');
  const tempPath = `${RNFS.TemporaryDirectoryPath}ar_glb_${safeFileName}`;

  try {
    if (__DEV__) {
      const scriptUrl: string =
        (NativeModules.SourceCode as any)?.scriptURL ?? '';
      const match = scriptUrl.match(/^(https?:\/\/[^/:]+(?::\d+)?)/);
      const base = match ? match[1] : 'http://localhost:8081';

      // Try cache first — avoids re-download on hot-reload
      const cached = await RNFS.exists(tempPath);
      if (cached) {
        const b64 = await RNFS.readFile(tempPath, 'base64');
        return `data:model/gltf-binary;base64,${b64}`;
      }

      for (const url of [
        `${base}/assets/assets/${assetPath}`,  // Metro ≥ 0.73 (RN 0.73+)
        `${base}/assets/${assetPath}`,           // legacy Metro
      ]) {
        try {
          const dl = RNFS.downloadFile({fromUrl: url, toFile: tempPath});
          const res = await dl.promise;
          if (res.statusCode === 200) {
            const b64 = await RNFS.readFile(tempPath, 'base64');
            return `data:model/gltf-binary;base64,${b64}`;
          }
        } catch {/* try next URL format */}
      }

      console.warn('[AR3DOverlay] GLB not found on Metro server:', assetPath);
      return null;
    }

    // Production: read directly from the app bundle
    if (Platform.OS === 'ios') {
      const b64 = await RNFS.readFile(
        `${RNFS.MainBundlePath}/assets/${assetPath}`,
        'base64',
      );
      return `data:model/gltf-binary;base64,${b64}`;
    }
    // Android
    const b64 = await RNFS.readFileAssets(`assets/${assetPath}`, 'base64');
    return `data:model/gltf-binary;base64,${b64}`;
  } catch (e) {
    console.warn('[AR3DOverlay] asset resolve failed:', assetPath, e);
    return null;
  }
}

// ─── Three.js WebView HTML ────────────────────────────────────────────────────

function buildSceneHTML(
  fov: number,
  boardUri:   string | null,
  piecesUri:  string | null,
  tableUri:   string | null,
  spawnYaw:   number,
): string {
  const BOARD_URI_JS  = boardUri  ? JSON.stringify(boardUri)  : 'null';
  const PIECES_URI_JS = piecesUri ? JSON.stringify(piecesUri) : 'null';
  const TABLE_URI_JS  = tableUri  ? JSON.stringify(tableUri)  : 'null';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:transparent; overflow:hidden; }
  canvas { display:block; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.166.1/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.166.1/examples/jsm/"
  }
}
</script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Shared mutable state (updated by injectJavaScript) ───────────────────────
// Use || so that if injectJavaScript already set window._att with the live gyro
// value before this module script ran (async CDN load), we keep it.
// spawnYaw is the safe fallback so the camera starts aligned with the sceneGroup
// even if injectJavaScript hasn't fired yet.
window._att    = window._att || { yaw: ${spawnYaw}, pitch: 0, roll: 0 };
window._pieces = window._pieces || [];

// ── Renderer ─────────────────────────────────────────────────────────────────
const W = window.innerWidth, H = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 2, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── Scene & Camera ───────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(${fov}, W / H, 0.01, 200);
camera.position.set(0, 0, 0);
scene.add(camera);

// ── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xfff0e0, 0.55));
const key = new THREE.DirectionalLight(0xfff4e0, 1.10);
key.position.set(0, 8, 4); key.castShadow = true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.near=0.5; key.shadow.camera.far=30;
key.shadow.camera.left=-4; key.shadow.camera.right=4;
key.shadow.camera.top=4;   key.shadow.camera.bottom=-4;
scene.add(key);
const camFill = new THREE.DirectionalLight(0xd0e8ff, 0.55);
camFill.position.set(0, 3, 2); camera.add(camFill);
const camRim = new THREE.DirectionalLight(0xffe0a0, 0.28);
camRim.position.set(0, -1, -3); camera.add(camRim);

// ── World-space constants (1 unit ≈ 1 metre) ─────────────────────────────────
const TABLE_SCALE      = 0.40;   // table.glb raw size ~4.5m → scaled to ~1.8m
const TABLE_DIST       = 1.5;    // metres in front of player (sceneGroup local -Z)
const TABLE_GLB_YMIN   = -1.0;   // foot of the table in GLB local space
const TABLE_GLB_YTOP   =  3.212; // tabletop surface in GLB local space
const FLOOR_Y          = -2.7;   // 2.7m below viewer eye level → surface ~1m below eye
const TABLE_ORIGIN_Y   = FLOOR_Y - TABLE_GLB_YMIN * TABLE_SCALE;           // -2.3
const TABLE_SURFACE_Y  = TABLE_ORIGIN_Y + TABLE_GLB_YTOP * TABLE_SCALE;    // -1.015
const BOARD_Y  = TABLE_SURFACE_Y + 0.025;  // board just above tabletop
const BOARD_HALF   = 0.35;  // 70 cm half-width (fits on 1.8m table)
const BOARD_HALF_W = BOARD_HALF;
const BOARD_HALF_H = BOARD_HALF;
const SQUARE_W     = (BOARD_HALF_W * 2) / 8;
const SQUARE_H     = SQUARE_W;
const PIECE_SCALE  = SQUARE_W * 0.80;

// ── sceneGroup starts as a camera child so it is always in front ─────────────────
// On the first animation frame (after camera rotation is applied from live gyro)
// it is detached from the camera and re-parented to the scene preserving its
// world matrix — so it stays fixed in the room from that point on.
// This completely sidesteps any yaw sign/offset ambiguity.
const DEG = Math.PI / 180;
const sceneGroup = new THREE.Group();
sceneGroup.position.x = 0.0; // shift right in camera space to centre in view
camera.add(sceneGroup);  // ← camera child: local (0,0,-TABLE_DIST) = always in front
let _frozen = false;
let _freezeCountdown = 8; // wait 8 frames for live gyro injectJavaScript to arrive

// ── Board group — flat horizontal, TABLE_DIST ahead in camera/sceneGroup space ───
const boardGroup = new THREE.Group();
boardGroup.position.set(0, BOARD_Y, -TABLE_DIST);
boardGroup.rotation.x = -Math.PI / 2;
sceneGroup.add(boardGroup);

// ── Procedural fallback board ─────────────────────────────────────────────────
function buildProceduralBoard() {
  boardGroup.add(new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_HALF_W*2+0.04, BOARD_HALF_H*2+0.04),
    new THREE.MeshStandardMaterial({ color:0x3b2206, roughness:0.75, metalness:0.06 })
  ));
  const lMat = new THREE.MeshStandardMaterial({ color:0xe8d5b5, roughness:0.5,  metalness:0.04 });
  const dMat = new THREE.MeshStandardMaterial({ color:0x7a4a22, roughness:0.65, metalness:0.06 });
  const sqGeo = new THREE.PlaneGeometry(SQUARE_W*0.97, SQUARE_H*0.97);
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const sq = new THREE.Mesh(sqGeo, (r+c)%2===0 ? lMat : dMat);
    sq.position.set(-BOARD_HALF_W+(c+0.5)*SQUARE_W, BOARD_HALF_H-(r+0.5)*SQUARE_H, 0.001);
    boardGroup.add(sq);
  }
  const rimLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_HALF_W*2+0.03, BOARD_HALF_H*2+0.03, 0.005)),
    new THREE.LineBasicMaterial({ color:0xd4af37 })
  );
  rimLine.position.z = 0.003;
  boardGroup.add(rimLine);
}

// ── Load GLB assets ─────────────────────────────────────────────────────────────────
const BOARD_URI  = ${BOARD_URI_JS};
const PIECES_URI = ${PIECES_URI_JS};
const TABLE_URI  = ${TABLE_URI_JS};
const loader     = new GLTFLoader();

// Load TABLE (world-space)
function buildProceduralTable() {
  const wood  = new THREE.MeshStandardMaterial({ color:0x8B5E3C, roughness:0.65, metalness:0.04 });
  const metal = new THREE.MeshStandardMaterial({ color:0x505050, roughness:0.40, metalness:0.60 });
  const tw = BOARD_HALF_W * 2.8, td = BOARD_HALF_H * 2.8;
  const top = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.04, td), wood);
  top.position.set(0, TABLE_SURFACE_Y - 0.02, -TABLE_DIST);
  top.castShadow = top.receiveShadow = true;
  sceneGroup.add(top);
  const legH = TABLE_SURFACE_Y - FLOOR_Y;
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, legH, 8);
  [[tw/2-0.05, td/2-0.05],[-(tw/2-0.05), td/2-0.05],
   [tw/2-0.05,-(td/2-0.05)],[-(tw/2-0.05),-(td/2-0.05)]].forEach(([lx,lz])=>{
    const leg = new THREE.Mesh(legGeo, metal);
    leg.position.set(lx, FLOOR_Y + legH/2, -TABLE_DIST + lz);
    sceneGroup.add(leg);
  });
}

if (TABLE_URI) {
  // TEMP: Use procedural table to debug
  console.warn('[AR3DOverlay] Using procedural table instead of GLB for debugging');
  buildProceduralTable();
} else {
  buildProceduralTable();
}

// ── Load BOARD (in boardGroup — world-space, flat) ───────────────────────────
if (BOARD_URI) {
  loader.load(BOARD_URI, (gltf) => {
    const model = gltf.scene;
    // GLB boards are typically Y-up; rotate to lie flat in boardGroup's XY plane
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    const box    = new THREE.Box3().setFromObject(model);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale  = (BOARD_HALF_W * 2) / Math.max(size.x, size.y, 0.001);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const box2   = new THREE.Box3().setFromObject(model);
    const ctr2   = box2.getCenter(new THREE.Vector3());
    model.position.set(-ctr2.x, -ctr2.y, -(box2.min.z) + 0.001);
    model.traverse(ch => {
      if (ch.isMesh) {
        ch.receiveShadow = true;
        const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(m => { if (m) m.roughness = Math.max((m.roughness||0.5)*0.8, 0.35); });
      }
    });
    boardGroup.add(model);
  }, undefined, () => buildProceduralBoard());
} else {
  buildProceduralBoard();
}

// ── Procedural fallback piece ─────────────────────────────────────────────────
function makeFallbackPiece(color, isKing) {
  const clr = color === 'red' ? 0xc0392b : 0x1e2d3d;
  const g   = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.5, 0.22, 48),
    new THREE.MeshStandardMaterial({
      color: clr,
      metalness: isKing ? 0.82 : 0.18,
      roughness: isKing ? 0.10 : 0.52,
      emissive: new THREE.Color(isKing ? clr : 0x000000),
      emissiveIntensity: isKing ? 0.20 : 0,
    })
  );
  body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 48),
    new THREE.MeshStandardMaterial({ color: isKing ? 0xf0c830 : clr, metalness: isKing ? 0.92 : 0.10, roughness: isKing ? 0.07 : 0.38 })
  );
  top.position.y = 0.112; top.rotation.x = -Math.PI/2;
  g.add(top);
  if (isKing) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.045, 8, 48),
      new THREE.MeshStandardMaterial({ color:0xf5c842, metalness:0.95, roughness:0.05 })
    );
    ring.rotation.x = Math.PI/2; ring.position.y = 0.108; ring.castShadow = true;
    g.add(ring);
  }
  // Rotate so cylinder axis aligns with boardGroup local Z → world Y (up).
  // boardGroup.rotation.x = -PI/2, so this cancels it: piece stands flat on board.
  g.rotation.x = Math.PI / 2;
  return g;
}

// ── Load GLB checker piece (base mesh, cloned per piece) ─────────────────────
let basePieceScene = null;
// Track pending pieces to place once GLB loads
let pendingPiecesUpdate = null;

if (PIECES_URI) {
  loader.load(PIECES_URI, (gltf) => {
    const model = gltf.scene;
    // Scale: the GLB piece spans ~16 units; we want it to fit inside a square
    const box  = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    // Normalise to unit-cube so we can re-scale per piece
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(1 / maxDim);
    // Centre at origin, sit flat
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x/maxDim, -(box.min.y/maxDim), -center.z/maxDim);
    basePieceScene = model;
    // Flush any update that was waiting for the GLB to load
    if (pendingPiecesUpdate) {
      updatePieces(pendingPiecesUpdate);
      pendingPiecesUpdate = null;
    }
  }, undefined, () => {
    // Pieces GLB failed — clonePiece() will use fallback geometry
    console.warn('[AR3DOverlay] pieces GLB load failed, using procedural discs');
    if (pendingPiecesUpdate) {
      updatePieces(pendingPiecesUpdate);
      pendingPiecesUpdate = null;
    }
  });
}

function clonePiece(color, isKing) {
  if (!basePieceScene) return makeFallbackPiece(color, isKing);

  const pieceColor = color === 'red' ? 0xc0392b : 0x1e2d3d;
  const clone = basePieceScene.clone(true);
  clone.rotation.x = Math.PI / 2;  // ← cancels boardGroup rotation → upright in world

  clone.traverse(ch => {
    if (!ch.isMesh) return;
    ch.castShadow = true;
    const origMats = Array.isArray(ch.material) ? ch.material : [ch.material];
    const newMats  = origMats.map(m => {
      const nm = m.clone();
      nm.color.setHex(pieceColor);
      if (isKing) {
        nm.metalness = 0.82;
        nm.roughness = 0.10;
        nm.emissive  = new THREE.Color(pieceColor);
        nm.emissiveIntensity = 0.22;
      } else {
        nm.metalness = 0.18;
        nm.roughness = 0.52;
      }
      return nm;
    });
    ch.material = Array.isArray(ch.material) ? newMats : newMats[0];
  });

  // King: add gold rim ring on top
  if (isKing) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.50, 0.06, 8, 48),
      new THREE.MeshStandardMaterial({ color:0xf5c842, metalness:0.95, roughness:0.05 })
    );
    ring.position.y = 0.52;
    ring.rotation.x = Math.PI/2;
    clone.add(ring);
  }
  return clone;
}

// ── Piece management ──────────────────────────────────────────────────────────
const pieceMeshes = {};
const pieceState  = {};

function boardToLocal(row, col) {
  return [
    -BOARD_HALF_W + (col + 0.5) * SQUARE_W,
     BOARD_HALF_H - (row + 0.5) * SQUARE_H,
     0.010,  // BG local Z → world Y: piece center just above board surface
  ];
}

function updatePieces(pieces) {
  // If pieces GLB is still loading, defer
  if (PIECES_URI && !basePieceScene) {
    pendingPiecesUpdate = pieces;
    return;
  }

  const incoming = {};
  pieces.forEach(p => { incoming[p.key] = p; });

  for (const k of Object.keys(pieceMeshes)) {
    if (!incoming[k]) {
      boardGroup.remove(pieceMeshes[k]);
      delete pieceMeshes[k];
      delete pieceState[k];
    }
  }

  for (const p of pieces) {
    const prev = pieceState[p.key];
    if (!prev || prev.color !== p.color || prev.isKing !== p.isKing) {
      if (pieceMeshes[p.key]) boardGroup.remove(pieceMeshes[p.key]);
      pieceMeshes[p.key] = clonePiece(p.color, p.isKing);
      boardGroup.add(pieceMeshes[p.key]);
      pieceState[p.key] = { color: p.color, isKing: p.isKing };
    }

    const mesh  = pieceMeshes[p.key];
    const loc   = boardToLocal(p.row, p.col);
    const lift  = p.isSelected ? 0.12 : 0;
    const scale = (p.isSelected ? PIECE_SCALE * 1.12 : PIECE_SCALE);
    mesh.position.set(loc[0], loc[1], loc[2] + lift);
    // Y in scale = world-Y puck height (via rotation chain)
    mesh.scale.set(scale, scale * 0.35, scale);
  }
}

// ── Possible-move dots ────────────────────────────────────────────────────────
const dotMeshes = [];
const dotGeo    = new THREE.CircleGeometry(SQUARE_W * 0.25, 20);
const dotMat    = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.60, side:THREE.DoubleSide });

function updateDots(moves) {
  dotMeshes.forEach(d => boardGroup.remove(d));
  dotMeshes.length = 0;
  for (const m of (moves||[])) {
    const d = new THREE.Mesh(dotGeo, dotMat);
    const loc = boardToLocal(m.row, m.col);
    d.position.set(loc[0], loc[1], 0.018);
    dotMeshes.push(d);
    boardGroup.add(d);
  }
}

// ── RN bridge ────────────────────────────────────────────────────────────────
window.handleRNMessage = function(data) {
  if (!data || !data.type) return;
  if (data.type === 'spawn') {
    // Rotate sceneGroup so its -Z axis aligns with player's initial facing direction.
    // Camera forward at yaw Y is (sin(Y*DEG), 0, -cos(Y*DEG)); sceneGroup -Z after
    // rotation.y = -Y*DEG gives the same direction.
    sceneGroup.rotation.y = -data.yaw * DEG;
  }
  if (data.type === 'scene') {
    window._pieces = data.pieces || [];
    updatePieces(window._pieces);
    updateDots(data.moves || []);
  }
};
function onMsg(e) { try { window.handleRNMessage(JSON.parse(e.data)); } catch(_){} }
window.addEventListener('message',  onMsg);
document.addEventListener('message', onMsg);

// ── Animation loop ────────────────────────────────────────────────────────────
let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.016;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = -window._att.yaw   * DEG;
  camera.rotation.x = -window._att.pitch * DEG;
  camera.rotation.z =  window._att.roll  * DEG;

  // Freeze: detach sceneGroup from camera → world space, preserving world matrix.
  // Must call camera.updateMatrixWorld(true) FIRST — Three.js only computes
  // matrixWorld during renderer.render(), so on early frames it is stale/identity.
  // Also wait _freezeCountdown frames so live gyro injectJavaScript has fired.
  if (!_frozen) {
    if (_freezeCountdown > 0) {
      _freezeCountdown--;
    } else {
      _frozen = true;
      camera.updateMatrixWorld(true); // ← force camera matrix from current rotation
      const _wp = new THREE.Vector3();
      const _wq = new THREE.Quaternion();
      const _ws = new THREE.Vector3();
      sceneGroup.matrixWorld.decompose(_wp, _wq, _ws);
      camera.remove(sceneGroup);
      scene.add(sceneGroup);
      sceneGroup.position.set(_wp.x, 0, _wp.z); // keep XZ placement, reset Y to eye level
      // Only preserve yaw (Y rotation) — strip pitch & roll so table stays level/upright
      const _euler = new THREE.Euler().setFromQuaternion(_wq, 'YXZ');
      _euler.x = 0;
      _euler.z = 0;
      sceneGroup.quaternion.setFromEuler(_euler);
      sceneGroup.scale.copy(_ws);
    }
  }

  // Float selected pieces (local Z → world Y via boardGroup rotation)
  for (const [k, mesh] of Object.entries(pieceMeshes)) {
    if (window._pieces.some && window._pieces.some(p => p.key===k && p.isSelected)) {
      mesh.position.z += Math.sin(t * 3.5) * 0.0005;
    }
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
});
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AR3DOverlay({
  visible = true,
  pieces = [],
  moves  = [],
  fov = 75,
  boardGlbPath,
  piecesGlbPath,
  tableGlbPath,
}: AR3DOverlayProps) {
  const attitude = useSharedAttitude();
  const webViewRef = useRef<WebView>(null);
  const renderKey = useRef(0); // Force re-render on demand
  
  // Increment key when visible changes from false to true (new AR session)
  useEffect(() => {
    if (visible) {
      renderKey.current += 1;
    }
  }, [visible]);

  // Always tracks the latest yaw between renders
  const latestYawRef = useRef(attitude.yaw);
  latestYawRef.current = attitude.yaw;

  // spawnYaw: set the moment AR turns on, baked into the HTML, reset on hide
  const [spawnYaw, setSpawnYaw] = useState<number | null>(null);
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSpawnYaw(latestYawRef.current);
    }
    if (!visible) {
      setSpawnYaw(null); // reset so next enable recaptures fresh direction
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const [boardUri,  setBoardUri]  = useState<string | null | undefined>(boardGlbPath  ? undefined : null);
  const [piecesUri, setPiecesUri] = useState<string | null | undefined>(piecesGlbPath ? undefined : null);
  const [tableUri,  setTableUri]  = useState<string | null | undefined>(tableGlbPath  ? undefined : null);

  useEffect(() => {
    if (!boardGlbPath) { setBoardUri(null); return; }
    let cancelled = false;
    resolveAssetUri(boardGlbPath).then(u => { if (!cancelled) setBoardUri(u); });
    return () => { cancelled = true; };
  }, [boardGlbPath]);

  useEffect(() => {
    if (!piecesGlbPath) { setPiecesUri(null); return; }
    let cancelled = false;
    resolveAssetUri(piecesGlbPath).then(u => { if (!cancelled) setPiecesUri(u); });
    return () => { cancelled = true; };
  }, [piecesGlbPath]);

  useEffect(() => {
    if (!tableGlbPath) { setTableUri(null); return; }
    let cancelled = false;
    resolveAssetUri(tableGlbPath).then(u => { if (!cancelled) setTableUri(u); });
    return () => { cancelled = true; };
  }, [tableGlbPath]);

  // Build HTML once all three URIs are resolved AND spawn yaw is captured
  const html = useMemo(() => {
    if (boardUri === undefined || piecesUri === undefined || tableUri === undefined) return null;
    if (spawnYaw === null) return null;
    return buildSceneHTML(fov, boardUri, piecesUri, tableUri, spawnYaw);
  }, [fov, boardUri, piecesUri, tableUri, spawnYaw]);

  // Push gyro attitude at ~60fps
  useEffect(() => {
    if (!visible || !html) return;
    webViewRef.current?.injectJavaScript(
      `window._att={yaw:${attitude.yaw.toFixed(4)},pitch:${attitude.pitch.toFixed(4)},roll:${attitude.roll.toFixed(4)}};true;`,
    );
  }, [attitude.yaw, attitude.pitch, attitude.roll, visible, html]);

  // Keep latest pieces/moves in a ref so onLoadEnd can access them without stale closure
  const latestPiecesRef = useRef(pieces);
  const latestMovesRef  = useRef(moves);
  latestPiecesRef.current = pieces;
  latestMovesRef.current  = moves;

  // Push board state on every piece/move change
  useEffect(() => {
    if (!visible || !html) return;
    const msg = JSON.stringify({type: 'scene', pieces, moves});
    webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
  }, [pieces, moves, visible, html]);

  // Re-send pieces once the WebView has finished loading (Three.js CDN async import).
  // The useEffect above may fire before handleRNMessage is registered, so this
  // guarantees pieces appear after the module script has run.
  const handleLoadEnd = useCallback(() => {
    const msg = JSON.stringify({type: 'scene', pieces: latestPiecesRef.current, moves: latestMovesRef.current});
    webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
  }, []);

  if (!visible || !html) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        key={`ar-overlay-${renderKey.current}`} // Force re-render when AR enables
        ref={webViewRef}
        source={{html}}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onLoadEnd={handleLoadEnd}
        onShouldStartLoadWithRequest={req =>
          req.url === 'about:blank' ||
          req.url.startsWith('http') ||
          req.url.startsWith('data:')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});
