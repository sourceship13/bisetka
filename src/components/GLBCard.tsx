/**
 * GLBCard — A single playing card rendered using card-template.glb + Three.js.
 *
 * The GLB geometry is loaded once via Metro (dev) or RNFS bundle-copy (prod)
 * and displayed in a transparent WebView.  A canvas texture painted with the
 * suit symbol and rank is applied to the GLB mesh so the card looks
 * identical to the DynamicCard design but with real 3-D depth/lighting.
 *
 * Drop-in replacement for Card3D:
 *   <GLBCard suit="hearts" rank="A" faceDown={false} size={68} />
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { View, Platform, NativeModules, Image } from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export const CARD_RATIO = 89 / 63; // standard poker card height/width

interface GLBCardProps {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
  /** Card width in dp; height is auto-calculated (63:89 ratio) */
  size?: number;
}

// Registered Metro asset ref for the card GLB
const CARD_GLB_REF = require('../../assets/glb/cards/card-template.glb');

// ─── Resolve the GLB to a file:// URI that the WebView can load ───────────────
async function resolveCardGlb(): Promise<string | null> {
  try {
    if (__DEV__) {
      const resolved = Image.resolveAssetSource(CARD_GLB_REF);
      const metroUrl = resolved?.uri ?? null;
      if (!metroUrl) return null;

      const safeFileName = 'glb_cards_card-template.glb';
      const tempPath = `${RNFS.TemporaryDirectoryPath}glbcard_${safeFileName}`;

      if (await RNFS.exists(tempPath)) return `file://${tempPath}`;

      try {
        const dl = RNFS.downloadFile({ fromUrl: metroUrl, toFile: tempPath });
        const res = await dl.promise;
        const ok =
          res.statusCode === 200 ||
          (res.statusCode === 0 && res.bytesWritten > 100);
        if (ok) return `file://${tempPath}`;
      } catch (_) {}

      return null;
    }

    // Production: copy from bundle once then reuse cached file://
    const safeFileName = 'glb_cards_card-template.glb';
    const cacheDir = `${RNFS.CachesDirectoryPath}/glb_cache`;
    const cachedPath = `${cacheDir}/${safeFileName}`;

    if (!(await RNFS.exists(cacheDir))) {
      await RNFS.mkdir(cacheDir);
    }

    if (!(await RNFS.exists(cachedPath))) {
      if (Platform.OS === 'ios') {
        await RNFS.copyFile(
          `${RNFS.MainBundlePath}/assets/glb/cards/card-template.glb`,
          cachedPath,
        );
      } else {
        await RNFS.copyFileAssets(
          'assets/glb/cards/card-template.glb',
          cachedPath,
        );
      }
    }

    return `file://${cachedPath}`;
  } catch (e) {
    return null;
  }
}

// ─── Build the WebView HTML ───────────────────────────────────────────────────
function buildCardHTML(
  suit: Suit,
  rank: Rank,
  faceDown: boolean,
  cardGlbUri: string,
): string {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitColor = isRed ? '#cc0000' : '#111111';
  const suitSymbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  const sym = suitSymbols[suit];
  const SUIT_JSON = JSON.stringify(suit);
  const RANK_JSON = JSON.stringify(rank);
  const SYM_JSON = JSON.stringify(sym);
  const COLOR_JSON = JSON.stringify(suitColor);
  const FACE_DOWN = faceDown ? 'true' : 'false';
  const GLB_URI_JSON = JSON.stringify(cardGlbUri);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;background:transparent;overflow:hidden;}
  canvas{display:block;}
</style>
</head>
<body>
<script type="module">
import * as THREE from 'https://esm.sh/three@0.166.1';
import { GLTFLoader } from 'https://esm.sh/three@0.166.1/examples/jsm/loaders/GLTFLoader';

const W = window.innerWidth, H = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 2, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
camera.position.set(0, 0, 3);
camera.lookAt(0, 0, 0);

// Lighting — bright diffuse so card face is fully lit
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const key = new THREE.DirectionalLight(0xffffff, 0.95);
key.position.set(0.5, 1.5, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-1, -0.5, 1);
scene.add(fill);

// ── Canvas texture: draw card face ──────────────────────────────────────────
const CW = 256, CH = Math.round(256 * 89 / 63); // ~362 px
const canvas = document.createElement('canvas');
canvas.width = CW; canvas.height = CH;
const ctx = canvas.getContext('2d');

const suit = ${SUIT_JSON};
const rank = ${RANK_JSON};
const sym  = ${SYM_JSON};
const col  = ${COLOR_JSON};
const faceDown = ${FACE_DOWN};

function drawCardFace() {
  // White background with rounded-ish corners (no clip needed — plane is rect)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CW, CH);
  // Subtle border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, CW - 4, CH - 4);

  // Top-left rank + suit
  ctx.fillStyle = col;
  ctx.font = 'bold ' + Math.round(CW * 0.16) + 'px Arial,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(rank, 10, Math.round(CW * 0.18));
  ctx.font = Math.round(CW * 0.12) + 'px Arial,sans-serif';
  ctx.fillText(sym,  10, Math.round(CW * 0.30));

  // Bottom-right (upside down)
  ctx.save();
  ctx.translate(CW, CH);
  ctx.rotate(Math.PI);
  ctx.fillStyle = col;
  ctx.font = 'bold ' + Math.round(CW * 0.16) + 'px Arial,sans-serif';
  ctx.fillText(rank, 10, Math.round(CW * 0.18));
  ctx.font = Math.round(CW * 0.12) + 'px Arial,sans-serif';
  ctx.fillText(sym,  10, Math.round(CW * 0.30));
  ctx.restore();

  // Center suit symbol — big
  ctx.fillStyle = col;
  ctx.font = 'bold ' + Math.round(CW * 0.50) + 'px Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sym, CW / 2, CH / 2);
}

function drawCardBack() {
  ctx.fillStyle = '#1a3a6e';
  ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = '#c8a84b';
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, CW - 12, CH - 12);
  // Diagonal cross-hatch
  ctx.strokeStyle = 'rgba(200,168,75,0.3)';
  ctx.lineWidth = 1.5;
  for (let i = -CH; i < CW + CH; i += 18) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CH, CH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - CH, CH); ctx.stroke();
  }
}

if (faceDown) {
  drawCardBack();
} else {
  drawCardFace();
}

const tex = new THREE.CanvasTexture(canvas);
tex.needsUpdate = true;

// ── Load card-template.glb ─────────────────────────────────────────────────
const loader = new GLTFLoader();
const CARD_URI = ${GLB_URI_JSON};

function makeProceduralCard() {
  // Fallback: a simple plane with canvas texture — still looks clean
  const geo = new THREE.PlaneGeometry(1, 89/63);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
}

loader.load(CARD_URI, (gltf) => {
  const model = gltf.scene;

  // Figure out the thin axis so we can orient the card face-up (Z toward camera)
  const preBox  = new THREE.Box3().setFromObject(model);
  const preSize = preBox.getSize(new THREE.Vector3());
  const thinAxis = (preSize.x <= preSize.y && preSize.x <= preSize.z)
    ? 'x'
    : (preSize.y <= preSize.x && preSize.y <= preSize.z ? 'y' : 'z');
  if (thinAxis === 'x')      model.rotation.y = Math.PI / 2;
  else if (thinAxis === 'y') model.rotation.x = -Math.PI / 2;
  model.updateMatrixWorld(true);

  // Scale to fit [−0.5,0.5] orthographic view
  const box   = new THREE.Box3().setFromObject(model);
  const size  = box.getSize(new THREE.Vector3());
  // Fit largest face dimension to 0.88 of the orthographic width
  const maxDim = Math.max(size.x, size.y, 0.001);
  const scale  = 0.88 / maxDim;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(model);
  const ctr  = box2.getCenter(new THREE.Vector3());
  model.position.set(-ctr.x, -ctr.y, -ctr.z);

  // Apply canvas texture to all meshes
  model.traverse((child) => {
    if (!child.isMesh) return;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      side: THREE.DoubleSide,
      roughness: 0.20,
      metalness: 0.06,
    });
    child.material = mat;
  });

  scene.add(model);
}, undefined, () => {
  makeProceduralCard();
});

// ── Render loop (single frame after load, then idle) ─────────────────────────
let _rendered = false;
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  if (!_rendered) {
    _rendered = true;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  }
}
animate();
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const GLBCard: React.FC<GLBCardProps> = ({
  suit,
  rank,
  faceDown = false,
  size = 68,
}) => {
  const height = Math.round(size * CARD_RATIO);
  const [glbUri, setGlbUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveCardGlb().then((uri) => {
      if (!cancelled) setGlbUri(uri ?? 'none');
    });
    return () => { cancelled = true; };
  }, []);

  const html = useMemo(() => {
    if (!glbUri || glbUri === 'none') return null;
    return buildCardHTML(suit, rank, faceDown, glbUri);
  }, [suit, rank, faceDown, glbUri]);

  if (!html) {
    // While GLB URI is resolving, show nothing (tiny flicker at most)
    return <View style={{ width: size, height }} />;
  }

  return (
    <View style={{ width: size, height, overflow: 'hidden' }}>
      <WebView
        style={{ width: size, height, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL="file://"
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        // Transparent background
        backgroundColor="transparent"
        // Suppress CSP violations from esm.sh
        onError={() => {}}
        onMessage={() => {}}
        pointerEvents="none"
      />
    </View>
  );
};

export default GLBCard;
