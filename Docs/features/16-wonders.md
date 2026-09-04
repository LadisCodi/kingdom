# 16 · Wonders — the ladder with no top

> **Scope.** The buildings whose upgrade ladder never ends: the one Gold sink
> in the game with no last level.
>
> **Status: designed, not built.** Late-game content by construction (§5.2), so
> it waits behind work a player meets sooner.
>
> **The three balance numbers are not in this document** (§6, **OQ-58**). The
> workbook owns them; this document owns the concept, the fit and the mechanism.

## 1. The Gold sinks it sits beside

Every other Gold sink is one-time ([`03-economy.md`](03-economy.md) §7):

| Sink | Total | Ceiling |
|---|---|---|
| Landmark claims | **527,000 Gold** | ten landmarks; 2,000 · 25,000 ×5 · 100,000 ×4 |
| The whole map's fog | **194,142 Gold** | a last cell |
| The fifteen upgrades, fully bought | **51,926 Gold** | `maxLevel` on every one; `TapPower` is **34,006** of it (65%, `cost_growth` 1.9 over ten levels) |
| The technology tree, 24 techs | **6,600 Gold** | a last node |
| Buildings and their levels | on a curve | `maxCountPerTownhallLevel`, and `maxLevel` on every district |
| | **≈ 780,000 Gold** | nothing after it |

- Expedition supplies (50 → 2,000 a launch) repeat, but are gated by the army
  cap and delve frequency: a drip, not a sink for a surplus.
- The Market is not a sink: it converts a surplus into Gold.
- A Wonder is the upgrade ladder with `maxLevel` removed, standing on the map.

## 2. What a Wonder is

**A district you place, whose level ladder is a curve rather than a table.**

| | How it expresses a level | Can it be infinite? |
|---|---|---|
| `DistrictDef` | tables — `maxLevel`, `populationCapacityPerLevel`, `maxWorkersPerLevel`, `influenceRadiusPerLevel`, `requiredTownhallLevelPerLevel`, `requiredTechPerLevel`, `armyCapPerLevel`, all indexed by level | no — a table has a last row |
| `UpgradeDef` | formulas — `costBase`, `costGrowth`, `effectPerLevel` | yes — only `maxLevel` stops it |

- From the district: placement, footprint, art, being a thing on the map.
- From the upgrade: the ladder. Level `L` costs `round(costBase × costGrowth^L)`
  Gold and is worth `effectPerLevel × L`.
- **No per-level table anywhere in a Wonder's definition.**
- `District.level` is already a plain number: no state change, no migrator.
  Adding Wonders is additive — new definition rows and a save-version bump.

### 2.1 The shell test

A Wonder is a shell around existing systems (**OQ-6**):

- No currency of its own — Gold.
- No screen of its own — tap it, the district card opens.
- No economy of its own — one number per level, resolved by the helper that
  already owns that number.
- If a Wonder ever needs a second currency or its own menu, it is cut.

## 3. Two rules

Both are structural, not numerical.

### 3.1 A Wonder's effect is never denominated in Gold

- A Wonder that raises `taxRate` is forbidden.
- A production Wonder pays materials; the Market converts materials into Gold,
  so that loop closes through the Market. It is bounded by the ladder's shape
  (§6.1), not by the Market's spread.

### 3.2 One of each; the level is the only ladder

- Hard count cap of **one, ever** — not one per Townhall level.
- Per-level cost restarts at zero for a new copy of a building, so a second
  copy would beat one deep Wonder at every level.
- Invariant: **a Wonder's level is the only way to buy more of its effect.**
  No second copy, no alternative scaling source of the same stat, no bundle.
- There is exactly one Everspring in the world; it is a landmark of the
  player's own city (art: **OQ-57**), and its level is the number on the card
  (§9).

## 4. A level is instant on payment

- A Wonder level does not go through the build queue. It is bought like an
  upgrade and lands the moment it is paid.
- No builder is occupied. `upgradeDuration` and `upgradeDurationLevelGrowth`
  do not apply. This keeps the second-builder offer (OQ-30) and the *no waiting
  line* rule of [`06`](06-construction.md) intact.
- No boundary in `advance()`: nothing scheduled, nothing expiring, no
  `consider()` in `nextBoundary`, no branch in `applyDueAt`.
- A Wonder level is a purchase, not a construction.
- No anticipation beat: no progress bar, nothing to come back for. The pull is
  the next level's visible price (§9).

## 5. The prototype set

Three Wonders. Each effect is a stat that already exists.

| Wonder | Stat | A level buys |
|---|---|---|
| **The Everspring** | `cellRecovery` | the ground regrows faster — the reward-side exit for map density (**OQ-54**) |
| **The Astral Spire** | `manaRegen` | more Mana per hour — more taps |
| **The Bell of Toil** | `workerYield` | the crew strikes harder |

Not in the set:

- A Gold Wonder (§3.1).
- A fog-discount Wonder — relics already do that (**OQ-23**).
- A combat Wonder — the army cap is a city-building decision
  ([`11`](11-expeditions.md)).
- A build-speed Wonder — waits for `buildSpeed` to land as a modifier stat with
  the event archetype ([`implementation-plan.md`](../implementation-plan.md)
  Step 2); one row after that, a code change before it.

Names are a first pass, under the same standing offer as the tome titles
(**OQ-15**).

### 5.1 The building

| | |
|---|---|
| **Houses** | nobody |
| **Employs** | nobody — no crew, no claims, no travel |
| **Area of influence** | none |
| **Footprint** | large — the ground is the permanent half of the price (§8) |
| **Movable** | yes — promise 1 |
| **Count** | one (§3.2) |
| **Destroyed or downgraded** | never — promise 1 |

- A Wonder produces nothing and stores nothing.
- It acts only as a term in another helper's formula (§7).

### 5.2 Unlock gate

- The gate is the Townhall's final level, as for every other district.
- While any one-time sink (§1) is unbought a Wonder is the wrong purchase; the
  gate keeps it out of the build menu until then.
- A Wonder is late-game content; a player who does not reach the last era
  never meets it.

### 5.3 Cosmetic tiers

- The building's art changes every N levels, computed as `L % N`, never from a
  table.
- Tiers have zero economic effect (§3.1).
- This is also the cosmetic probe **OQ-26** asks for.
- Art bill: one tier per Wonder per band (**OQ-57**).

## 6. The shape of the ladder

```
cost(L)   = wonder.cost_base × wonder.cost_growth ^ L      Gold
effect(L) = wonder.effect_per_level × L
```

Two lines, three numbers. The numbers live in the workbook (**OQ-58**); the
shape is fixed here.

### 6.1 Exponential cost, linear effect

- `cost_growth` is the strongest dial in the feature — the analogue of
  `tap.work_seconds`. It decides whether a Wonder is a sink or a formality.
- Cost compounds; effect does not. The marginal level gets worse forever.
- A Wonder is a place to park a surplus, never a Gold investment.
- The Market loop (§3.1) has a payback period of `cost(L)` over a linear
  return, which grows without bound. Whether early levels sit on the wrong side
  of that line is a number (**OQ-58**).

### 6.2 An unbounded effect

- Every reward in this game is priced in a duration of the player's own
  production (a tap pays seconds of work; the daily chest pays a fraction of
  the pool), so doubling output doubles both sides and nothing is trivialised.
- Exceptions priced in absolute Gold: the fog, the technology tree, the
  landmark claims. A deep Wonder trivialises them. Acceptable because all three
  are one-time and bought long before a Wonder is deep; eras re-pricing the
  tree is the answer ([`07-research.md`](07-research.md) §1).
- Anything absolute-priced added after Wonders exist must answer this section.

## 7. Code changes

1. **`maxLevel` stops being a wall.** `commands.ts:179`
   (`if (district.level >= def.maxLevel) return 'AtMaxLevel'`) and
   `upgrades.ts:38`/`:50`. A Wonder's `maxLevel` is absent, not a big number.
2. **Per-level tables are empty for a Wonder** — no population, workers, army
   cap or per-level tech gate. `requiredTechPerLevel` in particular: a Wonder
   is gated once, at unlock.
3. **The level is not drawn as stars.** `districtCard.ts:392` renders
   `levelStars(district.level, def.maxLevel)`, which needs a denominator. A
   Wonder shows a number and the next level's price.
4. **The purchase path is `buyUpgrade`-shaped, not `upgradeDistrict`-shaped**
   (§4): pay, increment, done, no queue item.

Already in place: placement, footprint, moving, the art pipeline, `effect()`,
and the effective helpers that own each stat.

### 7.1 One call site per Wonder

| Wonder | Stat | The one line that reads it |
|---|---|---|
| The Everspring | `cellRecovery` | `src/sim/harvest.ts:88` |
| The Astral Spire | `manaRegen` | `src/sim/mana.ts:61` |
| The Bell of Toil | `workerYield` | `src/sim/upgrades.ts:157` |

- Cost shape: one row plus one call site, as for a modifier stat. The stat
  existing guarantees the helper exists.
- This bounds the set: a fourth Wonder is a row and a line; a tenth is ten
  lines across the sim. Ten Wonders is not ten rows of data (OQ-6, OQ-57).
- Resolution order: base → upgrade levels → modifier stack. **A Wonder level is
  an upgrade level, not a modifier.** The Wonder term goes beside the
  `effect(state, …)` term in each helper, inside the value handed to
  `resolve()` — never as a synthetic entry on the modifier stack.

## 8. The plot

- An endless ladder on a placed building is a decision only while ground is
  scarce.
- This feature depends on **OQ-1** and raises the price of leaving it open, as
  **OQ-48** (adjacency v2) does.

## 9. What the player sees

Tapping a Wonder opens the district card, like any other building. The card
differs in three ways:

1. **The level as a number** — `Lv 27`, with no `/5` denominator.
2. **The next level's price, always shown**, even when unaffordable. It is
   information on the card, not a priced refusal
   ([`06-construction.md`](06-construction.md)).
3. **What the next level adds**, in the same words as the current effect, so
   the flattening (§6.1) is visible.

- No progress bar, no timer, no *ready to collect* (§4).
- A Wonder never generates a notification, never glows, and never asks for
  anything.

## 10. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Cost growth — sink or formality (§6) | unset (**OQ-58**) | `wonder.cost_growth` |
| Cost base — where level 1 lands relative to a building | unset (**OQ-58**) | `wonder.cost_base` |
| Effect per level, per Wonder — how fast the ladder flattens | unset (**OQ-58**) | `wonder.effect_per_level` |
| Unlock gate — the Townhall level that lists each Wonder (§5.2) | final Townhall level | — |
| Footprint — the non-Gold half of the price (§5.1, §8) | large | — |
| The set — one row plus one call site each (§7.1) | three | — |

## 11. Acceptance

- A player who has bought every technology, every upgrade level and every
  landmark still has a priced thing to spend Gold on, and can see its cost.
- A Wonder level adds no boundary: the replay assertion holds across a Wonder
  purchase during an offline advance; `nextBoundary` is untouched.
- No Wonder's effect is denominated in Gold (§3.1), asserted by a test over the
  definitions.
- A second copy cannot be built at any Townhall level (§3.2).
- A deep Wonder renders in the district card without a denominator, with the
  next level's price and what it adds (§9).
- No new wallet row, screen, currency or goal type.

## 12. Deliberately not in this design

- A Wonder that pays Gold (§3.1).
- A second copy of a Wonder (§3.2).
- A level that goes through the build queue (§4).
- A `maxLevel` set to a large number instead of absent (§7).
- A per-level table of any kind.
- A second currency to feed a Wonder (OQ-6).
- Level stars.
- Workers, residents or an area of influence (§5.1).
- A Wonder that is destroyed, downgraded or lost — promise 1.
- A Wonder-specific screen.
- A notification, a glow or anything that asks for attention (§9).
- Donating to another player's Wonder — [`15-social.md`](15-social.md), if at
  all (**OQ-59**).
- A Wonder that unlocks a mechanic rather than scaling a number.
- Prestige, or spending a Wonder for a permanent bonus.
- Generated orders as the repeating Gold sink ([`12-quests.md`](12-quests.md)
  §6).

**Open questions:** **OQ-57**, **OQ-58**, **OQ-59**, **OQ-1** (§8).
