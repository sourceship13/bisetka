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

import React, {useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef} from 'react';
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

export interface AR3DOverlayHandle {
  /** Re-centers the board in front of the player's current looking direction */
  recenter: () => void;
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
   * e.g. "glb/park/tableCoffeeGlassSquare.glb"
   * Table is placed at the centre of the 360° sphere; board sits on top of it.
   * Falls back to a simple procedural table if omitted or if load fails.
   */
  tableGlbPath?: string;
  /**
   * Called when the user taps a square on the 3D board.
   * Receives logical board coordinates (row 0–7, col 0–7) from Three.js raycasting.
   */
  onSquareTap?: (row: number, col: number) => void;
  /** CSS hex color for the 'red' player pieces. Default: '#c0392b' */
  pieceColorRed?: string;
  /** CSS hex color for the 'black' player pieces. Default: '#1e2d3d' */
  pieceColorBlack?: string;
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

      // In dev, always re-download so asset changes are picked up immediately.
      // Delete any stale cached copy first.
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath).catch(() => {});
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

// tableCoffeeGlassSquare.glb (9 KB) — Kenney furniture-kit, embedded as base64
// so it loads guaranteed on device without any Metro/bundle asset resolution.
const EMBEDDED_COFFEE_TABLE_URI = 'data:model/gltf-binary;base64,Z2xURgIAAADoJAAAPAcAAEpTT057ImV4dGVuc2lvbnNVc2VkIjpbIktIUl9tYXRlcmlhbHNfdW5saXQiXSwiYXNzZXQiOnsiZ2VuZXJhdG9yIjoiVW5pR0xURi0xLjI0IiwidmVyc2lvbiI6IjIuMCJ9LCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjo3NTY4fV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjIyMDgsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoyMjA4LCJieXRlTGVuZ3RoIjoyMjA4LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NDQxNiwiYnl0ZUxlbmd0aCI6MTQ3MiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU4ODgsImJ5dGVMZW5ndGgiOjE2MzIsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo3NTIwLCJieXRlTGVuZ3RoIjo0OCwidGFyZ2V0IjozNDk2M31dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImJ5dGVPZmZzZXQiOjAsInR5cGUiOiJWRUMzIiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE4NCwibWF4IjpbLTAuMDYwOTk2MDgsMC4yMywwLjFdLCJtaW4iOlstMC40NjA5OTYxLC0zLjYwOTU1N0UtMTYsLTAuM10sIm5vcm1hbGl6ZWQiOmZhbHNlfSx7ImJ1ZmZlclZpZXciOjEsImJ5dGVPZmZzZXQiOjAsInR5cGUiOiJWRUMzIiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE4NCwibm9ybWFsaXplZCI6ZmFsc2V9LHsiYnVmZmVyVmlldyI6MiwiYnl0ZU9mZnNldCI6MCwidHlwZSI6IlZFQzIiLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTg0LCJub3JtYWxpemVkIjpmYWxzZX0seyJidWZmZXJWaWV3IjozLCJieXRlT2Zmc2V0IjowLCJ0eXBlIjoiU0NBTEFSIiwiY29tcG9uZW50VHlwZSI6NTEyNSwiY291bnQiOjQwOCwibm9ybWFsaXplZCI6ZmFsc2V9LHsiYnVmZmVyVmlldyI6NCwiYnl0ZU9mZnNldCI6MCwidHlwZSI6IlNDQUxBUiIsImNvbXBvbmVudFR5cGUiOjUxMjUsImNvdW50IjoxMiwibm9ybWFsaXplZCI6ZmFsc2V9XSwibWF0ZXJpYWxzIjpbeyJuYW1lIjoibWV0YWwiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJiYXNlQ29sb3JGYWN0b3IiOlswLjc0MDYxMDU0LDAuODIyODY2NzM4LDAuODM5NjIyNiwxXSwibWV0YWxsaWNGYWN0b3IiOjAsInJvdWdobmVzc0ZhY3RvciI6MX0sImVtaXNzaXZlRmFjdG9yIjpbMCwwLDBdLCJkb3VibGVTaWRlZCI6ZmFsc2UsImFscGhhTW9kZSI6Ik9QQVFVRSJ9LHsibmFtZSI6ImdsYXNzIiwicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC42OTgwMzkyMzQsMC44Mjc0NTEsMC43Njg2Mjc0NjUsMC41XSwibWV0YWxsaWNGYWN0b3IiOjAsInJvdWdobmVzc0ZhY3RvciI6MX0sImVtaXNzaXZlRmFjdG9yIjpbMCwwLDBdLCJkb3VibGVTaWRlZCI6ZmFsc2UsImFscGhhTW9kZSI6IkJMRU5EIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJNZXNoIHRhYmxlQ29mZmVlR2xhc3NTcXVhcmUiLCJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJpbmRpY2VzIjozLCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJtYXRlcmlhbCI6MH0seyJtb2RlIjo0LCJpbmRpY2VzIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJtYXRlcmlhbCI6MX1dfV0sIm5vZGVzIjpbeyJuYW1lIjoidGFibGVDb2ZmZWVHbGFzc1NxdWFyZShDbG9uZSkiLCJ0cmFuc2xhdGlvbiI6WzAsMCwwXSwicm90YXRpb24iOlsw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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAACAvwAAAIAAAAAA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ggAAAIQAAACDAAAAdAAAAIMAAACEAAAAhQAAAIgAAACHAAAAhgAAAIcAAACIAAAAiQAAAIsAAACKAAAAhgAAAIoAAACLAAAAjAAAAIcAAACOAAAAjQAAAI4AAACHAAAAjwAAAJEAAACIAAAAkAAAAIgAAACRAAAAkgAAAJMAAACQAAAAigAAAJAAAACTAAAAlAAAAJYAAACVAAAAiQAAAJUAAACWAAAAlwAAAJoAAACZAAAAmAAAAJkAAACaAAAAmwAAAJ4AAACdAAAAnAAAAJ0AAACeAAAAnwAAAJ0AAAChAAAAoAAAAKEAAACdAAAAogAAAKQAAACjAAAAnAAAAKMAAACkAAAApQAAAKYAAACkAAAAoAAAAKQAAACmAAAApwAAAKoAAACpAAAAqAAAAKkAAACqAAAAqwAAAKsAAACqAAAArAAAAKsAAACsAAAArQAAAKwAAACqAAAArgAAAK4AAACqAAAArwAAALAAAACtAAAArAAAALEAAACtAAAAsAAAALEAAACwAAAArwAAALEAAACvAAAAqgAAALIAAACtAAAAsQAAAK0AAACyAAAAswAAADgAAAA6AAAANQAAADoAAAA4AAAAOQAAALYAAAC1AAAAtAAAALcAAAC0AAAAtQAAAA==';

function buildSceneHTML(
  fov: number,
  boardUri:        string | null,
  piecesUri:       string | null,
  tableUri:        string | null,
  spawnYaw:        number,
  pieceColorRed:   number,
  pieceColorBlack: number,
): string {
  const BOARD_URI_JS  = boardUri  ? JSON.stringify(boardUri)  : 'null';
  const PIECES_URI_JS = piecesUri ? JSON.stringify(piecesUri) : 'null';
  // Always use the embedded coffee table — falls back from external if provided
  const TABLE_URI_JS  = JSON.stringify(tableUri ?? EMBEDDED_COFFEE_TABLE_URI);
  const RED_HEX   = `0x${pieceColorRed.toString(16).padStart(6, '0')}`;
  const BLACK_HEX = `0x${pieceColorBlack.toString(16).padStart(6, '0')}`;

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
const BOARD_THICKNESS = 0.045; // slab depth — pieces must sit above BOARD_THICKNESS/2
const BOARD_HALF   = 0.35;  // 70 cm half-width (fits on 1.8m table)
const BOARD_HALF_W = BOARD_HALF;
const BOARD_HALF_H = BOARD_HALF;
const SQUARE_W     = (BOARD_HALF_W * 2) / 8;
const SQUARE_H     = SQUARE_W;
const PIECE_SCALE  = SQUARE_W * 0.80;
const BOARD_Y    = -0.65;  // chest level (approx 65cm below eye level)

// ── Dynamic TABLE_DIST: closest distance where board corners fit in view ──────
// hFov derived from vFov + aspect ratio so it adapts to every screen/orientation.
// MARGIN 0.75 keeps the board close; raw result is clamped [0.70, 1.10] so it
// never clips on ultra-wide landscape and never floats away on narrow portrait.
const _halfVFovRad = (${fov} / 2) * (Math.PI / 180);
const _aspect      = W / H;
const _halfHFovRad = Math.atan(Math.tan(_halfVFovRad) * _aspect);
const _rawDist     = (BOARD_HALF * 0.75 / Math.tan(_halfHFovRad)) + BOARD_HALF;
const TABLE_DIST   = Math.min(Math.max(_rawDist, 0.70), 1.10);

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

// ── Invisible hit plane for raycasting — covers the board surface exactly ────
const raycaster = new THREE.Raycaster();
const hitPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_HALF_W * 2, BOARD_HALF_H * 2),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
boardGroup.add(hitPlane);

function handleTap(clientX, clientY) {
  const nx =  (clientX / window.innerWidth)  * 2 - 1;
  const ny = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const hits = raycaster.intersectObject(hitPlane, false);
  if (!hits.length) return;
  // Convert world hit point → boardGroup local space
  boardGroup.updateWorldMatrix(true, false);
  const lp = boardGroup.worldToLocal(hits[0].point.clone());
  const col = Math.floor((lp.x + BOARD_HALF_W) / SQUARE_W);
  const row = Math.floor((BOARD_HALF_H - lp.y) / SQUARE_H);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap', row, col }));
    }
  }
}
document.addEventListener('touchend', (e) => {
  if (e.changedTouches.length > 0) {
    handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
}, { passive: true });

// ── Procedural fallback board ─────────────────────────────────────────────────
function buildProceduralBoard() {
  const THICKNESS = BOARD_THICKNESS; // board depth — gives it a solid slab look
  // Solid slab body
  boardGroup.add(new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_HALF_W*2+0.04, BOARD_HALF_H*2+0.04, THICKNESS),
    new THREE.MeshStandardMaterial({ color:0x3b2206, roughness:0.75, metalness:0.06 })
  ));
  const lMat = new THREE.MeshStandardMaterial({ color:0xe8d5b5, roughness:0.5,  metalness:0.04 });
  const dMat = new THREE.MeshStandardMaterial({ color:0x7a4a22, roughness:0.65, metalness:0.06 });
  const sqGeo = new THREE.PlaneGeometry(SQUARE_W*0.97, SQUARE_H*0.97);
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const sq = new THREE.Mesh(sqGeo, (r+c)%2===0 ? lMat : dMat);
    sq.position.set(-BOARD_HALF_W+(c+0.5)*SQUARE_W, BOARD_HALF_H-(r+0.5)*SQUARE_H, THICKNESS/2+0.001);
    boardGroup.add(sq);
  }
  const rimLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_HALF_W*2+0.03, BOARD_HALF_H*2+0.03, THICKNESS+0.002)),
    new THREE.LineBasicMaterial({ color:0xd4af37 })
  );
  rimLine.position.z = 0.001;
  boardGroup.add(rimLine);
}

// ── Load GLB assets ─────────────────────────────────────────────────────────────────
const BOARD_URI  = ${BOARD_URI_JS};
const PIECES_URI = ${PIECES_URI_JS};
const loader     = new GLTFLoader();


function _rnLog(msg) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', msg }));
  }
}


// ── Load BOARD
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
  const clr = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
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
    // Flush pending update — fall back to window._pieces if no explicit queue
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
  }, undefined, () => {
    // Pieces GLB failed — clonePiece() will use fallback geometry
    console.warn('[AR3DOverlay] pieces GLB load failed, using procedural discs');
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
  });
}

function clonePiece(color, isKing) {
  if (!basePieceScene) return makeFallbackPiece(color, isKing);

  const pieceColor = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
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
     BOARD_THICKNESS / 2 + 0.010,  // above the top face of the slab
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
  if (data.type === 'recenter') {
    // Re-attach sceneGroup to camera so it tracks the player again,
    // then let the freeze countdown re-fire to lock it in the new direction.
    if (_frozen) {
      // Preserve world matrix when re-parenting back to camera
      camera.updateMatrixWorld(true);
      sceneGroup.updateMatrixWorld(true);
      const _wp = new THREE.Vector3();
      const _wq = new THREE.Quaternion();
      const _ws = new THREE.Vector3();
      sceneGroup.matrixWorld.decompose(_wp, _wq, _ws);
      scene.remove(sceneGroup);
      camera.add(sceneGroup);
      // Reset sceneGroup to its original camera-local position (centered ahead)
      sceneGroup.position.set(0, 0, 0);
      sceneGroup.rotation.set(0, 0, 0);
      sceneGroup.scale.set(1, 1, 1);
      _frozen = false;
      _freezeCountdown = 8;
    }
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

const AR3DOverlay = forwardRef<AR3DOverlayHandle, AR3DOverlayProps>(function AR3DOverlay({
  visible = true,
  pieces = [],
  moves  = [],
  fov = 75,
  boardGlbPath,
  piecesGlbPath,
  tableGlbPath,
  onSquareTap,
  pieceColorRed   = '#c0392b',
  pieceColorBlack = '#1e2d3d',
}: AR3DOverlayProps, ref: React.Ref<AR3DOverlayHandle>) {
  const attitude = useSharedAttitude();
  const webViewRef = useRef<WebView>(null);
  const renderKey = useRef(0); // Force re-render on demand

  useImperativeHandle(ref, () => ({
    recenter() {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'recenter'});true;`
      );
    },
  }));
  
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

  // Build HTML once board + pieces URIs are resolved AND spawn yaw is captured.
  // Table is always embedded so we don't block on tableUri.
  const html = useMemo(() => {
    if (boardUri === undefined || piecesUri === undefined) return null;
    if (spawnYaw === null) return null;
    const redInt   = parseInt(pieceColorRed.replace(/^#/, ''), 16);
    const blackInt  = parseInt(pieceColorBlack.replace(/^#/, ''), 16);
    return buildSceneHTML(fov, boardUri, piecesUri, tableUri ?? null, spawnYaw, redInt, blackInt);
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
  // Retry every 500ms for up to 5s in case the pieces GLB CDN import is still loading.
  const handleLoadEnd = useCallback(() => {
    const sendPieces = () => {
      const msg = JSON.stringify({type: 'scene', pieces: latestPiecesRef.current, moves: latestMovesRef.current});
      webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
    };
    sendPieces();
    const retryDelays = [500, 1000, 1500, 2500, 4000];
    retryDelays.forEach(delay => setTimeout(sendPieces, delay));
  }, []);

  // Handle messages posted from Three.js (raycasted board taps)
  const handleMessage = useCallback((event: {nativeEvent: {data: string}}) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'tap' && onSquareTap) {
        onSquareTap(data.row, data.col);
      } else if (data.type === 'log') {
        console.log(data.msg);
      }
    } catch (_) {}
  }, [onSquareTap]);

  if (!visible || !html) return null;

  return (
    // box-none: wrapper does not capture touches but WebView child does
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={req =>
          req.url === 'about:blank' ||
          req.url.startsWith('http') ||
          req.url.startsWith('data:')
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});

export default AR3DOverlay;
