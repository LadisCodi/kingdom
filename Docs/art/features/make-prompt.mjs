#!/usr/bin/env node
// Splice a map feature out of props.json into the prompt template.
//   node make-prompt.mjs forest   ->  forest.prompt.txt
import { readFileSync, writeFileSync } from 'node:fs';
const [id] = process.argv.slice(2);
const props = JSON.parse(readFileSync(new URL('./props.json', import.meta.url)));
const p = props[id];
if (!p) throw new Error(`no prop "${id}" — have ${Object.keys(props).join(', ')}`);
// A FIELD is not a prop: its own ground is the asset, where every other
// feature is forbidden to draw ground at all, and its edges must be straight
// where every other feature's must not. Different rules, different template.
const which = p.template === 'field' ? '_field-template.txt' : '_prompt-template.txt';
const tpl = readFileSync(new URL(`./${which}`, import.meta.url), 'utf8');
writeFileSync(new URL(`./${id}.prompt.txt`, import.meta.url),
  tpl.replaceAll('{{NAME}}', p.name).replaceAll('{{WHAT}}', p.what));
console.log(`${id}.prompt.txt`);
