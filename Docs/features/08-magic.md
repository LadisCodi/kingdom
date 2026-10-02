# 8 · Magic — Mana, the Sanctum, and landmarks

> **Scope.** What Mana is, its cap, where the ceiling comes from, and the ad
> that refills it. What Mana *buys* — taps and **spells** — is
> [`04-harvest.md`](04-harvest.md) and [`09-relics.md`](09-relics.md); the ad's
> place in the wider monetisation is [`14-monetization.md`](14-monetization.md).
>
> **Status: built.**

## 1. The rule

- **Mana is what magic costs, on both maps.**
  - In the province a tap on the ground is a small spell that hurries
    production. A tap on a building is free: it collects the building's store
    ([`03-economy.md`](03-economy.md) §3.2).
  - On the world map it bends an expedition, reveals what a node holds, or
    shortens a march.
- Mana is capped, and Mana over the cap is lost. (Knowledge is capped too,
  but only its drip stops — [`07-research.md`](07-research.md) §3.)
- Mana is city-scoped.
- A new kingdom starts with a full pool.

## 2. Production and capacity

```
regen/h = 12 + Sanctum level (3 / 6 / 9 / 12 / 16) + Ley Taps rank × claimed landmarks
cap     = 100 + Sanctum level (24 / 48 / 72 / 100 / 132) + 10 per claimed landmark
          + Meditation (+30) + Deep Wells (+10 per rank)
```

| Dial | Raised by | What it means to the player |
|---|---|---|
| **Production** (Mana/h) | the **Sanctum**; `Ley Taps` per landmark | the free allowance |
| **Capacity** (pool size) | the **Sanctum**, **landmarks**, `Meditation`, `Deep Wells` | how long an absence can be banked, and what one ad pays |

| | no Sanctum | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|---|
| Production / h | 12 | 15 | 18 | 21 | 24 | 28 |
| Cap (no landmarks) | 100 | 124 | 148 | 172 | 200 | 232 |
| Fill from empty | 8.3 h | 8.3 h | 8.2 h | 8.2 h | 8.3 h | 8.3 h |

- The Townhall level touches neither number.
- The pool fills from empty in **8.2–8.3 h at every Sanctum level** — about a
  night. Both base dials are tuned to hold that fill.
- Landmarks add capacity, never rate, so each one lengthens the fill.
- The pool is its own ceiling while the player is away: there is no offline
  cap, and regen stops only when the pool is full.
- Mana is a **spend** budget: the pool is tuned to be able to run dry, not to
  refill exactly overnight.
- Mana over the cap is lost. Unspent potential is lost, never property.

## 3. Mana sinks

- Only the player spends Mana. There is no upkeep of any kind.
- A relic costs nothing: no upkeep, and nothing to attune — every relic the
  player has is on ([`09-relics.md`](09-relics.md) §1).

| Sink | Cost |
|---|---|
| Every tap on the ground — a tree, a bush, a rock, a shoal | **1 Mana** |
| A tap on a building | **nothing** — it collects its store |
| Casting a **spell**, either map ([`07-research.md`](07-research.md) §6) | its authored Mana cost, −20%/level of Resonance |
| Queueing a **Runestone** at the Rune Carver ([`17-workshops-and-goods.md`](17-workshops-and-goods.md) §2) | **20 Mana** an item — the only sink that is not a tap or a spell |
| Paying fog | **nothing** — a reveal costs Gold |

## 4. The Sanctum

- A city district, unlocked by `Consecration` (Magic era 1,
  [`tech-tree.md`](tech-tree.md) §4.1).
- Five levels: capacity **+24 / 48 / 72 / 100 / 132**, production
  **+3 / 6 / 9 / 12 / 16** per hour. L2 needs Townhall 2; L4 and L5 are
  granted by the `Attunement II` / `III` spine ranks.
- One per city; `Second Sanctum` (Magic era 3) allows a second.
- Uses the district system as-is: count caps, distance-scaled build time,
  level gates.

## 5. Landmarks

Claiming a landmark, permanently:

- **+10 max Mana**.
- Lifts the fog five cells around it as **Discovered, never Revealed**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4).

Ten landmarks on the map:

- A full sweep **doubles the base pool** (100 → 200), and so doubles what
  every ad pays.
- Production does not move with landmarks unless `Ley Taps` is researched
  (+1/h per landmark per rank).

| City | pool | one ad pays |
|---|---|---|
| bare kingdom | 100 | **100** |
| ten landmarks | 200 | **200** |
| ten landmarks, Sanctum L3 | 272 | **272** |
| ten landmarks, Sanctum L5, Meditation, Deep Wells V | 412 | **412** |

## 6. The refill

A refill is **a whole pool** (the current cap), landing **on top of** whatever
is banked — an overcharged pool has its own HUD state, distinct from full.
Two routes pay it, and they share nothing but the prize.

**By video**

- Offered only **below half a pool**, on a cooldown **randomised 30–90 s**.
- **5 a day.** With the day spent, the tab does not return until the reset.

**By Gems**

- Available whenever the pool has room. No cooldown, no half-pool gate.
- A **ladder priced by refills already bought today**: 400 · 600 · 800 ·
  1,000 · 2,000 Gems. The price is never per Mana — what rises is the rung,
  not the size of the pool it buys.
- **5 a day**: the ladder's rungs *are* the cap.

**The day**

- One counter per route. Spending the videos never closes the ladder, and
  buying pools never costs a video — so the day's ceiling is **ten refills**.
- Both reset at **00:00 UTC**: the sim may not read a clock it was not
  handed, so the day is the instant's, never the viewer's.
- Both roll **lazily**, on the next read, so nothing happens at midnight and a
  session left open across it resolves correctly.

### The screen

- Both routes live in the **Mana sheet**, which the header gauge opens as well
  as the offer tab — the Gem ladder is not an ad, so it must be reachable on a
  day with no video left.
- It carries the pool, the one rate line, and the two buttons under a single
  prize line — **Gems left, video right, equal widths**, each under its own
  `Left today: n/5`.
- A route that cannot be taken says which of its conditions failed: the day's
  allowance (the count above the button, in clay), the cooldown, a full pool,
  or a pool still over half. A reason both routes share is printed once.

### Session arithmetic

```
arrive          96 mana   (12/h × 8 h away, or 60 over a 5 h gap)
tap 46      →   50        offer appears at half a pool
tap 50      →    0        ~25–50 s of tapping
watch ad    →  100        the reward is a whole pool
tap 50      →   50        offer returns
...                       3–4 ads, then the pool and the visit end together
```

- **~400 taps per visit** (96 free + 3 ads × 100) ≈ 10–12 minutes.
- **5 videos/day**, the allowance — about two visits' worth.
- **~290 free taps/day** for a player who never watches an ad (12/h × 24).
  Worker income is unaffected by ads.
- **Ads are worth about three times the free allowance**: ten pools a day is
  1,000 Mana against the 288 an idle day pays. This line used to read "~12.5 h
  of production, ~50% faster", which did not follow from the numbers even
  before the pool doubled — the reward has been a WHOLE pool throughout.
- Burning half a pool takes 25–50 s; the cooldown averages 60 s, so the player
  waits 10–30 s at times. If this stalls in playtest, lower the cooldown
  maximum first.

## 7. Dials, in the order to reach for them

1. **`tap.workSeconds`** — 10. What a tap is worth, and therefore what an ad
   is worth: **a pool buys ~5.5 minutes of the city's own production, at both
   ends of the game** ([`04-harvest.md`](04-harvest.md) §3.3). The relation
   to hold is `tap.workSeconds ÷ tap.collectCooldownSeconds` against the crew the city can
   house. At 10 a bare thumb is worth 20 workers and Townhall 3 houses 30, so
   hand-play pays once `QuickHands` and `TapPower` are bought. **Doubling it
   doubles the ad with it.** Whether the ad economy balances on ~5.5 minutes
   is OQ-51.
2. **`mana.gemRefillCosts`** — the Gem ladder, **400 / 600 / 800 / 1,000 /
   2,000**, indexed by refills bought today. Its LENGTH is the daily cap, so
   adding a rung both extends the day and sets its price
   ([`14-monetization.md`](14-monetization.md) §2.2).
3. **`mana.baseCap`** — 100, flat. Session length per pool.
4. **`ads.manaRefillsPerDay`** — 5. The video's allowance, its own counter.
5. **`ads.cooldownMaxSeconds`** — 90. The rhythm between offers.
6. **`mana.basePerHour`** — 12, flat. The free allowance. Moves with `mana.baseCap`: the two are tuned to keep the fill about a night (§2).
7. **`ads.eligibleBelowFraction`** — 0.5. How early the offer shows up.

| Also | Value | Key |
|---|---|---|
| Sanctum capacity | +24 / 48 / 72 / 100 / 132 | `mana.sanctumCapPerLevel` |
| Sanctum production | +3 / 6 / 9 / 12 / 16 per hour | `mana.sanctumPerHourPerLevel` |
| Landmark capacity | **+10 each** | `mana.landmarkCap` |
| `Meditation` | +30 capacity | `mana.meditationCap` |
| `Deep Wells I–V` · `Ley Taps I–III` | +10 capacity per rank · +1/h per landmark per rank | `?dev=tree` ([`tech-tree.md`](tech-tree.md) §4.4) |
| Gem refill | a whole pool, **400 → 2,000 Gems** by rung, 5 a day | `mana.gemRefillCosts` |
| Video refill | a whole pool, **5 a day** | `ads.manaRefillsPerDay` |
| Tap Mana cost, ground taps only | 1 | `tap.manaCost` |
| Ad reward | the whole cap | — |

## 8. What the player sees

- The header carries the pool as a **gauge**: the fill bar draws the ratio and
  the rim turns gold when it is spilling. No numeric readout beside it.
- **Never a breakdown** of regen in the HUD.
- The full reading lives in the **Mana sheet**, which the gauge opens (§6).

## 9. Deliberately not in this design

- Upkeep of any kind (§3)
- Ley lines as a spatial magic layer
- Spell schools or a magic tech tree
- Mana as a build cost
- Mana as a research currency ([`07-research.md`](07-research.md) §3.1)
- Mana as the price of fog
- Offline casting
- Mana as the price of a Wonder level ([`16-wonders.md`](16-wonders.md) §3)
- Mana production or capacity from the Townhall level

**Open questions:** OQ-43, OQ-44, OQ-45, OQ-47.
