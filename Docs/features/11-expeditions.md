# 11 · Ruins — depths and rooms

> **Spec.** Combat resolution, unit stats and party rules:
> [`combat.md`](combat.md). Ruin placement and discovery:
> [`01-map-and-fog.md`](01-map-and-fog.md) §6. Screens:
> [`11a-ruins-ui.md`](11a-ruins-ui.md). Guild costs:
> [`buildings.md`](buildings.md).

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

One row per depth, plus two tables.

| Field | Value |
|---|---|
| `rooms` | 8–18 |
| `guild_req` | Guild level that opens this depth. Default `= depth_index`. **`0` on every Depth 1** |
| `power_start`, `power_step` | Enemy power in room 1, per-room increment |
| `threat_mix` | Type weights per room, biased to the ruin's affinity |
| `boss` | Authored formation: squads plus **named villains** in named slots → [`combat.md`](combat.md) §9 |
| `villain_pool` | Villains the generator may place in standard rooms of this depth |
| `room_rewards` | `rooms` rows; formula default (§7.1), any row overridable |
| `boss_reward` | Authored chest (§7.2) |
| `passive_on_complete` | Stardust/h, XP/h, Gold/h (§7.3) |
| `supplies` | Cost per room attempt in this depth |

### Validation (enforce in the sheet)

```
power_start(D+1)  ≥  power_start(D) + power_step(D) × (rooms(D) − 1)
guild_req(D+1)    ≥  guild_req(D)
```

Plus, per Guild level: at least two ruins must have an open, unfinished depth,
with different affinities.

## 3. Gates

- **Ruin availability:** discovered on the map, gate cleared. Depth 1 opens
  when the gate falls.
- **Depth availability:** `guild_req` ≤ current Adventurers' Guild level.

| Guild level | Opens | Also |
|---|---|---|
| 1 | Barrow D1 · every discovered ruin's D1 | — |
| 2 | Barrow D2 | — |
| 3 | Barrow D3 · Chapel D2 | Scout: room threat preview |
| 4 | Chapel D3 · Ironworks D2 | — |
| 5 | Ironworks D3 · Counting House D2 | — |
| 6 | Counting House D3 · Observatory D2 | — |
| 7 | Observatory D3 | — |

Guild upgrades cost city resources only — never a ruin-sourced resource.

**The Guild opens depths and nothing else.** Every TROOP slot on the board is
open from the first fight — nothing gates one and nothing sells one
([`combat.md`](combat.md) §3) — and the only slot that is bought is a HERO
slot ([`10-heroes.md`](10-heroes.md) §3).

## 4. Launch content

| Ruin | Tier | Affinity | Depth 1 | Depth 2 | Depth 3 | Rooms | Bottom |
|---|---|---|---|---|---|---|---|
| Hollow Barrow | I | Warrior | 10 · *open* | 12 · *G2* | 8 · *G3* | 30 | D3 |
| Sunken Chapel | II | Archer | 8 · *open* | 12 · *G3* | 12 · *G4* | 32 | D3 |
| Drowned Ironworks | III | Lancer | 10 · *open* | 12 · *G4* | 14 · *G5* | 36 | D3 |
| The Counting House | IV | Cavalry | 12 · *open* | 14 · *G5* | 16 · *G6* | 42 | D4+ |
| Star Observatory | V | mixed | 12 · *open* | 16 · *G6* | 18 · *G7* | 46 | D5+ |

186 rooms, 15 bosses. A ruin at its **bottom** has no deeper depth and needs its
own state, distinct from *locked*. Depths 4–5 sit behind Guild 8+.

## 5. Attempt flow

1. Open ruin → depth stack → room ladder → frontier room.
2. Room sheet shows threat (if Scout unlocked), `power_req` vs. party power,
   supply cost.
3. Compose party — hero mandatory ([`combat.md`](combat.md)).
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

## 6. Power requirement

```
power_req(D, r) = power_start(D) + power_step(D) × (r − 1)
```

Displayed against party power as an estimate. Actual outcome is decided by
[`combat.md`](combat.md).

## 7. Rewards

### 7.1 Rooms — formula

For room `r`, depth `D`, ruin tier `t`:

```
gold      = reward_base(D) × 20 × t × 1.06^(r − 1)
materials = reward_base(D) ×  3 × t × 1.06^(r − 1)
stardust  = reward_base(D) ×  2 × t × 1.06^(r − 1)
hero_xp   = reward_base(D) × 10 × t × 1.06^(r − 1)
```

`reward_base(D)` continues the previous depth's curve. Individual rows may be
overridden by hand.

### 7.2 Boss — authored chest

Ignores the formula. Contains: a named relic
([`09-relics.md`](09-relics.md)), a Gem lump, and **hero fragments** from a
per-boss pool ([`10-heroes.md`](10-heroes.md) §5).

### 7.3 Depth completion — permanent generation

Granted when the boss dies:

```
stardust/h =  2 × tier × depth_index
hero_xp/h  = 10 × tier × depth_index
gold/h     =  5 × tier × depth_index
```

Full launch clear = +180 Stardust/h.

### 7.4 Offline accumulation

Ruin generation accrues into the **city's shared offline reservoir**. One cap:
**2 h default, 8 h with the offline manager.** Nothing accrues past it. At +180
Stardust/h a full reservoir is 360 (2 h) or 1,440 (8 h).

## 8. Currencies

| Currency | Use | Source |
|---|---|---|
| Hero XP | Hero levels. A **kingdom** currency, spent on any hero ([`10-heroes.md`](10-heroes.md) §4) | Rooms + trickle |
| Stardust | Relic levels; the Stardust toll on a hero's ascension | Rooms + trickle + every gacha call |
| Hero fragments | Hero ascension, with the toll, which sets the hero's level cap. Per hero | Boss chests + banner |
| Gold | Anecdotal | Rooms + trickle |

Wood, Stone and Food are not in the trickle.

## 9. Screens

Full spec: [`11a-ruins-ui.md`](11a-ruins-ui.md).

- **Map marker** — progress, badge when a room is enterable.
- **Discovery card** — one-off on fog lift.
- **Ruin sheet** — depth stack; locked depths shown with `guild_req` and boss
  reward visible; states: locked / open / in-progress / complete / bottomed out.
- **Room ladder** — cleared / frontier / locked; next-carrot banner above the
  frontier; auto-scroll to frontier.
- **Room sheet** — the battle screen: the dungeon in the widget at the top,
  the first depth's squads against the party's, the board, and *Set off*.
- **Party composition** — the board's slots and their card panels, the same
  ones every fight uses ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.6).
- **Result: cleared** — chest, passive counter increment, next-room CTA.
- **Result: failed** — power gap and losing matchup stated; retry / recompose /
  leave.
- **Guild screen** — next level's cost and the depths it opens, with boss art.
- **Reservoir meter** — shared with city idle; distinct full state.

## 10. Dials

| Dial | Key |
|---|---|
| `power_start`, `power_step` per depth | `Depths` sheet |
| `rooms`, `guild_req` per depth | `Depths` sheet |
| Reward base and per-room growth (×1.06) | `Depths` sheet |
| Boss chest and fragment pool | `Bosses` sheet |
| Supplies per room attempt | `ruins.supply_*` |
| Permanent generation coefficients | `ruins.trickle_*` |
| Offline cap (2 h / 8 h) | `offlineCapHours` |

## 11. Adding content

Append a depth to a ruin (row + two tables + one authored boss), or add a ruin
in a new region. Nothing is authored per room.

**Unresolved:** OQ-75 daily attempt cap · OQ-76 outlet when fully walled ·
OQ-77 deeper strata · OQ-78 Stardust vs. relic curve · OQ-79 XP vs. hero level
curve · OQ-80 boss fragment rate · OQ-81 ruins navigation. Inherited: OQ-41.
Landmarks: [`combat.md`](combat.md) §15.
