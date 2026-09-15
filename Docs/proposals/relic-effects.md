# Proposal — what the relics do

> **What this is.** Every relic's **passive** and its **active**, level by
> level — the five that exist (§3, §4) and the **three that have to be
> created** to reach the eight albums the collection now needs (§6). It is a
> **proposal**, not a feature doc: nothing here is built, and every number is a
> first pass.
>
> **It decides one open thing on purpose.**
> [`../features/07-research.md`](../features/07-research.md) §6 plans for the
> relic actives to leave and become **spells in the Magic tome**, and
> [`../features/09-relics.md`](../features/09-relics.md) §1 already says *"a
> relic has no active"*. This keeps the actives **on the relics** and builds
> them out instead. The two are not compatible — **OQ-98**.

## 1. What the five do today

| Relic | Passive | Stat | L1 | Per level | Active | Mana | Duration |
|---|---|---|---|---|---|---|---|
| **Dowsing Rod** 🔮 | forests, crops and stone recover faster | `cellRecovery` mul | ×0.85 | **−0.05** | **Divination** — pays a frontier cell's remaining reveal cost | 8 | instant |
| **Verdant Seal** 🌱 | berries, game and shoals come back sooner | `cellRespawn` mul | ×0.85 | **−0.05** | **Bloom** — clears exhaustion within radius 2 | 6 | instant |
| **Foreman's Sigil** ⚡ | every worker carries more | `workerYield` **add** | +1 | +0.5 | **Haste** — `workerYield` ×2 | 10 | **60 min** |
| **Gilded Ledger** 🪙 | your villagers pay more tax | `taxRate` mul | ×1.10 | +0.10 | **Beckon** — calls a depleted resource back | **0** | instant |
| **Wanderer's Compass** 🧭 | rooms pay more Stardust | `stardustYield` mul | ×1.25 | +0.25 | **Beckon** — *the same one* | 5 | instant |

Seven things are wrong with that table.

- **Two passives die.** The Rod and the Seal fall 0.05 a level and read `0.00`
  at **level 18**. **OQ-97.**
- **One passive is flat on a growing base.** The Sigil's `+1 a worker` is the
  biggest number in the game on day two and a rounding error on day twenty.
- **Two relics share one active**, so the fourth has no ability of its own.
- **One active is free.** The Ledger's `Beckon` costs **0 Mana**.
- **Four of five actives are instant**, so only one is a decision about *when*.
- **No active reads the relic's level**, so the permanent ladder and the
  ability never meet.
- **Nothing stops a player casting on every cooldown-free tick** but the Mana
  pool, and a pool hoarded across an absence empties in seconds.

## 2. The shape

- **A relic is one idea at two speeds.** The passive is that idea always on;
  the active is the same idea as a **zone on the map**, for a window, bought
  with Mana.
- **A zone is placed.** Select-then-place, the idiom placement and casting
  already use: the grid lights what the zone would cover before a tap is
  spent finding out.
- **Zones may overlap.** The cooldown is what stops a player carpeting the
  map, so an overlap is a real choice — an area taking two effects is an area
  somewhere else taking none, and chaining the Rod's recovery under the Seal's
  harvest is a combination worth finding rather than a rule to police.
- **An active walks three states: ACTIVE → COOLDOWN → READY.** It cannot be
  recast while its own window is still open, the **5-minute cooldown starts
  when that window closes**, and only then does the relic light up again.
  A cooldown counted from the cast would be decoration: a 10-minute window on
  a 5-minute cooldown is 100% uptime.
- The relic's card shows which of the three it is in, and the countdown derives
  from a timestamp rather than a decremented integer, so a throttled tab comes
  back correct.
- **A cooldown never shrinks with level.** A shrinking cooldown is a discount
  and dies; and a relic that did more *and* did it more often would grow on
  two axes at once.

### 2.1 Every number points up

- **A passive is a multiplier above 1, or a flat term on a base that does not
  grow.** Never a discount, a cost or a time: a falling number has a floor,
  and a floor is a ceiling on a ladder with no top.
- Where the game owns a **time**, the relic owns the **speed** and the call
  site divides by it: ×2 is half the wait, ×5 a fifth, and no level reaches
  zero.

### 2.2 One growing axis per active

An active has four numbers — power, duration, radius and cooldown. **One of
them grows smoothly with the level, one steps at three named levels, and the
other two never move.**

| Relic | Grows every level | Why that one |
|---|---|---|
| **Dowsing Rod** | **duration** | the zone's worth is how many nodes exhaust inside it, which is time |
| **Verdant Seal** | **taps per Mana** | §3.2 — the spell IS a Mana exchange rate |
| **Foreman's Sigil** | **power** | a crew either works faster or it does not; a longer window is just a longer wait |
| **Gilded Ledger** | **taps per Mana** | §3.2 |
| **Wanderer's Compass** | **radius** | for a reveal, more ground IS the effect, so its step ladder is its whole growth |

### 2.3 Radius steps, and it steps loudly

**Radius is the same three-rung ladder on every relic**, and it is deliberately
the one number that does not creep:

| | **L1–4** | **L5** | **L10** | **L20** |
|---|---|---|---|---|
| Radius | 2 | **3** | **4** | **5** |
| Cells covered | 25 | **49** | **81** | **121** |

- A Chebyshev radius covers `(2r+1)²` cells, so each rung is roughly **double
  the ground**. That is exactly why it is a step and not a slope: a number
  that doubles cannot creep, but it makes a superb milestone.
- **Three loud jumps beat twenty quiet ones.** A player two cards from
  level 5 knows precisely what those two cards buy, which is what a collection
  wants its ladder to feel like.
- **Cooldown never moves**, at any level. A relic that did more *and* did it
  more often would grow on two axes at once, and a shrinking cooldown is a
  discount wearing a hat.

## 3. The five

### 3.1 The zones

| Relic | Passive — always on | Active — a zone | Mana |
|---|---|---|---|
| **Dowsing Rod** 🔮 | resource nodes **recover faster** | every node in the zone refills **at once**, and recovery runs **×5** inside it while the window lasts | 15 |
| **Verdant Seal** 🌱 | every strike takes **+N more units** — the thumb and the crew alike | the nodes in the zone are **auto-tapped, 4 a second**, for as many taps as the Mana bought | 15 |
| **Foreman's Sigil** ⚡ | crews **work faster** — swing and walk both | the crews of **every building in the zone** work much faster while the window lasts | 20 |
| **Gilded Ledger** 🪙 | a house pays **more tax** | the houses in the zone are **auto-tapped, 4 a second**, for as many taps as the Mana bought | 20 |
| **Wanderer's Compass** 🧭 | rooms pay **more Stardust** | reveals outward in **rings from the cell it was cast on, free of Gold**, over 30 s | 25 |

- **The Sigil's zone is placed on BUILDINGS, not on workers.** A worker walks,
  so a zone that asked where it was standing would flicker as it crossed the
  edge — and worker travel is Euclidean while a zone is Chebyshev, which is two
  of the three distance metrics that coexist on purpose. *The Sawmill is in the
  area, so the Sawmill's crew works faster* is one sentence and one stable
  answer.
- **"Faster" for a crew is both numbers**: the swing (`workerStrikeMs`) and the
  walk (`workerSpeed`). Speeding only the walk would be a fraction of a round
  trip and would read as nothing.
- **The Compass is cast on a legal frontier cell** — one already adjacent to
  revealed ground — and walks outward ring by ring, so the fog still grows from
  what the player holds rather than appearing as islands.
  `cellsWithinRadius` is already ordered nearest-first, and the Townhall's
  reach still gates it: the spell buys the **Gold**, never the ladder.
- **The Rod's refill must land before its zone matters.** A recovery wait is
  stamped when the cell is exhausted, not read each tick, so a `×5` zone only
  reaches cells that exhaust *inside* it — which is exactly what the instant
  refill arranges by emptying the waiting list first.

### 3.2 The two auto-tap spells, and the exchange rate they are

An auto-tapped tap **costs no Mana** — 30 of them at 1 Mana each would be
impossible — so these two spells are the one exception to *every player tap
costs 1 Mana*, and the exception is the design:

> **A cast buys taps at a rate, and the rate is what the relic's level moves.**
> At level 1 it is **2 taps per Mana**; every level adds **+0.25**.

- A 15-Mana cast at level 1 is **30 taps**; at 4 a second, a **7.5-second**
  window. The window is *derived* — it is the tap count divided by the rate —
  and never authored.
- Taps are dealt to the cells in the zone **nearest-first, round robin**, so
  the count is the budget and the area is only where it is spent.
- Holding a finger already auto-taps at 2 a second and costs 1 Mana each. So
  the spell is **twice the speed at a fraction of the price**, and the player
  can always see which they would rather spend.
- **The nodes exhaust and the houses do not.** A 5×5 area holds ~250 units of
  stock, so the Seal's taps run out of ground before they run out of budget,
  while the Ledger's keep paying. That is the asymmetry the cooldown exists to
  hold, and the number to watch first (**OQ-99**).

## 4. Level by level

Every number below is a **first pass**. What matters most is the **per-level**
column, because a relic gains a level a season for ever and nothing caps it.

**Dowsing Rod** — mana 15 · cooldown 5 min · power ×5 (fixed)

| Dowsing Rod | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — recovery speed | ×1.20 | ×1.40 | ×1.60 | ×2.00 | ×3.00 | ×5.00 |
| *(a Forest's 90 s wait becomes)* | 75 s | 64 s | 56 s | 45 s | 30 s | 18 s |
| **Active — duration** | **5 min** | **6 min** | **7 min** | **9 min** | **14 min** | **24 min** |
| *(uptime, cooldown after)* | 50% | 55% | 58% | 64% | 74% | 83% |
| Active — radius (§2.3) | 2 | 2 | 2 | **3** | **4** | **5** |

**Verdant Seal** — mana 15 · cooldown 5 min · 4 taps a second

| Verdant Seal | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — units per strike | +1 | +2 | +3 | +5 | +10 | +20 |
| Passive — stock a node holds | +1 | +2 | +3 | +5 | +10 | +20 |
| *(a Forest node: stock / per tap)* | 11 / 2 | 12 / 3 | 13 / 4 | 15 / 6 | 20 / 11 | 30 / 21 |
| **Active — taps per Mana** | **×2.00** | **×2.25** | **×2.50** | **×3.00** | **×4.25** | **×6.75** |
| Active — taps dealt | 30 | 34 | 38 | 45 | 64 | 101 |
| Active — window | 7.5 s | 8.5 s | 9.5 s | 11.2 s | 16.0 s | 25.2 s |
| Active — radius (§2.3) | 2 | 2 | 2 | **3** | **4** | **5** |

**Foreman's Sigil** — mana 20 · cooldown 5 min · 5 min (fixed)

| Foreman's Sigil | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — crew speed | ×1.10 | ×1.20 | ×1.30 | ×1.50 | ×2.00 | ×3.00 |
| **Active — crew speed in the zone** | **×2.00** | **×2.25** | **×2.50** | **×3.00** | **×4.25** | **×6.75** |
| *(uptime, cooldown after)* | 50% | 50% | 50% | 50% | 50% | 50% |
| Active — radius (§2.3) | 2 | 2 | 2 | **3** | **4** | **5** |

**Gilded Ledger** — mana 20 · cooldown 5 min · 4 taps a second

| Gilded Ledger | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — tax at a house | ×1.05 | ×1.10 | ×1.15 | ×1.25 | ×1.50 | ×2.00 |
| **Active — taps per Mana** | **×2.00** | **×2.25** | **×2.50** | **×3.00** | **×4.25** | **×6.75** |
| Active — taps dealt | 40 | 45 | 50 | 60 | 85 | 135 |
| Active — window | 10.0 s | 11.2 s | 12.5 s | 15.0 s | 21.2 s | 33.8 s |
| Active — radius (§2.3) | 2 | 2 | 2 | **3** | **4** | **5** |

**Wanderer's Compass** — mana 25 · cooldown 5 min · 30 s to walk the rings

| Wanderer's Compass | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — Stardust from rooms | ×1.05 | ×1.10 | ×1.15 | ×1.25 | ×1.50 | ×2.00 |
| **Active — radius (§2.3)** | **2** | 2 | 2 | **3** | **4** | **5** |
| *(cells the disc covers)* | 25 | 25 | 25 | **49** | **81** | **121** |

### 4.1 Two of these are cuts to live numbers

The Ledger ships at **×1.10, +0.10 a level** and the Compass at **×1.25,
+0.25**. The table halves the first and quarters the second. A player holding
either would lose what they have. **Either raise those two rows to what ships,
or accept the nerf knowingly** — the season that closes their album is what
the player paid for it.

### 4.2 The Seal's `+1 a strike` needs the stock row beside it

A tap can never take more than the cell holds. At `+1` a level, a Forest tap
asks for 10 units at **level 9** — the node's whole stock — and every level
after that pays nothing on a 10-stock node:

```
level  5: the tap asks 6,  the node holds 10 → takes 6
level  9: the tap asks 10, the node holds 10 → takes 10   ← saturated
level 20: the tap asks 21, the node holds 10 → takes 10   ← still 10
```

That is the same death as the Rod's old discount, approached from the other
end. The fix is the row above it: **the Seal raises the node's STOCK by +1 a
level too**, so the ground gets richer as fast as the swing gets bigger and
neither saturates. It also revives the idea in its own name — *a node holds
more before it is spent* — and `+1` on a 5-stock Stone is a real **+20%**,
where a percentage would have rounded away to nothing.

## 5. What it would take

| Step | Where |
|---|---|
| `recoverySpeed`, `respawnSpeed`, `workerStrikeSpeed`, `harvestStock`, `unitsPerStrike` as `ModifierStat`s the call sites read | `modifiers.ts`, `harvest.ts`, `upgrades.ts` |
| **Zones**: a placed, timed, positional effect — new state, a save field, an expiry boundary, and a `resolve()` that knows about cells | new `sim/zones.ts` |
| **Cooldowns**: one timestamp per relic, and a boundary at each | `casting.ts`, `state.ts` |
| The auto-tap engine: a tap budget spent 4 a second, nearest-first, charging no Mana | `casting.ts` |
| `active_*` columns per level on the `Artifacts` sheet | `balance.xlsx`, `scripts/balance.mjs` |
| The zone preview in cast mode, and the cooldown on the relic's card | `ui/collectionSheet.ts`, the map renderer |

- **The one to cost first is zones.** Everything else is a number; a positional
  timed modifier is a new concept in the sim, and it has to satisfy invariant 1
  — one-call offline replay equal to stepped ticking — which means its expiry
  is a boundary and its effect is never integrated over a straddled window.

## 6. The three that are missing

The collection is eight albums ([`album-cycles.md`](album-cycles.md) §6.4) and
there are five relics. The three new ones take the three pillars the city
relics do not touch: **the dungeon, the war and the tomes**.

| Relic | Pillar | Passive — always on | Active | Mana |
|---|---|---|---|---|
| **The Delver's Lantern** 🏮 | the dungeon | every room pays **more Gold and Stone** | **Lamplight** — the next N rooms pay **double** | 20 |
| **The Muster Horn** 📯 | the war | your halls field a **bigger army** | **The Call** — every unit fights at **+N ATK and DEF** for 10 min | 20 |
| **The Sealed Codex** 📖 | the tomes | your kingdom **learns faster** | **Study** — Knowledge runs **×4** while it lasts | 15 |

### 6.1 What each one moves, and where it is collected

| Relic | Stat | Reads | New? |
|---|---|---|---|
| **Delver's Lantern** | `roomHaul` | `expeditions.ts#roomReward`, on the **wallet line only** | new stat |
| **Muster Horn** | `armyCap` | `army.ts#armyCap` | live already |
| **Sealed Codex** | `knowledgeYield` | `mana.ts#knowledgePerHour` | live already |

- **The Lantern takes the room's Gold and Stone and nothing else.** A room's
  line already pays Stardust through `stardustYield` — the Wanderer's Compass —
  and Hero XP through `heroXp`, which is the Vampire Lord's boon
  ([`legendary-boons.md`](legendary-boons.md)). Multiplying the whole `scale`
  would stack a relic on top of two other permanent layers on the same number.
  The material half is unclaimed, so that is the half it takes.
- **The Codex's seat is already reserved.** `knowledgePerHour` carries the
  comment *"a relic and a rank read the same number the same way"* — the call
  site was written expecting one and never got it.
- **None of the three touches a stat a relic or a boon already moves**, which
  is the rule `tests/heroBoons.test.ts` enforces in the other direction.

### 6.2 These three have no zone

The five city relics place their active **on the map** (§2). These three cannot:
a dungeon, a fight and a tome are not places on the city grid, and a zone cast
on the city that changed what happened underground would be a rule nobody could
read.

- **They are cast untargeted and run as a window**, with everything else
  unchanged: a Mana price, the ACTIVE → COOLDOWN → READY walk, a 5-minute
  cooldown counted from the window's close, and exactly one number growing with
  the level.
- **The Lantern's window is counted in ROOMS, not minutes** — the only clock a
  delve has is the player entering the next door, so minutes would be a timer
  that runs while nothing happens.

### 6.3 Level by level

**The Delver's Lantern** — mana 20 · cooldown 5 min

| Delver's Lantern | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — a room's Gold and Stone | ×1.15 | ×1.30 | ×1.45 | ×1.75 | ×2.50 | ×4.00 |
| **Active — rooms paid double** | **3** | **4** | **5** | **7** | **12** | **22** |

**The Muster Horn** — mana 20 · cooldown 5 min · 10 min (fixed)

| Muster Horn | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — army the halls field | ×1.10 | ×1.20 | ×1.30 | ×1.50 | ×2.00 | ×3.00 |
| *(four halls at level 5 = 3,400 power)* | 3,740 | 4,080 | 4,420 | 5,100 | 6,800 | 10,200 |
| **Active — ATK and DEF on every unit** | **+5** | **+7** | **+9** | **+13** | **+23** | **+43** |

**The Sealed Codex** — mana 15 · cooldown 5 min · ×4 (fixed)

| Sealed Codex | **L1** | **L2** | **L3** | **L5** | **L10** | **L20** |
|---|---|---|---|---|---|---|
| Passive — Knowledge an hour | ×1.15 | ×1.30 | ×1.45 | ×1.75 | ×2.50 | ×4.00 |
| **Active — duration** | **20 min** | **22 min** | **24 min** | **28 min** | **38 min** | **58 min** |
| *(uptime, cooldown after)* | 80% | 81% | 83% | 85% | 88% | 92% |

- **The Codex is the third departure move.** Knowledge is production, so a
  window shorter than the 8-hour offline cap is paid in full during an absence
  (CLAUDE.md, invariant 2) — cast it on the way out, like Haste and the
  Ledger's Due.
- **The Horn's active is flat and the others are multipliers**, deliberately:
  `unitAtk` and `unitDef` are flat terms in the `Drill` and there is no
  multiplier there to take. Flat is safe on an ACTIVE — the level scales it,
  and it ends.

### 6.4 Why not the world map

It is the obvious eighth pillar and it is the wrong one to take **now**: the
world map is designed and unbuilt, so a relic pointing at it would move a
number nothing reads.

- A **boon** can afford to wait — the Scout's `worldRevealSpeed` already does,
  and a Legendary carries a stat block and a type passive besides.
- A **relic cannot.** A relic is an entire album — nine cards, a whole season —
  and one that pays nothing for months is a season spent on a blank. The world
  map's relic is the **ninth**, and it should arrive with the world map.

## 7. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Passive power, per level | §4 | `Artifacts` sheet |
| Which axis a level moves | **one per relic** (§2.2) | a column, and a test |
| Active power / duration / radius, per level | §4 | `Artifacts` sheet |
| Taps a Mana, and its per-level step | **2.00, +0.25** | `Artifacts` sheet |
| Auto-tap rate | **4 a second** | a setting |
| Cooldown | **5 min, flat, from when the window closes** | a setting |
| Radius | **2 · 3 at L5 · 4 at L10 · 5 at L20**, the same on all five | `active_radius_steps` |
| The three new relics' passives and actives | §6.3 | `Artifacts` sheet |
| The album cycle | see [`album-cycles.md`](album-cycles.md) | — |

## 8. Deliberately not in this proposal

- **A passive that is a discount, a cost or a time.** It dies at 100%.
- **A passive that is flat on a base that grows.** It goes stale on its own.
- **An active that is instant**, or one that is not placed. The zone is the
  decision.
- **A level that moves two of an active's four numbers.** They multiply.
- **A cooldown that shrinks with level**, which is a discount wearing a hat.
- **A cooldown that starts at the cast** while the window outlives it, which is
  no cooldown at all.
- **Radius as a smooth axis.** Area is quadratic, so it steps at three named
  levels or it does not move (§2.3).
- **A popup asking whether to overwrite an overlapping zone.** Zones overlap
  freely; the grid shows what a cast would cover before the tap, which is the
  house rule (*pills, not modals*) and the idiom casting already has.
- **Two relics sharing an ability**, or one that costs nothing.
- **A relic for the world map, before the world map.** A boon can wait on an
  unbuilt call site; an album cannot (§6.4).
- **A relic that moves a number a legendary boon moves**
  ([`legendary-boons.md`](legendary-boons.md)). The two permanent layers stay
  legible by staying disjoint.

**Open questions:** OQ-97, OQ-98, OQ-99 in
[`../open-questions.md`](../open-questions.md).
