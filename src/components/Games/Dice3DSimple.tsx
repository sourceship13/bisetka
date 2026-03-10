import React, { useEffect, useRef, useMemo } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DICE_SIZE = Math.floor(SCREEN_WIDTH / 8);

interface Dice3DSimpleProps {
  value: number;
  isRolling: boolean;
  index: number;
  onRollComplete?: () => void;
}

// Target rotations so the desired face points toward camera (positive Z)
// Standard die: 1 front, 2 top (right-hand rule)
// We position camera at z=4 looking at origin
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },           // 1 faces camera
  2: { x: -Math.PI / 2, y: 0 },// 2 on top → tilt forward
  3: { x: 0, y: Math.PI / 2 }, // 3 on right → rotate left
  4: { x: 0, y: -Math.PI / 2 },// 4 on left → rotate right
  5: { x: Math.PI / 2, y: 0 }, // 5 on bottom → tilt back
  6: { x: 0, y: Math.PI },     // 6 on back → rotate 180
};

const buildHTML = (diceIndex: number) => `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style>
</head><body>
<canvas id="c"></canvas>
<script>
var canvas=document.getElementById('c');
var gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
canvas.width=256;canvas.height=256;
gl.viewport(0,0,256,256);
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.clearColor(0,0,0,0);

// Shader sources
var vsrc='attribute vec3 aPos;attribute vec3 aNorm;attribute vec2 aUV;attribute float aFace;'+
'uniform mat4 uMVP;uniform mat3 uNorm;'+
'varying vec3 vNorm;varying vec2 vUV;varying float vFace;'+
'void main(){gl_Position=uMVP*vec4(aPos,1.0);vNorm=uNorm*aNorm;vUV=aUV;vFace=aFace;}';

var fsrc='precision mediump float;'+
'varying vec3 vNorm;varying vec2 vUV;varying float vFace;'+
'uniform float uValue;'+
'void main(){'+
  'vec3 L=normalize(vec3(0.5,1.0,0.8));'+
  'float diff=max(dot(normalize(vNorm),L),0.0);'+
  'float amb=0.45;'+
  'float light=amb+diff*0.55;'+
  // cream base color for dice
  'vec3 base=vec3(1.0,0.98,0.82);'+
  'vec3 col=base*light;'+
  // determine which face value this fragment belongs to
  'float fv=0.0;'+
  'float fi=floor(vFace+0.5);'+
  // Standard die: face index 0=front(1),1=back(6),2=top(2),3=bottom(5),4=right(3),5=left(4)
  'if(fi<0.5)fv=1.0;else if(fi<1.5)fv=6.0;else if(fi<2.5)fv=2.0;else if(fi<3.5)fv=5.0;else if(fi<4.5)fv=3.0;else fv=4.0;'+
  // Dot rendering - check if current UV is inside any dot position
  'float dotR=0.075;float hit=0.0;'+
  'vec2 uv=vUV;'+
  // dot positions for each value
  'if(fv>0.5&&fv<1.5){'+// 1 dot center
    'if(length(uv-vec2(0.5,0.5))<dotR)hit=1.0;'+
  '}else if(fv>1.5&&fv<2.5){'+// 2 dots
    'if(length(uv-vec2(0.28,0.28))<dotR||length(uv-vec2(0.72,0.72))<dotR)hit=1.0;'+
  '}else if(fv>2.5&&fv<3.5){'+// 3 dots
    'if(length(uv-vec2(0.28,0.28))<dotR||length(uv-vec2(0.5,0.5))<dotR||length(uv-vec2(0.72,0.72))<dotR)hit=1.0;'+
  '}else if(fv>3.5&&fv<4.5){'+// 4 dots
    'if(length(uv-vec2(0.28,0.28))<dotR||length(uv-vec2(0.72,0.28))<dotR||length(uv-vec2(0.28,0.72))<dotR||length(uv-vec2(0.72,0.72))<dotR)hit=1.0;'+
  '}else if(fv>4.5&&fv<5.5){'+// 5 dots
    'if(length(uv-vec2(0.28,0.28))<dotR||length(uv-vec2(0.72,0.28))<dotR||length(uv-vec2(0.5,0.5))<dotR||length(uv-vec2(0.28,0.72))<dotR||length(uv-vec2(0.72,0.72))<dotR)hit=1.0;'+
  '}else{'+// 6 dots
    'if(length(uv-vec2(0.28,0.25))<dotR||length(uv-vec2(0.72,0.25))<dotR||length(uv-vec2(0.28,0.5))<dotR||length(uv-vec2(0.72,0.5))<dotR||length(uv-vec2(0.28,0.75))<dotR||length(uv-vec2(0.72,0.75))<dotR)hit=1.0;'+
  '}'+
  'if(hit>0.5)col=vec3(0.12,0.12,0.12);'+
  // edge darkening for rounded look
  'float edgeDist=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));'+
  'if(edgeDist<0.06){col*=0.7+0.3*(edgeDist/0.06);}'+
  'gl_FragColor=vec4(col,1.0);'+
'}';

function compileShader(src,type){
  var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;
}
var prog=gl.createProgram();
gl.attachShader(prog,compileShader(vsrc,gl.VERTEX_SHADER));
gl.attachShader(prog,compileShader(fsrc,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);gl.useProgram(prog);

// Rounded cube geometry - a standard cube with positions, normals, UVs, face index
var positions=[];var normals=[];var uvs=[];var faces=[];var indices=[];
var faceData=[
  {n:[0,0,1],u:[1,0,0],v:[0,1,0],c:[0,0,1]},   // front  (face 0 = value 1)
  {n:[0,0,-1],u:[-1,0,0],v:[0,1,0],c:[0,0,-1]},  // back   (face 1 = value 6)
  {n:[0,1,0],u:[1,0,0],v:[0,0,-1],c:[0,1,0]},    // top    (face 2 = value 2)
  {n:[0,-1,0],u:[1,0,0],v:[0,0,1],c:[0,-1,0]},   // bottom (face 3 = value 5)
  {n:[1,0,0],u:[0,0,-1],v:[0,1,0],c:[1,0,0]},    // right  (face 4 = value 3)
  {n:[-1,0,0],u:[0,0,1],v:[0,1,0],c:[-1,0,0]},   // left   (face 5 = value 4)
];
var S=0.5;
for(var fi=0;fi<6;fi++){
  var fd=faceData[fi];var base=positions.length/3;
  for(var j=0;j<4;j++){
    var uu=(j&1)?1:-1;var vv=(j&2)?1:-1;
    positions.push(
      fd.n[0]*S+fd.u[0]*S*uu+fd.v[0]*S*vv,
      fd.n[1]*S+fd.u[1]*S*uu+fd.v[1]*S*vv,
      fd.n[2]*S+fd.u[2]*S*uu+fd.v[2]*S*vv
    );
    normals.push(fd.n[0],fd.n[1],fd.n[2]);
    uvs.push((j&1)?1:0,(j&2)?1:0);
    faces.push(fi);
  }
  indices.push(base,base+1,base+3,base,base+3,base+2);
}

function makeBuf(data,type){
  var b=gl.createBuffer();gl.bindBuffer(type||gl.ARRAY_BUFFER,b);
  gl.bufferData(type||gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;
}

var posBuf=makeBuf(new Float32Array(positions));
var normBuf=makeBuf(new Float32Array(normals));
var uvBuf=makeBuf(new Float32Array(uvs));
var faceBuf=makeBuf(new Float32Array(faces));
var idxBuf=makeBuf(new Uint16Array(indices),gl.ELEMENT_ARRAY_BUFFER);

var aPos=gl.getAttribLocation(prog,'aPos');
var aNorm=gl.getAttribLocation(prog,'aNorm');
var aUV=gl.getAttribLocation(prog,'aUV');
var aFace=gl.getAttribLocation(prog,'aFace');
var uMVP=gl.getUniformLocation(prog,'uMVP');
var uNorm=gl.getUniformLocation(prog,'uNorm');
var uValue=gl.getUniformLocation(prog,'uValue');

// Matrix math
function mat4Perspective(fov,asp,near,far){
  var f=1/Math.tan(fov/2);var nf=1/(near-far);
  return[f/asp,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
}
function mat4LookAt(eye,ctr,up){
  var zx=eye[0]-ctr[0],zy=eye[1]-ctr[1],zz=eye[2]-ctr[2];
  var zl=Math.sqrt(zx*zx+zy*zy+zz*zz);zx/=zl;zy/=zl;zz/=zl;
  var xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  var xl=Math.sqrt(xx*xx+xy*xy+xz*xz);xx/=xl;xy/=xl;xz/=xl;
  var yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return[xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1];
}
function mat4Mul(a,b){
  var o=new Array(16);
  for(var i=0;i<4;i++)for(var j=0;j<4;j++){
    o[j*4+i]=0;for(var k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];
  }return o;
}
function mat4RotX(a){var c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];}
function mat4RotY(a){var c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
function mat4RotZ(a){var c=Math.cos(a),s=Math.sin(a);return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];}
function mat3FromMat4(m){
  // normal matrix (upper-left 3x3 of modelView, transposed inverse for uniform scaling)
  return[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]];
}

var proj=mat4Perspective(0.65,1,0.1,100);
var view=mat4LookAt([0,0,4],[0,0,0],[0,1,0]);
var vp=mat4Mul(proj,view);

// State
var currentValue=1;
var rolling=false;
var rollStart=0;
var rollDuration=1200+${diceIndex}*80;
var rollSpeedX=(2+Math.random()*3)*Math.PI*2;
var rollSpeedY=(2+Math.random()*3)*Math.PI*2;
var rollSpeedZ=(1+Math.random()*2)*Math.PI*2;
var targetRotX=0,targetRotY=0;
var curRotX=0,curRotY=0,curRotZ=0;
var bouncePhase=0;

function setFinalRotation(val){
  var rots={
    1:{x:0,y:0},
    2:{x:-1.5708,y:0},
    3:{x:0,y:1.5708},
    4:{x:0,y:-1.5708},
    5:{x:1.5708,y:0},
    6:{x:0,y:3.14159}
  };
  var r=rots[val]||rots[1];
  targetRotX=r.x;targetRotY=r.y;
}

setFinalRotation(1);

function easeOutQuart(t){return 1-Math.pow(1-t,4);}

function render(time){
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  var rx,ry,rz,ty=0;

  if(rolling){
    var elapsed=time-rollStart;
    var t=Math.min(elapsed/rollDuration,1);
    var ease=easeOutQuart(t);

    // Spin with deceleration
    rx=rollSpeedX*(t-ease*0.5*t);
    ry=rollSpeedY*(t-ease*0.5*t);
    rz=rollSpeedZ*(t-ease*0.5*t);

    // Blend toward target rotation
    if(t>0.6){
      var blend=(t-0.6)/0.4;
      blend=blend*blend*(3-2*blend); // smoothstep
      rx=rx*(1-blend)+targetRotX*blend;
      ry=ry*(1-blend)+targetRotY*blend;
      rz=rz*(1-blend);
    }

    // Bounce up and down
    if(t<0.3){
      ty=-0.4*Math.sin(t/0.3*Math.PI);
    }else if(t<0.6){
      ty=-0.15*Math.sin((t-0.3)/0.3*Math.PI);
    }else if(t<0.8){
      ty=-0.05*Math.sin((t-0.6)/0.2*Math.PI);
    }

    curRotX=rx;curRotY=ry;curRotZ=rz;

    if(t>=1){
      rolling=false;
      curRotX=targetRotX;curRotY=targetRotY;curRotZ=0;
      window.ReactNativeWebView.postMessage('rollComplete');
    }
  }else{
    rx=curRotX;ry=curRotY;rz=curRotZ;
  }

  var model=mat4Mul(mat4Mul(mat4RotX(rx),mat4RotY(ry)),mat4RotZ(rz));
  // Apply bounce translate
  var translateY=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,ty,0,1];
  model=mat4Mul(translateY,model);

  var mvp=mat4Mul(vp,model);
  var normMat=mat3FromMat4(model);

  gl.uniformMatrix4fv(uMVP,false,new Float32Array(mvp));
  gl.uniformMatrix3fv(uNorm,false,new Float32Array(normMat));
  gl.uniform1f(uValue,currentValue);

  gl.bindBuffer(gl.ARRAY_BUFFER,posBuf);gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,normBuf);gl.enableVertexAttribArray(aNorm);gl.vertexAttribPointer(aNorm,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,uvBuf);gl.enableVertexAttribArray(aUV);gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,faceBuf);gl.enableVertexAttribArray(aFace);gl.vertexAttribPointer(aFace,1,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxBuf);

  gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// Listen for messages from React Native
document.addEventListener('message',function(e){handleMsg(e.data);});
window.addEventListener('message',function(e){handleMsg(e.data);});
function handleMsg(d){
  try{
    var msg=JSON.parse(d);
    if(msg.type==='roll'){
      currentValue=msg.value;
      setFinalRotation(msg.value);
      rolling=true;
      rollStart=performance.now();
      rollDuration=1200+${diceIndex}*80;
      rollSpeedX=(2+Math.random()*3)*Math.PI*2;
      rollSpeedY=(2+Math.random()*3)*Math.PI*2;
      rollSpeedZ=(1+Math.random()*2)*Math.PI*2;
    }else if(msg.type==='setValue'){
      currentValue=msg.value;
      setFinalRotation(msg.value);
      curRotX=targetRotX;curRotY=targetRotY;curRotZ=0;
      rolling=false;
    }
  }catch(ex){}
}
</script></body></html>`;

const Dice3DSimple: React.FC<Dice3DSimpleProps> = ({
  value,
  isRolling,
  index,
  onRollComplete,
}) => {
  const webViewRef = useRef<WebView>(null);
  const prevRolling = useRef(false);
  const prevValue = useRef(value);

  const html = useMemo(() => buildHTML(index), [index]);

  useEffect(() => {
    if (!webViewRef.current) return;

    if (isRolling && !prevRolling.current) {
      // Start rolling animation
      webViewRef.current.postMessage(
        JSON.stringify({ type: 'roll', value }),
      );
    } else if (!isRolling && prevRolling.current) {
      // Settled — set final value
      webViewRef.current.postMessage(
        JSON.stringify({ type: 'setValue', value }),
      );
    } else if (!isRolling && value !== prevValue.current) {
      // Value changed without roll (e.g., opponent's dice)
      webViewRef.current.postMessage(
        JSON.stringify({ type: 'setValue', value }),
      );
    }

    prevRolling.current = isRolling;
    prevValue.current = value;
  }, [isRolling, value]);

  const onMessage = (event: any) => {
    if (event.nativeEvent.data === 'rollComplete') {
      if (index === 4 && onRollComplete) {
        onRollComplete();
      }
    }
  };

  return (
    <View style={{ width: DICE_SIZE, height: DICE_SIZE, marginHorizontal: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onMessage={onMessage}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        {...(Platform.OS === 'ios' ? { allowsLinkPreview: false } : {})}
      />
    </View>
  );
};

export default Dice3DSimple;
