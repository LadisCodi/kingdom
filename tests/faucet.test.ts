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
import { CURRENCIES, KINGDOM_DEF, QUESTS } from '../src/sim/data/definitions';

/** `Docs/features/12-quests.md` §2.2, rescaled 2026-09-04 to the Gem ladder
 *  (500 Gems to the dollar, 14-monetization.md §2.2): 500 to start and 750
 *  across the chain. The number every source below has to add up to.
 *
 *  It WAS 3,750, with 2,500 from five ruin first-clears at 500 each. That
 *  source was a bottomed ruin's, and it left with the depths: a ruin is its
 *  gate now, and a gate's first clear pays Knowledge, not Gems. The gap is
 *  ACCEPTED, not compensated (Docs/open-questions.md OQ-111). */
const GEM_BUDGET = 1250;

// Gems are PLAYER-scoped, so the opening grant is the currency's own `start`
// and not part of `city.initialCurrencies` — which is the sort of thing that
// makes a faucet total easy to add up wrong by hand.
const startingGems = () => CURRENCIES.Gems.start;
const questGems = () => QUESTS.reduce((n, q) => n + (q.rewardGems ?? 0), 0);

describe('the up-front Gem faucet', () => {
  it('adds up to the authored budget', () => {
    expect(startingGems() + questGems()).toBe(GEM_BUDGET);
  });

  // The split matters as much as the total: it is what decides whether the
  // Gem sinks are reachable by play or only by a wallet.
  it('is 500 to start and 750 across the quest chain', () => {
    expect(startingGems()).toBe(500);
    expect(questGems()).toBe(750);
  });

  // Every Gem sink is invisible for the whole first session because of this
  // (Docs/features/12-quests.md §2.2). If the shape changes, the argument for
  // that ordering changes with it.
  it('pays its quest Gems late, from a handful of quests', () => {
    const paying = QUESTS.map((q, i) => ({ i, gems: q.rewardGems ?? 0 }))
      .filter((q) => q.gems > 0);
    expect(paying).toHaveLength(4);
    // None of them inside the opening run of the chain.
    expect(Math.min(...paying.map((q) => q.i))).toBeGreaterThan(10);
  });
});

describe('the Gem sinks the faucet has to reach', () => {
  // Promise 3: every paid ladder is earned FIRST. With the ruin first-clear
  // Gems gone (OQ-111) the up-front faucet NO LONGER reaches the second
  // builder by play alone. This
  // asserts the gap rather than hiding it: when OQ-111 is argued and a source
  // comes back, flip it to `toBeGreaterThanOrEqual`.
  it('falls short of the second builder since the ruin Gems left (OQ-111)', () => {
    expect(startingGems() + questGems())
      .toBeLessThan(KINGDOM_DEF.builderGemCostBase);
  });
});
