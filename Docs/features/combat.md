# Combat — the resolver

> **Spec.** Callers: [`11-expeditions.md`](11-expeditions.md) (rooms and
> bosses), map landmarks ([`01-map-and-fog.md`](01-map-and-fog.md) §6), the
> future PvP conquest map. Hero fields, levels and ascension:
> [`10-heroes.md`](10-heroes.md). Relics: [`09-relics.md`](09-relics.md).
> Building levels and costs: [`buildings.md`](buildings.md).
>
> **Status: built 2026-09-09.** The resolver is `src/sim/battle.ts` and the
> screen that replays its stream is `src/ui/battleScreen.ts`. Still ahead:
> unit tiers T2–T5 (§6, no technology opens one yet) and authored boss
> FORMATIONS beyond the boss villain (§11).

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
- **WHAT DIES IN THE FIGHT IS GONE FROM THE ROSTER.** A squad that ends with
  340 of its 2,000 hit points lost 83 of its hundred, and those 83 are what
  the city is charged. There is no separate formula: the losses are read off
  the log (§13).
- **A rout is free, and a scrape is expensive.** A party that wipes a room
  before it can swing loses nobody at all; one that wins on the last tick
  comes home in pieces. Bringing more than enough is worth something, and
  this is what it is worth.
- **A casualty is two things — if the city has an Infirmary.**
  `army.wounded_share` of the fallen are carried to its beds and the rest are
  dead. Both leave the roster at once: a wounded soldier cannot be sent
  anywhere and does not count against the army cap.
  - **The ward is a building, not a rule.** With no Infirmary built there are
    no beds, so every casualty is a death. It is opened by the `Infirmary`
    technology in Civics and holds `Districts.beds_per_level`, which is the
    whole of what its levels buy ([`buildings.md`](buildings.md) §4.10).
  - **Anything the beds have no room for dies**, which is what makes the
    ceiling a decision.
  - The Infirmary mends them: `army.heal_cost_share` of what recruiting the
    same soldiers costs and `army.heal_time_share` of the clock, as **one
    order and one wait** for the whole ward, on its own bench — so mending
    never competes with recruiting. It needs no technology of its own beyond
    the building: they are already trained.
  - Cancelling an order puts them back in their beds and the coin back in the
    purse.
- **What else an ATTEMPT costs is the caller's rule.** A room and a gate both
  charge supplies on the way in ([`11-expeditions.md`](11-expeditions.md) §5,
  [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §5). Nothing else
  the player has banked is ever taken.

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
- Balanced against a full squad's output: a level-1 Common is about a fifth
  of one, and rarity and levels close the gap toward the **70%** the design
  aims at. A hero is a body, never an army.
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

1. Seed from `(ruin_id, depth_index, room_index)`. Same room, same enemies —
   the preview and the attempt are one query.
2. **Villains first**, because what is left is what the squads may cost. Above
   `combat.gen_villain_threshold`, up to `combat.gen_villain_slots` of them
   (three, the same hero slots the player fields) are drawn from the depth's
   `villain_pool`, each costing its authored `power`.
3. Pick a slot count of 2–6, whichever is larger: the roll, or the number of
   squads the budget actually needs.
4. Split the budget across types, **the ruin's affinity first** and taking the
   lion's share (60%), the rest even across the others.
5. Per type: `count = floor(share / power_per_troop)`, clamped to `squad_size`;
   overflow spills into a second squad of the same type, and whatever the
   shares leave on the table goes to the affinity while a slot remains.
6. Rows are the unit's own: melee and flankers front, ranged back (§8).

**The board is the ceiling.** Six troop slots of `squad_size` is all a side
can field, so past roughly two thousand points another thousand buys nothing
— which is why a deep room spends on villains instead. Budget that cannot be
fielded is simply not fielded, and the authored ladder lives under that
ceiling.

**Overrides:** **boss rooms always field their authored villain** (`Depths`
`boss_villain`), never a rolled one. Authoring a whole formation — named
villains in named slots, beside chosen squads — is designed and not built.

**Budget accounting:** a villain's `power` covers the buff it grants as well
as its own output, because it is authored rather than derived.

## 12. Power

Shown against `power_req` in the room sheet:

```
squad_power = count × power_per_troop(tier)
party_power = Σ squad_power + Σ hero_power
hero_power  = dmg(hero at its level) × combat.hero_power_per_dmg
```

**This is an estimate; the resolver decides the outcome.** A sum cannot
express frontage, rows, cooldowns or the order things die in — so a party
that reads stronger can lose, and the sheet says nothing more definite than
"enough on paper". The same sum is the bar at the top of the battle screen,
falling as squads come apart.

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

**And the replay is disposable.** Every consequence of the fight — the
rewards, the frontier, the fallen — is applied when the resolver runs, so a
player who closes the tab mid-animation loses nothing but the animation. It
is also the seam a server-resolved PvP fight arrives through: a replay is
`(both boards, the list)`, and the screen cannot tell which produced it.

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
- **Golden tests:** `tests/battle.test.ts` holds one board pair and its whole
  event stream, compared as a snapshot. A change to §7, §8 or §10 rewrites it,
  and a diff that rewrites it has to say why.
- A replay is `(both boards, the event list)` — no seed needed, because
  nothing inside the fight rolls anything.

## 17. Dials

| Dial | Key |
|---|---|
| Unit stats, `frontage`, `squad_size`, `power_per_troop` | `Units` sheet |
| Troop slots on the board, hero slots and their Gem ladder | `party.*` |
| Tier multipliers | `Units` sheet |
| Type fractions, as integer pairs | `combat.type_advantage_num/den`, `combat.type_disadvantage_num/den` |
| Hero stat blocks, passives, the 70% share and the rarity multipliers | `Heroes` sheet, `heroes.rarity_*` ([`10-heroes.md`](10-heroes.md) §9) |
| Villain stat blocks, per room | `Villains` sheet |
| Villain pool per depth | `Depths` sheet |
| Tick length, timeout | `combat.tick_ms`, `combat.timeout_ticks` |
| Enemy slot band, villain threshold, share and slots | `combat.gen_slots_min/max`, `combat.gen_villain_threshold`, `gen_villain_share`, `gen_villain_slots` |
| What a hero is worth in the ESTIMATE | `combat.hero_power_per_dmg` |
| Army cap per building level | `Districts.army_cap_per_level` |
| How much of a casualty is saveable, and how many beds there are | `army.wounded_share`, `Districts.beds_per_level` |
| What mending costs against recruiting | `army.heal_cost_share`, `army.heal_time_share` |

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
- **A whole authored formation** — named villains in named slots beside chosen
  squads. A boss's villain is authored; the squads around it are still rolled
- Casualties *inside* the resolver, healing timers, permanent garrisons
- RNG in resolution
- Draws

**Pending:** tier conversion cost, if any (**OQ-85**) · `power_start`
re-authoring against the full T1–T5 power range once tiers exist (**OQ-86**).
**OQ-82 closed 2026-09-09**: three villain slots, the same three the player
fields.
