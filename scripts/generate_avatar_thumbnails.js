#!/usr/bin/env node
/**
 * Rasterizes every assets/avatars_new/**​/*.svg into a small PNG thumbnail
 * under assets/avatars_new_thumbs/, mirroring the source directory layout.
 *
 * Why: several source SVGs (auto-traced artwork) contain thousands of
 * individual <path> elements (one file has ~4700). react-native-svg has to
 * draw every path on every render, which is fine for a single full-size
 * avatar preview but causes dropped frames / blank cells when ~15 of these
 * render at once in a scrolling FlashList of clothing thumbnails. Rendering
 * a single pre-rasterized bitmap instead is ~150x cheaper per cell.
 *
 * The SVGs remain the source of truth (used for the full-detail avatar
 * preview); thumbnails are a generated build artifact only used for list
 * cells. Re-run this script whenever assets/avatars_new/ changes, then
 * `node scripts/patch_avatarsNew_thumbnails.js` to wire up `thumbnailUrl`.
 *
 * Usage: node scripts/generate_avatar_thumbnails.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'assets', 'avatars_new');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'avatars_new_thumbs');
const THUMB_SIZE = 400;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const svgFiles = walk(SRC_DIR);
  console.log(`Found ${svgFiles.length} SVGs. Rasterizing to ${THUMB_SIZE}x${THUMB_SIZE} PNG thumbnails...`);

  let ok = 0;
  let failed = 0;
  for (const svgPath of svgFiles) {
    const rel = path.relative(SRC_DIR, svgPath);
    const outPath = path.join(OUT_DIR, rel).replace(/\.svg$/i, '.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    try {
      await sharp(svgPath, { density: 300 })
        .resize(THUMB_SIZE, THUMB_SIZE, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(outPath);
      ok++;
    } catch (err) {
      failed++;
      console.error(`FAILED: ${rel}: ${err.message}`);
    }
  }
  console.log(`Done. ${ok} thumbnails written, ${failed} failed.`);
}

main();
