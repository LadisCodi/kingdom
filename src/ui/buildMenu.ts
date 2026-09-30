// The Build menu (Docs/art/ui-menus-redesign.md §5.5, mockups M47–M48).
//
// A drawer over the map with three tabs — Economy, Military, Decoration —
// and one sideways row of tall cards under them. Each card is the
// building's own level-1 art, its name and the ordinal it would get, what it
// promises, its price as chips, and a footer strip with the wait and how
// many the city owns of how many it may.
//
// Tapping a card goes straight to placement, and only with the price in
// hand: a card the player cannot pay for shakes and pulses its short chips
// instead. Placement's close comes back here, on the same tab and at the
// same scroll, so two buildings can be compared without navigating twice.

import { BUILD_TABS, CITY_DEF, DISTRICTS, HARMONY, type BuildTab } from '../sim/data/definitions';
import {
  buildCost, buildGoodsCost, districtCount, isNumbered, maxDistrictCount,
} from '../sim/districts';
import { getGood } from '../sim/goods';
import { harmonyBlock, harmonyDemand, harmonySupply, harmonySurplusTier } from '../sim/harmony';
import { canAfford } from '../sim/commands';
import { isTechComplete } from '../sim/research';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { costChips, ctaBadge, iconEl, sheet, sideScroll, type IconName } from './kit';
import type { CurrencyId, DistrictId, GoodId } from '../sim/state';
import { PROMISE } from './buildPromise';

// ------------------------------------------------------------- menu state
// UI conveniences, not game state: which tab was last open and where each
// row was scrolled to. They outlive the sheet, so closing placement lands the
// player back where they picked from.

let openTab: BuildTab = 'Economy';
const rowScroll: Partial<Record<BuildTab, number>> = {};

const TAB_ICON: Record<BuildTab, IconName> = {
  Economy: 'Gold',
  Military: 'army',
  Decoration: 'harmony',
};

// A building is NEW until its tab has been looked at once. Remembered per
// viewer in localStorage — a convenience that may come back empty, never a
// fact the game depends on.
const SEEN_KEY = 'kingdom.build.seen';
let seen: Set<string> | null = null;
/** What is being shown as New on the open tab right now: marked seen when
 *  the player leaves it — switches tab, picks a card, or closes the menu. */
const showingNew = new Set<string>();

function loadSeen(game: Game): Set<string> {
  if (seen !== null) return seen;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw !== null) seen = new Set(JSON.parse(raw) as string[]);
  } catch { /* private mode, blocked storage: nothing is new then */ }
  if (seen === null) {
    // First look ever: what is already unlocked is not news.
    seen = new Set(CITY_DEF.buildMenuOrder.filter((id) => isKnown(game, id)));
    saveSeen();
  }
  return seen;
}
function saveSeen(): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...(seen ?? [])])); } catch { /* ignore */ }
}
function commitSeen(): void {
  if (showingNew.size === 0 || seen === null) return;
  for (const id of showingNew) seen.add(id);
  showingNew.clear();
  saveSeen();
}

const isKnown = (game: Game, id: DistrictId): boolean => {
  const def = DISTRICTS[id];
  return def.requiredTech === null || isTechComplete(game.state, def.requiredTech);
};

const inTab = (tab: BuildTab): DistrictId[] =>
  CITY_DEF.buildMenuOrder.filter((id) => DISTRICTS[id].buildTab === tab);

// ------------------------------------------------------------------ parts

/**
 * `supply / demand` and what the surplus is paying, over the decorations.
 * The one place the mechanic is explained rather than merely counted.
 */
function harmonyLine(game: Game): HTMLElement {
  const supply = harmonySupply(game.state);
  const demand = harmonyDemand(game.state);
  const tier = harmonySurplusTier(game.state);
  const nextTier = HARMONY.surplusTiers.find((t) => tier === null || t.at > tier.at);
  const note = tier !== null
    ? `+${Math.round(tier.bonus * 100)}% taxes`
    : nextTier !== undefined && demand > 0
      ? `${Math.round(nextTier.at * 100)}% pays +${Math.round(nextTier.bonus * 100)}%`
      : '';
  return el('div', { class: `bld-harmony k-section${supply < demand ? ' is-short' : ''}` },
    iconEl('harmony', { size: 'sm' }),
    el('b', {}, formatExact(supply)),
    el('span', {}, `supplied of ${formatExact(demand)} demanded`),
    el('span', { class: `bld-harmony-note${tier !== null ? ' is-paying' : ''}` }, note),
  );
}

/** Why a card cannot be picked at all, in words — or null when it can. */
function blockedBy(game: Game, id: DistrictId): string | null {
  const def = DISTRICTS[id];
  const count = districtCount(game.state, id);
  if (count >= maxDistrictCount(game.state, def)) {
    // Say what lifts the cap. A count cap is the harder wall of the two: no
    // amount of decoration lifts it, so it is said first.
    const nextLevel = def.maxCountPerTownhallLevel.findIndex((n) => n > count) + 1;
    return nextLevel > 0
      ? `Needs Townhall level ${nextLevel}`
      : 'You have as many as the realm allows';
  }
  const short = harmonyBlock(game.state, def, 1);
  return short === null ? null : `Needs ${formatExact(short.shortBy)} more Harmony`;
}

/** Everything a card reads from the game — and so what its signature is. */
function cardFacts(game: Game, id: DistrictId) {
  const def = DISTRICTS[id];
  const count = districtCount(game.state, id);
  const cost = buildCost(id, count + 1);
  const goods = Object.entries(buildGoodsCost(id)) as Array<[GoodId, number]>;
  const shortGoods = goods.some(([g, n]) => getGood(game.state.city.goods, g) < n);
  return {
    count,
    max: maxDistrictCount(game.state, def),
    blocked: blockedBy(game, id),
    numbered: isNumbered(game.state, def),
    cost,
    goods,
    affordable: canAfford(game.state.city.wallet, cost) && !shortGoods,
    hinted: game.uiHint() === `build:${id}`,
    duration: game.buildCardDuration(id),
  };
}

function buildCard(game: Game, id: DistrictId, isNew: boolean): HTMLElement {
  const def = DISTRICTS[id];
  const { count, max, blocked, numbered, cost, goods, affordable, hinted, duration } = cardFacts(game, id);
  const art = spriteUrl(`${def.sprite}_l1`);
  const card = el('button', {
    class: `bld-card${blocked !== null ? ' is-locked' : ''}${hinted ? ' hinted' : ''}`,
    type: 'button',
    'data-id': id,
  },
    el('div', { class: 'bld-art' }, art ? spriteImgAt(art) : iconEl(id, { size: 'lg' })),
    // The ordinal it WOULD be: the price on this card is that instance's
    // (Docs/features/05-city-and-districts.md §3.1). A qualifier, so quieter.
    el('div', { class: 'bld-name' },
      def.name,
      ...(blocked !== null || !numbered
        ? []
        : [el('span', { class: 'bld-ordinal' }, `#${count + 1}`)])),
    el('div', { class: 'bld-promise' }, PROMISE[id]),
    // A card behind a ribbon shows no price: there is nothing to pay yet.
    ...(blocked !== null ? [] : [el('div', { class: 'bld-cost' },
      costChips(cost, (c) => game.walletValue(c)),
      ...goods.map(([g, n]) => el('span',
        { class: `k-chip${getGood(game.state.city.goods, g) < n ? ' is-short' : ''}` },
        iconEl(g, { size: 'sm' }), el('span', {}, formatExact(n)))),
      ...(def.harmonySupply > 0
        ? [el('span', { class: 'k-chip is-gain' },
            iconEl('harmony', { size: 'sm' }), el('span', {}, `+${formatExact(def.harmonySupply)}`))]
        : []))]),
    el('div', { class: 'bld-foot' },
      el('span', { class: 'bld-foot-time' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(duration)),
      el('span', { class: 'bld-foot-built' }, `Built ${formatExact(count)}/${formatExact(max)}`)),
  );
  if (isNew && blocked === null) {
    card.append(el('span', { class: 'bld-new', 'aria-label': 'New' }, el('span', {}, 'New!')));
  }
  if (blocked !== null) {
    card.disabled = true;
    card.querySelector('.bld-art')!.append(el('div', { class: 'bld-ribbon' },
      iconEl('padlock', { size: 'sm' }), el('span', {}, blocked)));
    return card;
  }
  card.addEventListener('click', () => {
    if (!affordable) {
      // Not entered: placement is only reached with the price in hand. The
      // card says no, and the chips that are short say why.
      game.shake((Object.entries(cost) as Array<[CurrencyId, number]>)
        .filter(([c, n]) => game.walletValue(c) < n).map(([c]) => c));
      card.classList.remove('is-refused');
      void card.offsetWidth; // restart the animation on a second tap
      card.classList.add('is-refused');
      return;
    }
    commitSeen();
    game.startPlacement(id);
  });
  return card;
}

function tabButton(game: Game, tab: BuildTab): HTMLElement {
  const count = inTab(tab).filter((id) => game.canBuildNow(id)).length;
  const b = el('button', {
    class: `bld-tab${tab === openTab ? ' is-open' : ''}`,
    type: 'button',
    'aria-pressed': tab === openTab ? 'true' : 'false',
  },
    iconEl(TAB_ICON[tab], { size: 'sm' }),
    el('span', { class: 'bld-tab-label' }, tab),
    ...(count > 0 ? [ctaBadge(count, `build-tab:${tab}`)] : []),
  );
  b.addEventListener('click', () => {
    if (tab === openTab) return;
    commitSeen();
    openTab = tab;
    game.notify();
  });
  return b;
}

// ----------------------------------------------------------------- screen

/**
 * What the menu draws, so the host rebuilds it only when that moves
 * (kit/host.ts). A rebuild every tick replaces the row under a finger that is
 * dragging it, and a phone drops the drag with the node.
 */
export function buildMenuSignature(game: Game): string {
  const seenIds = loadSeen(game);
  const known = inTab(openTab).filter((id) => isKnown(game, id));
  return JSON.stringify([
    openTab,
    BUILD_TABS.map((t) => inTab(t).filter((id) => game.canBuildNow(id)).length),
    // The chips read every purse a price can be in, through walletValue.
    game.state.city.wallet, game.state.kingdom.wallet, game.state.player.wallet,
    game.state.city.goods,
    harmonySupply(game.state), harmonyDemand(game.state), harmonySurplusTier(game.state),
    known.map((id) => [id, seenIds.has(id), cardFacts(game, id)]),
  ]);
}

export function renderBuildMenu(game: Game): HTMLElement {
  const seenIds = loadSeen(game);
  const known = inTab(openTab).filter((id) => isKnown(game, id));

  showingNew.clear();
  const cards = known.map((id) => {
    const isNew = !seenIds.has(id);
    if (isNew) showingNew.add(id);
    return buildCard(game, id, isNew);
  });

  const row = sideScroll(el('div', { class: 'bld-row', 'data-keep-scroll': `bld-row-${openTab}` }, ...cards));
  const tab = openTab;
  row.addEventListener('scroll', () => { rowScroll[tab] = row.scrollLeft; }, { passive: true });
  // Back from placement: the row the player left, where they left it. Set
  // once the row is in the document (the host keeps it from then on).
  requestAnimationFrame(() => {
    const at = rowScroll[tab];
    if (at !== undefined && row.isConnected && row.scrollLeft === 0) row.scrollLeft = at;
  });

  return sheet(
    {
      title: 'Build',
      onClose: () => {
        commitSeen();
        game.dismiss();
      },
    },
    el('div', { class: 'bld-tabs', role: 'tablist' }, ...BUILD_TABS.map((t) => tabButton(game, t))),
    // Silent until Harmony exists in the player's world: a decoration they
    // may build, or a supply or a demand already standing. "0 of 0" would
    // teach a word for nothing.
    ...(openTab === 'Decoration'
      && (known.length > 0 || harmonySupply(game.state) > 0 || harmonyDemand(game.state) > 0)
      ? [harmonyLine(game)] : []),
    row,
  );
}
