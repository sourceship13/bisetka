/**
 * AR3DOverlay.tsx
 *
 * Renders a transparent Three.js scene on top of the Photosphere that shares
 * the same gyro attitude data via useSharedAttitude().
 *
 * ─── Why no require() for GLB? ───────────────────────────────────────────────
 *   require() of binary assets goes through Metro's module resolver, which
 *   requires a cache reset every time assetExts is changed.  Instead, we
 *   accept path strings (relative to the project's assets/ folder) and
 *   derive the correct URI at runtime:
 *     • Dev  — use NativeModules.SourceCode.scriptURL to get the Metro host
 *               (works on simulator AND physical device with correct IP)
 *               → http://<metro-host>:8081/assets/<path>
 *     • Prod — use RNFS to read the bundled file and return a base64 data URL
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <Photosphere360Background overlayOpacity={0.3}>
 *     <AR3DOverlay
 *       visible={arEnabled}
 *       pieces={arPieces}
 *       boardGlbPath="glb/chess/chess-board/source/ui.glb"
 *       piecesGlbPath="glb/checkers/checker_pieces.glb"
 *     />
 *   </Photosphere360Background>
 */

import React, {useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef} from 'react';
import {StyleSheet, View, NativeModules, Platform, Image} from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import {useSharedAttitude} from './Photosphere360Background';
import {useAttitude} from '@sourceship13/react-native-capture360';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ARPiece {
  key: string;
  row: number;
  col: number;
  color: 'red' | 'black';
  isKing: boolean;
  isSelected?: boolean;
  pieceType?: string;
  side?: 'white' | 'black';
  /** Direct board-local X position (metres). When set, overrides row/col-based placement. */
  posX?: number;
  /** Direct board-local Y position (metres). When set, overrides row/col-based placement. */
  posY?: number;
  /** Direct board-local Z position (metres). Defaults to surface Z when posX/posY set. */
  posZ?: number;
  /** Scale override (metres) — replaces computed PIECE_SCALE. */
  pieceScale?: number;
  /** For pieceType 'stack_badge': the true total count to display. */
  stackCount?: number;
}

export interface ARMove {
  row: number;
  col: number;
}

export interface ARCard {
  /** Unique identifier for the card */
  key: string;
  /** Position in 3D space (meters) relative to sceneGroup origin */
  position: { x: number; y: number; z: number };
  /** Rotation in radians */
  rotation?: { x?: number; y?: number; z?: number };
  /** Scale factor */
  scale?: number;
  /** Card data */
  cardData: {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
    value: number;
    faceDown?: boolean;
    /** URI to custom card face background image (from CardTheme.backgroundImage) */
    backgroundImageUri?: string;
    /** URI to custom card back image (from CardTheme.cardBackImage) */
    cardBackImageUri?: string;
    /** Font family for rank/suit text (from CardTheme.font) */
    font?: string;
  };
}

export interface AR3DOverlayHandle {
  /** Re-centers the board in front of the player's current looking direction */
  recenter: () => void;
  /** Uniformly scales the AR board scene (clamped 0.4–3.0) */
  setScale: (scale: number) => void;
  /** Launch physics dice onto the 3D board. vx/vy are swipe velocity (screen units/s). */
  rollDiceOnBoard: (vx: number, vy: number, die1: number, die2: number) => void;
  /** Tint the die matching `value` red (die consumed by a move). */
  useDieTint: (value: number, movesRemaining: number, isDoubles: boolean) => void;
  /** Remove all tints (called when a new roll starts). */
  resetDiceTint: () => void;
  /** Update borne-off piece counts in the board's pocket areas. */
  updateBorneOff: (white: number, black: number) => void;
}

export interface AR3DOverlayProps {
  visible?: boolean;
  /** Called when the user taps a backgammon/nardi point in AR mode (0-based index 0-23) */
  onNardiPointTap?: (pointIndex: number) => void;
  /** Called when physics dice settle on the board; receives the pre-determined die values */
  onDiceRolled?: (die1: number, die2: number) => void;
  pieces?: ARPiece[];
  /** Possible-move squares — shown as 3D glowing dots on the board */
  moves?: ARMove[];
  /** Camera FOV — should match your Photosphere viewer (default 75) */
  fov?: number;
  /**
   * Path relative to assets/ folder for the chess-board GLB.
   * e.g. "glb/chess/chess-board/source/ui.glb"
   * Falls back to procedural board if omitted or if load fails.
   */
  boardGlbPath?: string;
  /**
   * Path relative to assets/ folder for the checker piece GLB.
   * e.g. "glb/checkers/checker_pieces.glb"
   * Falls back to procedural disc geometry if omitted or if load fails.
   */
  piecesGlbPath?: string;
  /**
   * Piece-type-specific GLB paths for chess.
   * If provided, these override the generic `piecesGlbPath` model per piece.
   */
  chessPieceGlbPaths?: Partial<Record<string, string>>;
  /**
   * Path relative to assets/ folder for the park table GLB.
   * e.g. "glb/park/tableCoffeeGlassSquare.glb"
   * Table is placed at the centre of the 360° sphere; board sits on top of it.
   * Falls back to a simple procedural table if omitted or if load fails.
   */
  tableGlbPath?: string;
  /**
   * AR floating labels — billboard sprites above each seat.
   * Each label has a position (board-relative, same coords as cards) and text lines.
   */
  arLabels?: Array<{
    key: string;
    position: { x: number; y: number; z: number };
    name: string;
    chips: string;
    active?: boolean;
    folded?: boolean;
  }>;
  /**
   * Cards to render in 3D AR space.
   * Each card has a unique key, position (x,y,z in meters), rotation, and card data.
   */
  cards?: ARCard[];
  /**
   * Path relative to assets/ folder for the card GLB template.
   * e.g. "glb/cards/card-template.glb"
   * Falls back to procedural card if omitted or if load fails.
   */
  cardGlbPath?: string;
  /**
   * Path relative to assets/ folder for the card back GLB texture.
   * e.g. "glb/cards/card-back.glb" or "assets/cards/default-card-back.png"
   * Falls back to default card back if omitted.
   */
  cardBackTexturePath?: string;
  /**
   * Called when the user taps a square on the 3D board.
   * Receives logical board coordinates (row 0–7, col 0–7) from Three.js raycasting.
   */
  onSquareTap?: (row: number, col: number) => void;
  /** CSS hex color for the 'red' player pieces. Default: '#c0392b' */
  pieceColorRed?: string;
  /** CSS hex color for the 'black' player pieces. Default: '#1e2d3d' */
  pieceColorBlack?: string;
  /** When true, suppresses the procedural chess/checkerboard overlay on top of the board GLB. */
  hideCheckerboard?: boolean;
  /** CSS hex string to override ALL board GLB mesh colors (e.g. '#ffffff' for white). Leave undefined to keep original textures. */
  boardColorOverride?: string;
  /**
   * Path relative to assets/ for a PNG/JPG to render as a flat textured plane
   * on the board surface in 3D AR space (covers the GLB playing field).
   * e.g. "nardi/board-futuristic.png"
   */
  boardSurfaceImagePath?: string;
  /** Scale multiplier for the board/table size (default 1.0). Use >1 for card-game tables. */
  boardScale?: number;
  /** Style of the procedural fallback board. 'poker' = oval green felt table. Default: 'default' (chess/checkers). */
  boardStyle?: string;
  /**
   * Override the vertical position of the board in world space (metres below camera).
   * Default: -0.80. Use a more-negative value to lower the board further from the camera.
   */
  boardY?: number;
  /**
   * When true, forces the loaded GLB to be treated as an XY-flat model (surface normal = +Z in
   * model space) regardless of bounding-box auto-detection. Use for casino/poker table GLBs that
   * have legs making the Z dimension too large to pass the automatic isXYFlat check.
   */
  boardGlbForceFlat?: boolean;
  /**
   * Forward tilt applied to the board group in radians (default 0).
   * Positive value tips the far/back edge of the table downward toward the floor.
   * Use for poker/casino tables where the steep viewing angle makes the back rail look raised.
   */
  boardTiltX?: number;
  /**
   * Override the Z distance (metres) of the board from the camera.
   * By default the distance is computed dynamically from FOV/screen size and clamped [0.55, 0.80].
   * Use a smaller value (e.g. 0.45) to bring the board closer to the camera.
   */
  tableDist?: number;
}

// ─── GLB URI resolver ─────────────────────────────────────────────────────────

// Static require map for all GLBs used by AR3DOverlay across all game screens.
// Because 'glb' is in Metro's assetExts, each require() registers the file as a
// Metro asset.  Image.resolveAssetSource(ref) then returns the correct URL —
// including the actual LAN IP of the Metro server, not 'localhost' — for both
// simulator (via USB tunnel) and physical device (over Wi-Fi).
const GLB_ASSET_MAP: Record<string, any> = {
  'glb/game_boards/rounded_table_panel_v4.glb': require('../../assets/glb/game_boards/rounded_table_panel_v4.glb'),
  'glb/game_boards/rounded_table_panel.glb':    require('../../assets/glb/game_boards/rounded_table_panel.glb'),
  'glb/game_boards/Poker_table.glb':            require('../../assets/glb/game_boards/Poker_table.glb'),
  'glb/checkers/chess_board_v2.glb':            require('../../assets/glb/checkers/chess_board_v2.glb'),
  'glb/game_assets/round_table.glb':            require('../../assets/glb/game_assets/round_table.glb'),
  'glb/game_assets/octagon_table.glb':          require('../../assets/glb/game_assets/octagon_table.glb'),
  'glb/game_assets/poker_table2.glb':            require('../../assets/glb/game_assets/poker_table2.glb'),
  'glb/game_assets/casino_table_level2_textured.glb': require('../../assets/glb/game_assets/casino_table_level2_textured.glb'),
  'glb/chess/chess-board/source/ui.glb':        require('../../assets/glb/chess/chess-board/source/ui.glb'),
  'glb/game_boards/Untitled.glb':               require('../../assets/glb/game_boards/Untitled.glb'),
  'glb/game_boards/Backgammon.glb':             require('../../assets/glb/game_boards/Backgammon.glb'),
  'glb/game_assets/Backgammon_board_only.glb':  require('../../assets/glb/game_assets/Backgammon_board_only.glb'),
  'nardi/board-futuristic.png':                  require('../../assets/nardi/board-futuristic.png'),
  'nardi/board.png':                             require('../../assets/nardi/board.png'),
  'glb/chess/chess-board/source/armenian_board.glb': require('../../assets/glb/chess/chess-board/source/armenian_board.glb'),
  'glb/chess/pawn.glb':                        require('../../assets/glb/chess/pawn.glb'),
  'glb/chess/rook.glb':                        require('../../assets/glb/chess/rook.glb'),
  'glb/chess/knight.glb':                      require('../../assets/glb/chess/knight.glb'),
  'glb/chess/bishop.glb':                      require('../../assets/glb/chess/bishop.glb'),
  'glb/chess/queen.glb':                       require('../../assets/glb/chess/queen.glb'),
  'glb/chess/king.glb':                        require('../../assets/glb/chess/king.glb'),
  'glb/cards/card-template.glb':                require('../../assets/glb/cards/card-template.glb'),
  'glb/checkers/nyu_red_checker.glb':           require('../../assets/glb/checkers/nyu_red_checker.glb'),
  'glb/checkers/nyu_black_checker.glb':         require('../../assets/glb/checkers/nyu_black_checker.glb'),
};

/**
 * Turns a project-assets-relative path into a base64 data URI for the WebView.
 *
 * Dev  — Downloads from Metro's asset server via fetch() (more reliable than
 *         RNFS.downloadFile in the iOS simulator for binary assets).
 *         Metro path format varies by version, so we try both:
 *           /assets/assets/<path>  (RN ≥ 0.73 / Metro ≥ 0.73)
 *           /assets/<path>         (legacy)
 *         Whichever returns HTTP 200 wins.
 * Prod — Reads directly from the app bundle via RNFS.
 */
async function resolveAssetUri(assetPath: string): Promise<string | null> {

  try {
    if (__DEV__) {
      // Get the Metro server URL for this asset via Image.resolveAssetSource.
      // Since 'glb' is in assetExts, Metro registers these files and
      // resolveAssetSource returns the correct URL — e.g.
      // http://192.168.x.x:8081/assets/... — regardless of whether the device
      // is on Wi-Fi or USB tunnel (unlike NativeModules.SourceCode.scriptURL
      // which can return 'localhost' even when Metro is on a LAN IP).
      const assetRef = GLB_ASSET_MAP[assetPath];
      let metroUrl: string | null = null;

      if (assetRef != null) {
        const resolved = Image.resolveAssetSource(assetRef);
        metroUrl = resolved?.uri ?? null;
      }

      // If Image.resolveAssetSource didn't give us a URL (can happen for non-image
      // asset types on Android), fall back to constructing from scriptURL.
      if (!metroUrl) {
        const scriptUrl: string = (NativeModules.SourceCode as any)?.scriptURL ?? '';
        const match = scriptUrl.match(/^(https?:\/\/[^/:]+(?::\d+)?)/);
        const base = match ? match[1] : null;
        if (base) {
          const encodedPath = assetPath.split('/').map(encodeURIComponent).join('/');
          metroUrl = `${base}/assets/assets/${encodedPath}`;
        }
      }

      if (!metroUrl) {
        console.warn('[AR3DOverlay] no Metro URL for:', assetPath);
        return null;
      }

      // In __DEV__ mode, skip the RNFS download entirely.
      // Pass the Metro HTTP URL directly — the WebView (mixedContentMode="always" +
      // allowUniversalAccessFromFileURLs) lets GLTFLoader fetch HTTP from file:// context.
      console.warn('[AR3DOverlay] resolving', assetPath, '→ Metro direct:', metroUrl);
      return metroUrl;
    }

    // Production: use RN's asset registry first — it knows the exact bundle path
    // regardless of iOS/Android layout. Works with allowUniversalAccessFromFileURLs.
    const assetRef = GLB_ASSET_MAP[assetPath];
    if (assetRef != null) {
      const resolved = Image.resolveAssetSource(assetRef);
      if (resolved?.uri) return resolved.uri;
    }

    // Fallback: copy from bundle to CachesDirectory (in case the direct URI is
    // inaccessible cross-origin from within the WebView's JS context).
    const safeFileName = assetPath.replace(/[/\\]/g, '_').replace(/ /g, '_');
    const cacheDir     = `${RNFS.CachesDirectoryPath}/glb_cache`;
    const cachedPath   = `${cacheDir}/${safeFileName}`;

    if (!(await RNFS.exists(cacheDir))) {
      await RNFS.mkdir(cacheDir);
    }

    if (await RNFS.exists(cachedPath)) {
      const stat = await RNFS.stat(cachedPath);
      if (stat.size > 1024) return `file://${cachedPath}`;
      // Stale / 0-byte from a previous failed copy — delete and re-copy
      await RNFS.unlink(cachedPath).catch(() => {});
    }

    if (Platform.OS === 'ios') {
      await RNFS.copyFile(`${RNFS.MainBundlePath}/assets/${assetPath}`, cachedPath);
    } else {
      // Android: copyFileAssets streams from APK without loading into JS RAM
      await RNFS.copyFileAssets(`assets/${assetPath}`, cachedPath);
    }

    return `file://${cachedPath}`;
  } catch (e) {
    console.warn('[AR3DOverlay] asset resolve failed:', assetPath, e);
    return null;
  }
}

// ─── Three.js WebView HTML ────────────────────────────────────────────────────

// tableCoffeeGlassSquare.glb (9 KB) — Kenney furniture-kit, embedded as base64
// so it loads guaranteed on device without any Metro/bundle asset resolution.
const EMBEDDED_COFFEE_TABLE_URI = 'data:model/gltf-binary;base64,Z2xURgIAAADoJAAAPAcAAEpTT057ImV4dGVuc2lvbnNVc2VkIjpbIktIUl9tYXRlcmlhbHNfdW5saXQiXSwiYXNzZXQiOnsiZ2VuZXJhdG9yIjoiVW5pR0xURi0xLjI0IiwidmVyc2lvbiI6IjIuMCJ9LCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjo3NTY4fV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjIyMDgsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoyMjA4LCJieXRlTGVuZ3RoIjoyMjA4LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NDQxNiwiYnl0ZUxlbmd0aCI6MTQ3MiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU4ODgsImJ5dGVMZW5ndGgiOjE2MzIsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo3NTIwLCJieXRlTGVuZ3RoIjo0OCwidGFyZ2V0IjozNDk2M31dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImJ5dGVPZmZzZXQiOjAsInR5cGUiOiJWRUMzIiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE4NCwibWF4IjpbLTAuMDYwOTk2MDgsMC4yMywwLjFdLCJtaW4iOlstMC40NjA5OTYxLC0zLjYwOTU1N0UtMTYsLTAuM10sIm5vcm1hbGl6ZWQiOmZhbHNlfSx7ImJ1ZmZlclZpZXciOjEsImJ5dGVPZmZzZXQiOjAsInR5cGUiOiJWRUMzIiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE4NCwibm9ybWFsaXplZCI6ZmFsc2V9LHsiYnVmZmVyVmlldyI6MiwiYnl0ZU9mZnNldCI6MCwidHlwZSI6IlZFQzIiLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTg0LCJub3JtYWxpemVkIjpmYWxzZX0seyJidWZmZXJWaWV3IjozLCJieXRlT2Zmc2V0IjowLCJ0eXBlIjoiU0NBTEFSIiwiY29tcG9uZW50VHlwZSI6NTEyNSwiY291bnQiOjQwOCwibm9ybWFsaXplZCI6ZmFsc2V9LHsiYnVmZmVyVmlldyI6NCwiYnl0ZU9mZnNldCI6MCwidHlwZSI6IlNDQUxBUiIsImNvbXBvbmVudFR5cGUiOjUxMjUsImNvdW50IjoxMiwibm9ybWFsaXplZCI6ZmFsc2V9XSwibWF0ZXJpYWxzIjpbeyJuYW1lIjoibWV0YWwiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJiYXNlQ29sb3JGYWN0b3IiOlswLjc0MDYxMDU0LDAuODIyODY2NzM4LDAuODM5NjIyNiwxXSwibWV0YWxsaWNGYWN0b3IiOjAsInJvdWdobmVzc0ZhY3RvciI6MX0sImVtaXNzaXZlRmFjdG9yIjpbMCwwLDBdLCJkb3VibGVTaWRlZCI6ZmFsc2UsImFscGhhTW9kZSI6Ik9QQVFVRSJ9LHsibmFtZSI6ImdsYXNzIiwicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC42OTgwMzkyMzQsMC44Mjc0NTEsMC43Njg2Mjc0NjUsMC41XSwibWV0YWxsaWNGYWN0b3IiOjAsInJvdWdobmVzc0ZhY3RvciI6MX0sImVtaXNzaXZlRmFjdG9yIjpbMCwwLDBdLCJkb3VibGVTaWRlZCI6ZmFsc2UsImFscGhhTW9kZSI6IkJMRU5EIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJNZXNoIHRhYmxlQ29mZmVlR2xhc3NTcXVhcmUiLCJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJpbmRpY2VzIjozLCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJtYXRlcmlhbCI6MH0seyJtb2RlIjo0LCJpbmRpY2VzIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJtYXRlcmlhbCI6MX1dfV0sIm5vZGVzIjpbeyJuYW1lIjoidGFibGVDb2ZmZWVHbGFzc1NxdWFyZShDbG9uZSkiLCJ0cmFuc2xhdGlvbiI6WzAsMCwwXSwicm90YXRpb24iOlsw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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIA/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAIC/AAAAAAAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAvwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAACAPwAAAIAAAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAACAvwAAAIAAAAAA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ggAAAIQAAACDAAAAdAAAAIMAAACEAAAAhQAAAIgAAACHAAAAhgAAAIcAAACIAAAAiQAAAIsAAACKAAAAhgAAAIoAAACLAAAAjAAAAIcAAACOAAAAjQAAAI4AAACHAAAAjwAAAJEAAACIAAAAkAAAAIgAAACRAAAAkgAAAJMAAACQAAAAigAAAJAAAACTAAAAlAAAAJYAAACVAAAAiQAAAJUAAACWAAAAlwAAAJoAAACZAAAAmAAAAJkAAACaAAAAmwAAAJ4AAACdAAAAnAAAAJ0AAACeAAAAnwAAAJ0AAAChAAAAoAAAAKEAAACdAAAAogAAAKQAAACjAAAAnAAAAKMAAACkAAAApQAAAKYAAACkAAAAoAAAAKQAAACmAAAApwAAAKoAAACpAAAAqAAAAKkAAACqAAAAqwAAAKsAAACqAAAArAAAAKsAAACsAAAArQAAAKwAAACqAAAArgAAAK4AAACqAAAArwAAALAAAACtAAAArAAAALEAAACtAAAAsAAAALEAAACwAAAArwAAALEAAACvAAAAqgAAALIAAACtAAAAsQAAAK0AAACyAAAAswAAADgAAAA6AAAANQAAADoAAAA4AAAAOQAAALYAAAC1AAAAtAAAALcAAAC0AAAAtQAAAA==';

function buildSceneHTML(
  fov: number,
  boardUri:        string | null,
  piecesUri:       string | null,
  chessPieceUris:  Record<string, string | null>,
  tableUri:        string | null,
  spawnYaw:        number,
  pieceColorRed:   number,
  pieceColorBlack: number,
  cardUri:    string | null,
  cardBackUri: string | null,
  localThreePath: string | null = null,
  localGltfPath:  string | null = null,
  hideCheckerboard: boolean = false,
  boardScale: number = 1.0,
  boardStyle: string = 'default',
  boardY: number = -0.80,
  boardGlbForceFlat: boolean = false,
  boardTiltX: number = 0,
  boardColorOverride: string | null = null,
  boardSurfaceImageUri: string | null = null,
  tableDist: number | null = null,
): string {
  const BOARD_URI_JS  = boardUri  ? JSON.stringify(boardUri)  : 'null';
  const PIECES_URI_JS = piecesUri ? JSON.stringify(piecesUri) : 'null';
  const CHESS_PIECE_URIS_JS = JSON.stringify(chessPieceUris ?? {});
  const CARD_URI_JS   = cardUri ? JSON.stringify(cardUri) : 'null';
  const CARD_BACK_URI_JS = cardBackUri ? JSON.stringify(cardBackUri) : 'null';
  
  // Only load a table when explicitly requested by the screen.
  // Chess/Checkers should not auto-load an embedded table model.
  const TABLE_URI_JS  = tableUri ? JSON.stringify(tableUri) : 'null';
  const RED_HEX   = `0x${pieceColorRed.toString(16).padStart(6, '0')}`;
  const BLACK_HEX = `0x${pieceColorBlack.toString(16).padStart(6, '0')}`;
  const HIDE_CHECKERBOARD_JS = hideCheckerboard ? 'true' : 'false';
  const BOARD_SCALE_JS = boardScale.toFixed(4);
  const BOARD_STYLE_JS = JSON.stringify(boardStyle);
  const BOARD_Y_JS = boardY.toFixed(3);
  const BOARD_GLB_FORCE_FLAT_JS = boardGlbForceFlat ? 'true' : 'false';
  const BOARD_TILT_X_JS = boardTiltX.toFixed(4);
  const BOARD_COLOR_OVERRIDE_JS = boardColorOverride ? JSON.stringify(boardColorOverride) : 'null';
  const BOARD_SURFACE_IMAGE_URI_JS = boardSurfaceImageUri ? JSON.stringify(boardSurfaceImageUri) : 'null';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:transparent; overflow:hidden; }
  canvas { display:block; }
</style>
</head>
<body>
<script>
window.onerror = function(msg, src, line, col, err) {
  var info = '[AR3D-onerror] ' + msg + ' @ ' + src + ':' + line + ':' + col;
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'log',msg:info}));
};
document.addEventListener('securitypolicyviolation', function(e) {
  var info = '[AR3D-CSP] blocked: ' + e.blockedURI + ' directive: ' + e.violatedDirective;
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'log',msg:info}));
});
// Queue messages that arrive before the ES module finishes loading Three.js.
// The module script replaces this stub with the real handler and flushes the queue.
window._rnMsgQueue = [];
window.handleRNMessage = function(data) { window._rnMsgQueue.push(data); };
window.addEventListener('unhandledrejection', function(e) {
  var info = '[AR3D-reject] ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason));
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'log',msg:info}));
});
</script>
${localThreePath && localGltfPath ? `
<script type="importmap">
{"imports":{"three":"${localThreePath}","three/examples/jsm/loaders/GLTFLoader.js":"${localGltfPath}","three/addons/loaders/GLTFLoader.js":"${localGltfPath}"}}
</script>
` : ''}
<script type="module">
${localThreePath && localGltfPath ? `
import * as THREE from '${localThreePath}';
import { GLTFLoader } from '${localGltfPath}';
const DRACOLoader = class { setDecoderPath(){return this;} preload(){return this;} dispose(){} };
` : `
import * as THREE from 'https://esm.sh/three@0.166.1';
import { GLTFLoader } from 'https://esm.sh/three@0.166.1/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'https://esm.sh/three@0.166.1/examples/jsm/loaders/DRACOLoader';
`}

// ── Shared mutable state (updated by injectJavaScript) ───────────────────────
// Use || so that if injectJavaScript already set window._att with the live gyro
// value before this module script ran (async CDN load), we keep it.
// spawnYaw is the safe fallback so the camera starts aligned with the sceneGroup
// even if injectJavaScript hasn't fired yet.
window._att    = window._att || { yaw: ${spawnYaw}, pitch: 0, roll: 0 };
window._pieces = window._pieces || [];

// ── Renderer ─────────────────────────────────────────────────────────────────
const W = window.innerWidth, H = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 2, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── Scene & Camera ───────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(${fov}, W / H, 0.01, 200);
camera.position.set(0, 0, 0);
scene.add(camera);

// ── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xfff0e0, 0.55));
const key = new THREE.DirectionalLight(0xfff4e0, 1.10);
key.position.set(0, 8, 4); key.castShadow = true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.near=0.5; key.shadow.camera.far=30;
key.shadow.camera.left=-4; key.shadow.camera.right=4;
key.shadow.camera.top=4;   key.shadow.camera.bottom=-4;
scene.add(key);
const camFill = new THREE.DirectionalLight(0xd0e8ff, 0.55);
camFill.position.set(0, 3, 2); camera.add(camFill);
const camRim = new THREE.DirectionalLight(0xffe0a0, 0.28);
camRim.position.set(0, -1, -3); camera.add(camRim);

// ── World-space constants (1 unit ≈ 1 metre) ─────────────────────────────────
const BOARD_THICKNESS = 0.045;
const HIDE_CHECKERBOARD = ${HIDE_CHECKERBOARD_JS};
const BOARD_STYLE = ${BOARD_STYLE_JS};
const BOARD_HALF   = 0.35 * ${BOARD_SCALE_JS};
const BOARD_HALF_W = BOARD_HALF;
const BOARD_HALF_H = BOARD_HALF;
// Stretched wider so pieces span more of the board left/right
const FIELD_HALF_W = 0.305;
const FIELD_HALF_H = FIELD_HALF_W;
const SQUARE_W     = (FIELD_HALF_W * 2) / 8;  // 0.0636m per square
const SQUARE_H     = SQUARE_W;
const PIECE_SCALE  = SQUARE_W * 2.40;          // fills ~one square like checkers
const FIELD_RAISE  = 0.01270;                   // 1/2 inch raise — visible sides from camera angle
const BOARD_Y    = ${BOARD_Y_JS};  // lowered so board sits in lower half of viewport

// ── Dynamic TABLE_DIST: closest distance where board corners fit in view ──────
// hFov derived from vFov + aspect ratio so it adapts to every screen/orientation.
// MARGIN 0.75 keeps the board close; raw result is clamped [0.70, 1.10] so it
// never clips on ultra-wide landscape and never floats away on narrow portrait.
const _halfVFovRad = (${fov} / 2) * (Math.PI / 180);
const _aspect      = W / H;
const _halfHFovRad = Math.atan(Math.tan(_halfVFovRad) * _aspect);
const _rawDist     = (BOARD_HALF * 1.10 / Math.tan(_halfHFovRad)) + BOARD_HALF;
const TABLE_DIST   = ${tableDist !== null ? tableDist.toFixed(3) : 'Math.min(Math.max(_rawDist, 0.55), 0.80)'};

// ── sceneGroup starts as a camera child so it is always in front ─────────────────
// On the first animation frame (after camera rotation is applied from live gyro)
// it is detached from the camera and re-parented to the scene preserving its
// world matrix — so it stays fixed in the room from that point on.
// This completely sidesteps any yaw sign/offset ambiguity.
const DEG = Math.PI / 180;
const sceneGroup = new THREE.Group();
sceneGroup.position.x = 0.0; // shift right in camera space to centre in view
camera.add(sceneGroup);  // ← camera child: local (0,0,-TABLE_DIST) = always in front
var _boardZoom = 1.0;  // current uniform scale, updated by RN pinch gesture
let _frozen = false;
let _freezeCountdown = 8; // wait 8 frames for live gyro injectJavaScript to arrive

// ── Board group — flat horizontal, TABLE_DIST ahead in camera/sceneGroup space ───
const boardGroup = new THREE.Group();
boardGroup.position.set(0, BOARD_Y, -TABLE_DIST);
boardGroup.rotation.x = -Math.PI / 2 - ${BOARD_TILT_X_JS};
boardGroup.visible = false; // hidden until all GLBs are ready
sceneGroup.add(boardGroup);

// ── Asset-gate: show boardGroup + flush pieces only after all GLBs have loaded ─
var _gateNeeded = 0;    // total async loads to wait for
var _gateDone   = 0;    // completed (success or error)
var _gateOpen   = false; // true once everything is ready
var _gatePendingPieces = null; // last pieces[] received before gate opened
function _gateStart() { _gateNeeded++; }
function _gateDoneOne() {
  _gateDone++;
  if (!_gateOpen && _gateDone >= _gateNeeded) {
    _gateOpen = true;
    boardGroup.visible = true;
    _rnLog('[AR3D-HTML] All assets loaded — showing board and pieces.');
    if (_gatePendingPieces !== null) {
      var _flush = _gatePendingPieces;
      _gatePendingPieces = null;
      updatePieces(_flush);
    }
  }
}

// ── Invisible hit plane for raycasting — covers the board surface exactly ────
// CRITICAL: position hitPlane at the same height as the visual dots/pieces.
// At a 34° camera tilt, a plane at z=0 vs z=SURFACE_Z creates a parallax
// shift of ~0.3–0.7 squares, causing taps to land on the wrong square.
const SURFACE_Z = HIDE_CHECKERBOARD ? 0.002 : (BOARD_THICKNESS / 2 + FIELD_RAISE + 0.002);
const raycaster = new THREE.Raycaster();
const hitPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_HALF_W * 2, BOARD_HALF_H * 2),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
hitPlane.position.z = SURFACE_Z;
boardGroup.add(hitPlane);

// ── Physics Dice (boardGroup local space: Z=up, surface at SURFACE_Z) ─────────
// BoxGeometry face order [+X,-X,+Y,-Y,+Z,-Z] maps to die values [1,6,2,5,3,4]
const _FVAL = [1, 6, 2, 5, 3, 4];
const _DIE_HALF = 0.022;
const _DIE_REST = 0.58;      // realistic restitution — multiple bounces
const _DIE_FRIC = 0.20;      // lateral friction per floor contact
const _DIE_FLRZ = SURFACE_Z + 0.022;
const _DIE_WALL = FIELD_HALF_W * 0.88;
const _DIE_MIN_FRAMES = 95;  // must tumble this many frames before face-snapping (~1.5 s)
function _drawFace(ctx, v, s) {
  const r = s * 0.13;
  ctx.fillStyle = '#FFF8D4';
  ctx.beginPath();
  ctx.moveTo(r,0); ctx.lineTo(s-r,0); ctx.quadraticCurveTo(s,0,s,r);
  ctx.lineTo(s,s-r); ctx.quadraticCurveTo(s,s,s-r,s);
  ctx.lineTo(r,s); ctx.quadraticCurveTo(0,s,0,s-r);
  ctx.lineTo(0,r); ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(180,160,80,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  const dotMap = {
    1:[[.5,.5]],
    2:[[.28,.28],[.72,.72]],
    3:[[.28,.28],[.5,.5],[.72,.72]],
    4:[[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
    5:[[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
    6:[[.28,.22],[.72,.22],[.28,.5],[.72,.5],[.28,.78],[.72,.78]]
  };
  const dr = s * 0.085;
  ctx.fillStyle = '#1A1A1A';
  (dotMap[v]||dotMap[1]).forEach(([nx,ny])=>{ ctx.beginPath(); ctx.arc(nx*s,ny*s,dr,0,Math.PI*2); ctx.fill(); });
}
function _mkDieMesh() {
  const geo = new THREE.BoxGeometry(_DIE_HALF*2, _DIE_HALF*2, _DIE_HALF*2);
  const mats = _FVAL.map(v => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    _drawFace(c.getContext('2d'), v, 128);
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.35, metalness: 0.05 });
  });
  const m = new THREE.Mesh(geo, mats);
  m.castShadow = true; m.visible = false;
  boardGroup.add(m); return m;
}
function _settleQ(tv) {
  const fi = _FVAL.indexOf(tv);
  if (fi < 0) return new THREE.Quaternion();
  const ns = [
    new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
    new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
    new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
  ];
  return new THREE.Quaternion().setFromUnitVectors(ns[fi], new THREE.Vector3(0,0,1));
}
// ── Borne-off piece pockets ───────────────────────────────────────────────────
// Placed inside the board's decorative circular medallions (centre of each half).
// Left  circle (x≈-0.155): black / AI borne-off pieces
// Right circle (x≈+0.155): white / player borne-off pieces
// Pieces lie flat (circular face up), stacked along Y inside the circle.
// 5 discs at 0.026 spacing span 0.104 m — fits inside the ~0.13 m radius circle.
const _PKT = {
  black: { cx: -0.155, cyStart: -0.052, dir:  1 },
  white: { cx:  0.155, cyStart:  0.052, dir: -1 },
};
const _PKT_DISC_R   = 0.013;
const _PKT_DISC_H   = 0.007;
const _PKT_SPACING  = 0.026;  // tight stack to fit inside medallion circle
const _PKT_MAX_SHOW = 5;      // max discs rendered; badge shows true count
const _PKT_SZ       = SURFACE_Z + _PKT_DISC_H * 0.5 + 0.001;
let _pocketMeshes = null;

function _ensurePockets() {
  if (_pocketMeshes) return;
  _pocketMeshes = {};
  // Shared geometries
  const discGeo = new THREE.CylinderGeometry(_PKT_DISC_R, _PKT_DISC_R, _PKT_DISC_H, 20);
  ['white', 'black'].forEach(function(color) {
    const isWhite = color === 'white';
    const mat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xcc2828 : 0x1a1a30,
      roughness: 0.55, metalness: 0.12
    });
    var discs = [];
    for (var i = 0; i < _PKT_MAX_SHOW; i++) {
      var m = new THREE.Mesh(discGeo, mat);
      // CylinderGeometry axis is Y; rotate 90° around X so axis aligns with Z (face-up)
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      boardGroup.add(m);
      discs.push(m);
    }
    // Count badge: canvas-textured sprite
    var bc = document.createElement('canvas'); bc.width = 72; bc.height = 72;
    var btex = new THREE.CanvasTexture(bc);
    var bmat = new THREE.SpriteMaterial({ map: btex, transparent: true, depthTest: false, depthWrite: false });
    var badge = new THREE.Sprite(bmat);
    badge.scale.set(0.048, 0.048, 1);
    badge.visible = false;
    boardGroup.add(badge);
    _pocketMeshes[color] = { discs: discs, badge: badge, badgeCanvas: bc };
  });
}

function _updatePocket(color, count) {
  _ensurePockets();
  var def = _PKT[color];
  var pm = _pocketMeshes[color];
  var show = Math.min(count, _PKT_MAX_SHOW);
  for (var i = 0; i < _PKT_MAX_SHOW; i++) {
    if (i < show) {
      pm.discs[i].position.set(def.cx, def.cyStart + def.dir * i * _PKT_SPACING, _PKT_SZ);
      pm.discs[i].visible = true;
    } else {
      pm.discs[i].visible = false;
    }
  }
  if (count > 0) {
    // Draw count badge
    var ctx = pm.badgeCanvas.getContext('2d');
    ctx.clearRect(0, 0, 72, 72);
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.beginPath(); ctx.arc(36, 36, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color === 'white' ? '#e05555' : '#8888cc';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 36, 37);
    pm.badge.material.map.needsUpdate = true;
    // Place badge just beyond the last disc
    var lastIdx = Math.min(count - 1, _PKT_MAX_SHOW - 1);
    var badgeY = def.cyStart + def.dir * (lastIdx * _PKT_SPACING + 0.038);
    pm.badge.position.set(def.cx, badgeY, _PKT_SZ + 0.035);
    pm.badge.visible = true;
  } else {
    pm.badge.visible = false;
  }
}

let _physMeshes = null, _physState = null;
// Tint planes: one transparent quad floating above each die's top face
let _tintPlanes = null;
function _ensureTintPlanes() {
  if (_tintPlanes) return;
  _tintPlanes = [0,1].map(() => {
    const geo = new THREE.PlaneGeometry(_DIE_HALF*1.7, _DIE_HALF*1.7);
    const mat = new THREE.MeshBasicMaterial({ color:0x00dd55, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    boardGroup.add(m);
    return m;
  });
}
function _setDieTint(i, color, opacity) {
  if (!_tintPlanes) return;
  _tintPlanes[i].material.color.set(color);
  _tintPlanes[i].material.opacity = opacity;
  _tintPlanes[i].visible = opacity > 0;
}
function _resetDiceTint() {
  if (!_tintPlanes) return;
  _tintPlanes.forEach(p => {
    p.material.color.set(0x00dd55); // reset to green so next _applyGreenTints works
    p.material.opacity = 0;
    p.visible = false;
  });
}
function _applyGreenTints() {
  _ensureTintPlanes();
  if (!_physMeshes || !_physState) return;
  [0,1].forEach(i => {
    const pos = _physState.p[i].pos;
    _tintPlanes[i].position.set(pos.x, pos.y, _DIE_FLRZ + _DIE_HALF + 0.001);
    _tintPlanes[i].quaternion.set(0,0,0,1); // flat, faces up (+Z)
    // Don't overwrite a tint that was already set red by useDieTint
    // (happens when AI fires moves before slide finishes)
    if (_tintPlanes[i].material.color.getHex() !== 0xff3322) {
      _setDieTint(i, 0x00dd55, 0.38);
    }
  });
}
function _ensurePhys() { if (!_physMeshes) _physMeshes = [_mkDieMesh(), _mkDieMesh()]; }
function _mkBody(x, y0, vx, vy, tv) {
  return {
    pos: new THREE.Vector3(x, y0, _DIE_FLRZ + 0.36),
    vel: new THREE.Vector3(vx, vy, -0.4),
    q: new THREE.Quaternion(Math.random()-.5, Math.random()-.5, Math.random()-.5, 1).normalize(),
    av: new THREE.Vector3((Math.random()-.5)*62, (Math.random()-.5)*62, (Math.random()-.5)*38),
    settled: false, sf: 0, tf: 0, tv
  };
}
function _launchPhys(vxS, vyS, d1, d2) {
  _ensurePhys();
  const spd = Math.sqrt(vxS*vxS + vyS*vyS);
  const sc = Math.min(Math.max(spd, 0.25), 3.0) * 2.5;
  const bvx = vxS * sc * 0.45;
  const bvy = Math.max(-vyS * sc, 0.8);
  // Start the two dice at clearly different X and Y so they land separately
  _physState = {
    d1, d2, done: false,
    p: [
      _mkBody(-0.12, -FIELD_HALF_W * 0.22, bvx - 0.26, bvy * 0.92, d1),
      _mkBody( 0.12, -FIELD_HALF_W * 0.08, bvx + 0.26, bvy * 1.08, d2)
    ]
  };
  _physMeshes[0].visible = true; _physMeshes[1].visible = true;
}
function _stepPhysDice() {
  if (!_physState) return;
  // Once done and finished sliding there's nothing left to do
  if (_physState.done && !_physState.sliding) return;
  const DT = 0.016;

  // ── Sliding phase: lerp both dice toward their center-bar rest positions ──
  if (_physState.done && _physState.sliding) {
    let allArrived = true;
    _physState.p.forEach((d, i) => {
      const tgt = _physState.restTargets[i];
      d.pos.lerp(tgt, 0.08);
      _physMeshes[i].position.copy(d.pos);
      if (d.pos.distanceTo(tgt) > 0.001) allArrived = false;
    });
    if (allArrived) {
      // Snap exactly to targets and stop
      _physState.p.forEach((d, i) => {
        d.pos.copy(_physState.restTargets[i]);
        _physMeshes[i].position.copy(d.pos);
      });
      _physState.sliding = false;
      // Apply green tint now that dice are in their final resting positions
      _applyGreenTints();
    }
    return;
  }

  // ── Physics simulation ────────────────────────────────────────────────────
  _physState.p.forEach((d, i) => {
    if (d.settled) return;
    d.tf++;
    // Gravity
    d.vel.z -= 9.81 * DT;
    d.pos.x += d.vel.x * DT; d.pos.y += d.vel.y * DT; d.pos.z += d.vel.z * DT;
    // Floor bounce
    if (d.pos.z < _DIE_FLRZ) {
      d.pos.z = _DIE_FLRZ;
      if (d.vel.z < 0) {
        d.vel.z = -d.vel.z * _DIE_REST;
        d.vel.x *= (1 - _DIE_FRIC); d.vel.y *= (1 - _DIE_FRIC);
        d.av.multiplyScalar(0.78);
      }
    }
    // Wall bounces
    if (d.pos.x >  _DIE_WALL) { d.pos.x =  _DIE_WALL; d.vel.x = -Math.abs(d.vel.x)*0.52; }
    if (d.pos.x < -_DIE_WALL) { d.pos.x = -_DIE_WALL; d.vel.x =  Math.abs(d.vel.x)*0.52; }
    if (d.pos.y >  _DIE_WALL) { d.pos.y =  _DIE_WALL; d.vel.y = -Math.abs(d.vel.y)*0.52; }
    if (d.pos.y < -_DIE_WALL) { d.pos.y = -_DIE_WALL; d.vel.y =  Math.abs(d.vel.y)*0.52; }
    // Angular momentum
    const onFloor = d.pos.z <= _DIE_FLRZ + 0.003;
    d.av.multiplyScalar(onFloor ? 0.93 : 0.999);
    const aSpd = d.av.length();
    if (aSpd > 0.02) {
      const dq = new THREE.Quaternion().setFromAxisAngle(d.av.clone().divideScalar(aSpd), aSpd * DT);
      d.q.multiplyQuaternions(dq, d.q).normalize();
    }
    // Settle only after minimum tumble duration AND both linear + angular slow
    const lSpd = Math.sqrt(d.vel.x*d.vel.x + d.vel.y*d.vel.y + d.vel.z*d.vel.z);
    if (onFloor && lSpd < 0.07 && aSpd < 1.4 && d.tf >= _DIE_MIN_FRAMES) {
      if (++d.sf >= 38) {
        d.settled = true; d.pos.z = _DIE_FLRZ;
        d.vel.set(0,0,0); d.av.set(0,0,0); d.q.copy(_settleQ(d.tv));
      }
    } else d.sf = 0;
    _physMeshes[i].position.copy(d.pos);
    _physMeshes[i].quaternion.copy(d.q);
  });
  // Die-die collision: sphere repulsion prevents overlap
  const A = _physState.p[0], B = _physState.p[1];
  if (!A.settled || !B.settled) {
    const dx = B.pos.x - A.pos.x, dy = B.pos.y - A.pos.y, dz = B.pos.z - A.pos.z;
    const dist2 = dx*dx + dy*dy + dz*dz;
    const minD = _DIE_HALF * 2.25;
    if (dist2 > 0.000001 && dist2 < minD*minD) {
      const dist = Math.sqrt(dist2);
      const pen = (minD - dist) * 0.5;
      const nx = dx/dist, ny = dy/dist;
      if (!A.settled) { A.pos.x -= nx*pen; A.pos.y -= ny*pen; A.vel.x -= nx*0.22; A.vel.y -= ny*0.22; }
      if (!B.settled) { B.pos.x += nx*pen; B.pos.y += ny*pen; B.vel.x += nx*0.22; B.vel.y += ny*0.22; }
    }
  }
  // Both settled → fire result and start slide to center bar
  if (_physState.p[0].settled && _physState.p[1].settled && !_physState.done) {
    _physState.done = true;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'dice_result', die1: _physState.d1, die2: _physState.d2 })
    );
    // Rest targets: both dice side by side at dead center of the board
    _physState.restTargets = [
      new THREE.Vector3(-_DIE_HALF * 1.6, 0, _DIE_FLRZ),
      new THREE.Vector3( _DIE_HALF * 1.6, 0, _DIE_FLRZ)
    ];
    _physState.sliding = true;
  }
}

function handleTap(clientX, clientY) {
  // Force camera matrix current BEFORE building the ray — gyro updates rotation
  // every animate() frame; without this the ray uses the previous frame's matrix.
  camera.updateMatrixWorld(true);
  // Force boardGroup world matrix current before worldToLocal conversion.
  boardGroup.updateWorldMatrix(true, true);

  const rect = renderer.domElement.getBoundingClientRect();
  const nx =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  const ny = -((clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

  const hits = raycaster.intersectObject(hitPlane, false);
  if (!hits.length) return;
  // Convert world hit point → boardGroup local space
  const lp = boardGroup.worldToLocal(hits[0].point.clone());

  // ── Nardi (backgammon) point detection ──────────────────────────────────
  // Constants must match arPieces computation in NardiScreen (BHW=0.305, BAR≈0.026)
  var N_BHW = 0.305;
  var N_BAR = N_BHW * 2 * 0.085 / 2;   // ≈ 0.026m
  var N_PTW = (N_BHW - N_BAR) / 7;      // ≈ 0.0399m per column
  if (Math.abs(lp.x) <= N_BHW && Math.abs(lp.y) <= N_BHW) {
    var nIsTop  = lp.y > 0;
    var nIsLeft = lp.x < 0;
    var nCol;
    if (nIsLeft) {
      nCol = Math.round((lp.x + N_BHW) / N_PTW - 1.5);
    } else {
      nCol = Math.round((lp.x - N_BAR) / N_PTW - 0.5);
    }
    nCol = Math.max(0, Math.min(5, nCol));
    var nPoint1Based;
    if (nIsLeft && nIsTop)   nPoint1Based = nCol + 13;  // 13-18
    else if (nIsLeft)        nPoint1Based = 12 - nCol;  // 12-7
    else if (nIsTop)         nPoint1Based = nCol + 19;  // 19-24
    else                     nPoint1Based = 6 - nCol;   // 6-1
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nardi_tap', point: nPoint1Based - 1 }));
    }
  }

  // ── Chess / generic grid tap ─────────────────────────────────────────────
  // Clamp to field bounds before flooring so border taps land on edge squares
  const clampedX = Math.max(-FIELD_HALF_W + 0.001, Math.min(FIELD_HALF_W - 0.001, lp.x));
  const clampedY = Math.max(-FIELD_HALF_H + 0.001, Math.min(FIELD_HALF_H - 0.001, lp.y));
  const col = Math.floor((clampedX + FIELD_HALF_W) / SQUARE_W);
  const row = Math.floor((FIELD_HALF_H - clampedY) / SQUARE_H);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap', row, col }));
    }
  }
}
// Pinch-to-zoom: scales sceneGroup uniformly so the board gets bigger/smaller
// regardless of whether it is frozen in world space or camera-attached.
// Spreading fingers = board grows; pinching = shrinks.
var _pinchStartDist = 0;
var _pinchBaseZoom = 1.0; // committed scale at start of each gesture
document.addEventListener('touchstart', function(e) {
  if (e.touches.length === 2) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    _pinchStartDist = Math.sqrt(dx * dx + dy * dy);
    _pinchBaseZoom = _boardZoom; // lock in current scale
  } else if (e.touches.length === 1 && e.changedTouches.length > 0) {
    handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
}, { passive: true });
document.addEventListener('touchmove', function(e) {
  if (e.touches.length === 2 && _pinchStartDist > 0) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var ratio = dist / _pinchStartDist; // >1 = spreading = zoom in
    _boardZoom = Math.max(0.3, Math.min(4.0, _pinchBaseZoom * ratio));
    boardGroup.scale.setScalar(_boardZoom);
  }
}, { passive: true });
document.addEventListener('touchend', function(e) {
  if (e.touches.length < 2) _pinchStartDist = 0;
}, { passive: true });

// ── Procedural fallback board ─────────────────────────────────────────────────
function buildProceduralBoard() {
  if (BOARD_STYLE === 'poker') {
    // ── Oval poker table ────────────────────────────────────────────────────
    var SEGS = 64;
    var RX = BOARD_HALF_W * 0.62;   // felt semi-axis X (narrow — skinny end faces camera)
    var RY = BOARD_HALF_H;          // felt semi-axis Y (deep — long side runs depth)
    var RAIL_W = 0.06;              // wood rail width
    var T = BOARD_THICKNESS;

    // Sub-group so we can spin the whole table without touching boardGroup
    // 90° + 180° = 270° = -90° around Z
    var pokerGroup = new THREE.Group();
    pokerGroup.rotation.z = Math.PI * 1.5;
    boardGroup.add(pokerGroup);

    // Helper: array of Vector2 points on an ellipse
    function ellipsePoints(rx, ry, n) {
      var pts = [];
      for (var _i = 0; _i <= n; _i++) {
        var a = (_i / n) * Math.PI * 2;
        pts.push(new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * ry));
      }
      return pts;
    }

    // 1. Dark wood base slab
    pokerGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry((RX + RAIL_W + 0.01) * 2, (RY + RAIL_W + 0.01) * 2, T),
      new THREE.MeshStandardMaterial({ color: 0x2e1204, roughness: 0.80, metalness: 0.06 })
    ));

    // 2. Wood rail ring (outer ellipse shape with inner hole)
    var railShape = new THREE.Shape(ellipsePoints(RX + RAIL_W, RY + RAIL_W, SEGS));
    var feltHole  = new THREE.Path(ellipsePoints(RX, RY, SEGS));
    railShape.holes.push(feltHole);
    var railGeo  = new THREE.ShapeGeometry(railShape, SEGS);
    var railMesh = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x6b2f0e, roughness: 0.58, metalness: 0.18 }));
    railMesh.position.z = T * 0.5 + 0.004;
    pokerGroup.add(railMesh);

    // 3. Green felt surface with canvas texture
    var feltShape = new THREE.Shape(ellipsePoints(RX, RY, SEGS));
    var feltGeo   = new THREE.ShapeGeometry(feltShape, SEGS);
    var fc = document.createElement('canvas'); fc.width = 512; fc.height = 512;
    var fctx = fc.getContext('2d');
    fctx.fillStyle = '#1d5c1d'; fctx.fillRect(0, 0, 512, 512);
    // Subtle diagonal felt grain
    fctx.strokeStyle = 'rgba(255,255,255,0.03)'; fctx.lineWidth = 1;
    for (var fi = -512; fi < 1024; fi += 14) {
      fctx.beginPath(); fctx.moveTo(fi, 0); fctx.lineTo(fi + 512, 512); fctx.stroke();
    }
    // Betting area oval line
    fctx.strokeStyle = 'rgba(255,255,255,0.12)'; fctx.lineWidth = 4;
    fctx.beginPath(); fctx.ellipse(256, 256, 116, 160, 0, 0, Math.PI * 2); fctx.stroke();
    var feltTex = new THREE.CanvasTexture(fc);
    feltTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var feltMesh = new THREE.Mesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95, metalness: 0 }));
    feltMesh.position.z = T * 0.5 + 0.002;
    pokerGroup.add(feltMesh);
    return;
  }

  // ── Plain wooden plinth — no chess pattern ─────────────────────────────────
  const THICKNESS = BOARD_THICKNESS;
  boardGroup.add(new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_HALF_W*2+0.04, BOARD_HALF_H*2+0.04, THICKNESS),
    new THREE.MeshStandardMaterial({ color:0x3b2206, roughness:0.75, metalness:0.06 })
  ));
}

// ── Load GLB assets ─────────────────────────────────────────────────────────────────
const BOARD_URI  = ${BOARD_URI_JS};
const PIECES_URI = ${PIECES_URI_JS};
const CHESS_PIECE_URIS = ${CHESS_PIECE_URIS_JS};
const CARD_URI = ${CARD_URI_JS};
const CARD_BACK_URI = ${CARD_BACK_URI_JS};
// Use Google's Draco CDN with JS-only decoder to avoid WASM/Worker issues in WKWebView
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.setDecoderConfig({ type: 'js' });
const loader     = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

function _rnLog(msg) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', msg }));
  }
}

_rnLog('[AR3D-HTML] module running. BOARD_URI=' + (BOARD_URI ? BOARD_URI.substring(0,80) : 'null') + ' PIECES_URI=' + (PIECES_URI ? 'set' : 'null') + ' CARD_URI=' + (CARD_URI ? 'set' : 'null'));

// ── Load BOARD
if (BOARD_URI) {
  _gateStart(); // board GLB is one asset to wait for
  var _boardDone = false;
  var _boardTimer = setTimeout(function() {
    if (!_boardDone) {
      _boardDone = true;
      _rnLog('[AR3D-HTML] Board GLB timed out after 120s, using procedural fallback');
      buildProceduralBoard();
      _gateDoneOne();
    }
  }, 120000);
  loader.load(BOARD_URI, (gltf) => {
    const model = gltf.scene;
    const rawBox  = new THREE.Box3().setFromObject(model);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const isXYFlat = ${BOARD_GLB_FORCE_FLAT_JS} || rawSize.z < Math.min(rawSize.x, rawSize.y) * 0.25;
    // XY-flat (e.g. octagon_table.glb): surface normal is +Z in model space.
    //   boardGroup.rotation.x=-π/2 maps boardGroup +Z → world +Y (up).
    //   So model normal must stay as boardGroup +Z → model.rotation.x = 0.
    // Y-up (e.g. casino_table_level2_textured.glb): +Y is up in model space.
    //   Rx(+π/2) maps model +Y → boardGroup +Z → world +Y. ✓
    model.rotation.x = isXYFlat ? 0 : Math.PI / 2;
    model.rotation.z = isXYFlat ? Math.PI / 2 : 0;
    model.updateMatrixWorld(true);
    const box    = new THREE.Box3().setFromObject(model);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Use the largest horizontal dimension for scale; the thin/height dimension is much smaller.
    const scale  = (BOARD_HALF_W * 2) / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const box2   = new THREE.Box3().setFromObject(model);
    const ctr2   = box2.getCenter(new THREE.Vector3());
    // In both conventions the playing surface is the top face (box2.max.z in boardGroup local Z).
    // Center in XY and position so the top face sits flush at Z=0 of boardGroup.
    model.position.set(-ctr2.x, -ctr2.y, -box2.max.z + 0.001);
    const BOARD_COLOR_OVERRIDE = ${BOARD_COLOR_OVERRIDE_JS};
    model.traverse(ch => {
      if (ch.isMesh) {
        ch.receiveShadow = true;
        const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(m => {
          if (m) {
            if (BOARD_COLOR_OVERRIDE) {
              m.color = new THREE.Color(BOARD_COLOR_OVERRIDE);
              m.map = null;
              m.roughness = 0.6;
              m.metalness = 0.1;
            } else {
              m.roughness = Math.max((m.roughness||0.5)*0.8, 0.35);
            }
            m.side = THREE.DoubleSide; // visible regardless of face orientation
            // Enable anisotropic filtering on all textures — prevents blur at oblique angles
            const texSlots = ['map','normalMap','roughnessMap','metalnessMap','aoMap'];
            texSlots.forEach(slot => {
              const tex = m[slot];
              if (tex && !BOARD_COLOR_OVERRIDE) {
                tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                tex.needsUpdate = true;
              }
            });
            m.needsUpdate = true;
          }
        });
      }
    });

    // Hide pre-placed checker pieces and embedded dice baked into the GLB.
    // The Backgammon material uses alphaMode:MASK so these sub-objects (e.g.
    // BoardRight.005–BoardRight.035, BoardLeft.005–BoardLeft.035,
    // Dice1.001–Dice1.002) show through the transparent areas of the board
    // texture as tan/beige discs at checker positions.
    model.traverse(ch => {
      if (/^(Board[A-Za-z]*|Dice\d*)\.\d/.test(ch.name || '')) {
        ch.visible = false;
      }
    });

    boardGroup.add(model);

    // ── Backgammon point triangles (canvas texture plane) ───────────────
    if (BOARD_STYLE === 'backgammon') {
      var _bgCvs = document.createElement('canvas');
      _bgCvs.width = 1024; _bgCvs.height = 1024;
      var _bgCtx = _bgCvs.getContext('2d');
      var _BW = 1024, _BH = 1024;
      var _bar = Math.round(_BW * 0.085); // center bar ~8.5% of width
      var _playW = (_BW - _bar) / 2;     // each playing half-width
      var _ptW = _playW / 6;             // one triangle point width
      var _ptH = _BH * 0.44;            // triangle height (44% of board height)
      var _dark = '#7B1C2E';            // dark maroon
      var _lite = '#C8963A';            // gold/amber
      // Top row — 12 triangles pointing DOWN
      for (var _ti = 0; _ti < 12; _ti++) {
        var _thalf = _ti < 6 ? 0 : 1;
        var _tidx  = _ti < 6 ? _ti : _ti - 6;
        _bgCtx.fillStyle = _ti % 2 === 0 ? _dark : _lite;
        var _tx = _thalf === 0 ? _tidx * _ptW : _playW + _bar + _tidx * _ptW;
        _bgCtx.beginPath();
        _bgCtx.moveTo(_tx,          0);
        _bgCtx.lineTo(_tx + _ptW,   0);
        _bgCtx.lineTo(_tx + _ptW/2, _ptH);
        _bgCtx.closePath();
        _bgCtx.fill();
      }
      // Bottom row — 12 triangles pointing UP
      for (var _bi = 0; _bi < 12; _bi++) {
        var _bhalf = _bi < 6 ? 0 : 1;
        var _bidx  = _bi < 6 ? _bi : _bi - 6;
        _bgCtx.fillStyle = _bi % 2 === 0 ? _lite : _dark;
        var _bx = _bhalf === 0 ? _bidx * _ptW : _playW + _bar + _bidx * _ptW;
        _bgCtx.beginPath();
        _bgCtx.moveTo(_bx,          _BH);
        _bgCtx.lineTo(_bx + _ptW,   _BH);
        _bgCtx.lineTo(_bx + _ptW/2, _BH - _ptH);
        _bgCtx.closePath();
        _bgCtx.fill();
      }
      var _bgTex = new THREE.CanvasTexture(_bgCvs);
      _bgTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var _bgMat = new THREE.MeshBasicMaterial({ map: _bgTex, transparent: true, depthWrite: false });
      var _bgGeo = new THREE.PlaneGeometry(BOARD_HALF_W * 2, BOARD_HALF_H * 2);
      var _bgMesh = new THREE.Mesh(_bgGeo, _bgMat);
      _bgMesh.position.z = 0.003; // just above GLB surface
      boardGroup.add(_bgMesh);
    }

    // ── Raised checkerboard platform ─────────────────────────────────────
    if (!HIDE_CHECKERBOARD) {
    // Black marble plinth that runs full height of the board + the raise,
    // so the checkerboard surface looks inset/elevated above the border frame.
    // boardGroup is XZ-horizontal (rotation.x=-PI/2), so local Z = world up.
    //
    // Board Z extents in boardGroup local space:
    //   bottom = -BOARD_THICKNESS/2
    //   top    = +BOARD_THICKNESS/2   (the GLB surface)
    //   raised = +BOARD_THICKNESS/2 + FIELD_RAISE  (checkerboard face)
    //
    // Plinth spans from bottom of board all the way up to checkerboard face.
    const _boardBottom = -BOARD_THICKNESS / 2;
    const _raisedTop   = BOARD_THICKNESS / 2 + FIELD_RAISE;
    const _plinthH     = _raisedTop - _boardBottom;  // full height
    const _plinthZ     = _boardBottom + _plinthH / 2; // centre Z

    // 1) Black marble plinth — full-height slab, sides all visible
    const _woodMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.25, metalness: 0.45 });
    const _slabGeo = new THREE.BoxGeometry(FIELD_HALF_W * 2, FIELD_HALF_H * 2, _plinthH);
    const _slabMesh = new THREE.Mesh(_slabGeo, _woodMat);
    _slabMesh.position.set(0, 0, _plinthZ);
    _slabMesh.receiveShadow = true;
    boardGroup.add(_slabMesh);

    // 2) Checkerboard plane — sits exactly on top of the slab, no sides
    const _cvs = document.createElement('canvas');
    _cvs.width = 512; _cvs.height = 512;
    const _ctx = _cvs.getContext('2d');
    const _sqPx = 512 / 8;
    for (let _r = 0; _r < 8; _r++) {
      for (let _c = 0; _c < 8; _c++) {
        _ctx.fillStyle = (_r + _c) % 2 === 0 ? '#c8b484' : '#5a3010';
        _ctx.fillRect(_c * _sqPx, _r * _sqPx, _sqPx, _sqPx);
      }
    }
    const _tex = new THREE.CanvasTexture(_cvs);
    _tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const _topMat = new THREE.MeshStandardMaterial({ map: _tex, roughness: 0.55, metalness: 0.04 });
    const _topGeo = new THREE.PlaneGeometry(FIELD_HALF_W * 2, FIELD_HALF_H * 2);
    const _topMesh = new THREE.Mesh(_topGeo, _topMat);
    _topMesh.position.set(0, 0, _raisedTop + 0.0001); // just above plinth top
    _topMesh.receiveShadow = true;
    boardGroup.add(_topMesh);
    } // end !HIDE_CHECKERBOARD

    // GLB loaded successfully — cancel the procedural fallback timer
    clearTimeout(_boardTimer); _boardDone = true;
    _rnLog('[AR3D-HTML] Board GLB loaded OK.');
    _gateDoneOne();
  }, (xhr) => {
    if (xhr.total > 0) {
      _rnLog('[AR3D-HTML] Board GLB progress: ' + Math.round(xhr.loaded/xhr.total*100) + '%');
    }
  }, (err) => {
    clearTimeout(_boardTimer); _boardDone = true;
    _rnLog('[AR3D-HTML] Board GLB FAILED: ' + (err && err.message ? err.message : String(err)));
    buildProceduralBoard();
    _gateDoneOne();
  });
} else {
  buildProceduralBoard();
  // No board GLB — board is immediately ready (procedural is synchronous)
  _gateStart(); _gateDoneOne();
}

// ── Board surface image plane ─────────────────────────────────────────
const BOARD_SURFACE_IMAGE_URI = ${BOARD_SURFACE_IMAGE_URI_JS};
if (BOARD_SURFACE_IMAGE_URI) {
  var _sImgLoader = new THREE.TextureLoader();
  _sImgLoader.load(BOARD_SURFACE_IMAGE_URI, function(_sImgTex) {
    _sImgTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var _sImgMat = new THREE.MeshBasicMaterial({ map: _sImgTex, transparent: false, depthWrite: true });
    var _sImgGeo = new THREE.PlaneGeometry(BOARD_HALF_W * 2, BOARD_HALF_H * 2);
    var _sImgMesh = new THREE.Mesh(_sImgGeo, _sImgMat);
    _sImgMesh.position.z = 0.004; // just above board GLB surface
    boardGroup.add(_sImgMesh);
    _rnLog('[AR3D-HTML] Board surface image loaded OK.');
  }, undefined, function(_sErr) {
    _rnLog('[AR3D-HTML] Board surface image failed: ' + String(_sErr));
  });
}

// ── Procedural fallback piece ─────────────────────────────────────────────────
function makeFallbackPiece(color, isKing) {
  const clr = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
  const g   = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.5, 0.22, 48),
    new THREE.MeshStandardMaterial({
      color: clr,
      metalness: isKing ? 0.82 : 0.18,
      roughness: isKing ? 0.10 : 0.52,
      emissive: new THREE.Color(isKing ? clr : 0x000000),
      emissiveIntensity: isKing ? 0.20 : 0,
    })
  );
  body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 48),
    new THREE.MeshStandardMaterial({ color: isKing ? 0xf0c830 : clr, metalness: isKing ? 0.92 : 0.10, roughness: isKing ? 0.07 : 0.38 })
  );
  top.position.y = 0.112; top.rotation.x = -Math.PI/2;
  g.add(top);
  if (isKing) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.045, 8, 48),
      new THREE.MeshStandardMaterial({ color:0xf5c842, metalness:0.95, roughness:0.05 })
    );
    ring.rotation.x = Math.PI/2; ring.position.y = 0.108; ring.castShadow = true;
    g.add(ring);
  }
  // Rotate so cylinder axis aligns with boardGroup local Z → world Y (up).
  // boardGroup.rotation.x = -PI/2, so this cancels it: piece stands flat on board.
  g.rotation.x = Math.PI / 2;
  return g;
}

function makeFallbackChessPiece(color, pieceType, isKing) {
  const clr = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
  const gold = 0xf5c842;
  const material = new THREE.MeshStandardMaterial({
    color: clr,
    metalness: 0.35,
    roughness: 0.42,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: gold,
    metalness: 0.92,
    roughness: 0.08,
  });
  const group = new THREE.Group();

  const addBase = () => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.16, 40), material.clone());
    base.castShadow = true;
    group.add(base);
    return 0.08;
  };

  const topY = addBase();

  if (pieceType === 'pawn') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.42, 28), material.clone());
    stem.position.y = topY + 0.20;
    stem.castShadow = true;
    group.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), material.clone());
    head.position.y = topY + 0.48;
    head.castShadow = true;
    group.add(head);
  } else if (pieceType === 'rook') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 28), material.clone());
    tower.position.y = topY + 0.30;
    tower.castShadow = true;
    group.add(tower);
    for (let i = 0; i < 4; i++) {
      const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.10), material.clone());
      const angle = (i / 4) * Math.PI * 2;
      crenel.position.set(Math.cos(angle) * 0.23, topY + 0.64, Math.sin(angle) * 0.23);
      crenel.castShadow = true;
      group.add(crenel);
    }
  } else if (pieceType === 'knight') {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.40, 20), material.clone());
    neck.position.y = topY + 0.20;
    neck.castShadow = true;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.16), material.clone());
    head.position.y = topY + 0.52;
    head.rotation.z = -0.35;
    head.castShadow = true;
    group.add(head);
  } else if (pieceType === 'bishop') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.60, 28), material.clone());
    body.position.y = topY + 0.28;
    body.castShadow = true;
    group.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), material.clone());
    cap.position.y = topY + 0.62;
    cap.castShadow = true;
    group.add(cap);
  } else if (pieceType === 'queen') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.66, 32), material.clone());
    body.position.y = topY + 0.30;
    body.castShadow = true;
    group.add(body);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 28), accentMaterial.clone());
    crown.position.y = topY + 0.70;
    crown.rotation.x = Math.PI / 2;
    crown.castShadow = true;
    group.add(crown);
  } else if (pieceType === 'king') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.27, 0.72, 32), material.clone());
    body.position.y = topY + 0.32;
    body.castShadow = true;
    group.add(body);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.06), accentMaterial.clone());
    vertical.position.y = topY + 0.78;
    vertical.castShadow = true;
    group.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), accentMaterial.clone());
    horizontal.position.y = topY + 0.78;
    horizontal.castShadow = true;
    group.add(horizontal);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.60, 32), material.clone());
    body.position.y = topY + 0.28;
    body.castShadow = true;
    group.add(body);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 24), material.clone());
    cone.position.y = topY + 0.64;
    cone.castShadow = true;
    group.add(cone);
  }

  if (isKing && pieceType !== 'king') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), accentMaterial.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.castShadow = true;
    group.add(ring);
  }

  group.rotation.x = Math.PI / 2;
  return group;
}

// ── Load GLB pieces (generic + per-chess-piece overrides) ─────────────────────
let basePieceScene = null;
const baseChessPieceScenes = {};
// Track pending pieces to place once GLB loads
let pendingPiecesUpdate = null;

function invalidatePieceCache() {
  Object.keys(pieceState).forEach(key => {
    delete pieceState[key];
  });
}

function normalizePieceModel(model) {
  // Compute world-space bounds BEFORE any scale change (respects embedded GLB scales)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  // Centre the model horizontally and lift it so its bottom sits at y=0
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  // Wrap in a Group that normalises the whole thing to a 1-unit cube.
  // updatePieces will scale this wrapper — the inner model's own transforms are untouched.
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(1 / maxDim);
  wrapper.userData.normMaxDim = maxDim;  // remember native size for exact-metre scaling
  return wrapper;
}

// ── Helper: load a map of {pieceKey: uri} entries, deduplicating by URI ──────
function loadChessPieceUris(uriMap) {
  // Group keys by their URI to avoid loading the same file multiple times
  var uriToKeys = {};
  Object.entries(uriMap).forEach(function(entry) {
    var pieceKey = entry[0]; var pieceUri = entry[1];
    if (!pieceUri) return;
    if (!uriToKeys[pieceUri]) uriToKeys[pieceUri] = [];
    uriToKeys[pieceUri].push(pieceKey);
  });
  var uriList = Object.keys(uriToKeys);
  var loadedCount = 0;
  uriList.forEach(function(pieceUri) {
    var pieceKeys = uriToKeys[pieceUri];
    _rnLog('[AR3D] loading piece GLB: ' + pieceKeys[0] + ' from ' + pieceUri.substring(0, 80));
    loader.load(pieceUri, function(gltf) {
      var normalized = normalizePieceModel(gltf.scene);
      pieceKeys.forEach(function(k) { baseChessPieceScenes[k] = normalized; });
      loadedCount++;
      _rnLog('[AR3D] piece GLB loaded OK: ' + pieceKeys[0] + ' (' + loadedCount + '/' + uriList.length + ')');
      if (loadedCount === uriList.length) {
        // All piece GLBs ready — update once so pieces appear all at once, no fallback→GLB flash
        invalidatePieceCache();
        updatePieces(window._pieces || []);
        _gateDoneOne(); // release the single gate token registered for the chessPiece batch
      }
    }, undefined, function(err) {
      _rnLog('[AR3D] piece GLB FAILED: ' + pieceKeys[0] + ' err=' + (err && err.message ? err.message : String(err)));
      // Count failures too so remaining pieces still render
      loadedCount++;
      if (loadedCount === uriList.length) {
        invalidatePieceCache();
        updatePieces(window._pieces || []);
        _gateDoneOne();
      }
    });
  });
}
// Load any URIs baked into the HTML at build time.
// Count these as gate assets so pieces wait for piece GLBs before appearing.
var _chessPieceUriList = Object.values(CHESS_PIECE_URIS || {}).filter(function(v,i,a){ return v && a.indexOf(v)===i; });
if (_chessPieceUriList.length > 0) {
  // Register each unique URI as a gate asset; loadChessPieceUris will call
  // _gateDoneOne when ALL of them are done (it already has a loaded-count check).
  _gateStart(); // one gate token for the entire chessPiece batch
}
loadChessPieceUris(CHESS_PIECE_URIS || {});

if (PIECES_URI) {
  _gateStart();
  loader.load(PIECES_URI, (gltf) => {
    basePieceScene = normalizePieceModel(gltf.scene);
    invalidatePieceCache();
    // Flush pending update — fall back to window._pieces if no explicit queue
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
    _gateDoneOne();
  }, undefined, () => {
    // Pieces GLB failed — clonePiece() will use fallback geometry
    console.warn('[AR3DOverlay] pieces GLB load failed, using procedural discs');
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
    _gateDoneOne();
  });
}

// Safety valve: if nothing was registered to load (no board GLB, no piece GLBs),
// open the gate now so the board is immediately visible.
if (_gateNeeded === 0) {
  _gateStart(); _gateDoneOne();
}

function clonePiece(piece) {
  const color = piece.color;
  const isKing = piece.isKing;
  const chessKey = piece.side && piece.pieceType ? (piece.side + '_' + piece.pieceType) : null;
  const sourceScene = chessKey ? baseChessPieceScenes[chessKey] : basePieceScene;
  if (!sourceScene) {
    // Chess pieces: return null (hide until GLB is ready — avoids fallback→GLB flash)
    if (chessKey) return null;
    return makeFallbackPiece(color, isKing);
  }

  const pieceColor = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
  // Clone the wrapper group returned by normalizePieceModel (deep clone preserves inner scale)
  const clone = sourceScene.clone(true);
  // Chess pieces need rotation.x = π/2 to cancel boardGroup's -π/2 and stand upright in world.
  // Disc pieces (bg_checker, checker) should lay FLAT on the board surface — no rotation cancellation needed.
  const isCheckerDisc = piece.pieceType === 'bg_checker' || piece.pieceType === 'checker';
  clone.rotation.x = isCheckerDisc ? 0 : Math.PI / 2;

  clone.traverse(ch => {
    if (!ch.isMesh) return;
    ch.castShadow = true;
    const origMats = Array.isArray(ch.material) ? ch.material : [ch.material];
    const newMats  = origMats.map(m => {
      const nm = m.clone();
      nm.color.setHex(pieceColor);
      if (isKing) {
        nm.metalness = 0.82;
        nm.roughness = 0.10;
        nm.emissive  = new THREE.Color(pieceColor);
        nm.emissiveIntensity = 0.22;
      } else {
        nm.metalness = 0.18;
        nm.roughness = 0.52;
      }
      return nm;
    });
    ch.material = Array.isArray(ch.material) ? newMats : newMats[0];
  });

  return clone;
}

// ── Load GLB card template (optional) ─────────────────────────────────────────
let baseCardScene = null;

function normalizeCardModel(model) {
  const normalized = model.clone(true);

  // Ensure thin axis is Z so card lays flat in boardGroup local XY plane.
  const preBox = new THREE.Box3().setFromObject(normalized);
  const preSize = preBox.getSize(new THREE.Vector3());
  const thinAxis = (preSize.x <= preSize.y && preSize.x <= preSize.z)
    ? 'x'
    : (preSize.y <= preSize.x && preSize.y <= preSize.z ? 'y' : 'z');
  if (thinAxis === 'x') normalized.rotation.y = Math.PI / 2;
  else if (thinAxis === 'y') normalized.rotation.x = -Math.PI / 2;
  normalized.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(normalized);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const sx = CARD_W / Math.max(size.x, 0.001);
  const sy = CARD_H / Math.max(size.y, 0.001);
  const s = Math.min(sx, sy);
  normalized.scale.setScalar(s);
  normalized.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(normalized);
  const ctr2 = box2.getCenter(new THREE.Vector3());
  normalized.position.set(-ctr2.x, -ctr2.y, -ctr2.z);
  normalized.updateMatrixWorld(true);

  return normalized;
}

if (CARD_URI) {
  loader.load(CARD_URI, (gltf) => {
    baseCardScene = normalizeCardModel(gltf.scene);
    updateCards(window._cards || []);
  }, undefined, (err) => {
    baseCardScene = null;
    console.warn('[AR3DOverlay] card GLB load failed, using procedural cards:', err && err.message ? err.message : String(err));
  });
}

// ── CARD RENDERING (procedural — no GLB needed) ───────────────────────────────
// Cards are flat PlaneGeometry quads with a CanvasTexture showing suit + rank.
// This avoids GLB loading failures and gives sharp, readable cards in AR.

// Card scene group — parented to boardGroup so positions are board-relative
const cardGroup = new THREE.Group();
boardGroup.add(cardGroup);

// ─── Card dimensions — bigger so rank/suit is clearly readable on the 3D table ─
// ─── Card dimensions ──────────────────────────────────────────────────────────
// Bigger than a real card so they read clearly on the 3D table from phone distance
// ─── Card dimensions ──────────────────────────────────────────────────────────
// ─── Card dimensions ──────────────────────────────────────────────────────────
const CARD_W = 0.16;
const CARD_H = 0.22;

const SUIT_COLORS_3D = { hearts:'#cc0000', diamonds:'#cc0000', clubs:'#111111', spades:'#111111' };

const _cardTextureCache = new Map();

// ── Canvas rounded-rect path helper ──────────────────────────────────────────
function _rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);         ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
  ctx.lineTo(x+w,   y+h-r);     ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r,   y+h);       ctx.quadraticCurveTo(x,   y+h, x,   y+h-r);
  ctx.lineTo(x,     y+r);       ctx.quadraticCurveTo(x,   y,   x+r, y);
  ctx.closePath();
}

// ── Suit shape drawers — pure canvas paths, zero unicode/font dependency ──────
// Heart: two circles + triangle, all joined into one clean shape
function _drawHeart(ctx, cx, cy, size, color) {
  var s = size * 0.5;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  // Start at bottom tip
  ctx.moveTo(cx, cy + s);
  // Left arc (bottom-left curve up to top-left bump)
  ctx.bezierCurveTo(
    cx - s*0.1, cy + s*0.6,
    cx - s,     cy + s*0.3,
    cx - s,     cy - s*0.1
  );
  // Left top bump (circle-like arc)
  ctx.bezierCurveTo(
    cx - s,     cy - s*0.7,
    cx - s*0.1, cy - s*0.8,
    cx,         cy - s*0.4
  );
  // Right top bump
  ctx.bezierCurveTo(
    cx + s*0.1, cy - s*0.8,
    cx + s,     cy - s*0.7,
    cx + s,     cy - s*0.1
  );
  // Right arc (top-right down to bottom tip)
  ctx.bezierCurveTo(
    cx + s,     cy + s*0.3,
    cx + s*0.1, cy + s*0.6,
    cx,         cy + s
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _drawDiamond(ctx, cx, cy, size, color) {
  var s = size * 0.52;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx,     cy - s);
  ctx.lineTo(cx + s*0.65, cy);
  ctx.lineTo(cx,     cy + s);
  ctx.lineTo(cx - s*0.65, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _drawClub(ctx, cx, cy, size, color) {
  var r = size * 0.28;
  ctx.save();
  ctx.fillStyle = color;
  // Three overlapping circles
  ctx.beginPath(); ctx.arc(cx,         cy - r*0.55, r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - r*0.8, cy + r*0.3,  r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r*0.8, cy + r*0.3,  r, 0, Math.PI*2); ctx.fill();
  // Stem + base
  ctx.beginPath();
  ctx.moveTo(cx - r*0.55, cy + r*1.1);
  ctx.lineTo(cx + r*0.55, cy + r*1.1);
  ctx.lineTo(cx + r*0.2,  cy + r*0.5);
  ctx.lineTo(cx - r*0.2,  cy + r*0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Spade: upside-down heart head + stem
function _drawSpade(ctx, cx, cy, size, color) {
  var s = size * 0.46;
  var headY = cy - size * 0.08; // shift head slightly up
  ctx.save();
  ctx.fillStyle = color;
  // Spade head = inverted heart
  ctx.beginPath();
  ctx.moveTo(cx, headY - s);
  ctx.bezierCurveTo(
    cx - s*0.1, headY - s*0.6,
    cx - s,     headY - s*0.3,
    cx - s,     headY + s*0.1
  );
  ctx.bezierCurveTo(
    cx - s,     headY + s*0.7,
    cx - s*0.1, headY + s*0.8,
    cx,         headY + s*0.4
  );
  ctx.bezierCurveTo(
    cx + s*0.1, headY + s*0.8,
    cx + s,     headY + s*0.7,
    cx + s,     headY + s*0.1
  );
  ctx.bezierCurveTo(
    cx + s,     headY - s*0.3,
    cx + s*0.1, headY - s*0.6,
    cx,         headY - s
  );
  ctx.closePath();
  ctx.fill();
  // Stem
  ctx.beginPath();
  ctx.moveTo(cx - s*0.55, cy + size*0.42);
  ctx.lineTo(cx + s*0.55, cy + size*0.42);
  ctx.lineTo(cx + s*0.18, cy + size*0.1);
  ctx.lineTo(cx - s*0.18, cy + size*0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _drawSuit(ctx, suit, cx, cy, size) {
  var color = SUIT_COLORS_3D[suit] || '#111';
  if      (suit === 'hearts')   _drawHeart(ctx, cx, cy, size, color);
  else if (suit === 'diamonds') _drawDiamond(ctx, cx, cy, size, color);
  else if (suit === 'clubs')    _drawClub(ctx, cx, cy, size, color);
  else                          _drawSpade(ctx, cx, cy, size, color);
}

// ── Card face painter ─────────────────────────────────────────────────────────
function _paintCardFace(ctx, W, H, suit, rank) {
  var color = SUIT_COLORS_3D[suit] || '#111';

  // White card with rounded corners
  ctx.save();
  _rrPath(ctx, 0, 0, W, H, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  // ── Top-left: rank text ──
  ctx.fillStyle = color;
  ctx.font = 'bold 160px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 36, 20);

  // ── Top-left: small suit shape ──
  _drawSuit(ctx, suit, 82, 310, 100);

  // ── Centre: large suit shape ──
  _drawSuit(ctx, suit, W/2, H/2, 280);

  // ── Bottom-right: mirrored (rotate 180°) ──
  ctx.save();
  ctx.translate(W, H);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.font = 'bold 160px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 36, 20);
  ctx.restore();
  _drawSuit(ctx, suit, W - 82, H - 310, 100);

  // ── Inner border ──
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 8;
  _rrPath(ctx, 8, 8, W-16, H-16, 52);
  ctx.stroke();

  ctx.restore();
}

function _paintCardBack(ctx, W, H) {
  ctx.save();
  _rrPath(ctx, 0, 0, W, H, 60);
  ctx.fillStyle = '#0d1b4b';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 2;
  for (var i = -(H+W); i < W+H; i += 22) {
    ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+H,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i+H,0); ctx.lineTo(i,H); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 7;
  _rrPath(ctx, 18, 18, W-36, H-36, 44);
  ctx.stroke();
  ctx.restore();
}

// ── Texture builder ───────────────────────────────────────────────────────────
function makeCardTexture(suit, rank, faceDown, opts) {
  var imageUri = faceDown ? ((opts||{}).cardBackImageUri || CARD_BACK_URI || '') : ((opts||{}).backgroundImageUri||'');
  var cacheKey = ['v3', faceDown ? '__back__' : suit+'-'+rank, (opts||{}).font||'', imageUri].join('|');
  if (_cardTextureCache.has(cacheKey)) return _cardTextureCache.get(cacheKey);

  var W = 1024, H = 1434;
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  if (faceDown) { _paintCardBack(ctx, W, H); }
  else          { _paintCardFace(ctx, W, H, suit, rank); }

  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cardTextureCache.set(cacheKey, tex);

  if (imageUri) {
    var img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(img,0,0,W,H);
      if (!faceDown) _paintCardFace(ctx,W,H,suit,rank);
      tex.needsUpdate = true;
    };
    img.src = imageUri;
  }
  return tex;
}

// ── Mesh builder ──────────────────────────────────────────────────────────────
// Card = two PlaneGeometry quads (face + back) with depthTest:false so they
// always render on top of the table regardless of depth buffer state.
function makeCardMesh(suit, rank, faceDown, opts) {
  // faceDown=true → back design faces up (+Z = toward viewer from above)
  var faceUpTex  = makeCardTexture(suit, rank, false, opts);
  var faceDownTex = makeCardTexture(suit, rank, true,  opts);
  var frontTex = faceDown ? faceDownTex : faceUpTex;   // +Z face (viewed from above)
  var backTex  = faceDown ? faceUpTex   : faceDownTex; // -Z face (viewed from below)
  var aniso = renderer.capabilities.getMaxAnisotropy();
  frontTex.anisotropy = aniso; frontTex.needsUpdate = true;
  backTex.anisotropy  = aniso; backTex.needsUpdate  = true;

  var group = new THREE.Group();
  var geo   = new THREE.PlaneGeometry(CARD_W, CARD_H);

  // White card body slab (slightly larger, renders under the face quads)
  var slab = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W + 0.004, CARD_H + 0.004, 0.008),
    new THREE.MeshBasicMaterial({ color: 0xf8f4ec, depthTest: false })
  );
  slab.renderOrder = 996;
  group.add(slab);

  // Front face
  var front = new THREE.Mesh(geo,
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: false, depthTest: false }));
  front.position.z = 0.005;
  front.renderOrder = 999;
  group.add(front);

  // Back face (flipped)
  var back = new THREE.Mesh(geo,
    new THREE.MeshBasicMaterial({ map: backTex, transparent: false, depthTest: false }));
  back.rotation.y = Math.PI;
  back.position.z = -0.005;
  back.renderOrder = 998;
  group.add(back);

  // Gold border ring — makes the card unmissable
  var border = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W + 0.012, CARD_H + 0.012),
    new THREE.MeshBasicMaterial({ color: 0xd4af37, depthTest: false })
  );
  border.position.z = 0.003;
  border.renderOrder = 997;
  group.add(border);

  group.renderOrder = 995;
  return group;
}


const _cardMeshMap = new Map();

function updateCards(cards) {
  _rnLog('[AR3D] updateCards count=' + (cards ? cards.length : 0) + (cards && cards[0] ? ' pos0='+JSON.stringify(cards[0].position) : ''));
  // Always clear all existing card meshes so new hands always show fresh cards.
  _cardMeshMap.forEach(grp => cardGroup.remove(grp));
  _cardMeshMap.clear();
  if (!cards || cards.length === 0) return;
  cards.forEach(card => {
    const cd = card.cardData || {};
    const { suit='spades', rank='A', faceDown=false,
            backgroundImageUri, cardBackImageUri, font } = cd;
    var grp = makeCardMesh(suit, rank, faceDown, { font, backgroundImageUri, cardBackImageUri });
    grp.userData.cardKey = card.key;
    cardGroup.add(grp);
    _cardMeshMap.set(card.key, grp);
    grp.position.set(card.position.x, card.position.y, card.position.z);
    if (card.rotation) grp.rotation.set(card.rotation.x||0, card.rotation.y||0, card.rotation.z||0);
    var s = card.scale !== undefined ? card.scale : 1;
    grp.scale.set(s, s, s);
  });
}

// ── Floating player label sprites ─────────────────────────────────────────────
const _labelMap = new Map();
const labelGroup = new THREE.Group();
boardGroup.add(labelGroup);

function makePlayerLabel(name, chips, active, folded) {
  var cw = 256, ch = 96;
  var canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  var ctx = canvas.getContext('2d');
  // Background pill
  var alpha = folded ? 0.4 : 0.85;
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = active ? 'rgba(255,200,0,' + alpha + ')' : 'rgba(20,20,20,' + alpha + ')';
  var r = 18;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(cw-r, 0); ctx.quadraticCurveTo(cw, 0, cw, r);
  ctx.lineTo(cw, ch-r); ctx.quadraticCurveTo(cw, ch, cw-r, ch);
  ctx.lineTo(r, ch); ctx.quadraticCurveTo(0, ch, 0, ch-r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath(); ctx.fill();
  // Name
  ctx.fillStyle = active ? '#111' : '#fff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, cw/2, 38);
  // Chips
  ctx.fillStyle = active ? '#333' : '#FFD700';
  ctx.font = '22px Arial';
  ctx.fillText(chips, cw/2, 68);
  if (folded) {
    ctx.fillStyle = 'rgba(255,80,80,0.85)';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('FOLDED', cw/2, 88);
  }
  var tex = new THREE.CanvasTexture(canvas);
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  var sprite = new THREE.Sprite(mat);
  var aspect = cw / ch;
  sprite.scale.set(0.14 * aspect, 0.14, 1);
  return sprite;
}

function updateLabels(labels) {
  _labelMap.forEach(s => labelGroup.remove(s));
  _labelMap.clear();
  if (!labels || labels.length === 0) return;
  labels.forEach(function(lbl) {
    var sprite = makePlayerLabel(lbl.name, lbl.chips, lbl.active, lbl.folded);
    sprite.position.set(lbl.position.x, lbl.position.y, (lbl.position.z || 0) + 0.18);
    labelGroup.add(sprite);
    _labelMap.set(lbl.key, sprite);
  });
}

// ── Piece management ──────────────────────────────────────────────────────────
const pieceMeshes = {};
const pieceState  = {};
const _badgeMeshes = {};  // key → { sprite, canvas } for stack overflow badges

function boardToLocal(row, col) {
  // GLB board (HIDE_CHECKERBOARD=true): surface sits at boardGroup local z≈0 — place piece base just above.
  // Procedural board: surface is at BOARD_THICKNESS/2, piece needs to clear that.
  const surfaceZ = HIDE_CHECKERBOARD ? 0.002 : (BOARD_THICKNESS / 2 + 0.010 + FIELD_RAISE);
  return [
    -FIELD_HALF_W + (col + 0.5) * SQUARE_W,
     FIELD_HALF_H - (row + 0.5) * SQUARE_H,
     surfaceZ,
  ];
}

function updatePieces(pieces) {
  // If the asset gate isn't open yet, save the latest pieces and wait.
  if (!_gateOpen) {
    _gatePendingPieces = pieces;
    return;
  }
  // If pieces GLB is still loading, defer
  if (PIECES_URI && !basePieceScene) {
    pendingPiecesUpdate = pieces;
    return;
  }

  const incoming = {};
  pieces.forEach(p => { incoming[p.key] = p; });

  // ── Badge sprites (stack overflow count indicators) ──────────────────────
  // Remove stale badges
  for (const k of Object.keys(_badgeMeshes)) {
    if (!incoming[k]) {
      boardGroup.remove(_badgeMeshes[k].sprite);
      _badgeMeshes[k].sprite.material.map.dispose();
      _badgeMeshes[k].sprite.material.dispose();
      delete _badgeMeshes[k];
    }
  }
  // Create/update badges for stack_badge pieces
  for (const p of pieces) {
    if (p.pieceType !== 'stack_badge') continue;
    if (!_badgeMeshes[p.key]) {
      var bc = document.createElement('canvas'); bc.width = 72; bc.height = 72;
      var btex = new THREE.CanvasTexture(bc);
      var bspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, transparent: true, depthTest: false, depthWrite: false }));
      bspr.scale.set(0.038, 0.038, 1);
      boardGroup.add(bspr);
      _badgeMeshes[p.key] = { sprite: bspr, canvas: bc };
    }
    var bm = _badgeMeshes[p.key];
    var ctx2 = bm.canvas.getContext('2d');
    ctx2.clearRect(0, 0, 72, 72);
    ctx2.fillStyle = 'rgba(0,0,0,0.82)';
    ctx2.beginPath(); ctx2.arc(36, 36, 30, 0, Math.PI * 2); ctx2.fill();
    ctx2.strokeStyle = p.side === 'white' ? '#e05555' : '#8888cc';
    ctx2.lineWidth = 3; ctx2.stroke();
    ctx2.fillStyle = '#ffffff';
    ctx2.font = 'bold 28px sans-serif';
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    ctx2.fillText(String(p.stackCount || '?'), 36, 37);
    bm.sprite.material.map.needsUpdate = true;
    bm.sprite.position.set(p.posX, p.posY, p.posZ !== undefined ? p.posZ : 0.06);
  }

  // ── Regular piece meshes ──────────────────────────────────────────────────
  for (const k of Object.keys(pieceMeshes)) {
    if (!incoming[k] || incoming[k].pieceType === 'stack_badge') {
      boardGroup.remove(pieceMeshes[k]);
      delete pieceMeshes[k];
      delete pieceState[k];
    }
  }

  for (const p of pieces) {
    if (p.pieceType === 'stack_badge') continue; // handled above
    const prev = pieceState[p.key];
    if (
      !prev ||
      prev.color !== p.color ||
      prev.isKing !== p.isKing ||
      prev.pieceType !== p.pieceType ||
      prev.side !== p.side
    ) {
      if (pieceMeshes[p.key]) boardGroup.remove(pieceMeshes[p.key]);
      const newMesh = clonePiece(p);
      if (!newMesh) {
        delete pieceMeshes[p.key];
        delete pieceState[p.key]; // don't cache — rebuild when GLB arrives
        continue;
      }
      pieceMeshes[p.key] = newMesh;
      boardGroup.add(pieceMeshes[p.key]);
      pieceState[p.key] = {
        color: p.color,
        isKing: p.isKing,
        pieceType: p.pieceType,
        side: p.side,
      };
    }

    const mesh  = pieceMeshes[p.key];
    if (!mesh) continue;
    const isDirectPos = (p.posX !== undefined && p.posX !== null);
    const loc = isDirectPos
      ? [p.posX, p.posY, (p.posZ !== undefined && p.posZ !== null) ? p.posZ : 0.005]
      : boardToLocal(p.row, p.col);
    const lift  = p.isSelected ? 0.08 : 0;
    const isChessPiece = !!(p.pieceType && p.side);
    const scale = (p.pieceScale !== undefined && p.pieceScale !== null)
      ? p.pieceScale
      : (p.isSelected ? PIECE_SCALE * 1.12 : PIECE_SCALE);
    mesh.position.set(loc[0], loc[1], loc[2] + lift);
    if (p.pieceScale !== undefined && p.pieceScale !== null) {
      // pieceScale is the desired physical size in metres.
      // After normalizePieceModel, setScalar(s) renders at s * normMaxDim metres,
      // so divide by normMaxDim to get exactly pieceScale metres.
      const nmd = mesh.userData.normMaxDim || 1;
      mesh.scale.setScalar(scale / nmd);
    } else if (isChessPiece) {
      mesh.scale.setScalar(scale * 0.92);
    } else {
      // Checker-style fallback discs stay flattened.
      mesh.scale.set(scale, scale * 0.35, scale);
    }
  }
}

// ── Possible-move dots ────────────────────────────────────────────────────────
const dotMeshes = [];
const dotGeo    = new THREE.CircleGeometry(SQUARE_W * 0.25, 20);
const dotMat    = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.60, side:THREE.DoubleSide });

function updateDots(moves) {
  dotMeshes.forEach(d => boardGroup.remove(d));
  dotMeshes.length = 0;
  for (const m of (moves||[])) {
    const d = new THREE.Mesh(dotGeo, dotMat);
    const loc = boardToLocal(m.row, m.col);
    // Place dots at same z as hitPlane so visual and tap positions align exactly.
    d.position.set(loc[0], loc[1], SURFACE_Z);
    dotMeshes.push(d);
    boardGroup.add(d);
  }
}

// ── RN bridge ────────────────────────────────────────────────────────────────
// Replace the early-queuing stub with the real handler, then flush any
// messages that arrived while Three.js was loading.
const _rnQueuedMessages = window._rnMsgQueue || [];
window._rnMsgQueue = null;
window.handleRNMessage = function(data) {
  if (!data || !data.type) return;
  if (data.type === 'spawn') {
    // Rotate sceneGroup so its -Z axis aligns with player's initial facing direction.
    // Camera forward at yaw Y is (sin(Y*DEG), 0, -cos(Y*DEG)); sceneGroup -Z after
    // rotation.y = -Y*DEG gives the same direction.
    sceneGroup.rotation.y = -data.yaw * DEG;
  }
  if (data.type === 'loadPieces') {
    // Inject piece URIs after downloads complete — no WebView remount needed.
    loadChessPieceUris(data.uris || {});
  }
  if (data.type === 'scene') {
    window._pieces = data.pieces || [];
    window._cards = data.cards || [];
    updatePieces(window._pieces);
    updateDots(data.moves || []);
    updateCards(window._cards);
    updateLabels(data.labels || []);
  }
  if (data.type === 'scale') {
    _boardZoom = Math.max(0.4, Math.min(3.0, data.value));
    boardGroup.scale.setScalar(_boardZoom);
  }
  if (data.type === 'recenter') {
    // Re-attach sceneGroup to camera so it tracks the player again,
    // then let the freeze countdown re-fire to lock it in the new direction.
    if (_frozen) {
      // Preserve world matrix when re-parenting back to camera
      camera.updateMatrixWorld(true);
      sceneGroup.updateMatrixWorld(true);
      const _wp = new THREE.Vector3();
      const _wq = new THREE.Quaternion();
      const _ws = new THREE.Vector3();
      sceneGroup.matrixWorld.decompose(_wp, _wq, _ws);
      scene.remove(sceneGroup);
      camera.add(sceneGroup);
      // Reset sceneGroup to its original camera-local position (centered ahead)
      sceneGroup.position.set(0, 0, 0);
      sceneGroup.rotation.set(0, 0, 0);
      sceneGroup.scale.set(1, 1, 1);
      boardGroup.scale.setScalar(_boardZoom); // preserve current pinch zoom
      _frozen = false;
      _freezeCountdown = 8;
    }
  }
  if (data.type === 'roll_dice') {
    _resetDiceTint();
    _launchPhys(data.vx || 0, data.vy || -1, data.die1 || 1, data.die2 || 1);
  }
  if (data.type === 'use_die') {
    _ensureTintPlanes();
    if (!_physState || !_tintPlanes) return;
    const isDoubles = data.isDoubles;
    const rem = data.movesRemaining; // remaining AFTER this move
    // Reposition tint planes — use final rest targets when available (most reliable),
    // fall back to current physics pos if dice haven't settled yet.
    [0,1].forEach(function(i) {
      var tgt = (_physState.restTargets && _physState.restTargets[i]) ? _physState.restTargets[i] : _physState.p[i].pos;
      _tintPlanes[i].position.set(tgt.x, tgt.y, _DIE_FLRZ + _DIE_HALF + 0.001);
      // Ensure planes are at least visible (opacity may still be 0 if dice haven't settled)
      if (!_tintPlanes[i].visible && _tintPlanes[i].material.color.getHex() !== 0xff3322) {
        _setDieTint(i, 0x00dd55, 0.38);
      }
    });
    if (isDoubles) {
      // Doubles = 4 moves total; each physical die represents 2 uses.
      // Keep green while the die still has a remaining use; turn red when fully consumed.
      // rem=3 (move 1 done): die0 used once, 1 more use → stay green
      // rem=2 (move 2 done): die0 both uses consumed → die0 red
      // rem=1 (move 3 done): die1 used once, 1 more use → stay green
      // rem=0 (move 4 done): die1 both uses consumed → die1 red
      if (rem === 2) {
        _setDieTint(0, 0xff3322, 0.52);
      } else if (rem === 0) {
        _setDieTint(1, 0xff3322, 0.52);
      }
      // rem===3 or rem===1: die still has a use left — leave green
    } else {
      // Normal (non-doubles): turn the first still-green die whose face value matches red
      for (var i = 0; i < 2; i++) {
        if (_physState.p[i].tv === data.value && _tintPlanes[i].material.color.getHex() !== 0xff3322) {
          _setDieTint(i, 0xff3322, 0.52);
          break;
        }
      }
    }
  }
  if (data.type === 'reset_dice_tint') {
    _resetDiceTint();
  }
  if (data.type === 'update_borne_off') {
    _updatePocket('white', data.white || 0);
    _updatePocket('black', data.black || 0);
  }
};
// Flush messages that arrived before Three.js finished loading.
_rnQueuedMessages.forEach(function(d) { window.handleRNMessage(d); });
function onMsg(e) { try { window.handleRNMessage(JSON.parse(e.data)); } catch(_){} }
window.addEventListener('message',  onMsg);
document.addEventListener('message', onMsg);

// ── Animation loop ────────────────────────────────────────────────────────────
let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.016;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = -window._att.yaw   * DEG;
  camera.rotation.x = -window._att.pitch * DEG - 0.60; // ~34° downward — see full board
  camera.rotation.z =  window._att.roll  * DEG;

  // Freeze: detach sceneGroup from camera → world space, preserving world matrix.
  // Must call camera.updateMatrixWorld(true) FIRST — Three.js only computes
  // matrixWorld during renderer.render(), so on early frames it is stale/identity.
  // Also wait _freezeCountdown frames so live gyro injectJavaScript has fired.
  if (!_frozen) {
    if (_freezeCountdown > 0) {
      _freezeCountdown--;
    } else {
      _frozen = true;
      camera.updateMatrixWorld(true); // ← force camera matrix from current rotation
      const _wp = new THREE.Vector3();
      const _wq = new THREE.Quaternion();
      const _ws = new THREE.Vector3();
      sceneGroup.matrixWorld.decompose(_wp, _wq, _ws);
      camera.remove(sceneGroup);
      scene.add(sceneGroup);
      sceneGroup.position.set(_wp.x, 0, _wp.z); // keep XZ placement, reset Y to eye level
      // Only preserve yaw (Y rotation) — strip pitch & roll so table stays level/upright
      const _euler = new THREE.Euler().setFromQuaternion(_wq, 'YXZ');
      _euler.x = 0;
      _euler.z = 0;
      sceneGroup.quaternion.setFromEuler(_euler);
      sceneGroup.scale.copy(_ws);
    }
  }

  // Float selected pieces (local Z → world Y via boardGroup rotation)
  for (const [k, mesh] of Object.entries(pieceMeshes)) {
    if (window._pieces.some && window._pieces.some(p => p.key===k && p.isSelected)) {
      mesh.position.z += Math.sin(t * 3.5) * 0.0005;
    }
  }
  _stepPhysDice();
  renderer.render(scene, camera);
  // After the very first frame, tell React Native the canvas is transparent.
  if (!animate._readySent) {
    animate._readySent = true;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'ar3d_ready'}));
    }
  }
}
animate();

window.addEventListener('resize', () => {
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
});
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AR3DOverlay = forwardRef<AR3DOverlayHandle, AR3DOverlayProps>(function AR3DOverlay({
  visible = true,
  pieces = [],
  moves  = [],
  cards  = [],
  arLabels = [],
  fov = 75,
  boardGlbPath,
  piecesGlbPath,
  chessPieceGlbPaths,
  tableGlbPath,
  cardGlbPath,
  cardBackTexturePath,
  onSquareTap,
  onNardiPointTap,
  onDiceRolled,
  pieceColorRed   = '#c0392b',
  pieceColorBlack = '#1e2d3d',
  hideCheckerboard = false,
  boardScale = 1.0,
  boardStyle = 'default',
  boardY = -0.80,
  boardGlbForceFlat = false,
  boardTiltX = 0,
  boardColorOverride,
  boardSurfaceImagePath,
  tableDist,
}: AR3DOverlayProps, ref: React.Ref<AR3DOverlayHandle>) {
  const attitude = useAttitude();
  const webViewRef = useRef<WebView>(null);
  const renderKey = useRef(0); // Force re-render on demand

  useImperativeHandle(ref, () => ({
    recenter() {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'recenter'});true;`
      );
    },
    setScale(scale: number) {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'scale',value:${scale}});true;`
      );
    },
    rollDiceOnBoard(vx: number, vy: number, die1: number, die2: number) {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'roll_dice',vx:${vx},vy:${vy},die1:${die1},die2:${die2}});true;`
      );
    },
    useDieTint(value: number, movesRemaining: number, isDoubles: boolean) {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'use_die',value:${value},movesRemaining:${movesRemaining},isDoubles:${isDoubles}});true;`
      );
    },
    resetDiceTint() {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'reset_dice_tint'});true;`
      );
    },
    updateBorneOff(white: number, black: number) {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'update_borne_off',white:${white},black:${black}});true;`
      );
    },
  }));
  
  // Increment key when visible changes from false to true (new AR session)
  useEffect(() => {
    if (visible) {
      renderKey.current += 1;
    }
  }, [visible]);

  // Always tracks the latest yaw between renders
  const latestYawRef = useRef(attitude.yaw);
  latestYawRef.current = attitude.yaw;

  // spawnYaw: set the moment AR turns on, baked into the HTML, reset on hide
  const [spawnYaw, setSpawnYaw] = useState<number | null>(null);
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSpawnYaw(latestYawRef.current);
    }
    if (!visible) {
      setSpawnYaw(null); // reset so next enable recaptures fresh direction
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // ── Copy bundled Three.js files to temp dir once on mount ─────────────────
  // Use CDN for Three.js — null means "use CDN" in buildSceneHTML
  const localThreePath: string | null = null;
  const localGltfPath:  string | null = null;

  const [boardUri,  setBoardUri]  = useState<string | null | undefined>(boardGlbPath  ? undefined : null);
  const [boardSurfaceImageUri, setBoardSurfaceImageUri] = useState<string | null | undefined>(boardSurfaceImagePath ? undefined : null);
  const [piecesUri, setPiecesUri] = useState<string | null | undefined>(piecesGlbPath ? undefined : null);
  const [chessPieceUris, setChessPieceUris] = useState<Record<string, string | null>>({});
  const [tableUri,  setTableUri]  = useState<string | null | undefined>(tableGlbPath  ? undefined : null);
  const [cardUri,   setCardUri]   = useState<string | null | undefined>(cardGlbPath   ? undefined : null);
  const [cardBackUri, setCardBackUri] = useState<string | null | undefined>(cardBackTexturePath ? undefined : null);

  useEffect(() => {
    if (!boardGlbPath) { setBoardUri(null); return; }
    let cancelled = false;
    resolveAssetUri(boardGlbPath).then(u => { if (!cancelled) setBoardUri(u); });
    return () => { cancelled = true; };
  }, [boardGlbPath]);

  useEffect(() => {
    if (!boardSurfaceImagePath) { setBoardSurfaceImageUri(null); return; }
    let cancelled = false;
    resolveAssetUri(boardSurfaceImagePath).then(u => { if (!cancelled) setBoardSurfaceImageUri(u); });
    return () => { cancelled = true; };
  }, [boardSurfaceImagePath]);

  useEffect(() => {
    if (!piecesGlbPath) { setPiecesUri(null); return; }
    let cancelled = false;
    resolveAssetUri(piecesGlbPath).then(u => { if (!cancelled) setPiecesUri(u); });
    return () => { cancelled = true; };
  }, [piecesGlbPath]);

  // Resolve chess piece URIs.
  // DEV:  Use the Metro HTTP URL directly — Image.resolveAssetSource() returns the
  //       correct LAN-IP URL.  The WebView fetches it via XHR (allowUniversalAccessFromFileURLs).
  //       This is synchronous and avoids a fragile 240 MB RNFS download step.
  // PROD: Fall back to resolveAssetUri() which copies from the app bundle.
  useEffect(() => {
    if (!chessPieceGlbPaths) {
      setChessPieceUris({});
      return;
    }
    const entries = Object.entries(chessPieceGlbPaths).filter(([, path]) => !!path) as [string, string][];

    if (__DEV__) {
      // Synchronous — no download needed.
      const resolvedMap: Record<string, string | null> = {};
      entries.forEach(([pieceKey, path]) => {
        const assetRef = GLB_ASSET_MAP[path];
        const metroUrl = assetRef ? (Image.resolveAssetSource(assetRef)?.uri ?? null) : null;
        resolvedMap[pieceKey] = metroUrl;
      });
      setChessPieceUris(resolvedMap);
      return;
    }

    // Production: copy each unique file from the bundle once, then fan out.
    let cancelled = false;
    const uniquePaths = [...new Set(entries.map(([, p]) => p))];
    Promise.all(
      uniquePaths.map(async (path) => {
        const uri = await resolveAssetUri(path);
        return [path, uri] as const;
      })
    ).then(pathResults => {
      if (cancelled) return;
      const pathToUri: Record<string, string | null> = {};
      pathResults.forEach(([path, uri]) => { pathToUri[path] = uri; });
      const resolvedMap: Record<string, string | null> = {};
      entries.forEach(([pieceKey, path]) => { resolvedMap[pieceKey] = pathToUri[path] ?? null; });
      setChessPieceUris(resolvedMap);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(chessPieceGlbPaths)]);

  useEffect(() => {
    if (!tableGlbPath) { setTableUri(null); return; }
    let cancelled = false;
    resolveAssetUri(tableGlbPath).then(u => { if (!cancelled) setTableUri(u); });
    return () => { cancelled = true; };
  }, [tableGlbPath]);

  useEffect(() => {
    if (!cardGlbPath) { setCardUri(null); return; }
    let cancelled = false;
    resolveAssetUri(cardGlbPath).then(u => { if (!cancelled) setCardUri(u); });
    return () => { cancelled = true; };
  }, [cardGlbPath]);

  useEffect(() => {
    if (!cardBackTexturePath) { setCardBackUri(null); return; }
    let cancelled = false;
    resolveAssetUri(cardBackTexturePath).then(u => { if (!cancelled) setCardBackUri(u); });
    return () => { cancelled = true; };
  }, [cardBackTexturePath]);

  // Debug: trace all blocking state so we can see exactly where the HTML build stalls
  useEffect(() => {
  }, [boardUri, piecesUri, chessPieceUris, cardUri, cardBackUri, spawnYaw]);

  // Build HTML once all required URIs have resolved.
  // Returning null while boardUri OR chessPieceUris are still loading prevents a
  // partial WebView build that would force a remount when they resolve.
  // Chess piece URIs are BAKED into CHESS_PIECE_URIS so Three.js starts loading them
  // immediately on module init — no post-load injection or race condition.
  const htmlString = useMemo(() => {
    if (spawnYaw === null) return null;
    if (boardUri    === undefined) return null;
    if (boardSurfaceImageUri === undefined) return null;
    if (piecesUri   === undefined) return null;
    if (tableUri    === undefined) return null;
    if (cardUri     === undefined) return null;
    if (cardBackUri === undefined) return null;
    // If chessPieceGlbPaths was provided but URIs haven't resolved yet, wait.
    if (chessPieceGlbPaths && Object.keys(chessPieceGlbPaths).length > 0
        && Object.keys(chessPieceUris).length === 0) return null;
    const redInt  = parseInt(pieceColorRed.replace(/^#/, ''), 16);
    const blackInt = parseInt(pieceColorBlack.replace(/^#/, ''), 16);
    const result = buildSceneHTML(
      fov, boardUri, piecesUri, chessPieceUris, tableUri, spawnYaw,
      redInt, blackInt, cardUri, cardBackUri,
      localThreePath, localGltfPath, hideCheckerboard, boardScale, boardStyle,
      boardY, boardGlbForceFlat, boardTiltX, boardColorOverride ?? null, boardSurfaceImageUri ?? null,
      tableDist ?? null,
    );
    return result;
  }, [fov, boardUri, boardSurfaceImageUri, piecesUri, chessPieceUris, tableUri, spawnYaw, cardUri, cardBackUri, hideCheckerboard, boardScale, boardStyle, boardY, boardGlbForceFlat, boardTiltX, boardColorOverride, tableDist]);

  // Write the HTML to a temp file and give WebView a file:// URI.
  // WKWebView.loadHTMLString silently fails on iOS with large strings (>5 MB).
  // WKWebView.loadFileURL has no such limit.
  const htmlFileUriKeyRef = useRef(0);
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  useEffect(() => {
    if (!htmlString) { setHtmlFileUri(null); return; }
    // Use a unique filename per session so WKWebView never serves a cached version.
    // Same URL = cached HTML = stale spawnYaw baked in = locked rotation on game 2+.
    const sessionId = htmlFileUriKeyRef.current;
    htmlFileUriKeyRef.current += 1;
    const filePath = `${RNFS.TemporaryDirectoryPath}ar_scene_${sessionId}_${Date.now()}.html`;
    RNFS.writeFile(filePath, htmlString, 'utf8')
      .then(() => {
        setWebviewReady(false); // hide until new page loads
        setHtmlFileUri(`file://${filePath}`);
      })
      .catch(e => console.warn('[AR3DOverlay] failed to write scene HTML:', e));
  }, [htmlString]);

  // Push gyro attitude at ~60fps
  useEffect(() => {
    if (!visible || !htmlFileUri) return;
    webViewRef.current?.injectJavaScript(
      `window._att={yaw:${attitude.yaw.toFixed(4)},pitch:${attitude.pitch.toFixed(4)},roll:${attitude.roll.toFixed(4)}};true;`,
    );
  }, [attitude.yaw, attitude.pitch, attitude.roll, visible, htmlFileUri]);

  // Keep latest pieces/moves in a ref so onLoadEnd can access them without stale closure
  const latestPiecesRef = useRef(pieces);
  const latestMovesRef  = useRef(moves);
  const latestCardsRef  = useRef(cards);
  const latestLabelsRef = useRef(arLabels);
  const latestChessPieceUrisRef = useRef(chessPieceUris);
  
  latestPiecesRef.current = pieces;
  latestMovesRef.current  = moves;
  latestCardsRef.current  = cards;
  latestLabelsRef.current = arLabels;
  latestChessPieceUrisRef.current = chessPieceUris;

  // Push board state on every piece/move change
  useEffect(() => {
    if (!visible || !htmlFileUri) return;
    console.log('[AR3DOverlay] pushing scene — cards:', cards?.length ?? 0, 'pieces:', pieces?.length ?? 0);
    const msg = JSON.stringify({type: 'scene', pieces, moves, cards, labels: arLabels});
    webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
  }, [pieces, moves, cards, arLabels, visible, htmlFileUri]);

  // Re-send pieces once the WebView has finished loading (Three.js CDN async import).
  // The useEffect above may fire before handleRNMessage is registered, so this
  // guarantees pieces appear after the module script has run.
  // Retry every 500ms for up to 5s in case the pieces GLB CDN import is still loading.
  const handleLoadEnd = useCallback(() => {
    // Don't reveal WebView here — Three.js CDN import is still in-flight.
    // We wait for the ar3d_ready postMessage instead (after first renderer.render).
    const sendScene = () => {
      const msg = JSON.stringify({
        type: 'scene',
        pieces: latestPiecesRef.current,
        moves:  latestMovesRef.current,
        cards:  latestCardsRef.current,
        labels: latestLabelsRef.current,
      });
      webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
    };
    sendScene();
    const retryDelays = [500, 1000, 1500, 2500, 4000];
    retryDelays.forEach(delay => setTimeout(sendScene, delay));
  }, []);

  // Handle messages posted from Three.js (raycasted board taps)
  const handleMessage = useCallback((event: {nativeEvent: {data: string}}) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'tap' && onSquareTap) {
        onSquareTap(data.row, data.col);
      } else if (data.type === 'nardi_tap' && onNardiPointTap) {
        onNardiPointTap(data.point);
      } else if (data.type === 'dice_result' && onDiceRolled) {
        onDiceRolled(data.die1, data.die2);
      } else if (data.type === 'ar3d_ready') {
        setWebviewReady(true); // Three.js rendered first transparent frame
      } else if (data.type === 'log') {
        console.warn('[AR3D WebView]', data.msg);
      }
    } catch (_) {}
  }, [onSquareTap, onNardiPointTap, onDiceRolled]);

  if (!visible || !htmlFileUri) return null;

  return (
    // box-none: wrapper does not capture touches but WebView child does
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <WebView
        key={htmlFileUri} // Unique file URL per session = WebView always remounts with fresh spawnYaw
        ref={webViewRef}
        source={{ uri: htmlFileUri }}
        style={[styles.webview, !webviewReady && styles.webviewHidden]}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        allowingReadAccessToURL="file:///"
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onContentProcessDidTerminate={() => {
          console.warn('[AR3DOverlay] WebView process terminated, reloading...');
          webViewRef.current?.reload();
        }}
        onError={e => console.warn('[AR3DOverlay] WebView error:', JSON.stringify(e.nativeEvent))}
        onHttpError={e => console.warn('[AR3DOverlay] WebView HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url)}
        onShouldStartLoadWithRequest={req =>
          req.url === 'about:blank' ||
          req.url.startsWith('http') ||
          req.url.startsWith('data:') ||
          req.url.startsWith('file:')
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
  webviewHidden: { opacity: 0 },
});

export default AR3DOverlay;
