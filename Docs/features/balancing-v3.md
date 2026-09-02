# Balancing v3 — firm ground before the MVP

> Phase 0 of [`../road-to-mvp.md`](../road-to-mvp.md). Third deliberate balance
> pass, following `balancing-v1.md` and `balancing-v2.md`.
>
> It does **one** job: make the documentation agree with the workbook, so that
> the four pillars the MVP adds can be balanced on top of numbers that only
> exist once. **Status: BUILT 2026-09-02.** Every action below is applied; the
> exit gate in §8 is met. Two things outlived the pass and are recorded as
> open questions rather than fixed: the Mana-refill price and when to re-derive
> the tree's Gold.
>
> The 2026-09-02 competitive review listed five numeric contradictions as
> blockers. **Reading `src/sim/data/balance.json` resolves three of them
> outright and reverses one** — the code is right and the prose is stale. That
> is a much cheaper Phase 0 than the review assumed, and it is written up here
> so nobody spends a week re-deriving numbers that are already correct.

## The rule this pass follows

`balance/balance.xlsx` **is** the source of truth; `balance.json` is generated
from it by `npm run balance`. So where a doc and the workbook disagree, the
workbook wins and the doc gets corrected — unless the workbook value is
provably wrong, in which case the workbook changes and the doc records why.
Editing `balance.json` by hand is silently overwritten.

Every figure quoted below was read from `src/sim/data/balance.json` on
2026-09-02.

---

## 1. Mana — resolved. The docs are stale in two places, the workbook is right.

`magic.md` carries three incompatible number sets and the review flagged it as
the blocker with the widest blast radius. The workbook has only one:

```
mana.productionPerTownhallLevel  [10, 13, 16]   /h
mana.baseCapPerTownhallLevel     [100, 130, 160]
mana.sanctumCapPerLevel          [24, 48, 72]
mana.landmarkCap                 10             per sanctuary
mana.gemRefillPerGem             4              Mana per Gem
tap.manaCost                     1
tap.boostSeconds                 45
```

That is the `magic.md` §1 "retuned 2026-09-02" series, exactly. Fill time is
**10 h at every Townhall level**, deliberately past the 8 h offline cap, which
is the property that keeps the pool a *spend* budget rather than an absence
budget.

**Actions.**

1. **Delete** the "the initial cap went to 50 / 12.5 h refill" paragraph in
   `magic.md` §1. It describes a state the workbook left behind.
2. **Replace** the §6 tunables table (production 4/5/6, cap 24/32/40, Sanctum
   +12×3) with the values above. It is the oldest of the three and the one most
   likely to be copied by someone in a hurry.
3. **Keep** the note that the tuning law `cap ≈ 8 × net regen` is **suspended**,
   and keep the reason, because it is the single most load-bearing sentence in
   the monetisation design: the pool has to be able to run dry or a refill has
   nothing to sell. Restate it as a decision rather than as an anomaly.
4. **Delete** the net-regen formula's upkeep term and the per-artifact `Upkeep`
   column in §1–§2. Upkeep was removed on 2026-09-02; the formula still
   subtracts it and `heroes-and-gacha.md` §2 still builds the attune-or-arm
   argument on "attuning costs Mana every hour". Attune-or-arm survives on
   exclusivity alone and the doc should say so.

**Not a doc fix — a real open question this exposed.** `mana.gemRefillPerGem`
is 4, so refilling a 160-cap pool from empty is 40 Gems, against a gacha pull
at 30. A refill is currently a *more expensive* purchase than a hero pull.
That may be correct (it is consumable against permanent) but it has never been
argued. → decision for [`monetization-sim.md`](monetization-sim.md).

## 2. The tech tree — resolved. It is 24 techs and 6,600 Gold.

`research-and-upgrades.md` says 20 techs; `currency-simplification.md` §3 says
24 for 6,600 Gold. The workbook settles it: **24 technology rows summing to
exactly 6,600 Gold.**

**Action.** Correct the "6 of 20 techs hang off Forestry" sentence in
`research-and-upgrades.md` to 24, and re-check the fraction while there.

**And the finding that matters more than the count.** The quest chain pays
**11,765 Gold** against a tree that costs 6,600. The tree is not a sink; it is
a formality that the chain funds twice over. That is not a Phase 0 fix — it is
the argument for eras in `../road-to-mvp.md` §9 — but it should be recorded as
the measured number rather than an impression.

| | Gold |
|---|---|
| Whole technology tree, 24 techs | 6,600 |
| Quest chain rewards, 49 quests | **11,765** |
| Ratio | **1.78×** |

> Measured at 12,075 on 2026-09-02. It fell to 11,765 the next day when the
> two Market beats moved into the opening and were re-priced to their new
> position (`../onboarding.md`, steps 13-14). Held by `tests/quests.test.ts`,
> so the next move has to come here and say so.

## 3. The Gem faucet — resolved, and the review had it backwards.

`balancing-v2.md` §Status and backlog gap 3 both say the faucet overshot its
budget by ~50%: 110 against 75, because eleven new quests were given Gem
rewards without re-deriving the total.

**The workbook says the quest chain pays 15 Gems, from four quests.** So:

| Source | Gems | Where |
|---|---|---|
| Starting grant | 10 | `currencies.Gems.start` — Gems are PLAYER-scoped, so this is not in `city.initialCurrencies` |
| Quest chain | **15** | quests #17 *A proper capital* 3 · #31 *Into the dark* 3 · #41 *A grand capital* 5 · #49 *The Reliquary* 4 (`rewardGems`, a field of its own — not part of `reward`) |
| Ruin first clears | 50 | `delve.firstClearGems` 10 × 5 ruins |
| **Total up front** | **75** | |
| Conjunction, weekly | 5 | `CONJUNCTION_BOONS[*].gems` — every boon pays the same 5 |

> Two shapes worth naming, because both are how a hand-derived total goes
> wrong: Gem rewards live in `rewardGems` beside `reward`, not inside it, and
> the opening grant is a currency's `start` rather than a city currency. Add
> them up from the wrong two places and you get 65, or 0. `tests/faucet.test.ts`
> reads them the way the game does.

**75, which is exactly the §1.3 budget.** Either the over-authoring was
corrected and the doc was not, or it never happened. Against the sinks —
research slot 2 at 10 Gems and slot 3 at 30 (`slotGemCostBase` 10,
`slotGemCostGrowth` 3) — `research.maxSlots: 3` is now reachable by play, which
was the original complaint.

**Actions.** Strike gap 3 from the backlog in `00-design-intent.md`, correct
`balancing-v2.md` §Status, and — the useful part — **write the faucet total
into a test.** This is the second time this number has been argued from prose.
A single assertion that the authored faucet equals the budgeted faucet turns
the next drift into a red test instead of a doc archaeology session.

**A real gap this uncovered.** The chain's Gem rewards are concentrated in four
late quests. A player who stops at quest 20 has the 10 they started with. Every
Gem sink is therefore invisible for the whole first session, which is fine for
slots but not for the store the MVP wants to instrument. → the daily chest's
week markers in [`habit-loop.md`](habit-loop.md) are the fix, and that is why
they are in Phase 1 rather than later.

## 4. The Townhall cycle — still contradictory. Needs a person, not a lookup.

`harvest-loop.md` §2 says `cycleSeconds` 60 and `tapBoostSeconds` 1; its own §7
table says 10 and 2. The workbook has neither key, because the tax cycle was
superseded twice: first by a per-building cycle, then by Mana. What it has is:

```
taxes.goldPerPopulationPerMinute  30
training.seconds                  20
training.tapBoostSeconds          2
tap.boostSeconds                  45   (every tap in the game, houses included)
```

So the cycle is gone and the §2/§7 disagreement is describing a mechanic that no
longer exists. **Action:** rewrite `harvest-loop.md` §2's Townhall paragraph and
§7's row to point at `tap.boostSeconds` and note that
`taxes.tap_boost_seconds` was folded into it, as `ad-economy.md` §1 already
records. Nothing to re-tune; something to stop misleading readers.

**While in there, one number to sanity-check against `balancing-v1.md`.**
`goldPerPopulationPerMinute` is 30 with `population_capacity [1, 2]`, so a
Townhall-1 city with two Houses at level 1 is 2 villagers ≈ 60 Gold/min — which
is the "TH1 ≈ 60 g/min idle" figure `balancing-v1.md` derives. **That doc's
income tables are annotated as corrected but were never recomputed** (backlog
gap 9). They are apparently right. Recompute once and drop the annotation.

## 5. `kingdom.maxBuilders` — the dead dial worth the most

```
kingdom.startBuilders  1
kingdom.maxBuilders    4
```

`scripts/balance.mjs` maps the column, the workbook authors 4, and **nothing in
`src/` ever raises it above 1** — and both gates in `commands.ts` test
`city.buildQueueCapacity` (1) rather than the builder count, so in practice
exactly one build or upgrade at a time, forever.

> **Correction, same day.** This section originally added "so every promotion
> path in `queue.ts` is unreachable", implying that turning the dial on would
> make it reachable. It does not: **there is no waiting line in this game.** A
> build either starts because a builder is free or it does not start at all,
> so the jobs in flight are exactly the builder count and the promotion branch
> stays unreachable *by design*. `city.build_queue_capacity` is not a second
> dial to reconcile with the builder count — it is a duplicate of it, and it
> has been removed from the workbook. See
> [`builders.md`](builders.md) §1.

The competitive review filed this as backlog "gap 9, smaller". It is not
smaller. **A second builder is the best-documented conversion surface in the
whole 4X set** — Whiteout sells it as the Construction Queue Pack with a 15
minute free trial, Last War hands it out at VIP 6 — and it is exactly the
purchase design pillar 3 authorises: *comfort and breadth, never access*. It
unlocks nothing; it makes two things happen at once.

**Action in this pass:** make the dial live — a builder count that reads from
state, a jobs-in-flight limit that follows it, and one way to raise it.

**Scope grew, deliberately.** The plan said "Phase 0: a dev-bar toggle;
Phase 3: the store card". It shipped with the **priced Gem purchase and the
popup that raises it**, because the refusal is where a second builder means
something and a dev toggle answers no question a playtester can be asked. The
store *card* is still Phase 3; this is the offer, not the shop. Full design in
[`builders.md`](builders.md).

## 6. Two doc gaps that are not contradictions

Neither blocks Phase 0. Both are cheap and both bite the moment someone reasons
about the game from the docs alone.

- **The gacha rates are in the workbook and in no document.**
  `heroes-and-gacha.md` §4 promises "a guaranteed hero within N pulls, with soft
  pity before it" and never gives N. The workbook does:

  ```
  gacha.pullGemCost      30
  gacha.heroChance       0.06
  gacha.softPityAt       40
  gacha.hardPityAt       60
  gacha.duplicateFragments 20
  gacha.fragmentsPerMiss   3
  gacha.pullKnowledge     50
  ```

  Write them into §4. A pity table that only exists in a spreadsheet cannot be
  reviewed, and `heroes-and-gacha.md` §6 says rates are shown "plainly" on the
  banner screen — which is a promise to players that the design doc should be
  able to back.

- **The collection's tier ceiling is specified after all.**
  `collection.maxTier` 5, `levelsPerTier` 2, `maxLevel` 10,
  `fragmentsPerTierBase` 10 with growth 2. The review noted the tier caps were
  undocumented; they are authored, they just are not written down. Add the table
  to `heroes-and-gacha.md` §2.

## 7. Nothing else changes in this pass

Explicitly out of scope, so the pass stays a day and not a month: the 50 % haul
loss (playtest, not argument), the ten-progression-systems risk (a scope
decision, `../road-to-mvp.md` §8 decision 11), the adjacency table (one row, and
deliberately post-MVP), the `Desert` terrain with zero cells, and any re-tuning
of the Mana pool itself.

## 8. Exit gate — met 2026-09-02

| Gate | Evidence |
|---|---|
| `npm test` green | 41 suites, 556 tests |
| Every dial named above has exactly one value findable in one place | §1 §2 §4 §6 applied; `magic.md` §6 now carries the authored values and says so |
| Backlog gap 3 struck | `00-design-intent.md` gap 3, struck with the derivation |
| Gap 9 split | gap 9 closed (builders), 9a `?dev=kit` gallery still open, 9b v1 tables recomputed and holding |
| One new test asserting the faucet equals its budget | `tests/faucet.test.ts` — 4 assertions, including the *shape* of the payout, because the ordering argument in §3 depends on it |
| `maxBuilders` reachable | `tests/builders.test.ts` — 14 assertions, including the price curve and the refusal |

### What changed in the code

Only §5 needed any. Three edits and a dev-bar button:

- `state.kingdom.maxBuilders` → **`state.kingdom.builders`**. The old name
  collided with `KINGDOM_DEF.maxBuilders` (the authored *ceiling*, 4), and a
  field called `maxBuilders` holding 1 is exactly why nobody noticed the dial
  was dead. The save DTO key stays `MaxBuilders`, so **no migrator**.
- **`buildQueueCapacity(state)`** in `state.ts`, and both gates in
  `commands.ts` now call it. They tested the bare `CITY_DEF.buildQueueCapacity`
  constant, so a kingdom with four builders still could not queue a second job
  — every promotion path in `queue.ts` was unreachable. The authored dial is
  the floor; the builder count raises it.
- **`grantBuilder(state)`**, deliberately free and unpriced. Phase 0's job is
  to make the dial reachable; what a builder *costs* is a store question and
  the store is Phase 3.
- `?dev` gains **👷 +1 builder**, which is the "one way to raise it" §5 asked
  for.

### What was left alone on purpose

- **The doc-vs-doc `3,630` → `3,612`** rounding was corrected across four files
  while in there, because this pass had just introduced the exact figure and
  leaving both would have created the very contradiction it exists to remove.
- Nothing in §7 was touched.
- Neither open question below was answered. Both need a decision, not a
  lookup, and both belong to a later phase's doc.

## Open questions

- **Is a full Mana refill really worth more than a hero pull?** 40 Gems against
  30 (§1). It is the first price in the game that a player can compare, so it is
  the first one that can feel wrong.
- **Should the tree's Gold cost be re-derived now or with eras?** It is
  currently 55 % of what the quest chain pays. Re-pricing it in Phase 0 is a
  one-line change to 24 rows; doing it with eras is doing it once. Leaning
  toward: leave it, and let the measured 1.83× be the argument for eras.
