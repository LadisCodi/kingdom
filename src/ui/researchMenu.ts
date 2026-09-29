// Research: the research book (Docs/plans/research-book.md, mockups M43 and
// M46).
//
//  - ONE page, never a spread: a sheet of parchment centred on the screen on a
//    small stack of papers, pinned at its top corners. The same sheet is the
//    technology's sheet, so the two read as one object.
//  - The books are BOOKMARKS hanging from the page's bottom edge, in the space
//    the nav bar leaves (it steps aside while a menu is open). One ribbon,
//    tinted per book in CSS — a new book costs no new sprite.
//  - A book is one page read top to bottom: three columns of cards in the
//    layout of src/ui/research/layout.ts, with a CHAPTER heading wherever the
//    next band begins. Connectors are quill-drawn arrows.
//  - No tree fog: every technology is on the page from the first minute, in
//    one of three states — locked (greyscale), in progress, done.

import type { Game } from '../game';
import { ERA_COUNT, TECHNOLOGIES, TECH_ORDER, TOMES, TOME_ORDER } from '../sim/data/definitions';
import {
  canStartTech, eraShortfall, eraUnlocked, isTechComplete, isTechFilled, isTechStarted,
  isTomeOpen, techCost, techKnowledgeCost, techPoured, techState,
} from '../sim/research';
import { techLine } from '../sim/techProse';
import { type GameState, type TechId, type TomeId } from '../sim/state';
import {
  colLeft, edgeD, edgePath, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, pageRows, rowTops, ROW_GAP,
} from './research/layout';
import { btn, closeKnob, ctaBadge, iconEl, progress, sectionHead } from './kit';
import { el, formatExact } from './format';

/** Which book is open. Module-level so it survives the per-tick re-render,
 *  like the selection below. */
let activeTome: TomeId = 'Civics';

// Module-level so the selection survives the per-tick re-render.
let selected: TechId | null = null;

/** The page element of the last render, used only to tell a fresh mount from
 *  a per-tick refresh: on a refresh the old subtree is still in the document
 *  (the host replaces it afterwards), on a fresh mount it is already gone. */
let pageEl: HTMLElement | null = null;
const isFreshMount = (): boolean => pageEl === null || !pageEl.isConnected;
/** The zoom the tree was last drawn at (see the page below). */
let lastZoom = 1;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** A book's emblem, stamped on its bookmark. */
const TOME_MARK: Record<string, string> = { Civics: 'research', Warfare: 'army', Magic: 'Mana' };

/**
 * The bookmarks: one ribbon per open book, hanging from the page's bottom
 * edge. The ribbon is ONE shape; its colour is the book's (`--tome`, in
 * research.css), so a found book is a new colour, not a new sprite.
 */
function bookmarks(game: Game): HTMLElement {
  const row = el('div', { class: 'rb-marks' });
  for (const id of TOME_ORDER.filter((t) => isTomeOpen(game.state, t))) {
    const mark = el('button', {
      class: `rb-mark${id === activeTome ? ' is-open' : ''}`,
      type: 'button',
      'data-tome': id,
      'aria-label': TOMES[id].name,
      'aria-pressed': id === activeTome ? 'true' : 'false',
    }, iconEl((TOME_MARK[id] ?? 'research') as never));
    mark.addEventListener('click', () => {
      if (activeTome === id) return;
      activeTome = id;
      selected = null; // a selection on another page is not on this one
      game.notify();
    });
    row.append(mark);
  }
  return row;
}

export function renderResearchMenu(game: Game): HTMLElement {
  const state = game.state;
  const root = el('div', { class: 'research-screen' });

  if (!isTomeOpen(state, activeTome)) { activeTome = 'Civics'; selected = null; }
  // A selection on a page the player has turned away from is not on this one.
  if (selected !== null && TECHNOLOGIES[selected].tome !== activeTome) selected = null;

  // ---- the page: every placed technology of the book, no fog ----
  const rows = pageRows(TECHNOLOGIES, activeTome, (id) => TECHNOLOGIES[id as TechId].placed);
  const { tops, height } = rowTops(rows);
  /** Where a technology's card sits on this page. */
  const at = new Map<string, { top: number; col: number; index: number }>();
  rows.forEach((row, i) => {
    if (row.kind !== 'techs') return;
    row.slots.forEach((id, col) => {
      if (id !== null) at.set(id, { top: tops[i], col, index: i });
    });
  });
  /** Is the source's column empty on every row between the two? That is what
   *  decides whether a connector may run straight down it (layout.edgePath). */
  const columnClear = (
    from: { col: number; index: number }, to: { index: number },
  ): boolean => {
    for (let i = from.index + 1; i < to.index; i++) {
      const row = rows[i];
      if (row.kind === 'techs' && row.slots[from.col] !== null) return false;
    }
    return true;
  };

  const flow = el('div', { class: 'tech-flow', style: `width:${PAGE_W}px;height:${height}px` });
  flow.append(connectors(at, columnClear, height));
  rows.forEach((row, i) => {
    if (row.kind === 'gate') { flow.append(chapter(state, activeTome, row.era, tops[i])); return; }
    for (const [col, id] of row.slots.entries()) {
      if (id !== null) flow.append(card(game, id as TechId, tops[i], col));
    }
  });

  // Captured BEFORE pageEl is reassigned — the old element is the evidence,
  // and overwriting it first would make every render look fresh.
  const fresh = isFreshMount();
  const page = el('div', { class: 'rb-page', 'data-keep-scroll': 'tech-page' },
    el('h2', { class: 'rb-chapter-title' }, 'Chapter I'),
    el('div', { class: 'rb-rule', 'aria-hidden': 'true' }),
    flow);
  pageEl = page;
  // The tree is laid out at its own width and zoomed to the page's, so three
  // columns fit any phone. The last zoom is applied at once, so a per-tick
  // re-render does not flash; the measured one follows on the next frame.
  flow.style.zoom = String(lastZoom);
  requestAnimationFrame(() => {
    const w = page.clientWidth - 8;
    if (w <= 0) return;
    lastZoom = Math.min(1, w / PAGE_W);
    flow.style.zoom = String(lastZoom);
  });

  const close = closeKnob(() => game.dismiss(), 'Close Research');
  const sheet = el('div', { class: 'rb-stack' },
    // Two pins at the top corners; the way out sits over the right one.
    el('span', { class: 'rb-pin is-left', 'aria-hidden': 'true' }),
    close,
    page);
  root.append(sheet, bookmarks(game));

  // Where the eye should land. A hint wins outright; otherwise, on a FRESH
  // mount only, the work: a card whose Knowledge is in, then one being
  // poured into, then the last one researched. The scroll across a per-tick
  // re-render is the host's job (data-keep-scroll).
  const hint = game.uiHint();
  const hinted = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  const shown = [...at.keys()] as TechId[];
  const frontier = shown.find((id) => !isTechComplete(state, id) && isTechFilled(state, id)
      && techState(state, id) === 'progress')
    ?? shown.find((id) => isTechStarted(state, id))
    ?? shown.find((id) => canStartTech(state, id))
    ?? [...shown].reverse().find((id) => isTechComplete(state, id))
    ?? null;
  const focus = hinted !== null && at.has(hinted) ? hinted : fresh ? frontier : null;
  const focusAt = focus === null ? undefined : at.get(focus);
  if (focusAt !== undefined) {
    requestAnimationFrame(() => {
      page.scrollTop = Math.max(0, (focusAt.top + NODE_H / 2) * lastZoom - page.clientHeight / 2);
    });
  }

  if (selected !== null) root.append(techSheet(game, selected));
  return root;
}

/**
 * The connectors, under the cards: plain arrows drawn with a quill — thin
 * sepia ink, a slightly uneven stroke (an SVG displacement filter), a small
 * drawn arrowhead into the card that needs it.
 */
function connectors(
  at: Map<string, { top: number; col: number; index: number }>,
  columnClear: (from: { col: number; index: number }, to: { index: number }) => boolean,
  height: number,
): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(PAGE_W));
  svg.setAttribute('height', String(height));
  svg.classList.add('tech-edges');
  svg.innerHTML = `<defs>
    <filter id="rb-quill" filterUnits="userSpaceOnUse" x="0" y="0" width="${PAGE_W}" height="${height}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7"/>
      <feDisplacementMap in="SourceGraphic" scale="1.6"/>
    </filter>
    <marker id="rb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" class="tech-arrowhead"/>
    </marker>
  </defs>`;
  const stroke = (d: string): void => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'tech-edge');
    path.setAttribute('marker-end', 'url(#rb-arrow)');
    svg.append(path);
  };
  for (const [id, to] of at) {
    const def = TECHNOLOGIES[id as TechId];
    let drew = false;
    for (const req of def.requires) {
      const from = at.get(req);
      if (from === undefined) continue;
      drew = true;
      stroke(edgeD(edgePath(from, to, columnClear(from, to))));
    }
    // A requirement with no end on this page — a stub in the gutter above the
    // card, so it does not look like it grows from nowhere.
    if (!drew && def.requires.length > 0) {
      const x = colLeft(to.col) + NODE_W / 2;
      stroke(`M ${x} ${to.top - ROW_GAP / 2} L ${x} ${to.top}`);
    }
  }
  return svg;
}

/**
 * A chapter heading where the next band begins, and — while the band is shut —
 * what the world still owes before it opens. The book's last band says it is
 * sealed.
 */
function chapter(state: GameState, tome: TomeId, era: number, top: number): HTMLElement {
  const open = eraUnlocked(state, tome, era);
  const short = eraShortfall(state, tome, era);
  const sealed = era >= ERA_COUNT[tome];
  return el('div', {
    class: `rb-chapter${open ? ' is-open' : ''}`,
    style: `top:${top + ROW_GAP / 2}px;height:${GATE_BAR_H}px`,
  },
  el('span', { class: 'rb-chapter-name' }, `Chapter ${ROMAN[era] ?? era}`),
  open ? el('span', { class: 'rb-chapter-gate' }, '')
    : el('span', { class: 'rb-chapter-gate' },
      sealed ? 'Sealed' : `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'}`));
}

/**
 * One technology, as a card in its slot: the building card's stat tile, the
 * emblem, the name, and the game's own progress bar with the Knowledge
 * poured over what it needs written inside it — blue while it is being
 * filled, green with a tick once researched. A locked card is the same card
 * in greyscale, with a padlock.
 */
function card(game: Game, id: TechId, top: number, col: number): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const status = techState(state, id);
  const need = techKnowledgeCost(id);
  const poured = status === 'done' ? need : techPoured(state, id);
  const ready = status === 'progress' && isTechFilled(state, id);

  const bar = progress(status === 'done' ? 'green' : 'blue');
  bar.set(need === 0 ? 1 : poured / need, `${poured} / ${need}`);
  const node = el('button', {
    class: `tech-card k-section is-${status}${ready ? ' is-ready' : ''}`
      + (selected === id ? ' selected' : '')
      + (game.uiHint() === `tech:${id}` ? ' hinted' : '')
      + (def.planned ? ' planned' : ''),
    type: 'button',
    style: `left:${colLeft(col)}px;top:${top}px;width:${NODE_W}px;height:${NODE_H}px`,
  },
  el('span', { class: 'tech-card-glyph', 'aria-hidden': 'true' }, def.glyph),
  el('span', { class: 'tech-card-name' }, def.name),
  el('span', { class: 'tech-card-bar' },
    bar.root,
    ...(status === 'done' ? [iconEl('tick', { size: 'sm' })]
      : status === 'locked' ? [iconEl('padlock', { size: 'sm' })] : [])));
  // The orb on anything with a press worth making right now.
  if (canStartTech(state, id)) node.append(ctaBadge(1, `tech:${id}`));
  node.addEventListener('click', () => { selected = id; game.notify(); });
  return node;
}

/**
 * A technology, opened (M46): a loose research page over the book, read top to bottom in three parts that are never
 * numbered on it:
 *
 *  1. what it is — its emblem and one plain sentence; the name is the heading;
 *  2. Knowledge — the bar, and three pours with the price on the button: Gems
 *     for every point still missing, +1, and as much as the bar allows; once
 *     it is full, a line saying so in their place;
 *  3. research — the Gold above the button, and the button.
 *
 * A technology whose requirements are not met shows part 1 and its
 * requirements — the upgrade popup's rows — and nothing else: there is
 * nothing in the other two to press. Two ways out: the knob and the scrim.
 */
function techSheet(game: Game, id: TechId): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const dismiss = (): void => { selected = null; game.notify(); };
  const status = techState(state, id);

  const page = el('div', { class: 'rb-sheet', 'data-keep-scroll': 'tech-info' },
    el('h2', { class: 'rb-sheet-title' }, def.name),
    el('div', { class: 'rb-rule', 'aria-hidden': 'true' }));

  // ---- 1. what it is
  page.append(el('div', { class: 'rb-about' },
    el('span', { class: 'rb-emblem', 'aria-hidden': 'true' }, def.glyph),
    el('p', { class: 'rb-says' }, techLine(id))));
  if (def.planned) {
    page.append(el('div', { class: 'res-planned' },
      iconEl('hourglass', { size: 'sm' }), 'Not yet in the prototype'));
  }

  if (status === 'done') {
    page.append(el('div', { class: 'rb-done' }, iconEl('tick', { size: 'sm' }), 'Researched'));
  } else if (status === 'locked') {
    // What it needs, as the upgrade popup says it: a row each, ticked or not.
    const short = eraShortfall(state, def.tome, def.era);
    const gates = [
      ...def.requires.map((req) => ({
        met: isTechComplete(state, req), icon: 'research', label: `Research ${TECHNOLOGIES[req].name}`,
      })),
      ...(short > 0 ? [{ met: false, icon: 'compass', label: `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'}` }] : []),
    ];
    page.append(sectionHead('Requirements'), el('div', { class: 'up-table' },
      ...gates.map((g) => el('div', { class: `up-row k-section is-gate${g.met ? ' is-met' : ''}` },
        iconEl(g.icon as never),
        el('span', { class: 'up-row-label' }, g.label),
        iconEl(g.met ? 'tick' : 'cross', { label: g.met ? 'Met' : 'Not met' })))));
  } else {
    // ---- 2. Knowledge
    const need = techKnowledgeCost(id);
    const pours = game.techPours(id);
    if (need > 0) {
      const bar = progress('blue');
      bar.set(techPoured(state, id) / need, `${techPoured(state, id)} / ${need}`);
      page.append(el('div', { class: 'rb-rule', 'aria-hidden': 'true' }),
        el('div', { class: 'rb-knowledge' },
          bar.root,
          // Once the Knowledge is in there is nothing left to pour: a line in
          // the buttons' place, as tall as they are, so the sheet keeps its size.
          ...(pours.missing === 0 ? [el('div', { class: 'rb-filled' },
            iconEl('tick'), el('span', {}, 'All its Knowledge is in — it is ready to research'))] : [el('div', { class: 'rb-pours' },
            btn({
              label: formatExact(pours.gems),
              icon: 'Gems',
              kind: 'gem',
              onClick: () => game.doBuyMissingWithGems(id),
              disabledReason: game.walletValue('Gems') < pours.gems ? 'Not enough Gems' : undefined,
            }),
            btn({
              label: '+1',
              icon: 'Knowledge',
              kind: 'secondary',
              onClick: () => game.doPourTech(id, 1),
              disabledReason: pours.most === 0 ? 'Nothing to pour' : undefined,
            }),
            btn({
              label: `+${pours.most}`,
              icon: 'Knowledge',
              kind: 'secondary',
              onClick: () => game.doPourTech(id),
              disabledReason: pours.most === 0 ? 'Nothing to pour' : undefined,
            }))])));
    }

    // ---- 3. research — the upgrade popup's block: the price above, the button
    const filled = isTechFilled(state, id);
    const gold = techCost(id);
    const shortGold = game.walletValue('Gold') < gold;
    const note = filled ? null : 'Assign all its Knowledge to research it';
    page.append(el('div', { class: 'rb-rule', 'aria-hidden': 'true' }),
      el('div', { class: 'up-buy k-section' },
        el('div', { class: 'up-price' },
          ...(gold > 0 ? [el('span', { class: `up-price-chip${shortGold ? ' is-short' : ''}` },
            iconEl('Gold'), el('b', {}, formatExact(gold)))] : [])),
        btn({
          label: 'Research',
          kind: 'primary',
          icon: filled ? undefined : 'padlock',
          onClick: () => { game.doResearchTech(id); if (isTechComplete(game.state, id)) dismiss(); },
          disabledReason: !filled ? note! : shortGold ? 'Not enough Gold' : undefined,
        }),
        ...(note === null ? [] : [el('div', { class: 'up-note' }, note)])));
  }

  // The way out sits in the page's corner, outside what scrolls.
  const scrim = el('div', { class: 'tech-modal' }, el('div', { class: 'rb-sheet-wrap' },
    closeKnob(dismiss),
    page));
  // The scrim dismisses; the page does not, or every press inside it would
  // close the thing being pressed.
  scrim.addEventListener('click', (e) => { if (e.target === scrim) dismiss(); });
  return scrim;
}
