// Research overlay: ONE unified tree.
//  - Technologies: square icon nodes on a hand-authored grid, dotted
//    orthogonal connectors; researching takes time in a concurrent slot
//    (extra slots bought with Gems at an escalating price).
//  - Upgrades: small CIRCLE nodes fanned below their parent technology —
//    instant gold purchases, leveled. The fan appears when the parent
//    completes: the visible reward of the research.
//  - Tree fog: researched/available techs render normally; techs one step
//    beyond show as anonymous "?" silhouettes; anything deeper is hidden.

import { icon, type Game } from '../game';
import {
  RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, UPGRADES, UPGRADE_ORDER,
} from '../sim/data/definitions';
import { canAfford } from '../sim/commands';
import {
  isTechActive, isTechComplete, requirementsMet, slotGemCost,
  techCompletesAt, techSlots,
} from '../sim/research';
import { upgradeCost, upgradeLevel } from '../sim/upgrades';
import { getWallet, type GameState, type TechId, type UpgradeId } from '../sim/state';
import { button, el, formatCost, formatDuration } from './format';

// Module-level so selection/pan survive the per-tick re-render.
type Selected = { kind: 'tech'; id: TechId } | { kind: 'upgrade'; id: UpgradeId } | null;
let selected: Selected = null;
let treeScroll = { left: 0, top: 0 };

const GRID = 90; // px per tree-grid step
const NODE = 56; // tech node square size
const UNODE = 36; // upgrade circle size
const FAN_DY = 0.7 * GRID; // fan distance below the parent tech
const FAN_DX = 44; // spacing between fanned circles

// Tree fog. normal = researched / researching / requirements met;
// silhouette = one step ahead (every prerequisite is itself normal);
// hidden = anything deeper.
type Visibility = 'normal' | 'silhouette' | 'hidden';
function visibility(state: GameState, id: TechId): Visibility {
  const normal = (t: TechId) =>
    isTechComplete(state, t) || isTechActive(state, t) || requirementsMet(state, t);
  if (normal(id)) return 'normal';
  if (TECHNOLOGIES[id].requires.every(normal)) return 'silhouette';
  return 'hidden';
}

const upgradesOf = (id: TechId): UpgradeId[] =>
  UPGRADE_ORDER.filter((u) => UPGRADES[u].requiredTech === id);

export function renderResearchMenu(game: Game): HTMLElement {
  const state = game.state;
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Research'));

  // Drop a selection the fog no longer shows (e.g. after a fresh load).
  if (selected?.kind === 'tech' && visibility(state, selected.id) !== 'normal') selected = null;
  if (selected?.kind === 'upgrade') {
    const parent = UPGRADES[selected.id].requiredTech;
    if (parent !== null && !isTechComplete(state, parent)) selected = null;
  }

  const busy = state.research.active.length;
  const slots = techSlots(state);

  // Slots line + gem purchase for the next one.
  const slotsRow = el('div', { class: 'action-row' },
    el('span', { class: 'info' }, `Research slots: ${busy} busy / ${slots}`));
  if (slots < RESEARCH_SETTINGS.maxSlots) {
    const cost = slotGemCost(state);
    const buyBtn = button('Buy', () => game.doBuySlot());
    buyBtn.disabled = getWallet(state.player.wallet, 'Gems') < cost;
    slotsRow.append(el('span', { class: 'muted' }, `extra slot — ${cost} ${icon('Gems')}`), buyBtn);
  }
  menu.append(slotsRow);

  // ---- the tree canvas (sized to what the fog currently shows) ----
  const shown = TECH_ORDER.filter((id) => visibility(state, id) !== 'hidden');
  const fanned = shown.filter((id) => isTechComplete(state, id) && upgradesOf(id).length > 0);
  const xs = shown.map((id) => TECHNOLOGIES[id].node.x);
  const ys = shown.map((id) => TECHNOLOGIES[id].node.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const yMax = Math.max(...ys);
  const pad = 24;
  const width = (Math.max(...xs) - x0 + 1) * GRID + pad * 2;
  let height = (yMax - y0 + 1) * GRID + pad * 2;
  // A fan below a bottom-row tech pokes past the grid — give it room.
  if (fanned.some((id) => TECHNOLOGIES[id].node.y === yMax)) {
    height += FAN_DY + UNODE / 2 - GRID / 2 + 6;
  }
  const cx = (id: TechId) => pad + (TECHNOLOGIES[id].node.x - x0) * GRID + GRID / 2;
  const cy = (id: TechId) => pad + (TECHNOLOGIES[id].node.y - y0) * GRID + GRID / 2;
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
      path.setAttribute('d',
        `M ${cx(req)} ${cy(req)} L ${cx(id)} ${cy(req)} L ${cx(id)} ${cy(id)}`);
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
      class: `tech-node ${cls}${isSel ? ' selected' : ''}${hinted ? ' hinted' : ''}`,
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
        class: `tech-node upgrade ${cls}${isSel ? ' selected' : ''}`,
        style: `left:${fanX(id, i, ups.length) - UNODE / 2}px;top:${fanY(id) - UNODE / 2}px`,
      }, def.glyph);
      if (level > 0) node.append(el('span', { class: 'lvl' }, String(level)));
      node.addEventListener('click', () => {
        selected = { kind: 'upgrade', id: u };
        game.notify();
      });
      canvas.append(node);
    });
  }

  const tree = el('div', { class: 'tech-tree' }, canvas);
  // Preserve the pan across the per-tick re-render.
  tree.addEventListener('scroll', () => {
    treeScroll = { left: tree.scrollLeft, top: tree.scrollTop };
  });
  requestAnimationFrame(() => {
    // A hinted tech overrides the remembered pan — bring it into view.
    const hint = game.uiHint();
    const hintedTech = hint?.startsWith('tech:')
      ? (TECH_ORDER.find((id) => `tech:${id}` === hint) ?? null) : null;
    if (hintedTech && visibility(state, hintedTech) !== 'hidden') {
      treeScroll = {
        left: Math.max(0, cx(hintedTech) - tree.clientWidth / 2),
        top: Math.max(0, cy(hintedTech) - tree.clientHeight / 2),
      };
    }
    tree.scrollLeft = treeScroll.left;
    tree.scrollTop = treeScroll.top;
  });
  menu.append(tree);

  // ---- info panel for the selected node ----
  if (selected === null) {
    menu.append(el('p', { class: 'muted' }, 'Tap a technology or upgrade for details.'));
  } else if (selected.kind === 'tech') {
    menu.append(techInfoPanel(game, selected.id, busy, slots));
  } else {
    menu.append(upgradeInfoPanel(game, selected.id));
  }
  return menu;
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
