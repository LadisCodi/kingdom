# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The one ad placement that ships is designed in
> [`08-magic.md`](08-magic.md) §7.
>
> **Status: the ad placement and the builder offer are built. The store,
> the other five placements and the telemetry are designed and unstarted.**

## 0. Two rules, written before the design

> **Nothing here ever takes money.**

Kingdom is a prototype. Monetisation is **simulated and instrumented**: nothing
charges, everything is recorded. That is not a compromise forced by the
prototype — it is the correct instrument for the question being asked, which is
*which surfaces have demand*, not *how much*.

> **An intent is not a conversion.**

A tap on a button that costs nothing measures desire **with the price friction
removed**. That is an **upper bound** and a useful one — it ranks surfaces
against each other — but it is not a conversion rate, an ARPPU or an LTV, and no
slide made from this data may imply otherwise. §3 is the design that makes the
ranking mean something anyway.

**What this can never answer:** CPI, IPM, real conversion, ARPDAU, cohorted D30,
price elasticity. Those need user acquisition and a real store.

## 1. What a wallet is allowed to buy

> **Wallets buy comfort and breadth; play buys everything else. Nothing is
> purchase-only that cannot also be earned.**

| Family | Examples | Why it is allowed |
|---|---|---|
| **Comfort** | rush a timer, refill Mana, reroll an order, refresh the shop | it buys back the player's *time* |
| **Breadth** | attunement slots, party slots, builders, gacha pulls | more things at once, never stronger things |
| **Cosmetic** | a Townhall banner set | zero economic effect |

**Nothing on that list is access.** That is the third promise held, and it is
also the constraint that makes the data interpretable: **if a surface fails, it
failed on desirability and not because we sold power.**

Every earned ladder is earned *first*: research grants the second attunement
slot and the third party slot before Gems can buy any, and the daily chest pays
Gems at the week marker. **The paid gate is never the only route in.**

### 1.1 Where we are starting from

- The Gems `+` button is a **no-op**. The game has no monetisation at all today
  beyond one ad placement and one builder offer.
- Gems buy **five** things — pulls, party slots, attunement slots, builders, Mana
  refills — and **three of those are one-time ladders.** A one-time ladder cannot
  carry a subscription-shaped revenue curve, which is what *months active*
  implies.
- **The faucet is 75 up front plus ~20/month** and it is enough to buy the whole
  slot ladder by play. That is correct for the promise, and it means **there is
  currently nothing a wallet is needed for.**

## 2. The catalogue

Twelve SKUs in the four families the comparables use. Prices are displayed in
euros and are plausible rather than researched — **they exist so a choice has a
relative cost.**

| SKU | Family | Price | Grants |
|---|---|---|---|
| Gems ×80 / ×500 / ×1200 | currency | €1.99 / €9.99 / €19.99 | Gems |
| **Second builder** | permanent comfort | €4.99 | +1 builder |
| Third builder | permanent comfort | €9.99 | +1 more |
| **Monthly card** | subscription | €4.99/mo | Gems daily for 30 days |
| **Event pass, paid track** | season | €4.99 | unlocks the paid column |
| Fog charter | land | €2.99 | a bundle of instant reveals |
| Mana refill | consumable | Gems | fills the pool |
| Order reroll | consumable | Gems / ad | rerolls one slot |
| Shop refresh | consumable | Gems / ad | refreshes event stock |
| Attunement / party slot | one-time ladder | Gems | exists today |
| **Town banner set** | cosmetic | €2.99 | a visual variant — the probe, §5 |

Two are worth their own note. **The monthly card** is the de-facto subscription of
the genre and turns a cozy player into a payer with no pressure at all. **The fog
charter** exists because Elvenar sells expansions for premium currency only, and
Kingdom has the best land in the genre with no premium path to it.

**The second builder already ships as a priced offer raised by a refused build**
([`06-construction.md`](06-construction.md) §2). What is left for the store is the
**card** — and keeping both is the point: **a surface the player is *sent* to and
one they *stumble into* answer different questions.**

## 3. The design that makes intent meaningful: a simulated budget

The obvious implementation — tap *buy*, get the thing free — poisons both things
we care about. It **inflates intent** (with no cost, everyone takes everything)
and it **inflates the economy** (every playtester ends up with a maxed city, so
the retention question becomes unanswerable).

> **Each playtester gets a simulated wallet: €20 of prototype credit per calendar
> month.** Purchases are granted for real, out of that budget.

**Scarcity is what makes a choice reveal a preference.** With €20 a month, a
playtester who buys the second builder over 500 Gems has told us something a free
tap never could. Three properties follow:

1. **The grant is real**, so the economy stays coherent and the retention data
   stays usable.
2. **Choices are exclusive**, so the ranking is a ranking and not a checklist.
3. **A tap on something they cannot afford is also data** — unmet demand at that
   price. Record the intent, refuse the grant, show the balance.

**Every screen says `SIMULADO` and the credit is shown in the store header.** No
playtester may ever be uncertain about whether they spent money. **This is not
optional polish; it is the difference between a research instrument and a
deceptive purchase flow.**

## 4. The funnel, and what gets logged

```
offer_shown → store_opened → sku_viewed → confirm_opened
            → purchased | dismissed | refused_no_credit
```

Every row carries player id, session id, wall-clock ms, day index, SKU, price,
credit remaining, and **three pieces of game context** — Townhall level, minutes
played to date, and **what the player was doing when the offer appeared.**
Without the context the ranking cannot be read: *the fog charter converts* means
nothing if it only ever appears to people at Townhall 3.

**Server side, insert-only.** A policy that permits insert on rows whose owner is
the caller, and no read, update or delete at all from the client — so a
playtester cannot tamper with their own funnel even by accident.

**Batched, never per-tap.** Queue locally, flush every N events or on page hide. A
free hosted project and a request per tap will hit a rate limit during the one
playtest that matters.

## 5. Cosmetics — one probe, not a pipeline

Nothing in the game is cosmetic today, and it is **the natural monetisation of
the audience identified as the money** — and the only family that is pure comfort
with zero economic effect.

It is also an art pipeline, and this is a prototype with ten hand-drawn sheets
already produced.

> **One cosmetic family as a probe. Not a system.**

A set of Townhall banners — three or four colour variants of one sprite. Enough
to occupy a store card and measure whether anyone taps it, cheap enough that a
negative result costs an afternoon. **If it ranks, cosmetics become a real
pipeline decision with evidence behind it; if it does not, the cosmetic
monetisation thesis is weaker than assumed and that is worth knowing.**
**OQ-26.**

## 6. Rewarded video: from one placement to six

The existing placement is the model, and it is genuinely good: the reward is a
whole pool, ten sanctuaries double the pool and therefore **double every future
ad**, the offer only appears below half a pool, and the cooldown is randomised
30–90 s so it is never a metronome. **The problem is that it is one placement.**

| # | Placement | Reward |
|---|---|---|
| 1 | **Mana refill** — ships today | a full pool |
| 2 | Double a quest or order reward | ×2 on claim |
| 3 | Reroll an order slot | one reroll |
| 4 | Refresh the event shop | one refresh |
| 5 | Skip a builder timer | a slice of the remaining build |
| 6 | A second daily chest | one extra ladder claim |

Two rules carry over, because they are what makes the existing one good:

- **An offer answers a shortage rather than interrupting.** Placement 1 only
  appears below half a pool; 3 and 4 only on a card the player already opened.
- **The reward is priced in the player's own production**, never as an absolute,
  so an ad is worth the same fraction of progress at hour 1 and hour 40.

**The per-day arithmetic has to be re-derived once all six exist.** Today's figure
— ~10 ads/day adding ~12.5 h of production on top of 24 h idle, so a watcher
progresses ~50% faster — is a *meaningful offer*. **Six placements can easily
double that, and a watcher progressing twice as fast as a non-watcher is a
different game rather than a meaningful offer.** **OQ-43, OQ-45.**

## 7. The read-out

One page, refreshed weekly:

1. **SKUs ranked** by confirmed purchases per player who saw them, with credit
   spent and refusals-for-lack-of-credit alongside.
2. **Placements ranked** by ad completions per session, and the resulting share
   of total progress that came from ads.
3. **The one honest caveat**, restated every time (§0).

Everything else the telemetry collects — session count, session length, day index
of last session, orders claimed, milestones reached — serves the retention
read-out rather than this one. **No event pipeline exists today, which means
there is currently no way to produce a D30 at all.**

## 8. Exit gate

- Every SKU has a card, a price, a confirm step and a funnel.
- The credit balance is visible, enforced, and resets monthly.
- No screen can be reached that does not say `SIMULADO`.
- The funnel table is insert-only from the client, **verified by trying to read
  it.**
- Two weeks of at least five playtesters produce a ranking that is **stable
  between week one and week two.** **If the ranking is not stable, the sample is
  the finding**, and the honest report says so instead of ranking noise.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Gacha pull | 30 Gems | `gacha.pull_gem_cost` |
| Second builder | 30 Gems, `×2.5` per builder | `kingdom.builder_gem_cost_*` |
| Mana refill | 4 Mana a Gem — a 160 pool is **40 Gems** | `mana.gem_refill_per_gem` |
| Research slot | 10, `×3` | `research.slot_gem_cost_*` |
| Party slot | 25, `×2.2` | `party.slot_gem_cost_*` |
| Attunement slot | 20, `×2.5` | `attunement.slot_gem_cost_*` |
| Ad cooldown | 30–90 s | `ads.cooldown_*_seconds` |
| Ad eligibility | below half a pool | `ads.eligible_below_fraction` |
| Simulated monthly credit | €20 | — |

**The first price in the game a player can put side by side is a Mana refill at
40 Gems against a hero pull at 30.** A refill is consumable and a hero is
permanent, so it may well be right — but it has never been argued, and it is
therefore the first price that can *feel* wrong. **OQ-27.**

## 10. Deliberately not in this design

A real charge, ever · a second premium currency · a gacha-exclusive power ceiling
· a free trial on the builder ([`06-construction.md`](06-construction.md) §5) · a
streak-repair SKU · loot boxes beyond the hero banner · an ad that gates rather
than accelerates · a cosmetic *pipeline* before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-27, OQ-28, OQ-29, OQ-30, OQ-31, OQ-32, plus OQ-27, OQ-43, OQ-45.
