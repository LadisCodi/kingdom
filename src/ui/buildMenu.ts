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
import {
  buildCost, buildGoodsCost, districtCount, isNumbered, maxDistrictCount,
} from '../sim/districts';
import { getGood } from '../sim/goods';
import { harmonyBlock, harmonyDemand, harmonySupply, harmonySurplusTier } from '../sim/harmony';
import { isTechComplete } from '../sim/research';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { el, formatExact } from './format';
import { costChips, iconEl, sheet } from './kit';
import type { GoodId } from '../sim/state';
import { PROMISE } from './buildPromise';

/** What this building is FOR, in one line — the card's promise. Falls back
 *  to the full description, which is fine but wordier than a card wants. */
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
    el('b', {}, formatExact(supply)),
    el('span', {}, `supplied of ${formatExact(demand)} demanded`),
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
  const cost = buildCost(def.id, count + 1);
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
    blocked = `Needs ${formatExact(short.shortBy)} more Harmony`;
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
      ? spriteImgAt(art)
      : iconEl(def.id, { size: 'lg' })),
    // Named with the ordinal it WOULD be, because the price on this card is
    // that instance's price (Docs/features/05-city-and-districts.md §3.1).
    // The ordinal is a QUALIFIER, not part of the name: smaller and quieter,
    // on the same line. Set at the name's own weight it was simply two more
    // characters to fit, and "Housing #1" is what put the one line the player
    // scans onto two.
    el('div', { class: 'bld-name' },
      def.name,
      ...(capped || !isNumbered(game.state, def)
        ? []
        : [el('span', { class: 'bld-ordinal' }, `#${count + 1}`)])),
    el('div', { class: 'bld-promise' }, PROMISE[def.id]),
    // WHAT IT IS, WHAT IT DOES, WHAT IT COSTS — and nothing else (M3). The
    // card used to carry a fourth row: the build time and the owned/cap pips.
    // Both are said again where they are acted on — the placement bar quotes
    // the same duration with the same hourglass, and a card at its cap wears
    // a ribbon saying so in words — and at 179px the row was being paid for
    // out of the one column that had no room, the text.
    el('div', { class: 'bld-cost' },
      costChips(cost, (c) => game.walletValue(c)),
      ...goods.map(([g, n]) => el('span',
        { class: `k-chip${getGood(game.state.city.goods, g) < n ? ' is-short' : ''}` },
        iconEl(g, { size: 'sm' }), el('span', {}, formatExact(n)))),
      ...(def.harmonySupply > 0
        ? [el('span', { class: 'k-chip is-gain' },
            iconEl('harmony', { size: 'sm' }), el('span', {}, `+${formatExact(def.harmonySupply)}`))]
        : [])),
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
    el('div', { class: 'bld-promise' }, 'Unlocked by research'));
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
