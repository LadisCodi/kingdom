// `?dev=tree` — the technologies, authored.
//
// The map editor's twin (src/editor/mount.ts), for the other half of the game
// a spreadsheet expresses badly. A technology lives entirely in
// `src/sim/data/tech-tree.json` — its name and prose, what KIND it is and
// what it unlocks, its price and clock, its slot on its tome page and what it
// needs before it — and this is what writes that file, through a dev-only
// Vite endpoint. There is no `Technologies` sheet.
//
// Three panes: the PALETTE of every technology on the left, with the button
// that makes a new one; the PAGE in the middle, laid out by the same module
// the game lays it out with (ui/research/layout.ts), so what a designer
// arranges is what a player sees; and the INSPECTOR on the right, where a
// technology's fields, its unlocks and the live problem list are.
// Docs/tech-tree-editor.md is the manual.

import '../editor.css';
import treeJson from '../../sim/data/tech-tree.json';
import {
  DISTRICT_IDS, HARVEST_IDS, MAX_REQUIRES, TECH_KINDS, TERRAIN_IDS, TOME_IDS, UNIT_IDS,
  isDrawnEdge, unlockLabel,
  type TechIssue, type TechKind, type TechNodeDoc, type TechTreeDoc, type TechUnlock,
} from '../../sim/data/techTreeRules';
import {
  colLeft, edgeD, edgePath, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, rowTops, ROW_GAP,
} from '../../ui/research/layout';
import type { TomeId } from '../../sim/state';
import { ERAS, TreeDoc } from './doc';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...kids: Array<Node | string>
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...kids);
  return node;
};

/** What the palette drag carries, and what a drop reads back. */
const DRAG_MIME = 'application/x-kingdom-tech';

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** The kinds of thing an unlock can name, and where each list comes from. */
const UNLOCK_TARGETS: Record<string, { ids: string[]; level?: true }> = {
  district: { ids: DISTRICT_IDS },
  districtLevel: { ids: DISTRICT_IDS, level: true },
  districtCount: { ids: DISTRICT_IDS },
  unit: { ids: UNIT_IDS },
  harvest: { ids: HARVEST_IDS },
  terrain: { ids: TERRAIN_IDS },
};

export function mountEditor(): void {
  document.getElementById('app')?.setAttribute('hidden', '');
  document.title = 'Kingdom — tech tree editor';

  const doc = new TreeDoc(treeJson as unknown as TechTreeDoc);

  let tome: TomeId = 'Civics';
  let selected: string | null = null;
  /** While on, clicking a card adds or removes it as the selection's
   *  requirement — the gesture for the edges a drop's default got wrong. */
  let linking = false;
  let filter = '';
  /** Whether the new-technology form is open. */
  let drafting = false;
  /**
   * A connection being drawn from a port, if any.
   *
   * `out` is the port under a card and `in` the one over it, so the side says
   * which way the search goes: out of a card looks at the row BELOW for
   * inputs, into a card looks at the row ABOVE for outputs. Either way the
   * requirement that comes out of it points up the page.
   */
  let wiring: { id: string; side: 'in' | 'out' } | null = null;

  const palette = el('div', { class: 'ed-toolbar tre-palette' });
  const stage = el('main', { class: 'ed-stage tre-stage' });
  const side = el('aside', { class: 'ed-side' });
  const status = el('footer', { class: 'ed-status' });
  const root = el('div', { class: 'ed-root tre-root' }, palette, stage, side, status);
  document.body.append(root);

  const toast = (message: string, bad = false): void => {
    const node = el('div', { class: `ed-toast${bad ? ' bad' : ''}` }, message);
    root.append(node);
    setTimeout(() => node.remove(), 4000);
  };

  // ------------------------------------------------------------------ save
  let saving = false;
  const save = async (): Promise<void> => {
    if (saving) return;
    const { errors } = doc.validation;
    if (errors.length > 0) {
      toast(`${errors.length} problem${errors.length === 1 ? '' : 's'} — fix them first`, true);
      return;
    }
    saving = true;
    refresh();
    try {
      const res = await fetch('/__tree/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc.document),
      });
      const body = await res.json() as { ok?: boolean; error?: string; warnings?: TechIssue[] };
      if (!res.ok || body.ok !== true) throw new Error(body.error ?? `HTTP ${res.status}`);
      doc.markSaved();
      toast(`Saved tech-tree.json${(body.warnings ?? []).length > 0
        ? ` — ${body.warnings!.length} warning(s)` : ''}`);
    } catch (err) {
      toast(`Save failed: ${(err as Error).message}`, true);
    } finally {
      saving = false;
      refresh();
    }
  };

  // -------------------------------------------------------------- gestures
  /** The technology being dragged, kept beside the DataTransfer because
   *  Firefox will not read the payload during `dragover` — and the drop
   *  target has to know whether it may take it. */
  let dragging: string | null = null;

  /** The band comes from the ROW the card lands in, never from the numbers
   *  around it: a band's spare row shares its number with the next band's
   *  first row, and only the row itself knows which side of the bar it is. */
  const dropInto = (row: number, col: number, era: number): void => {
    if (dragging === null) return;
    doc.place(dragging, tome, era, row, col);
    selected = dragging;
    dragging = null;
    refresh();
  };

  const askDelete = (id: string): void => {
    const orphaned = doc.ids.filter((other) => doc.node(other)?.requires.includes(id));
    doc.remove(id);
    selected = null;
    toast(orphaned.length === 0
      ? `Deleted ${id}`
      : `Deleted ${id} — ${orphaned.length} card(s) lost a requirement`);
    refresh();
  };

  document.addEventListener('keydown', (e) => {
    // A form field owns its own keys: Delete in a name box deletes a letter.
    const typing = (e.target as HTMLElement)?.matches?.('input, textarea, select') === true;
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) doc.redo(); else doc.undo();
      refresh();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      linking = false;
      drafting = false;
      wiring = null;
      selected = null;
      refresh();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !typing) {
      e.preventDefault();
      askDelete(selected);
    }
  });

  // ------------------------------------------------------------- the panes
  function drawPalette(): void {
    palette.replaceChildren();
    palette.append(el('div', { class: 'ed-brand' }, 'TECH TREE'));

    const add = el('button', { class: 'ed-btn primary tre-new' }, '+ new technology');
    add.addEventListener('click', () => { drafting = !drafting; refresh(); });
    palette.append(add);
    if (drafting) palette.append(draftForm());

    const search = el('input', {
      class: 'tre-search', type: 'search', placeholder: 'filter…', value: filter,
    });
    search.addEventListener('input', () => {
      filter = search.value.toLowerCase();
      drawPalette();
    });
    palette.append(search);

    const shown = doc.ids.filter((id) => filter === ''
      || id.toLowerCase().includes(filter)
      || (doc.node(id)?.name ?? '').toLowerCase().includes(filter));

    // Green means SETTLED: it sits in a slot the rules are happy with. Every
    // technology has a slot by construction (creating one places it), so what
    // this actually marks is the difference between one that is wired into
    // its page — a legal slot, one to three requirements, a kind that matches
    // what it carries — and one the problem list is still asking about.
    const troubled = new Set(doc.validation.errors.map((e) => e.tech));

    // THIS BOOK FIRST, then everything else under its own heading. The
    // palette is 180 rows long and the page beside it is one book: a row you
    // can drag onto what you are looking at and a row you cannot are two
    // different things, and the list should not make you read the label to
    // tell them apart.
    const here = shown.filter((id) => doc.node(id)!.tome === tome);
    const elsewhere = shown.filter((id) => doc.node(id)!.tome !== tome);

    const list = el('div', { class: 'tre-list' });
    const group = (label: string, n: number) =>
      el('div', { class: 'tre-group' }, `${label} · ${n}`);
    if (here.length > 0) {
      list.append(group(tome, here.length));
      for (const id of here) list.append(paletteItem(id, troubled));
    }
    if (elsewhere.length > 0) {
      list.append(group('the other books', elsewhere.length));
      for (const id of elsewhere) list.append(paletteItem(id, troubled));
    }
    palette.append(list);
  }

  /** One row of the palette: what it is, where it lives, and whether the
   *  rules are happy with it. Draggable onto any slot of the open page. */
  function paletteItem(id: string, troubled: Set<string | undefined>): HTMLElement {
    const node = doc.node(id)!;
    const settled = !troubled.has(id);
    const item = el('div', {
      class: `tre-item ${settled ? 'is-settled' : 'is-adrift'}`
        + (selected === id ? ' is-selected' : ''),
      draggable: 'true',
      title: settled
        ? `${id} — ${node.description}`
        : `${id} — ${doc.validation.errors.find((e) => e.tech === id)?.message ?? ''}`,
    },
    el('b', {}, `${node.glyph} ${node.name}`),
    el('span', { class: 'tre-item-where' },
      // The book is named only when it is NOT the one on screen: under the
      // heading of the open page it would be on every row and say nothing.
      `${node.kind} · ${node.tome === tome ? '' : `${node.tome} `}`
      + `${ROMAN[node.era] ?? node.era} · r${node.row}c${node.col}`));
    item.addEventListener('dragstart', (e) => {
      dragging = id;
      e.dataTransfer?.setData(DRAG_MIME, id);
      e.dataTransfer?.setData('text/plain', id);
    });
    item.addEventListener('dragend', () => { dragging = null; });
    item.addEventListener('click', () => {
      selected = id;
      tome = node.tome; // jump to the page it lives on
      refresh();
    });
    return item;
  }

  /**
   * The new-technology form.
   *
   * It asks for everything the rules require of a technology, so one is never
   * born illegal — except for its SLOT, which it takes at the end of the band
   * it is created in, and its REQUIREMENTS, which come from that slot the way
   * a drop's do. Drag it where it belongs afterwards.
   */
  function draftForm(): HTMLElement {
    const id = el('input', { class: 'tre-search', placeholder: 'Id — Bellows' });
    const name = el('input', { class: 'tre-search', placeholder: 'Name' });
    const glyph = el('input', { class: 'tre-search', placeholder: 'Glyph', value: '📜' });
    const description = el('textarea', { class: 'tre-search', placeholder: 'What it does' });
    const kind = select([...TECH_KINDS], 'unlock');
    const era = select(ERAS.map(String), '1');
    const gold = el('input', { class: 'tre-search', type: 'number', value: '100' });
    const seconds = el('input', { class: 'tre-search', type: 'number', value: '60' });
    const make = el('button', { class: 'ed-btn primary' }, `create in ${tome}`);
    make.addEventListener('click', () => {
      const newId = id.value.trim();
      const problem = doc.create(newId, tome, Number(era.value), {
        name: name.value,
        glyph: glyph.value,
        description: description.value,
        kind: kind.value as TechKind,
        gold: Math.round(Number(gold.value)),
        seconds: Math.round(Number(seconds.value)),
      });
      if (problem !== null) { toast(problem, true); return; }
      selected = newId;
      drafting = false;
      toast(`Created ${newId} — say what it unlocks`);
      refresh();
    });
    return el('div', { class: 'ed-card tre-draft' },
      el('h2', {}, 'New technology'),
      id, name, glyph, description,
      field('kind', kind), field('era', era),
      field('gold', gold), field('seconds', seconds),
      make);
  }

  function drawStage(): void {
    stage.replaceChildren();

    const tabs = el('div', { class: 'tre-tabs' });
    for (const id of TOME_IDS) {
      const tab = el('button', { class: `ed-btn tre-tab${id === tome ? ' on' : ''}` }, id);
      tab.addEventListener('click', () => { tome = id; selected = null; refresh(); });
      tabs.append(tab);
    }
    const undo = el('button', { class: 'ed-btn' }, '↶ undo');
    undo.disabled = !doc.canUndo;
    undo.addEventListener('click', () => { doc.undo(); refresh(); });
    const redo = el('button', { class: 'ed-btn' }, '↷ redo');
    redo.disabled = !doc.canRedo;
    redo.addEventListener('click', () => { doc.redo(); refresh(); });
    const saveBtn = el('button', {
      class: `ed-btn primary${doc.dirty ? ' dirty' : ''}`,
    }, saving ? 'saving…' : doc.dirty ? 'Save •' : 'Saved');
    saveBtn.disabled = saving;
    saveBtn.addEventListener('click', () => void save());
    const link = el('button', { class: `ed-btn tre-link${linking ? ' on' : ''}` },
      linking ? 'linking — click a card' : '⇢ link');
    link.disabled = selected === null;
    link.addEventListener('click', () => { linking = !linking; refresh(); });
    tabs.append(el('span', { class: 'tre-spacer' }), link, undo, redo, saveBtn);
    stage.append(tabs);

    const rows = doc.rows(tome);
    const { tops, height } = rowTops(rows);
    const at = new Map<string, { top: number; col: number; index: number }>();
    rows.forEach((row, i) => {
      if (row.kind !== 'techs') return;
      row.slots.forEach((id, col) => {
        if (id !== null) at.set(id, { top: tops[i], col, index: i });
      });
    });
    /** The same question the game's page asks: may this connector run
     *  straight down the source's column, or does it need the channel? */
    const columnClear = (
      from: { col: number; index: number }, to: { index: number },
    ): boolean => {
      for (let i = from.index + 1; i < to.index; i++) {
        const row = rows[i];
        if (row.kind === 'techs' && row.slots[from.col] !== null) return false;
      }
      return true;
    };

    // Which rows hold anything, in order: a port looks at the next or previous
    // row WITH CARDS ON IT, so an authored gap is stepped over rather than
    // being a dead end.
    const filled = rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.kind === 'techs' && row.slots.some((slot) => slot !== null))
      .map(({ i }) => i);
    const rowIndex = (id: string): number => at.get(id)?.index ?? -1;
    const nextFilled = (i: number): number => filled.find((j) => j > i) ?? -1;
    const prevFilled = (i: number): number =>
      [...filled].reverse().find((j) => j < i) ?? -1;

    /**
     * Which ports a card shows.
     *
     * Nothing is wired: both, on hover, as a hint that they are there. Wiring:
     * only the ports the connection could actually land on — the inputs of the
     * row below an output, the outputs of the row above an input — plus the one
     * it started from. Hover ports are not rendered at all then, so a click
     * cannot reach a port that would refuse it.
     */
    const portsFor = (id: string): Array<{ side: 'in' | 'out'; state: string }> => {
      if (wiring === null) return [{ side: 'in', state: '' }, { side: 'out', state: '' }];
      if (wiring.id === id) return [{ side: wiring.side, state: ' is-active' }];
      const mine = rowIndex(id);
      const theirs = rowIndex(wiring.id);
      if (wiring.side === 'out' && mine === nextFilled(theirs)) {
        return [{ side: 'in', state: ' is-open' }];
      }
      if (wiring.side === 'in' && mine === prevFilled(theirs)) {
        return [{ side: 'out', state: ' is-open' }];
      }
      return [];
    };

    /** A port was pressed: start a connection, finish one, or cancel. */
    const onPort = (id: string, side: 'in' | 'out'): void => {
      if (wiring === null) {
        const i = rowIndex(id);
        const reachable = side === 'out' ? nextFilled(i) : prevFilled(i);
        if (reachable === -1) {
          toast(side === 'out' ? 'nothing on the row below' : 'nothing on the row above', true);
          return;
        }
        wiring = { id, side };
      } else if (wiring.id === id) {
        wiring = null; // pressing your own port again lets go
      } else {
        // The requirement points UP the page, so the lower card is the one
        // that gains it — whichever end the connection was started from.
        const [lower, upper] = wiring.side === 'out' ? [id, wiring.id] : [wiring.id, id];
        const problem = doc.require(lower, upper);
        if (problem !== null) toast(problem, true);
        else selected = lower;
        wiring = null;
      }
      refresh();
    };

    const page = el('div', { class: 'tre-page' });
    const flow = el('div', {
      class: `tre-flow${wiring === null ? '' : ' is-wiring'}`,
      style: `width:${PAGE_W}px;height:${height}px`,
    });

    // Connectors. A cross-band requirement is not drawn on the game's page
    // (techTreeRules.isDrawnEdge), so it is not drawn here either — the
    // inspector lists it instead, which is where it can be edited.
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(PAGE_W));
    svg.setAttribute('height', String(height));
    svg.classList.add('tre-edges');
    for (const [id, to] of at) {
      for (const req of doc.node(id)?.requires ?? []) {
        const from = at.get(req);
        if (from === undefined || !isDrawnEdge(doc.document, req, id)) continue;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', edgeD(edgePath(from, to, columnClear(from, to))));
        path.setAttribute('class', 'tre-edge');
        // A connector is the delete button for the requirement it draws: the
        // fastest way to say "not that one" is to strike the line out.
        path.addEventListener('click', () => { doc.toggleRequirement(id, req); refresh(); });
        const label = document.createElementNS(ns, 'title');
        label.textContent = `${req} → ${id} (click to cut)`;
        path.append(label);
        svg.append(path);
      }
    }
    flow.append(svg);

    rows.forEach((row, i) => {
      if (row.kind === 'gate') {
        flow.append(el('div', {
          class: 'tre-era',
          style: `top:${tops[i] + ROW_GAP / 2}px;height:${GATE_BAR_H}px`,
        }, el('span', {}, `Tome of ${tome} — era ${row.era} bar`)));
        return;
      }
      for (const [col, id] of row.slots.entries()) {
        flow.append(id === null
          ? emptySlot(row.row, col, tops[i], row.era)
          : techCard(id, tops[i], col, portsFor(id), onPort));
      }
      if (row.spare === true) return; // nothing to insert above, nothing to close
      // Row handles, in the channel: open a gap above this row, or close it
      // when it is empty.
      const handles = el('div', { class: 'tre-handles', style: `top:${tops[i]}px` });
      const insert = el('button', { class: 'tre-handle', title: 'insert a row here' }, '+');
      insert.addEventListener('click', () => { doc.insertRow(tome, row.row); refresh(); });
      handles.append(insert);
      if (row.slots.every((slot) => slot === null)) {
        const drop = el('button', { class: 'tre-handle', title: 'close this empty row' }, '−');
        drop.addEventListener('click', () => { doc.removeRow(tome, row.row); refresh(); });
        handles.append(drop);
      }
      flow.append(handles);
    });

    page.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (wiring !== null && target.closest('.tre-card, .tre-port') === null) {
        wiring = null;
        refresh();
      }
    });
    page.append(flow);
    stage.append(page);
  }

  function emptySlot(row: number, col: number, top: number, era: number): HTMLElement {
    const slot = el('div', {
      class: 'tre-slot',
      style: `left:${colLeft(col)}px;top:${top}px;width:${NODE_W}px;height:${NODE_H}px`,
    }, 'Available Slot');
    slot.addEventListener('dragover', (e) => {
      if (dragging === null) return;
      e.preventDefault();
      slot.classList.add('is-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('is-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('is-over');
      dropInto(row, col, era);
    });
    return slot;
  }

  /** One technology on the page: what it is, what it opens, what it costs,
   *  and the two ports a connection is drawn from. */
  function techCard(
    id: string, top: number, col: number,
    ports: Array<{ side: 'in' | 'out'; state: string }>,
    onPort: (id: string, side: 'in' | 'out') => void,
  ): HTMLElement {
    const node = doc.node(id)!;
    const bad = doc.validation.errors.some((e) => e.tech === id);
    const says = node.kind === 'bonus'
      ? `+${node.effectPerRank ?? 0} ${node.line ?? '—'}`
      : node.kind === 'unlock'
        ? (node.unlocks ?? []).map(unlockLabel).join(', ') || '—'
        : 'read by the sim';
    const card = el('div', {
      class: `tre-card is-${node.kind}`
        + (selected === id ? ' is-selected' : '')
        + (bad ? ' is-bad' : '')
        + (node.planned === true ? ' is-planned' : ''),
      draggable: 'true',
      style: `left:${colLeft(col)}px;top:${top}px;width:${NODE_W}px;height:${NODE_H}px`,
      title: node.description,
    },
    el('b', {}, node.name),
    el('span', { class: 'tre-card-says' }, says),
    el('span', { class: 'tre-card-meta' },
      `${node.gold}g${node.knowledge ? `·${node.knowledge}k` : ''}`
      + ` ${node.seconds}s ${node.requires.length}/${MAX_REQUIRES}`));
    card.addEventListener('dragstart', (e) => {
      dragging = id;
      e.dataTransfer?.setData(DRAG_MIME, id);
      e.dataTransfer?.setData('text/plain', id);
    });
    card.addEventListener('dragend', () => { dragging = null; });
    // A card is a drop target too: dropping onto an occupied slot swaps the
    // two, which is how two cards trade places in one gesture.
    card.addEventListener('dragover', (e) => {
      if (dragging === null || dragging === id) return;
      e.preventDefault();
      card.classList.add('is-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('is-over');
      dropInto(node.row, node.col, node.era);
    });
    for (const port of ports) {
      const knob = el('button', {
        class: `tre-port is-${port.side}${port.state}`,
        title: port.side === 'in'
          ? 'input — connect from the row above'
          : 'output — connect to the row below',
      });
      // The card owns click (select) and dragstart (move); a port owns
      // neither, or pressing one would also pick the card up.
      knob.addEventListener('click', (e) => { e.stopPropagation(); onPort(id, port.side); });
      knob.addEventListener('pointerdown', (e) => e.stopPropagation());
      knob.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });
      card.append(knob);
    }
    card.addEventListener('click', () => {
      if (linking && selected !== null && selected !== id) {
        // Whichever way round the pair was clicked, the requirement points UP
        // the page — so the lower card is the one that gains it.
        const other = doc.node(selected)!;
        const [from, to] = other.row < node.row ? [selected, id] : [id, selected];
        if (doc.reachable(to, from)) doc.toggleRequirement(to, from);
        else toast(`${from} does not sit above ${to} on this page`, true);
        refresh();
        return;
      }
      selected = id;
      refresh();
    });
    return card;
  }

  // ---------------------------------------------------------- the inspector
  function drawSide(): void {
    side.replaceChildren();
    if (selected !== null) side.append(inspector(selected));
    side.append(problems());
  }

  function inspector(id: string): HTMLElement {
    const node = doc.node(id);
    if (node === null) return el('div', { class: 'ed-card' }, 'That technology is gone.');
    const card = el('div', { class: 'ed-card' }, el('h2', {}, `${node.glyph} ${id}`));

    // ---- identity
    card.append(field('name', text(node.name, (v) => doc.update(id, { name: v }))));
    card.append(field('glyph', text(node.glyph, (v) => doc.update(id, { glyph: v }))));
    const prose = el('textarea', { class: 'tre-search' }, node.description);
    prose.addEventListener('change', () => {
      doc.update(id, { description: prose.value });
      refresh();
    });
    card.append(field('description', prose));

    // ---- what it costs
    card.append(field('gold', number(node.gold, (v) => doc.update(id, { gold: v }))));
    card.append(field('knowledge',
      number(node.knowledge ?? 0, (v) => doc.update(id, { knowledge: v }))));
    card.append(field('seconds', number(node.seconds, (v) => doc.update(id, { seconds: v }))));

    // ---- what kind of thing it is
    const kind = select([...TECH_KINDS], node.kind);
    kind.addEventListener('change', () => {
      doc.setKind(id, kind.value as TechKind);
      refresh();
    });
    card.append(field('kind', kind));
    if (node.kind === 'unlock') card.append(unlockEditor(id, node));
    if (node.kind === 'bonus') {
      const line = select(doc.lines, node.line ?? doc.lines[0] ?? '');
      line.addEventListener('change', () => { doc.update(id, { line: line.value }); refresh(); });
      card.append(field('line', line));
      card.append(field('per rank',
        number(node.effectPerRank ?? 0, (v) => doc.update(id, { effectPerRank: v }))));
      card.append(el('p', { class: 'ed-note' },
        'A line’s HOOK is code (src/sim/upgrades.ts), so only a line that already '
        + 'exists can be picked — and every rank of one is worth the same.'));
    }
    if (node.kind === 'mechanic') {
      card.append(el('p', { class: 'ed-note' },
        'A mechanic is read by id in the sim — a cover page opening its book, '
        + 'Conquest bending the Knowledge rate. The editor labels it; the code does it.'));
    }
    const planned = el('input', { type: 'checkbox' });
    planned.checked = node.planned === true;
    planned.addEventListener('change', () => {
      doc.update(id, { planned: planned.checked });
      refresh();
    });
    card.append(field('planned', planned));

    // ---- where it sits, and what it needs
    card.append(el('div', { class: 'ed-field' },
      el('span', {}, 'slot'),
      el('code', {}, `${node.tome} · era ${node.era} · row ${node.row} · col ${node.col}`)));
    const reqs = el('div', { class: 'ed-chips' });
    for (const req of node.requires) {
      const chip = el('button', { class: 'ed-chip tre-cut' }, req, ' ✕');
      chip.addEventListener('click', () => { doc.toggleRequirement(id, req); refresh(); });
      reqs.append(chip);
    }
    if (node.requires.length === 0) {
      reqs.append(el('span', { class: 'ed-note' }, 'nothing — the rules refuse this'));
    }
    card.append(el('p', { class: 'ed-hint' }, 'Requires (click to cut)'), reqs);
    const relink = el('button', { class: 'ed-btn' }, 'take the slot’s default');
    relink.addEventListener('click', () => {
      doc.setRequires(id, doc.defaultRequires(node.tome, node.row, node.col));
      refresh();
    });
    const gone = el('button', { class: 'ed-danger' }, 'delete this technology');
    gone.addEventListener('click', () => askDelete(id));
    card.append(relink, gone);
    return card;
  }

  /** What a technology opens: chips to cut, and one row to add another. */
  function unlockEditor(id: string, node: TechNodeDoc): HTMLElement {
    const box = el('div', {});
    const chips = el('div', { class: 'ed-chips' });
    (node.unlocks ?? []).forEach((unlock, i) => {
      const chip = el('button', { class: 'ed-chip tre-cut is-unlock' }, unlockLabel(unlock), ' ✕');
      chip.addEventListener('click', () => { doc.removeUnlock(id, i); refresh(); });
      chips.append(chip);
    });
    if ((node.unlocks ?? []).length === 0) {
      chips.append(el('span', { class: 'ed-note' }, node.planned === true
        ? 'nothing yet — it is planned'
        : 'nothing — say what it opens'));
    }
    const what = select(Object.keys(UNLOCK_TARGETS), 'district');
    const target = select(UNLOCK_TARGETS.district.ids, UNLOCK_TARGETS.district.ids[0]);
    const level = el('input', { class: 'tre-search tre-level', type: 'number', value: '2' });
    const sync = (): void => {
      const spec = UNLOCK_TARGETS[what.value];
      target.replaceChildren(...spec.ids.map((v) => el('option', { value: v }, v)));
      level.hidden = spec.level !== true;
    };
    what.addEventListener('change', sync);
    sync();
    const add = el('button', { class: 'ed-btn' }, '+ unlock');
    add.addEventListener('click', () => {
      const unlock: TechUnlock = what.value === 'districtLevel'
        ? { districtLevel: { id: target.value, level: Math.round(Number(level.value)) } }
        : ({ [what.value]: target.value } as unknown as TechUnlock);
      doc.addUnlock(id, unlock);
      refresh();
    });
    box.append(el('p', { class: 'ed-hint' }, 'Unlocks (click to cut)'), chips,
      el('div', { class: 'tre-unlock-add' }, what, target, level, add));
    return box;
  }

  function problems(): HTMLElement {
    const { errors, warnings } = doc.validation;
    const box = el('div', { class: 'ed-card' },
      el('h2', {}, `Problems — ${errors.length} error(s), ${warnings.length} warning(s)`));
    if (errors.length === 0 && warnings.length === 0) {
      box.append(el('p', { class: 'ed-ok' }, 'The tree validates.'));
    }
    const issues = [
      ...errors.map((e) => [e, 'err'] as const),
      ...warnings.map((w) => [w, 'warn'] as const),
    ].slice(0, 60);
    for (const [problem, kind] of issues) {
      const row = el('button', { class: `ed-issue ${kind}` }, problem.message);
      if (problem.tech === undefined || doc.node(problem.tech) === null) row.disabled = true;
      else {
        row.addEventListener('click', () => {
          selected = problem.tech!;
          tome = doc.node(problem.tech!)!.tome;
          refresh();
        });
      }
      box.append(row);
    }
    return box;
  }

  function drawStatus(): void {
    const { errors, warnings } = doc.validation;
    // The per-band totals the `Technologies` sheet used to add up with a
    // formula. This is where the price-band pass happens now
    // (Docs/features/tech-tree.md §5).
    const bands = doc.totals(tome)
      .filter((band) => band.count > 0)
      .map((band) => `${ROMAN[band.era] ?? band.era}: ${band.count}× `
        + `${thousands(band.gold)}g`
        + (band.knowledge > 0 ? `+${thousands(band.knowledge)}k` : ''));
    status.replaceChildren(
      backButton(),
      el('span', {}, `${doc.ids.length} technologies`),
      el('span', {}, `· ${errors.length} errors · ${warnings.length} warnings`),
      el('span', {}, doc.dirty ? '· unsaved' : '· saved'),
      el('span', { class: 'tre-spacer' }),
      el('span', { class: 'ed-note' }, `${tome} — ${bands.join('   ')}`));
  }

  /** The way back. The tool replaces the game rather than sitting inside it,
   *  so leaving is a navigation — and the `beforeunload` below is what stops
   *  it taking an unsaved page with it. */
  function backButton(): HTMLElement {
    const back = el('button', { class: 'ed-btn', title: 'back to the game' }, '← game');
    back.addEventListener('click', () => { location.search = '?dev'; });
    return back;
  }

  // ------------------------------------------------------------- plumbing
  /** 15675 as "15 675". Not `toLocaleString`: on a Spanish machine that reads
   *  as a decimal, and a price band is the one number here that must not. */
  function thousands(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function field(label: string, input: HTMLElement): HTMLElement {
    return el('div', { class: 'ed-field' }, el('span', {}, label), input);
  }

  function select(options: string[], value: string): HTMLSelectElement {
    const node = el('select', { class: 'tre-search' },
      ...options.map((v) => el('option', { value: v }, v)));
    node.value = value;
    return node;
  }

  function text(value: string, commit: (v: string) => void): HTMLInputElement {
    const node = el('input', { class: 'tre-search', value });
    node.addEventListener('change', () => { commit(node.value); refresh(); });
    return node;
  }

  function number(value: number, commit: (v: number) => void): HTMLInputElement {
    const node = el('input', { class: 'tre-search', type: 'number', value: String(value) });
    node.addEventListener('change', () => { commit(Math.round(Number(node.value))); refresh(); });
    return node;
  }

  function refresh(): void {
    drawPalette();
    drawStage();
    drawSide();
    drawStatus();
  }

  window.addEventListener('beforeunload', (e) => {
    if (doc.dirty) e.preventDefault();
  });

  refresh();
}
