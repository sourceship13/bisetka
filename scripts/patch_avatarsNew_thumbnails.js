#!/usr/bin/env node
/**
 * Wires up `thumbnailUrl` in the auto-generated avatarsNew.ts catalog,
 * pointing each item at its pre-rasterized PNG (see
 * generate_avatar_thumbnails.js). Idempotent — safe to re-run.
 *
 * For every `import <Var> from '<svgPath>';` line, inserts a twin
 * `import <Var>_Thumb from '<pngThumbPath>';` right after it, and for every
 * `imageUrl: <Var>,` line inserts `thumbnailUrl: <Var>_Thumb,` right after.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'avatarsNew.ts');

const IMPORT_RE = /^import (\w+) from '(\.\.\/\.\.\/assets\/avatars_new\/[^']+)\.svg';$/;
const IMAGEURL_RE = /^(\s*)imageUrl: (\w+),$/;

function main() {
  const src = fs.readFileSync(FILE, 'utf8');
  if (src.includes('_Thumb')) {
    console.log('avatarsNew.ts already has thumbnailUrl wiring — nothing to do.');
    return;
  }

  const lines = src.split('\n');
  const out = [];
  let importsPatched = 0;
  let fieldsPatched = 0;

  for (const line of lines) {
    out.push(line);
    const importMatch = line.match(IMPORT_RE);
    if (importMatch) {
      const [, varName, svgRelPath] = importMatch;
      const pngRelPath = svgRelPath.replace(
        '/assets/avatars_new/',
        '/assets/avatars_new_thumbs/',
      );
      out.push(`import ${varName}_Thumb from '${pngRelPath}.png';`);
      importsPatched++;
      continue;
    }
    const fieldMatch = line.match(IMAGEURL_RE);
    if (fieldMatch) {
      const [, indent, varName] = fieldMatch;
      out.push(`${indent}thumbnailUrl: ${varName}_Thumb,`);
      fieldsPatched++;
    }
  }

  fs.writeFileSync(FILE, out.join('\n'));
  console.log(`Patched ${importsPatched} imports and ${fieldsPatched} thumbnailUrl fields.`);
}

main();
