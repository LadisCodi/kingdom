# Combat — the resolver

> **Spec.** Callers: [`11-expeditions.md`](11-expeditions.md) (rooms and
> bosses), map landmarks ([`01-map-and-fog.md`](01-map-and-fog.md) §6), the
> future PvP conquest map. Hero fields, levels and ascension:
> [`10-heroes.md`](10-heroes.md). Relics: [`09-relics.md`](09-relics.md).
> Building levels and costs: [`buildings.md`](buildings.md).

## 1. Model

- Deterministic tick auto-battler. **No input during the fight.**
- **Headless resolver + renderer**, separated by an event stream (§12).
- **Integer arithmetic only.** The only divisions are the fixed fractions in §7.
- **No RNG in resolution.** The only seeded RNG is enemy generation (§10).
- One resolver for every caller.

## 2. Battle modes

| Mode | Troop slots | Hero slots | Used by |
|---|---|---|---|
| **Army battle** | Enabled | Enabled | Ruin rooms, landmarks, PvP |
| **Hero battle** | Disabled | Enabled | Hero-only content |

The only difference is whether troop slots may be filled. Board, ticks, damage,
targeting and victory rules are identical. In a hero battle no troop type
bonuses apply, since there are no troops to receive them.

## 3. Board

Per side:

- **6 troop slots** — 2 rows × 3.
- **2 hero slots**, expandable to 3.
- Every slot, troop or hero, is assigned to the **front** or **back** row.
- Hero slots are independent of troop slots: a hero never occupies a troop slot
  and never joins a squad.
- Position determines targeting order only (§8).

Slot availability comes from party slots
([`11-expeditions.md`](11-expeditions.md) §3).

## 4. Squads

- A squad is one **unit type** at one **tier**, plus a troop **count**.
- `count` is capped by the type's `squad_size`. **Only full squads may be
  committed.**
- `hp_pool = count × hp_unit`; `alive = ceil(hp_pool / hp_unit)`.
- **No permanent casualties.** Troops are restored in full when the fight ends,
  win or lose. HP does not carry between rooms.

## 5. Unit stats — Tier 1

| Unit | `squad_size` | `frontage` | `dmg` | `hp` | `def` | `cooldown` | `power_per_troop` | Targeting |
|---|---|---|---|---|---|---|---|---|
| **Warrior** | 100 | 50 | 8 | 20 | 3 | 10 | 3 | Melee |
| **Lancer** | 100 | 60 | 10 | 16 | 2 | 10 | 4 | Melee |
| **Archer** | 80 | 80 | 7 | 10 | 1 | 12 | 4 | Ranged |
| **Cavalry** | 60 | 30 | 22 | 24 | 2 | 15 | 7 | Flanker |

`cooldown` is in ticks. `squad_size` and `frontage` are fixed constants at every
tier.

## 6. Unit tiers

| Tier | Multiplier | Unlock |
|---|---|---|
| T1 | ×1.0 | Start |
| T2 | ×1.6 | Research |
| T3 | ×2.6 | Research |
| T4 | ×4.2 | Research |
| T5 | ×6.8 | Research |

- The multiplier applies to `dmg`, `hp` and `power_per_troop`. `squad_size`,
  `frontage`, `def` and `cooldown` are unaffected.
- **Each unit type tiers independently.**
- Unlocking a tier switches training output to it and **converts existing troops
  of that type**. Only one tier of a type exists at a time.

## 7. Damage

Per attack, from slot `A` onto slot `B`:

```
hits  = min(alive(A), frontage(A))
raw   = hits × max(1, dmg(A) − def(B))
dealt = raw × type_num / type_den          (integer division, floor)
```

`hp_pool(B) −= dealt`, then `alive(B)` recomputes. Troops are removed whole; the
remainder stays in the pool.

`dmg(A)` already includes the tier multiplier (§6) and the hero troop bonus
(§9).

**Type fractions**

| Matchup | Fraction |
|---|---|
| Advantage | `3 / 2` |
| Neutral | `1 / 1` |
| Disadvantage | `3 / 4` |

| Beats | |
|---|---|
| Lancer → Cavalry | Cavalry → Archer |
| Archer → Warrior | Warrior → Lancer |

Heroes carry a type and participate in the chart on both sides.

Troops above `frontage` are reserve: they absorb damage but add no output. A
squad's damage is flat until `alive` falls below `frontage`, then falls
linearly.

## 8. Targeting

Resolved fresh on every attack. Hero slots are valid targets.

| Rule | Behaviour |
|---|---|
| **Melee** | Enemy front row while any front-row slot lives; then the back row |
| **Ranged** | Lowest `hp_pool` enemy slot, any row |
| **Flanker** | Enemy back row while any back-row slot lives; then the front row |

Ties break by lowest slot index.

## 9. Heroes and villains

**A villain is an enemy hero.** Same schema, same slots, same rules — every
rule in this section applies to both sides. The only difference is where the
stats come from: a hero's are derived from level and ascension
([`10-heroes.md`](10-heroes.md)); a villain's are authored per room
(the `Villains` sheet). The resolver has one code path and reads a resolved
stat block either way.

A hero or villain occupies a hero slot and does two things.

### 9.1 It fights

- Stats: `hp`, `dmg`, `def`, `cooldown`, type. Attacks with `frontage = 1` and
  `alive = 1`.
- Balanced to roughly **70%** of a full squad's output at equivalent
  investment.
- Dies when its `hp` reaches 0: it stops attacking and its ultimate stops
  firing.

### 9.2 It buffs one troop type

- `troop_dmg_mult` and `troop_hp_mult` apply to **every squad on that side of
  the board whose type matches the hero's type**, regardless of slot or row.
- **No effect on non-matching types.**
- Multipliers from several heroes of the same type are additive on the excess:
  `1 + Σ(mult − 1)`.
- **Bonuses are computed at battle start and persist if the hero dies.**
- The hero's passive and ultimate are always active while the hero lives,
  whether or not any matching troops are present.

### 9.3 Energy and ultimate

- +1 per tick, +5 per attack made, +2 per attack received.
- Fires at **100**, resets to 0.
- One ultimate and one passive per hero, scaled by `ability_power`. Unit types
  have no abilities.
- Ultimate effects are limited to: damage to one or all enemy slots, a timed
  buff, or restoring `hp_pool`.

## 10. Ticks and victory

- One tick = **100 ms logical**, unrelated to frame rate.
- Each slot carries a countdown initialised to its `cooldown`.
- Per tick, in ascending slot order — attacker side first, then defender:
  decrement countdowns; every slot reaching 0 attacks and resets.
- **Victory:** all enemy slots at 0 → that side wins.
- **Timeout: 600 ticks.** The **defender** wins. In PvE the player is always the
  attacker. There are no draws.

## 11. Enemy generation

Rooms carry a `power_req` budget and a `threat_mix`
([`11-expeditions.md`](11-expeditions.md) §2). The generator converts
them:

1. Seed from `(ruin_id, depth_index, room_index)`. Same room, same enemies.
2. Pick a slot count of 2–5, scaled by budget.
3. Split the budget across types by `threat_mix` weights.
4. Per type: `count = floor(share / power_per_troop)`, clamped to `squad_size`;
   overflow spills into a second squad of the same type.
5. Assign rows: melee and flankers front, ranged back, until the front row is
   full.
6. Above a threshold budget, spend part of it on **villains** instead of
   squads, drawn from the depth's villain pool.

**Overrides:** any room row may specify an explicit formation, including named
villains in named slots. **Boss rooms always author their villains** — never
generated.

**Budget accounting:** a villain's cost against `power_req` must include the
buff it grants, not only its own output. A villain placed alongside squads of
its matching type is worth more than one placed with mismatched squads.

## 12. Power

Shown against `power_req` in the room sheet:

```
squad_power = count × power_per_troop(tier) × troop_dmg_mult
party_power = Σ squad_power + Σ hero_power
```

`hero_power` is authored per hero and level
([`10-heroes.md`](10-heroes.md)). This is an estimate; the resolver decides the
outcome.

## 13. Event stream

The resolver emits an ordered list. The renderer replays it and may skip,
fast-forward or restart.

| Event | Payload |
|---|---|
| `start` | Both boards, slot types, tiers, rows, applied bonuses, seed |
| `attack` | tick, source slot, target slot, `hits`, `dealt`, type fraction |
| `troops_lost` | tick, slot, new `alive`, new `hp_pool` |
| `slot_wiped` | tick, slot |
| `energy` | tick, hero slot, value |
| `ultimate` | tick, hero slot, ability id, affected slots, per-slot effect |
| `end` | tick, winner, reason (`wiped` \| `timeout`) |

The stream is fully sufficient to draw the fight; the renderer never recomputes
state. Resolution completes before the first frame — the result is known
instantly and the animation is a replay.

## 14. Army cap and military buildings

The cap limits **total troops owned**, not party size.

| Building | Trains | Cap per level (1–5) |
|---|---|---|
| **Barracks** | Warrior · Lancer · Archer | 150 / 250 / 400 / 600 / 850 |
| **Spear Hall** | Lancer | 150 / 250 / 400 / 600 / 850 |
| **Shooting Grounds** | Archer | 150 / 250 / 400 / 600 / 850 |
| **Stables** | Cavalry | 150 / 250 / 400 / 600 / 850 |

- Caps sum across buildings. Each unit type is behind its own technology, as is
  each tier.
- Training is queued at the building the player pressed TRAIN on, takes time,
  and is boostable there.
- The Townhall level does not affect the cap.

## 15. Landmarks

A contested landmark resolves as an army battle with one authored formation.
Clearing it is a one-off; no garrison remains. The co-op siege on the world map
is [`15-social.md`](15-social.md) §6.

## 16. Determinism

- All state in integers. Only the type fraction divides, floored.
- Resolution order is fixed (§10); never iterate an unordered collection.
- **Golden tests:** stored board pairs with expected event streams, checked
  byte-for-byte in CI. Changes to §7, §8 or §10 must regenerate them
  deliberately.
- A replay is `(both boards, seed)`.

## 17. Dials

| Dial | Key |
|---|---|
| Unit stats, `frontage`, `squad_size`, `power_per_troop` | `Units` sheet |
| Tier multipliers | `Units` sheet |
| Type fractions (3/2, 3/4) | `combat.type_*` |
| Hero output share of the board (target 30–40%) | `Heroes` sheet |
| Villain stat blocks, per room | `Villains` sheet |
| Villain pool per depth | `Depths` sheet |
| Tick length, timeout | `combat.tick_ms`, `combat.timeout_ticks` |
| Energy gain, ultimate threshold | `combat.energy_*` |
| Enemy slot count band, hero budget threshold, row assignment | `combat.gen_*` |
| Army cap per building level | `Districts.army_cap_per_level` |

## 18. Not in this version

- Any input during the fight
- Movement, pathfinding or facing
- Abilities on unit types
- Upgradeable `frontage` or `squad_size`
- Partial squads, or mixed tiers of one type
- Heroes inside troop slots, or bonuses to non-matching types
- Villains with levels or ascension — their stats are authored
- Villain buffs crossing sides
- Permanent casualties, healing timers, permanent garrisons
- RNG in resolution
- Draws

**Pending:** villain hero-slot count per room, and whether it is capped like
the player's (**OQ-82**) · third hero slot unlock (**OQ-83**) · ultimate
targeting when the intended row is empty (**OQ-84**) · tier conversion cost, if
any (**OQ-85**) · `power_start` re-authoring against the full T1–T5 power range
(**OQ-86**).
