// Research overlay: ONE PAGE PER TOME, read top to bottom.
//  - A tab per open book; inside it, the whole book as a flow chart of cards
//    three columns wide, with an ERA BAR spanning the page wherever the next
//    band begins (Docs/features/07-research.md §2.2).
//  - Every technology has a slot, minor ranks included: rank II is a card in
//    band 2, not a bead hanging off its parent.
//  - Connectors run in the gutter between two rows, or out into the side
//    channel when they reach further — so a line never crosses a card
//    (research/layout.ts).
//  - Tree fog: researched/available cards render normally; one step beyond
//    what is researched or running shows as an anonymous "?"; anything deeper
//    is not drawn, and the rows it would have filled collapse.
//  - An era bar the player has not earned says what is left to reveal. The
//    band below it draws, dimmed: the page is legible, and nothing in it is
//    startable until the region is.

import type { Game } from '../game';
import {
  ERA_COUNT, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, TOMES, TOME_ORDER,
} from '../sim/data/definitions';
import {
  canStartTech, eraShortfall, eraUnlocked, isTechActive, isTechComplete, isTomeOpen,
  knowledgeShortfallMs, requirementsMet, slotGemCost, techCompletesAt, techEraUnlocked,
  techSlots, techVisibility,
} from '../sim/research';
import { techLine } from '../sim/techProse';
import { knowledgePerHour } from '../sim/mana';
import { type GameState, type TechId, type TomeId } from '../sim/state';
import {
  colLeft, edgeD, edgePath, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, pageRows, rowTops, ROW_GAP,
} from './research/layout';
import { action, btn, iconEl, knob } from './kit';
import { el, formatDuration } from './format';

/** Which book is open on the lectern. Module-level so it survives the
 *  per-tick re-render, like the selection below. */
let activeTome: TomeId = 'Civics';

// Module-level so the selection survives the per-tick re-render.
type Selected = { kind: 'tech'; id: TechId } | null;
let selected: Selected = null;

/** The page element of the last render, used only to tell a fresh mount from
 *  a per-tick refresh: on a refresh the old subtree is still in the document
 *  (the host replaces it afterwards), on a fresh mount it is already gone. */
let pageEl: HTMLElement | null = null;
const isFreshMount = (): boolean => pageEl === null || !pageEl.isConnected;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** The shelf: one tab per tome the player has actually opened. A book they
 *  have not earned is not shown at all — an empty tab is the same lie as a
 *  lit nav button that leads nowhere. */
function shelf(game: Game): HTMLElement | null {
  const open = TOME_ORDER.filter((t) => isTomeOpen(game.state, t));
  if (open.length < 2) return null; // one book is not a shelf
  const row = el('div', { class: 'res-shelf' });
  for (const id of open) {
    const def = TOMES[id];
    const tab = el('button', {
      class: `btn res-tome${id === activeTome ? ' active' : ''}`,
    }, iconEl('research', { size: 'sm' }), el('span', {}, def.name));
    tab.addEventListener('click', () => {
      if (activeTome === id) return;
      activeTome = id;
      selected = null; // a selection on another page is not on this one
      game.notify();
    });
    row.append(tab);
  }
  return row;
}

export function renderResearchMenu(game: Game): HTMLElement {
  const state = game.state;
  const root = el('div', { class: 'research-screen' });

  // A tome can close behind the player only by a save being loaded that never
  // opened it, so fall back to the one book that is always open.
  if (!isTomeOpen(state, activeTome)) { activeTome = 'Civics'; selected = null; }
  // Drop a selection the fog no longer shows (e.g. after a fresh load), or one
  // that belongs to a page the player has since turned away from.
  if (selected?.kind === 'tech'
    && (techVisibility(state, selected.id) !== 'normal'
      || TECHNOLOGIES[selected.id].tome !== activeTome)) selected = null;

  const busy = state.research.active.length;
  const slots = techSlots(state);

  const close = knob('✕', () => game.dismiss(), { label: 'Close Research' });
  close.setAttribute('data-own-close', '');
  const bar = slotStrip(game, busy, slots);
  const tabs = shelf(game);
  root.append(el('div', { class: 'research-topbar' },
    el('h2', {}, TOMES[activeTome].name), bar, close));
  if (tabs) root.append(tabs);
  root.append(el('p', { class: 'res-blurb' }, TOMES[activeTome].blurb));

  // ---- the page (as long as what the fog currently shows) ----
  const rows = pageRows(TECHNOLOGIES, activeTome,
    (id) => TECHNOLOGIES[id as TechId].placed
      && techVisibility(state, id as TechId) !== 'hidden');
  const { tops, height } = rowTops(rows);
  /** Where a technology's card sits, or null when this page does not show it. */
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

  const flow = el('div', {
    class: 'tech-flow',
    style: `width:${PAGE_W}px;height:${height}px`,
  });

  // Connectors, under the cards.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(PAGE_W));
  svg.setAttribute('height', String(height));
  svg.classList.add('tech-edges');
  const stroke = (d: string, cls: string) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', cls);
    svg.append(path);
  };
  for (const [id, to] of at) {
    const def = TECHNOLOGIES[id as TechId];
    let drew = false;
    for (const req of def.requires) {
      const from = at.get(req);
      // Every requirement on this page, band or no band: an edge that reaches
      // back over an era bar is how the two bands connect
      // (techTreeRules.isDrawnEdge). It passes under the bar, which is the
      // honest picture of a gate you cross.
      if (from === undefined) continue;
      drew = true;
      stroke(edgeD(edgePath(from, to, columnClear(from, to))),
        techVisibility(state, id as TechId) === 'silhouette' ? 'tech-edge dim'
          : isTechComplete(state, req) ? 'tech-edge open' : 'tech-edge');
    }
    // A requirement with no end on this page — off the page mid-rearrangement,
    // which the rules refuse to ship. A stub in the gutter above the card, so
    // it does not look like it grows from nowhere: half a gutter long and
    // pointing at the card, not a path from anywhere.
    if (!drew && def.requires.length > 0) {
      const x = colLeft(to.col) + NODE_W / 2;
      stroke(`M ${x} ${to.top - ROW_GAP / 2} L ${x} ${to.top}`,
        def.requires.every((r) => isTechComplete(state, r)) ? 'tech-edge open' : 'tech-edge');
    }
  }
  flow.append(svg);

  // Era bars and cards.
  rows.forEach((row, i) => {
    if (row.kind === 'gate') { flow.append(eraBar(state, activeTome, row.era, tops[i])); return; }
    for (const [col, id] of row.slots.entries()) {
      if (id === null) continue;
      flow.append(card(game, id as TechId, tops[i], col));
    }
  });

  // Captured BEFORE pageEl is reassigned — the old element is the evidence,
  // and overwriting it first would make every render look fresh.
  const fresh = isFreshMount();
  const page = el('div', { class: 'tech-page', 'data-keep-scroll': '' }, flow);
  pageEl = page;
  // Tapping the page beside a card deselects (the info panel hides).
  page.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.tech-card')) return;
    if (selected !== null) { selected = null; game.notify(); }
  });

  // Where the eye should land. A hint wins outright — it is the game asking
  // for attention at a specific node. Otherwise, on a FRESH mount only: the
  // WORK, meaning whatever is running or startable right now, and failing
  // that the last thing finished, which is where the next branch grows from.
  // The scroll across a per-tick re-render is the host's job
  // (data-keep-scroll), and must never be yanked while a finger is on it.
  const hint = game.uiHint();
  const hinted = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  const shown = [...at.keys()] as TechId[];
  const frontier = shown.find((id) => isTechActive(state, id))
    ?? shown.find((id) => canStartTech(state, id))
    ?? [...shown].reverse().find((id) => isTechComplete(state, id))
    ?? null;
  const focus = hinted !== null && at.has(hinted) ? hinted : fresh ? frontier : null;
  const focusAt = focus === null ? undefined : at.get(focus);
  if (focusAt !== undefined) {
    requestAnimationFrame(() => {
      page.scrollTop = Math.max(0, focusAt.top - page.clientHeight / 2 + NODE_H / 2);
    });
  }
  root.append(page);

  // ---- the card's own sheet, over everything, while one is selected ----
  if (selected?.kind === 'tech') {
    root.append(techInfoModal(game, selected.id, busy, slots));
  }
  return root;
}

/**
 * THE SLOTS, as a row of desks you can point at.
 *
 * This replaced a sentence ("2 of 3 at work") and a Hire button beside it.
 * A count is an abstraction; a strip of slots is the thing itself — how many
 * you have, which are running, when each frees up, and what the next one
 * costs, all in one glance and all in the same units.
 *
 * The row is every unlocked slot, plus ONE locked one when there are more to
 * buy. Never the whole ladder: an empty slot is an invitation and four of
 * them is a shop.
 *
 * Three states, each with its own line underneath:
 *   free    — nothing running; the line says so
 *   in use  — the time left on what is running
 *   locked  — the Gems it costs, and pressing it buys
 */
function slotStrip(game: Game, busy: number, slots: number): HTMLElement {
  const state = game.state;
  const strip = el('div', { class: 'res-slots' });

  // Active research in start order, so a slot does not change its occupant
  // when another finishes.
  const running = [...state.research.active]
    .sort((a, b) => a.startedAt - b.startedAt);

  for (let i = 0; i < slots; i += 1) {
    const active = running[i];
    if (active === undefined) {
      strip.append(el('div', { class: 'res-slot is-free' },
        el('div', { class: 'res-slot-box' }, iconEl('plus', { size: 'md' })),
        el('div', { class: 'res-slot-note' }, 'Free')));
      continue;
    }
    const def = TECHNOLOGIES[active.id];
    const completesAt = techCompletesAt(state, active.id)!;
    const left = Math.max(0, (completesAt - game.now()) / 1000);
    const box = el('button', {
      class: 'res-slot-box is-busy', type: 'button', 'aria-label': def.name,
    }, el('span', { class: 'res-slot-glyph' }, def.glyph));
    // Tapping the desk opens what is on it, which is where the Gem finish is.
    box.addEventListener('click', () => {
      selected = { kind: 'tech', id: active.id };
      game.notify();
    });
    strip.append(el('div', { class: 'res-slot is-busy' },
      box,
      el('div', { class: 'res-slot-note' }, formatDuration(left))));
  }

  if (slots < RESEARCH_SETTINGS.maxSlots) {
    const cost = slotGemCost(state);
    const short = game.walletValue('Gems') < cost;
    const box = el('button', {
      class: `res-slot-box is-locked${short ? ' is-short' : ''}`,
      type: 'button',
      'aria-label': `Unlock a research slot for ${cost} Gems`,
    }, iconEl('plus', { size: 'md' }));
    box.addEventListener('click', () => game.doBuySlot());
    strip.append(el('div', { class: 'res-slot is-locked' },
      box,
      el('div', { class: `res-slot-note${short ? ' is-short' : ''}` },
        iconEl('Gems', { size: 'sm' }), String(cost))));
  }
  void busy;
  return strip;
}

/**
 * The bar between two bands: what the book calls the next part of itself, and
 * what the world still owes before it opens.
 *
 * It spans the page because it is not a node — nothing requires it and it
 * cannot be researched. It is a door, and the price is written on it.
 */
function eraBar(state: GameState, tome: TomeId, era: number, top: number): HTMLElement {
  const open = eraUnlocked(state, tome, era);
  const short = eraShortfall(state, tome, era);
  // The book's LAST band is the sealed one, and a book carries its own count
  // now — Civics may run deeper than Warfare without either being wrong.
  const sealed = era >= ERA_COUNT[tome];
  const bar = el('div', {
    class: `res-era${open ? ' is-open' : ''}${sealed ? ' is-sealed' : ''}`,
    style: `top:${top + ROW_GAP / 2}px;height:${GATE_BAR_H}px`,
  },
  el('span', { class: 'res-era-name' }, `Tome of ${TOMES[tome].name} ${ROMAN[era] ?? era}`));
  bar.append(el('span', { class: 'res-era-gate' },
    sealed ? 'Sealed'
      : open ? 'Opened'
        : `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'}`));
  return bar;
}

/** One technology, as a card in its slot. */
function card(game: Game, id: TechId, top: number, col: number): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const place = `left:${colLeft(col)}px;top:${top}px;`
    + `width:${NODE_W}px;height:${NODE_H}px`;
  if (techVisibility(state, id) === 'silhouette') {
    return el('div', { class: 'tech-card silhouette', style: place }, '?');
  }
  const done = isTechComplete(state, id);
  const active = isTechActive(state, id);
  const cls = done ? 'done' : active ? 'active' : 'available';
  const isSel = selected?.kind === 'tech' && selected.id === id;
  const hinted = game.uiHint() === `tech:${id}`;
  const node = el('button', {
    class: `btn tech-card ${cls}${isSel ? ' selected' : ''}${hinted ? ' hinted' : ''}`
      + (def.planned ? ' planned' : '')
      + (techEraUnlocked(state, id) ? '' : ' era-locked'),
    style: place,
  },
  el('span', { class: 'tech-card-glyph' }, def.glyph),
  el('span', { class: 'tech-card-name' }, def.name));
  // A dot on everything startable RIGHT NOW. The page shows a lot of cards
  // the player cannot act on yet — done, running, unaffordable, missing a
  // prerequisite, behind a bar — and `available` styling only means the
  // prerequisites are met. The dot is the difference.
  if (canStartTech(state, id)) node.append(el('span', { class: 'node-dot' }));
  if (active) {
    const completesAt = techCompletesAt(state, id)!;
    const total = def.durationSeconds * 1000;
    const fill = el('div', { class: 'fill' });
    fill.style.width =
      `${Math.min(100, Math.max(0, (1 - (completesAt - game.now()) / total) * 100))}%`;
    node.append(el('div', { class: 'node-bar' }, fill));
  }
  node.addEventListener('click', () => {
    selected = { kind: 'tech', id };
    game.notify();
  });
  return node;
}

/**
 * A technology, opened.
 *
 * A MODAL over the whole book, not a panel resting on the bottom of it. The
 * panel had to be short enough to leave the page usable behind it, which is
 * the wrong constraint on the one surface that has to say what a card does,
 * what it needs, what it costs and how long it takes. Nothing else is
 * actionable while it is up, so nothing else needs the room.
 *
 * Two ways out, because a modal with one is a trap: the ✕ and the scrim.
 */
function techInfoModal(game: Game, id: TechId, busy: number, slots: number): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const dismiss = (): void => { selected = null; game.notify(); };

  const panel = el('div', { class: 'tech-info' });
  const head = el('div', { class: 'tech-info-head' },
    el('h3', {}, `${def.glyph} ${def.name}`),
    knob('✕', dismiss, { label: 'Close' }));
  panel.append(head);
  // WHAT IT DOES, in full. The card carries only the glyph and the name, so
  // this is the first place the player reads the sentence — and the whole of
  // it, where a card would have clipped it to three lines.
  panel.append(el('div', { class: 'res-says' }, techLine(id)));
  // A PROPERTY OF THE TECHNOLOGY, so it reads with the other properties
  // rather than inside a button. It was a note on Start, where it looked like
  // a fact about the press instead of a fact about the card — and it is true
  // whichever button the player ends up using, or neither.
  panel.append(el('div', { class: 'res-duration' },
    iconEl('hourglass', { size: 'sm' }),
    `Duration: ${formatDuration(def.durationSeconds)}`));
  if (def.planned) {
    // Said in the game, not only in a doc: a playtester who researches this
    // must know before they pay that it does nothing yet.
    panel.append(el('div', { class: 'res-planned' },
      iconEl('hourglass', { size: 'sm' }), 'Not yet in the prototype'));
  }
  if (def.requires.length > 0) {
    panel.append(el('div', { class: 'rows' }, ...def.requires.map((req) =>
      el('div', { class: isTechComplete(state, req) ? 'muted' : 'blocked' },
        `Requires ${TECHNOLOGIES[req].name} ${isTechComplete(state, req) ? '✓' : '✗'}`))));
  }

  if (isTechComplete(state, id)) {
    panel.append(el('div', { class: 'delta' }, 'Researched ✓'));
  } else if (isTechActive(state, id)) {
    const completesAt = techCompletesAt(state, id)!;
    const total = def.durationSeconds * 1000;
    const bar = el('div', { class: 'progress' },
      el('div', { class: 'fill' }),
      el('div', { class: 'label' },
        `${formatDuration(Math.max(0, (completesAt - game.now()) / 1000))} left`));
    (bar.querySelector('.fill') as HTMLElement).style.width =
      `${Math.min(100, Math.max(0, (1 - (completesAt - game.now()) / total) * 100))}%`;
    panel.append(bar);
    // The same offer the Townhall makes, at the same price per second: a
    // player who has learned what a minute costs there does not learn it
    // again here (Docs/features/07-research.md §1).
    const gems = game.techRushGems(id);
    if (gems !== null) {
      panel.append(action({
        label: 'Finish now',
        kind: 'gem',
        onClick: () => game.doFinishTech(id),
        cost: { Gems: gems },
        have: (c) => game.walletValue(c),
      }));
    }
  } else {
    const short = eraShortfall(state, def.tome, def.era);
    // ONE reason for the pair. Both buttons are stopped by the same three
    // things — a requirement, a shut band, a full strip — so saying it twice
    // between two buttons would be a wall of the same sentence. Affordability
    // is not in here: the red number inside each button has already said it
    // (§6.3, §6.4).
    const blocked = !requirementsMet(state, id)
      ? 'Research what it needs first'
      : short > 0
        ? `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'} to read on`
        : busy >= slots
          ? 'Every scholar is busy'
          : undefined;
    if (blocked !== undefined) {
      panel.append(el('div', { class: 'tech-info-blocked' },
        iconEl('padlock', { size: 'sm' }), blocked));
    }

    // Side by side: two ways to have the same thing, and a player choosing
    // between them is comparing two prices. The wait rides INSIDE Start,
    // which is the fact that tells the two apart — `Instant` needs no line
    // under it saying what the word already says.
    const row = el('div', { class: 'tech-info-actions' });
    // INSTANT on the LEFT. The whole wait, bought: both halves of it are time
    // — the Knowledge the drip still owes, and the research itself — so both
    // are priced per second like every other rush.
    const instant = game.techInstantGems(id);
    if (instant !== null) {
      row.append(btn({
        label: 'Instant',
        kind: 'gem',
        onClick: () => game.doBuyTechInstant(id),
        cost: { Gems: instant },
        have: (c) => game.walletValue(c),
        disabledReason: blocked,
      }));
    }
    row.append(btn({
      label: 'Start',
      kind: 'primary',
      onClick: () => game.doStartTech(id),
      cost: def.cost,
      have: (c) => game.walletValue(c),
      disabledReason: blocked,
    }));
    panel.append(row);
    // A trickle currency without a time-to-afford line is one the player
    // cannot plan against (07-research.md §4). Only when Knowledge is
    // the thing short: Gold has its own answer, which is to go and earn it.
    const wait = knowledgeShortfallMs(state, id, knowledgePerHour(state));
    if (wait > 0) {
      panel.append(el('div', { class: 'muted res-wait' },
        iconEl('Knowledge', { size: 'sm' }),
        Number.isFinite(wait)
          ? `Enough Knowledge in about ${formatDuration(wait / 1000)}`
          : 'Claim a landmark or clear a ruin — nothing is dripping yet'));
    }
  }

  const scrim = el('div', { class: 'tech-modal' }, panel);
  // The scrim dismisses; the panel does not, or every press inside it would
  // close the thing being pressed.
  scrim.addEventListener('click', (e) => { if (e.target === scrim) dismiss(); });
  return scrim;
}
