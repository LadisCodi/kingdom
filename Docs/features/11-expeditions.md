# 11 · Expeditions — ruins, delves, the army and combat

> **Scope.** The army, what it is made of, how a fight is resolved, and the
> staged delve. What a ruin *pays* is [`10-heroes.md`](10-heroes.md) §4; what it
> *holds* is [`01-map-and-fog.md`](01-map-and-fog.md) §6.
>
> **Status: built**, minus contested landmarks — see
> [`15-social.md`](15-social.md) §6.

## 1. The rules, up front

1. **A hero is mandatory.** Units never delve alone.
2. **Combat is a scoring pass, not a simulation.** No rounds, no targeting, no
   battle screen.
3. **Nothing is ever lost but the haul.** No unit casualties, ever.
4. **A failed push costs 50% of the carried haul** and ends the run.
5. **A well-prepared run never fails.** The safe depth is computable and shown
   before launch.
6. **Delve timers never pause.** The offline cap governs the city's idle
   economy only.
7. **Military buildings raise the army cap; the Townhall does not.**

## 2. The delve

- Commit **one hero** plus **units** → pay **supplies** → the party clears one
  **depth** at a time.
- After each depth the party stops at a checkpoint: **go deeper, or come back
  with what you're carrying?**
- Deeper pays more. Failing loses half the haul and ends the run.
- The run is self-terminating: it ends when the player stops.

### The five ruins

| Ruin | Distance | Tier | Base depth | Growth | Max depth | Full clear | Supplies | Affinity |
|---|---|---|---|---|---|---|---|---|
| Hollow Barrow | ~3 | I | 3 min | ×1.15 | 5 | ~20 min | 20 F + 50 G | Warrior |
| Sunken Chapel | ~6 | II | 5 min | ×1.20 | 7 | ~65 min | 40 F + 150 G | Archer |
| Drowned Ironworks | ~8 | III | 8 min | ×1.25 | 9 | ~3.5 h | 60 F + 400 G + 30 S | Lancer |
| The Counting House | ~10 | IV | 12 min | ×1.30 | 11 | ~9 h | 100 F + 900 G + 60 S | Cavalry |
| Star Observatory | ~12 | V | 18 min | ×1.35 | 13 | ~1.5 days | 150 F + 2000 G + 120 S | any |

```
depthTime = base(tier) × growth^(depth − 1)
```

- Depth time grows with depth inside a run, not only across tiers.
- A ruin's **affinity** is the threat type dominating its depths.
- **Supplies are a flat cost at launch, not per depth.**

## 3. The party

- **A hero is mandatory.** Every party is one hero commanding troops.
- The hero's own unit type counts in the matchup chart.
- **Party slots** start at **2** (hero + one unit) and expand to **5**.
  - One slot unlocks through **research**.
  - The rest cost **Gems**: `25 × 2.2^purchased`.
- A party may carry **one relic** ([`09-relics.md`](09-relics.md) §5.1).

## 4. Combat — a scoring pass

- Units carry **ATK / DEF / HP**. Each depth carries an authored **threat
  profile** (type + strength).
- Resolving a depth is one deterministic pass over the party:
  - **ATK vs the threat**, multiplied by the type chart → is the depth cleared?
  - **The threat vs DEF** → damage, absorbed by party HP.
  - **HP does not regenerate between depths.**

| Unit | ATK / power | DEF | HP | Recruit | Train |
|---|---|---|---|---|---|
| **Warrior** | 3 | 3 | 12 | 50 G + 10 W + 20 F | 30 s |
| **Lancer** | 5 | 2 | 8 | 100 G + 30 W + 10 F | 40 s |
| **Archer** | 6 | 1 | 6 | 60 G + 30 W | 25 s |
| **Cavalry** | 7 | 2 | 10 | 150 G + 40 F + 60 S | 60 s |

- A unit's **power** — its cost against the army cap — equals its ATK.
- Archers: most ATK per Gold, least survivability. Warriors: the opposite.

| Beats | Why |
|---|---|
| **Lancer** → Cavalry | spears stop horses |
| **Cavalry** → Archer | horses run down bowmen |
| **Archer** → Warrior | arrows beat heavy infantry at range |
| **Warrior** → Lancer | shields close the gap on spears |

- **×1.5 advantage / ×0.75 disadvantage.**
- The type chart applies at **composition time**; there is no in-fight decision.
- **No battle screen.** Resolution is instant and reported at the checkpoint:
  what was cleared, what it cost in HP, what is carried.
- **Units return wounded and recover fully on reaching the city.** No healing
  management, no second timer.

## 5. Determinism and information

- **A well-prepared run never fails.** Everything in §4 is deterministic, so a
  party's **guaranteed depth is computable and shown before launch.**
- The gamble is **information, not dice**: the next depth's threat type is
  unknown until the party commits to it.
- **The Scout** reveals the next depth's threat.
- Attrition makes the risk curve emergent: the deeper the run, the more worn
  the party.
- Seeded RNG rolls only *which* rewards drop.
- The safe depth assumes the **worst matchup the depth can produce**, not the
  ruin's affinity. The threat draw is weighted toward the affinity but can
  produce any of the four types.

### Two rules that keep this cozy

- **The haul is not the player's until extracted.** A 50% loss is unrealised
  gain, never property — the same logic as Mana overflow. The UI must make
  this plain from the first depth.
- **A checkpoint never expires.** The party waits at a depth indefinitely: no
  decision timer, no interrupt, no auto-fail while away. The hero stays
  committed until the player decides.

### Standing orders — the opt-out

- Set **"delve to depth N, then return"** at launch; the run resolves offline
  with no prompts.
- Both modes ship: push-your-luck and standing orders.

## 6. Military buildings raise the army cap

Each unit type is trained by a building, each gated behind the military branch.

| Building | Trains | Cap per level |
|---|---|---|
| **Barracks** | Warrior · Lancer · Archer | 6 / 10 / 15 |
| **Spear Hall** | Lancer | 6 / 10 / 15 |
| **Shooting Grounds** | Archer | 6 / 10 / 15 |
| **Stables** | Cavalry | 6 / 10 / 15 |

- The Barracks trains every foot soldier; the Stables trains Cavalry. Each unit
  is still behind its own technology.
- The Spear Hall and Shooting Grounds are specialists, not sole sources: a
  parallel training line plus army cap.
- Training is queued at a specific hall (the card the player pressed TRAIN on).
- **Training takes time**, boostable at the relevant hall.

The cap curve lines up with the five ruins:

| Military development | Army cap | Unlocks |
|---|---|---|
| One building, L1 | 6 | Tier I (difficulty 6) |
| Two buildings, one at L2 | 16 | Tier II (14) |
| All four, L1 | 24 | Tier III (24) |
| All four, L2 | 40 | Tier IV (36) |
| All four, L3 | 60 | Tier V (50) |

- Tiers IV–V are reached by building, not by Townhall level.
- A full roster of Warriors at cap 24 fields 24 effective ATK against a neutral
  depth and 18 against an unfavourable one: Tier III is clearable with the
  right composition and not with the wrong one.

## 7. Rewards and throughput

- **The haul accumulates per depth** and banks only on extraction.
- **First clear of the max depth** pays the ruin's **relic, guaranteed**, plus
  **500 Gems** and a **150 Stardust** lump — both banked immediately, not on
  extraction.
- **A cleared ruin drips 2 Stardust/h, forever.** Discovery pays nothing.
- **Repeat delves** pay ingredients, Stardust and resources, scaling with depth
  reached: 25 Gold, 4 material and 6 Stardust per depth per tier.
- **Hero XP** on every delve — written and never read
  ([`10-heroes.md`](10-heroes.md) §9).
- **Throughput is the throttle.** No cooldowns. Concurrency is limited by
  heroes (one per delve), party slots, and units (committed until the party
  extracts).

## 8. Landmarks, and the four that cannot be claimed

- **Undefended** — pay a one-off Gold cost, authored per sanctuary in tiers
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6).
- **Defended** — an enemy army holds it. Clear it, then claim. A **one-off
  encounter, not a permanent commitment**: the army is never locked up holding
  ground.
- A contested landmark resolves through the same scoring pass as a delve depth:
  one threat profile per landmark.
- **Four of the ten are defended and none can be claimed** (not built: nothing
  writes the cleared flag). Clearing them is a siege that scales from one
  player to ten: [`15-social.md`](15-social.md) §6. **OQ-35.**

## 9. The screens

- **Expedition sheet** (from a discovered ruin): hero, party slots, the relic
  slot, supply cost, the **guaranteed-depth** read (*safe to depth 4*), the
  matchup read against the ruin's affinity, standing orders, one big green
  Launch.
- **Checkpoint**: party HP, haul so far, what is known about the next depth,
  and two choices of **equal visual weight** — *go deeper* and *take the haul*.
  It reads as an offer, never a threat, and makes plain that the haul is not
  banked yet.
- **A delve pill**, so a parked party is visible without a screen.
- **The army has no nav tab.** Composition is set inside the expedition sheet.

## 10. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| **Failed-push haul loss** | **50%** — the number that most needs playtest | `delve.fail_haul_loss` |
| Type advantage / disadvantage | ×1.5 / ×0.75 | `army.type_advantage`, `…_disadvantage` |
| Per-tier depth curve, supplies, affinity | §2 | the map editor |
| Damage per strength, absorbed per defence | 0.9 / 0.5 | `army.damage_*` |
| Threat floor fraction | 0.4 | `army.threat_floor_fraction` |
| Haul per depth per tier | 25 G · 4 material · 6 Stardust · 1 piece | `delve.*` |
| First clear | 500 Gems + 150 Stardust | `delve.first_clear_*` |
| Party slots | 2 → 5, `25 × 2.2^n` Gems | `party.*` |
| Army cap per hall level | 6 / 10 / 15 | `Districts.army_cap_per_level` |
| Unit stats and train time | §4 | `Units` sheet |

## 11. Deliberately not in this design

- Tactical or round-based combat
- A battle screen
- Unit casualties
- Healing timers
- Permanent garrisons
- Per-depth supply costs
- A decision timer on a checkpoint
- PvP
- An army cap that comes from the Townhall level

**Open questions:** OQ-35, OQ-40, OQ-41.
