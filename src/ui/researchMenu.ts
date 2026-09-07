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
  DISTRICTS, MAX_ERA, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, TOMES, TOME_ORDER, UNITS,
} from '../sim/data/definitions';
import {
  canStartTech, eraShortfall, eraUnlocked, isTechActive, isTechComplete, isTomeOpen,
  knowledgeShortfallMs, requirementsMet, slotGemCost, techCompletesAt, techEraUnlocked,
  techSlots, techUnlocks,
} from '../sim/research';
import { knowledgePerHour } from '../sim/mana';
import { resourceDiscoveryKey } from '../sim/discovery';
import { unlockLabel } from '../sim/data/techTreeRules';
import { effectLabel } from '../sim/data/techEffectRules';
import { type GameState, type TechId, type TomeId } from '../sim/state';
import {
  colLeft, edgeD, edgePath, GATE_BAR_H, NODE_H, NODE_W, PAGE_W, pageRows, rowTops, ROW_GAP,
} from './research/layout';
import { spriteUrl } from '../render/sprites';
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

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

// Tree fog. normal = researched / researching / requirements met;
// silhouette = one step beyond what's actually researched or researching
// (every prerequisite complete or active — a merely-available tech does NOT
// reveal its children); hidden = everything else.
type Visibility = 'normal' | 'silhouette' | 'hidden';
function visibility(state: GameState, id: TechId): Visibility {
  if (
    isTechComplete(state, id) || isTechActive(state, id) || requirementsMet(state, id)
  ) return 'normal';
  const started = (t: TechId) => isTechComplete(state, t) || isTechActive(state, t);
  if (TECHNOLOGIES[id].requires.every(started)) return 'silhouette';
  return 'hidden';
}

/**
 * The one line under a card's name: what the technology is FOR.
 *
 * An `unlock` says it itself — `unlocks` is authored on the technology
 * (`?dev=tree`), so this reads it rather than deriving it back out of the
 * gates, and it covers the things a gate list cannot: a harvest source, a
 * terrain, one more of a building.
 *
 * A `bonus` uses its PROSE, not its `effects`, even though the effects are
 * right there and machine-readable. The registry's blurbs are written in the
 * units a value is authored in — "seconds of work one tap is worth" — so
 * generating from them gives "+20% seconds of work one tap is worth" where a
 * designer wrote "Every tap is worth a fifth more work". The generated line is
 * the FALLBACK, for a card whose prose has not been written yet: better than
 * an empty card, and visibly not the finished copy.
 */
function effectLine(id: TechId): string {
  const def = TECHNOLOGIES[id];
  if (def.kind === 'unlock' && def.unlocks.length > 0) {
    return `Unlocks ${def.unlocks.map(unlockLabel).join(', ')}`;
  }
  if (def.description.trim() === '' && def.effects.length > 0) {
    return def.effects.map(effectLabel).join(', ');
  }
  return def.description;
}

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
    && (visibility(state, selected.id) !== 'normal'
      || TECHNOLOGIES[selected.id].tome !== activeTome)) selected = null;

  const busy = state.research.active.length;
  const slots = techSlots(state);

  // Scholars at lecterns, not "Slots: 1 busy / 2". A concurrency limit is an
  // abstraction; people at desks is something the player can picture.
  const desks = el('div', { class: 'res-desks' });
  for (let i = 0; i < slots; i++) {
    desks.append(el('span', { class: `res-desk${i < busy ? ' is-busy' : ''}` },
      iconEl(i < busy ? 'research' : 'clock', { size: 'sm' })));
  }
  const bar = el('div', { class: 'res-scholars' },
    desks,
    el('span', { class: 'res-desk-label' }, busy === 0
      ? `${slots} ${slots === 1 ? 'scholar' : 'scholars'} idle`
      : `${busy} of ${slots} at work`));
  if (slots < RESEARCH_SETTINGS.maxSlots) {
    const cost = slotGemCost(state);
    bar.append(btn({
      label: 'Hire',
      kind: 'gem',
      onClick: () => game.doBuySlot(),
      // The price used to be spliced into the label, where it read as part of
      // the verb rather than as something you pay.
      cost: { Gems: cost },
      have: (c) => game.walletValue(c),
    }));
  }
  const close = knob('✕', () => game.dismiss(), { label: 'Close Research' });
  close.setAttribute('data-own-close', '');
  // The clock, where it is spent. Knowledge has no coin on the plank — it is
  // paid in exactly one screen, so it reads in that screen's header, with its
  // RATE beside the balance because a drip you cannot see the speed of is a
  // drip you cannot plan against. Hidden until the player has met it: a zero
  // row would advertise a currency the tutorial has not yet introduced.
  const held = game.walletValue('Knowledge');
  const rate = knowledgePerHour(state);
  if (held > 0 || rate > 0 || state.discoveries[resourceDiscoveryKey('Knowledge')] === true) {
    bar.append(el('span', { class: 'res-clock' },
      iconEl('Knowledge', { size: 'sm' }),
      el('b', {}, String(held)),
      el('span', { class: 'res-clock-rate' }, rate > 0 ? `+${rate}/h` : 'no drip')));
  }
  const tabs = shelf(game);
  root.append(el('div', { class: 'research-topbar' },
    el('h2', {}, TOMES[activeTome].name), bar, close));
  if (tabs) root.append(tabs);
  root.append(el('p', { class: 'res-blurb' }, TOMES[activeTome].blurb));

  // ---- the page (as long as what the fog currently shows) ----
  const rows = pageRows(TECHNOLOGIES, activeTome,
    (id) => visibility(state, id as TechId) !== 'hidden');
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
      // A requirement in an EARLIER BAND is implied by the bar between them
      // (techTreeRules.isDrawnEdge): 119 lines across three gates would hide
      // every edge that says something.
      if (from === undefined || TECHNOLOGIES[req].era !== def.era) continue;
      drew = true;
      stroke(edgeD(edgePath(from, to, columnClear(from, to))),
        visibility(state, id as TechId) === 'silhouette' ? 'tech-edge dim'
          : isTechComplete(state, req) ? 'tech-edge open' : 'tech-edge');
    }
    // Nothing drawn, but something above the bar is required: a stub in the
    // gutter above the card, so none looks like it grows from nowhere. Half a
    // gutter long, and pointing at the card — not a path from anywhere, which
    // is the honest drawing of a requirement the page does not show.
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

  // ---- floating bottom info panel, only while something is selected ----
  if (selected?.kind === 'tech') {
    root.append(techInfoPanel(game, selected.id, busy, slots));
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
  const sealed = era >= MAX_ERA;
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
  if (visibility(state, id) === 'silhouette') {
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
  el('span', { class: 'tech-card-name' }, def.name),
  el('span', { class: 'tech-card-effect' }, effectLine(id)));
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

function techInfoPanel(game: Game, id: TechId, busy: number, slots: number): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const panel = el('div', { class: 'tech-info' });
  panel.append(el('h3', {}, `${def.glyph} ${def.name}`));
  panel.append(el('div', { class: 'muted' }, def.description));
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

  // The single most valuable missing piece of information in the old UI: a
  // player could not tell what a technology was FOR until it finished and a
  // banner announced it. techUnlocks() has always known.
  const unlocks = techUnlocks(id);
  if (unlocks.length > 0) {
    const row = el('div', { class: 'res-unlocks' },
      el('span', { class: 'res-unlocks-label' }, 'Unlocks'));
    for (const u of unlocks) {
      if (u.kind === 'district') {
        const url = spriteUrl(`${DISTRICTS[u.id].sprite}_l1`);
        row.append(el('span', { class: 'res-unlock' },
          url ? el('img', { src: url, alt: '' }) : iconEl(u.id, { size: 'sm' }),
          DISTRICTS[u.id].name));
      } else if (u.kind === 'districtLevel') {
        row.append(el('span', { class: 'res-unlock' },
          iconEl('star', { size: 'sm' }), `${DISTRICTS[u.id].name} lv${u.level}`));
      } else if (u.kind === 'unit') {
        row.append(el('span', { class: 'res-unlock' },
          iconEl(u.id, { size: 'sm' }), UNITS[u.id].name));
      }
    }
    panel.append(row);
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
  } else {
    const short = eraShortfall(state, def.tome, def.era);
    panel.append(action({
      label: 'Start',
      kind: 'primary',
      onClick: () => game.doStartTech(id),
      cost: def.cost,
      have: (c) => game.walletValue(c),
      disabledReason: !requirementsMet(state, id)
        ? 'Research what it needs first'
        : short > 0
          ? `Reveal ${short} more ${short === 1 ? 'cell' : 'cells'} to read on`
          : busy >= slots
            ? 'Every scholar is busy'
            : undefined,
      info: el('span', { class: 'res-time' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(def.durationSeconds)),
    }));
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
  return panel;
}
