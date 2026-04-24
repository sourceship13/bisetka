/**
 * ARViroOverlay.tsx
 *
 * VR-mode overlay: renders pano2.jpg photosphere as background + Armenian
 * checkers board (GLB) floating at table distance in front of the player.
 * Gyro head-tracking lets the user look around the 360 room.
 *
 * Drop-in replacement: same props + ref API as AR3DOverlay.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { resolveAssetUri } from '../utils/resolveAssetUri';
import {
  Viro360Image,
  Viro3DObject,
  ViroAmbientLight,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroScene,
  ViroCamera,
  ViroSceneNavigator,
  ViroSpotLight,
} from '@viro-community/react-viro';

// ── Types (mirrored from AR3DOverlay) ─────────────────────────────────────────
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

// ── Board geometry constants ───────────────────────────────────────────────────
// armenian_board.glb: bevel extends to +-0.53, scale to 0.70m world
const BOARD_SIZE  = 0.70;
const FIELD_HALF  = 0.2544;
const SQUARE      = (FIELD_HALF * 2) / 8;   // 0.0636m per square
const BOARD_THICK = 0.045 * (0.70 / 1.06);  // ~0.0297m after scale
const PIECE_Y     = BOARD_THICK + 0.018;     // piece sits above board surface

// Board position in VR space: straight ahead at table height
const BOARD_POS: [number, number, number] = [0, -0.5, -1.5];

// ── Materials ─────────────────────────────────────────────────────────────────
let _materialsRegistered = false;
function registerMaterials() {
  if (_materialsRegistered) return;
  _materialsRegistered = true;
  try {
    ViroMaterials.createMaterials({
      redPiece:          { diffuseColor: '#cc2222', roughness: 0.4, metalness: 0.2 },
      blackPiece:        { diffuseColor: '#111111', roughness: 0.4, metalness: 0.25 },
      redPieceSelected:  { diffuseColor: '#ff6644', roughness: 0.3, metalness: 0.3 },
      blackPieceSelected:{ diffuseColor: '#4444cc', roughness: 0.3, metalness: 0.3 },
      moveDot:           { diffuseColor: 'rgba(255,255,255,0.7)', roughness: 1.0, blendMode: 'Alpha' },
      lightSquare:       { diffuseColor: '#c8b484', roughness: 0.55 },
      darkSquare:        { diffuseColor: '#5a3010', roughness: 0.55 },
    });
  } catch (e) {
    console.warn('[ARViroOverlay] createMaterials failed:', e);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function boardToLocal(row: number, col: number): [number, number, number] {
  const x = -FIELD_HALF + (col + 0.5) * SQUARE;
  const z = -FIELD_HALF + (row + 0.5) * SQUARE;
  return [x, PIECE_Y, z];
}

function worldToSquare(localX: number, localZ: number): { row: number; col: number } | null {
  const col = Math.floor((localX + FIELD_HALF) / SQUARE);
  const row = Math.floor((localZ + FIELD_HALF) / SQUARE);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { row, col };
}

// ── Piece ─────────────────────────────────────────────────────────────────────
function CheckerPiece({ piece }: { piece: ARPiece }) {
  const [x, y, z] = boardToLocal(piece.row, piece.col);
  const isSelected = piece.isSelected;
  const mat = piece.color === 'red'
    ? (isSelected ? 'redPieceSelected' : 'redPiece')
    : (isSelected ? 'blackPieceSelected' : 'blackPiece');

  const scale: [number, number, number] = [SQUARE * 0.55, SQUARE * 0.18, SQUARE * 0.55];
  const yPos = isSelected ? y + 0.02 : y;

  return (
    <ViroNode position={[x, yPos, z]}>
      <ViroBox scale={scale} materials={[mat, mat, mat, mat, mat, mat]} />
      {piece.isKing && (
        <ViroBox
          position={[0, SQUARE * 0.20, 0]}
          scale={[SQUARE * 0.30, SQUARE * 0.09, SQUARE * 0.30]}
          materials={['lightSquare', 'lightSquare', 'lightSquare', 'lightSquare', 'lightSquare', 'lightSquare']}
        />
      )}
    </ViroNode>
  );
}

// ── Move dot ──────────────────────────────────────────────────────────────────
function MoveDot({ row, col }: { row: number; col: number }) {
  const [x, , z] = boardToLocal(row, col);
  return (
    <ViroQuad
      position={[x, BOARD_THICK + 0.001, z]}
      rotation={[-90, 0, 0]}
      width={SQUARE * 0.42}
      height={SQUARE * 0.42}
      materials={['moveDot']}
    />
  );
}

// ── VR Scene ──────────────────────────────────────────────────────────────────
interface SceneProps {
  sceneNavigator: {
    viroAppProps: {
      pieces: ARPiece[];
      moves: ARMove[];
      onSquareTap?: (row: number, col: number) => void;
      boardUri: string | null;
      panoramaSource?: number;
    };
  };
}

function CheckersVRScene({ sceneNavigator }: SceneProps) {
  registerMaterials();

  const { pieces, moves, onSquareTap, boardUri, panoramaSource } =
    sceneNavigator.viroAppProps;

  console.log('[ARViroOverlay] scene mounted, panoramaSource:', panoramaSource, 'boardUri:', boardUri);

  const handleBoardTap = useCallback(
    (position: [number, number, number], _source: any) => {
      if (!onSquareTap) return;
      // position is in VR world space; board sits at BOARD_POS with -90 X rotation
      // In the rotated frame: world X -> local X, world Y -> local -Z
      const localX = position[0] - BOARD_POS[0];
      // After -90 X rotation, the board's local Z maps to world -Y
      // Tap position[1] relative to board = local Z (inverted)
      const localZ = -(position[1] - BOARD_POS[1]);
      const sq = worldToSquare(localX, localZ);
      if (sq) onSquareTap(sq.row, sq.col);
    },
    [onSquareTap],
  );

  return (
    <ViroScene>
      {/* Camera with gyro head-tracking so tilting phone pans the 360 room */}
      <ViroCamera position={[0, 0, 0]} active />

      {/* 360 photosphere environment */}
      <Viro360Image
        source={panoramaSource ?? require('../../assets/backgrounds/capture360/pano2.jpg')}
        onLoadStart={() => console.log('[ARViroOverlay] Viro360Image load start')}
        onLoadEnd={() => console.log('[ARViroOverlay] Viro360Image load end')}
        onError={(e: any) => console.error('[ARViroOverlay] Viro360Image error:', e)}
      />

      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroSpotLight
        position={[BOARD_POS[0], BOARD_POS[1] + 2.5, BOARD_POS[2]]}
        color="#ffffff"
        direction={[0, -1, 0]}
        attenuationStartDistance={2}
        attenuationEndDistance={6}
        innerAngle={30}
        outerAngle={60}
        castsShadow
      />

      {/* Board group — lay flat with -90 X rotation */}
      <ViroNode position={BOARD_POS} rotation={[-90, 0, 0]}>
        {/* GLB board — only renders when URI is resolved */}
        {boardUri ? (
          <Viro3DObject
            source={{ uri: boardUri }}
            type="GLB"
            scale={[BOARD_SIZE, BOARD_SIZE, BOARD_SIZE]}
            onClick={handleBoardTap}
          />
        ) : (
          // Thin fallback box while GLB loads
          <ViroBox
            scale={[BOARD_SIZE, BOARD_THICK, BOARD_SIZE]}
            materials={['darkSquare', 'darkSquare', 'darkSquare', 'darkSquare', 'darkSquare', 'darkSquare']}
            onClick={handleBoardTap}
          />
        )}

        {/* Pieces */}
        {(pieces ?? []).map(p => (
          <CheckerPiece key={p.key} piece={p} />
        ))}

        {/* Move dots */}
        {(moves ?? []).map(m => (
          <MoveDot key={`dot_${m.row}_${m.col}`} row={m.row} col={m.col} />
        ))}
      </ViroNode>
    </ViroScene>
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

  const [boardUri, setBoardUri] = useState<string | null | undefined>(
    boardGlbPath ? undefined : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!boardGlbPath) { setBoardUri(null); return; }
    resolveAssetUri(boardGlbPath).then(u => {
      console.log('[ARViroOverlay] boardUri resolved:', u);
      if (!cancelled) setBoardUri(u ?? null);
    });
    return () => { cancelled = true; };
  }, [boardGlbPath]);

  useImperativeHandle(ref, () => ({ recenter() {} }));

  // All hooks must be before early returns
  const viroAppProps = useMemo(() => ({
    pieces,
    moves,
    onSquareTap: stableOnSquareTap,
    boardUri: boardUri ?? null,
    panoramaSource,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pieces, moves, boardUri, panoramaSource]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Mount immediately — scene shows pano right away; board updates when GLB resolves */}
      <ViroSceneNavigator
        ref={navigatorRef}
        vrModeEnabled={false}
        initialScene={{ scene: CheckersVRScene as unknown as any }}
        viroAppProps={viroAppProps}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

export default ARViroOverlay;
