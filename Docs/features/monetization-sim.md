# Feature: simulated monetisation — a store that never charges

> Phase 3 of [`../road-to-mvp.md`](../road-to-mvp.md).
> **Status: designed, unstarted.**
>
> Kingdom is a disposable prototype. **Nothing here ever takes money.** The
> store is real in every way that produces data — a catalogue, prices, a
> confirmation flow, a funnel — and fake in exactly one: the charge.
>
> Companion docs: [`ad-economy.md`](ad-economy.md) (the one placement that
> exists and is good), [`event-archetype.md`](event-archetype.md) (the pass this
> sells), [`balancing-v3.md`](balancing-v3.md) §3, §5 (the Gem faucet and the
> second builder).

## 0. The reading rule, written before the design

> **An intent is not a conversion.**

A tap on a button that costs nothing measures desire with the price friction
removed. That is an **upper bound**, and it is a useful one — it ranks surfaces
against each other, which is the MVP's second question — but it is not a
conversion rate, an ARPPU or an LTV, and no slide made from this data may imply
otherwise. §3 is the design that makes the ranking mean something anyway.

**What this phase cannot answer, and never will:** CPI, IPM, real conversion,
ARPDAU, cohorted D30, price elasticity. Those need user acquisition and a real
store, and they stay in the 2026-09-01 audit's validation plan.

## 1. Where we are starting from

- The Gems `+` button is a **no-op**. There is no store, no catalogue, no IAP
  and no receipt path. `00-design-intent.md`'s backlog records this as
  half-closed; the honest state is that **the game has no monetisation at all.**
- Gems buy **four** things — gacha pulls, party slots, attunement slots, Mana
  refills — and **three of those four are one-time ladders**. A one-time ladder
  cannot carry a subscription-shaped revenue curve, which is what "months
  active" implies.
- The authored Gem faucet is **75 up front plus ~20/month**
  ([`balancing-v3.md`](balancing-v3.md) §3), and it is enough to buy the whole
  slot ladder by play. That is correct for pillar 3 and it means **there is
  currently nothing a wallet is needed for.**
- What does exist, and is better than most of the comparables: **one very well
  designed rewarded-video placement** — the ad pays a whole Mana pool, ten
  sanctuaries double the pool and therefore double every future ad, the offer
  only appears below half a pool, and the cooldown is randomised 30–90 s so it
  never becomes a metronome.

## 2. The catalogue

Twelve SKUs, in the four families the competitive review found. Prices are
displayed in euros and are plausible rather than researched — they exist so a
choice has a *relative* cost.

| SKU | Family | Price | Grants | Notes |
|---|---|---|---|---|
| Gems ×80 / ×500 / ×1200 | currency | €1.99 / €9.99 / €19.99 | Gems | the classic three-tier ladder |
| **Second builder** | permanent comfort | €4.99 | `kingdom.maxBuilders` +1 | the best-documented converter in the set; dial already authored (`balancing-v3.md` §5) |
| Third builder | permanent comfort | €9.99 | +1 more | tests whether the ladder extends |
| **Monthly card** | subscription | €4.99/mo | Gems daily for 30 days | the de-facto subscription; turns a cozy player into a payer with no pressure |
| **Event pass, paid track** | season | €4.99 | unlocks the paid column | [`event-archetype.md`](event-archetype.md) §3.4 |
| Fog charter | land | €2.99 | a bundle of instant reveals | Elvenar sells expansions for premium currency only; Kingdom has the best land in the genre and no premium path to it |
| Mana refill | consumable | Gems | fills the pool | exists today at `mana.gemRefillPerGem` 4 |
| Order reroll | consumable | Gems / ad | rerolls one slot | [`habit-loop.md`](habit-loop.md) §2.5 |
| Shop refresh | consumable | Gems / ad | refreshes event stock | |
| Attunement / party slot | one-time ladder | Gems | exists today | |
| **Town banner set** | cosmetic | €2.99 | a visual variant | the probe, see §5 |

Everything on that list is **comfort or breadth**. Nothing on it is access.
That is pillar 3 held, and it is also the constraint that makes the data
interpretable: if a surface fails, it failed on desirability and not because we
sold power.

## 3. The design that makes intent meaningful: a simulated budget

The obvious implementation — tap "buy", get the thing free — poisons both
things we care about. It inflates intent (with no cost, everyone takes
everything) and it inflates the economy (every playtester ends up with a maxed
city, so the retention question becomes unanswerable).

> **Each playtester gets a simulated wallet: €20 of prototype credit per
> calendar month.** Purchases are granted for real, out of that budget.

Scarcity is what makes a choice reveal a preference. With €20 a month, a
playtester who buys the second builder over 500 Gems has told us something a
free tap never could. Three properties follow:

1. **The grant is real**, so the economy stays coherent and the retention data
   stays usable.
2. **Choices are exclusive**, so the ranking is a ranking and not a checklist.
3. **A tap on something they cannot afford is also data** — unmet demand at
   that price. Record the intent, refuse the grant, and show the balance.

The budget number is a dial and the first thing to revisit: too low and nobody
buys the €19.99 tier, too high and it stops being a choice.

**Every screen says `SIMULADO` and the credit is shown in the store header.** No
playtester may ever be uncertain about whether they spent money. This is not
optional polish; it is the difference between a research instrument and a
deceptive purchase flow.

## 4. The funnel, and what gets logged

Six steps, each an event:

```
offer_shown  →  store_opened  →  sku_viewed  →  confirm_opened
             →  purchased  |  dismissed  |  refused_no_credit
```

Every row carries: player id (the Supabase `auth.uid()`), session id, wall-clock
ms, day index, `sku`, price, credit remaining, and **three pieces of game
context** — Townhall level, minutes played to date, and what the player was
doing when the offer appeared (`placement`). Without the context the ranking
cannot be read: "the fog charter converts" means nothing if it only ever appears
to people at Townhall 3.

**Server side, insert-only.** A new table with an RLS policy that permits
`insert` on rows whose `user_id = auth.uid()` and no `select`, `update` or
`delete` at all from the client. That is one policy, and it means a playtester
cannot tamper with their own funnel even by accident — the same
`security definer` reasoning the social layer uses
([`social-layer.md`](social-layer.md) §1).

**Batched, never per-tap.** Queue locally, flush every N events or on
`pagehide`. The prototype runs on GitHub Pages against a free Supabase project;
a request per tap will hit a rate limit during the one playtest that matters.

## 5. Cosmetics — one probe, not a pipeline

Decision 6 in `../road-to-mvp.md` §8: does cosmetic content exist at all?
Nothing in Kingdom is cosmetic today, and the review flagged it as **the natural
monetisation of the audience the audit identified as the money** — and the only
family that is pure comfort with zero economic effect.

It is also an art pipeline, and this is a disposable prototype with ten
hand-drawn sheets already produced.

> **Recommendation: one cosmetic family as a probe. Not a system.**

A set of Townhall banners — three or four colour variants of one sprite. Enough
to occupy a store card and measure whether anyone taps it, cheap enough that a
negative result costs an afternoon. If it ranks, cosmetics become a real
pipeline decision with evidence behind it; if it does not, the A-branch
monetisation thesis is weaker than the review assumed and that is worth knowing.

## 6. Rewarded video: from one placement to six

The existing placement is the model. Five more, each with its own cooldown and
daily cap, and each answering a want the player already has:

| # | Placement | Reward | Where it comes from |
|---|---|---|---|
| 1 | **Mana refill** (exists) | a full pool | `ad-economy.md` |
| 2 | Double a quest or order reward | ×2 on claim | `habit-loop.md` |
| 3 | Reroll an order slot | one reroll | `habit-loop.md` §2.5 |
| 4 | Refresh the event shop | one refresh | `event-archetype.md` §3.5 |
| 5 | Skip a builder timer | a slice of the remaining build | the second-builder want, for free |
| 6 | A second daily chest | one extra ladder claim | `habit-loop.md` §1 |

Two rules carried over from the existing design, because they are what makes it
good: **an offer answers a shortage rather than interrupting** (placement 1 only
appears below half a pool; 3 and 4 only on a card the player already opened),
and **the reward is priced in the player's own production**, never as an
absolute, so an ad is worth the same fraction of progress at hour 1 and hour 40.

The existing per-day arithmetic — ~10 ads/day across three visits, adding ~12.5 h
of production on top of 24 h idle, so a watcher progresses ~50 % faster — has to
be **re-derived once all six exist**, and `ad-economy.md` §Open questions
already names it as the thing that bites. Six placements can easily double
that, and a watcher progressing twice as fast as a non-watcher is a different
game rather than a meaningful offer.

## 7. The read-out

The deliverable of this phase is one page, refreshed weekly, answering the MVP's
second question:

1. **SKUs ranked** by confirmed purchases per player who saw them, with credit
   spent and refusals-for-lack-of-credit alongside.
2. **Placements ranked** by ad completions per session, and the resulting share
   of total progress that came from ads.
3. **The one honest caveat**, restated every time (§0).

Everything else the telemetry collects serves question 1 — session count,
session length, day index of last session, orders claimed, track milestones
reached — and belongs to the retention read-out rather than this one.

## 8. Exit gate

- Every SKU in §2 has a card, a price, a confirm step and a funnel.
- The credit balance is visible, enforced, and resets monthly.
- No screen can be reached that does not say `SIMULADO`.
- The funnel table is insert-only from the client, verified by trying to read it.
- Two weeks of at least five playtesters produce a ranking that is stable
  between week one and week two. **If the ranking is not stable, the sample is
  the finding**, and the honest report says so instead of ranking noise.

## Open decisions

1. **How is the pass "bought"?** (`../road-to-mvp.md` §8, decision 4.) Two
   options: a euro SKU against the simulated credit, or a Gem price. **In
   euros**, recommended — it is how every comparable sells a pass, and pricing
   it in Gems hides the decision behind a currency conversion the player has to
   do, which corrupts the intent signal. Gems stay for consumables and ladders.
2. **Is €20/month the right simulated budget?** Arbitrary today. It should be
   set so that a playtester can afford roughly two of the mid-tier SKUs a month
   and must choose. Worth a first-week sanity check.
3. **Does the monthly card auto-renew in the simulation?** Recommended yes,
   with a visible cancel — the renewal decision is the interesting part of a
   subscription and the only part a prototype can observe.
4. **Is a full Mana refill worth more than a hero pull?** Carried over from
   `balancing-v3.md` §Open questions: 40 Gems against 30. It is the first price
   in the game a player can compare, so it is the first one that can feel wrong.
5. **Do we tell playtesters we are measuring intent?** Recommended: **yes,
   plainly, up front.** They are named colleagues and testers, not a
   population; an undisclosed measurement of a friend's spending impulses is not
   worth the data, and a disclosed one costs almost nothing in signal because
   the budget (§3) is what makes the choice honest, not ignorance.
