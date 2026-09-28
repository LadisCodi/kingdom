// Splices a building's NEW SCENE block into the invariant prompt template.
//
//   node Docs/art/city/make-prompt.mjs Housing      ->  housing-l1.prompt.txt
//   node Docs/art/city/make-prompt.mjs Housing 4    ->  housing-l4.prompt.txt
//   node Docs/art/city/make-prompt.mjs --all 4      ->  every building's l4
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
const LEVELS = JSON.parse(readFileSync(join(HERE, 'levels.json'), 'utf8'));
const M = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
const SIZE = Object.fromEntries(M.buildings.map(b => [b.id, [b.w, b.h]]));
const slug = id => id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/** The growth block. A tier above 1 is the SAME building, larger — so the
 *  prompt restates its identity, then says only what is added, and the caller
 *  attaches that building's own l1 sprite as a third anchor. */
function grown(id, lvl, scene) {
  const add = LEVELS[id]?.[String(lvl)];
  if (!add) throw new Error(`sin bloque de nivel ${lvl}: ${id}`);
  return `${scene}

=== THIS IS THE SAME BUILDING, UPGRADED TO LEVEL ${lvl} ===
The attached sprite is this building at level 1. This image is THAT SAME BUILDING after the player has upgraded it — not a different building, and not a second design.
KEEP, exactly: its silhouette and proportions, its palette, its roof colour and roof shape, the placement of its door, and every feature that identifies it. A player must recognise it at a glance and never have to re-learn which building this is.
ADD, and only this: ${add}.
The building grows by gaining mass, storeys and props. It is never replaced, never restyled, and never moved on its plot.`;
}

function one(id, lvl = 1) {
  const scene = BLOCKS[id];
  if (!scene) throw new Error(`sin bloque: ${id}`);
  const [w, h] = SIZE[id] ?? [1, 1];
  const body = lvl === 1 ? scene : grown(id, lvl, scene);
  const out = TPL.replace('{{SCENE}}', body).replace('{{FOOTPRINT}}', `${w} by ${h}`);
  const file = join(HERE, `${slug(id)}-l${lvl}.prompt.txt`);
  writeFileSync(file, out);
  return `${slug(id)}-l${lvl}.prompt.txt  (${w}×${h})`;
}

const arg = process.argv[2];
const lvl = Number(process.argv[3] ?? 1);
const pool = lvl === 1 ? BLOCKS : LEVELS;
const ids = arg === '--all' ? Object.keys(pool).filter(k => k !== '_note') : [arg];
for (const id of ids) console.log('  ' + one(id, lvl));
