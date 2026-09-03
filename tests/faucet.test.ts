// The Gem faucet, budgeted once and then argued from prose twice.
//
// `Docs/features/12-quests.md` §2.3 set the up-front budget at **75 Gems**. The
// 2026-09-02 competitive review then reported the faucet had overshot it to
// 110, because eleven quests were given Gem rewards without re-deriving the
// total, and filed it as backlog gap 3.
//
// Reading the workbook settles it: the chain pays 15 Gems from four quests,
// not 110, so the faucet is exactly 75 and the review had it backwards
// (Docs/features/12-quests.md §2.3). This file is the point of that
// exercise. The number has now been derived from the data twice, by two
// different people, to answer the same question — so it stops living in
// prose and becomes an assertion. The next drift is a red test rather than
// an afternoon of doc archaeology.
//
// Deliberately NOT a lower bound: raising the faucet is a real design move
// and should have to come here and say so, next to the budget it changes.
import { describe, expect, it } from 'vitest';
import { CURRENCIES, DELVE, QUESTS, RUINS } from '../src/sim/data/definitions';

/** `Docs/features/12-quests.md` §2.3. The number every source below has to add up to. */
const GEM_BUDGET = 75;

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
  it('is 10 to start, 15 across the quest chain, 50 from first clears', () => {
    expect(startingGems()).toBe(10);
    expect(questGems()).toBe(15);
    expect(ruinGems()).toBe(50);
  });

  // Every Gem sink is invisible for the whole first session because of this,
  // which is why the daily chest's week markers are Phase 1 and not later
  // (Docs/features/12-quests.md §2.3 and §4). If the shape changes, the argument
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
  // `research.maxSlots` 3 at 10 + 30 Gems was the original complaint behind
  // gap 3: a third scholar that no amount of play could buy.
  it('leaves the third research slot reachable without a purchase', () => {
    expect(startingGems() + questGems() + ruinGems()).toBeGreaterThanOrEqual(10 + 30);
  });
});
