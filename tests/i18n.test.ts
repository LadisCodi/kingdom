// THE GAME IN TWO LANGUAGES (Docs/features/28-languages.md).
//
// The code's text: every `tr('…')` and `trn(…)` in the source has its Spanish,
// in exactly one catalog file, with the same placeholders, and the catalog
// holds nothing the source no longer says.
//
// The data's text: every overlay entry names a text the data still has, with
// the same placeholders. What is missing or stale is REPORTED, not refused —
// the data is edited in `?dev=data`, and an untranslated text shows in
// English. `npm run i18n:sync` (I18N_SYNC=1) writes new texts into the
// overlays and drops the ones the data no longer has.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import balance from '../src/sim/data/balance';
import regionMap from '../src/sim/data/region-map.json';
import techTree from '../src/sim/data/tech-tree.json';
import { ES_FILES } from '../src/i18n/catalog';
import { DATA_GROUPS, OVERLAYS, dataTexts, localizeData, type DataDoc, type Overlay } from '../src/i18n/data';
import { setLang } from '../src/i18n/lang';
import { tr, trn } from '../src/i18n/tr';

const SYNC = process.env.I18N_SYNC === '1';

/** Every .ts file under src/, but the dev tools — they edit the English. */
function sources(): Array<{ file: string; src: string }> {
  const out: Array<{ file: string; src: string }> = [];
  const walk = (dir: URL, rel: string): void => {
    for (const name of readdirSync(dir)) {
      if (!name.includes('.')) {
        if (rel === '' && name === 'editor') continue;
        walk(new URL(`${name}/`, dir), `${rel}${name}/`);
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        out.push({ file: `${rel}${name}`, src: readFileSync(new URL(name, dir), 'utf8') });
      }
    }
  };
  walk(new URL('../src/', import.meta.url), '');
  return out;
}

const STR = String.raw`(['"\x60])((?:\\.|(?!\1)[^\\])*?)\1`;
const unescape = (s: string): string => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, c: string) =>
  (c === 'n' ? '\n' : c.length > 1 ? String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16)) : c));

/** The English every call names: `tr('…')` and `trn(n, '…', '…')` as `one|other`. */
function calledKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const { file, src } of sources()) {
    if (file.startsWith('i18n/')) continue;
    for (const m of src.matchAll(new RegExp(String.raw`\btr\(\s*${STR}`, 'g'))) {
      keys.set(unescape(m[2]), file);
    }
    for (const m of src.matchAll(new RegExp(String.raw`\btrn\(\s*[^,]+?,\s*${STR}\s*,\s*${STR.replaceAll('\\1', '\\3')}`, 'g'))) {
      keys.set(`${unescape(m[2])}|${unescape(m[4])}`, file);
    }
  }
  return keys;
}

const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('the code, in Spanish', () => {
  const called = calledKeys();

  it('never hands tr() anything but a literal — the catalog can only be checked against one', () => {
    for (const { file, src } of sources()) {
      if (file.startsWith('i18n/')) continue;
      for (const m of src.matchAll(/\btrn?\(\s*([^\s)])/g)) {
        if (m[0].startsWith('trn(')) continue; // its first argument is the count
        expect(`'"\``.includes(m[1]), `${file}: ${m[0]}…`).toBe(true);
      }
    }
  });

  it('has every text the code says, once, with its placeholders', () => {
    const seen = new Map<string, string>();
    for (const [area, cat] of Object.entries(ES_FILES)) {
      for (const [en, es] of Object.entries(cat)) {
        expect(seen.has(en), `"${en}" in both ${seen.get(en)} and ${area}`).toBe(false);
        seen.set(en, area);
        expect(es.trim(), `"${en}" (${area}) has no Spanish`).not.toBe('');
        expect(placeholders(es), `"${en}" (${area})`).toBe(placeholders(en));
        if (en.includes('|')) expect(es.split('|').length, `"${en}" (${area}) needs one|other`).toBe(2);
      }
    }
    const missing = [...called].filter(([en]) => !seen.has(en)).map(([en, file]) => `${file}: "${en}"`);
    expect(missing, 'add these to src/i18n/es/<area>.json').toEqual([]);
  });

  it('holds nothing the code no longer says', () => {
    const orphans = Object.entries(ES_FILES).flatMap(([area, cat]) =>
      Object.keys(cat).filter((en) => !called.has(en)).map((en) => `${area}: "${en}"`));
    expect(orphans).toEqual([]);
  });

  it('fills placeholders and picks plurals', () => {
    setLang('es');
    try {
      expect(tr('Nothing here {who}', { who: 'yet' })).toBe('Nothing here yet');
      expect(trn(1, '{n} thing', '{n} things', { n: '1' })).toBe('1 thing');
      expect(trn(3, '{n} thing', '{n} things', { n: '3' })).toBe('3 things');
    } finally {
      setLang('en');
    }
  });
});

const DOCS: Record<DataDoc, unknown> = { balance, regionMap, techTree };

describe('the data, in Spanish', () => {
  const report: string[] = [];
  afterAll(() => { if (report.length > 0) console.info(report.join('\n')); });

  it('names only texts the data still has, with their placeholders', () => {
    for (const g of DATA_GROUPS) {
      const texts = dataTexts(g.doc, DOCS[g.doc])[g.group];
      const overlay: Overlay = OVERLAYS[g.group];
      let missing = 0;
      let stale = 0;
      for (const [path, en] of Object.entries(texts)) {
        const e = overlay[path];
        if (e === undefined || e.es === '') missing += 1;
        else if (e.en !== en) stale += 1;
        else expect(placeholders(e.es), `${g.group} ${path}`).toBe(placeholders(en));
      }
      const orphans = Object.keys(overlay).filter((p) => !(p in texts));
      if (!SYNC) expect(orphans, `${g.group}: run npm run i18n:sync`).toEqual([]);
      report.push(`i18n ${g.group}: ${Object.keys(texts).length - missing - stale}/${Object.keys(texts).length} in Spanish`
        + `${missing ? `, ${missing} missing` : ''}${stale ? `, ${stale} stale` : ''}`);
      if (SYNC) {
        const next: Overlay = {};
        for (const [path, en] of Object.entries(texts)) next[path] = overlay[path] ?? { en, es: '' };
        writeFileSync(new URL(`../src/i18n/es/data/${g.group}.json`, import.meta.url), `${JSON.stringify(next, null, 2)}\n`);
      }
    }
  });

  it('leaves the English untouched, and shows no stale translation', () => {
    setLang('es');
    try {
      const copy = localizeData('techTree', techTree);
      expect(copy).not.toBe(techTree);
      const [path, e] = Object.entries(OVERLAYS.techTree).find(([, x]) => x.es !== '') ?? [];
      if (path !== undefined && e !== undefined) {
        const id = path.split('.')[1];
        const field = path.split('.')[2] as 'name';
        const english = (techTree.technologies as unknown as Record<string, Record<string, string>>)[id][field];
        expect(english).toBe(e.en);
        expect((copy.technologies as unknown as Record<string, Record<string, string>>)[id][field])
          .toBe(e.en === english ? e.es : english);
      }
    } finally {
      setLang('en');
    }
  });
});
