// The daily chest, and a streak that cannot be lost.
//
// THE LADDER ADVANCES ON DAYS PLAYED, NEVER ON CALENDAR DAYS. Step 1 the first
// day you open the game, step 2 the second day you open it, whether that is
// tomorrow or in three weeks. Missing a day costs you that day's chest — an
// opportunity that expired — and nothing else.
//
// That is not a softer version of a login streak, it is a different mechanic,
// and the reason is promise 1: *nothing you own is ever taken from you*. A
// conventional streak resets to zero on a missed day, which is a confiscation
// of accumulated progress and precisely what makes a cozy game read as an
// obligation. It also deletes a whole class of bug — a timezone, a clock
// change or a device swap can no longer eat someone's ladder — and it means
// the feature never needs a "streak repair" purchase, the ugliest SKU in the
// genre.
//
// WHY THIS IS NOT A BOUNDARY SOURCE, and the argument is `adOffers.ts`'s
// verbatim: a daily timer registered in `advance()` would propose a boundary
// per day across a long absence for no simulation benefit, and the tail
// advance in save.ts is uncapped. Nothing in the sim reads the chest; claiming
// is always a live player command. So `advance()` never touches it.
//
// Docs/features/12-quests.md §4.

import { DAILY } from './data/definitions';
import { addToWallet, getWallet, type GameState, type Wallet } from './state';
import { manaCap } from './mana';
import { effectiveTaxRate } from './upgrades';

/**
 * Which day an instant falls in.
 *
 * Derived from the instant every time, never stored as a counter that
 * something has to remember to increment — the same pull-based rule as
 * `isActive(m, state.lastAdvance)` and `recoverIfDue`, so a throttled tab or a
 * three-week absence resolves to the right number instead of drifting.
 *
 * UTC, deliberately. A local-midnight rollover would make the ladder depend on
 * where the device thinks it is, so a player crossing a timezone could claim
 * twice in a day or lose one — and the sim is not allowed to read anything
 * that is not passed in. The cost is that "a new day" arrives at a different
 * wall-clock hour for different players, which for a mechanic that never
 * punishes a miss is a cost of nothing.
 */
export const dayIndex = (t: number): number => Math.floor(t / 86_400_000);

/** How long the ladder is, from the authored data rather than a constant. */
export const ladderLength = (): number => DAILY.manaFractions.length;

/**
 * The step a claim right now would pay — 1-based, and it cycles.
 *
 * `ladderStep` counts days PLAYED, so this is where that count lands on a
 * ladder that repeats: step 7 is the week marker, step 8 is step 1 again.
 */
export function nextStep(state: GameState): number {
  return (state.kingdom.daily.ladderStep % ladderLength()) + 1;
}

export const chestAvailable = (state: GameState, now: number): boolean =>
  state.kingdom.daily.lastClaimedDay !== dayIndex(now);

/**
 * What step `step` pays, for this city, right now.
 *
 * Mana is a FRACTION of the pool and Gold is SECONDS of the city's own tax
 * income, both for the reason `tap.workSeconds` exists: a reward priced in
 * the player's own production is worth the same fraction of progress at every
 * stage of the game, with nothing re-derived per era
 * (`Docs/README.md` — working rule 2). An absolute Gold number in a spreadsheet goes
 * stale on its own by era three.
 */
export function chestReward(state: GameState, step: number): Wallet {
  const i = Math.max(0, Math.min(ladderLength() - 1, step - 1));
  const reward: Wallet = {};

  const manaFraction = DAILY.manaFractions[i] ?? 0;
  if (manaFraction > 0) reward.Mana = Math.round(manaCap(state) * manaFraction);

  const goldSeconds = DAILY.goldSeconds[i] ?? 0;
  if (goldSeconds > 0) {
    // Housed villagers pay the taxes, so this is the city's real rate — and
    // the floor is what stops step 4 paying nothing to a city that has not
    // housed anyone yet.
    const perSecond = (effectiveTaxRate(state) * housedVillagers(state)) / 60;
    reward.Gold = Math.max(DAILY.goldFloor, Math.round(perSecond * goldSeconds));
  }

  const gems = DAILY.gems[i] ?? 0;
  if (gems > 0) reward.Gems = gems;

  return reward;
}

const housedVillagers = (state: GameState): number => state.city.population;

export type ClaimChestResult = 'Claimed' | 'AlreadyClaimed';

/**
 * Take today's chest and advance the ladder one step.
 *
 * `lastClaimedDay` is stamped with today rather than incremented, which is
 * what makes a second claim on the same day impossible however the clock
 * moves — including backwards.
 */
export function claimDailyChest(state: GameState, now: number): ClaimChestResult {
  if (!chestAvailable(state, now)) return 'AlreadyClaimed';
  const step = nextStep(state);
  const reward = chestReward(state, step);

  // Mana lands ON TOP of the cap, like the ad reward and for the same reason:
  // a grant clamped to a ceiling the player is already near would pay nothing
  // and read as broken.
  if (reward.Mana) grantChestMana(state, reward.Mana);
  if (reward.Gold) addToWallet(state.city.wallet, 'Gold', reward.Gold);
  if (reward.Gems) addToWallet(state.player.wallet, 'Gems', reward.Gems);

  state.kingdom.daily.ladderStep += 1;
  state.kingdom.daily.lastClaimedDay = dayIndex(now);
  return 'Claimed';
}

/** Overcharge-safe, exactly as `grantMana` is — re-exported here so the
 *  call site above reads as what it is rather than as a wallet poke. */
function grantChestMana(state: GameState, amount: number): void {
  const before = getWallet(state.city.wallet, 'Mana');
  state.city.wallet.Mana = Math.max(0, before + amount);
}
