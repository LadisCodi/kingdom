// The Build menu (Docs/art/ui-menus-redesign.md §5.5, mockup M106).
//
// The whole height under the header, three tabs — Economy, Military,
// Decoration — fixed at its top, and under them a list of full-width rows
// that scrolls. Each row is the building's own level-1 art, its name and the
// ordinal it would get, what it promises, its price as chips, and at the
// right the wait and how many the city owns of how many it may. What can be
// built comes first, then what cannot be paid for yet, then what is capped,
// then what a technology still has to open — so the player learns it exists.
//
// Tapping a row goes straight to placement, and only with the price in
// hand: a row the player cannot pay for shakes and pulses its short chips
// instead. Placement's close comes back here, on the same tab and at the
// same scroll, so two buildings can be compared without navigating twice.

import {
  BUILD_TABS, CITY_DEF, DISTRICTS, FEATURES, HARMONY, TECHNOLOGIES, type BuildTab,
} from '../sim/data/definitions';
import {
  buildCost, buildGoodsCost, districtCount, isNumbered, maxDistrictCount,
} from '../sim/districts';
import { getGood } from '../sim/goods';
import { harmonyBlock, harmonyDemand, harmonySupply, harmonySurplusTier } from '../sim/harmony';
import { isTechComplete } from '../sim/research';
import { buildingArtUrl, spriteImgAt } from '../render/sprites';
import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { costChips, ctaBadge, iconEl, sheet, type IconName } from './kit';
import type { CurrencyId, DistrictId, GoodId } from '../sim/state';
import { PROMISE } from './buildPromise';
import { tr } from '../i18n/tr';

// ------------------------------------------------------------- menu state
// UI conveniences, not game state: which tab was last open and where each
// row was scrolled to. They outlive the sheet, so closing placement lands the
// player back where they picked from.

let openTab: BuildTab = 'Economy';
const listScroll: Partial<Record<BuildTab, number>> = {};

/** A tab's name, as its button says it. */
const tabLabel = (tab: BuildTab): string => ({
  Economy: tr('Economy'),
  Military: tr('Military'),
  Decoration: tr('Decoration'),
} as Record<BuildTab, string>)[tab] ?? tab;

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

// A quest hint on a card opens the menu on that card's tab — once, when the
// hint appears, so the player can still switch tabs while it lasts.
let followedHint: string | null = null;
function followHint(game: Game): void {
  const hint = game.uiHint();
  if (hint !== followedHint && hint?.startsWith('build:')) {
    const id = hint.slice('build:'.length) as DistrictId;
    if (DISTRICTS[id]) openTab = DISTRICTS[id].buildTab;
  }
  followedHint = hint;
}

/** What a row shows: the art the map will draw for one just built. */
export const cardArt = (id: DistrictId): string | null => {
  const def = DISTRICTS[id];
  return buildingArtUrl(def.sprite, 1, def.plants === null ? null : FEATURES[def.plants].sprite);
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
    ? tr('+{pct}% taxes', { pct: formatExact(Math.round(tier.bonus * 100)) })
    : nextTier !== undefined && demand > 0
      ? tr('{at}% pays +{pct}%', {
        at: formatExact(Math.round(nextTier.at * 100)), pct: formatExact(Math.round(nextTier.bonus * 100)),
      })
      : '';
  return el('div', { class: `bld-harmony k-section${supply < demand ? ' is-short' : ''}` },
    iconEl('harmony', { size: 'sm' }),
    el('b', {}, formatExact(supply)),
    el('span', {}, tr('supplied of {n} demanded', { n: formatExact(demand) })),
    el('span', { class: `bld-harmony-note${tier !== null ? ' is-paying' : ''}` }, note),
  );
}

/** Why a card cannot be picked at all, in words — or null when it can. */
function blockedBy(game: Game, id: DistrictId): string | null {
  const def = DISTRICTS[id];
  // Not yet opened: the technology that opens it, by name.
  if (!isKnown(game, id)) return tr('Research {tech}', { tech: TECHNOLOGIES[def.requiredTech!]?.name ?? def.requiredTech! });
  const count = districtCount(game.state, id);
  // The Shrine ladder: the ruin first, and an end (sim `shrineBuild`).
  if (def.hostsRelic) {
    const offer = game.shrineBuild().kind;
    if (offer === 'ruinFirst') return tr('Repair the old shrine first');
    if (offer === 'none') return tr('You have as many as the realm allows');
  }
  if (count >= maxDistrictCount(game.state, def)) {
    // Say what lifts the cap. A count cap is the harder wall of the two: no
    // amount of decoration lifts it, so it is said first.
    const nextLevel = def.maxCountPerTownhallLevel.findIndex((n) => n > count) + 1;
    return nextLevel > 0
      ? tr('Needs Townhall level {n}', { n: formatExact(nextLevel) })
      : tr('You have as many as the realm allows');
  }
  const short = harmonyBlock(game.state, def, 1);
  return short === null ? null : tr('Needs {n} more Harmony', { n: formatExact(short.shortBy) });
}

/** Everything a card reads from the game — and so what its signature is. */
function cardFacts(game: Game, id: DistrictId) {
  const def = DISTRICTS[id];
  const count = districtCount(game.state, id);
  // Past its material builds, a Shrine is priced in Gems alone.
  const shrine = def.hostsRelic ? game.shrineBuild() : null;
  const cost: Partial<Record<CurrencyId, number>> = shrine?.kind === 'gems' ? { Gems: shrine.gems } : buildCost(id, count + 1);
  const goods = shrine?.kind === 'gems' ? [] : Object.entries(buildGoodsCost(game.state, id)) as Array<[GoodId, number]>;
  const shortGoods = goods.some(([g, n]) => getGood(game.state.city.goods, g) < n);
  return {
    count,
    max: maxDistrictCount(game.state, def),
    blocked: blockedBy(game, id),
    numbered: isNumbered(game.state, def),
    cost,
    goods,
    affordable: (Object.entries(cost) as Array<[CurrencyId, number]>).every(([c, n]) => game.walletValue(c) >= n)
      && !shortGoods,
    hinted: game.uiHint() === `build:${id}`,
    duration: game.buildCardDuration(id),
    known: isKnown(game, id),
  };
}

/** Where a row sits: what can be built, what cannot be paid for yet, what
 *  is capped, and last what a technology has still to open. */
const rank = (f: ReturnType<typeof cardFacts>): number =>
  (!f.known ? 3 : f.blocked !== null ? 2 : f.affordable ? 0 : 1);

/** Harmony is only worth a word once something demands it: before that, a
 *  decoration pays its neighbours, and "+1 Harmony" teaches a word for
 *  nothing (21-harmony.md §2.1). */
const harmonyMatters = (game: Game): boolean => harmonyDemand(game.state) > 0;

function buildCard(game: Game, id: DistrictId, isNew: boolean): HTMLElement {
  const def = DISTRICTS[id];
  const facts = cardFacts(game, id);
  const { count, max, blocked, numbered, cost, goods, affordable, hinted, duration, known } = facts;
  const art = cardArt(id);
  const card = el('button', {
    class: `bld-card${blocked !== null ? ' is-locked' : ''}${!known ? ' is-unknown' : ''}${hinted ? ' hinted' : ''}`,
    type: 'button',
    'data-id': id,
    'data-coach': `build:${id}`,
  },
    el('div', { class: 'bld-art' },
      art ? spriteImgAt(art) : iconEl(id, { size: 'lg' }),
      ...(blocked !== null ? [el('span', { class: 'bld-lock' }, iconEl('padlock', { size: 'md' }))] : [])),
    el('div', { class: 'bld-mid' },
      // The ordinal it WOULD be: the price on this row is that instance's
      // (Docs/features/05-city-and-districts.md §3.1). A qualifier, so quieter.
      el('div', { class: 'bld-name' },
        def.name,
        ...(blocked !== null || !numbered
          ? []
          : [el('span', { class: 'bld-ordinal' }, `#${count + 1}`)])),
      // A row behind a lock says what opens it in place of a promise and a
      // price: there is nothing to pay yet.
      blocked !== null
        ? el('div', { class: 'bld-why' }, blocked)
        : el('div', { class: 'bld-promise' }, PROMISE[id]),
      ...(blocked !== null ? [] : [el('div', { class: 'bld-cost' },
        costChips(cost, (c) => game.walletValue(c)),
        ...goods.map(([g, n]) => el('span',
          { class: `k-chip${getGood(game.state.city.goods, g) < n ? ' is-short' : ''}` },
          iconEl(g, { size: 'sm' }), el('span', {}, formatExact(n)))),
        ...(def.harmonySupply > 0 && harmonyMatters(game)
          ? [el('span', { class: 'k-chip is-gain' },
              iconEl('harmony', { size: 'sm' }), el('span', {}, `+${formatExact(def.harmonySupply)}`))]
          : []))])),
    // The wait and the count, in a column of their own so they line up down
    // the list. A row a technology has still to open has neither yet.
    ...(!known ? [] : [el('div', { class: 'bld-side' },
      ...(blocked !== null ? [] : [el('span', { class: 'bld-foot-time' },
        iconEl('hourglass', { size: 'sm' }), formatDuration(duration))]),
      el('span', { class: 'bld-foot-built' }, tr('Built {count}/{max}', { count: formatExact(count), max: formatExact(max) })))]),
  );
  if (isNew && blocked === null) {
    card.append(el('span', { class: 'bld-new', 'aria-label': tr('New') }, el('span', {}, tr('New!'))));
  }
  if (blocked !== null) {
    card.disabled = true;
    return card;
  }
  card.addEventListener('click', () => {
    if (!affordable) {
      // Not entered: placement is only reached with the price in hand. The
      // row says no, and the chips that are short say why.
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
    'data-coach': `build-tab:${tab}`,
  },
    iconEl(TAB_ICON[tab], { size: 'sm' }),
    el('span', { class: 'bld-tab-label' }, tabLabel(tab)),
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
 * (kit/host.ts). A rebuild replaces the row, and a phone drops a drag with
 * the node — so one that does come while the row is in a hand waits for it
 * to be still (`holdWhileScrolling`).
 */
export function buildMenuSignature(game: Game): string {
  const seenIds = loadSeen(game);
  const all = inTab(openTab);
  return JSON.stringify([
    openTab,
    BUILD_TABS.map((t) => inTab(t).filter((id) => game.canBuildNow(id)).length),
    // The chips read every purse a price can be in, through walletValue.
    game.state.city.wallet, game.state.kingdom.wallet, game.state.player.wallet,
    game.state.city.goods,
    harmonySupply(game.state), harmonyDemand(game.state), harmonySurplusTier(game.state),
    all.map((id) => [id, seenIds.has(id), cardFacts(game, id)]),
  ]);
}

export function renderBuildMenu(game: Game): HTMLElement {
  followHint(game);
  const seenIds = loadSeen(game);
  const ids = inTab(openTab);
  const known = ids.filter((id) => isKnown(game, id));

  showingNew.clear();
  // Stable within a rank: the menu's own order.
  const order = ids.map((id, i) => ({ id, i, r: rank(cardFacts(game, id)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  const cards = order.map(({ id }) => {
    const isNew = isKnown(game, id) && !seenIds.has(id);
    if (isNew) showingNew.add(id);
    return buildCard(game, id, isNew);
  });

  const list = el('div', { class: 'bld-list', 'data-keep-scroll': `bld-list-${openTab}` }, ...cards);
  const tab = openTab;
  list.addEventListener('scroll', () => { listScroll[tab] = list.scrollTop; }, { passive: true });
  // Back from placement: the list the player left, where they left it. Set
  // once the list is in the document (the host keeps it from then on).
  requestAnimationFrame(() => {
    const at = listScroll[tab];
    if (at !== undefined && list.isConnected && list.scrollTop === 0) list.scrollTop = at;
  });

  const surface = sheet(
    {
      title: tr('Build'),
      tall: true,
      onClose: () => {
        commitSeen();
        game.dismiss();
      },
    },
    el('div', { class: 'bld-tabs', role: 'tablist' }, ...BUILD_TABS.map((t) => tabButton(game, t))),
    // Silent until Harmony is asked for: before that, what a decoration pays
    // is its place — a house beside it collects more Gold.
    ...(openTab !== 'Decoration' ? []
      : harmonyMatters(game)
        ? [harmonyLine(game)]
        : known.length > 0 ? [el('div', { class: 'bld-tip k-section' },
          iconEl('Housing', { size: 'sm' }), el('span', {}, tr('A house beside a decoration earns more Gold')))] : []),
    list,
  );
  // The tabs stay put; only the list under them scrolls (as the Bag's).
  surface.classList.add('is-panes');
  return surface;
}
