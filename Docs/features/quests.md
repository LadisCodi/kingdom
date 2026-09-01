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
CollectResource(currency, n) · CollectTaps(n) · DiscoverCells(n) ·
SellGoods(n) — relative.

Design notes baked into the onboarding chain: quest 1 (tap 5 times) and
quest 2 (stockpile 10 Wood) overlap 100% — quest 2 is HoldResource, not
CollectResource, precisely so the tutorial taps count. "Pick a route" uses
CompleteTechs so the farm/fish fork stays the player's choice.

## Sheet columns

`id, name, description, goal_type, goal_target, goal_amount, goal_level,
reward_gold, reward_wood, reward_food, reward_stone, reward_iron` —
goal_target is a DistrictId/TechId/CurrencyId depending on the type (the
importer validates); `goal_level` only on UpgradeDistrict ("Upgrade 3
Houses to lvl 2" = target Housing, amount 3, level 2).

## UI

`src/ui/questPill.ts`: a pill under the header ("📜 Timber! 4/10") that
pulses when complete; tapping expands a card with description, progress
bar, reward, and the Claim button. The pill disappears when the chain ends.
State is `{ index, progress }` (save module `kingdom.quests`).
