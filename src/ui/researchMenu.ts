// Research overlay: ONE unified tree.
//  - Technologies: square icon nodes on a hand-authored grid, dotted
//    orthogonal connectors; researching takes time in a concurrent slot
//    (extra slots bought with Gems at an escalating price).
//  - Minor RANKS: smaller square nodes fanned below the technology their
//    line hangs under. They are technologies like any other — Gold and time,
//    in a slot — and the fan appears when the parent completes, which is the
//    visible reward of the research. (The fan is a stopgap layout; see
//    research/layout.ts FAN_DY.)
//  - Tree fog: researched/available techs render normally; techs one step
//    beyond a RESEARCHED or RESEARCHING tech show as anonymous "?"
//    silhouettes; anything deeper is hidden.

import type { Game } from '../game';
import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_LINES, TECH_LINE_ORDER, TECH_ORDER,
  TOMES, TOME_ORDER, UNITS, lineParent,
} from '../sim/data/definitions';
import {
  canStartTech, isTechActive, isTechComplete, isTomeOpen, knowledgeShortfallMs, requirementsMet,
  slotGemCost,
  techCompletesAt, techSlots, techUnlocks,
} from '../sim/research';
import { knowledgePerHour } from '../sim/mana';
import { resourceDiscoveryKey } from '../sim/discovery';
import { lineMaxRank, lineRank } from '../sim/upgrades';
import { type GameState, type TechId, type TechLineId, type TomeId } from '../sim/state';
import { edgePath, FAN_DX, FAN_DY, GRID, NODE, UNODE } from './research/layout';
import { spriteUrl } from '../render/sprites';
import { action, btn, iconEl, knob } from './kit';
import { el, formatDuration } from './format';

/** Which book is open on the lectern. Module-level so it survives the
 *  per-tick re-render, like the selection below. */
let activeTome: TomeId = 'Civics';

// Module-level so selection/pan survive the per-tick re-render.
type Selected = { kind: 'tech'; id: TechId } | null;
let selected: Selected = null;

// Geometry (GRID, NODE, UNODE, FAN_*) and the connector route come from
// ./research/layout.ts, so the test reads the same route this draws.

// ---- drag panning ----------------------------------------------------------
// Pointer listeners live on window and act on the CURRENT tree element, so an
// in-flight drag survives the per-tick re-render that replaces the DOM.
let treeEl: HTMLElement | null = null;
let drag: {
  id: number; x: number; y: number; startX: number; startY: number; moved: boolean;
} | null = null;
let suppressClick = false; // a pan gesture must not select/deselect on release
let panWired = false;

// ---- first-open framing ----------------------------------------------------
// The canvas is 1160x1040 inside a ~400x520 window, so where it starts
// matters, and it started at (0, 0) — the top-left CORNER of the authored
// grid, which is empty parchment. The screen opened on nothing, every time,
// and the player had to drag to find their own tree.
//
// Only on a FRESH MOUNT: the per-second rebuild must never yank the view back
// while a finger is on it, and the host already restores the pan across those
// (data-keep-scroll). The two are told apart by whether the PREVIOUS tree
// element is still in the document when this render runs — on a refresh the
// old subtree is still mounted and is replaced afterwards; on a fresh mount
// the slot has already torn it down.
const isFreshMount = (): boolean => treeEl === null || !treeEl.isConnected;

const consumeSuppressedClick = (): boolean => {
  const s = suppressClick;
  suppressClick = false;
  return s;
};

function wirePanOnce(): void {
  if (panWired) return;
  panWired = true;
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !treeEl) return;
    drag.moved = drag.moved
      || Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 6;
    treeEl.scrollLeft -= e.clientX - drag.x;
    treeEl.scrollTop -= e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const end = () => {
    if (drag?.moved) suppressClick = true;
    drag = null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

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

/** The LINES fanned under a major — one bead each, not one per rank.
 *
 *  Fanning every rank was tried and is unusable: Forestry alone carries three
 *  lines worth 13 ranks, which spilled across two neighbouring branches and
 *  drew five identical nodes of which exactly one was ever pressable. A line
 *  is one thing to the player — a ladder they are part-way up — so it gets
 *  one node showing how far up it they are. */
const linesUnder = (id: TechId): TechLineId[] =>
  TECH_LINE_ORDER.filter((line) => lineParent(line) === id);

/** The rank a line's bead currently stands for: the next one to research, or
 *  the last one if the ladder is finished. */
const beadRank = (state: GameState, line: TechLineId): TechId => {
  const ranks = TECH_LINES[line];
  return ranks[Math.min(lineRank(state, line), ranks.length - 1)];
};

/** A major technology has an authored grid position; a rank does not. */
const isMajor = (id: TechId): boolean => TECHNOLOGIES[id].node !== null;

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
    const hire = btn({
      label: 'Hire',
      kind: 'gem',
      onClick: () => game.doBuySlot(),
      // The price used to be spliced into the label, where it read as part of
      // the verb rather than as something you pay.
      cost: { Gems: cost },
      have: (c) => game.walletValue(c),
    });
    bar.append(hire);
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

  // ---- the tree canvas (sized to what the fog currently shows) ----
  const shown = TECH_ORDER.filter(
    (id) => isMajor(id) && TECHNOLOGIES[id].tome === activeTome
      && visibility(state, id) !== 'hidden');
  const fanned = shown.filter((id) => isTechComplete(state, id) && linesUnder(id).length > 0);
  const xs = shown.map((id) => TECHNOLOGIES[id].node!.x);
  const ys = shown.map((id) => TECHNOLOGIES[id].node!.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const yMax = Math.max(...ys);
  const pad = 40;
  const width = (Math.max(...xs) - x0 + 1) * GRID + pad * 2;
  let height = (yMax - y0 + 1) * GRID + pad * 2;
  // A fan below a bottom-row tech pokes past the grid — give it room.
  if (fanned.some((id) => TECHNOLOGIES[id].node!.y === yMax)) {
    height += FAN_DY + UNODE / 2 - GRID / 2 + 6;
  }
  const px = (gx: number) => pad + (gx - x0) * GRID + GRID / 2;
  const py = (gy: number) => pad + (gy - y0) * GRID + GRID / 2;
  const cx = (id: TechId) => px(TECHNOLOGIES[id].node!.x);
  const cy = (id: TechId) => py(TECHNOLOGIES[id].node!.y);
  const fanX = (id: TechId, i: number, n: number) => cx(id) + (i - (n - 1) / 2) * FAN_DX;
  const fanY = (id: TechId) => cy(id) + FAN_DY;

  const canvas = el('div', { class: 'tech-canvas', style: `width:${width}px;height:${height}px` });

  // Dotted connectors (H then V), under the nodes.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.classList.add('tech-edges');
  for (const id of shown) {
    for (const req of TECHNOLOGIES[id].requires) {
      // A rank's requirement is its previous rank, which lives in the fan and
      // has no grid position — the fan draws its own spokes below.
      if (!isMajor(req)) continue;
      const path = document.createElementNS(ns, 'path');
      const route = edgePath(TECHNOLOGIES[req].node!, TECHNOLOGIES[id].node!)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.y)}`)
        .join(' ');
      path.setAttribute('d', route);
      path.setAttribute('class',
        visibility(state, id) === 'silhouette' ? 'tech-edge dim'
          : isTechComplete(state, req) ? 'tech-edge open' : 'tech-edge');
      svg.append(path);
    }
  }
  // Straight spokes from a completed tech to the lines fanned under it.
  for (const id of fanned) {
    const ups = linesUnder(id);
    ups.forEach((_: TechLineId, i: number) => {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M ${cx(id)} ${cy(id)} L ${fanX(id, i, ups.length)} ${fanY(id)}`);
      path.setAttribute('class', 'tech-edge open');
      svg.append(path);
    });
  }
  canvas.append(svg);

  // Tech nodes (squares) — silhouettes are inert "?" placeholders.
  for (const id of shown) {
    if (visibility(state, id) === 'silhouette') {
      canvas.append(el('div', {
        class: 'tech-node silhouette',
        style: `left:${cx(id) - NODE / 2}px;top:${cy(id) - NODE / 2}px`,
      }, '?'));
      continue;
    }
    const done = isTechComplete(state, id);
    const active = isTechActive(state, id);
    const cls = done ? 'done' : active ? 'active' : 'available';
    const isSel = selected?.kind === 'tech' && selected.id === id;
    const hinted = game.uiHint() === `tech:${id}`;
    const node = el('button', {
      class: `btn tech-node ${cls}${isSel ? ' selected' : ''}${hinted ? ' hinted' : ''}`
        + (TECHNOLOGIES[id].planned ? ' planned' : ''),
      style: `left:${cx(id) - NODE / 2}px;top:${cy(id) - NODE / 2}px`,
    }, TECHNOLOGIES[id].glyph);
    // A dot on everything startable RIGHT NOW. The tree shows a lot of nodes
    // the player cannot act on yet — done, running, unaffordable, missing a
    // prerequisite — and "available" styling only means the prerequisites are
    // met, not that you can press it. The dot is the difference.
    if (canStartTech(state, id)) node.append(el('span', { class: 'node-dot' }));
    if (active) {
      const completesAt = techCompletesAt(state, id)!;
      const total = TECHNOLOGIES[id].durationSeconds * 1000;
      const fill = el('div', { class: 'fill' });
      fill.style.width = `${Math.min(100, Math.max(0, (1 - (completesAt - game.now()) / total) * 100))}%`;
      node.append(el('div', { class: 'node-bar' }, fill));
    }
    node.addEventListener('click', () => {
      if (consumeSuppressedClick()) return;
      selected = { kind: 'tech', id };
      game.notify();
    });
    canvas.append(node);
  }

  // One bead per LINE, fanned below its completed parent. The bead stands for
  // the next rank to research, so clicking it selects a real technology and
  // the info panel is the ordinary one.
  for (const id of fanned) {
    const ups = linesUnder(id);
    ups.forEach((line: TechLineId, i: number) => {
      const u = beadRank(state, line);
      const rank = lineRank(state, line);
      const maxed = rank >= lineMaxRank(line);
      const cls = maxed ? 'done' : isTechActive(state, u) ? 'active'
        : canStartTech(state, u) ? 'available' : 'locked';
      const isSel = selected?.kind === 'tech' && selected.id === u;
      const hinted = TECH_LINES[line].some((r) => game.uiHint() === `tech:${r}`);
      const node = el('button', {
        class: `btn tech-node rank ${cls}${isSel ? ' selected' : ''}${hinted ? ' hinted' : ''}`,
        style: `left:${fanX(id, i, ups.length) - UNODE / 2}px;top:${fanY(id) - UNODE / 2}px`,
      }, TECHNOLOGIES[u].glyph);
      if (canStartTech(state, u)) node.append(el('span', { class: 'node-dot' }));
      node.append(el('span', { class: 'lvl' }, `${rank}/${lineMaxRank(line)}`));
      node.addEventListener('click', () => {
        if (consumeSuppressedClick()) return;
        selected = { kind: 'tech', id: u };
        game.notify();
      });
      canvas.append(node);
    });
  }

  // Captured BEFORE treeEl is reassigned below — the old element is the
  // evidence, and overwriting it first would make every render look fresh.
  const fresh = isFreshMount();
  const tree = el('div', { class: 'tech-tree', 'data-keep-scroll': '' }, canvas);
  treeEl = tree;
  wirePanOnce();
  tree.addEventListener('pointerdown', (e) => {
    suppressClick = false; // a stale suppression must not eat this tap
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY, moved: false,
    };
    // Touch implicitly captures the pointer to its target; release it so the
    // gesture keeps hit-testing (and reaching window) after the per-tick
    // re-render swaps the element out from under the finger.
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch { /* no active capture — nothing to release */ }
  });
  // Tapping empty tree space deselects (the info panel hides).
  tree.addEventListener('click', (e) => {
    if (consumeSuppressedClick()) return;
    if ((e.target as HTMLElement).closest('.tech-node')) return;
    if (selected !== null) {
      selected = null;
      game.notify();
    }
  });
  // The pan across the per-tick re-render is the host's job now
  // (data-keep-scroll above), which retires the module-level treeScroll and
  // its rAF restore. Only the hint still needs to move the view, and it must
  // run after the host has put the old position back.
  const hint = game.uiHint();
  // A rank hangs in the fan below the major its line sits under, which has
  // no grid position of its own — so a hint at a rank scrolls to that PARENT
  // and brings the rank on screen with it. One code path for both.
  const hinted = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  const hintedTech = hinted === null ? null
    : isMajor(hinted) ? hinted : lineParent(TECHNOLOGIES[hinted].line!);
  // Where the eye should land. A hint wins outright — it is the game asking
  // for attention at a specific node. Otherwise: the WORK, meaning whatever
  // is running or startable right now, and failing that the last thing
  // finished, which is where the next branch grows from.
  const frontier = shown.find((id) => isTechActive(state, id))
    ?? shown.find((id) => !isTechComplete(state, id) && requirementsMet(state, id))
    ?? [...shown].reverse().find((id) => isTechComplete(state, id))
    ?? null;
  const focus = hintedTech && visibility(state, hintedTech) !== 'hidden' ? hintedTech
    : fresh ? frontier
      : null;
  if (focus !== null) {
    requestAnimationFrame(() => {
      tree.scrollLeft = Math.max(0, cx(focus) - tree.clientWidth / 2);
      tree.scrollTop = Math.max(0, cy(focus) - tree.clientHeight / 2);
    });
  }
  root.append(tree);

  // ---- floating bottom info panel, only while something is selected ----
  if (selected?.kind === 'tech') {
    root.append(techInfoPanel(game, selected.id, busy, slots));
  }
  return root;
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
    panel.append(action({
      label: 'Start',
      kind: 'primary',
      onClick: () => game.doStartTech(id),
      cost: def.cost,
      have: (c) => game.walletValue(c),
      disabledReason: !requirementsMet(state, id)
        ? 'Research what it needs first'
        : busy >= slots
          ? 'Every scholar is busy'
          : undefined,
      info: el('span', { class: 'res-time' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(def.durationSeconds)),
    }));
    // A trickle currency without a time-to-afford line is one the player
    // cannot plan against (tomes-and-research.md §8). Only when Knowledge is
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

