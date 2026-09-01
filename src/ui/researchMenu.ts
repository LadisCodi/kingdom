// Research overlay: ONE unified tree.
//  - Technologies: square icon nodes on a hand-authored grid, dotted
//    orthogonal connectors; researching takes time in a concurrent slot
//    (extra slots bought with Gems at an escalating price).
//  - Upgrades: small CIRCLE nodes fanned below their parent technology —
//    instant gold purchases, leveled. The fan appears when the parent
//    completes: the visible reward of the research.
//  - Tree fog: researched/available techs render normally; techs one step
//    beyond a RESEARCHED or RESEARCHING tech show as anonymous "?"
//    silhouettes; anything deeper is hidden.

import { icon, type Game } from '../game';
import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, UNITS, UPGRADES, UPGRADE_ORDER,
} from '../sim/data/definitions';
import { canAfford } from '../sim/commands';
import {
  isTechActive, isTechComplete, requirementsMet, slotGemCost,
  techCompletesAt, techSlots, techUnlocks,
} from '../sim/research';
import { upgradeCost, upgradeLevel } from '../sim/upgrades';
import { getWallet, type GameState, type TechId, type UpgradeId } from '../sim/state';
import { edgePath, FAN_DX, FAN_DY, GRID, NODE, UNODE } from './research/layout';
import { spriteUrl } from '../render/sprites';
import { btn, iconEl, knob } from './kit';
import { button, el, formatCost, formatDuration } from './format';

// Module-level so selection/pan survive the per-tick re-render.
type Selected = { kind: 'tech'; id: TechId } | { kind: 'upgrade'; id: UpgradeId } | null;
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

const upgradesOf = (id: TechId): UpgradeId[] =>
  UPGRADE_ORDER.filter((u) => UPGRADES[u].requiredTech === id);

export function renderResearchMenu(game: Game): HTMLElement {
  const state = game.state;
  const root = el('div', { class: 'research-screen' });

  // Drop a selection the fog no longer shows (e.g. after a fresh load).
  if (selected?.kind === 'tech' && visibility(state, selected.id) !== 'normal') selected = null;
  if (selected?.kind === 'upgrade') {
    const parent = UPGRADES[selected.id].requiredTech;
    if (parent !== null && !isTechComplete(state, parent)) selected = null;
  }

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
      label: `Hire · ${cost}`,
      kind: 'gem',
      icon: 'Gems',
      onClick: () => game.doBuySlot(),
      disabledReason: getWallet(state.player.wallet, 'Gems') < cost
        ? `Needs ${cost} Gems` : undefined,
    });
    bar.append(hire);
  }
  const close = knob('✕', () => game.dismiss(), { label: 'Close Research' });
  close.setAttribute('data-own-close', '');
  root.append(el('div', { class: 'research-topbar' },
    el('h2', {}, 'Research'), bar, close));

  // ---- the tree canvas (sized to what the fog currently shows) ----
  const shown = TECH_ORDER.filter((id) => visibility(state, id) !== 'hidden');
  const fanned = shown.filter((id) => isTechComplete(state, id) && upgradesOf(id).length > 0);
  const xs = shown.map((id) => TECHNOLOGIES[id].node.x);
  const ys = shown.map((id) => TECHNOLOGIES[id].node.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const yMax = Math.max(...ys);
  const pad = 40;
  const width = (Math.max(...xs) - x0 + 1) * GRID + pad * 2;
  let height = (yMax - y0 + 1) * GRID + pad * 2;
  // A fan below a bottom-row tech pokes past the grid — give it room.
  if (fanned.some((id) => TECHNOLOGIES[id].node.y === yMax)) {
    height += FAN_DY + UNODE / 2 - GRID / 2 + 6;
  }
  const px = (gx: number) => pad + (gx - x0) * GRID + GRID / 2;
  const py = (gy: number) => pad + (gy - y0) * GRID + GRID / 2;
  const cx = (id: TechId) => px(TECHNOLOGIES[id].node.x);
  const cy = (id: TechId) => py(TECHNOLOGIES[id].node.y);
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
      const path = document.createElementNS(ns, 'path');
      const route = edgePath(TECHNOLOGIES[req].node, TECHNOLOGIES[id].node)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.y)}`)
        .join(' ');
      path.setAttribute('d', route);
      path.setAttribute('class',
        visibility(state, id) === 'silhouette' ? 'tech-edge dim'
          : isTechComplete(state, req) ? 'tech-edge open' : 'tech-edge');
      svg.append(path);
    }
  }
  // Straight spokes from a completed tech to its upgrade circles.
  for (const id of fanned) {
    const ups = upgradesOf(id);
    ups.forEach((_, i) => {
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
      class: `btn tech-node ${cls}${isSel ? ' selected' : ''}${hinted ? ' hinted' : ''}`,
      style: `left:${cx(id) - NODE / 2}px;top:${cy(id) - NODE / 2}px`,
    }, TECHNOLOGIES[id].glyph);
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

  // Upgrade nodes (circles), fanned below their completed parent.
  for (const id of fanned) {
    const ups = upgradesOf(id);
    ups.forEach((u, i) => {
      const def = UPGRADES[u];
      const level = upgradeLevel(state, u);
      const maxed = level >= def.maxLevel;
      const affordable = canAfford(state.city.wallet, { Gold: upgradeCost(u, level) });
      const cls = maxed ? 'done' : affordable ? 'available' : 'locked';
      const isSel = selected?.kind === 'upgrade' && selected.id === u;
      const node = el('button', {
        class: `btn tech-node upgrade ${cls}${isSel ? ' selected' : ''}`,
        style: `left:${fanX(id, i, ups.length) - UNODE / 2}px;top:${fanY(id) - UNODE / 2}px`,
      }, def.glyph);
      if (level > 0) node.append(el('span', { class: 'lvl' }, String(level)));
      node.addEventListener('click', () => {
        if (consumeSuppressedClick()) return;
        selected = { kind: 'upgrade', id: u };
        game.notify();
      });
      canvas.append(node);
    });
  }

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
  const hintedTech = hint?.startsWith('tech:')
    ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
  if (hintedTech && visibility(state, hintedTech) !== 'hidden') {
    requestAnimationFrame(() => {
      tree.scrollLeft = Math.max(0, cx(hintedTech) - tree.clientWidth / 2);
      tree.scrollTop = Math.max(0, cy(hintedTech) - tree.clientHeight / 2);
    });
  }
  root.append(tree);

  // ---- floating bottom info panel, only while something is selected ----
  if (selected?.kind === 'tech') {
    root.append(techInfoPanel(game, selected.id, busy, slots));
  } else if (selected?.kind === 'upgrade') {
    root.append(upgradeInfoPanel(game, selected.id));
  }
  return root;
}

function techInfoPanel(game: Game, id: TechId, busy: number, slots: number): HTMLElement {
  const state = game.state;
  const def = TECHNOLOGIES[id];
  const panel = el('div', { class: 'tech-info' });
  panel.append(el('h3', {}, `${def.glyph} ${def.name}`));
  panel.append(el('div', { class: 'muted' }, def.description));
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
      } else {
        row.append(el('span', { class: 'res-unlock' },
          iconEl('sparkle', { size: 'sm' }), UPGRADES[u.id].name));
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
    const affordable = canAfford(state.city.wallet, def.cost);
    const startBtn = button('Start', () => game.doStartTech(id));
    startBtn.disabled = !affordable || !requirementsMet(state, id) || busy >= slots;
    panel.append(el('div', { class: 'action-row' },
      el('span', { class: `info${affordable ? '' : ' blocked'}` },
        `${formatCost(def.cost)} · ⏱ ${formatDuration(def.durationSeconds)}` +
        (busy >= slots ? ' — all slots busy' : '')),
      startBtn));
  }
  return panel;
}

function upgradeInfoPanel(game: Game, id: UpgradeId): HTMLElement {
  const state = game.state;
  const def = UPGRADES[id];
  const level = upgradeLevel(state, id);
  const maxed = level >= def.maxLevel;
  const panel = el('div', { class: 'tech-info' });
  panel.append(el('h3', {}, `${def.glyph} ${def.name} — Lv ${level}/${def.maxLevel}`));
  panel.append(el('div', { class: 'muted' }, def.description));

  const pips = el('div', { class: 'pips' });
  for (let i = 0; i < def.maxLevel; i++) {
    pips.append(el('span', { class: `pip${i < level ? ' on' : ''}` }));
  }
  panel.append(pips);

  if (maxed) {
    panel.append(el('div', { class: 'delta' }, 'Maxed'));
  } else {
    const cost = upgradeCost(id, level);
    const affordable = canAfford(state.city.wallet, { Gold: cost });
    const buyBtn = button('Upgrade', () => game.doBuyUpgrade(id));
    buyBtn.disabled = !affordable;
    panel.append(el('div', { class: 'action-row' },
      el('span', { class: `info${affordable ? '' : ' blocked'}` },
        `${cost} ${icon('Gold')} · instant`),
      buyBtn));
  }
  return panel;
}
