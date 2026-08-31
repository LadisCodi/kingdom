// Research overlay, two tabs:
//  - Technologies: a pannable tech TREE — compact icon nodes with state-
//    colored borders, dotted orthogonal connectors (per the reference art);
//    tapping a node opens an info panel with cost/time/requirements + Start.
//    Extra concurrent slots are bought with Gems (escalating price).
//  - Upgrades: a vertical list of instant, gold-bought, leveled boosts.

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
import { getWallet, type TechId } from '../sim/state';
import { button, el, formatCost, formatDuration } from './format';

// Module-level so tab/selection/pan survive the per-tick re-render.
let activeTab: 'tech' | 'upgrades' = 'tech';
let selectedTech: TechId | null = null;
let treeScroll = { left: 0, top: 0 };

const GRID = 90; // px per tree-grid step
const NODE = 56; // node square size

export function renderResearchMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Research'));

  const tabs = el('div', { class: 'amount-row' });
  for (const [key, label] of [['tech', 'Technologies'], ['upgrades', 'Upgrades']] as const) {
    tabs.append(button(label, () => {
      activeTab = key;
      game.notify();
    }, activeTab === key ? 'selected' : ''));
  }
  menu.append(tabs);

  if (activeTab === 'tech') renderTechTab(game, menu);
  else renderUpgradesTab(game, menu);
  return menu;
}

// ------------------------------------------------------------- Technologies

function renderTechTab(game: Game, menu: HTMLElement): void {
  const state = game.state;
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

  // ---- the tree canvas ----
  const xs = TECH_ORDER.map((id) => TECHNOLOGIES[id].node.x);
  const ys = TECH_ORDER.map((id) => TECHNOLOGIES[id].node.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const pad = 24;
  const width = (Math.max(...xs) - x0 + 1) * GRID + pad * 2;
  const height = (Math.max(...ys) - y0 + 1) * GRID + pad * 2;
  const cx = (id: TechId) => pad + (TECHNOLOGIES[id].node.x - x0) * GRID + GRID / 2;
  const cy = (id: TechId) => pad + (TECHNOLOGIES[id].node.y - y0) * GRID + GRID / 2;

  const canvas = el('div', { class: 'tech-canvas', style: `width:${width}px;height:${height}px` });

  // Dotted orthogonal connectors (H then V), under the nodes.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.classList.add('tech-edges');
  for (const id of TECH_ORDER) {
    for (const req of TECHNOLOGIES[id].requires) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d',
        `M ${cx(req)} ${cy(req)} L ${cx(id)} ${cy(req)} L ${cx(id)} ${cy(id)}`);
      path.setAttribute('class',
        isTechComplete(state, req) ? 'tech-edge open' : 'tech-edge');
      svg.append(path);
    }
  }
  canvas.append(svg);

  for (const id of TECH_ORDER) {
    const done = isTechComplete(state, id);
    const active = isTechActive(state, id);
    const available = !done && !active && requirementsMet(state, id);
    const cls = done ? 'done' : active ? 'active' : available ? 'available' : 'locked';
    const node = el('button', {
      class: `tech-node ${cls}${selectedTech === id ? ' selected' : ''}`,
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
      selectedTech = id;
      game.notify();
    });
    canvas.append(node);
  }

  const tree = el('div', { class: 'tech-tree' }, canvas);
  // Preserve the pan across the per-tick re-render.
  tree.addEventListener('scroll', () => {
    treeScroll = { left: tree.scrollLeft, top: tree.scrollTop };
  });
  requestAnimationFrame(() => {
    tree.scrollLeft = treeScroll.left;
    tree.scrollTop = treeScroll.top;
  });
  menu.append(tree);

  // ---- info panel for the selected tech ----
  if (selectedTech === null) {
    menu.append(el('p', { class: 'muted' }, 'Tap a technology for details.'));
    return;
  }
  const id = selectedTech;
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
  menu.append(panel);
}

// ----------------------------------------------------------------- Upgrades

function renderUpgradesTab(game: Game, menu: HTMLElement): void {
  const state = game.state;
  const list = el('div', { class: 'menu-list' });
  for (const id of UPGRADE_ORDER) {
    const def = UPGRADES[id];
    const level = upgradeLevel(state, id);
    const maxed = level >= def.maxLevel;
    const techLocked =
      def.requiredTech !== null && !isTechComplete(state, def.requiredTech);
    const cost = upgradeCost(id, level);
    const affordable = canAfford(state.city.wallet, { Gold: cost });

    const pips = el('div', { class: 'pips' });
    for (let i = 0; i < def.maxLevel; i++) {
      pips.append(el('span', { class: `pip${i < level ? ' on' : ''}` }));
    }

    const buyBtn = button('Upgrade', () => game.doBuyUpgrade(id));
    buyBtn.disabled = maxed || techLocked || !affordable;
    const statusLine = techLocked
      ? el('div', { class: 'blocked' }, `🔒 ${TECHNOLOGIES[def.requiredTech!].name} research`)
      : maxed
        ? el('div', { class: 'delta' }, 'Maxed')
        : el('div', { class: affordable ? 'desc' : 'blocked' }, `${cost} ${icon('Gold')}`);

    list.append(el('div', { class: `menu-row${techLocked ? ' disabled' : ''}` },
      el('span', { class: 'icon' }, def.glyph),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, `${def.name} — Lv ${level}/${def.maxLevel}`),
        el('div', { class: 'desc' }, def.description),
        pips,
        statusLine),
      el('div', { class: 'meta' }, buyBtn),
    ));
  }
  menu.append(list);
}
