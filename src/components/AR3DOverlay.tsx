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

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ARPiece {
  key: string;
  row: number;
  col: number;
  color: 'red' | 'black';
  isKing: boolean;
  isSelected?: boolean;
  pieceType?: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
  side?: 'white' | 'black';
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
}

export interface AR3DOverlayProps {
  visible?: boolean;
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
  chessPieceGlbPaths?: Partial<Record<
    | 'white_pawn' | 'white_knight' | 'white_bishop' | 'white_rook' | 'white_queen' | 'white_king'
    | 'black_pawn' | 'black_knight' | 'black_bishop' | 'black_rook' | 'black_queen' | 'black_king',
    string
  >>;
  /**
   * Path relative to assets/ folder for the park table GLB.
   * e.g. "glb/park/tableCoffeeGlassSquare.glb"
   * Table is placed at the centre of the 360° sphere; board sits on top of it.
   * Falls back to a simple procedural table if omitted or if load fails.
   */
  tableGlbPath?: string;
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
  /** Scale multiplier for the board/table size (default 1.0). Use >1 for card-game tables. */
  boardScale?: number;
  /** Style of the procedural fallback board. 'poker' = oval green felt table. Default: 'default' (chess/checkers). */
  boardStyle?: string;
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
  'glb/game assets/round_table.glb':            require('../../assets/glb/game assets/round_table.glb'),
  'glb/game assets/octagon_table.glb':          require('../../assets/glb/game assets/octagon_table.glb'),
  'glb/game assets/poker_table2.glb':            require('../../assets/glb/game assets/poker_table2.glb'),
  'glb/game assets/casino_table_level2_textured.glb': require('../../assets/glb/game assets/casino_table_level2_textured.glb'),
  'glb/chess/chess-board/source/ui.glb':        require('../../assets/glb/chess/chess-board/source/ui.glb'),
  'glb/chess/chess-board/source/armenian_board.glb': require('../../assets/glb/chess/chess-board/source/armenian_board.glb'),
  'glb/chess/pieces/white_pawn.glb':            require('../../assets/glb/chess/pieces/white_pawn.glb'),
  'glb/chess/pieces/white_knight.glb':          require('../../assets/glb/chess/pieces/white_knight.glb'),
  'glb/chess/pieces/white_bishop.glb':          require('../../assets/glb/chess/pieces/white_bishop.glb'),
  'glb/chess/pieces/white_rook.glb':            require('../../assets/glb/chess/pieces/white_rook.glb'),
  'glb/chess/pieces/white_queen.glb':           require('../../assets/glb/chess/pieces/white_queen.glb'),
  'glb/chess/pieces/white_king.glb':            require('../../assets/glb/chess/pieces/white_king.glb'),
  'glb/chess/pieces/black_pawn.glb':            require('../../assets/glb/chess/pieces/black_pawn.glb'),
  'glb/chess/pieces/black_knight.glb':          require('../../assets/glb/chess/pieces/black_knight.glb'),
  'glb/chess/pieces/black_bishop.glb':          require('../../assets/glb/chess/pieces/black_bishop.glb'),
  'glb/chess/pieces/black_rook.glb':            require('../../assets/glb/chess/pieces/black_rook.glb'),
  'glb/chess/pieces/black_queen.glb':           require('../../assets/glb/chess/pieces/black_queen.glb'),
  'glb/chess/pieces/black_king.glb':            require('../../assets/glb/chess/pieces/black_king.glb'),
  'glb/cards/card-template.glb':                require('../../assets/glb/cards/card-template.glb'),
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
      } else {
        // Fallback for paths not in the map: construct from scriptURL
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

      const safeFileName = assetPath.replace(/[\/\\]/g, '_').replace(/ /g, '_');
      const tempPath = `${RNFS.TemporaryDirectoryPath}ar_${safeFileName}`;

      // Reuse the cached temp file if it already exists — avoids re-downloading
      // large GLBs (e.g. 26 MB poker_table2.glb) on every Metro reload.
      // Delete it manually from the device tmp dir if you need a fresh copy.
      if (await RNFS.exists(tempPath)) {
        return `file://${tempPath}`;
      }

      try {
        const dl = RNFS.downloadFile({fromUrl: metroUrl, toFile: tempPath});
        const res = await dl.promise;
        // Metro sometimes returns statusCode 0 even on HTTP 200 — accept if
        // bytesWritten > 0 so a partial/empty file doesn't count as success.
        const ok = res.statusCode === 200 || (res.statusCode === 0 && res.bytesWritten > 100);
        if (ok) {
          return `file://${tempPath}`;
        }
      } catch (dlErr) {
      }

      console.warn('[AR3DOverlay] GLB download failed:', assetPath);
      return null;
    }

    // Production: copy from the app bundle to CachesDirectory once, then reuse the
    // file:// URL. Avoids the ~33% base64 inflation and prevents WKWebView from
    // choking on a 30-40 MB string allocation for large GLBs.
    const safeFileName = assetPath.replace(/[/\\]/g, '_').replace(/ /g, '_');
    const cacheDir     = `${RNFS.CachesDirectoryPath}/glb_cache`;
    const cachedPath   = `${cacheDir}/${safeFileName}`;

    if (!(await RNFS.exists(cacheDir))) {
      await RNFS.mkdir(cacheDir);
    }

    if (!(await RNFS.exists(cachedPath))) {
      if (Platform.OS === 'ios') {
        await RNFS.copyFile(`${RNFS.MainBundlePath}/assets/${assetPath}`, cachedPath);
      } else {
        // Android: copyFileAssets streams from APK without loading into JS RAM
        await RNFS.copyFileAssets(`assets/${assetPath}`, cachedPath);
      }
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
// armenian_board.glb geometry (measured from GLB accessors + 2048px texture scan):
// GLB local: top quad -0.5..0.5, bevel extends to -0.53..0.53 => max dim = 1.06
// scale = BOARD_HALF_W*2 / 1.06 = 0.70/1.06 = 0.6604
// top face world half = 0.5 * 0.6604 = 0.3302m
// Texture field: px 236..1814 of 2048 => UV 0.1152..0.8857
// Field world half = (0.8857-0.5) * 0.6604 = 0.2544m  (col axis)
// Per square = 0.2544*2/8 = 0.0636m
const FIELD_HALF_W = 0.2544;
const FIELD_HALF_H = FIELD_HALF_W;
const SQUARE_W     = (FIELD_HALF_W * 2) / 8;  // 0.0636m per square
const SQUARE_H     = SQUARE_W;
const PIECE_SCALE  = SQUARE_W * 0.60;          // 60% of square — clear gap on all 4 sides
const FIELD_RAISE  = 0.01270;                   // 1/2 inch raise — visible sides from camera angle
const BOARD_Y    = -1.10;  // table surface lowered

// ── Dynamic TABLE_DIST: closest distance where board corners fit in view ──────
// hFov derived from vFov + aspect ratio so it adapts to every screen/orientation.
// MARGIN 0.75 keeps the board close; raw result is clamped [0.70, 1.10] so it
// never clips on ultra-wide landscape and never floats away on narrow portrait.
const _halfVFovRad = (${fov} / 2) * (Math.PI / 180);
const _aspect      = W / H;
const _halfHFovRad = Math.atan(Math.tan(_halfVFovRad) * _aspect);
const _rawDist     = (BOARD_HALF * 0.75 / Math.tan(_halfHFovRad)) + BOARD_HALF;
const TABLE_DIST   = Math.min(Math.max(_rawDist, 0.70), 1.10);

// ── sceneGroup starts as a camera child so it is always in front ─────────────────
// On the first animation frame (after camera rotation is applied from live gyro)
// it is detached from the camera and re-parented to the scene preserving its
// world matrix — so it stays fixed in the room from that point on.
// This completely sidesteps any yaw sign/offset ambiguity.
const DEG = Math.PI / 180;
const sceneGroup = new THREE.Group();
sceneGroup.position.x = 0.0; // shift right in camera space to centre in view
camera.add(sceneGroup);  // ← camera child: local (0,0,-TABLE_DIST) = always in front
let _frozen = false;
let _freezeCountdown = 8; // wait 8 frames for live gyro injectJavaScript to arrive

// ── Board group — flat horizontal, TABLE_DIST ahead in camera/sceneGroup space ───
const boardGroup = new THREE.Group();
boardGroup.position.set(0, BOARD_Y, -(TABLE_DIST * 0.9)); // closer to camera
boardGroup.rotation.x = -Math.PI / 2;
sceneGroup.add(boardGroup);

// ── Invisible hit plane for raycasting — covers the board surface exactly ────
const raycaster = new THREE.Raycaster();
const hitPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_HALF_W * 2, BOARD_HALF_H * 2),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
boardGroup.add(hitPlane);

function handleTap(clientX, clientY) {
  const nx =  (clientX / window.innerWidth)  * 2 - 1;
  const ny = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const hits = raycaster.intersectObject(hitPlane, false);
  if (!hits.length) return;
  // Convert world hit point → boardGroup local space
  boardGroup.updateWorldMatrix(true, false);
  const lp = boardGroup.worldToLocal(hits[0].point.clone());
  const col = Math.floor((lp.x + FIELD_HALF_W) / SQUARE_W);
  const row = Math.floor((FIELD_HALF_H - lp.y) / SQUARE_H);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap', row, col }));
    }
  }
}
document.addEventListener('touchend', (e) => {
  if (e.changedTouches.length > 0) {
    handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
}, { passive: true });

// ── Procedural fallback board ─────────────────────────────────────────────────
function buildProceduralBoard() {
  if (BOARD_STYLE === 'poker') {
    // ── Oval poker table ────────────────────────────────────────────────────
    var SEGS = 64;
    var RX = BOARD_HALF_W;          // felt semi-axis X
    var RY = BOARD_HALF_H * 0.62;   // felt semi-axis Y (oval)
    var RAIL_W = 0.06;              // wood rail width
    var T = BOARD_THICKNESS;

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
    boardGroup.add(new THREE.Mesh(
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
    boardGroup.add(railMesh);

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
    fctx.beginPath(); fctx.ellipse(256, 256, 160, 116, 0, 0, Math.PI * 2); fctx.stroke();
    var feltTex = new THREE.CanvasTexture(fc);
    feltTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var feltMesh = new THREE.Mesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95, metalness: 0 }));
    feltMesh.position.z = T * 0.5 + 0.002;
    boardGroup.add(feltMesh);
    return;
  }

  // ── Standard chess/checkers board ───────────────────────────────────────────
  const THICKNESS = BOARD_THICKNESS; // board depth — gives it a solid slab look
  // Solid slab body
  boardGroup.add(new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_HALF_W*2+0.04, BOARD_HALF_H*2+0.04, THICKNESS),
    new THREE.MeshStandardMaterial({ color:0x3b2206, roughness:0.75, metalness:0.06 })
  ));
  const lMat = new THREE.MeshStandardMaterial({ color:0xe8d5b5, roughness:0.5,  metalness:0.04 });
  const dMat = new THREE.MeshStandardMaterial({ color:0x7a4a22, roughness:0.65, metalness:0.06 });
  const sqGeo = new THREE.PlaneGeometry(SQUARE_W*0.97, SQUARE_H*0.97);
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const sq = new THREE.Mesh(sqGeo, (r+c)%2===0 ? lMat : dMat);
    sq.position.set(-FIELD_HALF_W+(c+0.5)*SQUARE_W, FIELD_HALF_H-(r+0.5)*SQUARE_H, THICKNESS/2+0.001);
    boardGroup.add(sq);
  }
  const rimLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_HALF_W*2+0.03, BOARD_HALF_H*2+0.03, THICKNESS+0.002)),
    new THREE.LineBasicMaterial({ color:0xd4af37 })
  );
  rimLine.position.z = 0.001;
  boardGroup.add(rimLine);
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
  var _boardDone = false;
  var _boardTimer = setTimeout(function() {
    if (!_boardDone) {
      _boardDone = true;
      _rnLog('[AR3D-HTML] Board GLB timed out after 120s, using procedural fallback');
      buildProceduralBoard();
    }
  }, 120000);
  loader.load(BOARD_URI, (gltf) => {
    const model = gltf.scene;
    // Determine the model's natural orientation before applying any correction.
    // Two common conventions from DCC tools:
    //   (A) Y-up / XZ-flat  — e.g. chess board ui.glb (roughly cubic bounding box)
    //       boardGroup.rotation.x = -π/2 would stand it up, so we need +π/2 to lay it flat.
    //   (B) Z-normal / XY-flat — e.g. rounded_table_panel_v4.glb (very thin in Z)
    //       boardGroup.rotation.x = -π/2 maps XY → world XZ (already horizontal), so
    //       adding +π/2 would stand it back up — we want rotation.x = 0 here.
    const rawBox  = new THREE.Box3().setFromObject(model);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const isXYFlat = rawSize.z < Math.min(rawSize.x, rawSize.y) * 0.25;
    // XY-flat (e.g. octagon_table.glb): surface normal is +Z, rotation.x=-π/2 lays it flat.
    // Y-up (e.g. casino_table_level2_textured.glb): +Y is up, rotation.x=+π/2 lays it flat.
    // In both cases rotation.z is only needed for XY-flat models to orient the front edge.
    model.rotation.x = isXYFlat ? -Math.PI / 2 : Math.PI / 2;
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
    model.traverse(ch => {
      if (ch.isMesh) {
        ch.receiveShadow = true;
        const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(m => {
          if (m) {
            m.roughness = Math.max((m.roughness||0.5)*0.8, 0.35);
            m.side = THREE.DoubleSide; // visible regardless of face orientation
            // Enable anisotropic filtering on all textures — prevents blur at oblique angles
            const texSlots = ['map','normalMap','roughnessMap','metalnessMap','aoMap'];
            texSlots.forEach(slot => {
              const tex = m[slot];
              if (tex) {
                tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                tex.needsUpdate = true;
              }
            });
          }
        });
      }
    });
    boardGroup.add(model);

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
  }, (xhr) => {
    if (xhr.total > 0) {
      _rnLog('[AR3D-HTML] Board GLB progress: ' + Math.round(xhr.loaded/xhr.total*100) + '%');
    }
  }, (err) => {
    clearTimeout(_boardTimer); _boardDone = true;
    _rnLog('[AR3D-HTML] Board GLB FAILED: ' + (err && err.message ? err.message : String(err)));
    buildProceduralBoard();
  });
} else {
  buildProceduralBoard();
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
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(1 / maxDim);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x/maxDim, -(box.min.y/maxDim), -center.z/maxDim);
  return model;
}

Object.entries(CHESS_PIECE_URIS || {}).forEach(([pieceKey, pieceUri]) => {
  if (!pieceUri) return;
  loader.load(pieceUri, (gltf) => {
    baseChessPieceScenes[pieceKey] = normalizePieceModel(gltf.scene);
    invalidatePieceCache();
    updatePieces(window._pieces || []);
  }, undefined, () => {
    console.warn('[AR3DOverlay] chess piece GLB failed:', pieceKey);
  });
});

if (PIECES_URI) {
  loader.load(PIECES_URI, (gltf) => {
    basePieceScene = normalizePieceModel(gltf.scene);
    invalidatePieceCache();
    // Flush pending update — fall back to window._pieces if no explicit queue
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
  }, undefined, () => {
    // Pieces GLB failed — clonePiece() will use fallback geometry
    console.warn('[AR3DOverlay] pieces GLB load failed, using procedural discs');
    const toFlush = pendingPiecesUpdate || window._pieces || [];
    pendingPiecesUpdate = null;
    updatePieces(toFlush);
  });
}

function clonePiece(piece) {
  const color = piece.color;
  const isKing = piece.isKing;
  const chessKey = piece.side && piece.pieceType ? (piece.side + '_' + piece.pieceType) : null;
  const sourceScene = chessKey ? baseChessPieceScenes[chessKey] : basePieceScene;
  if (!sourceScene) {
    return chessKey
      ? makeFallbackChessPiece(color, piece.pieceType, isKing)
      : makeFallbackPiece(color, isKing);
  }

  const pieceColor = color === 'red' ? ${RED_HEX} : ${BLACK_HEX};
  const clone = sourceScene.clone(true);
  clone.rotation.x = Math.PI / 2;  // ← cancels boardGroup rotation → upright in world

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

  // King: add gold rim ring on top
  if (isKing) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.50, 0.06, 8, 48),
      new THREE.MeshStandardMaterial({ color:0xf5c842, metalness:0.95, roughness:0.05 })
    );
    ring.position.y = 0.52;
    ring.rotation.x = Math.PI/2;
    clone.add(ring);
  }
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
  var frontTex = makeCardTexture(suit, rank, false, opts);
  var backTex  = makeCardTexture(suit, rank, true,  opts);
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
  if (!cards || cards.length === 0) {
    _cardMeshMap.forEach(grp => cardGroup.remove(grp));
    _cardMeshMap.clear();
    return;
  }
  const incoming = new Set(cards.map(c => c.key));
  _cardMeshMap.forEach((grp, key) => {
    if (!incoming.has(key)) { cardGroup.remove(grp); _cardMeshMap.delete(key); }
  });
  cards.forEach(card => {
    const cd = card.cardData || {};
    const { suit='spades', rank='A', faceDown=false,
            backgroundImageUri, cardBackImageUri, font } = cd;
    const themeKey = ['v3', backgroundImageUri||'', cardBackImageUri||'', font||'', faceDown].join('|');
    let grp = _cardMeshMap.get(card.key);
    if (!grp || grp.userData.themeKey !== themeKey) {
      if (grp) cardGroup.remove(grp);
      grp = makeCardMesh(suit, rank, faceDown, { font, backgroundImageUri, cardBackImageUri });
      grp.userData.cardKey  = card.key;
      grp.userData.themeKey = themeKey;
      cardGroup.add(grp);
      _cardMeshMap.set(card.key, grp);
    }
    grp.position.set(card.position.x, card.position.y, card.position.z);
    if (card.rotation) grp.rotation.set(card.rotation.x||0, card.rotation.y||0, card.rotation.z||0);
    const s = card.scale !== undefined ? card.scale : 1;
    grp.scale.set(s, s, s);
  });
}

// ── Piece management ──────────────────────────────────────────────────────────
const pieceMeshes = {};
const pieceState  = {};

function boardToLocal(row, col) {
  return [
    -FIELD_HALF_W + (col + 0.5) * SQUARE_W,
     FIELD_HALF_H - (row + 0.5) * SQUARE_H,
     BOARD_THICKNESS / 2 + 0.010 + FIELD_RAISE,  // above board + 1/4" raised field
  ];
}

function updatePieces(pieces) {
  // If pieces GLB is still loading, defer
  if (PIECES_URI && !basePieceScene) {
    pendingPiecesUpdate = pieces;
    return;
  }

  const incoming = {};
  pieces.forEach(p => { incoming[p.key] = p; });

  for (const k of Object.keys(pieceMeshes)) {
    if (!incoming[k]) {
      boardGroup.remove(pieceMeshes[k]);
      delete pieceMeshes[k];
      delete pieceState[k];
    }
  }

  for (const p of pieces) {
    const prev = pieceState[p.key];
    if (
      !prev ||
      prev.color !== p.color ||
      prev.isKing !== p.isKing ||
      prev.pieceType !== p.pieceType ||
      prev.side !== p.side
    ) {
      if (pieceMeshes[p.key]) boardGroup.remove(pieceMeshes[p.key]);
      pieceMeshes[p.key] = clonePiece(p);
      boardGroup.add(pieceMeshes[p.key]);
      pieceState[p.key] = {
        color: p.color,
        isKing: p.isKing,
        pieceType: p.pieceType,
        side: p.side,
      };
    }

    const mesh  = pieceMeshes[p.key];
    const loc   = boardToLocal(p.row, p.col);
    const lift  = p.isSelected ? 0.12 : 0;
    const isChessPiece = !!(p.pieceType && p.side);
    const scale = (p.isSelected ? PIECE_SCALE * 1.12 : PIECE_SCALE);
    mesh.position.set(loc[0], loc[1], loc[2] + lift + (isChessPiece ? 0.004 : 0));
    if (isChessPiece) {
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
    d.position.set(loc[0], loc[1], BOARD_THICKNESS / 2 + FIELD_RAISE + 0.002);
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
  if (data.type === 'scene') {
    window._pieces = data.pieces || [];
    window._cards = data.cards || [];
    updatePieces(window._pieces);
    updateDots(data.moves || []);
    updateCards(window._cards);
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
      _frozen = false;
      _freezeCountdown = 8;
    }
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
  camera.rotation.x = -window._att.pitch * DEG - 0.28; // ~16° downward — eye level looking across table surface
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
  renderer.render(scene, camera);
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
  fov = 75,
  boardGlbPath,
  piecesGlbPath,
  chessPieceGlbPaths,
  tableGlbPath,
  cardGlbPath,
  cardBackTexturePath,
  onSquareTap,
  pieceColorRed   = '#c0392b',
  pieceColorBlack = '#1e2d3d',
  hideCheckerboard = false,
  boardScale = 1.0,
  boardStyle = 'default',
}: AR3DOverlayProps, ref: React.Ref<AR3DOverlayHandle>) {
  const attitude = useSharedAttitude();
  const webViewRef = useRef<WebView>(null);
  const renderKey = useRef(0); // Force re-render on demand

  useImperativeHandle(ref, () => ({
    recenter() {
      webViewRef.current?.injectJavaScript(
        `window.handleRNMessage({type:'recenter'});true;`
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
  const [piecesUri, setPiecesUri] = useState<string | null | undefined>(piecesGlbPath ? undefined : null);
  const [chessPieceUris, setChessPieceUris] = useState<Record<string, string | null> | undefined>(
    chessPieceGlbPaths ? undefined : {}
  );
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
    if (!piecesGlbPath) { setPiecesUri(null); return; }
    let cancelled = false;
    resolveAssetUri(piecesGlbPath).then(u => { if (!cancelled) setPiecesUri(u); });
    return () => { cancelled = true; };
  }, [piecesGlbPath]);

  useEffect(() => {
    if (!chessPieceGlbPaths) {
      setChessPieceUris({});
      return;
    }
    let cancelled = false;
    const entries = Object.entries(chessPieceGlbPaths).filter(([, path]) => !!path);
    Promise.all(
      entries.map(async ([pieceKey, path]) => {
        const uri = await resolveAssetUri(path as string);
        return [pieceKey, uri] as const;
      })
    ).then(resolvedEntries => {
      if (cancelled) return;
      const resolvedMap: Record<string, string | null> = {};
      resolvedEntries.forEach(([pieceKey, uri]) => {
        resolvedMap[pieceKey] = uri;
      });
      setChessPieceUris(resolvedMap);
    });
    return () => { cancelled = true; };
  }, [chessPieceGlbPaths]);

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

  // Build HTML once spawn yaw is captured.
  // boardUri/piecesUri/cardUri may still be 'undefined' (downloading) — treat as
  // null so the procedural fallback renders immediately. The useMemo re-runs and
  // rebuilds the scene once each URI resolves (e.g. the 26 MB poker_table2.glb).
  const htmlString = useMemo(() => {
    if (chessPieceUris === undefined) return null;
    if (spawnYaw === null) return null;
    const redInt  = parseInt(pieceColorRed.replace(/^#/, ''), 16);
    const blackInt = parseInt(pieceColorBlack.replace(/^#/, ''), 16);
    const result = buildSceneHTML(
      fov, boardUri ?? null, piecesUri ?? null, chessPieceUris, tableUri ?? null, spawnYaw,
      redInt, blackInt, cardUri ?? null, cardBackUri ?? null,
      localThreePath, localGltfPath, hideCheckerboard, boardScale, boardStyle,
    );
    return result;
  }, [fov, boardUri, piecesUri, chessPieceUris, tableUri, spawnYaw, cardUri, cardBackUri, hideCheckerboard, boardScale, boardStyle]);

  // Write the HTML to a temp file and give WebView a file:// URI.
  // WKWebView.loadHTMLString silently fails on iOS with large strings (>5 MB).
  // WKWebView.loadFileURL has no such limit.
  const htmlFileUriKeyRef = useRef(0);
  const [htmlFileUri, setHtmlFileUri] = useState<string | null>(null);
  useEffect(() => {
    if (!htmlString) { setHtmlFileUri(null); return; }
    // Use a unique filename per session so WKWebView never serves a cached version.
    // Same URL = cached HTML = stale spawnYaw baked in = locked rotation on game 2+.
    const sessionId = htmlFileUriKeyRef.current;
    htmlFileUriKeyRef.current += 1;
    const filePath = `${RNFS.TemporaryDirectoryPath}ar_scene_${sessionId}_${Date.now()}.html`;
    RNFS.writeFile(filePath, htmlString, 'utf8')
      .then(() => {
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
  
  latestPiecesRef.current = pieces;
  latestMovesRef.current  = moves;
  latestCardsRef.current  = cards;

  // Push board state on every piece/move change
  useEffect(() => {
    if (!visible || !htmlFileUri) return;
    console.log('[AR3DOverlay] pushing scene — cards:', cards?.length ?? 0, 'pieces:', pieces?.length ?? 0);
    const msg = JSON.stringify({type: 'scene', pieces, moves, cards});
    webViewRef.current?.injectJavaScript(`window.handleRNMessage(${msg});true;`);
  }, [pieces, moves, cards, visible, htmlFileUri]);

  // Re-send pieces once the WebView has finished loading (Three.js CDN async import).
  // The useEffect above may fire before handleRNMessage is registered, so this
  // guarantees pieces appear after the module script has run.
  // Retry every 500ms for up to 5s in case the pieces GLB CDN import is still loading.
  const handleLoadEnd = useCallback(() => {
    const sendScene = () => {
      const msg = JSON.stringify({
        type: 'scene',
        pieces: latestPiecesRef.current,
        moves:  latestMovesRef.current,
        cards:  latestCardsRef.current,
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
      } else if (data.type === 'log') {
        console.warn('[AR3D WebView]', data.msg);
      }
    } catch (_) {}
  }, [onSquareTap]);

  if (!visible || !htmlFileUri) return null;

  return (
    // box-none: wrapper does not capture touches but WebView child does
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <WebView
        key={htmlFileUri} // Unique file URL per session = WebView always remounts with fresh spawnYaw
        ref={webViewRef}
        source={{ uri: htmlFileUri }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
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
});

export default AR3DOverlay;
