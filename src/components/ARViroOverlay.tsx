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
  ViroSphere,
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
const BOARD_SCALE   = 0.04;
const NATIVE_FACE_Z = 1.3809; // top face Y in native coords
// Calibrated: board visual square width ~0.075m, 8 squares -> field half = 0.30m
const FIELD_HALF    = 0.40;
// GLB baked translation offset (corrects piece positions to true board center)
const BOARD_OX      = 0.0;
const BOARD_OY      = 0.04;
const SQUARE        = (FIELD_HALF * 2) / 8;        // 0.075m per square
const FACE_Z        = NATIVE_FACE_Z * BOARD_SCALE; // board surface in board-local Z
// checker_pieces.glb: native +-16 XY, center at Z=2.2
// Piece fits in 80% of square: world_r = SQUARE*0.40 = 0.030m; scale = 0.030/16
const PIECE_SCALE   = (SQUARE * 0.40) / 16;
const PIECE_FACE_Z  = FACE_Z + 0.03;  // raised to sit on board surface

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
      redPiece:     { diffuseColor: '#ff1111', roughness: 0.2, metalness: 0.1, lightingModel: 'Phong' },
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
// Board flat in XZ plane (no rotation). X=col, Z=row, Y=up (piece height)
function boardToWorld(row: number, col: number): [number, number, number] {
  const x = BOARD_OX + (col - 3.5) * SQUARE;
  const z = BOARD_OY + (row - 3.5) * SQUARE;
  return [x, PIECE_FACE_Z, z];
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
  const yPos = piece.isSelected ? y + 0.02 : y;
  const discH = SQUARE * 0.18;
  const discW = SQUARE * 0.78;
  if (piece.color === 'black') {
    const d = SQUARE * 0.82;
    const h = SQUARE * 0.18;
    return (
      <ViroNode position={[x, yPos, z]}>
        <ViroBox
          scale={[d, h, d]}
          materials={[piece.isSelected ? 'blackSel' : 'blackPiece']}
        />
      </ViroNode>
    );
  }
  const d = SQUARE * 0.82;
  const h = SQUARE * 0.18;
  return (
    <ViroNode position={[x, yPos, z]}>
      <ViroBox
        scale={[d, h, d]}
        materials={[piece.isSelected ? 'redSel' : 'redPiece']}
      />
    </ViroNode>
  );
}

// ── Move dot ──────────────────────────────────────────────────────────────────
function MoveDot({ row, col }: { row: number; col: number }) {
  const [x, , z] = boardToWorld(row, col);
  return (
    <ViroQuad
      position={[x, FACE_Z + 0.01, z]}
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
      <ViroNode position={BOARD_POS} rotation={[0, 0, 0]}>
        <Viro3DObject
          source={require('../../assets/glb/checkers/chess_board_v2.glb')}
          type="GLB"
          scale={[BOARD_SCALE, BOARD_SCALE, BOARD_SCALE]}
          onClick={handleBoardTap}
          onLoadStart={() => console.log('[ARViroOverlay] board GLB load start')}
          onLoadEnd={()   => console.log('[ARViroOverlay] board GLB load end')}
          onError={(e: any) => console.error('[ARViroOverlay] board GLB error:', e)}
        />

        {(pieces ?? []).map(p => <CheckerPiece key={p.key} piece={p} />)}
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
