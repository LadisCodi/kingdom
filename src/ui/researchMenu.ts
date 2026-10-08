// Research: the research book (Docs/features/07-research.md §5, mockups M43 and
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
import { TECHNOLOGIES, TECH_ORDER, TOMES, TOME_ORDER } from '../sim/data/definitions';
import {
  canStartTech, eraShortfall, eraUnlocked, isTechComplete, isTechFilled,
  isFoundTome, isTomeOpen, openTomes, researchRefusal, revealedCellCount, techCost, techGoodsCost, techMaterialsCost,
  techKnowledgeCost,
  techPoured, techState,
} from '../sim/research';
import { knowledgeHeld } from '../sim/knowledge';
import { techLine } from '../sim/techProse';
import { getGood } from '../sim/goods';
import { type CurrencyId, type GameState, type GoodId, type TechId, type TomeId } from '../sim/state';
import {
  colLeft, EDGE_BAND, edgePath, edgePieces, ELBOW_R, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, pageRows, rowTops, ROW_GAP,
  type EdgePiece,
} from './research/layout';
import { btn, closeKnob, ctaBadge, iconEl, priceLine, progress, sectionHead, type IconName } from './kit';
import { el, formatExact, coach } from './format';
import { tr, trn } from '../i18n/tr';

/** Which book is open. Module-level so it survives the per-tick re-render,
 *  like the selection below. */
let activeTome: TomeId = 'Kingdom';

// Module-level so the selection survives the per-tick re-render.
let selected: TechId | null = null;

/** The page element of the last render, used only to tell a fresh mount from
 *  a per-tick refresh: on a refresh the old subtree is still in the document
 *  (the host replaces it afterwards), on a fresh mount it is already gone. */
let pageEl: HTMLElement | null = null;
const isFreshMount = (): boolean => pageEl === null || !pageEl.isConnected;
/** The book the page was last centred on: turning to another centres again. */
let centredTome: TomeId | null = null;
/** The zoom the tree was last drawn at (see the page below). */
let lastZoom = 1;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** A book's emblem, stamped on its bookmark. */
const TOME_MARK: Record<string, string> = {
  Kingdom: 'research', Sagas: 'helmet', Atlas: 'compass',
};

/** What opens a shut general book, on its padlocked bookmark
 *  (Docs/features/22-progression.md §3). A found book has no bookmark until
 *  it is found. */
const TOME_HINT: Partial<Record<TomeId, string>> = {};

/**
 * The bookmarks: one ribbon per open book, hanging from the page's bottom
 * edge. The ribbon is ONE shape; its colour is the book's (`--tome`, in
 * research.css), so a found book is a new colour, not a new sprite.
 */
function bookmarks(game: Game): HTMLElement {
  const row = el('div', { class: 'rb-marks' });
  for (const id of TOME_ORDER) {
    const open = isTomeOpen(game.state, id);
    // A found book is not on the shelf until it is found.
    if (!open && isFoundTome(id)) continue;
    if (!open) {
      // A shut general book: its ribbon hangs, greyed, with a padlock; a tap
      // says what opens it (Docs/features/22-progression.md §3).
      const mark = el('button', {
        class: 'rb-mark is-locked', type: 'button', 'data-tome': id,
        'aria-label': tr('{book} — shut', { book: TOMES[id].name }), 'data-coach': `tome:${id}`,
      }, iconEl('padlock'));
      mark.addEventListener('click', () => game.toast(TOME_HINT[id] ?? tr('This book is shut.')));
      row.append(mark);
      continue;
    }
    const mark = el('button', {
      class: `rb-mark${id === activeTome ? ' is-open' : ''}`,
      type: 'button',
      'data-tome': id,
      'aria-label': TOMES[id].name,
      'aria-pressed': id === activeTome ? 'true' : 'false',
      'data-coach': `tome:${id}`,
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

/**
 * What the book is drawn from, so the host rebuilds it only when one of
 * these moves (ui/kit/host.ts) — not on every notify: it is a page of up to
 * a hundred and seventy cards. The open book and the selection; the hint;
 * the research itself; the purse and the Knowledge held, which every price
 * and orb is read against; the revealed cells, which open the bands; and
 * which books are on the shelf. Nothing on it counts down.
 */
export const researchSignature = (game: Game): string => JSON.stringify([
  activeTome, selected, game.uiHint(), game.state.research, game.state.city.wallet,
  knowledgeHeld(game.state), revealedCellCount(game.state), openTomes(game.state),
]);

export function renderResearchMenu(game: Game): HTMLElement {
  const state = game.state;
  const root = el('div', { class: 'research-screen' });

  if (!isTomeOpen(state, activeTome)) { activeTome = 'Kingdom'; selected = null; }
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
    el('h2', { class: 'rb-chapter-title' }, tr('Chapter I')),
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

  const close = coach(closeKnob(() => game.dismiss(), tr('Close Research')), 'close');
  const sheet = el('div', { class: 'rb-stack' },
    // Two pins at the top corners; the way out sits over the right one.
    el('span', { class: 'rb-pin is-left', 'aria-hidden': 'true' }),
    close,
    page);
  root.append(sheet, bookmarks(game));

  // Where the eye should land. A hint wins outright; otherwise, whenever a
  // book is OPENED — the menu mounting, or a bookmark turning to another —
  // the earliest card on the page the kingdom may research now, short of
  // its price or not; with none, the last one researched. The scroll across
  // a per-tick re-render is the host's job (data-keep-scroll).
  const hint = game.uiHint();
  const hinted = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  const shown = [...at.keys()] as TechId[];
  const frontier = shown.find((id) => researchRefusal(state, id) === null)
    ?? [...shown].reverse().find((id) => isTechComplete(state, id))
    ?? null;
  const opened = fresh || centredTome !== activeTome;
  centredTome = activeTome;
  const focus = hinted !== null && at.has(hinted) ? hinted : opened ? frontier : null;
  if (focus !== null && at.has(focus)) {
    // Read off the card where it actually landed — under the chapter's title
    // and at the page's zoom — rather than worked out from the layout.
    requestAnimationFrame(() => {
      const card = flow.querySelector<HTMLElement>(`[data-coach="tech:${focus}"]`);
      if (card === null) return;
      const c = card.getBoundingClientRect();
      const p = page.getBoundingClientRect();
      page.scrollTop = Math.max(0, page.scrollTop + (c.top + c.height / 2) - (p.top + p.height / 2));
    });
  }

  if (selected !== null) root.append(techSheet(game, selected));
  return root;
}

/**
 * The connectors, under the cards: arrows drawn with a quill, assembled from
 * four pieces of art (research.css) — a straight run repeated along its
 * length, an elbow turned to face the way it bends, and a head. No filter and
 * no canvas: a page is as costly as its handful of small images, which is
 * what keeps a long book open on a phone.
 */
function connectors(
  at: Map<string, { top: number; col: number; index: number }>,
  columnClear: (from: { col: number; index: number }, to: { index: number }) => boolean,
  height: number,
): HTMLElement {
  const layer = el('div', {
    class: 'tech-edges', 'aria-hidden': 'true', style: `width:${PAGE_W}px;height:${height}px`,
  });
  // Arrows out of one card share their first run; ink laid twice reads darker.
  const drawn = new Set<string>();
  const draw = (points: Array<{ x: number; y: number }>): void => {
    for (const piece of edgePieces(points)) {
      const key = JSON.stringify(piece);
      if (drawn.has(key)) continue;
      drawn.add(key);
      layer.append(edgePiece(piece));
    }
  };
  for (const [id, to] of at) {
    const def = TECHNOLOGIES[id as TechId];
    let drew = false;
    for (const req of def.requires) {
      const from = at.get(req);
      if (from === undefined) continue;
      drew = true;
      draw(edgePath(from, to, columnClear(from, to)));
    }
    // A requirement with no end on this page — a stub in the gutter above the
    // card, so it does not look like it grows from nowhere.
    if (!drew && def.requires.length > 0) {
      const x = colLeft(to.col) + NODE_W / 2;
      draw([{ x, y: to.top - ROW_GAP / 2 }, { x, y: to.top }]);
    }
  }
  return layer;
}

/** Half a pixel of overlap at each end of a run, so a zoomed page shows no
 *  seam where a run meets its elbow. */
const SEAM = 0.5;

function edgePiece(piece: EdgePiece): HTMLElement {
  const band = EDGE_BAND / 2;
  switch (piece.kind) {
    case 'v':
      return el('span', {
        class: 'rb-edge is-v',
        style: `left:${piece.x - band}px;top:${piece.y - SEAM}px;width:${EDGE_BAND}px;height:${piece.len + 2 * SEAM}px`,
      });
    case 'h':
      return el('span', {
        class: 'rb-edge is-h',
        style: `left:${piece.x - SEAM}px;top:${piece.y - band}px;width:${piece.len + 2 * SEAM}px;height:${EDGE_BAND}px`,
      });
    case 'elbow': {
      // The art joins top to right with the corner at (band, ELBOW_R) in its
      // box; the other three turns are that, turned about the corner.
      const size = ELBOW_R + band;
      return el('span', {
        class: `rb-edge is-elbow is-${piece.turn}`,
        style: `left:${piece.x - band}px;top:${piece.y - ELBOW_R}px;width:${size}px;height:${size}px;`
          + `transform-origin:${band}px ${ELBOW_R}px`,
      });
    }
    case 'head':
      return el('span', { class: 'rb-edge is-head', style: `left:${piece.x}px;top:${piece.y}px` });
  }
}

/**
 * A chapter heading where the next band begins, and — while the band is shut —
 * what the world still owes before it opens. Every band says it, the last
 * one included: a two-band found book's second chapter is content, not a
 * wall (Docs/features/22-progression.md §4).
 */
function chapter(state: GameState, tome: TomeId, era: number, top: number): HTMLElement {
  const open = eraUnlocked(state, tome, era);
  const short = eraShortfall(state, tome, era);
  return el('div', {
    class: `rb-chapter${open ? ' is-open' : ''}`,
    style: `top:${top + ROW_GAP / 2}px;height:${GATE_BAR_H}px`,
  },
  el('span', { class: 'rb-chapter-name' }, tr('Chapter {n}', { n: ROMAN[era] ?? era })),
  open ? el('span', { class: 'rb-chapter-gate' }, '')
    : el('span', { class: 'rb-chapter-gate' },
      trn(short, 'Reveal {n} more cell', 'Reveal {n} more cells', { n: formatExact(short) })));
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
  bar.set(need === 0 ? 1 : poured / need, `${formatExact(poured)} / ${formatExact(need)}`);
  const node = el('button', {
    class: `tech-card k-section is-${status}${ready ? ' is-ready' : ''}`
      + (selected === id ? ' selected' : '')
      + (game.uiHint() === `tech:${id}` ? ' hinted' : '')
      + (def.planned ? ' planned' : ''),
    type: 'button',
    style: `left:${colLeft(col)}px;top:${top}px;width:${NODE_W}px;height:${NODE_H}px`,
    'data-coach': `tech:${id}`,
  },
  // A long name — Spanish runs longer — steps its type down rather than
  // spilling a second line over the art.
  el('span', { class: `tech-card-name${def.name.length > 18 ? ' is-longer' : def.name.length > 15 ? ' is-long' : ''}` }, def.name),
  el('span', { class: 'tech-card-glyph', 'aria-hidden': 'true' }, iconEl(def.icon as IconName, { size: 'lg' })),
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

  const page = el('div', { class: 'rb-sheet', 'data-keep-scroll': 'tech-info', 'data-coach': `techsheet:${id}` },
    el('h2', { class: 'rb-sheet-title' }, def.name),
    el('div', { class: 'rb-rule', 'aria-hidden': 'true' }));

  // ---- 1. what it is
  page.append(el('div', { class: 'rb-about' },
    el('span', { class: 'rb-emblem', 'aria-hidden': 'true' }, iconEl(def.icon as IconName, { size: 'lg' })),
    el('p', { class: 'rb-says' }, techLine(id))));
  if (def.planned) {
    page.append(el('div', { class: 'res-planned' },
      iconEl('hourglass', { size: 'sm' }), tr('Not yet in the prototype')));
  }

  if (status === 'done') {
    page.append(el('div', { class: 'rb-done' }, iconEl('tick', { size: 'sm' }), tr('Researched')));
  } else if (status === 'locked') {
    // What it needs, as the upgrade popup says it: a row each, ticked or not.
    const short = eraShortfall(state, def.tome, def.era);
    const gates = [
      ...def.requires.map((req) => ({
        met: isTechComplete(state, req), icon: 'research', label: tr('Research {tech}', { tech: TECHNOLOGIES[req].name }),
      })),
      ...(short > 0 ? [{ met: false, icon: 'compass', label: trn(short, 'Reveal {n} more cell', 'Reveal {n} more cells', { n: formatExact(short) }) }] : []),
    ];
    page.append(sectionHead(tr('Requirements')), el('div', { class: 'up-table' },
      ...gates.map((g) => el('div', { class: `up-row k-section is-gate${g.met ? ' is-met' : ''}` },
        iconEl(g.icon as never),
        el('span', { class: 'up-row-label' }, g.label),
        iconEl(g.met ? 'tick' : 'cross', { label: g.met ? tr('Met') : tr('Not met') })))));
  } else {
    // ---- 2. Knowledge
    const need = techKnowledgeCost(id);
    const pours = game.techPours(id);
    if (need > 0) {
      const bar = progress('blue');
      bar.set(techPoured(state, id) / need, `${formatExact(techPoured(state, id))} / ${formatExact(need)}`);
      page.append(el('div', { class: 'rb-rule', 'aria-hidden': 'true' }),
        el('div', { class: 'rb-knowledge' },
          bar.root,
          // Once the Knowledge is in there is nothing left to pour: a line in
          // the buttons' place, as tall as they are, so the sheet keeps its size.
          ...(pours.missing === 0 ? [el('div', { class: 'rb-filled' },
            iconEl('tick'), el('span', {}, tr('All its Knowledge is in — it is ready to research')))] : [el('div', { class: 'rb-pours' },
            btn({
              label: formatExact(pours.gems),
              icon: 'Gems',
              kind: 'gem',
              onClick: () => game.doBuyMissingWithGems(id),
              disabledReason: game.walletValue('Gems') < pours.gems ? tr('Not enough Gems') : undefined,
            }),
            btn({
              label: '+1',
              icon: 'Knowledge',
              kind: 'secondary',
              onClick: () => game.doPourTech(id, 1),
              disabledReason: pours.most === 0 ? tr('Nothing to pour') : undefined,
            }),
            coach(btn({
              label: `+${formatExact(pours.most)}`,
              icon: 'Knowledge',
              kind: 'secondary',
              onClick: () => game.doPourTech(id),
              disabledReason: pours.most === 0 ? tr('Nothing to pour') : undefined,
            }), 'tech-pour'))])));
    }

    // ---- 3. research — the upgrade popup's block: the price above, the button
    const filled = isTechFilled(state, id);
    const gold = techCost(id);
    const shortGold = game.walletValue('Gold') < gold;
    // Wood, Stone and Food beside the Gold, out of the city's purse.
    const materials = Object.entries(techMaterialsCost(id)) as Array<[CurrencyId, number]>;
    const shortMaterials = materials.some(([c, n]) => game.walletValue(c) < n);
    // The refined goods beside the Gold, as a building level shows them.
    const goods = Object.entries(techGoodsCost(game.state, id)) as Array<[GoodId, number]>;
    const shortGoods = goods.some(([g, n]) => getGood(state.city.goods, g) < n);
    const note = filled ? null : tr('Assign all its Knowledge to research it');
    page.append(el('div', { class: 'rb-rule', 'aria-hidden': 'true' }),
      el('div', { class: 'up-buy k-section' },
        priceLine([
          ...(gold > 0 ? [{ icon: 'Gold' as IconName, amount: formatExact(gold), short: shortGold }] : []),
          ...materials.map(([c, n]) => ({ icon: c as IconName, amount: formatExact(n), short: game.walletValue(c) < n })),
          ...goods.map(([g, n]) => ({
            icon: g as IconName, amount: formatExact(n), short: getGood(state.city.goods, g) < n,
          })),
        ]),
        coach(btn({
          label: tr('Research'),
          kind: 'primary',
          icon: filled ? undefined : 'padlock',
          onClick: () => { game.doResearchTech(id); if (isTechComplete(game.state, id)) dismiss(); },
          disabledReason: !filled ? note! : shortGold ? tr('Not enough Gold')
            : shortMaterials ? tr('Not enough Wood, Stone or Food') : shortGoods ? tr('Not enough refined goods') : undefined,
        }), 'tech-research'),
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
