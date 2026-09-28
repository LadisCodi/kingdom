#!/usr/bin/env node
// Splice one character's animation out of cast.json into the sheet template.
//   node make-prompt.mjs villager_1 walk  ->  villager_1-walk.prompt.txt
import { readFileSync, writeFileSync } from 'node:fs';
const [id, anim] = process.argv.slice(2);
const cast = JSON.parse(readFileSync(new URL('./cast.json', import.meta.url)));
const c = cast[id];
if (!c) throw new Error(`no character "${id}" — have ${Object.keys(cast).join(', ')}`);
const frames = c.anims[anim];
if (!frames) throw new Error(`no anim "${anim}" — have ${Object.keys(c.anims).join(', ')}`);
const tpl = readFileSync(new URL('./_sheet-template.txt', import.meta.url), 'utf8');
writeFileSync(new URL(`./${id}-${anim}.prompt.txt`, import.meta.url), tpl
  .replaceAll('{{SUBJECT}}', c.subject ?? 'PERSON')
  .replaceAll('{{BASELINE}}', c.baseline
    ?? "every frame's FEET rest on the same invisible horizontal line across the image.")
  .replaceAll('{{WHO}}', c.who)
  .replaceAll('{{COUNT}}', String(frames.length))
  .replaceAll('{{FRAMES}}', frames.map((f, i) => `  ${i + 1}. ${f}.`).join('\n')));
console.log(`${id}-${anim}.prompt.txt`);
