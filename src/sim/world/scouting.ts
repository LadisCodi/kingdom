// Scouting rewards (Docs/features/19-world-map.md §3.2): what exploring a hex
// pays, promised over it while it is misty.
//
// ROLLED WITH THE BOARD, so a hex's promise is a fact about the board
// (`BoardHex.scout`). PAID WHEN THE EXPLORER SENT TO IT IS HOME — the one
// boundary a trip already has — and only for its target: the hexes revealed
// round it pay nothing, and a hex revealed any other way loses its promise.
// Gold, Wood, Food and Stone are priced then, in hours of the city's own
// production (`tap.workSeconds`'s rule), floored at the authored amount.

import { WORLD_SCOUTING, type PackTier, type ScoutRewardDef } from '../data/definitions';
import { cityGoldPerSecond, grantPack } from '../collection';
import { addHeroXp } from '../heroes';
import { payKnowledge } from '../knowledge';
import { addToWallet, type GameState, type Wallet } from '../state';
import { cityGatherPerSecond } from '../upgrades';
import type { BoardHex } from './board';

/** What a hex's promise pays at this moment: a wallet, or a pack. */
export type ScoutPay = { wallet: Wallet; pack: PackTier | null };

/** What `scout` on a hex of `role` would pay if the explorer came home now. */
export function scoutPay(state: GameState, scout: ScoutRewardDef, role: BoardHex['role']): ScoutPay {
  if (scout.reward === 'Pack') return { wallet: {}, pack: scout.pack };
  if (scout.reward === 'Gold' || scout.reward === 'Wood' || scout.reward === 'Food' || scout.reward === 'Stone') {
    const hours = role === 'portal' ? 0 : WORLD_SCOUTING.hoursByRole[role];
    const rate = scout.reward === 'Gold' ? cityGoldPerSecond(state) : cityGatherPerSecond(state, scout.reward);
    return { wallet: { [scout.reward]: Math.round(Math.max(scout.amount, rate * hours * 3600)) }, pack: null };
  }
  return { wallet: { [scout.reward]: scout.amount }, pack: null };
}

/** Pay a hex's promise into the purses it belongs to; returns what it paid. */
export function payScout(state: GameState, bh: BoardHex): ScoutPay | null {
  if (bh.scout === null) return null;
  const pay = scoutPay(state, bh.scout, bh.role);
  for (const [c, n] of Object.entries(pay.wallet) as Array<[keyof Wallet, number]>) {
    if (c === 'Knowledge') payKnowledge(state, n);
    else if (c === 'HeroXp') addHeroXp(state, n);
    else if (c === 'Stardust') addToWallet(state.kingdom.wallet, c, n);
    else if (c === 'Gems') addToWallet(state.player.wallet, c, n);
    else addToWallet(state.city.wallet, c, n);
  }
  if (pay.pack !== null) grantPack(state, pay.pack, 'scouting');
  return pay;
}
