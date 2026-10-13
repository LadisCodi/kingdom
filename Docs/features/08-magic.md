# 8 · Magic — Mana, the Sanctum, and landmarks

> **Scope.** What Mana is, what spends it, its cap and where the ceiling comes
> from, and the refills. What a tap is worth is [`04-harvest.md`](04-harvest.md);
> relic activation and spells are [`09-relics.md`](09-relics.md) §2; a fight
> is [`combat.md`](combat.md); the refill's place in the wider monetisation is
> [`14-monetization.md`](14-monetization.md).
>
> **Status: built.**

## 1. The rule

- **Mana is what magic and fighting cost, on both maps.**
  - In the province a tap on the ground is a small spell that hurries
    production. A tap on a building is free: it collects the building's store
    ([`03-economy.md`](03-economy.md) §3.2).
  - Every fight costs Mana, win or lose: a lair, a camp, a rival, a dungeon
    room, a Portal floor. Moving, claiming and garrisoning are free.
- Mana is capped; what the drip brings over the cap is lost. (Knowledge is
  capped too, but only its drip stops — [`07-research.md`](07-research.md) §3.)
- Mana is city-scoped.
- A new kingdom starts with a full pool.

## 2. Production and capacity

```
regen/h = (12 + the Sanctum's rate) × the Mana boost × a hero's boon
cap     = 100 + the Sanctum's capacity
              + 10 per claimed landmark + 10 for the repaired Watchtower
              + 10 per held Sanctuary on the world board
```

| Dial | Raised by | What it means to the player |
|---|---|---|
| **Production** (Mana/h) | the **Sanctum**; the Bag's **Mana boost** (+50%, 8 h); a Legendary's boon while owned (The Elven Princess, ×1.25) | the free allowance |
| **Capacity** (pool size) | the **Sanctum**, **landmarks**, the Watchtower, world **Sanctuaries** | how long an absence can be banked, and what one refill pays |

| | no Sanctum | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Production / h | 12 | 15 | 18 | 21 | 24 | 28 | 32 | 37 | 42 | 48 | 54 |
| Cap (no landmarks) | 100 | 124 | 148 | 172 | 200 | 232 | 268 | 308 | 352 | 400 | 452 |
| Fill from empty | 8.3 h | 8.3 h | 8.2 h | 8.2 h | 8.3 h | 8.3 h | 8.4 h | 8.3 h | 8.4 h | 8.3 h | 8.4 h |

- The Townhall level touches neither number.
- The pool fills from empty in **8.2–8.4 h at every Sanctum level** — about a
  night. Both base dials are tuned together to hold that fill.
- Landmarks add capacity, never rate, so each one lengthens the fill.
- The pool is its own ceiling while the player is away: there is no offline
  cap, and regen stops only when the pool is full.
- Mana is a **spend** budget: the pool can run dry.

### 2.1 Over the cap

- Only a whole-pool refill (§6), a quest's Mana reward and a refunded
  Runestone may take the pool past its cap. An overcharged pool has its own
  HUD state, distinct from full; regen banks nothing while it is over.
- Everything else stops at the cap: the drip, and a **Mana flask** from the
  Bag (25% or 100% of the cap).

## 3. Mana sinks

- Only the player spends Mana. There is no upkeep of any kind.

| Sink | Cost |
|---|---|
| Every tap on the ground — a tree, a bush, a crop, a rock, a shoal | **1 Mana** (`tap.manaCost`) |
| A tap on a building | **nothing** — it collects its store |
| Activating a hosted **city relic** — opens its window ([`09-relics.md`](09-relics.md) §2.1) | **20 Mana** (`artifacts` › `activeManaCost`) |
| Casting a **world relic's spell** while a Chapel holds it ([`09-relics.md`](09-relics.md) §2.2) | its `activeManaCost` — the Wanderer's Compass 25, the Wisp Lantern 20 |
| A **fight** — a lair, a camp, a rival, a dungeon room, a Portal floor | **20 Mana** (`combat.fightMana`) |
| Queueing a **Runestone** at the Rune Carver ([`17-workshops-and-goods.md`](17-workshops-and-goods.md) §2) | **20 Mana** an item, refunded on cancel |
| Paying fog | **nothing** — a reveal costs Gold |

## 4. The Sanctum

- A 2×2 city district, unlocked by `Consecration` (Kingdom chapter 2,
  [`tech-tree.md`](tech-tree.md)).
- Ten levels: capacity **+24 / 48 / 72 / 100 / 132 / 168 / 208 / 252 / 300 /
  352**, production **+3 / 6 / 9 / 12 / 16 / 20 / 25 / 30 / 36 / 42** per
  hour.
- Levels 2–10 need Townhall 2 / 3 / 3 / 4 / 6 / 7 / 8 / 9 / 10. Level 4 is
  opened by `Attunement II`, 5 by `Attunement III`, 6–10 by `Attunement IV`.
- One per city; `Second Sanctum` (chapter 7) allows a second, and both count.
- A Rune Carver beside it works 10% faster ([`03-economy.md`](03-economy.md) §3.1).
- Uses the district system as-is: count caps, distance-scaled build time,
  level gates, levels 4+ priced in precious materials and refined goods.

## 5. Landmarks

Claiming a landmark — paid in Gold, its authored `claimCost` — permanently:

- **+10 max Mana**.
- A lump of Knowledge ([`07-research.md`](07-research.md) §3).
- Lifts the fog five cells around it as **Discovered, never Revealed**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4).

Six landmarks on the map — standing stones and leysprings — and the
Watchtower, which counts as one once repaired
([`01-map-and-fog.md`](01-map-and-fog.md) §6.3):

- A full sweep takes the base pool **100 → 170**, and so what every refill
  pays.
- Production does not move with landmarks.

| City | pool | one refill pays |
|---|---|---|
| bare kingdom | 100 | **100** |
| six landmarks and the Watchtower | 170 | **170** |
| … and Sanctum L3 | 242 | **242** |
| … and Sanctum L10 | 522 | **522** |

## 6. The refill

A refill is **a whole pool** (the current cap), landing **on top of** whatever
is banked (§2.1). Two routes pay it, and they share nothing but the prize.

**By video**

- Offered only **below half a pool**, on a cooldown **randomised 30–90 s**.
- Offered as the *Mana refill* notice ([`26-notices.md`](26-notices.md) §2.2),
  whose card's **Watch** plays it.
- **5 a day.** With the day spent, the notice does not return until the reset.

**By Gems**

- Available whenever the pool is below its cap. No cooldown, no half-pool
  gate.
- A **ladder priced by refills already bought today**: 400 · 600 · 800 ·
  1,000 · 2,000 Gems. The price is never per Mana.
- **5 a day**: the ladder's rungs *are* the cap.

**The day**

- One counter per route, so the day's ceiling is **ten refills**.
- Both reset at **00:00 UTC**.
- Both roll **lazily**, on the next read, so nothing happens at midnight and a
  session left open across it resolves correctly.

### The screen

- Both routes live in the **Mana sheet**, which the header gauge opens as well
  as the Mana refill notice.
- It carries the pool, the one rate line, and the two buttons under a single
  prize line — **Gems left, video right, equal widths**, each under its own
  `Left today: n/5`.
- A route that cannot be taken says which of its conditions failed: the day's
  allowance (the count above the button, in clay), the cooldown, a full pool,
  or a pool still over half. A reason both routes share is printed once.

### Session arithmetic

```
arrive          96 mana   (12/h × 8 h away)
tap 46      →   50        the video is offered at half a pool
tap 50      →    0        ~25–50 s of tapping
watch ad    →  100        the reward is a whole pool
tap 50      →   50        offer returns
...                       3–4 ads, then the pool and the visit end together
```

- **~400 taps per visit** (96 free + 3 ads × 100) ≈ 10–12 minutes.
- **~290 free Mana a day** with no refill (12/h × 24); ten refills a day are
  1,000 more at a 100 pool.
- A fight costs as much as twenty taps.

## 7. Dials, in the order to reach for them

1. **`tap.workSeconds`** — 10. What a tap is worth, and therefore what a
   refill is worth ([`04-harvest.md`](04-harvest.md) §3.3). Doubling it
   doubles the refill with it (OQ-51, OQ-126).
2. **`mana.gemRefillCosts`** — the Gem ladder, **400 / 600 / 800 / 1,000 /
   2,000**, indexed by refills bought today. Its LENGTH is the daily cap.
3. **`combat.fightMana`** — 20. What every fight costs.
4. **`mana.baseCap`** — 100, flat. Session length per pool.
5. **`ads.manaRefillsPerDay`** — 5. The video's allowance, its own counter.
6. **`ads.cooldownMinSeconds` / `cooldownMaxSeconds`** — 30 / 90. The rhythm
   between offers.
7. **`mana.basePerHour`** — 12, flat. The free allowance. Moves with
   `mana.baseCap`: the two are tuned to keep the fill about a night (§2).
8. **`ads.eligibleBelowFraction`** — 0.5. How early the video shows up.

| Also | Value | Key |
|---|---|---|
| Sanctum capacity | +24 / 48 / 72 / 100 / 132 / 168 / 208 / 252 / 300 / 352 | `mana.sanctumCapPerLevel` |
| Sanctum production | +3 / 6 / 9 / 12 / 16 / 20 / 25 / 30 / 36 / 42 per hour | `mana.sanctumPerHourPerLevel` |
| Landmark capacity, and the Watchtower's | **+10 each** | `mana.landmarkCap` |
| Sanctuary capacity (world board) | +10 each | `worldBuild.sanctuaryManaCap` |
| City relic activation | 20 | `artifacts` › `activeManaCost` |
| Runestone | 20 an item | `goods` › Runestone › `inputMana` |
| Tap Mana cost, ground taps only | 1 | `tap.manaCost` |
| Mana flask | 25% · 100% of the cap | `items` › `value` |
| Mana boost | +50% regen, 8 h | `items` › `ManaBoost8h` |

## 8. What the player sees

- The header carries the pool as a **gauge** with the pool's number: the fill
  bar draws the ratio, the rim turns gold when the pool is full, and an
  overcharged pool (§2.1) has a state of its own.
- **Never a breakdown** of regen in the HUD.
- The full reading lives in the **Mana sheet**, which the gauge opens (§6).

## 9. Deliberately not in this design

- Upkeep of any kind (§3)
- Ley lines as a spatial magic layer
- Spell schools
- Mana as a build cost
- Mana as a research currency ([`07-research.md`](07-research.md) §3.1)
- Mana as the price of fog
- Offline casting
- Mana as the price of a Wonder level ([`16-wonders.md`](16-wonders.md) §3)
- Mana production or capacity from the Townhall level
- Mana for moving, claiming or garrisoning an army

**Open questions:** OQ-43, OQ-44, OQ-45, OQ-51, OQ-126.
