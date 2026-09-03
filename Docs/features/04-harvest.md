# 4 · Harvest — tapping cells and the workers who do it for you

> **Scope.** How resources actually leave the ground: the tap, exhaustion and
> recovery, buildings' areas of influence, and workers as units that walk. What
> a tap is *worth* is [`03-economy.md`](03-economy.md) §5; what it *costs* is
> [`08-magic.md`](08-magic.md).
>
> **Status: built.**

## 1. The rule

> **Buildings produce nothing by themselves. The ground produces, and either
> your thumb or a worker takes it.**

That is the difference between this game and the generator-and-vault economy it
replaced. There is no building storage anywhere: a tap pays the wallet, and a
worker's delivery pays the wallet.

| The old model | This one |
|---|---|
| Districts own generators accruing into vaults | Buildings produce nothing |
| Tap the **building** to collect from its vault | Tap **resource cells** directly |
| Trees are destroyed permanently after 5–12 taps | Cells **exhaust** and **auto-recover** on a timer |
| A worker is a number on a district | A worker is a **unit that walks**: out, work, home, deposit |
| Worked tiles via adjacency and BFS connectivity | Buildings have an **area of influence** |

## 2. The tap

Tapping a **revealed, non-exhausted** resource cell pays its yield straight to
the city wallet and registers one tap. It costs **1 Mana**.

- A source may carry a **required technology**. The Forest and the Berries both
  carry **Forestry**, and they exist for the opening: until that research lands,
  *no cell anywhere on the map answers a tap*, so the only thing a new player can
  do is clear fog. That is what keeps Food — and therefore a villager, and
  therefore rent — from arriving early, and it is what makes the first research
  something the player *wants* rather than a chore.
- **The gate is checked before exhaustion**, so a gated cell says *you cannot
  work this yet* rather than *come back later*, and **a refused tap costs no
  Mana**.
- Taps are paced by a shared 0.5 s **collect cooldown**, which **QuickHands**
  shortens.
- Hold-to-repeat covers collect taps *and* reveal taps — at 1 Gold a tap, a
  distance-9 cell is 320 presses, and that is the difference between the
  differentiator being filmable and being punishing.

## 3. Exhaustion and recovery

At `tapsToExhaust` total taps a cell becomes **exhausted**: it cannot be tapped
or worked, shows its exhausted art (a stump, a withered field) and a recovery
bar, and comes back after `recoverySeconds`. Recovery is **timestamp-based**, so
it works offline for free.

**Worker extractions count as taps.** A worker is a slow auto-tapper: each
delivered unit adds one tap to the source cell. Player and workers share one
exhaustion pool and race for it.

Two race rules, both chosen to avoid frustration:

- If a cell exhausts **while a worker is mid-work on it**, the worker still
  completes that unit. No whiffs.
- If it exhausts **before the worker arrives**, the worker turns back
  empty-handed and re-claims.

**A finite feature disappears when empty and respawns** on a valid cell near its
origin — berries wander on grass, shoals wander on water. Placement is a
deterministic hash of the respawn event, so it is identical in live ticking and
offline replay.

**Exhaustion is a lever, not just a ceiling.** The **Verdant Seal** cuts
recovery 25% while attuned, and its active **Bloom** clears exhaustion outright
on every resource cell in a radius. Both reach the sim as modifiers over the
same numbers §1–§4 already read.

## 4. Areas of influence

A worker building works every resource cell **of its type** within **Chebyshev
distance ≤ radius(level)** of its own cell. Revealed cells only; fog neither
counts nor blocks otherwise.

Cells may sit inside two buildings' areas, so a **claim system** — one worker per
cell, globally — prevents double-working.

| Building | Works | Radius by level | Max workers by level |
|---|---|---|---|
| **Sawmill** | Forests | 2 / 3 / 4 | 3 / 5 / 7 |
| **Quarry** | **Mountains** | 2 / 3 / 4 | 3 / 5 |
| **Farm** | Crops | 1 / 2 | 3 / 5 |
| **Mine** | Iron veins | 2 / 3 / 4 | 3 / 5 |
| **Docks** | Fish shoals | 4 / 6 | 3 / 5 |

**Wood and Stone are the same mechanic with different art.** The Sawmill takes
Wood from every forest in range; the Quarry cuts Stone from every mountain in
range. A district names a harvest source, a feature names the same one, and the
worker search matches them — so unifying the two was a content change, not an
engine one ([`01-map-and-fog.md`](01-map-and-fog.md) §3.1).

**Workable cells in range do not cap assignment.** The worker limit is the
per-level cap; surplus workers wait Idle and pick up work as cells recover, get
revealed, or come into range.

That rule is also where the map runs out of room before the fog does — a Sawmill
L3 fields 7 workers and the map holds 13–17 forest cells, so three maxed
Sawmills are 21 slots chasing 17 trees. See
[`02-map-scopes.md`](02-map-scopes.md) §0.

**FarmLands is the exception**: a built crop plot *is* the resource, so it has no
radius and no workers. It must be placed on Grassland inside a built Farm's area
of influence.

## 5. Workers as units

Assigned from the shared population pool with the district card's ± buttons.

```
Idle (in the building)
  └─ claim the nearest unclaimed, non-exhausted cell of its type in range
       none available → stay Idle, re-check on every tick and every recovery
MovingToCell   — walk out (euclidean distance ÷ moveSpeed)
Working        — workSeconds at the cell
MovingHome     — walk back, carrying 1 unit
Deposit        — instant: +1 unit to the wallet, +1 tap on the cell
  └─ claim still valid → MovingToCell again
     else → release, try another → MovingToCell or Idle
```

- **Unassigning** despawns the unit, releases its claim and loses the single
  carried unit. Kept simple on purpose.
- **On arrival**, if the cell exhausted en route the worker returns empty,
  releases and re-claims.
- **No pathfinding.** Straight lines, walking over anything.
- Rendered as a glyph interpolated between building and cell, with a carry icon
  on the way home. Fishing workers render as boats.

**Moving a building splits the crew, and the split is the point**
([`05-city-and-districts.md`](05-city-and-districts.md) §4): a worker *carrying*
a load keeps its claim and simply walks to the new address, so a move never
costs a trip already worked for; a worker *not* carrying releases and goes Idle,
because its target may be outside the new radius.

**The Foreman's Sigil** exists because of the arithmetic here: a worker delivers
~6 units/min against a tapper's ~300, so its active **Haste** doubles worker
yield for 60 minutes. Haste is the **departure** move — Divination and Bloom
reward being present; a visit-based game needs something good to do on the way
out.

## 6. Offline

Worker cycles, cell recoveries and Townhall cycles are **replayed
deterministically**, capped at **8 hours** per absence. No player taps happen
offline.

The cap is a production cap, never a timer cap: **the offline cap limits what the
city produces while you are away, and never what a timer does.** Recovery
timestamps and build queues resolve in the uncapped tail.

## 7. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Yield per tap, per feature | §3 of [`01-map-and-fog.md`](01-map-and-fog.md) | `Harvest` sheet |
| Taps to exhaust | 10 (Forest, Crops, Berries, Meat) · 5 (Stone, Fish, Iron) | `Harvest` sheet |
| Recovery | Forest 90 s · Crops 60 s · Stone 120 s · Iron 300 s | `Harvest` sheet |
| Which research opens a source | Forestry (Forest, Berries) · Hunting (Meat) · **Scaling Tools (Stone)** | `Harvest.required_tech` |
| Respawn (finite features) | 120 s | `Harvest.respawn_seconds` |
| Worker move speed | 1 tile/s | `worker.move_speed_tiles_per_second` |
| Worker work time | 8 s | `worker.work_seconds` |
| Worker carry | 1 unit | — |
| Influence radius, worker cap | §4 | `Districts` sheet |
| Offline cap | 8 h | `offline_cap_hours` |

An adjacent-cell cycle is ~11 s, so a worker delivers **~5.5 units/min**.

Worker-delivery upgrades — **Sawpits, Irrigation, Stonecutting, Big Nets, Iron
Picks** — stack with the global **WorkerLoad**. Tap upgrades — **TapPower,
Butchery, Scythes** — are separate, because tapping and automating are separate
decisions ten onboarding beats apart.

## 8. Deliberately not in this design

Pathfinding and obstacle avoidance · worker carry upgrades · per-cell yield
variety beyond the authored table · permanent destruction of a feature · vaults,
generators, or any building storage · offline tapping.
