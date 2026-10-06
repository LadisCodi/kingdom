# 11 · Dungeons — depths and rooms

> **Spec.** The depths and rooms of a world-map dungeon
> ([`19-world-map.md`](19-world-map.md) §8.1): where it sits, who may enter
> and how an army camps there is that doc. Combat resolution, unit stats and
> party rules: [`combat.md`](combat.md). Screens:
> [`11a-ruins-ui.md`](11a-ruins-ui.md).
>
> **Status: built on the world board as 3 depths × 8 rooms** with the room
> formula of §6 and §7.1 at tier 1, one shape for every dungeon (`worldDungeon`
> in the world collection). Not built: supplies, the Scout preview, room
> materials, boss chests (§7.2), permanent generation (§7.3) and §4's
> per-ruin content.

## 1. Structure

- **Ruin** → numbered **depths** → numbered **rooms**. One room = one fight.
- Before Depth 1 sits the **gate**: one garrison room with a raid counter,
  cleared once ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
- The last room of a depth is its **boss**.
- Canonical address: `Depth 2 · Room 5`. Persist `depth_index` and
  `room_index`; never a bare `depth`.
- Player progress per ruin: **deepest room reached**. Rooms are cleared in
  order and cannot be replayed.

## 2. Depth config

One `depths` entry per depth, plus two tables.

| Field | Value |
|---|---|
| `rooms` | 8–18 |
| `powerStart`, `powerStep` | Enemy power in room 1, per-room increment |
| `threatMix` | Type weights per room, biased to the ruin's affinity |
| `boss` | Authored formation: squads plus **named villains** in named slots → [`combat.md`](combat.md) §9 |
| `villainPool` | Villains the generator may place in standard rooms of this depth |
| `roomRewards` | one per room; formula default (§7.1), any room overridable |
| `bossReward` | Authored chest (§7.2) |
| `passiveOnComplete` | Stardust/h, XP/h, Gold/h (§7.3) |
| `supplies` | Cost per room attempt in this depth |

### Validation (enforce in `dataRules.ts`)

```
powerStart(D+1)  ≥  powerStart(D) + powerStep(D) × (rooms(D) − 1)
```

## 3. Gates

- **Depth 1 is open** to any army that reaches the dungeon.
- **Depth N+1 opens when depth N's boss falls.** Nothing else gates a depth.

## 4. Launch content

| Dungeon | Tier | Affinity | Depth 1 | Depth 2 | Depth 3 | Rooms | Bottom |
|---|---|---|---|---|---|---|---|
| Hollow Barrow | I | Warrior | 10 | 12 | 8 | 30 | D3 |
| Sunken Chapel | II | Archer | 8 | 12 | 12 | 32 | D3 |
| Drowned Ironworks | III | Lancer | 10 | 12 | 14 | 36 | D3 |
| The Counting House | IV | Cavalry | 12 | 14 | 16 | 42 | D4+ |
| Star Observatory | V | mixed | 12 | 16 | 18 | 46 | D5+ |

186 rooms, 15 bosses. A ruin at its **bottom** has no deeper depth and needs its
own state, distinct from *locked*.

## 5. Attempt flow

1. Open ruin → depth stack → room ladder → frontier room.
2. Room sheet shows threat (if Scout unlocked), `power_req` vs. party power,
   supply cost.
3. Fight with the army camped at the dungeon — hero mandatory
   ([`combat.md`](combat.md)). Its losses and its heroes' wounds carry from
   room to room.
4. Deduct supplies. Enter. Resolve the fight. Take the casualties.
5. **Cleared:** grant rewards, mark room, advance frontier.
   **Failed:** nothing granted, room stays unclaimed.

Rules:

- Supplies are deducted on entry and **never refunded**.
- **The room fights back: the attempt costs soldiers, win or lose.** Most of
  the fallen reach the infirmary and can be mended at a military hall; the
  rest are gone ([`combat.md`](combat.md) §4). Supplies and bodies are the
  whole price — nothing else the player has banked is ever taken.
- A power shortfall **warns, never blocks**.
- No attempt cap, no cooldown.
- Party HP does not carry between rooms.
- Retry is unlimited and identical to a first attempt.
- An army with no hero left walks home.

## 6. Power requirement

```
power_req(D, r) = powerStart(D) + powerStep(D) × (r − 1)
```

The boss room fields `bossMultiplier` (1.6) times that. Displayed against
party power as an estimate. Actual outcome is decided by
[`combat.md`](combat.md).

## 7. Rewards

### 7.1 Rooms — formula

For room `r`, depth `D`, ruin tier `t`:

```
gold      = rewardBase(D) × 20 × t × 1.06^(r − 1)
materials = rewardBase(D) ×  3 × t × 1.06^(r − 1)
stardust  = rewardBase(D) ×  2 × t × 1.06^(r − 1)
hero_xp   = rewardBase(D) × 10 × t × 1.06^(r − 1)
knowledge = max(1, round(rewardBase(D) × 0.25 × t × 1.06^(r − 1)))
```

- **Every room pays Knowledge, at least 1** — 1,156 across the 186 rooms.
  It lands in the Knowledge bar in full, over the cap if it must
  ([`07-research.md`](07-research.md) §3).

A boss room pays `bossRewardMultiplier` (3) times the formula.
`rewardBase(D)` continues the previous depth's curve. Individual rooms may be
overridden by hand.

### 7.2 Boss — authored chest

Ignores the formula. Contains a Gem lump and **hero fragments** from a
per-boss pool ([`10-heroes.md`](10-heroes.md) §5). No relic fragment drops
([`09-relics.md`](09-relics.md) §1).

### 7.3 Depth completion — permanent generation

Granted when the boss dies:

```
stardust/h =  2 × tier × depth_index
hero_xp/h  = 10 × tier × depth_index
gold/h     =  5 × tier × depth_index
```

Full launch clear = +180 Stardust/h.

### 7.4 Offline accumulation

*Designed, not built.*

- Ruin generation accrues into a **reservoir of its own**, capped at **2 h** of
  generation. Nothing accrues past it; the player collects it.
- The reservoir is its only ceiling: there is no offline cap
  ([`04-harvest.md`](04-harvest.md) §8).
- At +180 Stardust/h a full reservoir is 360.

## 8. Currencies

| Currency | Use | Source |
|---|---|---|
| Hero XP | Hero levels. A **kingdom** currency, spent on any hero ([`10-heroes.md`](10-heroes.md) §4) | Rooms + trickle |
| Stardust | The Stardust toll on a hero's ascension | Rooms + trickle + every gacha call |
| Hero fragments | Hero ascension, with the toll, which sets the hero's level cap. Per hero | Boss chests + banner |
| Gold | Anecdotal | Rooms + trickle |

Wood, Stone and Food are not in the trickle.

## 9. Screens

Full spec: [`11a-ruins-ui.md`](11a-ruins-ui.md).

- **Map marker** — progress, badge when a room is enterable.
- **Discovery card** — one-off on fog lift.
- **Dungeon sheet** — depth stack; locked depths shown with the boss that
  opens them and its reward; states: locked / open / in-progress / complete / bottomed out.
- **Room ladder** — cleared / frontier / locked; next-carrot banner above the
  frontier; auto-scroll to frontier.
- **Room sheet** — the battle screen: the dungeon in the widget at the top,
  the first depth's squads against the party's, the board, and *Set off*.
- **Party composition** — the board's slots and their card panels, the same
  ones every fight uses ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.6).
- **Result: cleared** — chest, passive counter increment, next-room CTA.
- **Result: failed** — power gap and losing matchup stated; retry / recompose /
  leave.
- **Reservoir meter** — shared with city idle; distinct full state.

## 10. Dials

| Dial | Key |
|---|---|
| `powerStart`, `powerStep` per depth | `worldDungeon.powerStart`, `worldDungeon.powerStep` |
| Depths, and rooms per depth | `worldDungeon.depths`, `worldDungeon.roomsPerDepth` |
| Reward base and per-room growth (×1.06) | `worldDungeon.rewardBase`, `worldDungeon.rewardGrowth` |
| Gold, Hero XP, Stardust per room (×20, ×10, ×2) | `worldDungeon.gold`, `.heroXp`, `.stardust` |
| Knowledge per room (×0.25, at least 1) | `worldDungeon.knowledge` |
| Boss power and reward (×1.6, ×3) | `worldDungeon.bossMultiplier`, `.bossRewardMultiplier` |
| Boss chest and fragment pool | a `bosses` collection *(designed)* |
| Supplies per room attempt | `ruins.supply_*` |
| Permanent generation coefficients | `ruins.trickle_*` |
| Generation reservoir cap (2 h) | *designed, no key yet* |

## 11. Adding content

Append a depth to a ruin (a `depths` entry + two tables + one authored boss), or add a ruin
in a new region. Nothing is authored per room.

**Unresolved:** OQ-75 daily attempt cap · OQ-76 outlet when fully walled ·
OQ-77 deeper strata · OQ-78 the Stardust trickle · OQ-79 XP vs. hero level
curve · OQ-80 boss fragment rate · OQ-81 ruins navigation. Inherited: OQ-41.
Landmarks: [`combat.md`](combat.md) §15.
