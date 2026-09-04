# 8 · Magic — Mana, the Sanctum, and landmarks

> **Scope.** What Mana is, why it is capped, where the ceiling comes from, and
> the ad that refills it. What Mana *buys* — taps and **spells** — is
> [`04-harvest.md`](04-harvest.md) and [`09-relics.md`](09-relics.md); the ad's
> place in the wider monetisation is [`14-monetization.md`](14-monetization.md).
>
> **Status: built.**

## 1. The rule

> **Mana is what magic costs, wherever you are.**

In the province it hurries production — a tap is a small spell. On the world map
it bends an expedition, reveals what a node holds, or shortens a siege.

That framing matters more than it looks. *Mana is a tap budget* is mechanically
clean and **thematically empty**, and thematic emptiness is exactly the
complaint on record about the game after magic was cut: it *reads like a generic
village simulator (charming)*. Making Mana the magic budget across both scopes,
with relics as the spells, puts the wizard-monarch back at the centre.

**Mana is the only currency in the game with a cap**, and it is city-scoped.

## 2. Two dials that must keep doing different jobs

```
regen/h = base(Townhall level) + nothing else
cap     = base(Townhall level) + Sanctum + 10 per claimed landmark
```

| Dial | Raised by | What it means to the player |
|---|---|---|
| **Production** (Mana/h) | Townhall level | how much you get for *free* |
| **Capacity** (pool size) | the **Sanctum**, and **landmarks** | how long an *absence* you can bank, and how big an ad is |

Conflating them would waste both. Production answers *how much can I do
today*; capacity answers *how long can I be away without spilling*, and — because
an ad pays a whole pool — *how much is an ad worth*.

| | TH1 | TH2 | TH3 |
|---|---|---|---|
| Production / h | 10 | 13 | 16 |
| Base cap | 100 | 130 | 160 |
| Fill from empty | 10 h | 10 h | 10 h |

**A new kingdom starts full.**

## 3. Why the pool must be able to run dry

An earlier design held a tuning law — **cap ≈ 8 × net regen** — which kept *an
overnight absence fills the pool exactly* true at every stage of the game.

**That law belonged to a pool whose only job was sustaining artifacts — an
ABSENCE budget.** Mana is now the energy every player tap is paid from, which
makes it a **SPEND budget**, and the two want opposite things: an absence budget
should refill exactly overnight, while a spend budget **has to be able to run out
or there is nothing for a refill to sell.**

> **So the law is suspended by decision, not by drift.** The pool fills in
> **10 h at every Townhall level** — past the 8 h offline cap on purpose — and
> that gap between 8 and 10 is the demand a Gem refill and a rewarded ad sell
> against.

Anyone retuning production has to know which budget they are tuning for.

A player who checks in two or three times a day wastes nothing. A player who
checks in once a day wastes some. That is the session budget expressed as a
mechanic — and it is pressure that takes nothing away: **you lose unspent
potential, never property.**

## 4. Nothing draws against the pool

Attuned relics used to charge an hourly Mana upkeep. **Removed.**

Once Mana became the energy every tap is paid from, the two jobs fought: at
Townhall 1 the full relic set drew exactly what the Townhall made, so **wearing
everything stalled the pool dead** and left nothing to play with.

Attuning is free now. What a relic costs is **exclusivity** — it is worn at home
*or* carried underground, never both — and a cost you cannot out-produce is a
firmer constraint than one you can
([`09-relics.md`](09-relics.md) §5).

So: the only thing that spends Mana is the player.

| Sink | Cost |
|---|---|
| Every player tap — a house, a tree, a rock | **1 Mana** |
| Casting a **spell**, either map ([`07-research.md`](07-research.md) §7) | its authored Mana cost, −20%/level of Resonance |
| Paying fog | **nothing** — a reveal already costs Gold |

## 5. The Sanctum

A city district whose whole job is capacity: **+24 / +48 / +72** across three
levels, one per city, gated on the Attunement branch. It reuses the district
system wholesale — count caps, distance-scaled build time, level gates.

Production is the Townhall's job; capacity is the Sanctum's. Keeping them apart
is what makes the Sanctum worth building precisely when a session has grown into
it.

## 6. Landmarks make exploration compound

Claiming a landmark does two things, permanently: **+10 max Mana**, and it lifts
the fog five cells around it as **Discovered, never Revealed**
([`01-map-and-fog.md`](01-map-and-fog.md) §4).

Ten on the map, so a full sweep **doubles the base pool** — and because the ad
reward is a whole pool, it **doubles what every future ad pays**.

| City | pool | one ad pays |
|---|---|---|
| bare Townhall 1 | 100 | **100** |
| Townhall 1, five sanctuaries | 150 | **150** |
| Townhall 3, all ten, Sanctum L3 | 332 | **332** |

> explore → a bigger pool → a bigger ad → more taps → explore further

**Capacity, not rate, and that was a change.** The +1 Mana/h it replaced was
worth most on the day you found it and less every day after, because production
is a rate and the things it competed with kept growing. Capacity is worth *more*
the longer you play, which is the shape a reward at the end of an exponential
cost curve wants.

**The trade, stated plainly:** a fully-explored pool takes ~21 h to refill for
free rather than 10 h, so **the free share of a session shrinks as you
progress.** The absolute free allowance is unchanged — production is still
10–16/h — but the ceiling it fills is taller. That is the intended direction, and
it is the number to watch if free play starts to feel thin.

The second and third sanctuaries also earn a job beyond capacity: each is a
lantern held up over a new part of the world, which turns *go and claim the far
one* into a reason to explore rather than a chore at the end of exploring.

## 7. The ad, and the session it shapes

**One rewarded placement today, and it is the model for the rest.** The reward is
**a whole pool**, so it is worth the same fraction of progress at hour 1 and hour
40 without anything re-derived.

- **The offer only appears below half a pool.** It answers a shortage rather
  than interrupting.
- **The cooldown is randomised 30–90 s**, so it never becomes a metronome.
- **A reward lands on top of the cap.** A reward clamped to a ceiling the player
  is already near would pay nothing and read as broken. An overcharged pool gets
  its own HUD state, distinct from full: full means *the next hour is spilling*,
  overcharged means *an ad bought more than the ceiling holds*.

### The session, in arithmetic

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
- **~180 free taps/day** for a player who never watches one — a real daily
  session, and worker income is untouched either way. **Ads accelerate; they
  never gate.**
- **Ads add ~12.5 h of production per day** on top of 24 h idle: a watcher
  progresses ~50% faster. A meaningful offer, not a different game.

**One deliberate friction:** burning half a pool takes 25–50 s while the cooldown
averages 60 s, so the player occasionally waits 10–30 s. That gap is where they
place buildings and spend what they just gathered. If playtest says it stalls,
the cooldown maximum is the dial — lower it before anything else.

## 8. Dials, in the order to reach for them

1. **`tap.work_seconds`** — 10. What a tap is worth, and therefore what an ad
   is worth: **a pool buys ~5.5 minutes of the city's own production, at both
   ends of the game** ([`04-harvest.md`](04-harvest.md) §4.3). It was 45 seconds
   of the WHOLE CITY's production until 2026-09-03, which made a pool worth
   ~800× more than it now is. **The relation to hold is `work_seconds ÷
   collect_cooldown` against the crew the city can house** — and at 10 it does
   NOT hold at the bottom of the ladder: the thumb is worth 20 workers and
   Townhall 3 houses 30, so a bare thumb is two thirds of the crew it already
   owns and hand-play only pays once `QuickHands` and `TapPower` are bought
   into. That was chosen for the feel of the gesture (ten taps to a tree), and
   **this dial is the lever if a mature city's hand-play feels pointless —
   doubling it doubles the ad with it.** Whether the ad ECONOMY balances on
   ~5.5 minutes is OQ-51.
2. **`mana.gem_refill_full_pool`** — a full pool is **500 Gems** at every stage
   (one $0.99 pouch, [`14-monetization.md`](14-monetization.md) §2.2), and a
   half-empty pool half that. Priced against the cap rather than per Mana on
   purpose: the old flat 4-a-Gem made a full refill cost 83 Gems against a
   lifetime faucet of 75, and went stale the moment the pool grew.
3. **`mana.base_cap_per_townhall_level`** — 100 / 130 / 160. Session length per
   pool.
4. **`ads.cooldown_max_seconds`** — 90. The rhythm between offers.
5. **`mana.production_per_townhall_level`** — 10 / 13 / 16. How much a
   non-watcher gets free.
6. **`ads.eligible_below_fraction`** — 0.5. How early the offer shows up.

| Also | Value | Key |
|---|---|---|
| Sanctum capacity | +24 / 48 / 72 | `mana.sanctum_cap_per_level` |
| Landmark capacity | **+10 each** | `mana.landmark_cap` |
| Gem refill | **500 Gems a full pool**, pro rata on what is missing | `mana.gem_refill_full_pool` |
| Tap Mana cost | 1 | `tap.mana_cost` |
| Ad reward | the whole cap | — |

## 9. What the player sees

**The header carries the pool as a gauge, and one figure only.** The fill bar
draws the ratio and the rim turns gold when it is spilling, so `64/100` was the
same fact twice in the tightest row in the game. **Never a breakdown** —
`+6/h base −4/h upkeep = +2/h` in the HUD is exactly the spreadsheet chrome the
UI brief exists to kill. The full reading lives in the Reliquary, where it is
spent.

## 10. Deliberately not in this design

Upkeep of any kind (§4) · ley lines as a spatial magic layer · spell schools or
a magic tech tree · Mana as a build cost · Mana as a research currency
([`07-research.md`](07-research.md) §3.1) · Mana as the price of fog · offline
casting · **Mana as the price of a Wonder level** — Wonders are fed with Gold
and nothing else ([`16-wonders.md`](16-wonders.md) §3).

**Open questions:** OQ-43, OQ-44, OQ-45, OQ-47. OQ-27 closed 2026-09-04: a
refill is 500 Gems, half a pull.
