# Feature: Expeditions — ruins, delves and the army that matters

> Design doc for turning the fog's ruins into repeatable dungeons, and the dead
> army into the content that feeds the whole magic economy. Parties delve in
> **stages**, deciding at every checkpoint whether to go deeper or bank what they
> carry.
> Status: **designed, not implemented** (2026-09-02).

Companion docs: [`magic.md`](magic.md) (what artifacts do),
[`heroes-and-gacha.md`](heroes-and-gacha.md) (where heroes come from),
[`engine-seams.md`](engine-seams.md) (the machinery), and
[`balancing-v2.md`](balancing-v2.md) (the army-cap change).

## Why this exists

`src/sim/army.ts` is 24 lines: recruit, sum power, cap by Townhall level. There
is no combat, no defence and no consumption. The army exists as a quest gate and
a Gold sink, and `train_duration_seconds` is authored per unit and never read.

Meanwhile the 2026-09-01 positioning audit lists **"combat as a sink"** among the
four things worth keeping about the concept — *"the best guild of the week is the
best-managed economy"* — and identifies **lifetime** as the real bottleneck.

Expeditions turn one dead system into the engine for another. Revealing a ruin
does not hand you an artifact; it **discovers a dungeon**, which is a repeatable
content node rather than a one-time pickup. That is the difference between a fog
reward that ends and a faucet that runs for months.

## Summary of the change

| Today | With this feature |
|---|---|
| Army is recruited, summed, and never used | Army is the party that delves; supplies are the recurring sink |
| Army cap is `[10, 20, 30]` by Townhall level | Cap comes from **four military buildings** you choose to build |
| Warrior/Lancer/Archer/Cavalry differ only by cost | Each has **ATK/DEF/HP** and a place in a matchup chart |
| The fog returns more of a resource you already have | The fog holds **landmarks** and **ruins** |
| Nothing in the game is a decision under uncertainty | Every checkpoint is one |

## Resolved decisions (2026-09-02)

1. **A hero is mandatory.** Units never delve alone.
2. **Party slots start at 2** (hero + one unit); one more via research, the rest
   with Gems.
3. **Combat is a scoring pass, not a simulation.** No rounds, no targeting, no
   battle screen.
4. **Nothing is ever lost but the haul.** No unit casualties, ever.
5. **A failed push costs 50% of the carried haul** and ends the run.
6. **Delve timers never pause.** The 8 h offline cap governs the city's idle
   economy only.
7. **Standing orders ship in the prototype**, so both modes can be playtested.
8. **Military buildings raise the army cap; the Townhall no longer does.**

---

## 1. What the fog holds

| Found in the fog | Count | Gives | Verb |
|---|---|---|---|
| **Resources** | 42 features today | Wood, Stone, Iron, Food… | tap / work |
| **Landmarks** | 8–12 | +1 Mana/h each, permanently | claim |
| **Ruins** | 5 | Artifacts, Fragments, Knowledge | delve |

Three distinct rewards, so exploration always has something to find and each
answers a different need.

### Landmarks

Claiming comes in two flavours, which is what keeps them from being a formality:

- **Undefended** — pay a one-off **Gold** cost scaling with distance. A pure
  economic decision, and another sink on the fog's own curve.
- **Defended** — an enemy army holds it. Send a party to clear it, then claim.
  This gives combat a second job outside dungeons, and it is a **one-off
  encounter, not a permanent commitment**: the army is never locked up holding
  ground.

A contested landmark resolves through the same scoring pass as a delve depth
(§4), so it costs no new machinery — one threat profile per landmark.

---

## 2. The delve

Commit **one hero** plus **units** → pay **supplies** → the party clears one
**depth** at a time. After each depth it stops at a checkpoint and asks one
question:

> **Go deeper, or come back with what you're carrying?**

Deeper pays more. Failing loses **half the haul** and ends the run.

This is what gives a visit texture. A single long expedition produces one
decision per visit, so some visits contain nothing; staged depths produce three
or four, and the run is *self-terminating* — you push until you choose to stop.

### The five ruins

| Ruin | Distance | Tier | Base depth time | Growth | Max depth | Full clear | Supplies | Affinity |
|---|---|---|---|---|---|---|---|---|
| Hollow Barrow | ~3 | I | 3 min | ×1.15 | 5 | ~20 min | 20 Food + 50 G | Warrior |
| Sunken Chapel | ~6 | II | 5 min | ×1.20 | 7 | ~65 min | 40 Food + 150 G | Archer |
| Drowned Ironworks | ~8 | III | 8 min | ×1.25 | 9 | ~3.5 h | 60 Food + 400 G + 10 Iron | Lancer |
| The Counting House | ~10 | IV | 12 min | ×1.30 | 11 | ~9 h | 100 Food + 900 G + 20 Iron | Cavalry |
| Star Observatory | ~12 | V | 18 min | ×1.35 | 13 | ~1.5 days | 150 Food + 2000 G + 40 Iron | any |

`depthTime = base(tier) × growth^(depth − 1)`

Time grows **with depth inside a run**, not only across tiers. That is what makes
"one more depth" a real escalation — each further step is a longer commitment
before the next safe point — and it naturally caps how far anyone pushes in one
sitting. Tier I teaches the loop inside a single visit; Tier V is a multi-day
project held together by its checkpoints.

A ruin's **affinity** is the threat type dominating its depths, so a dungeon
rewards a composition rather than a single unit.

**Supplies are a flat cost at launch, not per depth.** The depth decision should
be purely risk against reward, with nothing else muddying it.

---

## 3. The party

**A hero is mandatory** — every party is one hero commanding troops. Heroes carry
a unit type of their own, so the hero choice feeds the same matchup chart as the
troops, and a second hero becomes valuable for **coverage** as well as for
concurrency.

**Party slots** start at 2 (hero + one unit) and expand to a maximum. One slot
unlocks through **research** — which gives the tech tree new leaves and a reason
to matter past the three-hour mark — and the rest cost **Gems**.

---

## 4. Combat: a scoring pass, not a simulation

Units carry three stats — **ATK, DEF, HP**. Each depth carries an authored
**threat profile** (type + strength). Resolving a depth is one deterministic pass
over the party:

- **ATK vs the threat**, multiplied by the type chart → did you clear the depth?
- **The threat vs DEF** → damage, absorbed by party HP.
- **HP does not regenerate between depths.** That is the attrition.

The type chart therefore does its work at **composition** time, which is where
the decision belongs in a management game. A tactical resolution would move the
decision inside a fight — a different genre, and one that eats the 30-minute
session budget. And the middle option is the worst of the three: simulating
combat in detail without showing it means the player sees only win or lose and
learns nothing from all that machinery.

| Beats | Why |
|---|---|
| **Lancer** → Cavalry | spears stop horses |
| **Cavalry** → Archer | horses run down bowmen |
| **Archer** → Warrior | arrows beat heavy infantry at range |
| **Warrior** → Lancer | shields close the gap on spears |

**×1.5 advantage / ×0.75 disadvantage.** Sharper values (×2/×0.5) are more
dramatic but make one bad guess feel like a wasted trip, which is the un-cozy end
of the dial.

**No battle screen.** Resolution is instant and reported at the checkpoint: what
you cleared, what it cost in HP, what you carry. The moment there is a fight to
watch, the game is spending its scarcest resource on the part that is not the
pitch.

Units return wounded and recover fully on reaching the city — no healing
management, no second timer.

---

## 5. The law on randomness, and how the gamble respects it

**A well-prepared run never fails.** Everything in §4 is deterministic, so a
party's **guaranteed depth** is computable and shown before launch.

The gamble is **information, not dice**: you do not know the next depth's threat
type until you commit to it. That preserves the law — you are never robbed by a
roll, you simply did not know what was down there — and it gives a hero trait
something to sell (**The Scout** reveals the next depth), turning information
into a purchasable advantage.

Attrition is what makes the risk curve **emergent rather than authored**: the
deeper you go, the more worn the party, so danger rises visibly on a depleting
bar instead of following a probability curve someone invented. It is also what
earns DEF and HP their place — a pure power score would not need them.

> Your economy decides how deep you go **safely**. Everything past that is a
> gamble you opt into, on information you chose not to wait for.

The audit's "best-managed economy wins" holds: the best economy fields the party
with the deepest guaranteed floor. Seeded RNG rolls only *which* fragments drop.

### Two rules that keep this cozy

- **The haul is not yours until you extract it.** That framing is what makes a
  50% loss legitimate under *"nada se te puede quitar"* — nothing you *own* is
  taken; you declined a sure thing. Identical logic to Mana overflow: unrealized
  gain, never property. **The UI must sell this from the first depth** or players
  will feel robbed whatever the technicality.
- **A checkpoint never expires.** The party waits at depth 3 indefinitely — no
  decision timer, no interrupt, no auto-fail while away. This is what stops the
  system becoming an interruption engine, and it turns a parked delve into a
  return hook: *"your party waits at depth 3 — 12 fragments so far."* The cost of
  not deciding is real but gentle: that hero stays committed until you do.

### Standing orders — the opt-out

Set **"delve to depth N, then return"** at launch and the whole run resolves
offline with no prompts. Push-your-luck becomes the engaged player's mode; anyone
else sets it and leaves. Deeper standing orders are exactly the comfort purchase
the audit says wallets should be buying. Ships in the prototype so both modes can
be compared directly.

---

## 6. Military buildings raise the army cap

Today `army.power_cap_per_townhall_level` is `[10, 20, 30]`, which makes army
size a passive consequence of a gate the player was going to pass anyway. That
moves into the city: **each unit type is trained by its own building, and
building and upgrading them is what raises the cap.**

| Building | Trains |
|---|---|
| **Barracks** | Warrior |
| **Spear Hall** | Lancer |
| **Shooting Grounds** | Archer |
| **Stables** | Cavalry |

Three things fall out, which is why the change is worth making:

- **Tiers IV–V become reachable by building, not by waiting.** The deepest ruins
  stop being locked behind a Townhall level and start being locked behind a city
  you chose to build — which is the pitch.
- **Composition costs map space.** Wanting Cavalry means placing Stables, so the
  type chart reaches back into the city-builder rather than living only in a
  party screen. This is the strongest link between the two halves of the game.
- **Four new districts** to place, level and fit into existing count caps and
  distance costs — reusing `districts.ts` wholesale.

`train_duration_seconds` (authored, currently unread) becomes live: army training
being instant stops making sense once units are expedition capital.

---

## 7. Rewards and throughput

- **Haul accumulates per depth** and banks only on extraction.
- **First clear of the max depth**: the ruin's artifact, guaranteed. No randomness
  on the thing that gates a system.
- **Repeat delves**: Fragments, Knowledge and resources, scaling with depth
  reached.
- **Hero XP** on every delve, banked or lost.

**Throughput is the throttle.** No cooldowns. Concurrency is limited by heroes
(one per delve), party slots, and units (committed until the party extracts). One
hero means one delve at a time, which makes the second hero a genuine prize.

**Delve timers never pause:**

> The offline cap limits what the **city produces** while you are away. It never
> limits what a **timer** does.

Timers already behave this way for the build queue and research
(`src/sim/save.ts:323`); delves join them.

---

## 8. UI

- **Expedition sheet** (from a discovered ruin): hero, party slots, supply cost,
  the **guaranteed-depth** read ("safe to depth 4"), the matchup read against the
  ruin's affinity, standing orders, one big green Launch.
- **Checkpoint**: party HP, haul so far, what is known about the next depth, and
  two choices of **equal visual weight** — *go deeper* and *take the haul*. It
  must read as an offer, never a threat, and must make plain that the haul is not
  banked yet.
- **Army loses its nav tab.** An army only matters at the moment it is sent
  somewhere, so composition is set inside the expedition sheet and the standing
  screen disappears.

## 9. Persistence

```
kingdom.delves    { ruinId, heroId, units[], depth, partyHp, haul{}, phase,
                    depthEndsAt, standingOrder }
kingdom.landmarks { claimed[], cleared[] }
city.army         + per-unit stats resolved from definitions, not stored
```

Additive, so no migrator — see `engine-seams.md` §4.

## 10. Implementation plan (separate commits)

1. `feat(sim):` unit stats + the type chart + the resolution pass. Pure function,
   heavily tested, no state changes.
2. `feat(sim):` the four military buildings; retire the Townhall army cap; make
   `train_duration_seconds` live.
3. `feat(sim):` landmarks — feature, claiming, contested clearing.
4. `feat(sim):` delves — depths, checkpoints, attrition, haul, the 50% rule,
   standing orders. Tests: one-call replay equals stepped ticking across a depth
   completion; a checkpoint survives an absence; guaranteed depth is exact.
5. `feat(render/ui):` expedition sheet, checkpoint, nav change.
6. `docs:` amend `00-design-intent.md`.

## 11. Out of scope

Tactical or round-based combat · a battle screen · unit casualties · healing
timers · permanent garrisons · per-depth supply costs · decision timers on
checkpoints · PvP · guild expeditions (the audit's stated moat, but a server
problem, not a prototype one).

## Open questions

Balance numbers are starting proposals. The one that most needs playtest rather
than argument is the **50% loss**: lower is gentler and may make pushing
automatic; higher bites but starts to feel like the loss aversion the positioning
rules out.
