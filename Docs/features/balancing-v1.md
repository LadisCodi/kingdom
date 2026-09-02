# Balancing v1 — the three-era arc

> **PARTLY SUPERSEDED by [`balancing-v2.md`](balancing-v2.md) (2026-09-02),
> and again by
> [`currency-simplification.md`](currency-simplification.md) the same day** —
> Iron is no longer a currency (a vein is a rich Stone node, 1 Iron = 3 Stone),
> and the technology tree is priced in Gold from the city purse rather than in
> Knowledge. Every Iron figure below reads as Stone at triple.
>
> **PARTLY SUPERSEDED by [`balancing-v2.md`](balancing-v2.md) (2026-09-02).**
> Four things below no longer hold, and they are marked inline: the housing
> capacity this document assumes was never what shipped, TH3 is no longer the
> endgame, the army cap moves out of the Townhall, and most of the "future work"
> list is now designed. The three-era arc itself stands.
>
> **Update (implementation):** the housing capacity is fixed. The workbook now
> ships `[1, 2]` — the value this document always documented and derived every
> pacing number from — so the income tables below are correct again rather than
> 2–3x optimistic. The house tap is bounded by a collection cycle too, so "tap
> income" is capped at `taxes.tap_boost_seconds` of *city* income per cycle
> instead of scaling without limit.

The first deliberate balance pass. Before it the progression was flat: 8 of
10 technologies hung directly off Forestry, the Townhall stopped at level 2,
building upgrades had no tech gates, and the quest chain dead-ended at
quest 18. This pass shapes the game into **three eras gated by the
Townhall**, with **technologies as the keys inside each era** — including a
new mechanic: per-level tech gates on building upgrades
(`required_tech_per_level` in the Districts sheet).

Pacing target (decided, tunable): **snappy** — TH2 reachable in ~25–35 min
of active play, TH3 at ~2–3 h cumulative.

## The era arc (Townhall level = era)

| | TH1 — Founding | TH2 — Expansion | TH3 — Prosperity |
|---|---|---|---|
| Target time | 0–30 min | 30 min – 2.5 h | ~~endgame (for now)~~ **no longer the endgame** — see the note below |
| Population cap | 2 (2 houses × 1) | 8 (4 houses × 2 w/ Urban Planning) | 12 (6 × 2) |
| Housing count cap | 2 | 4 | 6 |
| Sawmill/Quarry/Docks/Mine cap | 1 | 2 | 3 |
| Farm / FarmLands cap | 1 / 6 | 1 / 6 | 2 / 12 |
| Army power cap | ~~10~~ | ~~20~~ | ~~30~~ — **retired**, see below |
| Gate to next TH level | 40 Wood + 20 Stone, 30 s | 156 Wood + 78 Stone, 120 s + **Architecture** (15 Iron) | — |

The Townhall upgrade formula can't add a currency at a single level, so
Iron enters the TH3 gate through the **Architecture** technology instead —
which keeps the fog trek to the iron veins (~640 Gold to distance 8–9) a
TH2-era project, not a wall in the tutorial.

## New technologies (6) — building-level keys

| Tech | Requires | Cost | Time | Unlocks |
|---|---|---|---|---|
| Urban Planning | Forestry | 200 G + 50 W | 60 s | Housing L2 (+1 resident) |
| Crop Rotation | Farming | 300 G + 30 Food | 75 s | Farm L2 |
| Engineering | Masonry | 500 G + 60 Stone | 90 s | Quarry L2, Sawmill L3 |
| Shipbuilding | Fishing | 400 G + 40 W | 90 s | Docks L2 |
| Deep Mining | Mining | 800 G + 30 Stone | 120 s | Mine L2 |
| Architecture | Communities | 600 G + 15 Iron | 120 s | Townhall L3 |

Tree depth goes from 3 to 5 (Forestry → Masonry → Engineering →
Architecture). 16 techs total ≈ **4,475 Gold**.

## Per-level gates (the new mechanic)

`required_tech_per_level` on the Districts sheet, indexed like
`required_townhall_level_per_level` (entry 0 = requirement to REACH level
2; `-` = none). Enforced in `upgradeDistrict`, surfaced on the district
card ("Research X required") and in the research-complete banner
("Housing can now reach level 2").

| District | maxLevel | L2 requires | L3 requires | Upgrade cost |
|---|---|---|---|---|
| Housing | **2** (was 1) | Urban Planning | — | 30 W + 10 S, 20 s |
| Farm | 2 | TH2 + Crop Rotation | — | 50 W |
| Sawmill | 3 | — | TH2 + Engineering | 60 W → 150 W (was free) |
| Quarry | 2 | TH2 + Engineering | — | 40 W |
| Docks | 2 | TH2 + Shipbuilding | — | 35 W |
| Mine | 2 | TH2 + Deep Mining | — | 50 W + 25 S |
| Townhall | **3** (was 2) | — | Architecture | 40 W + 20 S → 156 W + 78 S |

Housing capacity is now **per level** (`population_capacity` is a list:
`1,2`) — a level-2 house holds 2 villagers, so Urban Planning doubles the tax
base without new map footprint (and without new crowding penalties).

> **DATA DRIFT, resolved 2026-09-02.** The shipped workbook carries `2,4`, not
> the `1,2` this document assumes, so the real Townhall-3 population cap is 30
> rather than 12 and idle income is 900 Gold/min rather than 360. **Every income
> and pacing figure in this file is therefore 2–3× optimistic as written.**
> `balancing-v2.md` §1.4 adopts the documented `1,2`; the tables here become
> correct again once that lands.

## Retuned numbers

- **House tap boost 5 s → 2 s** (`taxes.tap_boost_seconds`). At the 0.5 s
  collect cooldown active tapping is now ~5× idle income (was 10×), so the
  sinks below keep their weight. Income: TH1 ≈ 60 g/min idle / ~300
  tapping; TH2 with Urban Planning (8 housed) ≈ 240 idle / ~1,200 tapping.
- **2nd-instance cliff softened** for Sawmill/Quarry/Docks/Mine:
  `build_cost_multiplier` 4 → 2.5, exponent 1.45 → 1.15. The 2nd instance
  now costs ×5.5 instead of ×10.9 (Sawmill 20 → 110 → 353). Farm base
  10 W → 30 W (it's an automation building behind a 250 G tech).
- **Iron leaves the early army**: Swordsman 50 G + 10 W + 20 Food,
  Archer 60 G + 30 W, Cavalry 150 G + 40 Food + 20 Iron. Iron's sinks are
  now Cavalry, Deep Mining and Architecture — all TH2/3-era.
- Dead data cleaned: `Food.start` 5 → 0 (was never read), Townhall
  upgrade no longer instant, Sawmill upgrades no longer free.

### Era budget (why the numbers land where they do)

TH2-era sinks ≈ 4,300 Gold (new techs ~2,800 + fog-to-Iron ~640 +
buildings/upgrades ~900). At the mixed-play average (~40–60 g/min) that's
~2–2.5 h; a heavy tapper compresses it to ~1 h. TH1-era sinks (Forestry 75,
Agriculture 100, Masonry 100, first buildings, TH2 at 40 W + 20 S) fit in
~25–35 min with the quest-chain payouts (855 G through quest 17) covering
most of the tech bill.

## Quest chain: 18 → 27

**FirstSoldier moved** from #17 into the TH2 era (it used to demand Iron —
a ~640-Gold fog trek — before TH2). **A proper capital** (TH2) now pays the
first **5 Gems**; the chain continues:

| # | id | Goal | Reward |
|---|---|---|---|
| 18 | MoreRoom | Research Urban Planning | 60 G |
| 19 | SecondStory | Housing to L2 | 75 G |
| 20 | FullHouse | Population 6 | 75 G + 20 Food |
| 21 | FirstSoldier | Train 1 army unit | 100 G |
| 22 | RunningWater | Research Farming | 60 G |
| 23 | Farmhand | Build a Farm | 80 G |
| 24 | IronRoad | Collect 10 Iron | 120 G |
| 25 | TheMine | Build a Mine | 120 G |
| 26 | Architect | Research Architecture | 150 G |
| 27 | GrandCapital | Townhall to L3 | 300 G + **10 Gems** |

Quests now carry a `reward_gems` column — the game's first gem faucet
(paid into the **player** wallet). Starting 10 + 15 from the chain ≈ both
extra research slots (10 + 30).

## Future work (noted, not in this pass)

Status as of 2026-09-02 — most of this list is now designed:

| Item | Status |
|---|---|
| `kingdom.max_builders` authored 4, nothing raises builders past 1 | **still open** — `queue.ts`'s promotion logic remains unreachable |
| Knowledge currency has no faucet or sink | **designed** — the levelling currency for artifacts and heroes ([`magic.md`](magic.md), [`heroes-and-gacha.md`](heroes-and-gacha.md)) |
| `train_duration_seconds` authored but training is instant | **designed** — goes live in [`balancing-v2.md`](balancing-v2.md) §1.5 |
| The army has no combat — a Gold/Iron sink and quest content | **designed** — ATK/DEF/HP, a matchup chart and staged delves ([`expeditions.md`](expeditions.md)) |
| Only one adjacency rule; spatial play is thin | **partly** — five new districts (four military + the Sanctum) compete for space, but no new adjacency rules |
| More gem sinks once the faucet exists | **designed** — attunement slots, party slots, gacha pulls, Mana refills; the faucet is rebalanced in `balancing-v2.md` §1.3 |

### The Townhall stops being the only gate

TH3 was "endgame (for now)" because nothing existed past it. Three arcs now run
past it at different speeds:

- **Military buildings** gate army size and therefore delve depth — Tiers IV and
  V of [`expeditions.md`](expeditions.md) need a cap of 36 and 50, reachable only
  by building and upgrading all four. `army.power_cap_per_townhall_level` is
  removed.
- **The Mana economy** (production from landmarks, capacity from the Sanctum)
  gates how many artifacts can be worn.
- **Knowledge and Fragments** gate artifact and hero levels, on a curve measured
  in weeks rather than hours.
