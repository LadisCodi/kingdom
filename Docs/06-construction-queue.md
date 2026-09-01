# 06 — Construction & the Build Queue

> **FROZEN — Unity as-built snapshot, 2026-08-17.** This file documents the
> *Unity* prototype (hex grid, Silver, generator vaults), not the web build. It is
> kept for provenance and for the formulas the port still uses. Where it disagrees
> with [`00-design-intent.md`](00-design-intent.md) or with `Docs/features/`, those
> win. Do not implement from this file without checking there first.

Each city has **one shared timed queue** for both new builds and upgrades.

## Queue item model

```
QueueItem {
  UniqueID          // "BuildItem_{districtID}" or "UpgradeItem_{districtID}"
  DurationSeconds
  StartedAtUtc?     // null until the item enters the active window
  CompletesAtUtc = StartedAtUtc + DurationSeconds
  Progress(now)  = clamp01(elapsed / duration)
  RemainingSeconds(now)
  IsCompleteAt(now)
}
```

Two item kinds: **BuildQueueItem** (carries the district being built) and
**DistrictUpgradeQueueItem** (carries the district + `targetLevel = level + 1`).

- Queue **capacity** (max items waiting + active): city definition value — **1** for
  Oakville. Enqueueing into a full queue is impossible (`QueueFull` result).
- **Concurrency** (how many items progress at once): the kingdom's `MaxBuilders` —
  starts at **1**, absolute max **4**, and nothing in the current build raises it
  (only a saved value can restore a higher number).

## The Advance algorithm (also the offline catch-up engine)

Once per second (and on the first tick after loading), the queue advances:

```
Advance(now, maxConcurrent):
  slots = max(1, maxConcurrent)
  loop:
    active = first min(slots, count) items
    1. any active item with StartedAtUtc == null → StartedAtUtc = now
       (initial fill; promoted items get stamped in step 3 instead)
    2. among active items already complete at `now`, pick the EARLIEST-finishing one;
       none → stop. Remove it, add to completed.
    3. the item that just entered the active window (index slots−1, if unstarted)
       → StartedAtUtc = the completed item's CompletesAtUtc   (the moment its slot freed,
         NOT `now`)
  return completed items
```

Because promoted items start when their slot actually freed, a long offline gap
completes a whole chain of queued work in true chronological order in a single call.

Each completed item is dispatched to its completion handler:
- **Build complete** → district `MarkBuilt` (becomes active), production recalc, sound.
- **Upgrade complete** → `district.SetLevel(targetLevel)`, production recalc, sound.

The driver also pushes progress/ETA to the world views every tick: a construction-site
progress bar for builds, a floating progress bar above the (still producing) building
for upgrades.

## Enqueueing

- **Build** (`EnqueueDistrictBuildUseCase`): results `Started | QueueFull |
  NotEnoughResources`. Pays the computed build cost **up front**, creates the district
  `UnderConstruction` on its cell (occupies the tile, produces nothing), hides the
  cell's feature tile, computes the duration for that cell, enqueues.
- **Upgrade** (`UpgradeDistrictUseCase`): results `Started | AtMaxLevel |
  AlreadyUpgrading | RequirementsNotMet | QueueFull | NotEnoughResources`. Pays up
  front, enqueues with `targetLevel = level + 1`. The district keeps producing at its
  current level while upgrading.

## Cancelling

`CancelBuildQueueItemUseCase` (builds): removes the item, despawns the district view,
restores the cell's feature tile, removes the district from the city, then **refunds
the build cost recomputed after removal** — so the count-based multiplier matches what
was actually paid.

## Rushing with Gems

`FinishQueueItemWithGemsUseCase`:

```
gemCost = max(1, ceil(RemainingSeconds(now) / 10))     // 10 seconds per gem
```

Results `Success | NotFound | NotEnoughGems`. Pays Gems from the player wallet,
removes the item from the queue first (so the per-second driver can't double-complete
it), then routes it through the same completion handler — the outcome is identical to
the timer finishing.
