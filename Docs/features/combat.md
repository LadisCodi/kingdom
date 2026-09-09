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

## 2. One battle

- Every fight fields **troop slots and hero slots**: gates, ruin rooms,
  bosses, PvP. There is no hero-only mode.
- **At least one hero is mandatory** on the player's side
  ([`10-heroes.md`](10-heroes.md) §2.5). Troop slots may be empty.

## 3. Board

Per side:

- **6 troop slots** — 2 rows × 3.
- **3 hero slots**.
- Every slot, troop or hero, is assigned to the **front** or **back** row.
- Hero slots are independent of troop slots: a hero never occupies a troop slot
  and never joins a squad.
- Position determines targeting order only (§8).

How many slots the player may fill: **every troop slot, always** — nothing
gates one and nothing sells one, so what limits a party is the army at home
and the army cap; hero slots one free, the rest Gems
([`10-heroes.md`](10-heroes.md) §3).

## 4. Squads

- A squad is one **unit type** at one **tier**, plus a troop **count**.
- `count` is capped by the type's `squad_size`, and **a partial squad is
  legal**: a slot takes as many of the type as there are, up to that cap. A
  full squad is the ceiling, never the entry price — a player with eleven
  Archers sends eleven.
- `hp_pool = count × hp_unit`; `alive = ceil(hp_pool / hp_unit)`.
- **Hit points do not carry between fights.** They are spent inside one and
  reset when it ends; a squad's HP pool is its count times `hp_unit` every
  time.
- **EVERY FIGHT COSTS SOLDIERS, WIN OR LOSE. The dead are gone for good.**
  What kills them is the enemy's power against the party's defence, spread
  across the committed squads by their share of the party's hit points. Only
  whole troops die, and never fewer than one.
- **A rout costs less than a repulse.** A party that wins takes the damage in
  proportion to how outmatched the enemy was, so bringing more than enough
  buys fewer funerals as well as a win; a party that is driven off pays it in
  full.
- **What else an ATTEMPT costs is the caller's rule.** A room and a gate both
  charge supplies on the way in ([`11-expeditions.md`](11-expeditions.md) §5,
  [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §5). Nothing the
  player has already banked is ever taken.

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
- Dies when its `hp` reaches 0: it stops attacking. Its passive stands.

### 9.2 It buffs one troop type — the passive

- `troop_dmg_mult`, `troop_hp_mult` and `troop_def_bonus` (flat, added to
  `def`) apply to **every squad on that side of the board whose type matches
  the hero's type**, regardless of slot or row.
- **No effect on non-matching types.**
- Multipliers from several heroes of the same type are additive on the excess:
  `1 + Σ(mult − 1)`; flat bonuses sum.
- **Bonuses are computed at battle start and persist if the hero dies.**
- This is the hero's only ability. No ultimate, no energy, no abilities on
  unit types.

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

`hero_power` is a formula of the hero's resolved stat block and passive at its
level and tier, not a table:

```
hero_power = power_base(hero) × rarity_mult × (1 + power_per_level × (level − 1))
```

This is an estimate; the resolver decides the outcome.

## 13. Event stream

The resolver emits an ordered list. The renderer replays it and may skip,
fast-forward or restart.

| Event | Payload |
|---|---|
| `start` | Both boards, slot types, tiers, rows, applied bonuses, seed |
| `attack` | tick, source slot, target slot, `hits`, `dealt`, type fraction |
| `troops_lost` | tick, slot, new `alive`, new `hp_pool` |
| `slot_wiped` | tick, slot |
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

- Levels 6–10 continue it: 1,100 / 1,400 / 1,750 / 2,150 / 2,600.
- **A soldier is one place in a hall, whatever it is worth in a fight.**
  `power_per_troop` decides what a troop DOES and never what it costs to keep,
  so a Cavalry and a Warrior take the same room.
- Caps sum across buildings. Each unit type is behind its own technology, as is
  each tier.
- **What bounds a PARTY is the board** — six slots of `squad_size` (§3, §4) —
  and what bounds the board is what the city owns. The cap is the city's
  number; the board is the fight's.
- Training is queued at the building the player pressed TRAIN on, takes time,
  and is boostable there.
- The Townhall level does not affect the cap.

## 15. Landmarks

A province landmark is claimed for Gold; it has no fight. Every ruin opens
with a **gate** — a formation the generator builds from the ruin's `guard`,
fought on this board as a room ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
The co-op siege on the world map is [`15-social.md`](15-social.md) §6.

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
| Troop slots on the board, hero slots and their Gem ladder | `party.*` |
| Tier multipliers | `Units` sheet |
| Type fractions (3/2, 3/4) | `combat.type_*` |
| Hero stat blocks, passives, the 70% share and the rarity multipliers | `Heroes` sheet, `heroes.rarity_*` ([`10-heroes.md`](10-heroes.md) §9) |
| Villain stat blocks, per room | `Villains` sheet |
| Villain pool per depth | `Depths` sheet |
| Tick length, timeout | `combat.tick_ms`, `combat.timeout_ticks` |
| Enemy slot count band, hero budget threshold, row assignment | `combat.gen_*` |
| Army cap per building level | `Districts.army_cap_per_level` |

## 18. Not in this version

- Any input during the fight
- Movement, pathfinding or facing
- Abilities on unit types; ultimates, energy or any hero ability beyond the
  type passive
- A hero-only battle mode — a hero arena is a possible future
- Upgradeable `frontage` or `squad_size`
- Mixed tiers of one type in a squad
- Heroes inside troop slots, or bonuses to non-matching types
- Villains with levels or ascension — their stats are authored
- Villain buffs crossing sides
- Casualties *inside* the resolver, healing timers, permanent garrisons
- RNG in resolution
- Draws

**Pending:** villain hero-slot count per room, and whether it is capped like
the player's (**OQ-82**) · tier conversion cost, if any (**OQ-85**) ·
`power_start` re-authoring against the full T1–T5 power range (**OQ-86**).
