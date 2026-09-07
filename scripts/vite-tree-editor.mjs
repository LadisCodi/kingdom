// The tech tree editor's save button, server side.
//
// A browser cannot write to the repo, so `?dev=tree` POSTs its document here
// and this writes src/sim/data/tech-tree.json. It is a DEV-ONLY plugin
// (`apply: 'serve'`), so the endpoint cannot exist in a build — the editor is
// a tool for the repo, not a feature of the game.
//
// The same two things make it safe to trust as the map's twin:
//   1. it validates with src/sim/data/techTreeRules.ts — the very module the
//      editor and tests/techTree.test.ts use — loaded through Vite so there
//      is one copy of the rules, in TypeScript, and no chance of the server
//      accepting what the editor rejected;
//   2. it writes one technology per line, ordered down the page, so a change
//      shows up in `git diff` as the cards that moved rather than as a
//      reflowed 200-line blob.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TREE_PATH = join(ROOT, 'src/sim/data/tech-tree.json');

const NOTE = 'Every technology in the game: its name and prose, what KIND it '
  + 'is and what it unlocks, its price and clock, and its slot on its tome '
  + 'page with what it needs before it. Authored in ?dev=tree '
  + '(Docs/tech-tree-editor.md) — the Technologies sheet is gone, and the '
  + 'districts, units and harvest sources no longer name their own gate. '
  + 'Ordered by tome, then down the page, then left to right.';

/** Reading order: book by book, then down the page and across it. */
const inReadingOrder = (nodes, tomes) => Object.keys(nodes).sort((a, b) =>
  tomes.indexOf(nodes[a].tome) - tomes.indexOf(nodes[b].tome)
  || nodes[a].row - nodes[b].row
  || nodes[a].col - nodes[b].col);

const json = (v) => JSON.stringify(v);

/**
 * One technology, as the lines it is worth reading in a diff.
 *
 * Grouped the way a designer thinks about it — what it is, what it says, where
 * it sits, what it needs, what it costs, what it opens — and a field that
 * carries no information (no Knowledge, no unlocks, not planned) is left out
 * rather than written as a zero.
 */
const nodeBlock = (id, n) => {
  const lines = [
    `      "name": ${json(n.name)}, "glyph": ${json(n.glyph)}, "kind": ${json(n.kind)}`,
    `      "description": ${json(n.description)}`,
    `      "tome": ${json(n.tome)}, "era": ${n.era}, "row": ${n.row}, "col": ${n.col}`,
    `      "requires": [${(n.requires ?? []).map(json).join(', ')}]`,
    `      "gold": ${n.gold ?? 0}`
      + (n.knowledge ? `, "knowledge": ${n.knowledge}` : '')
      + `, "seconds": ${n.seconds ?? 0}`,
  ];
  if ((n.unlocks ?? []).length > 0) {
    lines.push(`      "unlocks": [${n.unlocks.map((u) => json(u)).join(', ')}]`);
  }
  if (n.line) {
    lines.push(`      "line": ${json(n.line)}, "effectPerRank": ${n.effectPerRank ?? 0}`);
  }
  if (n.planned === true) lines.push('      "planned": true');
  return `    ${json(id)}: {\n${lines.join(',\n')}\n    }`;
};

export function serialiseTechTree(doc, tomes) {
  const nodes = doc.technologies;
  const text = '{\n'
    + `  ${json('_note')}: ${json(NOTE)},\n`
    + '  "technologies": {\n'
    + inReadingOrder(nodes, tomes).map((id) => nodeBlock(id, nodes[id])).join(',\n')
    + '\n  }\n}\n';
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

export function treeEditorPlugin() {
  return {
    name: 'kingdom-tree-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__tree/save', async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { error: 'POST only' });
        try {
          const doc = JSON.parse(await readBody(req));
          // The editor's own rules, not a second copy of them.
          const rules = await server.ssrLoadModule('/src/sim/data/techTreeRules.ts');
          const { errors, warnings } = rules.validateTechTree(doc);
          if (errors.length > 0) {
            return send(422, { error: 'the tree does not validate', errors });
          }
          writeFileSync(TREE_PATH, serialiseTechTree(doc, rules.TOME_IDS));
          const count = Object.keys(doc.technologies).length;
          server.config.logger.info(
            `tree editor: wrote tech-tree.json (${count} technologies, `
            + `${warnings.length} warnings)`,
          );
          send(200, { ok: true, technologies: count, warnings });
        } catch (err) {
          server.config.logger.error(`tree editor: save failed — ${err.stack ?? err}`);
          send(500, { error: String(err.message ?? err) });
        }
      });
    },
  };
}
