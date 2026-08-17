# Feature: The Harvest Loop (tapping gameplay rework)

> Design doc for replacing the generator/vault economy with a physical harvest
> loop: tappable resource cells, exhaustion/recovery, and workers as real units
> that walk between their building and the cells they work.
> Status: **implemented** on `feature/harvest-loop` (2026-08-17).

## Summary of the change

| Old model (as shipped) | New model (this feature) |
|---|---|
| Districts own generators that accrue per minute into vaults | Buildings produce nothing by themselves |
| Player taps the **building** to collect 1 unit/tap from its vault | Player taps **resource cells** to harvest directly |
| Trees are destroyed permanently after 5–12 taps (→ TreesCut) | Cells **exhaust** after X taps and **auto-recover** after a timer |
| Workers are a number on the district; "worker #1 runs the base" | Workers are **units that move on the map**: walk → work → walk back → deposit |
| Worked tiles via adjacency/BFS connectivity | Buildings have an **area of influence** (radius by level) |
| Rain boosts Food ×5 / regrows forests | Rain **doubles recovery speed** of exhausted cells while active |
| Offline: vaults fill to cap from timestamps | Offline: worker cycles are **simulated**, capped at 8 h |

## Resolved decisions (from design review, 2026-08-17)

1. **Townhall** keeps generating Silver, but via a **visible cycle timer** paying
   directly to the wallet (no internal warehouse). **Tapping the Townhall adds
   progress to the timer** — an accelerator, not a collector. The Townhall never
   exhausts.
2. **FarmLands become crop cells**: still a cheap buildable district, but it
   produces nothing on its own — its cell is a tappable/workable resource cell
   (Food), exactly like a Forest cell is for Wood.
3. **Exhaustion replaces destruction.** Trees→TreesCut permanent destruction is
   gone; TreesCut becomes the *visual* for an exhausted Forest. Player taps are
   free. **The spell system is out of scope for this feature** (reworked later);
   the only spell change is Rain's effect (see Spells).
4. **Offline is simulated**: full worker cycles, cell exhaustion/recovery
   windows and Townhall cycles are replayed deterministically, **capped at 8
   hours** per absence (the return-visit nudge the vault caps used to provide).
5. **Area of influence = Chebyshev radius that grows with building level**
   (radius 1 at L1, +1 per level → 8 cells at L1, 24 at L2, 48 at L3).
6. **Worker cap = min(per-level worker cap, workable cells in range)** — levels
   still matter; the two-forests example still yields exactly 2 workers.
7. **Lumber is renamed Sawmill.** Save format changes are big enough that old
   prototype saves are **discarded** (fresh game on load of a v1 save).

---

## 1. Resource cells

A **resource cell** is any cell the player can tap and workers can work:

| Source | Resource | How it appears |
|---|---|---|
| **Forest** (the `Trees` feature) | Wood | Authored on the map (13 cells in Region_01) |
| **Crops** (a built `FarmLands` district) | Food | Player-built |

Runtime state per resource cell (replaces the old feature durability):

```
CellHarvestState { taps: number, exhaustedUntil: number | null }
```

- **Tapping** a revealed, non-exhausted resource cell yields its `yieldPerTap`
  (1 unit) straight to the city wallet and registers 1 tap. Free — no Mana.
- At `tapsToExhaust` total taps the cell becomes **exhausted**:
  `exhaustedUntil = now + recoverySeconds`, taps reset. While exhausted it can't
  be tapped or worked, and shows its exhausted visual (Forest → stump 🪵,
  Crops → withered 🥀) plus a recovery countdown bar.
- Recovery is timestamp-based, so it works offline for free.
- **Worker extractions count as taps** (a worker is a slow auto-tapper): each
  delivered unit adds 1 tap to the source cell. Player and workers share the
  same exhaustion pool and race for it.
- Race rule: if a cell exhausts **while a worker is mid-work on it**, the worker
  still completes that unit (no frustrating whiffs). If it exhausts **before the
  worker arrives**, the worker turns back empty-handed and re-claims.

## 2. Buildings and the area of influence

A worker building works all resource cells of its type within **Chebyshev
distance ≤ radius(level)** of its cell. Revealed cells only; fog neither counts
nor blocks otherwise. Cells may sit in two buildings' areas — the **claim
system** (one worker per cell) prevents double-working.

| Building | Works | Radius by level | Max workers by level | Notes |
|---|---|---|---|---|
| **Sawmill** (ex-Lumber) | Forest cells | 1 / 2 / 3 | 3 / 5 / 7 | Placement: ≥1 revealed Forest cell within radius 1 |
| **Farm** | Crops cells | 1 / 2 | 3 / 5 | Placement: on Grassland (unchanged) |
| **FarmLands** (crop plot) | — (is the resource) | — | — | Placement: on Grassland, **inside a built Farm's area of influence** |
| **Townhall** | — | — | — | Cycle timer → Silver (below) |
| **Housing** | — | — | — | Unchanged (population capacity) |

`AssignableWorkerLimit = min(maxWorkersForLevel(level), workableCellsInArea)`
(the old "1 + N, worker #1 runs the base" rule is gone — there is no base
production anymore).

Build costs, times, count caps, the build queue, upgrades and Townhall gating
are **unchanged**.

### Townhall cycle

- Every `cycleSeconds` (60 s) the Townhall pays `silverPerPopulation ×
  population` (5 × pop) Silver **directly to the wallet**.
- **Tapping the Townhall cell adds `tapBoostSeconds` (1 s) of progress** to the
  current cycle. Tapping never exhausts the Townhall.
- The card and the map show the cycle progress bar.
- Implementation: `cycleStartedAt` timestamp; a tap subtracts `tapBoostSeconds`
  from it; elapsed full cycles pay out on tick (and in offline simulation).

## 3. Workers as units

Workers are visible units owned by a building (assigned via the district card's
± buttons, from the shared population pool, exactly as today).

### State machine

```
Idle (in building)
  └─ claim nearest unclaimed, non-exhausted resource cell in area
       none available → stay Idle (re-check on every tick / cell recovery)
MovingToCell   — walk building → cell (euclidean distance / moveSpeed)
Working        — workSeconds at the cell
MovingHome     — walk cell → building (carrying 1 unit)
Deposit        — instant: +1 unit to the city wallet, +1 tap on the source cell
  └─ if claimed cell still valid (not exhausted) → MovingToCell again
     else → release claim, try to claim another → MovingToCell / Idle
```

- **Claims**: global, one worker per cell. Claim is taken when a target is
  chosen and released on exhaustion/unassignment.
- **Unassigning** a worker (−): the unit finishes nothing — it despawns, its
  claim is released, any carried unit is lost (kept simple; carried amount is 1).
- **Arrival check**: on reaching the cell, if it exhausted en route → return
  empty, release, re-claim.
- Deposits go **straight to the wallet** — no building storage anywhere.

Runtime state (persisted):

```
Worker {
  id, buildingId,
  state: Idle | MovingToCell | Working | MovingHome,
  claimedCell: Coord | null,
  stateUntil: number | null   // arrival / work-completion timestamp
}
```

Rendering: a glyph (🧑‍🌾 Farm, 🪚 Sawmill) linearly interpolated between
building and cell using `stateUntil` and the state's duration; a small carry
icon on the way home. No pathfinding — straight lines, walking over anything
(prototype).

### Simulation = one event-driven advance

The sim exposes `advance(state, toTime)` which processes, in chronological
order: worker arrivals/completions, cell recoveries, Townhall cycle payouts and
build-queue completions up to `toTime`.

- **Online**: the once-per-second tick calls `advance(state, now)`.
- **Offline**: on load, `advance(state, min(now, lastSaved + 8h))` replays the
  absence deterministically (no player taps offline), then timestamps snap
  forward to `now` so no further income accrues from the gap beyond the cap.

This replaces the generator accrual algorithm; one code path serves both cases
(same as the old build-queue design).

## 4. Spells (minimal scope — full rework deferred)

The spell system (spellbook, targeting, Mana, active-spell casts) is untouched
by this feature. Two effect-level consequences only:

- **Rain (adjusted effect)**: unchanged shell — 10 Mana, 30 s duration,
  non-stackable, cast on a cell. New effect: while the rain is active on a
  **resource cell** (Forest or Crops), that cell's **recovery runs at ×2
  speed**. Cast on an already-exhausted cell it halves the remaining wait
  covered by the rain window; if the cell exhausts *during* the rain, the
  boost applies for the remaining window. (Formally: with remaining recovery
  `R` and rain time remaining `D`, the new completion is
  `now + max(R/2, R − D)`.) `CanTarget` = any revealed resource cell. The old
  ×5 Food boost and forest regrowth disappear with the systems they hooked
  into (generators, permanent destruction).
- **Tap spell**: left in the spellbook untouched, but its extraction machinery
  (feature BaseYield + durability destruction) is superseded by free player
  taps, so it has **no valid targets** until the spell rework — the same
  dormant state it shipped in originally (see Docs/11). Not removed, not
  redesigned here.

## 5. UI & input changes

- **Tap chain** (priorities unchanged): the default handler (0) becomes —
  resource cell → harvest tap (+1 floater); Townhall cell → +progress tap *and*
  open its card; other district → open card; empty ground → close card.
  Fog reveal (50), placement (300) and spell targeting (200) unchanged.
- **District card**: vault rows gone. Worker districts show workers ± with
  per-worker state (Idle/working); Townhall card shows the cycle bar, payout
  and "tap to speed up" hint. Upgrade rows now also show **radius +1** deltas.
- **Placement mode**: shows the **area of influence outline** for the selected
  cell and highlights the resource cells it would capture (with count).
- **Map**: exhausted cells dimmed + countdown bar; claimed cells get a small
  marker while their building's card is open; worker units move on the map;
  Townhall shows its cycle progress bar instead of a vault bar.
- **Header**: unchanged (Builders/Workers widgets keep working).
- **Build menu**: FarmLands re-described as a crop plot; Sawmill renamed.

## 6. Removed / superseded systems

Generators, modifiers, vaults and the accrual algorithm; the recalc pass
(replaced by claim/limit recomputation on: build complete, upgrade, reveal,
assignment, exhaustion/recovery); worked-unit BFS; Trees→TreesCut destruction;
FarmLands passive drip; Townhall vault.

Army, fog of war, build queue, population buying, Housing: **unchanged**.

## 7. Tunables (proposed starting values)

| Constant | Value | Rationale |
|---|---|---|
| Forest `yieldPerTap` | 1 Wood | 1 unit per tap, as today |
| Crops `yieldPerTap` | 1 Food | — |
| `tapsToExhaust` (both) | 10 | Deterministic (replaces random 5–12) |
| Forest `recoverySeconds` | 90 s | Wood slightly scarcer than Food |
| Crops `recoverySeconds` | 60 s | — |
| Worker `moveSpeed` | 1 tile/s | Readable movement at tile size 72 px |
| Worker `workSeconds` | 8 s | Adjacent-cell cycle ≈ 11 s → ~5.5 units/min/worker, close to the old 3–5/min feel |
| Worker carry | 1 unit | One tap-equivalent per cycle |
| Townhall `cycleSeconds` | 10 s | Pays 5 × pop (tuned down from 60 s in review) |
| Townhall `tapBoostSeconds` | 2 s per tap | 5 taps force a full cycle |
| Offline cap | 8 h | Return-visit nudge |
| Radius by level — Sawmill | 1 / 2 / 3 | — |
| Radius by level — Farm | 1 / 2 | — |

## 8. Persistence

Save format bumps to **v2** (`SaveVersion: 2`); v1 saves are discarded (fresh
game). Changes:

- Districts lose `Generators`; Townhall gains `CycleStartedAt`.
- New module `kingdom.cellHarvest`: `[{Coord, Taps, ExhaustedUntil}]`.
- New module `kingdom.workers`: the Worker records above.
- `kingdom.spells` and `kingdom.activeSpells` keep their shape; active Rain
  casts persist as today (offline-expired casts are still dropped without
  side effects — with the ×2 effect, an offline-expired rain simply
  contributes its window to the offline recovery replay before expiring).
- `LastSaved` anchors the offline-simulation window.

## 9. Implementation plan (separate commits on `feature/harvest-loop`)

1. `feat(sim):` cell harvest state, exhaustion/recovery, free tap command;
   remove permanent destruction; adjust Rain's effect to ×2 recovery. Tests:
   exhaust/recover timing, tap yields, rained-recovery math.
2. `feat(sim):` worker units + claims + the event-driven `advance`; remove
   generators/vaults/recalc. Tests: cycle math, claim rules, race rule,
   offline replay capped at 8 h (the docs' worked-example tests for costs/
   queue/fog stay green — those systems don't change).
3. `feat(sim):` Townhall cycle + tap boost; FarmLands-as-crops placement rule;
   Sawmill rename; save v2.
4. `feat(render/ui):` worker rendering, exhaustion visuals, influence outline,
   card/menu changes, tap-chain rework.
5. `docs:` update README deviations; `chore:` version bump.

## 10. Out of scope (explicitly)

Pathfinding/obstacle avoidance; worker carry upgrades; per-cell yield variety;
the spell-system rework (deferred — only Rain's effect changes here);
Sawmill/Farm art; migrating v1 saves; server-side validation.

## Open questions

None — all decisions above were resolved in the 2026-08-17 design review.
Anything in §7 (tunables) and the two small rules flagged inline (race rule,
unassign-loses-carry) are proposed defaults: change the table, not the design.
