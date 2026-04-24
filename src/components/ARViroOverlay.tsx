/**
 * ARViroOverlay.tsx
 *
 * Uses ViroARSceneNavigator + ViroARScene (the only stable navigator on this build).
 * Viro360Image sets the background sphere — overlays on the AR camera feed.
 * GLB board floats at BOARD_POS in front of the user.
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
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroQuad,
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

// ── Board geometry constants ───────────────────────────────────────────────────
const BOARD_SIZE  = 0.70;
const FIELD_HALF  = 0.2544;
const SQUARE      = (FIELD_HALF * 2) / 8;   // 0.0636m per square
const BOARD_THICK = 0.045 * (0.70 / 1.06);  // ~0.0297m after scale
const PIECE_Y     = BOARD_THICK + 0.018;

// Board position: straight ahead at comfortable viewing distance
const BOARD_POS: [number, number, number] = [0, -0.85, -1.6];

// ── Materials ─────────────────────────────────────────────────────────────────
let _materialsRegistered = false;
function registerMaterials() {
  if (_materialsRegistered) return;
  _materialsRegistered = true;
  try {
    ViroMaterials.createMaterials({
      redPiece:           { diffuseColor: '#cc2222', roughness: 0.4, metalness: 0.2 },
      blackPiece:         { diffuseColor: '#111111', roughness: 0.4, metalness: 0.25 },
      redPieceSelected:   { diffuseColor: '#ff6644', roughness: 0.3, metalness: 0.3 },
      blackPieceSelected: { diffuseColor: '#4444cc', roughness: 0.3, metalness: 0.3 },
      moveDot:            { diffuseColor: 'rgba(255,255,255,0.7)', roughness: 1.0, blendMode: 'Alpha' },
      lightSquare:        { diffuseColor: '#c8b484', roughness: 0.55 },
      darkSquare:         { diffuseColor: '#5a3010', roughness: 0.55 },
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
          materials={['lightSquare','lightSquare','lightSquare','lightSquare','lightSquare','lightSquare']}
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

// ── AR Scene ──────────────────────────────────────────────────────────────────
interface SceneProps {
  sceneNavigator: {
    viroAppProps: {
      pieces: ARPiece[];
      moves: ARMove[];
      onSquareTap?: (row: number, col: number) => void;
      boardUri: string | null | undefined;
      panoramaSource?: number;
    };
  };
}

function CheckersARScene({ sceneNavigator }: SceneProps) {
  registerMaterials();

  const { pieces, moves, onSquareTap, boardUri, panoramaSource } =
    sceneNavigator.viroAppProps;

  console.log('[ARViroOverlay] scene boardUri:', boardUri, 'pano:', !!panoramaSource);

  const handleBoardTap = useCallback(
    (position: [number, number, number], _source: any) => {
      if (!onSquareTap) return;
      const localX = position[0] - BOARD_POS[0];
      const localZ = -(position[1] - BOARD_POS[1]);
      const sq = worldToSquare(localX, localZ);
      if (sq) onSquareTap(sq.row, sq.col);
    },
    [onSquareTap],
  );

  return (
    <ViroARScene>
      {/* 360 photosphere — sets background sphere on the AR portal */}
      <Viro360Image
        source={panoramaSource ?? require('../../assets/backgrounds/capture360/pano2.jpg')}
        onLoadStart={() => console.log('[ARViroOverlay] 360 load start')}
        onLoadEnd={()   => console.log('[ARViroOverlay] 360 load end')}
        onError={(e: any) => console.error('[ARViroOverlay] 360 error:', e)}
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

      {/* Board node */}
      <ViroNode position={BOARD_POS}>
        {/* GLB — only mount once URI is resolved (undefined = still loading) */}
        {boardUri !== undefined && boardUri !== null && (
          <Viro3DObject
            source={{ uri: boardUri }}
            type="GLB"
            scale={[BOARD_SIZE, BOARD_SIZE, BOARD_SIZE]}
            rotation={[-90, 0, 0]}
            onClick={handleBoardTap}
            onLoadStart={() => console.log('[ARViroOverlay] GLB load start')}
            onLoadEnd={()   => console.log('[ARViroOverlay] GLB load end')}
            onError={(e: any) => console.error('[ARViroOverlay] GLB error:', e)}
          />
        )}
        {/* Fallback box shown while GLB resolves or if no path given */}
        {(boardUri === undefined || boardUri === null) && (
          <ViroBox
            scale={[BOARD_SIZE, BOARD_THICK, BOARD_SIZE]}
            materials={['darkSquare','darkSquare','darkSquare','darkSquare','darkSquare','darkSquare']}
            onClick={handleBoardTap}
          />
        )}

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

  // undefined = still resolving, null = no path/failed, string = ready
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

  const viroAppProps = useMemo(() => ({
    pieces,
    moves,
    onSquareTap: stableOnSquareTap,
    boardUri,
    panoramaSource,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pieces, moves, boardUri, panoramaSource]);

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
