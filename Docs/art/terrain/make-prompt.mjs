#!/usr/bin/env node
// Splice a terrain out of terrains.json into a prompt template.
//   node make-prompt.mjs grassland 1   -> grassland-1.prompt.txt   (a tile)
//   node make-prompt.mjs grassland edge -> grassland-edge.prompt.txt
import { readFileSync, writeFileSync } from 'node:fs';

const [id, which] = process.argv.slice(2);
const terrains = JSON.parse(readFileSync(new URL('./terrains.json', import.meta.url)));
const t = terrains[id];
if (!t) throw new Error(`no terrain "${id}" — have ${Object.keys(terrains).join(', ')}`);

const edge = which === 'edge';
const tpl = readFileSync(
  new URL(edge ? './_edge-template.txt' : './_tile-template.txt', import.meta.url), 'utf8');

const n = edge ? 0 : Number(which);
if (!edge && !(n >= 1 && n <= t.variants.length)) {
  throw new Error(`variant must be 1..${t.variants.length} or "edge"`);
}

const out = tpl
  .replaceAll('{{NAME}}', t.name)
  .replaceAll('{{MATERIAL}}', t.material)
  .replaceAll('{{VARIANT}}', edge ? '' : t.variants[n - 1])
  .replaceAll('{{DETAIL}}', edge ? '' : `Detail on the tile: ${t.detail}.`);

const file = `${id}-${edge ? 'edge' : n}.prompt.txt`;
writeFileSync(new URL(`./${file}`, import.meta.url), out);
console.log(file);
