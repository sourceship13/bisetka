/**
 * PoolTable3D — Renders pool_table_top_view.glb top-down inside a transparent
 * WebView. Used as the background layer for the Billiards game.
 */

import React, { useEffect, useState } from 'react';
import { View, Platform, Image } from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';

const POOL_TABLE_GLB = require('../../assets/pool/pool_table_top_view.glb');

async function resolvePoolTableGlb(): Promise<string | null> {
  try {
    if (__DEV__) {
      const resolved = Image.resolveAssetSource(POOL_TABLE_GLB);
      const metroUrl = resolved?.uri ?? null;
      if (!metroUrl) return null;
      const safeFileName = 'pool_pool_table_top_view.glb';
      const tempPath = `${RNFS.TemporaryDirectoryPath}pooltable_${safeFileName}`;
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

    const safeFileName = 'pool_pool_table_top_view.glb';
    const cacheDir = `${RNFS.CachesDirectoryPath}/glb_cache`;
    const cachedPath = `${cacheDir}/${safeFileName}`;
    if (!(await RNFS.exists(cacheDir))) await RNFS.mkdir(cacheDir);
    if (!(await RNFS.exists(cachedPath))) {
      if (Platform.OS === 'ios') {
        await RNFS.copyFile(
          `${RNFS.MainBundlePath}/assets/pool/pool_table_top_view.glb`,
          cachedPath,
        );
      } else {
        await RNFS.copyFileAssets(
          'assets/pool/pool_table_top_view.glb',
          cachedPath,
        );
      }
    }
    return `file://${cachedPath}`;
  } catch (_) {
    return null;
  }
}

function buildHTML(glbUri: string): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
<style>
  html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden;}
  canvas{display:block;background:transparent;width:100%!important;height:100%!important;}
</style>
</head><body>
<script src="https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.155.0/examples/js/loaders/GLTFLoader.js"></script>
<script>
(function(){
  var W = window.innerWidth;
  var H = window.innerHeight;
  var scene = new THREE.Scene();
  scene.background = null;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  var key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(0, 10, 5);
  scene.add(key);

  // Camera looks straight down the +Y axis at the origin.
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  camera.up.set(0, 0, -1);

  var loader = new THREE.GLTFLoader();
  loader.load('${glbUri}', function(gltf){
    var model = gltf.scene;
    scene.add(model);

    // Center model at origin
    var box = new THREE.Box3().setFromObject(model);
    var center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    box.setFromObject(model);
    var size = box.getSize(new THREE.Vector3());

    // Looking down +Y, the table footprint is XZ.
    var modelW = size.x;
    var modelH = size.z;

    // Match canvas aspect: long side -> screen long side.
    if ((modelW > modelH) !== (W > H)) {
      model.rotation.y = Math.PI / 2;
      box.setFromObject(model);
      center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      size = box.getSize(new THREE.Vector3());
      modelW = size.x;
      modelH = size.z;
    }

    var aspect = W / H;
    var modelAspect = modelW / modelH;
    var halfW, halfH;
    if (modelAspect > aspect) {
      halfW = modelW / 2;
      halfH = halfW / aspect;
    } else {
      halfH = modelH / 2;
      halfW = halfH * aspect;
    }
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 0.01;
    camera.far = 100 + size.y * 10;
    camera.position.set(0, size.y * 4 + 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  }, undefined, function(err){
    document.body.innerHTML = '<div style="color:#fff;font:12px sans-serif;padding:8px">Pool table model failed to load</div>';
  });
})();
</script>
</body></html>`;
}

interface Props {
  width: number;
  height: number;
}

const PoolTable3D: React.FC<Props> = ({ width, height }) => {
  const [glbUri, setGlbUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    resolvePoolTableGlb().then((uri) => { if (mounted) setGlbUri(uri); });
    return () => { mounted = false; };
  }, []);

  if (!glbUri) {
    return <View style={{ width, height, backgroundColor: '#0a3d1f' }} />;
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: buildHTML(glbUri) }}
      style={{ width, height, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      bounces={false}
      pointerEvents="none"
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      mixedContentMode="always"
      androidHardwareAccelerationDisabled={false}
      androidLayerType="hardware"
    />
  );
};

export default PoolTable3D;
