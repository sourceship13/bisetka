/**
 * ARViroOverlay.tsx
 *
 * Uses ViroARSceneNavigator + ViroARScene (only stable navigator on this build).
 * board.glb  -- Chess/Draughts board, XY plane, face at Z=+0.0238, frame +-0.2843 native
 * piece_dark.glb / piece_light.glb -- disc pieces, +-1.0 XY, +-0.23 Z native
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Viro360Image,
  Viro3DObject,
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroSphere,
  ViroNode,
  ViroMaterials,
  ViroSpotLight,
} from '@viro-community/react-viro';

// -- Types -----------------------------------------------------------------------
export interface ARPiece {
  key: string;
  row: number;
  col: number;
  color: 'red' | 'black';
  isKing: boolean;
  isSelected?: boolean;
  // Chess-specific (optional — checkers pieces used when absent)
  pieceType?: 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
  side?: 'white' | 'black';
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

// -- Board configs ---------------------------------------------------------------
interface BoardConfig {
  id: string;
  label: string;
  src: ReturnType<typeof require>;
  boardScale: number;
  nativeFaceY: number;
  fieldHalf: number;
  boardOX: number;
  boardOY: number;
  faceExtraY: number;
  boardFaceOffset: number; // baked-in GLB translation offset
  boardYOffset: number;    // per-board Y nudge in world space
  ambientIntensity: number;
  spotIntensity: number;
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
    boardFaceOffset: 0,
    boardYOffset: -0.3,
    ambientIntensity: 600,
    spotIntensity: 20,
  },
  {
    id: 'armenian',
    label: 'Armenian',
    src: require('../../assets/glb/game_boards/armenian_marble_gold_merged.glb'),
    boardScale: 0.177,
    nativeFaceY: 0.568,
    fieldHalf: 0.345,
    boardOX: 0.045,
    boardOY: 0.0,
    faceExtraY: -0.08,
    boardFaceOffset: -0.165,
    boardYOffset: 0.3,
    ambientIntensity: 600,
    spotIntensity: 2000,
  }
];

const BOARD_POS: [number, number, number] = [0, -0.85, -1.6];

// Module-level store: updated every render of ARViroOverlay (outer RN component).
// CheckersARScene reads this + uses a polling tick to re-render when boardIdx changes.
const _live = {
  boardIdx: 0,
  pieces: [] as ARPiece[],
  moves: [] as ARMove[],
  onSquareTap: undefined as ((r: number, c: number) => void) | undefined,
  panoramaSource: undefined as number | undefined,
};

function getBoardDerived(cfg: BoardConfig) {
  const SQUARE       = (cfg.fieldHalf * 2) / 8;
  const FACE_Z       = cfg.boardFaceOffset + cfg.nativeFaceY * cfg.boardScale;
  const PIECE_FACE_Z = FACE_Z + cfg.faceExtraY;
  const PIECE_SCALE  = (SQUARE * 0.40) / 10.8;
  const PIECE_SC_Z   = 0.01 / 5.537;
  const PIECE_SC: [number, number, number] = [PIECE_SCALE, PIECE_SCALE, PIECE_SC_Z];
  return { SQUARE, FACE_Z, PIECE_FACE_Z, PIECE_SCALE, PIECE_SC };
}

// -- Materials -------------------------------------------------------------------
let _materialsRegistered = false;
function registerMaterials() {
  if (_materialsRegistered) return;
  _materialsRegistered = true;
  try {
    ViroMaterials.createMaterials({
      moveDot:       { diffuseColor: 'rgba(255,255,255,0.75)', roughness: 1.0, blendMode: 'Alpha' },
      selectedRing:  { diffuseColor: 'rgba(255,220,0,0.85)',   roughness: 1.0, blendMode: 'Alpha' },
      redPiece:      { diffuseColor: '#ff1111', roughness: 0.2, metalness: 0.1, lightingModel: 'Phong' },
      blackPiece:    { diffuseColor: '#111111', roughness: 0.3, metalness: 0.4, lightingModel: 'Phong' },
      redSel:        { diffuseColor: '#ff4400', roughness: 0.2, metalness: 0.4, lightingModel: 'Phong' },
      blackSel:      { diffuseColor: '#3344ff', roughness: 0.2, metalness: 0.4, lightingModel: 'Phong' },
      chessWhite:    { diffuseColor: '#f0d9b5', roughness: 0.35, metalness: 0.08, lightingModel: 'Phong' },
      chessBlack:    { diffuseColor: '#5d4037', roughness: 0.40, metalness: 0.08, lightingModel: 'Phong' },
      chessWhiteSel: { diffuseColor: '#ffe066', roughness: 0.25, metalness: 0.15, lightingModel: 'Phong' },
      chessBlackSel: { diffuseColor: '#a07040', roughness: 0.30, metalness: 0.15, lightingModel: 'Phong' },
      debugDark:     { diffuseColor: 'rgba(255,255,255,0.7)', blendMode: 'Alpha' },
      squareHit:     { diffuseColor: 'rgba(255,255,255,0.01)', blendMode: 'Alpha' },
      debugLight:    { diffuseColor: 'rgba(0,0,0,0.0)', blendMode: 'Alpha' },
      debugRed:      { diffuseColor: '#ff0000' },
      debugGreen:    { diffuseColor: '#00ff00' },
      debugBlue:     { diffuseColor: '#0000ff' },
      debugYellow:   { diffuseColor: '#ffff00' },
    });
  } catch (e) {
    console.warn('[ARViroOverlay] createMaterials failed:', e);
  }
}

// -- Helpers ---------------------------------------------------------------------
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

// -- Piece -----------------------------------------------------------------------
const BLACK_PIECE_SRC = require('../../assets/glb/checkers/nyu_black_checker.glb');
const RED_PIECE_SRC   = require('../../assets/glb/checkers/nyu_red_checker.glb');

// Chess piece GLBs — static requires so Metro bundles them at build time.
const CHESS_GLB_PAWN   = require('../../assets/glb/chess/pawn.glb');
const CHESS_GLB_ROOK   = require('../../assets/glb/chess/rook.glb');
const CHESS_GLB_KNIGHT = require('../../assets/glb/chess/knight.glb');
const CHESS_GLB_BISHOP = require('../../assets/glb/chess/bishop.glb');
const CHESS_GLB_QUEEN  = require('../../assets/glb/chess/queen.glb');
const CHESS_GLB_KING   = require('../../assets/glb/chess/king.glb');

function getChessGlb(_side: 'white' | 'black', type: ARPiece['pieceType']) {
  if (type === 'rook')   return CHESS_GLB_ROOK;
  if (type === 'knight') return CHESS_GLB_KNIGHT;
  if (type === 'bishop') return CHESS_GLB_BISHOP;
  if (type === 'queen')  return CHESS_GLB_QUEEN;
  if (type === 'king')   return CHESS_GLB_KING;
  return CHESS_GLB_PAWN;
}

// Chess pieces — actual GLBs, static-required above.
// Body is a slim ViroBox; top accent is a ViroSphere (round pieces) or ViroBox cross (king).
// Height varies per piece type so each is visually distinct.

function ChessPiece({ piece, onTap, cfg, derived }: {
  piece: ARPiece;
  onTap?: (r: number, c: number) => void;
  cfg: BoardConfig;
  derived: ReturnType<typeof getBoardDerived>;
}) {
  const [x, boardY, z] = boardToWorld(piece.row, piece.col, cfg, derived);
  const lift = piece.isSelected ? 0.018 : 0;
  const handleTap = useCallback(() => onTap?.(piece.row, piece.col), [onTap, piece.row, piece.col]);
  const side = piece.side ?? 'white';
  const type = piece.pieceType ?? 'pawn';
  const src = getChessGlb(side, type);
  const pieceScale = derived.SQUARE * 0.035;
  return (
    <ViroNode position={[x, boardY + lift, z]} rotation={[-90, 0, 0]} onClick={handleTap}>
      <Viro3DObject
        source={src}
        type="GLB"
        scale={[pieceScale, pieceScale, pieceScale]}
        onError={(e: any) => console.error('[chess piece]', piece.key, e)}
      />
    </ViroNode>
  );
}

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

// -- Move dot --------------------------------------------------------------------
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

// -- AR Scene (Viro calls this as a constructor, not a React component) -----------
// viroAppProps is set at mount time and DOES update when viroAppProps changes on
// the navigator. The scene re-renders normally as a React function component.
interface SceneProps {
  sceneNavigator: {
    viroAppProps: {
      pieces: ARPiece[];
      moves: ARMove[];
      onSquareTap?: (row: number, col: number) => void;
      panoramaSource?: number;
      boardIdx: number;
    };
  };
}

function CheckersARScene({ sceneNavigator }: SceneProps) {
  registerMaterials();

  // Polling tick — forces re-render every 150ms so boardIdx changes are picked up
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 150);
    return () => clearInterval(id);
  }, []);

  // Read from mutable live store (always fresh) — viroAppProps doesn't re-render us
  const boardIdx    = _live.boardIdx;
  const pieces      = _live.pieces;
  const moves       = _live.moves;
  const onSquareTap = _live.onSquareTap;
  const panoramaSource = _live.panoramaSource;

  console.log('[CheckersARScene] render boardIdx=', boardIdx, 'cfg=', BOARD_CONFIGS[boardIdx]?.id, 'tick=', tick);

  const cfg     = BOARD_CONFIGS[boardIdx] ?? BOARD_CONFIGS[0];
  const derived = useMemo(() => getBoardDerived(cfg), [cfg]);

  const handleBoardTap = useCallback(
    (position: [number, number, number], _source: any) => {
      if (!onSquareTap) return;
      const localX = position[0] - BOARD_POS[0];
      const localZ = position[2] - BOARD_POS[2];
      const sq = worldToSquare(localX, localZ, cfg, derived);
      if (sq) onSquareTap(sq.row, sq.col);
    },
    [onSquareTap, cfg, derived],
  );

  return (
    <ViroARScene>
      <Viro360Image
        source={panoramaSource ?? require('../../assets/backgrounds/capture360/pano2.jpg')}
        onError={(e: any) => console.error('[ARViroOverlay] 360 error:', e)}
      />

      <ViroAmbientLight color="#ffffff" intensity={cfg.ambientIntensity} />
      <ViroSpotLight
        position={[0, BOARD_POS[1] + cfg.boardYOffset + 1.0, -1.6]}
        direction={[0, -1, 0]}
        color="#ffffff"
        intensity={cfg.spotIntensity}
        attenuationStartDistance={0.3}
        attenuationEndDistance={2.0}
        innerAngle={30}
        outerAngle={60}
        castsShadow={false}
      />

      <ViroNode position={[BOARD_POS[0], BOARD_POS[1] + cfg.boardYOffset, BOARD_POS[2]]} rotation={[0, 0, 0]}>
        {BOARD_CONFIGS.map((bc) => (
          <Viro3DObject
            key={bc.id}
            source={bc.src}
            type="GLB"
            visible={bc.id === cfg.id}
            scale={[bc.boardScale, bc.boardScale, bc.boardScale]}
            onClick={bc.id === cfg.id ? handleBoardTap : undefined}
            onLoadStart={() => console.log('[ARViroOverlay] board GLB load start', bc.id)}
            onLoadEnd={()   => console.log('[ARViroOverlay] board GLB load end',   bc.id)}
            onError={(e: any) => console.warn('[ARViroOverlay] board GLB error:', bc.id, e?.message ?? String(e))}
          />
        ))}

        {(pieces ?? []).map(p =>
          p.pieceType
            ? <ChessPiece   key={p.key} piece={p} onTap={onSquareTap} cfg={cfg} derived={derived} />
            : <CheckerPiece key={p.key} piece={p} onTap={onSquareTap} cfg={cfg} derived={derived} />
        )}
        {(moves ?? []).map(m => (
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

// -- Public component ------------------------------------------------------------
const ARViroOverlay = forwardRef<AR3DOverlayHandle, Props>(function ARViroOverlay(
  { visible = true, pieces = [], moves = [], onSquareTap, boardGlbPath: _boardGlbPath, panoramaSource },
  ref,
) {
  const onSquareTapRef = useRef(onSquareTap);
  onSquareTapRef.current = onSquareTap;
  const stableOnSquareTap = useCallback(
    (r: number, c: number) => onSquareTapRef.current?.(r, c),
    [],
  );

  const [boardIdx, setBoardIdx] = useState(0);

  // Sync module-level live store every render so polling scene picks up changes
  _live.boardIdx      = boardIdx;
  _live.pieces        = pieces;
  _live.moves         = moves;
  _live.onSquareTap   = stableOnSquareTap;
  _live.panoramaSource = panoramaSource;

  const handleCycleBoard = useCallback(() => {
    setBoardIdx((i: number) => (i + 1) % BOARD_CONFIGS.length);
  }, []);
  const currentBoardLabel = BOARD_CONFIGS[boardIdx].label;

  useImperativeHandle(ref, () => ({ recenter() {} }));

  // viroAppProps: Viro DOES pass updates through to the scene on re-render
  const viroAppProps = useMemo(() => ({
    pieces,
    moves,
    onSquareTap: stableOnSquareTap,
    panoramaSource,
    boardIdx,
  }), [pieces, moves, panoramaSource, boardIdx, stableOnSquareTap]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ViroARSceneNavigator
        autofocus
        initialScene={{ scene: CheckersARScene as unknown as any }}
        viroAppProps={viroAppProps}
        style={StyleSheet.absoluteFill}
      />
      <View style={overlayStyles.boardSwitchWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={overlayStyles.boardSwitchBtn}
          onPress={handleCycleBoard}
          activeOpacity={0.75}>
          <Text style={overlayStyles.boardSwitchIcon}>🔄</Text>
          <Text style={overlayStyles.boardSwitchLabel}>{currentBoardLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const overlayStyles = StyleSheet.create({
  boardSwitchWrap: {
    position: 'absolute',
    top: 60,
    right: 14,
    alignItems: 'flex-end',
  },
  boardSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  boardSwitchIcon: { fontSize: 16 },
  boardSwitchLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default ARViroOverlay;
