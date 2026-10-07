// THE BAG (Docs/proposals/inventory.md, Docs/plans/relics-and-bag.md).
//
// Everything the player owns that is not a currency or a building, held
// until it is USED. Three rules this file keeps:
//
//  1. AN ITEM IS NOT A CURRENCY. Nothing prices anything in items; an item
//     leaves the Bag only by being used.
//  2. A CHEST IS A DURATION OF THE PLAYER'S OWN PRODUCTION, read at the
//     moment of use (`cityMakesPerSecond`), never a fixed amount — the
//     `tap.workSeconds` rule. Its floor (`bag.chestFloorPerHour`) is what a
//     coin the city barely makes yet still pays.
//  3. A USE IS A COMMAND. It reads the state as `advance()` left it and
//     lands in the wallet, past any store — the offline replay never sees it.

import { roundPrice } from './roundPrice';
import { track } from './analytics';
import { recordEvent } from './events';
import { BAG, ITEMS, type BoostKind, type ItemDef } from './data/definitions';
import { payKnowledge } from './knowledge';
import { accrueMana, addMana, manaCap } from './mana';
import { addModifier, type Modifier, type ModifierStat } from './modifiers';
import { repriceTaxAnchorAround } from './population';
import { cityMakesPerSecond } from './production';
import { addToWallet, type CurrencyId, type GameState, type ItemId, type Wallet } from './state';

export const itemDef = (id: ItemId): ItemDef | undefined => ITEMS[id];

/** The Bag's tabs (Docs/art/ui-inventory.md §3.2). Relics holds no items:
 *  it shows the relics met and their fragments (`state.relics`). */
export const BAG_TABS = ['Resources', 'Speed ups', 'Boosts', 'Relics', 'Other'] as const;
export type BagTab = typeof BAG_TABS[number];

const TAB_OF_KIND: Record<ItemDef['kind'], BagTab> = {
  chest: 'Resources', choice: 'Resources', speedup: 'Speed ups', boost: 'Boosts', flask: 'Other', tome: 'Other',
  key: 'Other', part: 'Other',
};

/** Which tab an item is shown in: a fact of its kind. */
export const bagTabOf = (id: ItemId): BagTab => TAB_OF_KIND[ITEMS[id].kind];

/** How many of this item the Bag holds. */
export const itemCount = (state: GameState, id: ItemId): number => state.bag.held[id] ?? 0;

/** Every item held, in file order — the Bag's order. */
export const heldItems = (state: GameState): ItemId[] =>
  (Object.keys(ITEMS) as ItemId[]).filter((id) => itemCount(state, id) > 0);

/** Put `n` of an item in the Bag. It is fresh until its tile is tapped. */
export function grantItem(state: GameState, id: ItemId, n = 1): void {
  if (ITEMS[id] === undefined || !(n > 0)) return;
  state.bag.held[id] = itemCount(state, id) + n;
  state.bag.fresh[id] = true;
  state.bag.badge += n;
}

/** The coins a chest or a choice chest may pay. */
export const CHEST_COINS: readonly CurrencyId[] = ['Gold', 'Food', 'Wood', 'Stone'];

/** What ONE of this chest pays, now: its seconds of what the city makes of
 *  its coin, floored. A choice chest pays the coin picked when it is opened.
 *  Nothing for an item that is not a chest. */
export function chestValue(state: GameState, id: ItemId, choice?: CurrencyId): Wallet {
  const def = ITEMS[id];
  if (def === undefined) return {};
  const coin = def.kind === 'chest' ? def.coin : def.kind === 'choice' ? choice ?? null : null;
  if (coin === null || !CHEST_COINS.includes(coin)) return {};
  const made = cityMakesPerSecond(state, coin) * def.seconds;
  const floor = (BAG.chestFloorPerHour * def.seconds) / 3600;
  return { [coin]: roundPrice(Math.max(floor, made)) };
}

/** The modifier a boost of this kind runs as: the stat it multiplies. */
const BOOST_STAT: Record<BoostKind, ModifierStat> = { Rent: 'taxRate', Harvest: 'tapYield', Mana: 'manaRegen' };

/** The running boost of this kind, if one is. Its id is the kind's, so a
 *  second of the same kind finds the first and extends it. */
export const runningBoost = (state: GameState, kind: BoostKind): Modifier | undefined =>
  state.modifiers.find((m) => m.id === `boost:${kind}` && m.expiresAt !== null && m.expiresAt > state.lastAdvance);

/** Every boost running, and when each ends. */
export const runningBoosts = (state: GameState): Array<{ kind: BoostKind; value: number; endsAt: number }> =>
  (Object.keys(BOOST_STAT) as BoostKind[]).flatMap((kind) => {
    const m = runningBoost(state, kind);
    return m === undefined ? [] : [{ kind, value: Math.round((m.value - 1) * 100), endsAt: m.expiresAt! }];
  });

/**
 * START A BOOST AT `now`, or extend the one running — it never stacks
 * (Docs/proposals/inventory.md §3.3). A modifier, because it happened to the
 * kingdom and expires; its expiry is a boundary like any other. Rent is
 * priced house by house, so the rate change is repriced at `now`; Mana is
 * accrued to `now` first, so the new rate starts there and not at the last
 * advance.
 */
function startBoost(state: GameState, def: ItemDef, n: number, now: number): void {
  const kind = def.boost!;
  const work = (): void => {
    accrueMana(state, now);
    const running = runningBoost(state, kind);
    const length = def.seconds * 1000 * n;
    if (running !== undefined) {
      running.expiresAt = Math.max(running.expiresAt!, now) + length;
      // A stronger boost of the same kind lifts the running one; a weaker one
      // only extends it.
      running.value = Math.max(running.value, 1 + def.value / 100);
      return;
    }
    state.modifiers = state.modifiers.filter((m) => m.id !== `boost:${kind}`);
    addModifier(state, {
      id: `boost:${kind}`, source: 'item', stat: BOOST_STAT[kind], scope: null,
      op: 'mul', value: 1 + def.value / 100, expiresAt: now + length,
    });
  };
  if (kind === 'Rent') repriceTaxAnchorAround(state, now, work);
  else work();
}

export type UseItemResult = 'Used' | 'NotHeld' | 'UnknownItem' | 'UsedElsewhere' | 'NeedsACoin';

/**
 * Use `n` of an item at `now`. A chest pays `n` times what one pays: it lands
 * in the wallet, not in a store, so a second chest reads the same rate as the
 * first and Use ×N is exactly N single uses. A choice chest pays the coin
 * `choice` names. A boost starts or extends; a flask fills the pool, what
 * goes over the cap lost; a tome's Knowledge lands over the bar's cap.
 */
export function useItem(state: GameState, id: ItemId, n: number, now: number, choice?: CurrencyId): UseItemResult {
  const def = ITEMS[id];
  if (def === undefined) return 'UnknownItem';
  // A speed-up is used ON a timer (sim/speedups.ts), a key on its banner's
  // call (heroes.ts) — never from the Bag alone.
  if (def.kind === 'speedup' || def.kind === 'key') return 'UsedElsewhere';
  if (def.kind === 'choice' && (choice === undefined || !CHEST_COINS.includes(choice))) return 'NeedsACoin';
  if (!(n >= 1) || !Number.isInteger(n) || itemCount(state, id) < n) return 'NotHeld';
  if (def.kind === 'chest' || def.kind === 'choice') {
    const one = chestValue(state, id, choice);
    for (const [c, amount] of Object.entries(one) as Array<[CurrencyId, number]>) {
      addToWallet(state.city.wallet, c, amount * n);
    }
  } else if (def.kind === 'boost') {
    startBoost(state, def, n, now);
  } else if (def.kind === 'flask') {
    accrueMana(state, now);
    addMana(state, Math.floor((manaCap(state) * def.value * n) / 100));
  } else if (def.kind === 'tome') {
    payKnowledge(state, def.value * n);
  }
  const left = itemCount(state, id) - n;
  if (left > 0) state.bag.held[id] = left;
  else {
    delete state.bag.held[id];
    delete state.bag.fresh[id];
  }
  recordEvent(state, { kind: 'itemUsed', count: n });
  track(state, 'item_used', { item: id, count: n, ...(choice !== undefined ? { coin: choice } : {}) });
  return 'Used';
}

/** Take `n` of an item out of the Bag for what spends it — a key on a pull.
 *  False, and nothing taken, when it holds fewer. */
export function takeItem(state: GameState, id: ItemId, n: number): boolean {
  if (itemCount(state, id) < n) return false;
  const left = itemCount(state, id) - n;
  if (left > 0) state.bag.held[id] = left;
  else {
    delete state.bag.held[id];
    delete state.bag.fresh[id];
  }
  return true;
}

/** The tile was tapped: it is no longer new. */
export function markItemSeen(state: GameState, id: ItemId): void {
  delete state.bag.fresh[id];
}

/** The Bag was opened: the nav's orb clears. */
export function markBagOpened(state: GameState): void {
  state.bag.badge = 0;
}
