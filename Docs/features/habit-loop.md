# Feature: the habit layer — a reason to open the game tomorrow

> Phase 1 of [`../road-to-mvp.md`](../road-to-mvp.md). Two mechanics that give
> a player something to want on a day when no designer authored anything:
> a **daily chest** and **generated orders**.
> **Status: the daily chest is BUILT (2026-09-02). Generated orders are
> unblocked — decision 3 closed 2026-09-03 and the Market moved into the
> opening to meet them — and are the next thing to build.**
>
> Companion docs: [`quests.md`](quests.md) (the goal types this reuses),
> [`ad-economy.md`](ad-economy.md) (what Mana is worth),
> [`economy-taxes-and-market.md`](economy-taxes-and-market.md) (the Market,
> which is where orders live).

## Why this exists

Every sink in Kingdom is finite and already measured: **6,600 Gold of
technology tree against a quest chain that pays 12,075** (see
[`balancing-v3.md`](balancing-v3.md) §2). Buildings have count caps. Units and
supplies are consumed but bounded by the army cap. When the tree is finished —
three hours — surplus has nowhere to go, and the Market only converts it into
Gold, which also has nowhere to go.

And the daily chest is the only mechanic present in all six comparables *and*
all three modern 4X titles that Kingdom does not have. It is a reward table and
a timestamp.

Both are aimed at the MVP's first question: **on day 14, is there still
something to want that nobody had to author by hand?**

---

## 1. The daily chest, and a streak that cannot be lost — **BUILT**

### 1.1 The pillar problem, and the design that solves it

A conventional login streak resets to zero when you miss a day. **That is a
loss of accumulated progress, and it breaks promise 1** — *nothing you own is
ever taken from you*. It is also exactly the mechanic that makes a cozy game
feel like an obligation, which is the churn risk the audit warned about for the
~30 min/day segment.

> **The rule: the ladder advances on days played, never on calendar days.**

Step 1 the first day you open the game, step 2 the second day you open it,
whether that is tomorrow or in three weeks. Missing a day costs you **that
day's chest** — an opportunity that expired, which is the sanctioned pressure —
and nothing else. The ladder is a possession; the day is not.

This also removes the whole class of bug where a timezone, a clock change or a
device swap eats someone's streak, and it means the mechanic needs no
"streak repair" purchase, which is the ugliest SKU in the genre.

### 1.2 What it pays

**Mana is the primary reward, and it is the obvious one:** it is already the
thing a returning player wants, it is already the only capped currency, and
`ad-economy.md` §1 already prices it in *seconds of the player's own
production*, so a Mana reward never goes stale as the city grows.

| Ladder step | Reward | Why |
|---|---|---|
| 1 | Mana, ~⅓ pool | Arrive, have something to spend |
| 2 | Mana, ~⅓ pool | |
| 3 | Mana, ~½ pool | |
| 4 | Mana, ~⅓ pool + a small Gold sum | |
| 5 | Mana, ~½ pool | |
| 6 | Mana, ~⅓ pool | |
| **7 · week marker** | **Full pool + Gems** | The recurring Gem faucet |
| 8+ | the same seven-step cycle, repeating | |

The Mana amounts are **fractions of `manaCap`, not absolute numbers**, for the
same reason the ad reward is a whole pool: ten claimed sanctuaries double the
cap, so the chest grows with exploration without a second table.

The Gems at the week marker do a second job.
[`balancing-v3.md`](balancing-v3.md) §3 found that the authored Gem faucet is
75 up front and **concentrated in four late quests** — a player who stops at
quest 20 still has the ten they started with, so every Gem price in the game is
invisible for the whole first session. The MVP needs Gems circulating in week
one or the simulated store has nothing to measure. A week marker at 5 Gems is
~20/month, which is the recurring faucet `balancing-v2.md` §1.3 asked for and
never got.

### 1.3 Mechanics

- **Day index is derived, never stored as a counter:**
  `dayIndex = floor((t - EPOCH) / 86_400_000)` in a fixed zone. Compare against
  `lastClaimedDay`. This is the same pull-based pattern as
  `isActive(m, state.lastAdvance)` and `recoverIfDue` — no decremented
  integers, so a throttled tab or a long absence resolves to the right number
  instead of drifting.
- **Not a boundary source.** The chest is an opportunity offered to a player,
  not economy: nothing in the sim reads it, claiming is always a live command.
  Same argument `adOffers.ts` makes for itself in its header comment, and for
  the same reason — a daily timer registered in `advance()` would propose a
  boundary per day across a long absence for no simulation benefit.
- **A missed day is not paid retroactively.** Consistent with
  `engine-seams.md` §5's rule that the offline cap limits production and not
  timers: the chest is neither. It is an offer, and an offer that was not taken
  is gone. One claim per day, never a backlog of seven.
- **Save:** `kingdom.daily { ladderStep, lastClaimedDay }`. Kingdom-scoped
  deliberately, so it survives a region reset like Knowledge does. Additive
  module key ⇒ **no migrator needed**, per `engine-seams.md` §4 — bump
  `SAVE_VERSION` and the defensive reader fills it in.

### 1.4 Where it appears

The chest is a **pill**, not a modal. The game already has this pattern three
times — `questPill.ts`, `delvePill.ts`, `adOfferPill.ts` — and the rule that
comes with it: pills hide behind any sheet, and z-order below the nav. A daily
reward that interrupts the first tap of a session is the single most disliked
screen in the genre; a pill that glows and waits is not.

**Closed: it only glows.** The pill never opens the sheet by itself. The whole
design above is about a game that does not make demands, and a build that opens
with one contradicts it in the first second of the session. The cost is real
and accepted — a player can finish a session without noticing the chest, and
lose it — which is the same sanctioned pressure a missed day already carries.
It stays a one-line change if a playtest disagrees.

### 1.5 As built

`src/sim/daily.ts`, `tests/daily.test.ts` (15 assertions), and two UI files —
`dailyPill.ts` (glows, waits) and `dailySheet.ts` (the ladder, drawn).

Three things worth knowing that the design above did not settle:

- **The rollover is UTC.** A local-midnight rollover would make the ladder
  depend on where the device thinks it is — a player crossing a timezone could
  claim twice or lose a day — and the sim is not allowed to read anything that
  is not passed in. The cost is that "a new day" lands at a different
  wall-clock hour for different players, which for a mechanic that never
  punishes a miss is a cost of nothing.
- **`lastClaimedDay` is stamped, not incremented**, so a second claim in one
  day is impossible however the clock moves — *including backwards*, which is
  the failure a decremented counter would have paid out on.
- **The Gold step is priced in seconds of the city's own tax income** with an
  authored floor (`daily.gold_floor`), so it neither goes stale by era three
  nor pays zero to a city that has not housed anyone yet.

The ladder is drawn with the rungs behind you **lit rather than greyed**, and
there is no countdown anywhere on the sheet. Most progress UI exists to create
urgency; this one exists to remove it.

---

## 2. Generated orders — **unstarted**

### 2.1 What an order is

*"Bring me 40 Wood, 25 Stone and 10 Food — take 600 Gold and 2 Fragments."*

Three slots, refreshed daily, drawn from the seeded RNG. It is the trains of
Township, the Merchant of Family Island and the Order Board of the casual
genre, and it is **the only infinite resource sink the genre has found**.

### 2.2 Why it is nearly free here

Because the pieces are already load-bearing elsewhere:

| Piece | Already exists | Where |
|---|---|---|
| The goal predicates | `HoldResource`, `CollectResource`, `SellGoods`, `CollectTaps` | `quests.ts` |
| Replay-safe generation | `rand(seed, ...parts)` — counter/hash, not a stream | `rng.ts` |
| Reward delivery | quest reward payment | `quests.ts` |
| A building to live in | the Market (tapped, no navbar entry) | `market.ts` |
| Production-relative scaling | `cityGatherPerSecond` | `upgrades.ts` |

> **The critical property: an order needs a generator, not new goal types.**

`goalType` is code and `goalTarget`/`goalAmount` are data. Orders draw over the
*existing* types, so this pillar adds no new type to the union — which is what
keeps it a shell around quests rather than a fourteenth system
(`../road-to-mvp.md` §8, decision 11).

### 2.3 Generation

```
orderId(day, slot)   = `order#${day}#${slot}`
resources(day, slot) = pick over the currencies the player has unlocked,
                       1–3 of them, weighted toward the ones they produce
amount(res)          = round( cityGatherPerSecond(res) × ORDER.secondsOfProduction )
                       floored at an authored minimum, so slot 1 works on day 1
```

`ORDER.secondsOfProduction` is the strongest dial in the feature and the direct
analogue of `tap.boostSeconds`. **An order asks for a duration of the player's
own output, so it is neither trivial at hour 40 nor impossible at hour 1, with
nothing re-derived per era.** That is the rule `../road-to-mvp.md` §10 asks
every new reward to follow, and this is the first place it gets applied outside
the tap.

`cityGatherPerSecond` is nominal rather than measured — it reads the influence
radius as the worker's travel distance — so an order is an *estimate* of the
player's rate. `ad-economy.md` §1 already accepted that trade for tap yield;
the same reasoning applies, and for the same reason it is fine: it is a balance
dial, not a promise.

### 2.4 Rewards

Priced the same way: **Gold worth N minutes of the city's tax income**, plus
one of a small pool of extras — Fragments, Knowledge, Gems on an occasional
slot, and later event currency
([`event-archetype.md`](event-archetype.md)).

One deliberate constraint: **an order must never pay the resources it asked
for.** It is a sink, and the moment the loop closes on itself it becomes a
laundering mechanic instead of a reason to keep producing.

### 2.5 No deadlines, but a reroll

An unclaimed order is **replaced at the daily refresh, not failed**. There is no
timer on the card and no "expires in" text.

The reasoning is the same as §1.1: a daily deadline on a chore-shaped task is
how a cozy game starts reading as work, and the ~30 min/day budget has no room
for three mandatory errands. What replaces the pressure is **choice** — three
slots, and you will not clear all three most days, so which one you take is the
decision.

A slot can be **rerolled** for a rewarded video or a small Gem cost. That is
the comfort purchase pillar 3 authorises, and it is also a clean second ad
placement, which `monetization-sim.md` wants.

### 2.6 Save and scope

`city.orders { dayIndex, claimed: [slot...] }` — **city-scoped**, because
orders are about this city's production, unlike the daily ladder. Everything
else about a slot is derivable from `(seed, dayIndex, slot)`, so the save
carries three integers and a small array rather than three authored orders.
Additive ⇒ no migrator.

---

## 3. Dials, in the order to reach for them

1. `order.secondsOfProduction` — what an order asks for, and therefore whether
   the feature is a sink or a nuisance.
2. `daily.manaFractions` — the seven-step ladder as fractions of the cap.
3. `order.slots` — 3. More slots is more choice and more chore at the same
   time; this is the number playtest will move first.
4. `daily.weekMarkerGems` — 5. Also the recurring Gem faucet, so it cannot be
   tuned without re-checking `balancing-v3.md` §3.
5. `order.rerollGemCost` / reroll-by-ad cooldown.

## 4. Acceptance

- A player who has completed every authored quest opens the game on day 15 and
  has three orders and a chest waiting.
- The ladder survives a two-week absence at the step it reached.
- The same `(seed, day, slot)` produces the same order on two devices, and an
  order generated during an offline replay matches one generated live — the
  assertion this codebase makes everywhere it can.
- An order's ask is a similar *fraction* of the player's hourly output at
  Townhall 1 and at Townhall 3.
- No new `goalType` was added to the union.

## Open decisions

These are the ones [`../road-to-mvp.md`](../road-to-mvp.md) §8 lists as
blocking Phase 1. Recorded here as recommendations, to be closed in review.

1. ~~**Chest reward — Mana, Gems, or both?**~~ **CLOSED: Mana every day, Gems
   at the week marker only**, as recommended. Gems daily in small amounts
   devalues the marker and makes the faucet hard to bound. Authored as
   `daily.mana_fractions` / `daily.gems`, with one Gold step in between priced
   in seconds of production.
2. ~~**Does the pill auto-open?**~~ **CLOSED: no, it only glows.** §1.4.
3. ~~**Orders on the Market, or their own building?**~~ **CLOSED 2026-09-03:
   the Market, as a second tab — and the Market moved into the opening to
   meet it.** The recommendation below was right about the home and wrong
   about the cost: the fix was not to accept that orders arrive at hour three,
   it was to move the beat. `Trade`, `ToMarket` and `Merchant` are now steps
   13-15 (`../onboarding.md`) — research, build, use — which is the first
   point at which the city produces more than it eats — so the Market arrives exactly when a sink first means
   anything, rather than long after. Decision 4 falls away with it: there is
   no "before the Market" worth designing for.

   The original recommendation, kept for the reasoning: **the Market**, as a
   second tab. It gives the Market the second job the design
   already wants for it, it needs no new placement or count cap, and it keeps
   the "tap the building" convention. The cost is that orders are gated behind
   the Market technology, which lands at quest 32+ — so either the gate moves
   earlier, or the first orders arrive later than the daily chest. **This is
   the one that actually needs a decision, not a preference.**
4. ~~**Do orders exist before the Market?**~~ **MOOT** — see 3. Following from 3. A cheap answer: the
   Townhall carries one order slot from the start and the Market adds the other
   two. That makes the Market a real upgrade to the feature rather than its
   gate, and it puts an order in front of the player during onboarding, where it
   teaches the loop.
5. **Does an order ever ask for Mana?** Recommendation: never. Mana is the
   session budget; spending it on an errand competes with the thing it exists
   to pay for.
