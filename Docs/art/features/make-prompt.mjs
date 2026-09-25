#!/usr/bin/env node
// Splice a map feature out of props.json into the prompt template.
//   node make-prompt.mjs forest   ->  forest.prompt.txt
import { readFileSync, writeFileSync } from 'node:fs';
const [id] = process.argv.slice(2);
const props = JSON.parse(readFileSync(new URL('./props.json', import.meta.url)));
const p = props[id];
if (!p) throw new Error(`no prop "${id}" — have ${Object.keys(props).join(', ')}`);
const tpl = readFileSync(new URL('./_prompt-template.txt', import.meta.url), 'utf8');
writeFileSync(new URL(`./${id}.prompt.txt`, import.meta.url),
  tpl.replaceAll('{{NAME}}', p.name).replaceAll('{{WHAT}}', p.what));
console.log(`${id}.prompt.txt`);
