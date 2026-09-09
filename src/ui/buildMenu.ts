// The Build sheet (§5.5).
//
// It was a build-order table: one row per district, the interesting fact
// about each — what it will actually do for you — demoted to 12px grey, and
// the cost quoted "indicatively at distance 0" before changing on the next
// screen, which quietly teaches the player not to trust numbers.
//
// Now a grid of cards, each showing the building's own level-1 art, what it
// promises in plain words, and its cost as chips that turn clay when you are
// short. Tapping a card goes straight to placement — the whole card is the
// target, not a small Select button beside it.

import { CITY_DEF, DECORATIONS, DISTRICTS, HARMONY } from '../sim/data/definitions';
import { buildCost, buildDuration, buildGoodsCost, districtCount, maxDistrictCount } from '../sim/districts';
import { getGood } from '../sim/goods';
import { harmonyBlock, harmonyDemand, harmonySupply, harmonySurplusTier } from '../sim/harmony';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { costChips, iconEl, pips, sheet } from './kit';
import type { GoodId } from '../sim/state';

/** What this building is FOR, in one line — the card's promise. Falls back
 *  to the full description, which is fine but wordier than a card wants. */
const PROMISE: Partial<Record<string, string>> = {
  Housing: 'Villagers live here and pay taxes',
  Farm: 'Workers harvest crops nearby',
  FarmLands: 'A crop plot you can tap for food',
  Sawmill: 'Workers fell the forest around it',
  Quarry: 'Workers cut stone from nearby rock',
  Docks: 'Boats bring in fish',
  Mine: 'Workers dig iron from nearby veins',
};

/**
 * `supply / demand` and what the surplus is paying, above the grid.
 *
 * Silent until the city has a decoration it may actually build, or has been
 * asked for Harmony by something: before that the stat does not exist in the
 * player's world and a header reading "0 of 0" teaches a word for nothing.
 * From the level the first piece unlocks it is the scoreboard for the section
 * below it, and it says what supplies and what demands — the one place the
 * mechanic is explained rather than merely counted.
 */
function harmonyHeader(game: Game): HTMLElement | null {
  const supply = harmonySupply(game.state);
  const demand = harmonyDemand(game.state);
  const buildable = DECORATIONS.some((id) => {
    const def = DISTRICTS[id];
    const known = def.requiredTech === null || isTechComplete(game.state, def.requiredTech);
    return known && maxDistrictCount(game.state, def) > 0;
  });
  if (supply === 0 && demand === 0 && !buildable) return null;
  const tier = harmonySurplusTier(game.state);
  const nextTier = HARMONY.surplusTiers.find((t) => tier === null || t.at > tier.at);
  const note = tier !== null
    ? `+${Math.round(tier.bonus * 100)}% taxes`
    : nextTier !== undefined && demand > 0
      ? `${Math.round(nextTier.at * 100)}% of demand pays +${
        Math.round(nextTier.bonus * 100)}% taxes`
      : 'decorations supply it, levels 8 and up demand it';
  return el('div', { class: `bld-harmony${supply < demand ? ' is-short' : ''}` },
    iconEl('harmony', { size: 'sm' }),
    el('b', {}, `${supply}`),
    el('span', {}, `supplied of ${demand} demanded`),
    el('span', { class: 'bld-harmony-note' }, note),
  );
}

/** One card. `null` when the building is tech-locked, which HIDES it: the
 *  tech tree is where a building is discovered, and the "More to discover"
 *  card at the end of the grid says so. */
function buildCard(game: Game, id: string): HTMLElement | null {
  const def = DISTRICTS[id as keyof typeof DISTRICTS];
  if (def.requiredTech !== null && !isTechComplete(game.state, def.requiredTech)) return null;

  const count = districtCount(game.state, def.id);
  const maxCount = maxDistrictCount(game.state, def);
  const capped = count >= maxCount;
  const cost = buildCost(def.id, count);
  const short = harmonyBlock(game.state, def, 1);

  // When capped, say what lifts the cap — in words, not "Townhall lvl 3".
  // Harmony comes second, because a count cap is the harder wall of the two:
  // no amount of decoration lifts it.
  let blocked: string | null = null;
  if (capped) {
    const nextLevel = def.maxCountPerTownhallLevel.findIndex((n) => n > count) + 1;
    blocked = nextLevel > 0
      ? `Needs Townhall level ${nextLevel}`
      : 'You have as many as the realm allows';
  } else if (short !== null) {
    blocked = `Needs ${short.shortBy} more Harmony`;
  }

  // Refined goods sit beside the currencies rather than among them — they are
  // not wallet rows, and being short of one sends the player to a workshop
  // queue rather than out to the map. Only a decoration names any today.
  const goods = Object.entries(buildGoodsCost(def.id)) as Array<[GoodId, number]>;

  const art = spriteUrl(`${def.sprite}_l1`);
  const hinted = game.uiHint() === `build:${def.id}`;
  const card = el('button', {
    class: `bld-card${blocked !== null ? ' is-locked' : ''}${hinted ? ' hinted' : ''}`,
    type: 'button',
  },
    el('div', { class: 'bld-art' }, art
      ? el('img', { src: art, alt: '' })
      : iconEl(def.id, { size: 'lg' })),
    el('div', { class: 'bld-name' }, def.name),
    el('div', { class: 'bld-promise' }, PROMISE[def.id] ?? def.description),
    el('div', { class: 'bld-cost' },
      costChips(cost, (c) => game.walletValue(c)),
      ...goods.map(([g, n]) => el('span',
        { class: `k-chip${getGood(game.state.city.goods, g) < n ? ' is-short' : ''}` },
        iconEl(g, { size: 'sm' }), el('span', {}, String(n)))),
      ...(def.harmonySupply > 0
        ? [el('span', { class: 'k-chip is-gain' },
            iconEl('harmony', { size: 'sm' }), el('span', {}, `+${def.harmonySupply}`))]
        : [])),
    el('div', { class: 'bld-meta' },
      iconEl('hourglass', { size: 'sm' }),
      el('span', {}, formatDuration(buildDuration(game.state, def.id, count, 0))),
      // Owned as filled pips: "2 of 4" without making the player parse a
      // fraction. An unbounded count falls back to the number.
      Number.isFinite(maxCount)
        ? pips(count, maxCount)
        : el('span', {}, `${count} built`)),
  );
  if (blocked !== null) {
    card.disabled = true;
    card.append(el('div', { class: 'bld-ribbon' },
      iconEl('padlock', { size: 'sm' }), el('span', {}, blocked)));
  } else {
    card.addEventListener('click', () => game.startPlacement(def.id));
  }
  return card;
}

export function renderBuildMenu(game: Game): HTMLElement {
  const decorations = new Set<string>(DECORATIONS);
  const buildings = CITY_DEF.buildMenuOrder
    .filter((id) => !decorations.has(id))
    .map((id) => buildCard(game, id))
    .filter((c): c is HTMLElement => c !== null);

  // The menu silently grows as techs land and the player never learns why.
  const discover = el('button', { class: 'bld-card bld-more', type: 'button' },
    el('div', { class: 'bld-art' }, iconEl('unknown', { size: 'lg' })),
    el('div', { class: 'bld-name' }, 'More to discover'),
    el('div', { class: 'bld-promise' }, 'New buildings come from research'));
  discover.addEventListener('click', () => game.setOverlay('research'));
  buildings.push(discover);

  // Decorations are their own section rather than six more cards in one long
  // grid: they buy a different thing from every building above them, and a
  // player looking for one is looking for the category, not the piece.
  const pieces = DECORATIONS
    .map((id) => buildCard(game, id))
    .filter((c): c is HTMLElement => c !== null);

  const header = harmonyHeader(game);
  return sheet(
    { title: 'Build', onClose: () => game.dismiss() },
    ...(header === null ? [] : [header]),
    el('div', { class: 'bld-grid' }, ...buildings),
    ...(pieces.length === 0 ? [] : [
      el('div', { class: 'bld-section' }, 'Decorations'),
      el('div', { class: 'bld-grid' }, ...pieces),
    ]),
  );
}
