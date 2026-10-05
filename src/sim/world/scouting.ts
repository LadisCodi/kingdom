// Scouting rewards (Docs/features/19-world-map.md §3.2): what exploring a hex
// pays, promised over it while it is misty.
//
// ROLLED WITH THE BOARD, so a hex's promise is a fact about the board
// (`BoardHex.scout`). PAID WHEN THE EXPLORER SENT TO IT IS HOME — the one
// boundary a trip already has — and only for its target: the hexes revealed
// round it pay nothing, and a hex revealed any other way loses its promise.
// Gold, Wood, Food and Stone are priced then, in hours of the city's own
// production (`tap.workSeconds`'s rule), floored at the authored amount.

import { roundPrice } from '../roundPrice';
import { RELIC_RULES, WORLD_SCOUTING, type PackTier, type ScoutRewardDef } from '../data/definitions';
import { dropFragments, openRelicDoor } from '../relics';
import { cityMakesPerSecond } from '../production';
import { addHeroXp } from '../heroes';
import { payKnowledge } from '../knowledge';
import { addGood } from '../goods';
import { addToWallet, type GameState, type GoodsStock, type Wallet } from '../state';
import { lumpMaterial, type BoardHex } from './board';
import { boardOf } from './source';

/** What a hex's promise pays at this moment: a wallet, goods, or a pack. */
export type ScoutPay = { wallet: Wallet; goods: GoodsStock; pack: PackTier | null };

/** What `scout` on hex `index` of `role` would pay if the explorer came home
 *  now. A precious lump is mostly the player's own material (19 §7.4). */
export function scoutPay(state: GameState, scout: ScoutRewardDef, role: BoardHex['role'], index = -1): ScoutPay {
  if (scout.reward === 'Pack') return { wallet: {}, goods: {}, pack: scout.pack };
  if (scout.reward === 'Precious') {
    const board = boardOf(state.world.board);
    const id = lumpMaterial(board, state.world.board.seat, 'scout', index, state.world.board.seat);
    return { wallet: {}, goods: { [id]: scout.amount }, pack: null };
  }
  if (scout.reward === 'Gold' || scout.reward === 'Wood' || scout.reward === 'Food' || scout.reward === 'Stone') {
    const hours = role === 'portal' ? 0 : WORLD_SCOUTING.hoursByRole[role];
    const rate = cityMakesPerSecond(state, scout.reward);
    return { wallet: { [scout.reward]: roundPrice(Math.max(scout.amount, rate * hours * 3600)) }, goods: {}, pack: null };
  }
  return { wallet: { [scout.reward]: scout.amount }, goods: {}, pack: null };
}

/** Pay a hex's promise into the purses it belongs to; returns what it paid. */
export function payScout(state: GameState, bh: BoardHex): ScoutPay | null {
  if (bh.scout === null) return null;
  const pay = scoutPay(state, bh.scout, bh.role, bh.index);
  for (const [c, n] of Object.entries(pay.wallet) as Array<[keyof Wallet, number]>) {
    if (c === 'Knowledge') payKnowledge(state, n);
    else if (c === 'HeroXp') addHeroXp(state, n);
    else if (c === 'Stardust') addToWallet(state.kingdom.wallet, c, n);
    else if (c === 'Gems') addToWallet(state.player.wallet, c, n);
    else addToWallet(state.city.wallet, c, n);
  }
  for (const [g, n] of Object.entries(pay.goods)) addGood(state.city.goods, g as keyof GoodsStock, n as number);
  // A pack a hex promised is world relic fragments now: the scout's door
  // first, then what the pack was worth (Docs/plans/relics-and-bag.md §5).
  if (pay.pack !== null) {
    openRelicDoor(state, 'scouting');
    dropFragments(state, 'world', RELIC_RULES.perPackTier[pay.pack] ?? 1, ['scout', bh.index]);
  }
  return pay;
}
