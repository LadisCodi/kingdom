// TRADING WITH FRIENDS (Docs/features/15-social.md §2.4): what a lot is, what
// may be wished for and given, and what a lot does to the goods it leaves
// and lands in. The wish board itself — who wished what, who filled it —
// is the social server's (socialServer/serve.ts); this file is the part
// both sides agree on, and the part only the player's own save can answer.

import { ARTIFACT_ORDER, TRADE } from './data/definitions';
import { addGood, getGood } from './goods';
import { KEYSTONE, SLOTS, fragmentsOf, isMet, isRestored, slotCount } from './relics';
import { PRECIOUS, type ArtifactId, type GameState, type PreciousId } from './state';

/** One lot: a precious material in a lot of `TRADE.materialLot`, or one
 *  fragment — a piece (slots 0–4) or the keystone (slot 5). */
export type TradeLot =
  | { kind: 'material'; id: PreciousId }
  | { kind: 'fragment'; relic: ArtifactId; slot: number };

/** A lot's name in the server's tables and the client's keys. */
export const lotKey = (l: TradeLot): string =>
  (l.kind === 'material' ? `m:${l.id}` : `f:${l.relic}:${l.slot}`);

export const isKeystone = (l: TradeLot): boolean => l.kind === 'fragment' && l.slot === KEYSTONE;

/** A lot that names something the game has. */
export function validLot(raw: unknown): raw is TradeLot {
  if (raw === null || typeof raw !== 'object') return false;
  const l = raw as Record<string, unknown>;
  if (l.kind === 'material') return (PRECIOUS as readonly unknown[]).includes(l.id);
  if (l.kind === 'fragment') {
    return (ARTIFACT_ORDER as readonly unknown[]).includes(l.relic)
      && Number.isInteger(l.slot) && (l.slot as number) >= 0 && (l.slot as number) < SLOTS;
  }
  return false;
}

/** What may be given for a need: one lot for one lot, a keystone only for a
 *  keystone, never the same thing both ways. */
export const pairs = (need: TradeLot, give: TradeLot): boolean =>
  isKeystone(need) === isKeystone(give) && lotKey(need) !== lotKey(give);

// ------------------------------------------------------------ the player's goods

/** May the player wish for this? A material always; a fragment only if it
 *  is missing — a relic met and not yet restored, none held in that slot. */
export function canNeed(state: GameState, l: TradeLot): boolean {
  if (l.kind === 'material') return true;
  return isMet(state, l.relic) && !isRestored(state, l.relic) && slotCount(state, l.relic, l.slot) === 0;
}

/** Why the player cannot give this lot, or null if they can. A fragment
 *  must be a duplicate — at least two in its slot, one of them found. */
export function giveProblem(state: GameState, l: TradeLot): 'NotEnough' | 'OnlyOne' | 'Bound' | null {
  if (l.kind === 'material') return getGood(state.city.goods, l.id) >= TRADE.materialLot ? null : 'NotEnough';
  const held = slotCount(state, l.relic, l.slot);
  if (held === 0) return 'NotEnough';
  if (held < 2) return 'OnlyOne';
  return (fragmentsOf(state, l.relic).found[l.slot] ?? 0) > 0 ? null : 'Bound';
}

/** Take a lot out of the player's goods. Callers checked `giveProblem`. */
export function takeLot(state: GameState, l: TradeLot): void {
  if (l.kind === 'material') addGood(state.city.goods, l.id, -TRADE.materialLot);
  else {
    const f = (state.relics.held[l.relic] ??= { found: [0, 0, 0, 0, 0, 0], bound: [0, 0, 0, 0, 0, 0] });
    f.found[l.slot] = Math.max(0, (f.found[l.slot] ?? 0) - 1);
  }
}

/** Put a lot into the player's goods. A fragment that came by trade is
 *  found: it may be traded again. */
export function receiveLot(state: GameState, l: TradeLot): void {
  if (l.kind === 'material') addGood(state.city.goods, l.id, TRADE.materialLot);
  else {
    const f = (state.relics.held[l.relic] ??= { found: [0, 0, 0, 0, 0, 0], bound: [0, 0, 0, 0, 0, 0] });
    f.found[l.slot] = (f.found[l.slot] ?? 0) + 1;
  }
}

/** Can the player fill a friend's wish: give what it needs, and take its
 *  stake? A fragment of a relic the player has never met is never handed
 *  to them — the first fragment of every relic is found by play. */
export function fillProblem(state: GameState, need: TradeLot, stake: TradeLot): 'NotEnough' | 'OnlyOne' | 'Bound' | 'Unmet' | null {
  if (stake.kind === 'fragment' && !isMet(state, stake.relic)) return 'Unmet';
  return giveProblem(state, need);
}

/** Every lot the player could wish for, and every lot they could give. */
export function needable(state: GameState): TradeLot[] {
  const out: TradeLot[] = [];
  for (const relic of ARTIFACT_ORDER) {
    for (let slot = 0; slot < SLOTS; slot++) {
      const l: TradeLot = { kind: 'fragment', relic, slot };
      if (canNeed(state, l)) out.push(l);
    }
  }
  for (const id of PRECIOUS) out.push({ kind: 'material', id });
  return out;
}
