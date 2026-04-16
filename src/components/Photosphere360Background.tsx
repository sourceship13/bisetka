/**
 * Photosphere360Background — full-screen 360° equirectangular background.
 *
 * Renders a WebGL sphere viewer behind game UI with:
 * - Touch passthrough (pointerEvents="none") so game controls work on top
 * - Optional slow auto-rotation for ambient effect
 * - Supports image URL or local file path (via native readFileBase64)
 */
import React, {useCallback, useRef, useState} from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {WebView} from 'react-native-webview';
import type {WebViewMessageEvent} from 'react-native-webview';

const VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport"
  content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;overflow:hidden}
  body,html{width:100%;height:100%;background:#000}
  canvas{display:block;width:100vw;height:100vh;touch-action:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var canvas=document.getElementById('c');
  var gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
  var yaw=0,pitch=0,fov=90;
  var autoRotate=true,autoSpeed=0.02;
  var tex=null,prog=null,texReady=false;

  function log(m){
    if(window.ReactNativeWebView)
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'log',msg:''+m}));
  }

  var VS='attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}';

  var FS=[
    'precision mediump float;',
    'varying vec2 v;',
    'uniform sampler2D t;',
    'uniform float uYaw,uPitch,uFov,uAsp;',
    '#define PI 3.14159265',
    'void main(){',
    '  float hf=uFov*.5;',
    '  float x=(v.x-.5)*2.*tan(hf)*uAsp;',
    '  float y=(v.y-.5)*2.*tan(hf);',
    '  vec3 r=normalize(vec3(x,y,-1.));',
    '  float cp=cos(uPitch),sp=sin(uPitch);',
    '  r=vec3(r.x,cp*r.y-sp*r.z,sp*r.y+cp*r.z);',
    '  float cy=cos(uYaw),sy=sin(uYaw);',
    '  r=vec3(cy*r.x+sy*r.z,r.y,-sy*r.x+cy*r.z);',
    '  float lon=atan(r.x,-r.z);',
    '  float lat=asin(clamp(r.y,-1.,1.));',
    '  vec2 uv=vec2(-lon/(2.*PI)+.5,-lat/PI+.5);',
    '  gl_FragColor=texture2D(t,uv);',
    '}'
  ].join('\\n');

  function sh(type,src){
    var s=gl.createShader(type);
    gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      log('shader err: '+gl.getShaderInfoLog(s));return null;}
    return s;
  }

  function initGL(){
    var dpr=window.devicePixelRatio||1;
    canvas.width=window.innerWidth*dpr;
    canvas.height=window.innerHeight*dpr;
    gl.viewport(0,0,canvas.width,canvas.height);
    var vs=sh(gl.VERTEX_SHADER,VS);
    var fs=sh(gl.FRAGMENT_SHADER,FS);
    if(!vs||!fs){log('shader compile failed');return;}
    prog=gl.createProgram();
    gl.attachShader(prog,vs);gl.attachShader(prog,fs);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){
      log('link err: '+gl.getProgramInfoLog(prog));return;}
    var buf=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    var a=gl.getAttribLocation(prog,'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    gl.useProgram(prog);
    tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    render();
  }

  function loadImg(src){
    var img=new Image();
    img.crossOrigin='anonymous';
    img.onload=function(){
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      texReady=true;
      log('tex loaded '+img.width+'x'+img.height);
    };
    img.onerror=function(){
      log('img load error for: '+src.substring(0,80));
    };
    img.src=src;
  }

  function render(){
    requestAnimationFrame(render);
    if(!prog||!texReady)return;
    if(autoRotate) yaw+=autoSpeed;
    gl.useProgram(prog);
    var asp=canvas.width/canvas.height;
    gl.uniform1f(gl.getUniformLocation(prog,'uYaw'),yaw*Math.PI/180);
    gl.uniform1f(gl.getUniformLocation(prog,'uPitch'),pitch*Math.PI/180);
    gl.uniform1f(gl.getUniformLocation(prog,'uFov'),fov*Math.PI/180);
    gl.uniform1f(gl.getUniformLocation(prog,'uAsp'),asp);
    gl.uniform1i(gl.getUniformLocation(prog,'t'),0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  window._loadBase64=function(b64){loadImg('data:image/jpeg;base64,'+b64);};
  window._loadURL=function(url){loadImg(url);};
  window._setAutoRotate=function(on,speed){autoRotate=on;if(speed!==undefined)autoSpeed=speed;};
  window._setView=function(y,p,f){yaw=y;pitch=p;if(f)fov=f;};

  function handleMsg(e){
    try{
      var d=JSON.parse(e.data);
      if(d.type==='loadURL') loadImg(d.url);
      else if(d.type==='loadBase64') loadImg('data:image/jpeg;base64,'+d.data);
    }catch(ex){log('msg err: '+ex.message);}
  }

  document.addEventListener('message',handleMsg);
  window.addEventListener('message',handleMsg);

  initGL();
})();
</script>
</body>
</html>`;

type Props = {
  /** URL to an equirectangular panorama image */
  imageUrl?: string;
  /** Local file path to an equirectangular JPEG (uses native readFileBase64) */
  imagePath?: string;
  /** A require()'d image asset to use as the panorama */
  assetSource?: number;
  /** Auto-rotate speed in degrees per frame (default 0.02) */
  autoRotateSpeed?: number;
  /** Initial yaw in degrees */
  initialYaw?: number;
  /** Initial pitch in degrees */
  initialPitch?: number;
  /** Field of view in degrees (default 90) */
  fov?: number;
  /** Opacity of a dark overlay on top of the panorama (0-1, default 0.3) */
  overlayOpacity?: number;
};

export default function Photosphere360Background({
  imageUrl,
  imagePath,
  assetSource,
  autoRotateSpeed = 0.02,
  initialYaw = 0,
  initialPitch = 0,
  fov = 90,
  overlayOpacity = 0.3,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const sentRef = useRef(false);

  const onWebViewLoad = useCallback(async () => {
    if (sentRef.current) return;
    sentRef.current = true;

    const web = webRef.current;
    if (!web) return;

    // Set initial view and auto-rotate speed
    web.injectJavaScript(`
      window._setView(${initialYaw}, ${initialPitch}, ${fov});
      window._setAutoRotate(true, ${autoRotateSpeed});
      true;
    `);

    if (imageUrl) {
      web.injectJavaScript(`window._loadURL(${JSON.stringify(imageUrl)});true;`);
      setLoaded(true);
    } else if (imagePath) {
      try {
        const {readFileBase64} = require('@sourceship/capture360');
        const base64 = await readFileBase64(imagePath);
        web.injectJavaScript(`window._loadBase64(${JSON.stringify(base64)});true;`);
        setLoaded(true);
      } catch (e: any) {
        console.warn('[Photosphere360Background] Failed to read file:', e.message);
      }
    } else if (assetSource) {
      try {
        const resolved = Image.resolveAssetSource(assetSource);
        const response = await fetch(resolved.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          web.injectJavaScript(`window._loadURL(${JSON.stringify(dataUrl)});true;`);
          setLoaded(true);
        };
        reader.readAsDataURL(blob);
      } catch (e: any) {
        console.warn('[Photosphere360Background] Failed to load asset:', e.message);
      }
    }
  }, [imageUrl, imagePath, autoRotateSpeed, initialYaw, initialPitch, fov]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'log') {
        console.log('[Photosphere360Background]', data.msg);
      }
    } catch {}
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{html: VIEWER_HTML}}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onLoad={onWebViewLoad}
        onMessage={onMessage}
      />
      {overlayOpacity > 0 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: `rgba(0,0,0,${overlayOpacity})`},
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {flex: 1, backgroundColor: '#000'},
});
