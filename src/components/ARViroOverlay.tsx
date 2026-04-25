/**
 * ARViroOverlay.tsx
 *
 * Uses ViroARSceneNavigator + ViroARScene (only stable navigator on this build).
 * board.glb  — Chess/Draughts board, XY plane, face at Z=+0.0238, frame ±0.2843 native
 * piece_dark.glb / piece_light.glb — disc pieces, ±1.0 XY, ±0.23 Z native
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Viro360Image,
  Viro3DObject,
  ViroAmbientLight,
  ViroBox,
  ViroARScene,
  ViroARSceneNavigator,
  ViroNode,
  ViroQuad,
  ViroMaterials,
  ViroSpotLight,
} from '@viro-community/react-viro';

// ── Types ─────────────────────────────────────────────────────────────────────
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
  recenter(): void;
}

interface Props {
  visible?: boolean;
  pieces?: ARPiece[];
  moves?: ARMove[];
  onSquareTap?: (row: number, col: number) => void;
  boardGlbPath?: string;
  piecesGlbPath?: string;
  panoramaSource?: number;
}

// ── Board geometry ─────────────────────────────────────────────────────────────
// board.glb native: frame ±0.2843 XY, squares span ±0.2707 XY, face at Z=+0.0238
// We scale the board node by BOARD_SCALE to reach a comfortable table size.
// After rotation [-90,0,0] the XY plane becomes the world XZ plane (flat table).
//
// piece GLBs native: ±1.0 XY (diameter 2.0), thickness 0.465 in Z
// We scale pieces so diameter = ~80% of one square.

// board.glb native: 2.0×2.0 units total, inner field ±0.2707, face at Z=+0.0238
// Scale 0.5 → board is 1.0m total, inner field 0.2707m half = 54cm playfield
const BOARD_SCALE   = 3.0;
const NATIVE_FACE_Z = 0.1408;
// Calibrated: board visual square width ~0.075m, 8 squares -> field half = 0.30m
const FIELD_HALF    = 0.35;
// GLB baked translation offset (corrects piece positions to true board center)
const BOARD_OX      = 0.03;  // manual X nudge right to center on board
const BOARD_OY      = -0.015;
const SQUARE        = (FIELD_HALF * 2) / 8;        // 0.075m per square
const FACE_Z        = NATIVE_FACE_Z * BOARD_SCALE; // board surface in board-local Z
// checker_pieces.glb: native +-16 XY, center at Z=2.2
// Piece fits in 80% of square: world_r = SQUARE*0.40 = 0.030m; scale = 0.030/16
const PIECE_SCALE   = (SQUARE * 0.40) / 16;
const PIECE_FACE_Z  = FACE_Z + 0.05; // sits on board surface

const BOARD_POS: [number, number, number] = [0, -0.85, -1.6];


// ── Materials ─────────────────────────────────────────────────────────────────
let _materialsRegistered = false;
function registerMaterials() {
  if (_materialsRegistered) return;
  _materialsRegistered = true;
  try {
    ViroMaterials.createMaterials({
      moveDot:      { diffuseColor: 'rgba(255,255,255,0.75)', roughness: 1.0, blendMode: 'Alpha' },
      selectedRing: { diffuseColor: 'rgba(255,220,0,0.85)', roughness: 1.0, blendMode: 'Alpha' },
      redPiece:     { diffuseColor: '#cc1111', roughness: 0.3, metalness: 0.3, lightingModel: 'Phong' },
      blackPiece:   { diffuseColor: '#111111', roughness: 0.3, metalness: 0.4, lightingModel: 'Phong' },
      redSel:       { diffuseColor: '#ff4400', roughness: 0.2, metalness: 0.4, lightingModel: 'Phong' },
      blackSel:     { diffuseColor: '#3344ff', roughness: 0.2, metalness: 0.4, lightingModel: 'Phong' },
      debugDark:    { diffuseColor: 'rgba(255,255,255,0.7)', blendMode: 'Alpha' },
      debugLight:   { diffuseColor: 'rgba(0,0,0,0.0)', blendMode: 'Alpha' },
      debugRed:     { diffuseColor: '#ff0000' },
      debugGreen:   { diffuseColor: '#00ff00' },
      debugBlue:    { diffuseColor: '#0000ff' },
      debugYellow:  { diffuseColor: '#ffff00' },
    });
  } catch (e) {
    console.warn('[ARViroOverlay] createMaterials failed:', e);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Board node has rotation [-90,0,0]: XY->XZ, so col->X, row->Z, up->Y
// Grid centered at [BOARD_OX, BOARD_OY] — row=X axis, col=Y axis
function boardToWorld(row: number, col: number): [number, number, number] {
  const x = BOARD_OX + (row - 3.5) * SQUARE;
  const y = BOARD_OY + (col - 3.5) * SQUARE;
  return [x, y, PIECE_FACE_Z];
}

function worldToSquare(localX: number, localZ: number): { row: number; col: number } | null {
  const col = Math.floor((localX - BOARD_OX) / SQUARE + 3.5);
  const row = Math.floor((localZ - BOARD_OY) / SQUARE + 3.5);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { row, col };
}



// ── Piece ─────────────────────────────────────────────────────────────────────
// checker_pieces.glb: single disc, ±1.0 XY native — instanced 24x across the board
const PIECE_SC: [number,number,number] = [PIECE_SCALE, PIECE_SCALE, PIECE_SCALE];

const CHECKER_PIECE_SRC = require('../../assets/glb/checkers/checker_pieces.glb');

function CheckerPiece({ piece }: { piece: ARPiece }) {
  const [x, y, z] = boardToWorld(piece.row, piece.col);
  const zPos = piece.isSelected ? z + 0.02 : z;
  const discH = SQUARE * 0.18;
  const discW = SQUARE * 0.78;
  if (piece.color === 'black') {
    // ViroBox disc for black pieces — guaranteed visible contrast
    return (
      <ViroNode position={[x, y, zPos]}>
        <ViroBox
          scale={[discW, discH, discW]}
          materials={[piece.isSelected ? 'blackSel' : 'blackPiece']}
        />
      </ViroNode>
    );
  }
  return (
    <ViroNode position={[x, y, zPos]}>
      <Viro3DObject
        source={CHECKER_PIECE_SRC}
        type="GLB"
        scale={PIECE_SC}
        onError={(e: any) => console.error('[ARViroOverlay] piece err', piece.key, e)}
      />
    </ViroNode>
  );
}

// ── Move dot ──────────────────────────────────────────────────────────────────
function MoveDot({ row, col }: { row: number; col: number }) {
  const [x, y] = boardToWorld(row, col);
  return (
    <ViroQuad
      position={[x, y, FACE_Z + 0.01]}
      rotation={[-90, 0, 0]}
      width={SQUARE * 0.50}
      height={SQUARE * 0.50}
      materials={['moveDot']}
    />
  );
}

// ── AR Scene ──────────────────────────────────────────────────────────────────
interface SceneProps {
  sceneNavigator: {
    viroAppProps: {
      pieces: ARPiece[];
      moves: ARMove[];
      onSquareTap?: (row: number, col: number) => void;
      panoramaSource?: number;
    };
  };
}

function CheckersARScene({ sceneNavigator }: SceneProps) {
  registerMaterials();

  const { pieces, moves, onSquareTap, panoramaSource } = sceneNavigator.viroAppProps;

  const handleBoardTap = useCallback(
    (position: [number, number, number], _source: any) => {
      if (!onSquareTap) return;
      // position is in board-node local space (after [-90,0,0] rotation)
      // col from X, row from Z
      const localX = position[0] - BOARD_POS[0];
      const localZ = position[2] - BOARD_POS[2];
      const sq = worldToSquare(localX, localZ);
      if (sq) onSquareTap(sq.row, sq.col);
    },
    [onSquareTap],
  );

  return (
    <ViroARScene>
      <Viro360Image
        source={panoramaSource ?? require('../../assets/backgrounds/capture360/pano2.jpg')}
        onError={(e: any) => console.error('[ARViroOverlay] 360 error:', e)}
      />

      <ViroAmbientLight color="#ffffff" intensity={200} />


      {/* Board node: [-90,0,0] lays the XY-face board flat like a table */}
      <ViroNode position={BOARD_POS} rotation={[-90, -3.678, 0]}>
        <Viro3DObject
          source={require('../../assets/glb/checkers/chess-board/source/ui.glb')}
          type="GLB"
          scale={[BOARD_SCALE, BOARD_SCALE, BOARD_SCALE]}
          onClick={handleBoardTap}
          onLoadStart={() => console.log('[ARViroOverlay] board GLB load start')}
          onLoadEnd={()   => console.log('[ARViroOverlay] board GLB load end')}
          onError={(e: any) => console.error('[ARViroOverlay] board GLB error:', e)}
        />

        {/* DEBUG GRID: colored corners + dark square dots */}
        {Array.from({length:8}, (_,r) => Array.from({length:8}, (_,c) => {
          const [x,y,z] = boardToWorld(r,c);
          const isDark = (r+c)%2===1;
          let mat = isDark ? 'debugDark' : 'debugLight';
          if (r===0&&c===0) mat='debugRed';
          if (r===0&&c===7) mat='debugGreen';
          if (r===7&&c===0) mat='debugBlue';
          if (r===7&&c===7) mat='debugYellow';
          return (
            <ViroBox
              key={`dbg_${r}_${c}`}
              position={[x, y, z + 0.005]}
              scale={[SQUARE*0.5, SQUARE*0.5, 0.003]}
              materials={[mat]}
            />
          );
        }))}
        {(moves  ?? []).map(m => <MoveDot key={`dot_${m.row}_${m.col}`} row={m.row} col={m.col} />)}
      </ViroNode>
    </ViroARScene>
  );
}

// ── Public component ───────────────────────────────────────────────────────────
const ARViroOverlay = forwardRef<AR3DOverlayHandle, Props>(function ARViroOverlay(
  { visible = true, pieces = [], moves = [], onSquareTap, boardGlbPath, panoramaSource },
  ref,
) {
  const navigatorRef = useRef<any>(null);
  const onSquareTapRef = useRef(onSquareTap);
  onSquareTapRef.current = onSquareTap;
  const stableOnSquareTap = useCallback(
    (r: number, c: number) => onSquareTapRef.current?.(r, c),
    [],
  );

  useImperativeHandle(ref, () => ({ recenter() {} }));

  const viroAppProps = useMemo(() => ({
    pieces,
    moves,
    onSquareTap: stableOnSquareTap,
    panoramaSource,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pieces, moves, panoramaSource]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ViroARSceneNavigator
        ref={navigatorRef}
        autofocus
        initialScene={{ scene: CheckersARScene as unknown as any }}
        viroAppProps={viroAppProps}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

export default ARViroOverlay;
