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
const BOARD_SCALE  = 3.0;
const NATIVE_FIELD = 0.1273;
const NATIVE_FACE_Z = 0.1408;
const FIELD_HALF   = NATIVE_FIELD * BOARD_SCALE;   // 0.135m half-width of playfield
const SQUARE       = (FIELD_HALF * 2) / 8;         // 0.034m per square
const FACE_Y       = NATIVE_FACE_Z * BOARD_SCALE;  // 0.012m — board surface height
const PIECE_SCALE  = SQUARE * 0.80 / 1.0;          // native piece radius=1.0, world=SQUARE*0.8
const PIECE_THICK  = 0.465 * PIECE_SCALE;
const PIECE_Y      = FACE_Y + PIECE_THICK / 2;

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
      redPiece:     { diffuseColor: '#cc2222', roughness: 0.4, metalness: 0.2 },
      blackPiece:   { diffuseColor: '#222222', roughness: 0.4, metalness: 0.3 },
      redSel:       { diffuseColor: '#ff6644', roughness: 0.3, metalness: 0.3 },
      blackSel:     { diffuseColor: '#4444cc', roughness: 0.3, metalness: 0.3 },
    });
  } catch (e) {
    console.warn('[ARViroOverlay] createMaterials failed:', e);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Board node has rotation [-90,0,0]: XY->XZ, so col->X, row->Z, up->Y
// After ViroNode rotation [-90,0,0]:
//   board-local X -> world X
//   board-local Y -> world Z (row axis)
//   board-local Z -> world Y (up)
// Board face is at board-local Z = NATIVE_FACE_Z * BOARD_SCALE
// Pieces sit at board-local Z = FACE_Z + half_piece_thickness
function boardToWorld(row: number, col: number): [number, number, number] {
  const x = -FIELD_HALF + (col + 0.5) * SQUARE;
  const y = -FIELD_HALF + (row + 0.5) * SQUARE;
  const z = NATIVE_FACE_Z * BOARD_SCALE + PIECE_THICK / 2; // Z = up in board-local
  return [x, y, z];
}

function worldToSquare(localX: number, localZ: number): { row: number; col: number } | null {
  const col = Math.floor((localX + FIELD_HALF) / SQUARE);
  const row = Math.floor((localZ + FIELD_HALF) / SQUARE);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { row, col };
}

// ── Piece ─────────────────────────────────────────────────────────────────────
function CheckerPiece({ piece }: { piece: ARPiece }) {
  const [x, y, z] = boardToWorld(piece.row, piece.col);
  const zPos = piece.isSelected ? z + 0.02 : z;
  const mat = piece.color === 'black'
    ? (piece.isSelected ? 'blackSel' : 'blackPiece')
    : (piece.isSelected ? 'redSel' : 'redPiece');
  const discScale: [number,number,number] = [SQUARE * 0.78, PIECE_THICK, SQUARE * 0.78];

  return (
    <ViroNode position={[x, y, zPos]}>
      <ViroBox
        scale={discScale}
        materials={[mat]}
      />
      {piece.isSelected && (
        <ViroQuad
          position={[0, 0, PIECE_THICK / 2 + 0.001]}
          rotation={[0, 0, 0]}
          width={SQUARE * 0.95}
          height={SQUARE * 0.95}
          materials={['selectedRing']}
        />
      )}
      {piece.isKing && (
        <ViroQuad
          position={[0, 0, PIECE_THICK / 2 + 0.002]}
          rotation={[0, 0, 0]}
          width={SQUARE * 0.40}
          height={SQUARE * 0.40}
          materials={['selectedRing']}
        />
      )}
    </ViroNode>
  );
}

// ── Move dot ──────────────────────────────────────────────────────────────────
function MoveDot({ row, col }: { row: number; col: number }) {
  const [x, y] = boardToWorld(row, col);
  return (
    <ViroQuad
      position={[x, y, NATIVE_FACE_Z * BOARD_SCALE + 0.002]}
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
      <ViroNode position={BOARD_POS} rotation={[-90, 0, 0]}>
        <Viro3DObject
          source={require('../../assets/glb/checkers/chess-board/source/ui.glb')}
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
