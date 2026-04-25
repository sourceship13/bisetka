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
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Viro360Image,
  Viro3DObject,
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroNode,
  ViroMaterials,
  ViroSpotLight,
  ViroText,
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

// ── Board configs ──────────────────────────────────────────────────────────────
interface BoardConfig {
  id: string;
  label: string;
  src: ReturnType<typeof require>;
  boardScale: number;
  nativeFaceY: number; // top face Y in native GLB coords
  fieldHalf: number;   // half-extent of 8x8 play field in world metres
  boardOX: number;     // horizontal center offset correction
  boardOY: number;     // depth center offset correction
  faceExtraY: number;  // extra lift above board surface for pieces
}

const BOARD_CONFIGS: BoardConfig[] = [
  {
    id: 'v2',
    label: 'Classic',
    src: require('../../assets/glb/checkers/chess_board_v2.glb'),
    boardScale: 0.04,
    nativeFaceY: 1.3809,
    fieldHalf: 0.40,
    boardOX: 0.04,
    boardOY: 0.04,
    faceExtraY: 0.06,
  },
  {
    id: 'board',
    label: 'Minimal',
    src: require('../../assets/glb/checkers/board.glb'),
    boardScale: 0.50,
    nativeFaceY: 1.0,
    fieldHalf: 0.40,
    boardOX: 0.0,
    boardOY: 0.0,
    faceExtraY: 0.04,
  },
];

const BOARD_POS: [number, number, number] = [0, -0.85, -1.6];

// Derive per-board computed values
function getBoardDerived(cfg: BoardConfig) {
  const SQUARE      = (cfg.fieldHalf * 2) / 8;
  const FACE_Z      = cfg.nativeFaceY * cfg.boardScale;
  const PIECE_FACE_Z = FACE_Z + cfg.faceExtraY;
  const PIECE_SCALE = (SQUARE * 0.40) / 10.8;
  const PIECE_SC_Z  = 0.01 / 5.537;
  const PIECE_SC: [number, number, number] = [PIECE_SCALE, PIECE_SCALE, PIECE_SC_Z];
  return { SQUARE, FACE_Z, PIECE_FACE_Z, PIECE_SCALE, PIECE_SC };
}


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
      squareHit:    { diffuseColor: 'rgba(255,255,255,0.01)', blendMode: 'Alpha' },
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
function boardToWorld(row: number, col: number, cfg: BoardConfig, derived: ReturnType<typeof getBoardDerived>): [number, number, number] {
  const { SQUARE, PIECE_FACE_Z } = derived;
  const x = cfg.boardOX + (col - 3.5) * SQUARE;
  const z = cfg.boardOY + (row - 3.5) * SQUARE;
  return [x, PIECE_FACE_Z, z];
}

function worldToSquare(localX: number, localZ: number, cfg: BoardConfig, derived: ReturnType<typeof getBoardDerived>): { row: number; col: number } | null {
  const { SQUARE } = derived;
  const col = Math.floor((localX - cfg.boardOX) / SQUARE + 4);
  const row = Math.floor((localZ - cfg.boardOY) / SQUARE + 4);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { row, col };
}



// ── Piece ─────────────────────────────────────────────────────────────────────
const BLACK_PIECE_SRC = require('../../assets/glb/checkers/nyu_black_checker.glb');
const RED_PIECE_SRC   = require('../../assets/glb/checkers/nyu_red_checker.glb');

function CheckerPiece({ piece, onTap, cfg, derived }: {
  piece: ARPiece;
  onTap?: (r: number, c: number) => void;
  cfg: BoardConfig;
  derived: ReturnType<typeof getBoardDerived>;
}) {
  const [x, y, z] = boardToWorld(piece.row, piece.col, cfg, derived);
  const yPos = piece.isSelected ? y + 0.02 : y;
  const handleTap = useCallback(() => onTap?.(piece.row, piece.col), [onTap, piece.row, piece.col]);
  const src = piece.color === 'black' ? BLACK_PIECE_SRC : RED_PIECE_SRC;
  return (
    <ViroNode position={[x, yPos, z]} rotation={[-90, 0, 0]} onClick={handleTap}>
      <Viro3DObject
        source={src}
        type="GLB"
        scale={derived.PIECE_SC}
        onError={(e: any) => console.error('[piece]', piece.key, e)}
      />
    </ViroNode>
  );
}

// ── Move dot ──────────────────────────────────────────────────────────────────
function MoveDot({ row, col, onTap, cfg, derived }: {
  row: number;
  col: number;
  onTap?: (r: number, c: number) => void;
  cfg: BoardConfig;
  derived: ReturnType<typeof getBoardDerived>;
}) {
  const [x, , z] = boardToWorld(row, col, cfg, derived);
  const handleTap = useCallback(() => onTap?.(row, col), [onTap, row, col]);

  return (
    <ViroBox
      position={[x, derived.FACE_Z + 0.025, z]}
      scale={[derived.SQUARE * 0.75, 0.004, derived.SQUARE * 0.75]}
      materials={['moveDot']}
      onClick={handleTap}
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

  const [boardIdx, setBoardIdx] = useState(0);
  const cfg     = BOARD_CONFIGS[boardIdx];
  const derived = useMemo(() => getBoardDerived(cfg), [cfg]);

  const handleBoardTap = useCallback(
    (position: [number, number, number], _source: any) => {
      if (!onSquareTap) return;
      const localX = position[0] - BOARD_POS[0];
      const localZ = position[2] - BOARD_POS[2];
      const sq = worldToSquare(localX, localZ, cfg, derived);
      console.log('[tap] world', position, 'local', localX.toFixed(3), localZ.toFixed(3), 'sq', sq);
      if (sq) onSquareTap(sq.row, sq.col);
    },
    [onSquareTap, cfg, derived],
  );

  const handleCycleBoard = useCallback(() => {
    setBoardIdx((i: number) => (i + 1) % BOARD_CONFIGS.length);
  }, []);

  return (
    <ViroARScene>
      <Viro360Image
        source={panoramaSource ?? require('../../assets/backgrounds/capture360/pano2.jpg')}
        onError={(e: any) => console.error('[ARViroOverlay] 360 error:', e)}
      />

      <ViroAmbientLight color="#ffffff" intensity={20} />
      <ViroSpotLight
        position={[0, 0.5, -1.6]}
        direction={[0, -1, 0]}
        color="#ffffff"
        intensity={20}
        attenuationStartDistance={0.5}
        attenuationEndDistance={2.5}
        innerAngle={45}
        outerAngle={75}
        castsShadow={false}
      />

      {/* Board cycle button — floats above board */}
      <ViroText
        text={`🔄 ${cfg.label}`}
        position={[BOARD_POS[0] - 0.55, BOARD_POS[1] + 0.18, BOARD_POS[2]]}
        scale={[0.12, 0.12, 0.12]}
        style={{ fontFamily: 'Arial', fontSize: 18, color: '#ffffff', textAlignVertical: 'center', textAlign: 'center' }}
        onClick={handleCycleBoard}
      />

      {/* Board node */}
      <ViroNode position={BOARD_POS} rotation={[0, 0, 0]}>
        <Viro3DObject
          key={cfg.id}
          source={cfg.src}
          type="GLB"
          scale={[cfg.boardScale, cfg.boardScale, cfg.boardScale]}
          onClick={handleBoardTap}
          onLoadStart={() => console.log('[ARViroOverlay] board GLB load start', cfg.id)}
          onLoadEnd={()   => console.log('[ARViroOverlay] board GLB load end', cfg.id)}
          onError={(e: any) => console.error('[ARViroOverlay] board GLB error:', e)}
        />


        {(pieces ?? []).map(p => <CheckerPiece key={p.key} piece={p} onTap={onSquareTap} cfg={cfg} derived={derived} />)}
        {(moves  ?? []).map(m => (
          <MoveDot
            key={`dot_${m.row}_${m.col}`}
            row={m.row}
            col={m.col}
            onTap={onSquareTap}
            cfg={cfg}
            derived={derived}
          />
        ))}
      </ViroNode>
    </ViroARScene>
  );
}

// ── Public component ───────────────────────────────────────────────────────────
const ARViroOverlay = forwardRef<AR3DOverlayHandle, Props>(function ARViroOverlay(
  { visible = true, pieces = [], moves = [], onSquareTap, boardGlbPath: _boardGlbPath, panoramaSource },
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
