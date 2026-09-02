# Quests

A single chain of quests (workbook `Quests` sheet, row order = chain order)
guides the opening and pays out resources — mainly Gold, which doubles as
the fog-reveal budget in an economy that starts with none. One quest is
active at a time; completing it lights the quest pill's **Claim**, which
pays the reward and activates the next.

## Absolute vs relative — decided by the goal TYPE

- **Absolute** goals are predicates over current state: "Have 2 Housing",
  "Townhall at level 2", "10 Wood in stock". Work done BEFORE the quest
  activates counts fully — a fast player is never dead-ended by having
  already done the thing (the quest simply completes on activation).
- **Relative** goals count events from activation only: "Collect 30 Gold",
  "Reveal 6 cells". They hook the sim's own income/tap/reveal/sale paths
  (`recordQuestEvent` in `src/sim/quests.ts`), so offline replay feeds them
  too.

Types: BuildDistrict(district, n) · UpgradeDistrict(district, n, level) ·
HoldResource(currency, n) · ReachPopulation(n) · CompleteTech(tech) ·
CompleteTechs(n) · AssignWorkers(n) · TrainArmy(n) — absolute;
ClaimLandmarks(n) · ReachDepth(n) · ClearRuins(n) · OwnArtifacts(n) ·
OwnHeroes(n) · BuyUpgrade(upgrade, level) — absolute;
CollectResource(currency, n) · CollectTaps(n) · DiscoverCells(n) ·
DiscoverFeature(feature, n) · SellGoods(n) — relative.

**DiscoverFeature** is what quest 1 uses, and a DiscoverCells that cares WHAT
it uncovered:
`goal_target` is a map feature (`Trees`, `BerryBush`, `WildAnimals`, `Rocks`,
`FishShoal`, `IronVein`). "Clear five cells" can be satisfied in any direction,
so it teaches the verb and nothing else; "clear two with forest on them" is a
**heading**, which is what the opening needs. The quest hint points at a dark
cell that actually has the thing on it, falling back to the nearest frontier
cell when none is in sight yet — because then the answer is still "go and
explore".

Two things follow from it being relative, like every other Discover goal:
forest cleared before the quest activates does not pay for it, and the feature
is carried ON the reveal event rather than looked up later — so draining a
finite bush minutes afterwards cannot retroactively un-complete the quest.

Design notes baked into the onboarding chain: beats OVERLAP on purpose. The 25
Wood quest 3 asks the player to chop is the Wood quests 4 and 11 ask them to
spend, so "collect it" and "spend it" are one action rather than two errands.

## Changes from 2026-09-02

**Gem rewards are rebalanced.** The chain pays 15 Gems and the game grants 10 at
start — 25 total against 40 needed for both research slots alone, so
`research.max_slots: 3` was unreachable. `balancing-v2.md` §1.3 adds recurring
faucets (10 Gems per ruin first-cleared, 5 per weekly Conjunction) because this
pass adds three more Gem sinks: attunement slots, party slots and gacha pulls.

**The chain gains a tail.** Quest 27 (`GrandCapital`, Townhall 3) was the end of
content. New goal types are needed for the systems in
[`magic.md`](magic.md) and [`expeditions.md`](expeditions.md) — claiming a
landmark, clearing a ruin's first depth, attuning an artifact, reaching a given
delve depth. All four are **absolute** goals in the sense §"Absolute vs relative"
defines, so work done before the quest activates counts, and a player who
explored ahead is never dead-ended.

## Changes from 2026-09-02 (the onboarding rewrite)

The chain was reordered and extended to **50 quests** to match
[`../onboarding.md`](../onboarding.md), which is now the authored first-user
experience and the thing `tests/quests.test.ts` asserts beat by beat.

The headline change is what the game opens on. It used to open on a **tap**
("tap the forest 5 times"); it now opens on the **fog** — clearing cells is
what pays the Knowledge that buys Forestry, and Forestry is what opens the
trees. That closes a loop the old opening never had: exploring, researching
and gathering are one sequence rather than three parallel tutorials.

Two goal types were added for beats the sim could not express: **BuyUpgrade**
(step 20 asks the player to buy Surveying twice) and **OwnHeroes** (step 25,
the free first summon).

The Market, the Quarry, the Mine and Townhall 3 moved **out** of the tutorial
to quests 32+; **Townhall 2 stayed woven in** at quest 17, because the TH1
building cap (2 Houses, 1 Sawmill) is reached at quest 20 and a tutorial that
walls the player in is not a tutorial.

`tests/onboarding.test.ts` plays steps 1-14 through the real sim with **no
`fund()` at all** — the only resources it spends are the ones the opening
grants and the ones it earns. Every dead end in an onboarding is an arithmetic
failure between two numbers authored in different sheets, and neither side's
own unit test can see it. That test found two: the crop plot cost more than a
House (20 Wood → 10), and the first chopping quest asked for less Wood than
the next two beats spend (10 → 25).

## Sheet columns

`id, name, description, goal_type, goal_target, goal_amount, goal_level,
reward_gold, reward_wood, reward_food, reward_stone, reward_iron,
reward_gems, reward_knowledge` — `reward_knowledge` is kingdom-scoped, so it
sits outside the `reward` wallet ([`knowledge.md`](knowledge.md));
goal_target is a DistrictId/TechId/CurrencyId depending on the type (the
importer validates); `goal_level` only on UpgradeDistrict ("Upgrade 3
Houses to lvl 2" = target Housing, amount 3, level 2).

## UI

`src/ui/questPill.ts`: a pill under the header ("📜 Timber! 4/10") that
pulses when complete; tapping expands a card with description, progress
bar, reward, and the Claim button. The pill disappears when the chain ends.
State is `{ index, progress }` (save module `kingdom.quests`).
