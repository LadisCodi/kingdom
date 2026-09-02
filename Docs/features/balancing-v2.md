# Balancing v2 — the numbers this pass changes

Second deliberate balance pass, following `balancing-v1.md`. It does three
things: fixes four holes that make the current economy unmeasurable, moves the
army cap out of the Townhall and into the city, and gives the new systems in
`magic.md`, `expeditions.md` and `heroes-and-gacha.md` their starting numbers.

Everything here lives in `balance/balance.xlsx` and reaches the game through
`npm run balance`. Numbers are **starting proposals** in the tradition of
`harvest-loop.md` §7: change the tables, not the design.

---

## Part 1 — Unblockers

None of the tuning below means anything until these land.

### 1. The house tap is unbounded

`houseTap` (`src/sim/population.ts:123-136`) rewinds the **city-wide** tax clock
by `taxes.tap_boost_seconds` and is **ungated for deliberate taps**
(`src/game.ts:265`). Gold per tap is `2 × rate / 60`, which at Townhall 3 with 30
housed villagers is **30 Gold per tap ≈ 9,000 Gold/min** against 900 Gold/min
idle. It is the only tap in the game with no exhaustion analogue.

**Fix:** give Housing a **tax cycle** with a progress bar, exactly like the
Townhall's training cycle. Tapping fast-forwards *within* the current cycle and
cannot exceed it. Buildings then behave consistently — tapping means "collect
early", not "print money" — and the idle backbone the design depends on becomes
the dominant income again.

### 2. Fog costs one Gold per tap

`FOG.goldPerTap = 1` on a doubling ring curve (`src/sim/fog.ts:24-41`): a single
distance-9 iron vein is **320 individual taps**, and the whole map is 194,142.
`handleHold` deliberately repeats collect taps only (`src/game.ts:328-356`).

**Fix:** extend hold-to-repeat to reveal taps. The plumbing already exists —
`handleHold` returns `boolean` and `input.ts` carries the hold machinery from
`feature/ui-foundations`. This is the difference between the differentiator being
filmable and being punishing.

### 3. Gem faucet versus the new sinks

25 Gems are obtainable in the whole game (10 at start, 5 at quest 17, 10 at quest
27), against 40 needed for both research slots alone. `balancing-v1.md` claims
these balance; the arithmetic is simply wrong and `research.max_slots: 3` is
unreachable. This pass adds three more Gem sinks — attunement slots, party slots
and gacha pulls.

**Fix:** Gems need a recurring faucet, not a one-time chain.

| Source | Gems |
|---|---|
| Starting grant | 10 |
| Quest chain (unchanged) | 15 |
| **Each ruin first-cleared** | **10** (50 total) |
| **The Conjunction, weekly** | **5** |

That is 75 up front and ~20/month recurring — enough to reach a second
attunement slot and a third party slot by play, with the gacha as the paid
accelerator. Consistent with the rule in `heroes-and-gacha.md`: the wallet buys
speed and breadth, never access.

### 4. Housing capacity contradicts its own doc

The workbook ships `population_capacity = [2, 4]`; `balancing-v1.md` documents
`[1, 2]` and derives every pacing number from it. Real income is therefore 2–3×
the design target, and every statement in that doc ("TH1 ≈ 60 g/min idle", "TH2 ≈
240 idle") is stale.

**Fix: adopt `[1, 2]`, the documented value.** The three-era arc was tuned around
it, the sinks in that doc keep their intended weight, and it leaves headroom for
the Mana and supply sinks this pass adds. Update the derived tables in
`balancing-v1.md` in the same commit so the two stop disagreeing.

### 5. `train_duration_seconds` is authored and never read

Per-unit values exist (30/40/25/60) but army training is instant. Once units are
expedition capital rather than a quest gate, instant training removes the only
pacing on party size.

**Fix:** make it live, tap-boostable at the relevant military building, and
completing through the same `advance()` boundary as everything else.

---

## Part 2 — Military buildings and the army cap

`army.power_cap_per_townhall_level = [10, 20, 30]` is retired. Army size stops
being a passive consequence of a gate the player was going to pass anyway and
becomes a city-building decision.

Each unit type gets a building, gated behind the **military tech branch that
already exists** (`Warrior`, `Spears`, `Archery`, `Cavalry`) — techs that today
unlock units which do nothing.

| Building | Trains | Tech | Build cost | Time | Max level | Count cap |
|---|---|---|---|---|---|---|
| **Barracks** | Warrior | Warrior | 60 W + 20 S | 45 s | 3 | 1 |
| **Spear Hall** | Lancer | Spears | 80 W + 30 S | 60 s | 3 | 1 |
| **Shooting Grounds** | Archer | Archery | 80 W + 30 S | 60 s | 3 | 1 |
| **Stables** | Cavalry | Cavalry | 120 W + 40 S + 10 Iron | 90 s | 3 | 1 |

**Cap contribution per level: 6 / 10 / 15** (total, not incremental).

That produces a curve that lines up exactly with the five ruins:

| Military development | Army cap | Unlocks |
|---|---|---|
| One building, L1 | 6 | Tier I (difficulty 6) |
| Two buildings, one at L2 | 16 | Tier II (14) |
| All four, L1 | 24 | Tier III (24) |
| All four, L2 | 40 | Tier IV (36) |
| All four, L3 | 60 | Tier V (50) |

Tiers IV–V therefore become reachable **by building, not by waiting** — the
"somewhere to go" the prototype lacks once Townhall 3 lands at ~3 hours.

---

## Part 3 — Unit stats

Units gain **ATK / DEF / HP** (see `expeditions.md` §4). A unit's `power` — what
it costs against the army cap — equals its ATK, so the cap table above reads
directly as attack potential.

| Unit | ATK / power | DEF | HP | Recruit cost (unchanged) |
|---|---|---|---|---|
| **Warrior** | 3 | 3 | 12 | 50 G + 10 W + 20 Food |
| **Lancer** | 5 | 2 | 8 | 100 G + 30 W + 10 Food |
| **Archer** | 6 | 1 | 6 | 60 G + 30 W |
| **Cavalry** | 7 | 2 | 10 | 150 G + 40 Food + 20 Iron |

The trade is deliberate: Archers buy the most ATK per Gold and the least
survivability, so a glass party clears shallow depths cheaply but cannot sustain
a deep push, where attrition decides. Warriors are the opposite. Neither is
correct on its own, which is the point.

**Type chart: ×1.5 advantage, ×0.75 disadvantage.** Lancer → Cavalry → Archer →
Warrior → Lancer.

A full roster of Warriors at cap 24 fields 24 effective ATK against a neutral
depth, 18 against an unfavourable one — so Tier III is exactly clearable with the
right composition and not with the wrong one.

---

## Part 4 — New system numbers

Full context for each of these is in its own doc; collected here so the workbook
has one place to read from.

### Mana (`magic.md`)

| | TH1 | TH2 | TH3 |
|---|---|---|---|
| Base production / h | 4 | 5 | 6 |
| Base cap | 24 | 32 | 40 |

Sanctum: +12 cap per level, 3 levels. Landmarks: +1 Mana/h each, 8–12 on the map.
Artifact upkeep 1–3 Mana/h, flat. Attunement slot swap lock: 5 min.

**Tuning law: `cap ≈ 8 × net regen`** — keeps "an overnight absence fills the
pool" true at every stage, and is the constraint every future number here must
respect.

### Collection (`heroes-and-gacha.md`)

Level cost `round(20 × 1.6^level)`, max level 10 → ≈3,630 Knowledge to max one
collectible. Knowledge drip 2/h per discovered ruin.

### Delves (`expeditions.md`)

| Tier | Difficulty | Base depth time | Growth | Max depth | Supplies |
|---|---|---|---|---|---|
| I | 6 | 3 min | ×1.15 | 5 | 20 Food + 50 G |
| II | 14 | 5 min | ×1.20 | 7 | 40 Food + 150 G |
| III | 24 | 8 min | ×1.25 | 9 | 60 Food + 400 G + 10 Iron |
| IV | 36 | 12 min | ×1.30 | 11 | 100 Food + 900 G + 20 Iron |
| V | 50 | 18 min | ×1.35 | 13 | 150 Food + 2000 G + 40 Iron |

`depthTime = base × growth^(depth − 1)`. Depth difficulty and threat strength
both rise with depth. Failed push: **50%** of the carried haul.

---

## Part 5 — Sheets touched

| Sheet | Change |
|---|---|
| `Currencies` | New `Mana` row with a real `cap`; Knowledge gains faucets and sinks |
| `Settings` | `mana.*`, `attunement.*`, `delve.*`, `gacha.*`; `taxes.tap_boost_seconds` semantics change with the housing cycle |
| `Districts` | Four military buildings + the Sanctum; `population_capacity` → `[1, 2]` |
| `Units` | `atk`, `def`, `hp`; `train_duration_seconds` becomes live |
| `Map` | Ruin and Landmark features |
| `Quests` | Gem rewards rebalanced |
| **New:** `Artifacts` | Passive, upkeep, active, costs, level curve |
| **New:** `Heroes` | Type, trait, level curve |
| **New:** `Ruins` | Tier, depth curve, supplies, affinity, threat profiles |
| **Removed** | `army.power_cap_per_townhall_level` |

Event and banner **schedules do not go in the workbook** — see
`engine-seams.md` §5.

## Status (2026-09-02)

Everything in Parts 1–4 landed. Two numbers need a second pass:

- **The Gem faucet overshot.** §1.3 budgets 75 up front; it is 110 (10 start +
  50 quests + 50 ruin first-clears), because the eleven quests added to the
  chain were given Gem rewards without re-deriving the total. The sinks are
  unchanged, so slots and pulls are cheaper in practice than intended.
- **`balancing-v1`'s income tables are annotated as corrected but not
  recomputed.** The `[1, 2]` capacity fix makes them right again in principle;
  nobody has re-run the arithmetic.

The tier ladder in Part 2 IS verified — `tests/expeditions.test.ts` asserts that
each rung of military development opens the next tier and leaves the one after
it a stretch, against a `guaranteedDepth` that assumes the worst matchup.

## Future work (noted, not in this pass)

- `kingdom.max_builders` is authored 4 and nothing raises it past 1, so all of
  `queue.ts`'s promotion logic remains unreachable.
- Only one adjacency rule exists (Housing↔Housing −1); spatial play is still thin
  even with the new districts competing for space — and this pass added five
  more buildings competing for the same ground, so the gap widened.
- `Desert` remains a declared terrain with zero cells.
