// The map editor's save button, server side.
//
// A browser cannot write to the repo, so `?dev=map` POSTs its document here
// and this writes src/sim/data/region-map.json. It is a DEV-ONLY plugin
// (`apply: 'serve'`), so the endpoint cannot exist in a build — the editor is
// a tool for the repo, not a feature of the game.
//
// Two things make this safe to trust:
//   1. it validates with src/sim/data/mapRules.ts — the very module the editor
//      and tests/regionMap.test.ts use — loaded through Vite so there is one
//      copy of the rules, in TypeScript, and no chance of the server
//      accepting what the editor rejected;
//   2. it writes the same one-cell-per-line shape every time, so a map change
//      shows up in `git diff` as the cells that moved rather than as a
//      reflowed 2,000-line blob.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Who wrote a data file, so ?dev=data can tell its own saves from a checkout.
import { noteWrite } from './vite-data-editor.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = join(ROOT, 'src/sim/data/region-map.json');

/** Reading order, so a diff walks the map top-left to bottom-right. */
const byRow = (a, b) => a.y - b.y || a.x - b.x;

const cellLine = (c) => `      { "x": ${c.x}, "y": ${c.y}, "id": "${c.id}" }`;

const section = (name, cells) => `  "${name}": {\n    "cells": [\n`
  + [...cells].sort(byRow).map(cellLine).join(',\n')
  + '\n    ]\n  }';

const landmarkLine = (l) =>
  `    { "id": ${JSON.stringify(l.id)}, "kind": ${JSON.stringify(l.kind)}, `
  + `"x": ${l.x}, "y": ${l.y}, "claimCost": ${l.claimCost} }`;

// A lair is WHERE and WHAT, and its guard: one fight, nothing behind it
// (Docs/proposals/lairs.md §1).
const lairLines = (id, r) => `    ${JSON.stringify(id)}: {\n` + [
  `      "x": ${r.x}, "y": ${r.y}${r.size !== undefined ? `, "size": ${r.size}` : ''}`,
  `      "tier": ${r.tier}`,
  // How far its ground reaches past its own footprint
  // (Docs/proposals/lairs.md §3).
  `      "radius": ${r.radius}`,
  // How far it is sighted past the fog before it is found
  // (Docs/features/01-map-and-fog.md §4.1).
  `      "sight": ${r.sight}`,
  // The guard: one garrison, and the warning before its first raid.
  `      "guard": { "threat": ${JSON.stringify(r.guard.threat)}, `
    + `"power": ${r.guard.power}, "warningMinutes": ${r.guard.warningMinutes} }`,
  // The card's line over its painting (§6).
  `      "flavour": ${JSON.stringify(r.flavour)}`,
].join(',\n') + '\n    }';

// An abandoned building is WHERE, WHICH building, and how far its ruin is seen
// (Docs/features/01-map-and-fog.md §6.3).
const abandonedLine = (a) =>
  `    { "id": ${JSON.stringify(a.id)}, "district": ${JSON.stringify(a.district)}, `
  + `"x": ${a.x}, "y": ${a.y}, "sight": ${a.sight}`
  + `${a.name !== undefined ? `, "name": ${JSON.stringify(a.name)}` : ''} }`;

export function serialiseRegionMap(doc) {
  const text = '{\n' + [
    section('terrain', doc.terrain.cells),
    section('features', doc.features.cells),
    `  "landmarks": [\n${doc.landmarks.map(landmarkLine).join(',\n')}\n  ]`,
    `  "lairs": {\n${Object.entries(doc.lairs).map(([id, r]) => lairLines(id, r)).join(',\n')}\n  }`,
    `  "abandoned": [\n${(doc.abandoned ?? []).map(abandonedLine).join(',\n')}\n  ]`,
  ].join(',\n') + '\n}\n';
  // Hand-rolled formatting earns a parse check before it reaches the repo.
  JSON.parse(text);
  return text;
}

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => resolve(raw));
  req.on('error', reject);
});

export function mapEditorPlugin() {
  return {
    name: 'kingdom-map-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__map/save', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { error: 'POST only' });
        try {
          const doc = JSON.parse(await readBody(req));
          // The editor's own rules, not a second copy of them.
          const { validateRegionMap } = await server.ssrLoadModule('/src/sim/data/mapRules.ts');
          const { errors, warnings } = validateRegionMap(doc);
          if (errors.length > 0) {
            return send(422, { error: 'the map does not validate', errors });
          }
          noteWrite(MAP_PATH, 'map');
          writeFileSync(MAP_PATH, serialiseRegionMap(doc));
          const cells = doc.terrain.cells.length;
          server.config.logger.info(
            `map editor: wrote region-map.json (${cells} cells, `
            + `${doc.features.cells.length} features, ${doc.landmarks.length} landmarks)`,
          );
          send(200, { ok: true, cells, warnings });
        } catch (err) {
          server.config.logger.error(`map editor: save failed — ${err.stack ?? err}`);
          send(500, { error: String(err.message ?? err) });
        }
      });
    },
  };
}
