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
//    what is researched or poured into shows as an anonymous "?"; anything deeper
//    is not drawn, and the rows it would have filled collapse.
//  - An era bar the player has not earned says what is left to reveal. The
//    band below it draws, dimmed: the page is legible, and nothing in it is
//    startable until the region is.

import type { Game } from '../game';
import {
  ERA_COUNT, TECHNOLOGIES, TECH_ORDER, TOMES, TOME_ORDER,
} from '../sim/data/definitions';
import {
  canStartTech, eraShortfall, eraUnlocked, isTechComplete, isTechFilled, isTechStarted,
  isTomeOpen, requirementsMet, techCost, techEraUnlocked, techKnowledgeCost,
  techKnowledgeMissing, techPoured, techVisibility,
} from '../sim/research';
import { techLine } from '../sim/techProse';
import { type GameState, type TechId, type TomeId } from '../sim/state';
import {
  colLeft, edgeD, edgePath, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, pageRows, rowTops, ROW_GAP,
} from './research/layout';
import { btn, ctaBadge, iconEl, knob, progress } from './kit';
import { el } from './format';

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
    // Each book wears its own mark on its plate (M4): the scroll, the
    // crossed arms, the orb.
    const mark = id === 'Warfare' ? 'army' : id === 'Magic' ? 'Mana' : 'research';
    const tab = el('button', {
      class: `btn res-tome${id === activeTome ? ' active' : ''}`,
    }, iconEl(mark, { size: 'sm' }), el('span', {}, def.name));
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

  const close = knob('✕', () => game.dismiss(), { label: 'Close Research' });
  close.setAttribute('data-own-close', '');
  const tabs = shelf(game);
  // The books' plates (M4). With them on the beam the title bar says nothing
  // the lit plate does not, so the way out rides the shelf instead.
  if (tabs) { tabs.append(close); root.append(tabs); }
  else root.append(el('div', { class: 'research-topbar' }, el('h2', {}, TOMES[activeTome].name), close));
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
  const page = el('div', { class: 'tech-page', 'data-keep-scroll': 'tech-page' }, flow);
  pageEl = page;
  // Tapping the page beside a card deselects (the info panel hides).
  page.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.tech-card')) return;
    if (selected !== null) { selected = null; game.notify(); }
  });

  // Where the eye should land. A hint wins outright — it is the game asking
  // for attention at a specific node. Otherwise, on a FRESH mount only: the
  // WORK, meaning whatever is poured into or actionable right now, and failing
  // that the last thing finished, which is where the next branch grows from.
  // The scroll across a per-tick re-render is the host's job
  // (data-keep-scroll), and must never be yanked while a finger is on it.
  const hint = game.uiHint();
  const hinted = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  const shown = [...at.keys()] as TechId[];
  const frontier = shown.find((id) => isTechStarted(state, id))
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
    root.append(techInfoModal(game, selected.id));
  }
  return root;
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
    // A SPAN, not a bare '?'. The card overlays a dashed ring and the mark in
    // one grid cell, and `.tech-card.silhouette > *` is what puts them there —
    // a text node gets an anonymous grid item that no selector can reach, so
    // the ring took row 1 and the '?' fell to row 2, stacked under it.
    return el('div', { class: 'tech-card silhouette', style: place },
      el('span', {}, '?'));
  }
  const done = isTechComplete(state, id);
  const started = isTechStarted(state, id);
  const cls = done ? 'done' : started ? 'active' : 'available';
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
  // The kit's orb on everything startable RIGHT NOW. The page shows a lot of cards
  // the player cannot act on yet — done, running, unaffordable, missing a
  // prerequisite, behind a bar — and `available` styling only means the
  // prerequisites are met. The orb is the difference.
  //
  // It hangs on the SEAL, not on the card. The card is a 120px box around a
  // 62px seal, so a badge in its corner sat 16px clear of the thing it marks,
  // reading as a stray mark on the parchment rather than as a badge.
  if (canStartTech(state, id)) {
    node.querySelector('.tech-card-glyph')?.append(ctaBadge(1, `tech:${id}`));
  }
  // How full it is, on a card holding poured Knowledge.
  if (started) {
    const fill = el('div', { class: 'fill' });
    fill.style.width = `${Math.min(100, (techPoured(state, id) / techKnowledgeCost(id)) * 100)}%`;
    node.append(el('div', { class: 'node-bar' }, fill));
  }
  node.addEventListener('click', () => {
    selected = { kind: 'tech', id };
    game.notify();
  });
  return node;
}

/**
 * A technology, opened (M30, upper).
 *
 * A MODAL over the whole book, not a panel resting on the bottom of it: the
 * one surface that says what a card does, what it needs and what it costs.
 * Two ways out, because a modal with one is a trap: the ✕ and the scrim.
 *
 * The verbs follow the price (07-research.md §1, §5.4): **Invest** pours what
 * the bar holds; **Buy the rest** — once in Gold, once in Gems — covers what
 * the bar cannot; **Research** pays the Gold once the Knowledge is in.
 */
function techInfoModal(game: Game, id: TechId): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const dismiss = (): void => { selected = null; game.notify(); };

  const panel = el('div', { class: 'tech-info', 'data-keep-scroll': 'tech-info' });
  // The medallion at the left, the name beside it (M18).
  const head = el('div', { class: 'tech-info-head' },
    el('span', { class: 'tech-info-seal' }, def.glyph),
    el('h3', {}, def.name),
    knob('✕', dismiss, { label: 'Close' }));
  panel.append(head);
  // WHAT IT DOES, in full. The card carries only the glyph and the name, so
  // this is the first place the player reads the sentence.
  panel.append(el('div', { class: 'res-says' }, techLine(id)));
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
  } else {
    const need = techKnowledgeCost(id);
    const poured = techPoured(state, id);
    const missing = techKnowledgeMissing(state, id);
    const held = game.walletValue('Knowledge');

    // THE KNOWLEDGE, poured over need, as a bar you can watch fill.
    if (need > 0) {
      const bar = progress('blue');
      bar.set(poured / need, `${poured} / ${need}`);
      panel.append(el('div', { class: 'res-poured' },
        iconEl('Knowledge', { size: 'sm' }), bar.root));
      if (missing > 0) {
        panel.append(el('div', { class: 'muted res-wait' },
          held >= missing ? `${missing} more — your bar covers it`
            : held > 0 ? `${missing} more, ${held} in your bar` : `${missing} more`));
      }
    }

    const short = eraShortfall(state, def.tome, def.era);
    // ONE reason for the whole row, whichever is true. Affordability is never
    // in it — the red number inside each button has already said that.
    const blocked = !requirementsMet(state, id)
      ? 'Research what it needs first'
      : short > 0
        ? `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'} to read on`
        : undefined;
    if (blocked !== undefined) {
      panel.append(el('div', { class: 'tech-info-blocked' },
        iconEl('padlock', { size: 'sm' }), blocked));
    }

    if (!isTechFilled(state, id)) {
      const row = el('div', { class: 'tech-info-actions' });
      row.append(btn({
        label: 'Invest',
        kind: 'primary',
        onClick: () => game.doPourTech(id),
        cost: { Knowledge: Math.min(missing, held) },
        disabledReason: blocked ?? (held <= 0 ? 'Your bar is empty' : undefined),
      }));
      panel.append(row);
      // What the bar cannot cover, at both tills — two buttons, because one
      // press can only spend one currency.
      const rest = game.techBuyRest(id);
      if (rest.points > 0) {
        panel.append(el('div', { class: 'res-buy-label' }, `Buy the other ${rest.points}`));
        const buy = el('div', { class: 'tech-info-actions' });
        buy.append(btn({
          label: 'Gold',
          kind: 'secondary',
          onClick: () => game.doBuyRestAndPour(id, 'Gold'),
          cost: { Gold: rest.gold },
          have: (c) => game.walletValue(c),
          disabledReason: blocked,
        }));
        buy.append(btn({
          label: 'Gems',
          kind: 'gem',
          onClick: () => game.doBuyRestAndPour(id, 'Gems'),
          cost: { Gems: rest.gems },
          have: (c) => game.walletValue(c),
          disabledReason: blocked,
        }));
        panel.append(buy);
      }
    }

    panel.append(btn({
      label: 'Research',
      kind: isTechFilled(state, id) ? 'primary' : 'secondary',
      onClick: () => game.doResearchTech(id),
      cost: { Gold: techCost(id) },
      have: (c) => game.walletValue(c),
      disabledReason: blocked
        ?? (isTechFilled(state, id) ? undefined : 'Fill it with Knowledge first'),
    }));
  }

  const scrim = el('div', { class: 'tech-modal' }, panel);
  // The scrim dismisses; the panel does not, or every press inside it would
  // close the thing being pressed.
  scrim.addEventListener('click', (e) => { if (e.target === scrim) dismiss(); });
  return scrim;
}
