/**
 * resolveAssetUri.ts
 *
 * Shared utility to resolve a project-assets-relative GLB path to a URI
 * that can be loaded by any renderer (WebView, Viro3DObject, etc.).
 *
 * Dev  → downloads from Metro asset server → file:// URI in temp dir
 * Prod → reads from app bundle → file:// URI (iOS MainBundlePath)
 */

import { Image, NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// All GLB assets that need to be resolvable — add new ones here.
const GLB_ASSET_MAP: Record<string, any> = {
  'glb/game_boards/rounded_table_panel_v4.glb': require('../../assets/glb/game_boards/rounded_table_panel_v4.glb'),
  'glb/game_boards/rounded_table_panel.glb':    require('../../assets/glb/game_boards/rounded_table_panel.glb'),
  'glb/game assets/round_table.glb':            require('../../assets/glb/game assets/round_table.glb'),
  'glb/game assets/Backgammon.glb':             require('../../assets/glb/game assets/Backgammon.glb'),
  'glb/game assets/Backgammon_board_only.glb':  require('../../assets/glb/game assets/Backgammon_board_only.glb'),
  'nardi/board.png':                            require('../../assets/nardi/board.png'),
  'glb/chess/chess-board/source/ui.glb':        require('../../assets/glb/chess/chess-board/source/ui.glb'),
  'glb/chess/chess-board/source/armenian_board.glb': require('../../assets/glb/chess/chess-board/source/armenian_board.glb'),
  'glb/checkers/chess-board/source/ui.glb': require('../../assets/glb/checkers/chess-board/source/ui.glb'),
  'glb/chess/pieces/white_pawn.glb':            require('../../assets/glb/chess/pieces/white_pawn.glb'),
  'glb/chess/pieces/white_knight.glb':          require('../../assets/glb/chess/pieces/white_knight.glb'),
  'glb/chess/pieces/white_bishop.glb':          require('../../assets/glb/chess/pieces/white_bishop.glb'),
  'glb/chess/pieces/white_rook.glb':            require('../../assets/glb/chess/pieces/white_rook.glb'),
  'glb/chess/pieces/white_queen.glb':           require('../../assets/glb/chess/pieces/white_queen.glb'),
  'glb/chess/pieces/white_king.glb':            require('../../assets/glb/chess/pieces/white_king.glb'),
};

export async function resolveAssetUri(assetPath: string): Promise<string | null> {
  try {
    if (__DEV__) {
      const assetRef = GLB_ASSET_MAP[assetPath];
      let metroUrl: string | null = null;

      if (assetRef != null) {
        const resolved = Image.resolveAssetSource(assetRef);
        metroUrl = resolved?.uri ?? null;
      } else {
        const scriptUrl: string = (NativeModules.SourceCode as any)?.scriptURL ?? '';
        const match = scriptUrl.match(/^(https?:\/\/[^/:]+(?::\d+)?)/);
        const base = match ? match[1] : null;
        if (base) {
          const encodedPath = assetPath.split('/').map(encodeURIComponent).join('/');
          metroUrl = `${base}/assets/assets/${encodedPath}`;
        }
      }

      if (!metroUrl) {
        console.warn('[resolveAssetUri] no Metro URL for:', assetPath);
        return null;
      }

      const safeFileName = assetPath.replace(/[\/\\]/g, '_');
      const tempPath = `${RNFS.TemporaryDirectoryPath}ar_${safeFileName}`;

      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath).catch(() => {});
      }

      const dl = RNFS.downloadFile({ fromUrl: metroUrl, toFile: tempPath });
      const res = await dl.promise;
      const ok = res.statusCode === 200 || (res.statusCode === 0 && res.bytesWritten > 100);
      if (ok) return `file://${tempPath}`;

      console.warn('[resolveAssetUri] GLB download failed:', assetPath);
      return null;
    }

    // Production
    if (Platform.OS === 'ios') {
      const filePath = `${RNFS.MainBundlePath}/assets/${assetPath}`;
      const exists = await RNFS.exists(filePath);
      if (exists) return `file://${filePath}`;
    }

    // Android prod fallback — base64
    const b64 = await RNFS.readFileAssets(`assets/${assetPath}`, 'base64');
    return `data:model/gltf-binary;base64,${b64}`;
  } catch (e) {
    console.warn('[resolveAssetUri] failed:', assetPath, e);
    return null;
  }
}
