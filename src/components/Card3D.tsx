/**
 * Card3D — 3D playing card rendered with WebGL in a WebView.
 * Shape matches card-template.glb (63 × 89 × 0.8 mm standard poker card).
 * Face is drawn dynamically on a 2D canvas atlas and applied as a texture.
 * Supports face-up / face-down with an animated Y-axis flip.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card3DProps {
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
  /** Card width in dp; height is auto-calculated to maintain 63:89 poker card aspect ratio */
  size?: number;
  onFlipComplete?: () => void;
}

/** height / width ratio for a standard poker card */
export const CARD_RATIO = 89 / 63;

// ─── HTML builder ────────────────────────────────────────────────────────────

const buildHTML = (suit: Suit, rank: Rank, startFaceDown: boolean): string => {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitColor = isRed ? '#d32f2f' : '#1a1a2e';
  const suitSymbols: Record<Suit, string> = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
  const sym = suitSymbols[suit];
  const initialRotY = startFaceDown ? 'Math.PI' : '0';

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style>
</head><body>
<canvas id="c"></canvas>
<script>
// ── Canvas setup ──
var canvas=document.getElementById('c');
var gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
var CW=256,CH=362; // matches 63:89 card aspect ratio (256*89/63 ≈ 362)
canvas.width=CW; canvas.height=CH;
gl.viewport(0,0,CW,CH);
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.clearColor(0,0,0,0);

// ── Draw atlas (512×362): left=face, right=back ──
var ac=document.createElement('canvas');
ac.width=512; ac.height=CH;
var ctx=ac.getContext('2d');

function drawFace(ctx,rank,suit,color,sym){
  // White background
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,256,CH);
  // Subtle inner border
  ctx.strokeStyle='#cccccc';
  ctx.lineWidth=2;
  ctx.strokeRect(4,4,248,CH-8);
  // Color + symbols
  ctx.fillStyle=color;
  // Top-left rank
  ctx.font='bold 40px Arial,sans-serif';
  ctx.fillText(rank,10,46);
  // Top-left suit symbol
  ctx.font='30px Arial,sans-serif';
  ctx.fillText(sym,13,78);
  // Centre large suit
  ctx.font='bold 120px Arial,sans-serif';
  var tw=ctx.measureText(sym).width;
  ctx.fillText(sym,(256-tw)/2,228);
  // Bottom-right (rotated 180°)
  ctx.save();
  ctx.translate(256,CH);
  ctx.rotate(Math.PI);
  ctx.fillStyle=color;
  ctx.font='bold 40px Arial,sans-serif';
  ctx.fillText(rank,10,46);
  ctx.font='30px Arial,sans-serif';
  ctx.fillText(sym,13,78);
  ctx.restore();
}

function drawBack(ctx,offX){
  // Dark blue gradient
  var g=ctx.createLinearGradient(offX,0,offX+256,CH);
  g.addColorStop(0,'#1a237e');
  g.addColorStop(1,'#0d47a1');
  ctx.fillStyle=g;
  ctx.fillRect(offX,0,256,CH);
  // Gold borders
  ctx.strokeStyle='#ffd700';
  ctx.lineWidth=3;
  ctx.strokeRect(offX+5,5,246,CH-10);
  ctx.strokeRect(offX+9,9,238,CH-18);
  // Diagonal hatch
  ctx.strokeStyle='rgba(255,215,0,0.18)';
  ctx.lineWidth=1;
  for(var i=-CH;i<256+CH;i+=16){
    ctx.beginPath(); ctx.moveTo(offX+i,0); ctx.lineTo(offX+i+CH,CH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(offX+i+CH,0); ctx.lineTo(offX+i,CH); ctx.stroke();
  }
  // Centre spade emblem
  ctx.fillStyle='rgba(255,215,0,0.9)';
  ctx.font='bold 80px Arial,sans-serif';
  var ew=ctx.measureText('\u2660').width;
  ctx.fillText('\u2660',offX+(256-ew)/2,215);
}

drawFace(ctx,'${rank}','${suit}','${suitColor}','${sym}');
drawBack(ctx,256);

// ── WebGL texture from atlas ──
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
var tex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,tex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ac);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);

// ── Shaders ──
// aF: face index — 0=front, 1=back, 2+=edge
var vsrc='attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;attribute float aF;'+
  'uniform mat4 uMVP;varying vec2 vU;varying float vF;'+
  'void main(){gl_Position=uMVP*vec4(aP,1.0);vU=aU;vF=aF;}';

var fsrc='precision mediump float;varying vec2 vU;varying float vF;uniform sampler2D uT;'+
  'void main(){'+
    'float fi=floor(vF+0.5);'+
    'vec4 col;'+
    'if(fi<0.5){col=texture2D(uT,vec2(vU.x*0.5,vU.y));}'+         // front: left half
    'else if(fi<1.5){col=texture2D(uT,vec2(0.5+vU.x*0.5,vU.y));}'+// back:  right half
    'else{col=vec4(0.97,0.95,0.90,1.0);}'+                          // edges: cream
    'gl_FragColor=col;'+
  '}';

function compile(src,type){
  var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;
}
var prog=gl.createProgram();
gl.attachShader(prog,compile(vsrc,gl.VERTEX_SHADER));
gl.attachShader(prog,compile(fsrc,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);gl.useProgram(prog);

// ── Card geometry (matches card-template.glb: 63×89×0.8 mm) ──
// Half-dimensions: W=0.315, H=0.445, D=0.012
var HW=0.315,HH=0.445,HD=0.012;
var pos=[],nor=[],uvs=[],fid=[],idx=[];
var vb=0;

// Add a quad face: 4 vertices → 2 triangles
// Winding: CCW from the direction of the normal
function addFace(v,n,u,fi){
  for(var i=0;i<4;i++){
    pos.push(v[i][0],v[i][1],v[i][2]);
    nor.push(n[0],n[1],n[2]);
    uvs.push(u[i][0],u[i][1]);
    fid.push(fi);
  }
  // Indices: v0,v1,v3 + v0,v3,v2
  idx.push(vb,vb+1,vb+3,vb,vb+3,vb+2);
  vb+=4;
}

// Vertex order for each face: BL(-,-), BR(+,-), TL(-,+), TR(+,+)
// UV: BL(0,0), BR(1,0), TL(0,1), TR(1,1)
// With UNPACK_FLIP_Y=true: V=0→canvas bottom, V=1→canvas top
// So UV(0,1) at card-top vertex → canvas top (rank display) ✓

// Front face (+Z)
addFace(
  [[-HW,-HH,HD],[HW,-HH,HD],[-HW,HH,HD],[HW,HH,HD]],
  [0,0,1],
  [[0,0],[1,0],[0,1],[1,1]],
  0
);
// Back face (-Z) — CCW from -Z direction = vertices reversed in X
addFace(
  [[HW,-HH,-HD],[-HW,-HH,-HD],[HW,HH,-HD],[-HW,HH,-HD]],
  [0,0,-1],
  [[0,0],[1,0],[0,1],[1,1]],
  1
);
// Top edge (+Y)
addFace(
  [[-HW,HH,HD],[HW,HH,HD],[-HW,HH,-HD],[HW,HH,-HD]],
  [0,1,0],
  [[0,0],[1,0],[0,1],[1,1]],
  2
);
// Bottom edge (-Y)
addFace(
  [[HW,-HH,HD],[-HW,-HH,HD],[HW,-HH,-HD],[-HW,-HH,-HD]],
  [0,-1,0],
  [[0,0],[1,0],[0,1],[1,1]],
  3
);
// Right edge (+X)
addFace(
  [[HW,-HH,-HD],[HW,-HH,HD],[HW,HH,-HD],[HW,HH,HD]],
  [1,0,0],
  [[0,0],[1,0],[0,1],[1,1]],
  4
);
// Left edge (-X)
addFace(
  [[-HW,-HH,HD],[-HW,-HH,-HD],[-HW,HH,HD],[-HW,HH,-HD]],
  [-1,0,0],
  [[0,0],[1,0],[0,1],[1,1]],
  5
);

function mkBuf(data,type){
  var b=gl.createBuffer();
  gl.bindBuffer(type||gl.ARRAY_BUFFER,b);
  gl.bufferData(type||gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  return b;
}
var pBuf=mkBuf(new Float32Array(pos));
var nBuf=mkBuf(new Float32Array(nor));
var uBuf=mkBuf(new Float32Array(uvs));
var fBuf=mkBuf(new Float32Array(fid));
var iBuf=mkBuf(new Uint16Array(idx),gl.ELEMENT_ARRAY_BUFFER);

var aP=gl.getAttribLocation(prog,'aP');
var aN=gl.getAttribLocation(prog,'aN');
var aU=gl.getAttribLocation(prog,'aU');
var aF=gl.getAttribLocation(prog,'aF');
var uMVP=gl.getUniformLocation(prog,'uMVP');
var uT=gl.getUniformLocation(prog,'uT');

// ── Matrix helpers ──
function perspective(fov,asp,near,far){
  var f=1/Math.tan(fov/2),nf=1/(near-far);
  return[f/asp,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];
}
function lookAt(eye,ctr,up){
  var zx=eye[0]-ctr[0],zy=eye[1]-ctr[1],zz=eye[2]-ctr[2];
  var zl=Math.sqrt(zx*zx+zy*zy+zz*zz);zx/=zl;zy/=zl;zz/=zl;
  var xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  var xl=Math.sqrt(xx*xx+xy*xy+xz*xz);xx/=xl;xy/=xl;xz/=xl;
  var yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return[xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1];
}
function mulM(a,b){
  var o=new Array(16);
  for(var i=0;i<4;i++)for(var j=0;j<4;j++){
    o[j*4+i]=0;for(var k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];
  }return o;
}
function rotY(a){var c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}

// Camera: at z=1.4 looking at origin; card fills ~87% of viewport
// (CW/CH aspect ≈ card W/H so card fills evenly on both axes)
var asp=CW/CH;
var proj=perspective(0.70,asp,0.1,50);
var view=lookAt([0,0,1.4],[0,0,0],[0,1,0]);
var vp=mulM(proj,view);

// ── Animation state ──
var curRotY=${initialRotY};
var targetRotY=${initialRotY};
var flipStartRot=${initialRotY};
var flipping=false;
var flipStart=0;
var FLIP_DUR=320; // ms

function easeInOut(t){return t<0.5?2*t*t:1-2*(1-t)*(1-t);}

// ── Render loop ──
function render(time){
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  if(flipping){
    var t=Math.min((time-flipStart)/FLIP_DUR,1);
    curRotY=flipStartRot+(targetRotY-flipStartRot)*easeInOut(t);
    if(t>=1){
      curRotY=targetRotY;
      flipping=false;
      if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage('flipComplete');
    }
  }

  var model=rotY(curRotY);
  var mvp=mulM(vp,model);

  gl.uniformMatrix4fv(uMVP,false,new Float32Array(mvp));
  gl.uniform1i(uT,0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,tex);

  gl.bindBuffer(gl.ARRAY_BUFFER,pBuf);gl.enableVertexAttribArray(aP);gl.vertexAttribPointer(aP,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,nBuf);gl.enableVertexAttribArray(aN);gl.vertexAttribPointer(aN,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,uBuf);gl.enableVertexAttribArray(aU);gl.vertexAttribPointer(aU,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,fBuf);gl.enableVertexAttribArray(aF);gl.vertexAttribPointer(aF,1,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,iBuf);

  gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ── Message handler ──
function updateTexture(rank,suit){
  var colors={hearts:'#d32f2f',diamonds:'#d32f2f',clubs:'#1a1a2e',spades:'#1a1a2e'};
  var syms={hearts:'\u2665',diamonds:'\u2666',clubs:'\u2663',spades:'\u2660'};
  drawFace(ctx,rank,suit,colors[suit]||'#000',syms[suit]||'?');
  // re-upload only the left half actually by re-texturing full atlas
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ac);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
}

function handleMsg(d){
  try{
    var msg=JSON.parse(d);
    if(msg.type==='flip'){
      flipStartRot=curRotY;
      targetRotY=msg.faceDown?Math.PI:0;
      flipping=true;
      flipStart=performance.now();
    }else if(msg.type==='setCard'){
      updateTexture(msg.rank,msg.suit);
    }
  }catch(ex){}
}
document.addEventListener('message',function(e){handleMsg(e.data);});
window.addEventListener('message',function(e){handleMsg(e.data);});
</script></body></html>`;
};

// ─── React component ──────────────────────────────────────────────────────────

const Card3D: React.FC<Card3DProps> = ({
  suit,
  rank,
  faceDown = false,
  size = 72,
  onFlipComplete,
}) => {
  const webViewRef = useRef<WebView>(null);
  const prevFaceDown = useRef(faceDown);
  const prevSuit = useRef(suit);
  const prevRank = useRef(rank);

  // Refs so onLoadEnd always sees current values
  const faceDownRef = useRef(faceDown);
  const suitRef = useRef(suit);
  const rankRef = useRef(rank);
  faceDownRef.current = faceDown;
  suitRef.current = suit;
  rankRef.current = rank;

  // HTML is computed once per mount (suit/rank/faceDown baked in)
  // When card identity changes, the parent re-keys the component → remount
  const html = useMemo(() => buildHTML(suit, rank, faceDown), []); // eslint-disable-line

  // Handle in-place prop changes (flip or card swap without remount)
  useEffect(() => {
    if (!webViewRef.current) return;

    if (faceDown !== prevFaceDown.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'flip', faceDown }));
    } else if (suit !== prevSuit.current || rank !== prevRank.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'setCard', suit, rank }));
    }

    prevFaceDown.current = faceDown;
    prevSuit.current = suit;
    prevRank.current = rank;
  }, [faceDown, suit, rank]);

  const cardHeight = Math.floor(size * CARD_RATIO);

  return (
    <View style={{ width: size, height: cardHeight }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={(e) => {
          if (e.nativeEvent.data === 'flipComplete') {
            onFlipComplete?.();
          }
        }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        {...(Platform.OS === 'ios' ? { allowsLinkPreview: false } : {})}
      />
    </View>
  );
};

export default Card3D;
