# 8 · Magic — Mana, the Sanctum, and landmarks

> **Scope.** What Mana is, its cap, where the ceiling comes from, and the ad
> that refills it. What Mana *buys* — taps and **spells** — is
> [`04-harvest.md`](04-harvest.md) and [`09-relics.md`](09-relics.md); the ad's
> place in the wider monetisation is [`14-monetization.md`](14-monetization.md).
>
> **Status: built.**

## 1. The rule

- **Mana is what magic costs, on both maps.**
  - In the province a tap is a small spell that hurries production.
  - On the world map it bends an expedition, reveals what a node holds, or
    shortens a siege.
- Mana is the only currency in the game with a cap.
- Mana is city-scoped.
- A new kingdom starts with a full pool.

## 2. Production and capacity

```
regen/h = 6 + Sanctum level (3 / 6 / 9 / 12 / 16) + Ley Taps rank × claimed landmarks
cap     = 50 + Sanctum level (24 / 48 / 72 / 100 / 132) + 10 per claimed landmark
          + Meditation (+30) + Deep Wells (+10 per rank)
```

| Dial | Raised by | What it means to the player |
|---|---|---|
| **Production** (Mana/h) | the **Sanctum**; `Ley Taps` per landmark | the free allowance |
| **Capacity** (pool size) | the **Sanctum**, **landmarks**, `Meditation`, `Deep Wells` | how long an absence can be banked, and what one ad pays |

| | no Sanctum | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|---|
| Production / h | 6 | 9 | 12 | 15 | 18 | 22 |
| Cap (no landmarks) | 50 | 74 | 98 | 122 | 150 | 182 |
| Fill from empty | 8.3 h | 8.2 h | 8.2 h | 8.1 h | 8.3 h | 8.3 h |

- The Townhall level touches neither number.
- The pool fills from empty in **8.1–8.3 h at every Sanctum level** — past the
  8 h offline cap (**OQ-70**). Landmarks add capacity, never rate, so each one
  lengthens the fill. The gap past 8 h is the demand a Gem refill and a
  rewarded ad sell against.
- Mana is a **spend** budget: the pool is tuned to be able to run dry, not to
  refill exactly overnight.
- Mana over the cap is lost. Unspent potential is lost, never property.

## 3. Mana sinks

- Only the player spends Mana. There is no upkeep of any kind.
- Attuning a relic is free. A relic is worn at home *or* carried underground,
  never both ([`09-relics.md`](09-relics.md) §5).

| Sink | Cost |
|---|---|
| Every player tap — a house, a tree, a rock | **1 Mana** |
| Casting a **spell**, either map ([`07-research.md`](07-research.md) §6) | its authored Mana cost, −20%/level of Resonance |
| Paying fog | **nothing** — a reveal costs Gold |

## 4. The Sanctum

- A city district, unlocked by `Consecration` (Magic era 1,
  [`tech-tree.md`](tech-tree.md) §4.1).
- Five levels: capacity **+24 / 48 / 72 / 100 / 132**, production
  **+3 / 6 / 9 / 12 / 16** per hour. L2 needs Townhall 2; L4 and L5 are
  granted by the `Attunement II` / `III` keystones.
- One per city; `Second Sanctum` (Magic era 3) allows a second.
- Uses the district system as-is: count caps, distance-scaled build time,
  level gates.

## 5. Landmarks

Claiming a landmark, permanently:

- **+10 max Mana**.
- Lifts the fog five cells around it as **Discovered, never Revealed**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4).

Ten landmarks on the map:

- A full sweep **triples the base pool** (50 → 150), and so triples what
  every ad pays.
- Production does not move with landmarks unless `Ley Taps` is researched
  (+1/h per landmark per rank).

| City | pool | one ad pays |
|---|---|---|
| bare kingdom | 50 | **50** |
| ten landmarks | 150 | **150** |
| ten landmarks, Sanctum L3 | 222 | **222** |
| ten landmarks, Sanctum L5, Meditation, Deep Wells V | 302 | **302** |

## 6. The rewarded ad

- One rewarded placement. The reward is **a whole pool** (the current cap).
- The offer appears only **below half a pool**.
- The cooldown between offers is **randomised 30–90 s**.
- **A reward lands on top of the cap.** An overcharged pool has its own HUD
  state, distinct from full.

### Session arithmetic

```
arrive          80 mana   (10/h × the 8 h cap, or 50 over a 5 h gap)
tap 30      →   50        offer appears
tap 50      →    0        ~25–50 s of tapping
watch ad    →  100
tap 50      →   50        offer returns
...                       3–4 ads, then the pool and the visit end together
```

- **~380 taps per visit** (80 free + 3 ads × 100) ≈ 10–12 minutes.
- **~10 ads/day** across three visits.
- **~180 free taps/day** for a player who never watches an ad. Worker income
  is unaffected by ads.
- **Ads add ~12.5 h of production per day** on top of 24 h idle: a watcher
  progresses ~50% faster.
- Burning half a pool takes 25–50 s; the cooldown averages 60 s, so the player
  waits 10–30 s at times. If this stalls in playtest, lower the cooldown
  maximum first.

## 7. Dials, in the order to reach for them

1. **`tap.work_seconds`** — 10. What a tap is worth, and therefore what an ad
   is worth: **a pool buys ~5.5 minutes of the city's own production, at both
   ends of the game** ([`04-harvest.md`](04-harvest.md) §3.3). The relation
   to hold is `work_seconds ÷ collect_cooldown` against the crew the city can
   house. At 10 a bare thumb is worth 20 workers and Townhall 3 houses 30, so
   hand-play pays once `QuickHands` and `TapPower` are bought. **Doubling it
   doubles the ad with it.** Whether the ad economy balances on ~5.5 minutes
   is OQ-51.
2. **`mana.gem_refill_full_pool`** — a full pool is **500 Gems** at every stage
   (one $0.99 pouch, [`14-monetization.md`](14-monetization.md) §2.2); a
   half-empty pool costs half. Priced against the cap, not per Mana.
3. **`mana.base_cap`** — 50, flat. Session length per pool.
4. **`ads.cooldown_max_seconds`** — 90. The rhythm between offers.
5. **`mana.base_per_hour`** — 6, flat. The free allowance.
6. **`ads.eligible_below_fraction`** — 0.5. How early the offer shows up.

| Also | Value | Key |
|---|---|---|
| Sanctum capacity | +24 / 48 / 72 / 100 / 132 | `mana.sanctum_cap_per_level` |
| Sanctum production | +3 / 6 / 9 / 12 / 16 per hour | `mana.sanctum_per_hour_per_level` |
| Landmark capacity | **+10 each** | `mana.landmark_cap` |
| `Meditation` | +30 capacity | `mana.meditation_cap` |
| `Deep Wells I–V` · `Ley Taps I–III` | +10 capacity per rank · +1/h per landmark per rank | `Technologies` ([`tech-tree.md`](tech-tree.md) §4.4) |
| Gem refill | **500 Gems a full pool**, pro rata on what is missing | `mana.gem_refill_full_pool` |
| Tap Mana cost | 1 | `tap.mana_cost` |
| Ad reward | the whole cap | — |

## 8. What the player sees

- The header carries the pool as a **gauge**: the fill bar draws the ratio and
  the rim turns gold when it is spilling. No numeric readout beside it.
- **Never a breakdown** of regen in the HUD.
- The full reading lives in the Reliquary.

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

**Open questions:** OQ-43, OQ-44, OQ-45, OQ-47, OQ-70.
