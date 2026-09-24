// Splices a building's NEW SCENE block into the invariant prompt template.
//
//   node Docs/art/city/make-prompt.mjs Housing   ->  housing-l1.prompt.txt
//   node Docs/art/city/make-prompt.mjs --all
//
// Everything but the scene block is byte-identical between buildings, which is
// what keeps the camera, the background and the style from drifting piece to
// piece (Docs/art/art-direction.md §9).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TPL = readFileSync(join(HERE, '_prompt-template.txt'), 'utf8');
const BLOCKS = JSON.parse(readFileSync(join(HERE, 'blocks.json'), 'utf8'));
const M = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
const SIZE = Object.fromEntries(M.buildings.map(b => [b.id, [b.w, b.h]]));
const slug = id => id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

function one(id) {
  const scene = BLOCKS[id];
  if (!scene) throw new Error(`sin bloque: ${id}`);
  const [w, h] = SIZE[id] ?? [1, 1];
  const out = TPL.replace('{{SCENE}}', scene).replace('{{FOOTPRINT}}', `${w} by ${h}`);
  const file = join(HERE, `${slug(id)}-l1.prompt.txt`);
  writeFileSync(file, out);
  return `${slug(id)}-l1.prompt.txt  (${w}×${h})`;
}

const arg = process.argv[2];
const ids = arg === '--all' ? Object.keys(BLOCKS).filter(k => k !== '_note') : [arg];
for (const id of ids) console.log('  ' + one(id));
