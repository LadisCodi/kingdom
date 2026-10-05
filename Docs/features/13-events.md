# 13 · Events

> **Scope.** The event skeleton every content drop is a skin on: an event
> counter, a fog-island minigame, a milestone track that doubles as the pass, a
> shop, and a window that closes.
>
> **Status: the scheduling machinery is built and verified; the archetype
> (§1–§4) is designed, not built.** **The catalogue is EMPTY**: `EVENTS`
> holds nothing and a new kingdom has no schedule at all. The machinery keeps
> its tests, driven by hand-built windows; one template in `EVENTS` schedules
> an event.

## 1. Engine extensions (designed, not built)

| Extension | Built | Designed, not built |
|---|---|---|
| **Modifier stats** | 34 values, including build speed, active cost, unit HP and Mana cap | **training speed**, **card yield** |
| **Schedule payloads** | a banner | **`grantModifier`**, **`eventTrack`**, **`eventShop`** |
| **Where schedules live** | in code, beside the definitions | a hand-written events file (live-ops content with wall-clock dates) |

- `grantModifier` carries a template id, not a magnitude. Magnitudes are data, in
  `?dev=data`.
- `eventTrack` is the milestone ladder: an ordered list of point thresholds,
  each with a **free** and a **paid** reward. It is both the grand-prize bar and
  the two-track pass (§2.4).
- `eventShop` is stock rows plus a refresh cadence.
- Build speed is also the stat daily help grants
  ([`15-social.md`](15-social.md) §3.1).
- An empty modifier stack is bit-identical to no modifiers.

Where each number lives:

| Events file | Workbook |
|---|---|
| windows, periods, occurrence horizons | modifier template magnitudes |
| which track and shop an event uses | track thresholds and reward amounts |
| banner pools and rate-up | shop prices and stock quantities |

## 2. The archetype

Six parts. Every authored event is a skin on them.

### 2.1 Event points are a counter

- Event points live in the event's own state.
- They are shown on the event screen only; they never reach the plank or the
  purse. No wallet row.
- Same pattern as Fragments and the collection's stars: a counter shown where
  it is spent, not a wallet row.
- **OQ-18.**

### 2.2 Point sources

- Points come from the base game loop.
- No regenerating roll resource. Mana is the game's only energy.

| Source | Note |
|---|---|
| Buying a **Wonder level** | [`16-wonders.md`](16-wonders.md) |
| Clearing a **dungeon room** | scales with depth |
| Claiming a **landmark**, clearing a **dungeon** depth | |
| Clearing a **lair** | [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) |
| **Taps** | low rate |
| A **rewarded video** | capped; the third ad placement |

### 2.3 The minigame: a fog island

- A small shrouded map. Event points buy reveals; rewards are under the fog.
- Reveals follow the fog's compounding cost curve.
- The **temporary province** of [`02-map-scopes.md`](02-map-scopes.md) §1.2.
- Each event is one map and one reward table (*Winter Isles*, *Sunken Coast*).
- Built as a lightweight state module, not a region: fog, features and
  rewards. No buildings, no workers, no economy. Nothing is produced there;
  things are found there.

### 2.4 The track

- An ordered ladder of point thresholds with two reward columns, free and paid.

```
threshold   free reward         paid reward
   100      Gold                Gold ×2
   250      a Silver card pack  a Gold pack + a shop refresh
   500      Gems                Gems ×2
   ...
  final     the grand prize     the grand prize + a Star pack
```

- The grand prize is a collectible: a hero, or a Star pack. Not a building,
  not a currency lump, and never a relic — a relic comes only from its album
  ([`09-relics.md`](09-relics.md) §1). A seasonal hero is one hero row and one
  banner row.
- The free track reaches the grand prize. Slower, but reachable.
- Paid claims are gated on a flag. How the flag is set is
  [`14-monetization.md`](14-monetization.md).
- A track claimed during an offline replay pays exactly once.
- **This is built, as the season pass** ([`20-season-pass.md`](20-season-pass.md)):
  40 levels on the collection's clock, XP from generated missions, and the
  paid column as one $4.99 purchase. An event's own track is the same shape
  scoped to the occurrence.
- **OQ-20.**

### 2.5 The shop

- Stock rows with quantities, priced in event points.
- One free refresh a day; paid refreshes after that.
- Boosters are sold here.

### 2.6 The window closes

- Every event has a hard deadline.
- Points earned are banked; a milestone reached is paid; a collectible won is
  kept. What ends is the chance to earn more.
- Refused inside an event: theft, decay, hunger, and timers that destroy
  progress. The one raid in the game is a lair's
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)), and it is bounded
  there.
- **OQ-19.**

## 3. Session budget

- Every event is dimensioned for ~30 minutes a day across 2–3 visits.
- The track is completable at that budget, without the shop, inside the window.
- Checked by timing a real session, not by arithmetic.

## 4. Absences and event rewards

- An absence is replayed in full; there is no offline cap
  ([`04-harvest.md`](04-harvest.md) §8).
- Event windows are timers, like the build queue. They resolve at their
  absolute timestamps inside the offline advance.
- A 20-hour absence spanning a 24-hour window pays in full.
- A window that opens and closes inside an absence still fires.

## 5. The scheduling machinery (built, with nothing scheduled)

**`EVENTS` is empty.** What stands is the part every event needs, and it
keeps its tests:

- **A template in `EVENTS` schedules an event.** Id, first start, duration,
  period. That is the whole of adding one back.
- **Stable occurrence ids** (`<template>#<n>`, counted from the template's
  epoch), so the same window is the same window on every client.
- **Phases are persisted**, so an event that paid out cannot pay twice on
  reload, and a replay of any length fires each transition once.
- **Reconciliation runs before the offline replay**, which is what lets a
  content drop reach an existing save.
- **A window is a boundary source**, so it opens and closes at the exact
  instant whether or not the player is there.
- **A kingdom is not paid for a window it never lived through.** A window
  already open when the kingdom was created starts `done`; one the player
  slept through does not.

## 6. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Track thresholds and both reward columns | `?dev=data` |
| Points per source (§2.2) | `?dev=data` |
| Reveal prices on the event island | `?dev=data` |
| Shop stock, prices, refresh cadence | `?dev=data` |
| Window duration and period | `EVENTS` (empty today) |
| Modifier template magnitudes | `?dev=data` |

## 7. Deliberately not in this design

- An event wallet row (§2.1)
- A regenerating roll resource (§2.2)
- A genre-foreign minigame (§2.3)
- Two separate ladders instead of two columns (OQ-20)
- Points that carry between events (OQ-21)
- An event that costs more than ~30 min/day (§3)
- A full second region for the island (§2.3)
- Re-expressing upgrade levels as modifiers

**Open questions:** OQ-18, OQ-19, OQ-20, OQ-21, OQ-22, OQ-23, OQ-4.
