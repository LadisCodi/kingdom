// The data editor's server side: ?dev=data's save button, its "who reads this
// field" lookup, and what happens when a data file changes under a page.
//
// A browser cannot write to the repo, so `?dev=data` POSTs the collections it
// changed here and this writes `src/sim/data/game/<collection>.json` and
// `src/sim/data/schema/<collection>.json`. DEV-ONLY (`apply: 'serve'`): the
// endpoint cannot exist in a build.
//
//   1. It validates with src/sim/data/dataRules.ts — the module the editor and
//      tests/dataRules.test.ts use — loaded through Vite, so there is one copy
//      of the rules. Unlike the tree's endpoint it REFUSES a document with
//      errors: a number of the wrong shape does not survive to a warning, it
//      stops the game loading.
//   2. It writes with the same `formatData` the tests hold every file to, so
//      a save touches only the lines that changed.
//
// RELOADS. Every data file is imported by the game and by the editor, so a
// write would reload every open page — and a Data page holding unsaved work
// in another collection, or in the map or tree it hosts, would lose it. So a
// change to any data file is not a module update: it is a `kingdom:data`
// event naming the file and who wrote it (this endpoint, the map's, the
// tree's, or `disk` for anything else — a checkout, a hand edit). The game
// reloads on it; Data decides for itself (src/editor/data/mount.ts).

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/sim/data');
const SRC = join(ROOT, 'src');

/** Files a save writes or a tool owns: a change to one is a data event. */
const isDataFile = (file) => file.startsWith(join(DATA, 'game') + '/')
  || file.startsWith(join(DATA, 'schema') + '/')
  || file === join(DATA, 'tech-tree.json')
  || file === join(DATA, 'region-map.json');

/**
 * Who wrote a file last, and when — shared with the map and tree endpoints
 * through globalThis, since the three plugins are separate modules. A change
 * the watcher reports within a few seconds of a tool's write is that tool's.
 */
const writes = (globalThis.__kingdomDataWrites ??= new Map());
export const noteWrite = (file, origin) => writes.set(file, { origin, at: Date.now() });

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => resolve(raw));
  req.on('error', reject);
});

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** Every source file that could read a field, with its text, once per call. */
function sourceTexts() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        // The data itself, and the tool that edits it, are not READERS.
        if (p === join(DATA, 'game') || p === join(DATA, 'schema') || p === join(SRC, 'editor')) continue;
        walk(p);
      } else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && !e.name.endsWith('dataRules.ts')) {
        out.push([relative(ROOT, p), readFileSync(p, 'utf8')]);
      }
    }
  };
  walk(SRC);
  return out;
}

export function dataEditorPlugin() {
  return {
    name: 'kingdom-data-editor',
    apply: 'serve',
    configureServer(server) {
      const send = (res, status, body) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };

      server.middlewares.use('/__data/save', async (req, res) => {
        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
        try {
          const body = JSON.parse(await readBody(req));
          const rules = await server.ssrLoadModule('/src/sim/data/dataRules.ts');
          const incoming = body.data ?? {};
          const incomingSchemas = body.schema ?? {};
          // The whole document as it would be on disk after this save.
          const files = {};
          const schemas = {};
          for (const c of rules.COLLECTIONS) {
            if (c.view === 'canvas') continue;
            files[c.id] = incoming[c.id] ?? readJson(join(DATA, 'game', `${c.id}.json`));
            schemas[c.id] = incomingSchemas[c.id] ?? readJson(join(DATA, 'schema', `${c.id}.json`));
          }
          const doc = rules.assemble(files);
          const errors = rules.validateData(doc, doc, schemas).filter((i) => i.level === 'error');
          if (errors.length > 0) return send(res, 422, { error: `${errors.length} error(s) — nothing written`, errors });
          const written = [];
          const put = (dir, id, value) => {
            const file = join(DATA, dir, `${id}.json`);
            const text = rules.formatData(value);
            let before = '';
            try { before = readFileSync(file, 'utf8'); } catch { /* a new collection */ }
            if (before === text) return;
            noteWrite(file, 'data');
            writeFileSync(file, text);
            written.push(relative(ROOT, file));
          };
          for (const [id, v] of Object.entries(incoming)) put('game', id, v);
          for (const [id, v] of Object.entries(incomingSchemas)) put('schema', id, v);
          server.config.logger.info(`data editor: wrote ${written.length} file(s)${written.length ? ` — ${written.join(', ')}` : ''}`);
          send(res, 200, { ok: true, written });
        } catch (err) {
          server.config.logger.error(`data editor: save failed — ${err.stack ?? err}`);
          send(res, 500, { error: String(err.message ?? err) });
        }
      });

      // Which source files mention each key as a word — the Schema view's
      // "read by". A field nothing reads is data waiting for its code.
      server.middlewares.use('/__data/usage', async (req, res) => {
        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
        try {
          const { keys } = JSON.parse(await readBody(req));
          const texts = sourceTexts();
          const out = {};
          for (const key of keys ?? []) {
            const re = new RegExp(`\\b${String(key).replace(/[^A-Za-z0-9_]/g, '')}\\b`);
            out[key] = texts.filter(([, t]) => re.test(t)).map(([f]) => f);
          }
          send(res, 200, out);
        } catch (err) {
          send(res, 500, { error: String(err.message ?? err) });
        }
      });
    },

    handleHotUpdate({ file, server }) {
      if (!isDataFile(file)) return undefined;
      const w = writes.get(file);
      const origin = w && Date.now() - w.at < 5000 ? w.origin : 'disk';
      server.ws.send({ type: 'custom', event: 'kingdom:data', data: { file: relative(ROOT, file), origin } });
      return [];
    },
  };
}
