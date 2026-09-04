// The Gem faucet, budgeted once and then argued from prose twice.
//
// `Docs/features/12-quests.md` §2.2 set the up-front budget at **75 Gems**. The
// 2026-09-02 competitive review then reported the faucet had overshot it to
// 110, because eleven quests were given Gem rewards without re-deriving the
// total, and filed it as backlog gap 3.
//
// Reading the workbook settles it: the chain pays 15 Gems from four quests,
// not 110, so the faucet is exactly 75 and the review had it backwards
// (Docs/features/12-quests.md §2.2). This file is the point of that
// exercise. The number has now been derived from the data twice, by two
// different people, to answer the same question — so it stops living in
// prose and becomes an assertion. The next drift is a red test rather than
// an afternoon of doc archaeology.
//
// Deliberately NOT a lower bound: raising the faucet is a real design move
// and should have to come here and say so, next to the budget it changes.
import { describe, expect, it } from 'vitest';
import { CURRENCIES, DELVE, KINGDOM_DEF, QUESTS, RUINS } from '../src/sim/data/definitions';

/** `Docs/features/12-quests.md` §2.2, rescaled 2026-09-04 to the Gem ladder
 *  (500 Gems to the dollar, 14-monetization.md §2.2): 500 to start, 750 across
 *  the chain, 2,500 from first clears. The number every source below has to
 *  add up to. */
const GEM_BUDGET = 3750;

// Gems are PLAYER-scoped, so the opening grant is the currency's own `start`
// and not part of `city.initialCurrencies` — which is the sort of thing that
// makes a faucet total easy to add up wrong by hand.
const startingGems = () => CURRENCIES.Gems.start;
const questGems = () => QUESTS.reduce((n, q) => n + (q.rewardGems ?? 0), 0);
const ruinGems = () => Object.keys(RUINS).length * DELVE.firstClearGems;

describe('the up-front Gem faucet', () => {
  it('adds up to the authored budget', () => {
    expect(startingGems() + questGems() + ruinGems()).toBe(GEM_BUDGET);
  });

  // The split matters as much as the total: it is what decides whether the
  // Gem sinks are reachable by play or only by a wallet.
  it('is 500 to start, 750 across the quest chain, 2,500 from first clears', () => {
    expect(startingGems()).toBe(500);
    expect(questGems()).toBe(750);
    expect(ruinGems()).toBe(2500);
  });

  // Every Gem sink is invisible for the whole first session because of this,
  // which is why the daily chest's week markers are Phase 1 and not later
  // (Docs/features/12-quests.md §2.2 and §4). If the shape changes, the argument
  // for that ordering changes with it.
  it('pays its quest Gems late, from a handful of quests', () => {
    const paying = QUESTS.map((q, i) => ({ i, gems: q.rewardGems ?? 0 }))
      .filter((q) => q.gems > 0);
    expect(paying).toHaveLength(4);
    // None of them inside the opening run of the chain.
    expect(Math.min(...paying.map((q) => q.i))).toBeGreaterThan(10);
  });
});

describe('the Gem sinks the faucet has to reach', () => {
  // Promise 3: every paid ladder is earned FIRST. Since the sinks were priced
  // to the Gem ladder (2026-09-04) the up-front faucet no longer buys every
  // slot by play — it buys the second builder and a pull, and the rest comes
  // at a rung a month from the daily chest. What it must always reach is the
  // first rung of the ladder a new player meets: the second builder.
  it('leaves the second builder reachable without a purchase', () => {
    expect(startingGems() + questGems() + ruinGems())
      .toBeGreaterThanOrEqual(KINGDOM_DEF.builderGemCostBase);
  });
});
