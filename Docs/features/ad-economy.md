# Feature: the ad economy — Mana, taps and rewarded video as one loop

> How the three systems that meet at a tap are tuned against each other, for a
> **30–40 minute day across two or three visits**. Mana is the energy, a tap is
> what it buys, and a rewarded ad is where more of it comes from.
> Status: **built** (2026-09-02) — balancing, the sim, and the three screens.

Companion docs: [`magic.md`](magic.md) (what Mana is),
[`harvest-loop.md`](harvest-loop.md) (what a tap does),
[`balancing-v2.md`](balancing-v2.md) (the house tap this generalises).

## Why this exists

Tapping became Mana-gated, which made three systems that had never been tuned
against each other into one loop. Measuring them together found a problem that
invalidated every other number:

| | throughput |
|---|---|
| One Sawmill L1 — 3 workers, 12 s round trip | **900 Wood/h** |
| A full Mana pool — 50 taps × yield 1 | **50 Wood, once** |

**A tap was ~60× weaker than one building.** An ad was therefore worth about
three minutes of idle production, and got worse every hour the city grew. No
pool size or cooldown fixes that — the *unit* was wrong.

## 1. The rule: a tap pulls production forward

> **A tap hands you `tap.boost_seconds` of what you tapped is producing.**

Floored at the authored yield, so the first session works before a single
worker exists:

```
tapYield(resource) = max(
  spec.yieldPerTap + TapPower,                    // the floor, early game
  cityGatherPerSecond(resource) × TAP.boostSeconds
)
```

This is not a new idea here — it is what the **house tap has always done**.
`houseTap` pulls `boostSeconds × share` of city income forward, and because
`share × cityRate` *is* that house's own rate, it already meant "N seconds of
this house's rent". Resource cells simply joined it, and the two collapsed into
**one number**: `taxes.tap_boost_seconds` is gone, folded into
`tap.boost_seconds`.

One sentence now covers every tap in the game: **tapping hurries production
along, and Mana is what it costs.**

**Why it had to scale.** A flat yield is worth 73 minutes of production against
one Sawmill and under three against six. Priced against production instead, a
full pool is worth `cap × boostSeconds` of progress at *every* stage, with no
re-derivation per era:

| City | gather rate | tap yield | pool | = production |
|---|---|---|---|---|
| no workers | 0/s | **1** (the floor) | 100 wood | — |
| 1 Sawmill L1 | 0.25/s | 11 | 1,100 wood | 73 min |
| 2 Sawmills L2 | 0.71/s | 32 | 4,160 wood | 97 min |
| 3 Sawmills L3 | 1.31/s | 59 | 9,440 wood | 120 min |

The span grows only because the cap ladder grows — a bigger city buys a longer
session, which is the intended progression feel.

`cityGatherPerSecond` (`src/sim/upgrades.ts`) is **nominal, not measured**: it
takes the influence radius as the worker's travel distance, so it needs no map
and no clock and a tap can read it. A district whose cells are all adjacent
under-reports; one working the rim over-reports. That is fine for a balance
dial, and it means tap yield is an *estimate* of production rather than a
promise.

## 2. Nothing draws against the pool

Relics used to charge an hourly Mana upkeep while attuned. **Removed.** Once
Mana became the energy every tap is paid from, the two jobs fought: at Townhall
1 the full relic set drew exactly what the Townhall made, so wearing everything
stalled the pool dead and left nothing to play with.

Attune-or-arm survives intact, because that rule was never really about price.
A relic is attuned to the kingdom **or** carried down by a hero, never both, so
the question is still *"which do I need right now"* — an economy passive at
home, or combat stats below.

## 3. The numbers

| Dial | Value | Why |
|---|---|---|
| `tap.mana_cost` | 1 | The pool size is the dial, not the price |
| `tap.boost_seconds` | **45** | The strongest single dial in the loop |
| `mana.base_cap_per_townhall_level` | 100, 130, 160 | A pool must outlast the ad cooldown so the player never waits on it; ~100 is also what the early map absorbs before cells need recovery |
| `mana.production_per_townhall_level` | 10, 13, 16 /h | Fill time is **10 h at every level** — deliberately past the 8 h offline cap, so the pool stays a *spend* budget |
| `mana.sanctum_cap_per_level` | 24, 48, 72 | Keeps the Sanctum worth the same fraction of the pool |
| `ads.cooldown_min/max_seconds` | 30 / 90 | Randomised so the offer never becomes a metronome |
| `ads.eligible_below_fraction` | 0.5 | Makes the offer an answer to being short, not an interruption |
| `mana.landmark_cap` | **+10 per sanctuary** | Ten on the map: exploring the lot DOUBLES the pool, and therefore doubles every future ad |
| ad reward | `manaCap` | One ad ≈ one pool ≈ one more span of production |

## 3b. Exploring makes the ad bigger

Sanctuaries raise **capacity**, not rate (changed 2026-09-02). Because an ad
pays a whole pool, a claim makes every future ad permanently larger:

| City | pool | one ad pays |
|---|---|---|
| bare Townhall 1 | 100 | **100** |
| Townhall 1, five sanctuaries | 150 | **150** |
| Townhall 3, all ten, Sanctum L3 | 332 | **332** |

That is the shape a reward at the end of an exponential fog cost wants: worth
*more* the longer you play. The +1 Mana/h it replaced was worth most on the day
you found it and less every day after, because production is a rate and the
things it competed with kept growing.

The trade, stated plainly: a fully-explored pool takes ~21 h to refill for free
rather than 10 h, so the free share of a session *shrinks* as you progress. The
absolute free allowance is unchanged — production is still 10–16/h — but the
ceiling it fills is taller. That is the intended direction, and it is the
number to watch if free play starts to feel thin.

## 4. The session, in arithmetic

```
arrive          80 mana   (10/h × 8 h overnight cap, or 50 over a 5 h gap)
tap 30      →   50        offer appears
tap 50      →    0        ~25-50 s of tapping
watch ad    →  100
tap 50      →   50        offer returns
...                       3-4 ads, then the pool and the visit end together
```

- **~380 taps per visit** (80 free + 3 ads × 100) ≈ 10–12 minutes.
- **~10 ads/day** across three visits.
- **~180 free taps/day** for a player who never watches one — a real daily
  session, and worker income is untouched either way. Ads accelerate; they
  never gate. That is the *"play buys everything else"* pillar held.
- **Ads add ~12.5 h of production per day** on top of 24 h idle: a watcher
  progresses ~50% faster. A meaningful offer, not a different game.

**One deliberate friction:** burning half a pool takes 25–50 s while the
cooldown averages 60 s, so the player occasionally waits ~10–30 s. That gap is
where they place buildings and spend what they just gathered. If playtest says
it stalls, `cooldown_max_seconds` is the dial — lower it before anything else.

## 5. The three screens

| Surface | Where | Why there |
|---|---|---|
| **The tab** | `#adoffer`, right edge of the frame, z 4 | Slides in on a class toggle with a forced reflow — `data-entering` is ScreenSlot-only and never fires for a permanently mounted widget. Hides behind any sheet, like the quest and delve pills |
| **The popup** | a kit `sheet()` in `#overlay` | The X and "No thanks" both just close it; only claiming consumes the offer, so a mis-tap costs nothing |
| **The video** | `#ad`, its own mount, z 200 | NOT an overlay: `#overlay` is z 5 and that makes it a stacking context, so nothing inside can rise above the nav (10) or the settings knob (20). Being outside the overlay system is also what makes "no escape" structural — `dismiss()` and the tap-beside-a-sheet handler cannot reach it |

`#ad` carries `:empty { display: none }`, without which an `inset: 0` element
with `pointer-events: auto` would swallow every tap on the map.

The countdown is derived from a timestamp, never a decremented integer, so a
throttled background tab resolves to the right number on return instead of
freezing. The once-a-second tick would land the Claim button up to a second
late, so the screen arms one timeout for exactly the time remaining.

An overcharged pool gets its own HUD state, distinct from full: full means
"the next hour is spilling", overcharged means "an ad bought more than the
ceiling holds".

## 6. Dials, in the order to reach for them

1. `tap.boost_seconds` — what a tap is worth, and therefore what an ad is worth.
2. `mana.base_cap_per_townhall_level` — session length per pool.
3. `ads.cooldown_max_seconds` — the rhythm between offers.
4. `mana.production_per_townhall_level` — how much a non-watcher gets free.
5. `ads.eligible_below_fraction` — how early the offer shows up.

## Open questions

- **Late-game costs.** Taps now scale with production and a watcher gathers
  ~50% faster; whether `build_cost_exponential_growth` absorbs that is the
  first thing to look at after playtest.
- **Cell exhaustion becomes the ceiling.** A 100-tap pool needs 10 fully
  exhausted Forest cells and the map has 17. Comfortable now; it is what bites
  first if the pool grows again.
- **Ads per day is a target, not a measurement.** The acceptance test is timing
  a real visit and counting.
