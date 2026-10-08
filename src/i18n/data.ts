// THE DATA IN THE PLAYER'S LANGUAGE (Docs/features/28-languages.md §3).
//
// The English in `src/sim/data/` stays the source, edited in `?dev=data`. The
// Spanish lives beside it, one overlay per group (`es/data/<group>.json`):
// for each text it localizes, the path, the English it was translated FROM,
// and the Spanish. `definitions.ts` reads a localized COPY — the editors keep
// the English — and a text whose English has changed since is shown in
// English until it is translated again: a stale translation never shows.
//
// `npm run i18n:sync` adds every new text to its overlay and reports what is
// missing or stale.

import { currentLang } from './lang';
import districts from './es/data/districts.json';
import goods from './es/data/goods.json';
import items from './es/data/items.json';
import quests from './es/data/quests.json';
import store from './es/data/store.json';
import speakers from './es/data/speakers.json';
import unlocks from './es/data/unlocks.json';
import villains from './es/data/villains.json';
import worldBuild from './es/data/worldBuild.json';
import scenes from './es/data/scenes.json';
import regionMap from './es/data/regionMap.json';
import techTree from './es/data/techTree.json';

export interface OverlayEntry { en: string; es: string }
export type Overlay = Record<string, OverlayEntry>;

/** The data documents a group reads from. */
export type DataDoc = 'balance' | 'regionMap' | 'techTree';

/** Which texts each group localizes, as paths with `*` for any key or
 *  element. An element of a list is named by its `id` when it has one, so a
 *  reordered list keeps its translations. */
export const DATA_GROUPS: ReadonlyArray<{ group: string; doc: DataDoc; paths: readonly string[] }> = [
  { group: 'districts', doc: 'balance', paths: ['districts.*.name', 'districts.*.promise', 'districts.*.description'] },
  { group: 'goods', doc: 'balance', paths: ['goods.*.name'] },
  { group: 'items', doc: 'balance', paths: ['items.*.name'] },
  { group: 'quests', doc: 'balance', paths: ['quests.*.name'] },
  { group: 'store', doc: 'balance', paths: ['store.*.name', 'store.*.description'] },
  { group: 'speakers', doc: 'balance', paths: ['speakers.*.name', 'speakers.*.title'] },
  { group: 'unlocks', doc: 'balance', paths: ['unlocks.*.title', 'unlocks.*.text'] },
  { group: 'villains', doc: 'balance', paths: ['villains.*.name'] },
  { group: 'worldBuild', doc: 'balance', paths: ['worldBuild.districts.*.name', 'worldBuild.upgrades.*.name'] },
  { group: 'scenes', doc: 'balance', paths: ['scenes.*.lines.*.text'] },
  { group: 'regionMap', doc: 'regionMap', paths: ['lairs.*.flavour', 'abandoned.*.name'] },
  { group: 'techTree', doc: 'techTree', paths: ['technologies.*.name', 'technologies.*.description'] },
];

export const OVERLAYS: Record<string, Overlay> = {
  districts, goods, items, quests, store, speakers, unlocks, villains, worldBuild, scenes, regionMap, techTree,
};

type Node = unknown;

/** A list element's name in a path: its `id`, else its index. */
const keyOf = (el: Node, i: number): string => {
  const id = (el as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : String(i);
};

/** Every non-empty text a pattern reaches: [path, the holder, its key]. */
function reach(root: Node, pattern: string): Array<[string, Record<string | number, unknown>, string | number]> {
  const out: Array<[string, Record<string | number, unknown>, string | number]> = [];
  const walk = (node: Node, segs: string[], path: string[]): void => {
    if (node === null || typeof node !== 'object') return;
    const [seg, ...rest] = segs;
    const children: Array<[string, string | number]> = Array.isArray(node)
      ? node.map((el, i) => [keyOf(el, i), i] as [string, number])
      : Object.keys(node).map((k) => [k, k] as [string, string]);
    for (const [name, key] of children) {
      if (seg !== '*' && seg !== name) continue;
      const child = (node as Record<string | number, unknown>)[key];
      if (rest.length === 0) {
        if (typeof child === 'string' && child.trim() !== '') {
          out.push([[...path, name].join('.'), node as Record<string | number, unknown>, key]);
        }
      } else {
        walk(child, rest, [...path, name]);
      }
    }
  };
  walk(root, pattern.split('.'), []);
  return out;
}

/** Every text a document's groups localize, by group: path → its English. */
export function dataTexts(doc: DataDoc, data: Node): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const g of DATA_GROUPS.filter((x) => x.doc === doc)) {
    const texts: Record<string, string> = {};
    for (const p of g.paths) for (const [path, holder, key] of reach(data, p)) texts[path] = holder[key] as string;
    out[g.group] = texts;
  }
  return out;
}

/** A copy of `data` in the player's language — the original untouched, and
 *  itself when the language is English. */
export function localizeData<T>(doc: DataDoc, data: T): T {
  if (currentLang() === 'en') return data;
  const copy = structuredClone(data);
  for (const g of DATA_GROUPS.filter((x) => x.doc === doc)) {
    const overlay = OVERLAYS[g.group] ?? {};
    for (const p of g.paths) {
      for (const [path, holder, key] of reach(copy, p)) {
        const e = overlay[path];
        if (e !== undefined && e.es !== '' && e.en === holder[key]) holder[key] = e.es;
      }
    }
  }
  return copy;
}
