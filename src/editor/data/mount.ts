// `?dev=data` — every number in the game, in one tool.
//
// The replacement for the balance workbook (Docs/plans/data-editor.md). This
// is PHASE 1: the tool reads `balance.json` as the workbook generates it,
// edits it in memory, validates it against `sim/data/dataRules.ts` and shows
// the diff — but does not write it, because `npm run dev` regenerates that
// file from `balance.xlsx` and would silently throw the edit away. Saving
// arrives with the migration, when JSON becomes the source.
//
// Layout: a RAIL of collections grouped by game domain; a BREADCRUMB whose
// every crumb goes up and whose ▾ lists its siblings; a MAIN view chosen by
// the collection's kind (entity, table, ordered list, settings form); an
// INSPECTOR for the selected entry — its fields, what it points to, what uses
// it, and its problems. Ctrl K jumps anywhere. Every screen is a URL hash.

import './data.css';
import balance from '../../sim/data/balance.json';
import techTree from '../../sim/data/tech-tree.json';
import {
  COLLECTIONS, DOMAINS, QUEST_GOALS, REF_COLLECTION, collectionById, entriesOf, getAt, isListCollection,
  refIds, refsIn, schemaOf, validateData,
  type CollectionDef, type DataDoc, type DataIssue, type FieldSpec, type RefKind,
} from '../../sim/data/dataRules';
import { ARTIFACTS, CURRENCIES, DISTRICTS, HEROES, UNITS } from '../../sim/data/definitions';
import type { QuestGoalType } from '../../sim/data/definitions';
import { questLine } from '../../sim/questProse';
import { spriteUrl } from '../../render/sprites';
import { CREW } from '../../render/cast';
import { DataModel, type Change, type Path } from './doc';

// ------------------------------------------------------------------ helpers

type Kid = Node | string | null | undefined | false;
type Attrs = Record<string, unknown>;

/** A DOM element. `on*` attrs are listeners; `class`, `style` and `data-*`
 *  are attributes; anything else is set as a PROPERTY (value, checked,
 *  disabled), so a select or an input reflects its value. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class' || k === 'style' || k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'title' || k === 'for' || k === 'type' || k === 'placeholder' || k === 'href' || k === 'src' || k === 'alt' || k === 'draggable') node.setAttribute(k, String(v));
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  return node;
}

const pathKey = (p: Path): string => p.map(String).join('.');
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Three significant figures — how a multiplied price reads in the game. */
const sig3 = (v: number): number => {
  if (v === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(v)));
  const p = 10 ** (3 - d);
  return Math.round(v * p) / p;
};

const fmt = (v: unknown): string => {
  if (typeof v === 'number') {
    if (Math.abs(v) >= 10000) return `${Math.round(v / 100) / 10}k`;
    return String(Math.round(v * 1000) / 1000);
  }
  if (v === null || v === undefined) return '·';
  if (typeof v === 'string') return v === '' ? '·' : v;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return JSON.stringify(v);
};

/** One line that says what a complex value holds, for a table cell. */
function summary(v: unknown): string {
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (v.every((x) => typeof x !== 'object' || x === null)) {
      const s = v.map(fmt).join(' · ');
      return s.length > 40 ? `${v.length} × [${fmt(v[0])} … ${fmt(v[v.length - 1])}]` : s;
    }
    return `${v.length} entries`;
  }
  if (isObj(v)) {
    const e = Object.entries(v);
    if (e.length === 0) return '—';
    if (e.every(([, x]) => typeof x !== 'object' || x === null)) return e.map(([k, x]) => `${fmt(x)} ${k}`).join(' · ');
    return `${e.length} fields`;
  }
  return fmt(v);
}

const NAMED: Record<string, Record<string, { name?: string }>> = {
  buildings: DISTRICTS as unknown as Record<string, { name?: string }>,
  units: UNITS as unknown as Record<string, { name?: string }>,
  heroes: HEROES as unknown as Record<string, { name?: string }>,
  artifacts: ARTIFACTS as unknown as Record<string, { name?: string }>,
  currencies: CURRENCIES as unknown as Record<string, { name?: string }>,
};

const KIND_LABEL: Record<string, string> = {
  entity: 'Entity', table: 'Table', ordered: 'Ordered list', form: 'Settings', canvas: 'Canvas',
};

/** Which collection holds the ids a ref kind names — the reverse of
 *  REF_COLLECTION, for "used by". */
const REF_OF_COLLECTION: Record<string, RefKind> = Object.fromEntries(
  Object.entries(REF_COLLECTION).map(([k, c]) => [c, k as RefKind]),
);

type TechDoc = { technologies: Record<string, { name?: string; unlocks?: Array<Record<string, unknown>> }> };
const TECHS = (techTree as unknown as TechDoc).technologies;

// ------------------------------------------------------------------- state

interface Route { c: string; e: string | null; t: string | null; v: string | null }

const ENTITY_TABS = ['levels', 'identity', 'visuals', 'adjacency', 'gates'] as const;
const TAB_LABEL: Record<string, string> = {
  levels: 'Levels', identity: 'Identity', visuals: 'Visuals', adjacency: 'Adjacency', gates: 'Gates',
};

export function mountEditor(): void {
  document.getElementById('app')?.setAttribute('hidden', '');
  document.getElementById('ui')?.setAttribute('hidden', '');
  document.title = 'Kingdom — data';

  const model = new DataModel(balance as unknown as DataDoc);
  let issues: DataIssue[] = validateData(model.doc, model.reference);
  let changed = new Set<string>();

  const ui = {
    menu: null as null | { id: string; x: number; y: number; filter: string },
    palette: null as null | { q: string; i: number },
    diffOpen: false,
    ordinal: 1,
    chartCol: 'cost:Wood',
    gridField: 'cost:Wood',
    gridMode: 'value' as 'value' | 'step',
    gridSel: new Set<string>(),
    gridAnchor: null as null | { r: number; c: number },
    bulk: '1.1',
    dragFrom: -1,
  };

  const parseRoute = (): Route => {
    const parts = location.hash.replace(/^#/, '').split('/').map(decodeURIComponent);
    const c = collectionById(parts[0] ?? '') ? parts[0] : 'buildings';
    return { c, e: parts[1] || null, t: parts[2] || null, v: parts[3] || null };
  };
  let route = parseRoute();
  const go = (r: Partial<Route>): void => {
    const next = { ...route, ...r };
    if (r.c !== undefined && r.c !== route.c) {
      next.e = r.e ?? null; next.t = r.t ?? null; next.v = r.v ?? null;
    }
    const hash = '#' + [next.c, next.e ?? '', next.t ?? '', next.v ?? '']
      .map((s) => encodeURIComponent(s)).join('/').replace(/\/+$/, '');
    if (location.hash !== hash) history.pushState(null, '', hash);
    route = next;
    ui.menu = null;
    render();
  };
  // popstate covers back/forward; hashchange covers a hash typed or pasted in.
  window.addEventListener('popstate', () => { route = parseRoute(); render(); });
  window.addEventListener('hashchange', () => { route = parseRoute(); render(); });

  const root = h('div', { class: 'dx' });
  const top = h('header', { class: 'dx-top' });
  const rail = h('nav', { class: 'dx-rail', 'aria-label': 'Game data' });
  const main = h('main', { class: 'dx-main' });
  const side = h('aside', { class: 'dx-side', 'aria-label': 'Inspector' });
  const status = h('footer', { class: 'dx-status mono' });
  const layer = h('div');
  root.append(top, rail, main, side, status, layer);
  document.body.append(root);

  model.onChange(() => {
    issues = validateData(model.doc, model.reference);
    changed = new Set(model.diff().map((c) => pathKey(c.path)));
    render();
  });

  const coll = (): CollectionDef => collectionById(route.c)!;
  const specCache = new Map<string, FieldSpec>();
  const specOf = (c: CollectionDef): FieldSpec => {
    if (!specCache.has(c.id)) specCache.set(c.id, schemaOf(model.reference, c));
    return specCache.get(c.id)!;
  };
  /** The document path of an entry (or of a form collection's root). */
  const entryPath = (c: CollectionDef, id: string): Path =>
    isListCollection(model.doc, c) ? [c.source!, Number(id)] : [c.source!, id];

  const nameOf = (c: CollectionDef, id: string, value?: unknown): string => {
    const v = value ?? (c.source ? getAt(model.doc, entryPath(c, id)) : undefined);
    const own = isObj(v) && typeof v.name === 'string' ? v.name : undefined;
    const named = NAMED[c.id]?.[id]?.name;
    if (isListCollection(model.doc, c)) {
      if (c.id === 'quests' && isObj(v)) return String(v.name ?? v.id);
      if (c.id === 'depths' && isObj(v)) return `${v.ruin} · depth ${v.depth}`;
      if (c.id === 'garrisons' && isObj(v)) return `Tier ${v.tier}`;
      if (c.id === 'adjacency' && isObj(v)) return `${v.district} ← ${v.neighbor}`;
      return `#${Number(id) + 1}`;
    }
    return own ?? named ?? id;
  };

  const issuesOf = (cid: string, entry: string | null): DataIssue[] =>
    issues.filter((i) => i.collection === cid && (entry === undefined || i.entry === entry));
  const collIssues = (cid: string) => issues.filter((i) => i.collection === cid);
  const collDirty = (c: CollectionDef): boolean => {
    const keys = c.source ? [c.source] : (c.groups ?? []);
    return [...changed].some((k) => keys.some((s) => k === s || k.startsWith(s + '.')));
  };

  // ------------------------------------------------------------- rendering

  let focusKey: string | null = null;
  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    focusKey = active?.dataset?.k ?? null;
    const c = coll();
    root.classList.toggle('dx-noside', c.view === 'form' || c.view === 'canvas' || (c.view === 'entity' && route.v === 'grid'));
    const put = (el: HTMLElement, kids: Kid[]) =>
      el.replaceChildren(...kids.filter((k): k is Node | string => k !== null && k !== undefined && k !== false));
    put(top, renderTop(c));
    put(rail, renderRail());
    put(main, renderMain(c));
    put(side, renderSide(c));
    put(status, renderStatus());
    put(layer, renderLayer());
    if (focusKey) {
      const el = root.querySelector<HTMLElement>(`[data-k="${CSS.escape(focusKey)}"]`);
      el?.focus();
    }
  }

  // ---- top bar

  function renderTop(c: CollectionDef): Kid[] {
    const crumbs: Array<{ id: string; text: string }> = [
      { id: 'domain', text: c.domain },
      { id: 'coll', text: c.label },
    ];
    if (route.e !== null && c.source) crumbs.push({ id: 'entry', text: nameOf(c, route.e) });
    if (c.view === 'entity' && route.e !== null && (route.v ?? 'entry') === 'entry') {
      crumbs.push({ id: 'tab', text: TAB_LABEL[route.t ?? 'levels'] });
    }
    if (route.v === 'grid' || route.v === 'schema') crumbs.push({ id: 'view', text: route.v === 'grid' ? 'Grid' : 'Schema' });
    const nav = h('nav', { class: 'dx-crumbs', 'aria-label': 'Breadcrumb' });
    crumbs.forEach((cr, i) => {
      if (i) nav.append(h('span', { class: 'dx-sep', 'aria-hidden': 'true' }, '›'));
      nav.append(h('button', {
        class: 'dx-crumb' + (i === crumbs.length - 1 ? ' last' : ''),
        'aria-haspopup': 'menu', 'aria-expanded': String(ui.menu?.id === cr.id),
        onclick: (ev: MouseEvent) => {
          const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
          ui.menu = ui.menu?.id === cr.id ? null : { id: cr.id, x: r.left, y: r.bottom + 4, filter: '' };
          render();
        },
      }, cr.text, h('span', { class: 'car', 'aria-hidden': 'true' }, '▾')));
    });
    const errs = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errs;
    const nChanges = changed.size;
    return [
      h('div', { class: 'dx-brand mono' }, 'KINGDOM · DATA'),
      nav,
      h('div', { class: 'dx-spacer' }),
      h('button', { class: 'dx-jump', onclick: () => { ui.palette = { q: '', i: 0 }; render(); } },
        h('span', {}, 'Jump to anything…'), h('span', { class: 'dx-kbd mono' }, 'Ctrl K')),
      h('button', { class: 'dx-btn sm', disabled: !model.canUndo(), title: 'Undo (Ctrl Z)', onclick: () => model.undo() }, 'Undo'),
      h('button', { class: 'dx-btn sm', disabled: !model.canRedo(), title: 'Redo (Ctrl Shift Z)', onclick: () => model.redo() }, 'Redo'),
      h('button', { class: 'dx-btn' + (nChanges ? ' warn' : ''), disabled: nChanges === 0, onclick: () => { ui.diffOpen = true; render(); } },
        nChanges === 0 ? 'No changes' : `${nChanges} unsaved`),
      errs ? h('span', { class: 'dx-chip err' }, `${errs} error${errs === 1 ? '' : 's'}`) : h('span', { class: 'dx-chip ok' }, '0 errors'),
      warns ? h('span', { class: 'dx-chip wrn' }, `${warns} warning${warns === 1 ? '' : 's'}`) : null,
      h('button', {
        class: 'dx-btn primary', disabled: true,
        title: 'Saving arrives with the migration (phase 3). Until then balance.xlsx is the source: "N unsaved" lists what to carry over.',
      }, 'Save'),
    ];
  }

  function menuItems(id: string): Array<{ text: string; n?: string; on: boolean; act: () => void }> {
    const c = coll();
    if (id === 'domain') {
      return DOMAINS.map((d) => ({
        text: d, n: String(COLLECTIONS.filter((x) => x.domain === d).length), on: d === c.domain,
        act: () => go({ c: COLLECTIONS.find((x) => x.domain === d)!.id }),
      }));
    }
    if (id === 'coll') {
      return COLLECTIONS.filter((x) => x.domain === c.domain).map((x) => ({
        text: x.label, n: countOf(x), on: x.id === c.id, act: () => openCollection(x),
      }));
    }
    if (id === 'entry') {
      return entriesOf(model.doc, c).map(([eid, v]) => ({
        text: nameOf(c, eid, v), on: eid === route.e, act: () => go({ e: eid }),
      }));
    }
    if (id === 'tab') {
      return ENTITY_TABS.map((t) => ({ text: TAB_LABEL[t], on: (route.t ?? 'levels') === t, act: () => go({ t, v: null }) }));
    }
    if (id === 'view') {
      return viewsOf(c).map(([v, label]) => ({ text: label, on: (route.v ?? viewsOf(c)[0][0]) === v, act: () => go({ v: v === viewsOf(c)[0][0] ? null : v }) }));
    }
    return [];
  }

  const countOf = (x: CollectionDef): string => (x.source ? String(entriesOf(model.doc, x).length) : '·');

  function openCollection(x: CollectionDef): void {
    if (x.view === 'canvas') { location.href = location.pathname + x.href; return; }
    go({ c: x.id });
  }

  // ---- rail

  function renderRail(): Kid[] {
    const out: Kid[] = DOMAINS.map((d) => h('div', { class: 'dx-rail-group' },
      h('div', { class: 'sec' }, d),
      ...COLLECTIONS.filter((x) => x.domain === d).map((x) => {
        const iss = collIssues(x.id);
        return h('button', {
          class: 'dx-rail-item' + (x.id === route.c ? ' on' : ''),
          'aria-current': x.id === route.c ? 'page' : undefined,
          title: x.view === 'canvas' ? `Opens ${x.href} — it moves inside Data in phase 2` : undefined,
          onclick: () => openCollection(x),
        },
        h('span', { class: `dx-kind ${x.view}` }),
        h('span', { class: 'name' }, x.label),
        collDirty(x) ? h('span', { class: 'dx-dot dirty', 'aria-label': 'unsaved changes' }) : null,
        iss.some((i) => i.level === 'error') ? h('span', { class: 'dx-dot err', 'aria-label': 'has errors' })
          : iss.length ? h('span', { class: 'dx-dot wrn', 'aria-label': 'has warnings' }) : null,
        h('span', { class: 'n mono' }, countOf(x)));
      })));
    out.push(h('div', { class: 'dx-legend' },
      ...Object.entries(KIND_LABEL).map(([k, label]) => h('span', {}, h('span', { class: `dx-kind ${k}` }), label))));
    return out;
  }

  // ---- main

  function viewsOf(c: CollectionDef): Array<[string, string]> {
    if (c.view === 'entity') return [['entry', 'Entry'], ['grid', 'Grid'], ['schema', 'Schema']];
    if (c.view === 'ordered') return [['list', 'List'], ['schema', 'Schema']];
    if (c.view === 'table') return [['table', 'Table'], ['schema', 'Schema']];
    if (c.view === 'form') return [['fields', 'Fields'], ['schema', 'Schema']];
    return [];
  }

  function header(c: CollectionDef, extra: Kid[] = []): HTMLElement {
    const views = viewsOf(c);
    const cur = route.v ?? views[0]?.[0];
    return h('div', { class: 'dx-head' },
      h('div', {},
        h('div', { class: 'dx-title' }, c.label),
        h('div', { class: 'dx-sub' }, `${KIND_LABEL[c.view]} · `,
          h('span', { class: 'mono' }, c.source ? `balance.json › ${c.source}` : c.groups ? `balance.json › ${c.groups.join(', ')}` : c.href ?? ''))),
      h('div', { class: 'dx-spacer' }),
      ...extra,
      views.length > 1 ? h('div', { class: 'dx-seg', role: 'tablist' },
        ...views.map(([v, label]) => h('button', {
          class: cur === v ? 'on' : '', role: 'tab', 'aria-selected': String(cur === v),
          onclick: () => go({ v: v === views[0][0] ? null : v }),
        }, label))) : null);
  }

  function renderMain(c: CollectionDef): Kid[] {
    if (c.view === 'canvas') {
      return [header(c), h('div', { class: 'dx-card dx-pad' },
        h('p', { class: 'dx-note' }, `${c.label} is authored on a board, not in a table. It still opens in its own editor; it moves inside Data in phase 2.`),
        h('a', { class: 'dx-btn primary', href: location.pathname + c.href, style: 'display:inline-flex;align-items:center;text-decoration:none' }, `Open ${c.label}`))];
    }
    if (route.v === 'schema') return [header(c), renderSchema(c)];
    if (c.view === 'form') return [header(c), renderForm(c)];
    if (c.view === 'entity') return route.v === 'grid' ? [header(c), ...renderGrid(c)] : [header(c), renderEntity(c)];
    return [header(c, [addButton(c)]), renderTable(c)];
  }

  // ---- generic field editor

  const issueAt = (cid: string, entry: string | null, p: Path): DataIssue | undefined =>
    issues.find((i) => i.collection === cid && i.entry === entry && pathKey(i.path) === pathKey(p));

  /**
   * An editor for one value. `docPath` addresses it in the document; `rel` is
   * the same place relative to the entry, for matching issues.
   */
  function field(cid: string, entry: string | null, spec: FieldSpec, docPath: Path, rel: Path, label: string, compact = false): HTMLElement {
    const value = model.get(docPath);
    const iss = issueAt(cid, entry, rel);
    const k = pathKey(docPath);
    const isChanged = changed.has(k) || [...changed].some((x) => x.startsWith(k + '.'));
    const wrap = (control: Kid, full = false): HTMLElement => h('div', { class: 'dx-field', style: full ? 'grid-column: 1 / -1' : undefined },
      h('div', { class: 'lbl' }, h('span', { class: 'mono' }, label), h('span', { class: 'faint' }, typeLabel(spec))),
      control,
      spec.doc && !compact ? h('div', { class: 'doc' }, spec.doc) : null,
      iss ? h('div', { class: 'msg' }, iss.message) : null);
    const cls = (base: string) => base + (isChanged ? ' changed' : '') + (iss ? ' bad' : '');

    switch (spec.type) {
      case 'int':
      case 'float':
        return wrap(numInput(docPath, value, cls('dx-in num'), spec));
      case 'bool':
        return wrap(h('label', { class: 'dx-row' },
          h('input', { type: 'checkbox', checked: value === true, 'data-k': k, onchange: (e: Event) => model.set(docPath, (e.target as HTMLInputElement).checked) }),
          h('span', { class: 'dim' }, value ? 'on' : 'off')));
      case 'text':
        return wrap(textInput(docPath, value, spec, cls('dx-in')));
      case 'list': {
        const list = Array.isArray(value) ? value : [];
        const of = spec.of ?? { type: 'unknown' };
        if (of.type === 'int' || of.type === 'float' || of.type === 'text' || of.type === 'unknown') {
          return wrap(h('div', {},
            h('div', { class: 'dx-cells' }, ...list.map((x, i) => h('div', {},
              h('div', { class: 'ix' }, String(i + 1)),
              of.type === 'text' ? textInput([...docPath, i], x, of, 'dx-cell text' + (changed.has(pathKey([...docPath, i])) ? ' changed' : ''))
                : numInput([...docPath, i], x, 'dx-cell' + (changed.has(pathKey([...docPath, i])) ? ' changed' : ''), of)))),
            h('div', { class: 'dx-row', style: 'margin-top:4px' },
              h('button', { class: 'dx-btn sm', onclick: () => model.set(docPath, [...list, list.length ? list[list.length - 1] : blank(of)]) }, '+'),
              h('button', { class: 'dx-btn sm', disabled: list.length === 0, onclick: () => model.set(docPath, list.slice(0, -1)) }, '−'),
              h('span', { class: 'faint', style: 'font-size:11px' }, `${list.length} entries`))), true);
        }
        return wrap(h('div', { class: 'dx-group' },
          ...list.map((x, i) => h('div', { class: 'dx-group' },
            h('div', { class: 'sec' }, h('span', {}, `#${i + 1}`), h('button', { class: 'dx-x', 'aria-label': `Remove #${i + 1}`, onclick: () => model.set(docPath, list.filter((_, j) => j !== i)) }, '×')),
            of.type === 'object' ? objectFields(cid, entry, of, [...docPath, i], [...rel, i], x) : field(cid, entry, of, [...docPath, i], [...rel, i], `#${i + 1}`, true))),
          h('button', { class: 'dx-btn sm dash', onclick: () => model.set(docPath, [...list, list.length ? structuredClone(list[list.length - 1]) : blank(of)]) }, '+ Add')), true);
      }
      case 'map': {
        const map = isObj(value) ? value : {};
        const of = spec.of ?? { type: 'unknown' };
        const keys = spec.keysRef ? refIds(model.doc, spec.keysRef) : [];
        const free = keys.filter((x) => !(x in map));
        return wrap(h('div', { class: 'dx-group' },
          ...Object.keys(map).map((key) => h('div', { class: 'dx-row' },
            h('span', { class: 'dx-chip', style: 'width:110px;justify-content:center' }, key),
            h('div', { style: 'flex:1' }, of.type === 'int' || of.type === 'float' || of.type === 'unknown'
              ? numInput([...docPath, key], map[key], 'dx-in num' + (changed.has(pathKey([...docPath, key])) ? ' changed' : ''), of)
              : field(cid, entry, of, [...docPath, key], [...rel, key], key, true)),
            h('button', { class: 'dx-x', 'aria-label': `Remove ${key}`, onclick: () => model.set([...docPath, key], undefined) }, '×'))),
          spec.keysRef
            ? (free.length ? h('select', {
              class: 'dx-in', value: '',
              onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) model.set([...docPath, v], blank(of)); },
            }, h('option', { value: '' }, `+ ${spec.keysRef}`), ...free.map((x) => h('option', { value: x }, x))) : null)
            : h('input', {
              class: 'dx-in', placeholder: '+ key, then Enter',
              onkeydown: (e: KeyboardEvent) => {
                const v = (e.target as HTMLInputElement).value.trim();
                if (e.key === 'Enter' && v && !(v in map)) model.set([...docPath, v], blank(of));
              },
            })), true);
      }
      case 'object':
        return wrap(h('div', { class: 'dx-group' }, objectFields(cid, entry, spec, docPath, rel, value)), true);
      default:
        return wrap(h('textarea', {
          class: cls('dx-in'), rows: 3, value: JSON.stringify(value), 'data-k': k,
          onchange: (e: Event) => { try { model.set(docPath, JSON.parse((e.target as HTMLTextAreaElement).value)); } catch { /* keep */ } },
        }), true);
    }
  }

  function objectFields(cid: string, entry: string | null, spec: FieldSpec, docPath: Path, rel: Path, value: unknown): HTMLElement {
    const obj = isObj(value) ? value : {};
    return h('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px' },
      ...Object.entries(spec.fields ?? {}).map(([fk, fs]) =>
        fk in obj || !fs.nullable ? field(cid, entry, fs, [...docPath, fk], [...rel, fk], fk)
          : h('div', { class: 'dx-field' }, h('div', { class: 'lbl' }, h('span', { class: 'mono' }, fk), h('span', { class: 'faint' }, 'optional')),
            h('button', { class: 'dx-btn sm dash', onclick: () => model.set([...docPath, fk], blank(fs)) }, '+ Add'))));
  }

  function numInput(p: Path, value: unknown, cls: string, spec: FieldSpec): HTMLInputElement {
    return h('input', {
      class: cls, type: 'text', inputMode: 'decimal', value: value === null || value === undefined ? '' : String(value),
      placeholder: spec.nullable ? (cls.includes('dx-cell') ? '·' : 'none') : '', 'data-k': pathKey(p),
      onchange: (e: Event) => {
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '') { model.set(p, spec.nullable ? null : 0); return; }
        const n = Number(raw.replace(',', '.'));
        if (Number.isFinite(n)) model.set(p, n); else render();
      },
      onkeydown: arrowNav,
    });
  }

  function textInput(p: Path, value: unknown, spec: FieldSpec, cls: string): HTMLElement {
    const opts = spec.options ?? (spec.ref ? refIds(model.doc, spec.ref) : null);
    if (opts) {
      const v = value === null || value === undefined ? '' : String(value);
      return h('select', {
        class: cls, value: v, 'data-k': pathKey(p),
        onchange: (e: Event) => { const x = (e.target as HTMLSelectElement).value; model.set(p, x === '' && spec.nullable ? null : x); },
      },
      spec.nullable || spec.emptyOk || !opts.includes(v) ? h('option', { value: '' }, spec.nullable || spec.emptyOk ? '— none —' : `(${v || 'empty'})`) : null,
      ...opts.map((o) => h('option', { value: o, selected: o === v }, o)));
    }
    return h('input', {
      class: cls, value: value === null || value === undefined ? '' : String(value), 'data-k': pathKey(p),
      onchange: (e: Event) => model.set(p, (e.target as HTMLInputElement).value),
    });
  }

  /** Arrow keys walk a table of cells the way a spreadsheet does. */
  function arrowNav(e: KeyboardEvent): void {
    if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return;
    const input = e.target as HTMLInputElement;
    const td = input.closest('td');
    const tr = td?.parentElement as HTMLTableRowElement | undefined;
    if (!td || !tr) return;
    const col = [...tr.children].indexOf(td);
    const nextRow = (e.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling) as HTMLTableRowElement | null;
    const target = nextRow?.children[col]?.querySelector<HTMLElement>('input,select');
    if (target) {
      e.preventDefault();
      input.dispatchEvent(new Event('change'));
      // The change re-renders; focus the cell below by its key afterwards.
      const k = target.dataset.k;
      requestAnimationFrame(() => root.querySelector<HTMLElement>(`[data-k="${CSS.escape(k ?? '')}"]`)?.focus());
    }
  }

  function typeLabel(s: FieldSpec): string {
    let t: string = s.type;
    if (s.type === 'text' && s.ref) t = `→ ${s.ref}`;
    else if (s.type === 'text' && s.options) t = 'one of';
    else if (s.type === 'map') t = s.keysRef ? `per ${s.keysRef}` : 'map';
    else if (s.type === 'list') t = `list${s.length?.sibling ? ' · per level' : s.length?.townhall ? ' · per TH level' : ''}`;
    if (s.min !== undefined || s.max !== undefined) t += ` · ${s.min ?? ''}…${s.max ?? ''}`;
    return t;
  }

  function blank(s: FieldSpec): unknown {
    if (s.nullable) return null;
    switch (s.type) {
      case 'int': case 'float': return s.min ?? 0;
      case 'text': return s.options?.[0] ?? (s.ref ? refIds(model.doc, s.ref)[0] ?? '' : '');
      case 'bool': return false;
      case 'list': return [];
      case 'map': return {};
      case 'object': return Object.fromEntries(Object.entries(s.fields ?? {}).filter(([, f]) => !f.nullable).map(([k, f]) => [k, blank(f)]));
      default: return null;
    }
  }

  // ---- table / ordered

  function addButton(c: CollectionDef): HTMLElement {
    return h('button', { class: 'dx-btn dash', onclick: () => addEntry(c) }, `+ ${c.noun}`);
  }

  function addEntry(c: CollectionDef, from?: string): void {
    const spec = specOf(c);
    const src = c.source!;
    if (isListCollection(model.doc, c)) {
      const list = model.get([src]) as unknown[];
      const at = from !== undefined ? Number(from) + 1 : list.length;
      const item = from !== undefined ? structuredClone(list[Number(from)]) : blank(spec);
      if (c.id === 'quests' && isObj(item)) item.id = uniqueQuestId(String(item.id ?? 'NewQuest'));
      model.set([src], [...list.slice(0, at), item, ...list.slice(at)]);
      go({ e: String(at) });
      return;
    }
    const map = model.get([src]) as Record<string, unknown>;
    let id = from ? `${from}Copy` : `New${c.noun[0].toUpperCase()}${c.noun.slice(1)}`;
    for (let n = 2; id in map; n++) id = (from ? `${from}Copy` : `New${c.noun[0].toUpperCase()}${c.noun.slice(1)}`) + n;
    model.set([src, id], from ? structuredClone(map[from]) : blank(spec));
    go({ e: id });
  }

  function uniqueQuestId(base: string): string {
    const ids = new Set((model.get(['quests']) as Array<{ id: string }>).map((q) => q.id));
    let id = `${base}Copy`;
    for (let n = 2; ids.has(id); n++) id = `${base}Copy${n}`;
    return id;
  }

  function removeEntry(c: CollectionDef, id: string): void {
    if (!confirm(`Remove ${nameOf(c, id)}? (Undo brings it back.)`)) return;
    const src = c.source!;
    if (isListCollection(model.doc, c)) {
      const list = model.get([src]) as unknown[];
      model.set([src], list.filter((_, i) => i !== Number(id)));
    } else model.set([src, id], undefined);
    go({ e: null });
  }

  /** A field whose meaning depends on its entry: a quest's target is a
   *  building, a technology, a currency or nothing, by its goal type. */
  function entrySpec(c: CollectionDef, value: unknown, key: string, spec: FieldSpec): FieldSpec {
    if (c.id === 'quests' && key === 'goalTarget' && isObj(value)) {
      const kind = QUEST_GOALS[String(value.goalType)];
      return kind ? { ...spec, ref: kind, nullable: false } : { ...spec, options: [], nullable: true };
    }
    return spec;
  }

  function renderTable(c: CollectionDef): HTMLElement {
    const spec = specOf(c);
    const fields = Object.entries(spec.fields ?? {});
    const scalar = fields.filter(([, f]) => ['int', 'float', 'text', 'bool'].includes(f.type));
    const complex = fields.filter(([, f]) => !['int', 'float', 'text', 'bool'].includes(f.type));
    const ordered = c.view === 'ordered';
    const isList = isListCollection(model.doc, c);
    const rows = entriesOf(model.doc, c);
    const table = h('table', { class: 'dx-table' },
      h('thead', {}, h('tr', {},
        ordered ? h('th', {}, '#') : null,
        isList ? null : h('th', {}, 'Id'),
        c.id === 'quests' ? h('th', {}, 'Reads as') : null,
        ...scalar.map(([k, f]) => h('th', { class: f.type === 'int' || f.type === 'float' ? 'num' : '' }, k)),
        ...complex.map(([k]) => h('th', {}, k)),
        null)),
      h('tbody', {}, ...rows.map(([id, v], idx) => {
        const base = entryPath(c, id);
        const rowIssues = issuesOf(c.id, id);
        const tr = h('tr', {
          class: 'row' + (route.e === id ? ' on' : ''),
          onclick: (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('input,select,button')) go({ e: id }); },
        },
        ordered ? h('td', { class: 'handle mono', title: 'Drag to reorder' }, `⋮⋮ ${idx + 1}`) : null,
        isList ? null : h('td', { class: 'id' }, id, rowIssues.length ? h('span', { class: `dx-dot ${rowIssues.some((i) => i.level === 'error') ? 'err' : 'wrn'}`, style: 'display:inline-block;margin-left:6px' }) : null),
        c.id === 'quests' ? h('td', { class: 'prose' }, questProse(v)) : null,
        ...scalar.map(([k, f]) => {
          const p = [...base, k];
          const bad = issueAt(c.id, id, [k]);
          const cls = 'dx-cell' + (f.type === 'text' ? ' text' : '') + (changed.has(pathKey(p)) ? ' changed' : '') + (bad ? ' bad' : '');
          const val = isObj(v) ? v[k] : undefined;
          if (f.type === 'bool') return h('td', {}, h('input', { type: 'checkbox', checked: val === true, 'data-k': pathKey(p), onchange: (e: Event) => model.set(p, (e.target as HTMLInputElement).checked) }));
          return h('td', { class: f.type === 'text' ? '' : 'num', title: bad?.message },
            f.type === 'text' ? textInput(p, val, entrySpec(c, v, k, f), cls) : numInput(p, val, cls, f));
        }),
        ...complex.map(([k]) => h('td', { class: 'summary' }, summary(isObj(v) ? v[k] : undefined))));
        if (ordered) {
          tr.draggable = true;
          tr.addEventListener('dragstart', () => { ui.dragFrom = idx; });
          tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.classList.add('dragover'); });
          tr.addEventListener('dragleave', () => tr.classList.remove('dragover'));
          tr.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = ui.dragFrom;
            ui.dragFrom = -1;
            if (from < 0 || from === idx) return;
            const list = [...(model.get([c.source!]) as unknown[])];
            const [moved] = list.splice(from, 1);
            list.splice(idx, 0, moved);
            model.set([c.source!], list);
            go({ e: String(idx) });
          });
        }
        return tr;
      })));
    return h('div', { class: 'dx-card', style: 'overflow:auto' }, table);
  }

  function questProse(v: unknown): string {
    if (!isObj(v)) return '';
    try {
      return questLine({
        goalType: v.goalType as QuestGoalType,
        goalTarget: (v.goalTarget as string | null) ?? null,
        goalAmount: Number(v.goalAmount),
        goalLevel: (v.goalLevel as number | null) ?? null,
      });
    } catch { return '—'; }
  }

  // ---- form

  function renderForm(c: CollectionDef): HTMLElement {
    const spec = specOf(c);
    return h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px;align-items:start' },
      ...(c.groups ?? []).map((g) => {
        const gs = spec.fields![g];
        const inner = gs.type === 'object'
          ? objectFields(c.id, null, gs, [g], [g], model.get([g]))
          : field(c.id, null, gs, [g], [g], g);
        return h('section', { class: 'dx-card dx-pad', style: 'display:flex;flex-direction:column;gap:10px' },
          h('div', { class: 'dx-row', style: 'justify-content:space-between' },
            h('b', {}, g), h('span', { class: 'faint mono', style: 'font-size:11px' }, gs.type === 'object' ? `${Object.keys(gs.fields ?? {}).length} fields` : gs.type)),
          inner);
      }));
  }

  // ---- schema

  function renderSchema(c: CollectionDef): HTMLElement {
    const rows: Array<[string, FieldSpec]> = [];
    const walk = (s: FieldSpec, p: string): void => {
      if (p) rows.push([p, s]);
      if (s.type === 'object') for (const [k, f] of Object.entries(s.fields ?? {})) walk(f, p ? `${p}.${k}` : k);
      if ((s.type === 'list' || s.type === 'map') && s.of && (s.of.type === 'object' || s.of.type === 'list' || s.of.type === 'map')) walk(s.of, `${p}.*`);
    };
    walk(specOf(c), '');
    const len = (s: FieldSpec) => {
      const l = s.length;
      if (!l) return '';
      if (l.exact !== undefined) return `= ${l.exact}`;
      const tgt = l.townhall ? 'Townhall max level' : `${l.sibling}${l.offset ? ` ${l.offset > 0 ? '+' : '−'} ${Math.abs(l.offset)}` : ''}`;
      return `${l.upTo ? '≤' : '='} ${tgt}${l.orEmpty ? ' or none' : ''}`;
    };
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
      h('p', { class: 'dx-note' }, 'What each field is. Inferred from the data and sharpened by the rules in src/sim/data/dataRules.ts. Adding a field from here arrives with the migration, when the schema becomes a file of its own.'),
      h('div', { class: 'dx-card', style: 'overflow:auto' }, h('table', { class: 'dx-table' },
        h('thead', {}, h('tr', {}, ...['Field', 'Type', 'Names', 'Range', 'Length', 'Optional', 'Means'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...rows.map(([p, s]) => h('tr', {},
          h('td', { class: 'id' }, p),
          h('td', { class: 'mono', style: 'color:var(--blue)' }, s.type),
          h('td', { class: 'mono dim' }, s.ref ?? s.keysRef ?? (s.options ? s.options.join(' · ') : '')),
          h('td', { class: 'mono dim' }, s.min !== undefined || s.max !== undefined ? `${s.min ?? ''} … ${s.max ?? ''}` : ''),
          h('td', { class: 'mono dim' }, len(s)),
          h('td', { class: 'dim' }, s.nullable ? 'yes' : ''),
          h('td', { class: 'dim', style: 'white-space:normal;min-width:280px' }, s.doc ?? '')))))));
  }

  // ---- entity (buildings)

  function renderEntity(c: CollectionDef): HTMLElement {
    const rows = entriesOf(model.doc, c);
    if (route.e === null || !rows.some(([id]) => id === route.e)) route = { ...route, e: rows[0]?.[0] ?? null };
    const id = route.e;
    const list = h('div', { class: 'dx-card' },
      h('div', { class: 'dx-list' },
        ...rows.map(([eid, v]) => {
          const bad = issuesOf(c.id, eid);
          return h('button', { class: eid === id ? 'on' : '', onclick: () => go({ e: eid }) },
            h('span', { class: 'name' }, nameOf(c, eid, v)),
            model.diffUnder([c.source!, eid]).length ? h('span', { class: 'dx-dot dirty' }) : null,
            bad.length ? h('span', { class: `dx-dot ${bad.some((i) => i.level === 'error') ? 'err' : 'wrn'}` }) : null);
        }),
        h('div', { class: 'dx-row', style: 'padding:6px 2px 2px' },
          h('button', { class: 'dx-btn sm dash', style: 'flex:1', onclick: () => addEntry(c) }, '+ New'),
          id ? h('button', { class: 'dx-btn sm', style: 'flex:1', onclick: () => addEntry(c, id) }, 'Duplicate') : null)));
    if (id === null) return h('div', { class: 'dx-entity' }, list, h('div', { class: 'dx-empty' }, 'No entries.'));
    const tab = (route.t ?? 'levels') as typeof ENTITY_TABS[number];
    const body = tab === 'levels' ? levelsTab(c, id) : tab === 'identity' ? identityTab(c, id)
      : tab === 'visuals' ? visualsTab(id) : tab === 'adjacency' ? adjacencyTab(id) : gatesTab(id);
    return h('div', { class: 'dx-entity' }, list,
      h('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:0' },
        h('div', { class: 'dx-row', style: 'justify-content:space-between' },
          h('div', {}, h('div', { class: 'dx-title' }, nameOf(c, id)), h('div', { class: 'dx-sub mono' }, id)),
          h('button', { class: 'dx-btn sm', onclick: () => removeEntry(c, id) }, 'Remove')),
        h('div', { class: 'dx-tabs', role: 'tablist' }, ...ENTITY_TABS.map((t) => h('button', {
          class: t === tab ? 'on' : '', role: 'tab', 'aria-selected': String(t === tab), onclick: () => go({ t: t === 'levels' ? null : t }),
        }, TAB_LABEL[t]))),
        body));
  }

  interface LevelCol { key: string; label: string; get: (lvl: number) => { path: Path | null; value: unknown }; spec: FieldSpec; kind: 'cost' | 'goods' | 'ladder' }

  /** The columns of a building's level table: every currency and good its
   *  costs name, then every per-level ladder it uses. */
  function levelColumns(c: CollectionDef, id: string): LevelCol[] {
    const spec = specOf(c);
    const b = model.get([c.source!, id]) as Record<string, unknown>;
    const costs = (b.costPerLevel as Array<{ cost: Record<string, number>; goods: Record<string, number> }>) ?? [];
    const curs = [...new Set(costs.flatMap((r) => Object.keys(r.cost ?? {})))];
    const goods = [...new Set(costs.flatMap((r) => Object.keys(r.goods ?? {})))];
    const num: FieldSpec = { type: 'int', min: 0 };
    const cols: LevelCol[] = [
      ...curs.map((cur) => ({
        key: `cost:${cur}`, label: cur, spec: num, kind: 'cost' as const,
        get: (l: number) => ({ path: [c.source!, id, 'costPerLevel', l - 1, 'cost', cur], value: costs[l - 1]?.cost?.[cur] }),
      })),
      ...goods.map((g) => ({
        key: `goods:${g}`, label: g, spec: num, kind: 'goods' as const,
        get: (l: number) => ({ path: [c.source!, id, 'costPerLevel', l - 1, 'goods', g], value: costs[l - 1]?.goods?.[g] }),
      })),
    ];
    for (const [k, f] of Object.entries(spec.fields ?? {})) {
      if (f.type !== 'list' || !f.length?.sibling || k === 'costPerLevel') continue;
      const arr = b[k];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const offset = f.length.offset ?? 0; // −1: entry 0 gates level 2
      cols.push({
        key: k, label: k.replace(/PerLevel$/, ''), spec: f.of ?? num, kind: 'ladder',
        get: (l: number) => {
          const i = l - 1 + offset;
          return i < 0 ? { path: null, value: undefined } : { path: [c.source!, id, k, i], value: arr[i] };
        },
      });
    }
    return cols;
  }

  function levelsTab(c: CollectionDef, id: string): HTMLElement {
    const b = model.get([c.source!, id]) as Record<string, unknown>;
    const maxLevel = Number(b.maxLevel) || 1;
    const cols = levelColumns(c, id);
    const mult = Number(b.instanceLinearGrowth ?? 0) * (ui.ordinal - 1) + Number(b.instanceExponentialGrowth ?? 1) ** (ui.ordinal - 1);
    const chart = cols.find((x) => x.key === ui.chartCol) ?? cols[0];
    const spec = specOf(c);
    const unused = Object.entries(spec.fields ?? {})
      .filter(([k, f]) => f.type === 'list' && f.length?.sibling && k !== 'costPerLevel' && Array.isArray(b[k]) && (b[k] as unknown[]).length === 0)
      .map(([k]) => k);
    const costs = (b.costPerLevel as Array<{ cost: Record<string, number>; goods: Record<string, number> }>) ?? [];
    const usedCur = new Set(costs.flatMap((r) => Object.keys(r.cost ?? {})));
    const usedGood = new Set(costs.flatMap((r) => Object.keys(r.goods ?? {})));

    const table = h('table', { class: 'dx-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Lv'),
        ...cols.map((col) => h('th', {
          class: 'num', style: `cursor:pointer;${col.key === chart?.key ? 'color:var(--accent)' : ''}`,
          title: 'Chart this column', onclick: () => { ui.chartCol = col.key; render(); },
        }, col.label, col.kind === 'goods' ? h('span', { class: 'faint' }, ' ◆') : null)))),
      h('tbody', {}, ...Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => h('tr', {},
        h('td', { class: 'mono dim' }, `L${lvl}`),
        ...cols.map((col) => {
          const { path, value } = col.get(lvl);
          if (path === null) return h('td', { class: 'num faint' }, '·');
          const iss = issues.find((x) => x.collection === c.id && x.entry === id && pathKey(x.path) === pathKey(path.slice(2)));
          if (col.kind === 'cost' && ui.ordinal > 1) {
            return h('td', { class: 'num mono dim', title: `authored ${fmt(value)} × ${mult.toFixed(2)}` }, value === undefined ? '·' : fmt(sig3(Number(value) * mult)));
          }
          return h('td', { class: 'num', title: iss?.message },
            numInput(path, value, 'dx-cell' + (changed.has(pathKey(path)) ? ' changed' : '') + (iss ? ' bad' : ''), { ...col.spec, nullable: col.kind !== 'ladder' }));
        })))));

    const vals = chart ? Array.from({ length: maxLevel }, (_, i) => Number(chart.get(i + 1).value ?? 0)) : [];
    const pos = vals.filter((v) => v > 0);
    const lo = Math.log(Math.min(...pos, 1)), hi = Math.log(Math.max(...pos, 1));
    const logScale = pos.length > 1 && hi - lo > Math.log(8);
    const bars = h('div', { class: 'dx-bars', 'aria-label': `${chart?.label} by level` },
      ...vals.map((v) => h('div', {
        title: fmt(v),
        style: `height:${v <= 0 ? 2 : Math.round(6 + (logScale ? (Math.log(v) - lo) / (hi - lo || 1) : v / (Math.max(...vals) || 1)) * 80)}px`,
      })));

    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'dx-row', style: 'flex-wrap:wrap;gap:10px' },
        h('span', { class: 'dim' }, 'Preview instance'),
        h('div', { class: 'dx-seg' }, ...[1, 2, 3, 5].map((n) => h('button', { class: ui.ordinal === n ? 'on' : '', onclick: () => { ui.ordinal = n; render(); } }, `#${n}`))),
        h('span', { class: 'mono dim', style: 'font-size:12px' }, `×${mult.toFixed(2)} on currencies`),
        h('div', { class: 'dx-spacer' }),
        h('button', { class: 'dx-btn sm', onclick: () => addLevel(c, id, +1) }, '+ Level'),
        h('button', { class: 'dx-btn sm', disabled: maxLevel <= 1, onclick: () => addLevel(c, id, -1) }, '− Level')),
      h('div', { class: 'dx-card', style: 'overflow:auto' }, table),
      h('div', { class: 'dx-row', style: 'flex-wrap:wrap;gap:6px' },
        pickerSelect('+ currency', refIds(model.doc, 'currency').filter((x) => !usedCur.has(x)), (cur) =>
          model.set([c.source!, id, 'costPerLevel', 0, 'cost', cur], 0)),
        pickerSelect('+ good', refIds(model.doc, 'good').filter((x) => !usedGood.has(x)), (g) =>
          model.set([c.source!, id, 'costPerLevel', 0, 'goods', g], 0)),
        pickerSelect('+ ladder', unused, (k) => {
          const f = spec.fields![k];
          model.set([c.source!, id, k], Array(Math.max(0, maxLevel + (f.length?.offset ?? 0))).fill(0));
        })),
      chart ? h('div', { class: 'dx-card dx-pad', style: 'display:flex;flex-direction:column;gap:6px' },
        h('div', { class: 'dx-row', style: 'justify-content:space-between' },
          h('span', { class: 'sec' }, `${chart.label} by level · drawn from the table`),
          h('span', { class: 'faint mono', style: 'font-size:11px' }, logScale ? 'log scale' : 'linear')),
        bars) : null,
      h('p', { class: 'dx-note' }, 'The chart only draws the table. Click a column header to chart it; ↑ ↓ Enter walk the cells.'));
  }

  function pickerSelect(label: string, options: readonly string[], pick: (v: string) => void): HTMLElement | null {
    if (options.length === 0) return null;
    return h('select', {
      class: 'dx-btn sm', value: '', style: 'height:26px',
      onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) pick(v); },
    }, h('option', { value: '' }, label), ...options.map((o) => h('option', { value: o }, o)));
  }

  /** Grow or shrink a building by one level, keeping every ladder in step:
   *  a new level repeats the last one, so it starts as a copy to edit. */
  function addLevel(c: CollectionDef, id: string, delta: 1 | -1): void {
    const base = [c.source!, id];
    const b = model.get(base) as Record<string, unknown>;
    const maxLevel = Number(b.maxLevel);
    const spec = specOf(c);
    model.batch(() => {
      model.set([...base, 'maxLevel'], maxLevel + delta);
      for (const [k, f] of Object.entries(spec.fields ?? {})) {
        const arr = b[k];
        if (!Array.isArray(arr) || f.type !== 'list' || !f.length?.sibling) continue;
        if (arr.length === 0 && k !== 'costPerLevel') continue;
        const want = maxLevel + delta + (f.length.offset ?? 0);
        if (delta > 0 && arr.length === want - 1) model.set([...base, k], [...arr, structuredClone(arr[arr.length - 1])]);
        if (delta < 0 && arr.length > want) model.set([...base, k], arr.slice(0, Math.max(0, want)));
      }
    });
  }

  function identityTab(c: CollectionDef, id: string): HTMLElement {
    const spec = specOf(c);
    const b = model.get([c.source!, id]) as Record<string, unknown>;
    const fields = Object.entries(spec.fields ?? {}).filter(([k, f]) => !(f.type === 'list' && f.length?.sibling) && k !== 'maxCountPerTownhallLevel');
    const renameRow = renameField(c, id);
    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      renameRow,
      h('div', { class: 'dx-card dx-pad' },
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px' },
          ...fields.map(([k, f]) => field(c.id, id, f, [c.source!, id, k], [k], k)))),
      spec.fields?.maxCountPerTownhallLevel ? h('div', { class: 'dx-card dx-pad' },
        field(c.id, id, spec.fields.maxCountPerTownhallLevel, [c.source!, id, 'maxCountPerTownhallLevel'], ['maxCountPerTownhallLevel'], 'maxCountPerTownhallLevel · one per Townhall level; a short list repeats its last')) : null,
      b.name === undefined ? h('p', { class: 'dx-note' }, `Name, description and glyph still live in definitions.ts ("${nameOf(c, id)}"); they become fields here in phase 3.`) : null);
  }

  function visualsTab(id: string): HTMLElement {
    const def = (DISTRICTS as unknown as Record<string, { sprite?: string; maxLevel?: number }>)[id];
    const sprite = def?.sprite;
    const maxLevel = Number(model.get(['districts', id, 'maxLevel'])) || 1;
    const tiers: Array<{ key: string; from: number; url: string }> = [];
    if (sprite) {
      for (let l = 1; l <= Math.max(maxLevel, 10); l++) {
        const url = spriteUrl(`${sprite}_l${l}`);
        if (url) tiers.push({ key: `${sprite}_l${l}`, from: l, url });
      }
      if (tiers.length === 0) { const url = spriteUrl(sprite); if (url) tiers.push({ key: sprite, from: 1, url }); }
    }
    const crew = (CREW as Record<string, readonly string[] | undefined>)[id] ?? [];
    return h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      h('div', { class: 'dx-card dx-pad', style: 'display:flex;flex-direction:column;gap:10px' },
        h('span', { class: 'sec' }, 'Art tiers'),
        tiers.length ? h('div', { class: 'dx-sprites' }, ...tiers.map((t, i) => h('div', { class: 'dx-sprite' },
          h('img', { src: t.url, alt: t.key }),
          h('span', { class: 'mono' }, t.key),
          h('span', { class: 'dim' }, `from level ${t.from}${tiers[i + 1] ? ` to ${tiers[i + 1].from - 1}` : ''}`)))) : h('p', { class: 'dx-note' }, 'No art yet.'),
        h('div', { class: 'dx-row' }, h('span', { class: 'sec' }, 'Crew'), ...(crew.length ? crew.map((x) => h('span', { class: 'dx-chip mono' }, x)) : [h('span', { class: 'dim' }, 'none')]))),
      h('p', { class: 'dx-note' }, 'Read-only for now: tiers come from the file names (_l1, _l4, _l8) and the crew from render/cast.ts. They become fields of the building in phase 3, with a live preview on the game\'s own renderer.'));
  }

  function adjacencyTab(id: string): HTMLElement {
    const rules = (model.get(['adjacency']) as Array<Record<string, unknown>>) ?? [];
    const mine = rules.map((r, i) => [r, i] as const).filter(([r]) => r.district === id || r.neighbor === id || String(r.district).startsWith('Any') || String(r.neighbor).startsWith('Any'));
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
      h('p', { class: 'dx-note' }, 'Rules that name this building, and every rule on a group it may belong to.'),
      h('div', { class: 'dx-card', style: 'overflow:auto' }, h('table', { class: 'dx-table' },
        h('thead', {}, h('tr', {}, ...['District', 'next to', 'Stat', 'Magnitude', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...mine.map(([r, i]) => h('tr', {},
          h('td', { class: 'id', style: r.district === id ? 'color:var(--accent)' : '' }, String(r.district)),
          h('td', { class: 'id', style: r.neighbor === id ? 'color:var(--accent)' : '' }, String(r.neighbor)),
          h('td', { class: 'mono' }, String(r.stat)),
          h('td', { class: 'num' }, numInput(['adjacency', i, 'magnitude'], r.magnitude, 'dx-cell' + (changed.has(`adjacency.${i}.magnitude`) ? ' changed' : ''), { type: 'float' })),
          h('td', {}, h('button', { class: 'dx-btn sm', onclick: () => go({ c: 'adjacency', e: String(i) }) }, 'Open'))))))),
      h('button', { class: 'dx-btn sm dash', style: 'align-self:flex-start', onclick: () => {
        model.set(['adjacency'], [...rules, { district: id, neighbor: id, stat: 'goldPerMinute', magnitude: 0 }]);
      } }, '+ Rule'));
  }

  /** What unlocks this building, and each of its levels, from the tree. */
  function gatesOf(id: string): Array<{ tech: string; what: string }> {
    const out: Array<{ tech: string; what: string }> = [];
    for (const [tid, t] of Object.entries(TECHS)) {
      for (const u of t.unlocks ?? []) {
        if (u.district === id) out.push({ tech: tid, what: 'Build' });
        const dl = u.districtLevel as { id?: string; level?: number } | undefined;
        if (dl?.id === id) out.push({ tech: tid, what: `Level ${dl.level}` });
        if (u.districtCount === id) out.push({ tech: tid, what: 'One more' });
      }
    }
    return out.sort((a, b) => a.what.localeCompare(b.what, undefined, { numeric: true }));
  }

  function gatesTab(id: string): HTMLElement {
    const gates = gatesOf(id);
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
      h('p', { class: 'dx-note' }, 'A technology says what it opens, so these are read-only here. Townhall levels and count caps are on Identity.'),
      h('div', { class: 'dx-card', style: 'overflow:auto' }, h('table', { class: 'dx-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Gate'), h('th', {}, 'Technology'))),
        h('tbody', {}, ...(gates.length ? gates.map((g) => h('tr', {}, h('td', {}, g.what),
          h('td', {}, h('a', { class: 'dx-chip', href: `${location.pathname}?dev=tree` }, TECHS[g.tech]?.name ?? g.tech))))
          : [h('tr', {}, h('td', { class: 'dim' }, 'No technology gates it.'), h('td', {}))])))));
  }

  // ---- grid (one ladder across every building)

  function renderGrid(c: CollectionDef): Kid[] {
    const rows = entriesOf(model.doc, c);
    const fieldsAvail = new Map<string, string>();
    for (const [eid] of rows) for (const col of levelColumns(c, eid)) fieldsAvail.set(col.key, col.kind === 'ladder' ? col.key : `${col.kind === 'cost' ? 'Cost' : 'Goods'} · ${col.label}`);
    if (!fieldsAvail.has(ui.gridField)) ui.gridField = [...fieldsAvail.keys()][0];
    const maxL = Math.max(...rows.map(([, v]) => Number((v as Record<string, unknown>).maxLevel) || 1));
    // Only buildings that use this field.
    const lines = rows.map(([eid, v]) => ({ eid, v, col: levelColumns(c, eid).find((x) => x.key === ui.gridField) }))
      .filter((x) => x.col);
    const all = lines.flatMap(({ col, v }) => Array.from({ length: Number((v as Record<string, unknown>).maxLevel) || 1 }, (_, i) => Number(col!.get(i + 1).value ?? 0))).filter((x) => x > 0);
    const lo = Math.log(Math.min(...all, 1)), hi = Math.log(Math.max(...all, 1));
    const heat = (t: number) => {
      const a = [27, 38, 54], b = [122, 90, 18];
      return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(',')})`;
    };
    const cellKey = (r: number, l: number) => `${r}:${l}`;
    const onCell = (r: number, l: number, e: MouseEvent) => {
      const k = cellKey(r, l);
      if (e.shiftKey && ui.gridAnchor) {
        ui.gridSel.clear();
        const [r0, r1] = [Math.min(ui.gridAnchor.r, r), Math.max(ui.gridAnchor.r, r)];
        const [c0, c1] = [Math.min(ui.gridAnchor.c, l), Math.max(ui.gridAnchor.c, l)];
        for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) ui.gridSel.add(cellKey(i, j));
      } else if (e.ctrlKey || e.metaKey) {
        if (ui.gridSel.has(k)) ui.gridSel.delete(k); else ui.gridSel.add(k);
        ui.gridAnchor = { r, c: l };
      } else {
        ui.gridSel = new Set([k]);
        ui.gridAnchor = { r, c: l };
      }
      render();
    };
    const table = h('table', { class: 'dx-table dx-heat mono' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Building'), ...Array.from({ length: maxL }, (_, i) => h('th', { class: 'num' }, `L${i + 1}`)))),
      h('tbody', {}, ...lines.map(({ eid, v, col }, r) => h('tr', {},
        h('td', { class: 'name' }, h('button', { class: 'dx-crumb', style: 'color:var(--ink)', onclick: () => go({ e: eid, v: null }) }, nameOf(c, eid, v))),
        ...Array.from({ length: maxL }, (_, i) => {
          const lvl = i + 1;
          if (lvl > (Number((v as Record<string, unknown>).maxLevel) || 1)) return h('td', {});
          const { path, value } = col!.get(lvl);
          if (path === null) return h('td', { class: 'cell faint' }, '·');
          const n = Number(value ?? 0);
          const prev = lvl > 1 ? Number(col!.get(lvl - 1).value ?? 0) : 0;
          let text = value === undefined || n === 0 ? '·' : fmt(n);
          let t = n > 0 ? (Math.log(n) - lo) / (hi - lo || 1) : 0;
          if (ui.gridMode === 'step') {
            text = prev > 0 && n > 0 ? `×${(n / prev).toFixed(2)}` : '·';
            t = prev > 0 && n > 0 ? Math.min(1, Math.max(0, (n / prev - 1) / 2)) : 0;
          }
          const sel = ui.gridSel.has(cellKey(r, lvl));
          return h('td', {
            class: 'cell' + (sel ? ' sel' : '') + (changed.has(pathKey(path)) ? ' changed' : ''),
            style: `background:${text === '·' ? 'transparent' : heat(t)};color:${text === '·' ? 'var(--faint)' : '#e8edf4'}`,
            onmousedown: (e: MouseEvent) => { e.preventDefault(); onCell(r, lvl, e); },
          }, text);
        })))));

    const selected = [...ui.gridSel].map((k) => k.split(':').map(Number)).map(([r, l]) => ({ line: lines[r], l }))
      .filter((x) => x.line && x.line.col!.get(x.l).path);
    const apply = (op: (n: number) => number) => {
      model.batch(() => {
        for (const { line, l } of selected) {
          const { path, value } = line.col!.get(l);
          model.set(path!, op(Number(value ?? 0)));
        }
      });
    };
    const arg = () => Number(ui.bulk.replace(',', '.'));
    const bulk = selected.length ? h('div', { class: 'dx-bulk' },
      h('span', { class: 'mono', style: 'color:var(--accent);padding:0 6px' }, `${selected.length} cells`),
      h('input', { class: 'mono', value: ui.bulk, 'aria-label': 'Operand', onchange: (e: Event) => { ui.bulk = (e.target as HTMLInputElement).value; } }),
      h('button', { class: 'dx-btn sm', onclick: () => Number.isFinite(arg()) && apply((n) => Math.round(n * arg())) }, '× by'),
      h('button', { class: 'dx-btn sm', onclick: () => Number.isFinite(arg()) && apply((n) => n + arg()) }, '+ n'),
      h('button', { class: 'dx-btn sm', onclick: () => Number.isFinite(arg()) && apply(() => arg()) }, '= set'),
      h('button', { class: 'dx-btn sm', onclick: () => apply(sig3) }, 'Round 3 s.f.'),
      h('button', { class: 'dx-btn sm', onclick: () => copyCells(selected.map(({ line, l }) => line.col!.get(l).value)) }, 'Copy'),
      h('button', { class: 'dx-btn sm', onclick: () => { ui.gridSel.clear(); render(); } }, 'Clear'))
      // The bar's row is always there, so a first click never moves the
      // table out from under the second.
      : h('div', { class: 'dx-bulk idle' }, h('span', { class: 'dim' }, 'Click a cell, Shift-click for a block, Ctrl-click to add — then change them together.'));

    return [
      h('div', { class: 'dx-row', style: 'flex-wrap:wrap;gap:10px' },
        h('select', { class: 'dx-in', style: 'width:260px', value: ui.gridField, onchange: (e: Event) => { ui.gridField = (e.target as HTMLSelectElement).value; ui.gridSel.clear(); render(); } },
          ...[...fieldsAvail].map(([k, label]) => h('option', { value: k, selected: k === ui.gridField }, label))),
        h('div', { class: 'dx-seg' },
          h('button', { class: ui.gridMode === 'value' ? 'on' : '', onclick: () => { ui.gridMode = 'value'; render(); } }, 'Value'),
          h('button', { class: ui.gridMode === 'step' ? 'on' : '', onclick: () => { ui.gridMode = 'step'; render(); } }, 'Step ×')),
      ),
      bulk,
      h('div', { class: 'dx-card', style: 'overflow:auto' }, table),
    ];
  }

  function copyCells(values: unknown[]): void {
    void navigator.clipboard?.writeText(values.map((v) => (v === undefined ? '' : String(v))).join('\t'));
  }

  // ---- inspector

  function renderSide(c: CollectionDef): Kid[] {
    if (c.view === 'form' || c.view === 'canvas' || !c.source) return [];
    const id = route.e;
    if (id === null || getAt(model.doc, entryPath(c, id)) === undefined) {
      const iss = collIssues(c.id);
      return [
        h('span', { class: 'sec' }, c.label),
        h('p', { class: 'dx-note' }, `Pick a ${c.noun} to edit it. ${entriesOf(model.doc, c).length} in all.`),
        ...issueList(iss.slice(0, 20), true),
      ];
    }
    const spec = specOf(c);
    const value = getAt(model.doc, entryPath(c, id));
    const out: Kid[] = [
      h('div', {}, h('span', { class: 'sec' }, c.noun), h('h2', {}, nameOf(c, id))),
    ];
    if (c.view !== 'entity') {
      out.push(renameField(c, id));
    }
    const iss = issuesOf(c.id, id);
    if (iss.length) out.push(h('div', { style: 'display:flex;flex-direction:column;gap:4px' }, ...issueList(iss, false)));
    if (c.id === 'quests') {
      out.push(h('div', { class: 'dx-card dx-pad' }, h('div', { class: 'sec' }, 'The player reads'), h('div', { style: 'font-size:15px;margin-top:4px' }, questProse(value)),
        h('div', { class: 'faint', style: 'font-size:11px' }, 'generated by questProse.ts')));
    }
    if (c.view !== 'entity') {
      out.push(h('div', { style: 'display:flex;flex-direction:column;gap:12px' },
        ...Object.entries(spec.fields ?? {}).map(([k, f]) => (isObj(value) && k in value) || !f.nullable
          ? field(c.id, id, entrySpec(c, value, k, f), [...entryPath(c, id), k], [k], k)
          : h('div', { class: 'dx-field' }, h('div', { class: 'lbl' }, h('span', { class: 'mono' }, k), h('span', { class: 'faint' }, 'optional')),
            h('button', { class: 'dx-btn sm dash', onclick: () => model.set([...entryPath(c, id), k], blank(f)) }, '+ Add')))));
    }
    // Points to / used by.
    const refs = refsIn(spec, value).filter((r) => REF_COLLECTION[r.kind]);
    const uniq = [...new Map(refs.map((r) => [`${r.kind}:${r.id}`, r])).values()];
    if (uniq.length) {
      out.push(h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('span', { class: 'sec' }, 'Points to'),
        h('div', { class: 'dx-links' }, ...uniq.map((r) => linkChip(REF_COLLECTION[r.kind]!, r.id)))));
    }
    const back = usedBy(c, id);
    out.push(h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('span', { class: 'sec' }, `Used by · ${back.length}`),
      back.length ? h('div', { class: 'dx-links' }, ...back.slice(0, 40).map((b) => b.el)) : h('span', { class: 'dim' }, 'Nothing names it.')));
    if (c.view !== 'entity') {
      out.push(h('div', { class: 'dx-row' },
        h('button', { class: 'dx-btn sm', onclick: () => addEntry(c, id) }, 'Duplicate'),
        h('button', { class: 'dx-btn sm', onclick: () => removeEntry(c, id) }, 'Remove')));
    }
    return out;
  }

  function renameField(c: CollectionDef, id: string): HTMLElement {
    if (isListCollection(model.doc, c)) return h('span');
    return h('div', { class: 'dx-field' },
      h('div', { class: 'lbl' }, h('span', { class: 'mono' }, 'id'), h('span', { class: 'faint' }, 'renames every reference')),
      h('input', {
        class: 'dx-in mono', value: id, 'data-k': `__id.${c.id}.${id}`,
        onchange: (e: Event) => renameEverywhere(c, id, (e.target as HTMLInputElement).value.trim()),
      }));
  }

  /** Rename an entry, and every field in every collection that names it. */
  function renameEverywhere(c: CollectionDef, from: string, to: string): void {
    const map = model.get([c.source!]) as Record<string, unknown>;
    if (!to || to === from || to in map || !/^[A-Za-z0-9_]+$/.test(to)) { render(); return; }
    const kind = REF_OF_COLLECTION[c.id];
    model.batch(() => {
      model.renameKey([c.source!], from, to);
      if (!kind) return;
      for (const other of COLLECTIONS) {
        if (other.view === 'canvas') continue;
        const spec = specOf(other);
        const targets: Array<[Path, unknown]> = other.view === 'form'
          ? (other.groups ?? []).map((g) => [[g], model.get([g])])
          : entriesOf(model.doc, other).map(([eid, v]) => [entryPath(other, eid), v]);
        for (const [base, v] of targets) {
          const s = other.view === 'form' ? spec.fields![String(base[0])] : spec;
          for (const r of refsIn(s, v)) {
            if (r.kind !== kind || r.id !== from) continue;
            const p = [...base, ...r.path];
            const parentVal = model.get(p.slice(0, -1));
            if (isObj(parentVal) && r.path.length && String(r.path[r.path.length - 1]) === from && !(typeof model.get(p) === 'string' && model.get(p) === from)) {
              model.renameKey(p.slice(0, -1), from, to);
            } else model.set(p, to);
          }
        }
      }
      // Hand-checked refs that the schema does not type.
      if (c.id === 'buildings') {
        (model.get(['adjacency']) as Array<Record<string, unknown>>).forEach((r, i) => {
          if (r.district === from) model.set(['adjacency', i, 'district'], to);
          if (r.neighbor === from) model.set(['adjacency', i, 'neighbor'], to);
        });
      }
      const qKind = kind;
      (model.get(['quests']) as Array<Record<string, unknown>>).forEach((q, i) => {
        const want = ({ BuildDistrict: 'building', UpgradeDistrict: 'building', HoldResource: 'currency', CollectResource: 'currency' } as Record<string, string>)[String(q.goalType)];
        if (want === qKind && q.goalTarget === from) model.set(['quests', i, 'goalTarget'], to);
      });
    });
    go({ e: to });
  }

  function linkChip(cid: string, id: string, extra = ''): HTMLElement {
    const target = collectionById(cid)!;
    return h('button', {
      class: 'dx-chip', onclick: () => (target.view === 'canvas' ? openCollection(target) : go({ c: cid, e: id })),
    }, h('span', { class: 'dim' }, `${target.label} ›`), ` ${target.source ? nameOf(target, id) : TECHS[id]?.name ?? id}${extra}`);
  }

  /** Everything in the data that names this entry. */
  function usedBy(c: CollectionDef, id: string): Array<{ el: HTMLElement }> {
    const kind = REF_OF_COLLECTION[c.id];
    const out: Array<{ el: HTMLElement }> = [];
    const seen = new Set<string>();
    const add = (cid: string, eid: string, extra = '') => {
      const k = `${cid}:${eid}:${extra}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ el: linkChip(cid, eid, extra) });
    };
    if (kind) {
      for (const other of COLLECTIONS) {
        if (!other.source) continue;
        const spec = specOf(other);
        for (const [eid, v] of entriesOf(model.doc, other)) {
          if (other.id === c.id && eid === id) continue;
          if (refsIn(spec, v).some((r) => r.kind === kind && r.id === id)) add(other.id, eid);
          if (other.id === 'quests' && isObj(v) && v.goalTarget === id) add('quests', eid);
          if (other.id === 'adjacency' && isObj(v) && (v.district === id || v.neighbor === id)) add('adjacency', eid);
        }
      }
    }
    if (c.id === 'buildings') for (const g of gatesOf(id)) add('tree', g.tech, ` · ${g.what}`);
    return out;
  }

  function issueList(iss: DataIssue[], withEntry: boolean): HTMLElement[] {
    return iss.map((i) => h('div', { class: 'dx-issue' + (i.level === 'warning' ? ' wrn' : '') },
      h('b', {}, i.level === 'error' ? '!' : '?'),
      h('span', {}, withEntry && i.entry !== null
        ? h('button', { class: 'dx-crumb', style: 'height:auto;padding:0', onclick: () => go({ c: i.collection, e: i.entry }) }, nameOf(collectionById(i.collection)!, i.entry))
        : null, withEntry && i.entry !== null ? ' · ' : '',
      h('span', { class: 'mono' }, i.path.join('.') || '—'), ` ${i.message}`)));
  }

  // ---- status bar

  function renderStatus(): Kid[] {
    return [
      h('span', {}, `?dev=data${location.hash}`),
      h('span', {}, 'phase 1 · reads balance.json, edits in memory'),
      h('div', { class: 'dx-spacer' }),
      h('span', {}, 'Ctrl K jump · Ctrl Z undo · [ ] previous / next entry · browser back works'),
    ];
  }

  // ---- overlays: crumb menu, palette, diff

  function renderLayer(): Kid[] {
    const out: Kid[] = [];
    if (ui.menu) {
      const items = menuItems(ui.menu.id);
      const filtered = items.filter((x) => x.text.toLowerCase().includes(ui.menu!.filter.toLowerCase()));
      const box = h('div', { class: 'dx-menu', role: 'menu', style: `left:${ui.menu.x}px;top:${ui.menu.y}px` },
        items.length > 10 ? h('input', {
          placeholder: 'Filter…', value: ui.menu.filter, 'data-k': '__menu',
          oninput: (e: Event) => { ui.menu!.filter = (e.target as HTMLInputElement).value; render(); },
          onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && filtered[0]) filtered[0].act(); },
        }) : null,
        ...filtered.map((x) => h('button', { role: 'menuitem', class: x.on ? 'on' : '', onclick: x.act },
          h('span', {}, x.text), x.n ? h('span', { class: 'mono faint' }, x.n) : null)));
      const shield = h('div', { style: 'position:fixed;inset:0;z-index:29', onclick: () => { ui.menu = null; render(); } });
      out.push(shield, box);
      if (items.length > 10) focusKey = '__menu';
    }
    if (ui.palette) out.push(renderPalette());
    if (ui.diffOpen) out.push(renderDiff());
    return out;
  }

  interface Hit { text: string; where: string; act: () => void; group: string }

  function paletteIndex(): Hit[] {
    const hits: Hit[] = [];
    for (const c of COLLECTIONS) {
      hits.push({ group: 'Collections', text: c.label, where: c.domain, act: () => openCollection(c) });
      if (c.source) {
        for (const [eid, v] of entriesOf(model.doc, c)) {
          const name = nameOf(c, eid, v);
          hits.push({ group: 'Entries', text: name === eid ? eid : `${name} · ${eid}`, where: `${c.domain} › ${c.label}`, act: () => go({ c: c.id, e: eid }) });
        }
      }
      if (c.groups) {
        const spec = specOf(c);
        for (const g of c.groups) {
          const gs = spec.fields![g];
          const keys = gs.type === 'object' ? Object.keys(gs.fields ?? {}).map((k) => `${g}.${k}`) : [g];
          for (const k of keys) hits.push({ group: 'Fields', text: k, where: `${c.domain} › ${c.label}`, act: () => go({ c: c.id }) });
        }
      }
    }
    for (const [tid, t] of Object.entries(TECHS)) hits.push({ group: 'Entries', text: t.name ?? tid, where: 'Research › Tech tree', act: () => { location.href = `${location.pathname}?dev=tree`; } });
    const c = coll();
    if (c.source) hits.push({ group: 'Commands', text: `New ${c.noun}…`, where: c.label, act: () => addEntry(c) });
    hits.push({ group: 'Commands', text: 'Undo', where: 'Ctrl Z', act: () => model.undo() });
    hits.push({ group: 'Commands', text: 'Show unsaved changes', where: `${changed.size}`, act: () => { ui.diffOpen = true; } });
    return hits;
  }

  function renderPalette(): HTMLElement {
    const p = ui.palette!;
    const q = p.q.trim().toLowerCase();
    const all = paletteIndex();
    const scored = q === ''
      ? all.filter((x) => x.group === 'Collections').slice(0, 30)
      : all.map((x) => {
        const t = x.text.toLowerCase();
        const s = t.startsWith(q) ? 0 : t.includes(q) ? 1 : x.where.toLowerCase().includes(q) ? 2 : -1;
        return { x, s };
      }).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s).slice(0, 40).map((x) => x.x);
    p.i = Math.min(p.i, Math.max(0, scored.length - 1));
    const close = () => { ui.palette = null; render(); };
    const run = (x: Hit) => { ui.palette = null; x.act(); render(); };
    const results = h('div', { class: 'dx-results' });
    let group = '';
    scored.forEach((x, i) => {
      if (x.group !== group) { group = x.group; results.append(h('div', { class: 'sec' }, group)); }
      results.append(h('button', { class: i === p.i ? 'on' : '', onclick: () => run(x), onmousemove: () => { if (p.i !== i) { p.i = i; render(); } } },
        h('span', {}, x.text), h('span', { class: 'where' }, x.where)));
    });
    focusKey = '__palette';
    return h('div', { class: 'dx-overlay', onmousedown: (e: MouseEvent) => { if (e.target === e.currentTarget) close(); } },
      h('div', { class: 'dx-palette', role: 'dialog', 'aria-label': 'Jump to' },
        h('input', {
          value: p.q, placeholder: 'Jump to a collection, entry, field or command', 'data-k': '__palette', 'aria-label': 'Search all game data',
          oninput: (e: Event) => { p.q = (e.target as HTMLInputElement).value; p.i = 0; render(); },
          onkeydown: (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowDown') { p.i = Math.min(p.i + 1, scored.length - 1); render(); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { p.i = Math.max(p.i - 1, 0); render(); e.preventDefault(); }
            else if (e.key === 'Enter' && scored[p.i]) run(scored[p.i]);
          },
        }),
        results,
        h('div', { class: 'foot' }, h('span', {}, '↑↓ move'), h('span', {}, 'Enter open'), h('span', {}, 'Esc close'), h('span', {}, 'empty = every collection'))));
  }

  function describePath(path: Path): { where: string; go: () => void } {
    const [top, second] = path;
    const c = COLLECTIONS.find((x) => x.source === top) ?? COLLECTIONS.find((x) => x.groups?.includes(String(top)));
    if (!c) return { where: pathKey(path), go: () => undefined };
    if (c.source && second !== undefined) {
      const eid = String(second);
      return { where: `${c.label} › ${nameOf(c, eid)} › ${path.slice(2).join('.')}`, go: () => go({ c: c.id, e: eid }) };
    }
    return { where: `${c.label} › ${path.join('.')}`, go: () => go({ c: c.id }) };
  }

  function renderDiff(): HTMLElement {
    const changes: Change[] = model.diff();
    const close = () => { ui.diffOpen = false; render(); };
    const copy = () => void navigator.clipboard?.writeText(JSON.stringify(changes.map((c) => ({ path: c.path, before: c.before, after: c.after })), null, 1));
    return h('div', { class: 'dx-overlay', onmousedown: (e: MouseEvent) => { if (e.target === e.currentTarget) close(); } },
      h('div', { class: 'dx-palette dx-diff', role: 'dialog', 'aria-label': 'Unsaved changes' },
        h('div', { class: 'dx-row', style: 'padding:12px 14px;border-bottom:1px solid var(--line)' },
          h('b', { style: 'flex:1' }, `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}`),
          h('button', { class: 'dx-btn sm', onclick: copy }, 'Copy as JSON'),
          h('button', { class: 'dx-btn sm', onclick: close }, 'Close')),
        h('div', { class: 'dx-note', style: 'padding:8px 14px' }, 'Phase 1 cannot save: balance.xlsx is still the source, and npm run dev rebuilds balance.json from it. Carry these into the workbook, or keep them here until the migration.'),
        h('div', { class: 'dx-results' }, ...changes.map((ch) => {
          const d = describePath(ch.path);
          return h('div', { class: 'chg' },
            h('button', { class: 'dx-crumb', style: 'height:auto;padding:0;text-align:left;white-space:normal', onclick: () => { ui.diffOpen = false; d.go(); } }, d.where),
            h('span', { class: 'mono' }, h('span', { class: 'dim' }, summary(ch.before)), ' → ', summary(ch.after)),
            h('button', { class: 'dx-btn sm', onclick: () => model.set(ch.path, ch.before) }, 'Revert'));
        }))));
  }

  // ---- keyboard

  window.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest?.('input,select,textarea');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.palette = ui.palette ? null : { q: '', i: 0 }; render(); return; }
    if (e.key === 'Escape' && (ui.menu || ui.diffOpen || ui.palette)) { ui.menu = null; ui.diffOpen = false; ui.palette = null; render(); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) model.redo(); else model.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); model.redo(); return; }
    if ((e.key === '[' || e.key === ']') && coll().source) {
      const ids = entriesOf(model.doc, coll()).map(([id]) => id);
      const at = route.e === null ? -1 : ids.indexOf(route.e);
      const next = ids[(at + (e.key === ']' ? 1 : -1) + ids.length) % ids.length];
      if (next !== undefined) go({ e: next });
    }
  });
  window.addEventListener('beforeunload', (e) => { if (changed.size) e.preventDefault(); });

  render();
}
