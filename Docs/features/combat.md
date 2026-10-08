# Combat — the resolver

> **Spec.** Callers: [`11-expeditions.md`](11-expeditions.md) (rooms and
> bosses), the province's lairs
> ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)), and armies on
> the world board ([`19-world-map.md`](19-world-map.md)). Hero fields, levels and ascension:
> [`10-heroes.md`](10-heroes.md). Relics: [`09-relics.md`](09-relics.md).
> Building levels and costs: [`buildings.md`](buildings.md).
>
> **Status: built.** The resolver is `src/sim/battle.ts` and the
> screen that replays its stream is `src/ui/battleScreen.ts`. Still ahead:
> **troop evolutions** (§6 — designed, not built), the generator's evolved
> squads and scaled villains (§11, §9.4 — designed, not built), villains in a
> room (§11 — the generator takes a pool and a boss villain, and no caller
> passes one) and authored boss formations.

## 1. Model

- Deterministic tick auto-battler. **No input during the fight.**
- **Headless resolver + renderer**, separated by an event stream (§12).
- **Integer arithmetic only.** The only divisions are the fixed fractions in §7.
- **No RNG in resolution.** The only seeded RNG is enemy generation (§10).
- One resolver for every caller.

## 2. One battle

- Every fight fields **troop slots and hero slots**: lairs, dungeon rooms,
  bosses, armies on the world board. There is no hero-only mode.
- **A lair needs soldiers** — alone or with heroes, never a hero alone;
  an army on the world map needs a hero
  ([`10-heroes.md`](10-heroes.md) §2.7).

## 3. Board

Per side:

- **6 troop slots** — 2 rows × 3.
- **3 hero slots**.
- Every slot, troop or hero, sits in the **front** or **back** row — the one
  its type puts it in (§11).
- Hero slots are independent of troop slots: a hero never occupies a troop slot
  and never joins a squad.
- Position determines targeting order only (§8).

How many slots the player may fill: **every troop slot, always** — nothing
gates one and nothing sells one, so what limits a party is the army at home
and the army cap; hero slots one free, the rest Gems
([`10-heroes.md`](10-heroes.md) §3).

## 4. Squads

- A squad is one **troop** — a unit type at one **evolution** (§6) — plus a
  troop **count**.
- `count` is capped by the type's `squadSize`, and **a partial squad is
  legal**: a slot takes as many of the type as there are, up to that cap. A
  full squad is the ceiling, never the entry price — a player with eleven
  Archers sends eleven.
- `hp_pool = count × hp_unit`; `alive = ceil(hp_pool / hp_unit)`.
- **A squad's hit points do not carry between fights.** They are spent inside
  one and reset when it ends; a squad's HP pool is its count times `hp_unit`
  every time. A hero's do carry, and mend over time
  ([`10-heroes.md`](10-heroes.md) §2.8).
- **WHAT DIES IN THE FIGHT IS GONE FROM THE ROSTER.** A squad that ends with
  340 of its 2,000 hit points lost 83 of its hundred, and those 83 are what
  the city is charged. There is no separate formula: the losses are read off
  the log (§13).
- **A rout is free, and a scrape is expensive.** A party that wipes a room
  before it can swing loses nobody at all; one that wins on the last tick
  comes home in pieces. Bringing more than enough is worth something, and
  this is what it is worth.
- **A casualty is two things — if the city has an Infirmary.**
  A share of the fallen are carried to its beds and the rest are
  dead. Both leave the roster at once: a wounded soldier cannot be sent
  anywhere and does not count against the army cap.
  - **The share starts at `army.woundedShare` — a tenth — and is EARNED
    upward.** A battlefield keeps most of what it takes; bringing more of it
    home is something the player builds towards rather than a rate they are
    given.
    - **A hero with the Field medic skill**, +10 points at rank 1, more at
      each rank ([`10-heroes.md`](10-heroes.md) §2.5).
    - Capped at **90%**: someone always stays out there.
  - **The ward is a building, not a rule.** With no Infirmary built there are
    no beds, so every casualty is a death. It is opened by the `Infirmary`
    technology (chapter 3) and holds `buildings.bedsPerLevel`, which is the
    whole of what its levels buy ([`buildings.md`](buildings.md) §4.10).
  - **Anything the beds have no room for dies**, which is what makes the
    ceiling a decision.
  - The Infirmary mends them: `army.healCostShare` of what recruiting the
    same soldiers costs and `army.healTimeShare` of the clock, as **one
    order and one wait** for the whole ward, on its own bench — so mending
    never competes with recruiting. It needs no technology of its own beyond
    the building: they are already trained.
  - Cancelling an order puts them back in their beds and the coin back in the
    purse.
- **What else an ATTEMPT costs is the caller's rule.** Every attack charges
  its Mana on the way in ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §5). Nothing else
  the player has banked is ever taken.

## 5. Unit stats — rank I

| Unit | `squadSize` | `frontage` | `atk` | `dmg` | `def` | `hp` | `cooldown` | `power` | Targeting |
|---|---|---|---|---|---|---|---|---|---|
| **Warrior** | 100 | 15 | 4 | 5 | 6 | 60 | 10 | 3 | Melee |
| **Lancer** | 100 | 15 | 6 | 8 | 4 | 48 | 10 | 4 | Melee |
| **Archer** | 80 | 20 | 6 | 6 | 2 | 30 | 12 | 4 | Ranged |
| **Cavalry** | 60 | 8 | 8 | 20 | 3 | 72 | 15 | 7 | Flanker |

- **Attack** (`atk`) and **Defence** (`def`) are ratings; **Damage** (`dmg`)
  is what one troop takes off at an even pair (§7).
- The four are what a unit's and a hero's card shows, in that order.

`cooldown` is in ticks. `squadSize`, `frontage` and `cooldown` are the same
at every rank (§6).

- **A fight lasts at least ten seconds**, a fair one fifteen to thirty, a
  dungeon's boss room up to a minute and a half. Two dials hold it there:
  - `hp` sets how many blows a soldier takes — the floor of a small fight;
  - `frontage` is **small and fixed**, so a big squad strikes no harder than
    a middling one: its extra troops are reserve that buys time.
- Heroes and villains are scaled with them (10-heroes.md §2.3): health ×3,
  damage ×0.3, so a hero stays a body worth a share of a squad.
- The first lair, the Orcs — twenty orcs against the chain's thirty
  Warriors — lasts about fifteen seconds.

What one soldier costs to recruit (`units.recruitCost`), Gold first because
Gold is what an army is mostly paid in:

| Unit | Recruit cost |
|---|---|
| **Warrior** | 100 Gold · 5 Wood · 8 Food |
| **Lancer** | 200 Gold · 12 Wood · 4 Food |
| **Archer** | 130 Gold · 12 Wood |
| **Cavalry** | 300 Gold · 16 Food · 24 Stone |

## 6. Evolutions

**Status: designed, not built.**

### 6.1 The rules

- Every unit has **five evolutions, I to V**. Rank I is the unit as §5 has
  it; II–V are the same unit, stronger and dearer.
- **An evolution is a troop of its own.** It has its own count in the roster,
  its own squads, its own wounded. Ranks never mix in a squad.
- **A trained troop never evolves.** The roster keeps every rank the player
  trained; a better rank is trained new.
- **Same unit, same type**: row, targeting, the type chart (§7) and a hero's
  passive (§9.2) read the unit type, never the rank. `squadSize`, `frontage`
  and `cooldown` are the unit's at every rank.
- **One place in a hall**, whatever the rank (§14).
- **Two gates to train a rank:**
  - **its technology** — one per unit and rank: *Warriors II … V*,
    *Lancers II … V*, *Archers II … V*, *Cavalry II … V* (16);
  - **its hall at a minimum level**: II at 3, III at 5, IV at 7, V at 9.
  - A rank's technology sits in the chapter that opens its hall level, or
    later.
- **Every number is authored whole, per rank** — `atk`, `dmg`, `def`, `hp`,
  `power`, the recruit cost and the training time — in `units`, beside the
  unit.

### 6.2 How the numbers are set (a balancing rule, not a formula)

| Rank | `dmg` · `hp` · `power` | `atk` · `def` | Recruit cost | Training time | Hall level |
|---|---|---|---|---|---|
| I | ×1.0 | +0 | ×1 | ×1 | 1 |
| II | ×1.6 | +2 | ×2 | ×1.5 | 3 |
| III | ×2.6 | +4 | ×4 | ×2.25 | 5 |
| IV | ×4.2 | +6 | ×8 | ×3.4 | 7 |
| V | ×6.8 | +8 | ×16 | ×5 | 9 |

- Against rank I, rounded to whole numbers. `power` is an integer.
- `atk` and `def` climb by a flat step, so two troops of one rank meet the
  type chart exactly as two of rank I do.
- Gold per point of `power` climbs 1 · 1.25 · 1.54 · 1.9 · 2.35: a rank is
  dearer for what it is worth and cheaper for the place it takes.
- What is rare about a high rank is its gate: the hall levels it needs are
  priced in goods and precious materials ([`buildings.md`](buildings.md)
  §4.8).

### 6.3 The numbers

`atk` · `dmg` · `def` · `hp` · `power` · recruit cost · training time:

**Warrior**

| Rank | `atk` | `dmg` | `def` | `hp` | `power` | Recruit cost | Time |
|---|---|---|---|---|---|---|---|
| I | 4 | 5 | 6 | 60 | 3 | 100 G · 5 W · 8 F | 15 s |
| II | 6 | 8 | 8 | 96 | 5 | 200 G · 10 W · 16 F | 23 s |
| III | 8 | 13 | 10 | 156 | 8 | 400 G · 20 W · 32 F | 34 s |
| IV | 10 | 21 | 12 | 252 | 13 | 800 G · 40 W · 64 F | 51 s |
| V | 12 | 34 | 14 | 408 | 20 | 1,600 G · 80 W · 128 F | 75 s |

**Lancer**

| Rank | `atk` | `dmg` | `def` | `hp` | `power` | Recruit cost | Time |
|---|---|---|---|---|---|---|---|
| I | 6 | 8 | 4 | 48 | 4 | 200 G · 12 W · 4 F | 20 s |
| II | 8 | 13 | 6 | 77 | 6 | 400 G · 24 W · 8 F | 30 s |
| III | 10 | 21 | 8 | 125 | 10 | 800 G · 48 W · 16 F | 45 s |
| IV | 12 | 34 | 10 | 202 | 17 | 1,600 G · 96 W · 32 F | 68 s |
| V | 14 | 54 | 12 | 326 | 27 | 3,200 G · 192 W · 64 F | 100 s |

**Archer**

| Rank | `atk` | `dmg` | `def` | `hp` | `power` | Recruit cost | Time |
|---|---|---|---|---|---|---|---|
| I | 6 | 6 | 2 | 30 | 4 | 130 G · 12 W | 12 s |
| II | 8 | 10 | 4 | 48 | 6 | 260 G · 24 W | 18 s |
| III | 10 | 16 | 6 | 78 | 10 | 520 G · 48 W | 27 s |
| IV | 12 | 25 | 8 | 126 | 17 | 1,040 G · 96 W | 41 s |
| V | 14 | 41 | 10 | 204 | 27 | 2,080 G · 192 W | 60 s |

**Cavalry**

| Rank | `atk` | `dmg` | `def` | `hp` | `power` | Recruit cost | Time |
|---|---|---|---|---|---|---|---|
| I | 8 | 20 | 3 | 72 | 7 | 300 G · 16 F · 24 S | 30 s |
| II | 10 | 32 | 5 | 115 | 11 | 600 G · 32 F · 48 S | 45 s |
| III | 12 | 52 | 7 | 187 | 18 | 1,200 G · 64 F · 96 S | 68 s |
| IV | 14 | 84 | 9 | 302 | 29 | 2,400 G · 128 F · 192 S | 102 s |
| V | 16 | 136 | 11 | 490 | 48 | 4,800 G · 256 F · 384 S | 150 s |

- A full board of one rank (six squads of `squadSize`), in `power`:

  | | I | II | III | IV | V |
  |---|---|---|---|---|---|
  | Warrior | 1,800 | 3,000 | 4,800 | 7,800 | 12,000 |
  | Cavalry | 2,520 | 3,960 | 6,480 | 10,440 | 17,280 |

### 6.4 Training a rank

The hall's training widget ([`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md)):

- **The portrait is a button.** It opens a drop-down, one row per rank:
  portrait, name, the four stats as values (never multipliers), the recruit
  cost. A locked rank shows its padlock and its reason — *Needs Warriors III*,
  *Barracks level 5*.
- **The selected rank is what the panel shows** — its stats, price and time —
  and what Train trains.
- **A newly unlocked rank becomes the selected one** in its hall. Training a
  lower rank is a choice the player makes.
- **One rank in a hall's line at a time.** While a batch of one rank is in
  the line, Train on another rank is gated: *Finish the current batch*.
- The owned-count pill counts the selected rank.

### 6.5 Everywhere else a troop is shown

- **The party picker** lists every rank owned as its own troop.
- **A squad on the board** wears its rank (the battle screen, the room
  sheet, an army on the world map), its own and the enemy's alike.
- **The Infirmary** holds and mends each rank apart, at
  `army.healCostShare` of that rank's own recruit cost (§4).

## 7. Damage

Per attack, from slot `A` onto slot `B`:

```
hits  = min(alive(A), frontage(A))
lead  = atk(A) − def(B)
step  = 1000 + min(1500, 50 × lead)        if lead ≥ 0   (per mille)
        1000 − min(750, 25 × −lead)        if lead < 0
raw   = max(1, hits × dmg(A) × step / 1000)            (floor)
dealt = raw × type_num / type_den          (integer division, floor)
```

- **The Heroes III rule**: each point of Attack over the target's Defence
  adds 5% to the damage, up to **+150%**; each point of Defence over the
  attacker's Attack takes 2.5% off, down to **−75%**. Both caps are reached
  at a lead of 30.
- Damage is never random.

`hp_pool(B) −= dealt`, then `alive(B)` recomputes. Troops are removed whole; the
remainder stays in the pool.

`dmg(A)` is its rank's own (§6) and already includes the hero troop bonus
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
(`villains`). The resolver has one code path and reads a resolved
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

- `troopDmgMult`, `troopHpMult` and `troopDefBonus` (flat, added to
  `def`) apply to **every squad on that side of the board whose type matches
  the hero's type**, regardless of slot or row.
- **No effect on non-matching types.**
- Multipliers from several heroes of the same type are additive on the excess:
  `1 + Σ(mult − 1)`; flat bonuses sum.
- **Bonuses are computed at battle start and persist if the hero dies.**

### 9.3 It has one skill

A hero or a villain carries one skill ([`10-heroes.md`](10-heroes.md) §2.5),
resolved to its rank when the board is built: a share as per-mille, a time
as ticks.

- **Timed** — its own countdown, beside the attack's, from the start of the
  fight, while the fighter lives; within a tick, after the fighter's own
  swing:

  | Skill | What it does | Target |
  |---|---|---|
  | **Sharpshot** · **Crush** | a hit at X‰ of its `dmg` | the enemy with least · most `hp_pool` |
  | **Cleave** | that hit | every enemy front-row slot (else every enemy) |
  | **Ambush** | that hit | the back-row enemy with least `hp_pool` (else any) |
  | **Volley** | that hit | every enemy slot |
  | **Mend** · **Wave** | heals X‰ of what the slot walked in with | the most wounded ally (least share, integer cross-multiplied) · every wounded ally |
  | **Shield** | a shield of X‰ of its own `hp`, soaking blows first; a new one replaces a smaller | the front-row ally with least `hp_pool` |
  | **Daze** | its next attack comes X ticks later | the enemy with the highest `dmg × hits` |

  - A skill's hit is one hit of `base`, through the Attack/Defence step and
    the type fraction (§7). Ties break by lowest slot id.
  - A heal never lifts a wiped slot, and brings troops back as the pool
    climbs.
- **Rally** — at battle start, to **every** squad on its side, on the
  passive's rules (added on the excess, standing if it falls): **War cry**
  +X% `dmg`, **Bulwark** +X `def`, **Vigour** +X% HP.
- **Spoils** are not the resolver's: the caller reads them off the board
  when it pays a won fight.
- **Villains** hold the world dungeons' boss rooms: a boss room's enemy is
  generated with every villain in its pool (§11).

### 9.4 A scaled villain

**Status: designed, not built.**

- A villain's authored block is its **floor**. Only the generator raises it,
  with budget a full board of rank-V squads cannot hold (§11).
- Its scale is `k = (authored power + the budget it takes) / authored power`:
  - `hp`, `dmg` and `power` × `k`;
  - `atk` and `def` +2 for every ×1.6 in `k`, as a troop's rank climbs (§6.2);
  - its skill, passive, type and `cooldown` are its own, unscaled.
- No ceiling: a villain takes whatever budget is left.

## 10. Ticks and victory

- One tick = **100 ms logical**, unrelated to frame rate.
- Each slot carries a countdown initialised to its `cooldown`.
- Per tick, in ascending slot order — attacker side first, then defender:
  decrement countdowns; every slot reaching 0 attacks and resets.
- **Victory:** all enemy slots at 0 → that side wins.
- **Timeout: 1,800 ticks** (three minutes). The **defender** wins. In PvE the player is always the
  attacker. There are no draws.

## 11. Enemy generation

Rooms carry a `power_req` budget and a `threatMix`
([`11-expeditions.md`](11-expeditions.md) §2). The generator converts
them:

1. Seed from the room's address — the dungeon, its depth and room. Same room, same enemies —
   the preview and the attempt are one query.
2. **Villains first**, because what is left is what the squads may cost. Above
   `combat.genVillainThreshold`, up to `combat.genVillainSlots` of them
   (three, the same hero slots the player fields) are drawn from the depth's
   `villainPool` (the Portal's: every villain), each costing its authored
   `power`.
3. Pick a slot count of 2–6, whichever is larger: the roll, or the number of
   squads the budget actually needs.
4. Split the budget across types, **the ruin's affinity first** and taking the
   lion's share (60%), the rest even across the others.
5. Per type: `count = floor(share / power)`, clamped to `squadSize`;
   overflow spills into a second squad of the same type, and whatever the
   shares leave on the table goes to the affinity while a slot remains.
6. **Evolved squads** (designed, not built). When six squads of rank I
   cannot hold the budget, the generator finds the lowest rank R at which
   they can and fields the board in **R−1 and R**, promoting as few squads to
   R as it needs — the affinity's (or the mix's heaviest) first. Each squad
   is one rank; counts are recomputed at its rank's `power`.
7. **Scaled villains** (designed, not built). Budget a board of rank-V squads
   cannot hold is split evenly across the villains on the board, drawn from
   the pool now if none were, and each is scaled (§9.4). Without a pool it is
   not fielded.
8. Rows are the unit's own: melee and flankers front, ranged back (§8).

**What fields what**, at today's budgets:

| Caller | Budget | Enemy |
|---|---|---|
| Province lairs | 60–1,000 | rank I |
| World camps | up to ~2,760 (inner ring) | rank II in the inner ring |
| World dungeon, depth 2 · its boss | 900–2,160 · ~3,460 | ranks I–II |
| World dungeon, depth 3 · its boss | 2,400–5,340 · ~8,540 | ranks II–IV, with villains |
| Dark Portal, floors 1–40 | 400 → ~16,400 | villains from floor 1; rank II from ~18, III ~24, IV ~29, V ~34; scaled villains past it |

**Overrides:** **a boss room always fields its authored villain**, never a
rolled one. A world dungeon's boss room fields a bigger budget instead
(`worldDungeon.bossMultiplier`, [`11-expeditions.md`](11-expeditions.md) §6).
Authoring a whole formation — named villains in named slots, beside chosen
squads — is designed and not built.

**Budget accounting:** a villain's `power` covers the buff it grants as well
as its own output, because it is authored rather than derived.

## 12. Power

Shown against `power_req` in the room sheet:

```
squad_power = count × power(rank)
party_power = Σ squad_power + Σ hero_power
hero_power  = dmg(hero at its level) × combat.heroPowerPerDmg
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
| `start` | Both boards, slot types, ranks, rows, applied bonuses, seed |
| `attack` | tick, source slot, target slot, `hits`, `dealt` (after a shield), and `skill` and `absorbed` when a skill struck or a shield soaked; `edge` (`adv` · `dis`) when the type chart was not even (§7) |
| `troops_lost` | tick, slot, new `alive`, new `hp_pool` |
| `skill` | tick (0 for a Rally), the fighter, the skill — the screen shows its name |
| `healed` | tick, slot, amount, new `alive`, new `hp_pool` |
| `shielded` | tick, slot, the shield now |
| `dazed` | tick, slot, the delay in ticks |
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
| **Barracks** | Warrior | 150 / 250 / 400 / 600 / 850 |
| **Spear Hall** | Lancer | 150 / 250 / 400 / 600 / 850 |
| **Shooting Grounds** | Archer | 150 / 250 / 400 / 600 / 850 |
| **Stables** | Cavalry | 150 / 250 / 400 / 600 / 850 |

- Levels 6–10 continue it: 1,100 / 1,400 / 1,750 / 2,150 / 2,600.
- **A soldier is one place in a hall, whatever it is worth in a fight.**
  `power` decides what a troop DOES and never what it costs to keep,
  so a Cavalry and a Warrior take the same room.
- Caps sum across buildings. Each unit type is behind its own technology, and
  each of its ranks behind one more and a hall level (§6).
- **What bounds a PARTY is the board** — six slots of `squadSize` (§3, §4) —
  and what bounds the board is what the city owns. The cap is the city's
  number; the board is the fight's.
- Training is queued at the building the player pressed TRAIN on, takes time,
  and is boostable there.
- **A building with someone in training shows it on the map**: the green
  glass bar its card wears, filled for the one in training now, holding the
  time left for the WHOLE line — and on its left end, the trainee's round
  portrait with the line's count (from two up), as the card's queue shows it.
- The Townhall level does not affect the cap.

## 15. Landmarks

A province landmark is claimed for Gold; it has no fight. A lair is a
formation the generator builds from its `guard`, fought on this board as a
room ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
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
| Unit stats, `frontage`, `squadSize`, `power` | `units` |
| Troop slots on the board, hero slots and their Gem ladder | `party.*` |
| Every rank's stats, recruit cost, training time and hall level | `units` (§6) |
| A rank's technology | `?dev=data#tree` |
| Attack/Defence step and caps, per mille | `combat.attackStepPerMille`, `attackCapPerMille`, `defenceStepPerMille`, `defenceCapPerMille` |
| Type fractions, as integer pairs | `combat.typeAdvantageNum/Den`, `combat.typeDisadvantageNum/Den` |
| Hero stat blocks, passives, the 70% share and the rarity multipliers | `heroes`, `heroes.rarity*` ([`10-heroes.md`](10-heroes.md) §9) |
| Villain stat blocks, per room | `villains` |
| Villain pool | every villain, on a world dungeon's boss rooms (§9.3); no key |
| Tick length, timeout | `combat.tickMs`, `combat.timeoutTicks` |
| Enemy slot band, villain threshold, share and slots | `combat.genSlotsMin/Max`, `combat.genVillainThreshold`, `genVillainShare`, `genVillainSlots` |
| What a hero is worth in the ESTIMATE | `combat.heroPowerPerDmg` |
| Army cap per building level | `buildings.armyCapPerLevel` |
| How much of a casualty is saveable, and how many beds there are | `army.woundedShare` (the floor), the Field medic's `heroes.skillValue`, `buildings.bedsPerLevel` |
| A skill: which, its X, how often | `heroes.skill`, `skillValue`, `skillEvery` (and `villains.*`) |
| Skill ranks | `heroLadder.skillRankLevels`, `skillRankStardust`, `skillRankMaterial`, `skillRankStep` |
| What mending costs against recruiting | `army.healCostShare`, `army.healTimeShare` |

## 18. Not in this version

- Any input during the fight
- Movement, pathfinding or facing
- Abilities on unit types; ultimates, energy, a skill the player triggers,
  or a skill that rolls
- A hero-only battle mode — a hero arena is a possible future
- Upgradeable `frontage` or `squadSize`
- Mixed ranks in a squad; two ranks in one hall's line
- Evolving a troop already trained
- Heroes inside troop slots, or bonuses to non-matching types
- Villains with levels or ascension — their stats are authored, and only the
  generator scales them (§9.4)
- Villain buffs crossing sides
- **A whole authored formation** — named villains in named slots beside chosen
  squads. A boss's villain is authored; the squads around it are still rolled
- Casualties *inside* the resolver, healing timers
- RNG in resolution
- Draws

**Pending:** `powerStart` re-authoring against the rank I–V power range
(**OQ-86**) · whether `power` reads a rank fairly (**OQ-138**).
