# 13 · Events

> **Scope.** The event skeleton every content drop is a skin on: an event
> counter, a fog-island minigame, a milestone track that doubles as the pass, a
> shop, and a window that closes. Plus the weekly event.
>
> **Status: the weekly event and its scheduling machinery are built and
> verified; the archetype (§1–§4) is designed, not built.** The game has one
> authored event and zero banners.

## 1. Engine extensions (designed, not built)

| Extension | Built | Designed, not built |
|---|---|---|
| **Modifier stats** | 12 values, including Stardust yield, active cost, delve speed and attunement slots | **build speed**, **research speed**, **training speed**, **ingredient yield** |
| **Schedule payloads** | the weekly event and a banner | **`grantModifier`**, **`eventTrack`**, **`eventShop`** |
| **Where schedules live** | in code, beside the definitions | a hand-written events file (live-ops content with wall-clock dates) |

- `grantModifier` carries a template id, not a magnitude. Magnitudes live in a
  workbook sheet.
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
| the weekly boon table | |

## 2. The archetype

Six parts. Every authored event is a skin on them.

### 2.1 Event points are a counter

- Event points live in the event's own state.
- They are shown on the event screen only; they never reach the plank or the
  purse. No wallet row.
- Same pattern as Fragments: a per-collectible counter shown in the Reliquary,
  not a wallet row.
- **OQ-18.**

### 2.2 Point sources

- Points come from the base game loop.
- No regenerating roll resource. Mana is the game's only energy.

| Source | Note |
|---|---|
| Buying a **Wonder level** | [`16-wonders.md`](16-wonders.md) |
| Extracting from a **delve** | scales with depth |
| Claiming a **landmark**, clearing a **ruin** depth | |
| **Taps** | low rate |
| The **daily chest** | one lump a day |
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
   250      ingredients         ingredients + a shop refresh
   500      Gems                Gems ×2
   ...
  final     the grand prize     the grand prize + a relic level
```

- The grand prize is a collectible: a relic or a hero. Not a building, not a
  currency lump. A seasonal hero is one hero row and one banner row.
- The free track reaches the grand prize. Slower, but reachable.
- Paid claims are gated on a flag. How the flag is set is
  [`14-monetization.md`](14-monetization.md).
- A track claimed during an offline replay pays exactly once.
- **OQ-20.**

### 2.5 The shop

- Stock rows with quantities, priced in event points.
- One free refresh a day; paid refreshes after that.
- Boosters are sold here.

### 2.6 The window closes

- Every event has a hard deadline.
- Points earned are banked; a milestone reached is paid; a collectible won is
  kept. What ends is the chance to earn more.
- Refused: raids, theft, decay, hunger, and timers that destroy progress.
- **OQ-19.**

## 3. Session budget

- Every event is dimensioned for ~30 minutes a day across 2–3 visits.
- The track is completable at that budget, without the shop, inside the window.
- Checked by timing a real session, not by arithmetic.

## 4. The offline cap and event rewards

- The offline cap limits what the city produces while away. It never limits
  what a timer does.
- Event windows are timers, like the build queue, research and delve depths.
  They resolve in the post-cap tail advance.
- A 20-hour absence spanning a 24-hour window pays in full.
- A window that opens and closes inside an absence still fires.
- **OQ-24.**

## 5. The weekly event (built)

- A **48-hour window every 7 days**.
- Stable occurrence ids. Phases are persisted, so an event that paid out cannot
  pay twice on reload.
- Reconciliation runs before the offline replay.
- Seeded RNG picks the week's boon from five: Mana regen ×2 · active costs −50%
  · Stardust ×3 · delve speed ×2 · a free attunement slot for the window.
- On opening it pays a lump plus 5 Gems, then closes.
- It has no counter, minigame, track or shop (§2).

## 6. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Track thresholds and both reward columns | workbook |
| Points per source (§2.2) | workbook |
| Reveal prices on the event island | workbook |
| Shop stock, prices, refresh cadence | workbook |
| Window duration and period | the events file |
| Modifier template magnitudes | workbook |

## 7. Deliberately not in this design

- An event wallet row (§2.1)
- A regenerating roll resource (§2.2)
- A genre-foreign minigame (§2.3)
- Two separate ladders instead of two columns (OQ-20)
- Points that carry between events (OQ-21)
- An event that costs more than ~30 min/day (§3)
- A full second region for the island (§2.3)
- Re-expressing upgrade levels as modifiers

**Open questions:** OQ-18, OQ-19, OQ-20, OQ-21, OQ-22, OQ-23, OQ-24, OQ-4.
