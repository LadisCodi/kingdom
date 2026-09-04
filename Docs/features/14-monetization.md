# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The one ad placement that ships is designed in
> [`08-magic.md`](08-magic.md) §7.
>
> **Status: the ad placement, the builder offer, and the store's first cut
> are built** — the payer profile and its monthly budget (§3), and three
> surfaces: builders for Gems, Gem packs for simulated dollars, and the hero
> banner as a doorway (§2.1). The remaining SKUs, the other four placements
> and the telemetry pipeline (§4) are designed and unstarted.

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
| **Comfort** | rush a timer, refill Mana, refresh the shop | it buys back the player's *time* |
| **Breadth** | attunement slots, party slots, builders, gacha pulls | more things at once, never stronger things |
| **Cosmetic** | a Townhall banner set | zero economic effect |

**Nothing on that list is access.** That is the third promise held, and it is
also the constraint that makes the data interpretable: **if a surface fails, it
failed on desirability and not because we sold power.**

Every earned ladder is earned *first*: research grants the second attunement
slot and the third party slot before Gems can buy any, and the daily chest pays
Gems at the week marker. **The paid gate is never the only route in.**

### 1.1 Where we are starting from

- The Gems plaque in the header opens **the store** (§2.1). Until 2026-09-04
  its `+` was a no-op, and the game had no monetisation at all beyond one ad
  placement and one builder offer.
- Gems buy **five** things — pulls, party slots, attunement slots, builders, Mana
  refills — and **three of those are one-time ladders.** A one-time ladder cannot
  carry a subscription-shaped revenue curve, which is what *months active*
  implies.
- **The faucet is 75 up front plus ~20/month** and it is enough to buy the whole
  slot ladder by play. That is correct for the promise, and it means **there is
  currently nothing a wallet is needed for.**

## 2. The catalogue

Twelve SKUs in the four families the comparables use. Prices are displayed in
dollars and are plausible rather than researched — **they exist so a choice has
a relative cost.** The six Gem packs are **built** and live in the workbook's
`Store` sheet; everything else is still design.

| SKU | Family | Price | Grants |
|---|---|---|---|
| **Gems ×80 / ×220 / ×500 / ×1200 / ×3200 / ×7000** | currency | **$1.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99** | Gems — built; six packs on a 3×2 grid |
| **Second builder** | permanent comfort | Gems (30, ×2.5) | +1 builder — built, priced in Gems rather than dollars |
| Third builder | permanent comfort | Gems | +1 more — built |
| **Monthly card** | subscription | $4.99/mo | Gems daily for 30 days |
| **Event pass, paid track** | season | $4.99 | unlocks the paid column |
| Fog charter | land | $2.99 | a bundle of instant reveals |
| Mana refill | consumable | Gems | fills the pool |
| Shop refresh | consumable | Gems / ad | refreshes event stock |
| Attunement / party slot | one-time ladder | Gems | exists today |
| **Town banner set** | cosmetic | $2.99 | a visual variant — the probe, §5 |

Two are worth their own note. **The monthly card** is the de-facto subscription of
the genre and turns a cozy player into a payer with no pressure at all. **The fog
charter** exists because Elvenar sells expansions for premium currency only, and
Kingdom has the best land in the genre with no premium path to it.

**The second builder already ships as a priced offer raised by a refused build**
([`06-construction.md`](06-construction.md) §2), and since 2026-09-04 also as a
card in the store. Keeping both is the point: **a surface the player is *sent*
to and one they *stumble into* answer different questions.**

### 2.1 The store screen, as built

One sheet with two doors — the **leftmost tab of the nav bar**, where the genre
keeps its shop, and the **Gems plaque in the header**, which is where a player
short of Gems is already looking — with a budget line at the top and three
sections under it:

| Section | What it is | Where the money goes |
|---|---|---|
| **Heroes** | **the banner itself**, first — chance, pity, the Call button. A call for aid is a purchase, so the gacha is pulled from the store; the Reliquary's heroes tab keeps the roster and points here | Gems |
| **Builders** | the same hire the refused-build offer sells, with the crew's size beside it; at the ceiling it says so and sells nothing | Gems |
| **Gems** | last: six packs on a **3×2 grid of upright cards** — count over art over price, each with its own sprite (`render/assets/gems_*.png`, the Gems icon until it lands). A tap opens the **confirmation** (§3.2), never a grant | the monthly budget |

**The banner moved here from the Reliquary on 2026-09-04.** The reliquary
doc's argument — *a gacha with its own permanent tab is a different game* —
still holds: the banner has no tab of its own, and it sits inside the store.

**The store does not know it is simulated.** No budget line, no `SIMULADO`
mark, no price greyed out because the allowance is short: a playtester browsing
the store sees exactly what a paying player would. The budget, the profile and
the word `SIMULADO` appear in one place only — the **confirmation** (§3.2), at
the moment of paying. Decided 2026-09-04, and the reason is the signal: the
store measures *desire*, and a budget line on it would have players shopping
against their allowance instead of against their wants. The confirmation is
where desire meets the wallet, and that is where the two numbers belong.

Hiring a builder from the store keeps the store open; hiring one from the
refused-build offer closes it, because that player was placing something.

## 3. The design that makes intent meaningful: a simulated budget

The obvious implementation — tap *buy*, get the thing free — poisons both things
we care about. It **inflates intent** (with no cost, everyone takes everything)
and it **inflates the economy** (every playtester ends up with a maxed city, so
the retention question becomes unanswerable).

> **Each playtester declares who they are playing as, once, and the game holds
> them to that budget every month.** Purchases are granted for real, out of it.

| Profile | Budget a month | Who it stands for |
|---|---|---|
| **F2P** | **$0** | never spends; walks the same store and is refused every price |
| **Minnow** | **$10** | a pack or two a month, when something is worth it |
| **Dolphin** | **$50** | buys what saves time; a chest of Gems most weeks |
| **Whale** | **$250** | buys what they want, when they want it |
| **Super Whale** | **$2,000** | the store is not a constraint; the profile exists so the top of the genre's spend curve is represented, and so the read-out can tell "wanted it" from "could afford it" |

The five are the genre's own segmentation — the fish scale every 4X live-ops
team reports in — so a ranking by profile reads directly against the
comparables' revenue mix.

**Scarcity is what makes a choice reveal a preference.** With $10 a month, a
playtester who buys a chest of Gems today has told us they will not be buying
a pouch on top of it before the first, and a Dolphin who hires a builder over a
chest has told us something a free tap never could. Three properties follow:

1. **The grant is real**, so the economy stays coherent and the retention data
   stays usable.
2. **Choices are exclusive**, so the ranking is a ranking and not a checklist.
3. **A tap on something they cannot afford is also data** — unmet demand at that
   price. Record the intent, refuse the grant, show the balance. The save keeps
   a **refusal count** beside the purchase log for exactly this.

**The confirmation says `SIMULADO` and shows the budget; nothing else does.**
Every purchase passes through it, so no playtester can spend without seeing
both — and nowhere else in the game reminds them, because the reminder would
change what they shop for. The profile sheet (§3.1) still says up front that
nothing charges real money: that is the disclosure OQ-29 asks for, made once,
before the first price. **This is not optional polish; it is the difference
between a research instrument and a deceptive purchase flow.**

### 3.1 The profile is chosen first, once, and only a fresh game changes it

A save with no profile stops at a sheet before the map is playable: four
options, each with its budget and a line about who it is, and the reason the
game is asking. It has **no close knob and the scrim does not dismiss it** —
the presenter forces it over anything else that asks to open and lets the
waiting request (the welcome-back report, chiefly) through the moment a profile
is picked. That is the one place the game makes a demand before the player has
done anything, and the copy says why.

**The choice is final for the save.** Otherwise a Minnow who runs short on
the twentieth becomes a Whale for the afternoon, and the budget stops meaning
anything. The way out is named on the sheet and in Settings: **start over**, and
the fresh game asks again. Existing saves from before the profile existed have
none, so they are asked on their next launch — the field is additive and needs
no migrator.

**Why a month.** A month is the unit the genre's spend is reported in — ARPPU
and the fish scale are monthly figures — so a profile's budget is a number the
team already has an intuition for, and the ranking it produces compares with
the comparables without conversion. It also leaves room for the store's
recurring SKU, the monthly card, to be a single decision inside a single
period. The cost, acknowledged: a two-week playtest sees at most one refill, so
the *cadence* of spending is not something this instrument measures — the
*ranking* of surfaces is. The month is the **calendar month, UTC**, derived
from the sim's timestamp and never from a counter, so a reload or a long absence
cannot bank one. **Nothing rolls over:** the first is a full budget, not last
month's remainder plus one.

**Cents, never dollars.** $1.99 + $9.99 has to add up exactly, and the budget
is compared as an integer.

### 3.2 The confirmation is where the price meets the budget

A tap on a price opens a centred sheet: what the pack grants, its price, what
is left of the month, and either what would be left after or how far short the
player is. With budget the button buys; without, the button is dead with its
reason attached and the sheet explains — *your budget refills in 3 days*, or
*you are playing as someone who never spends*. Nothing is granted from the
store card itself, so every purchase has passed the line that names the cost.

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

**Until that pipeline exists, the save is the log.** `player.payer` keeps every
purchase (SKU, price, when) and the count of refusals, so a read-out can be
produced from a playtester's save file by hand. It is a stopgap, not the
design: it lacks the game context above and it can be reset by the player.

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

## 6. Rewarded video: from one placement to five

The existing placement is the model, and it is genuinely good: the reward is a
whole pool, ten sanctuaries double the pool and therefore **double every future
ad**, the offer only appears below half a pool, and the cooldown is randomised
30–90 s so it is never a metronome. **The problem is that it is one placement.**

| # | Placement | Reward |
|---|---|---|
| 1 | **Mana refill** — ships today | a full pool |
| 2 | Double a quest reward | ×2 on claim |
| 3 | Refresh the event shop | one refresh |
| 4 | Skip a builder timer | a slice of the remaining build |
| 5 | A second daily chest | one extra ladder claim |

**It was six until 2026-09-03**, and the sixth was *reroll an order slot* —
the cleanest of the lot, because a reroll is pure comfort with no economic
effect and it sat on a card the player had already opened. **It died with
orders** ([`12-quests.md`](12-quests.md) §6), and nothing was invented to
replace it: **Wonders offer no ad placement at all.** A Wonder has no timer to
skip and no slot to reroll, and an ad that discounted a Wonder level would be
selling permanent progression rather than comfort, which the §2 families
forbid. So the list is five, and **that makes OQ-51 sharper rather than
softer** — the question was whether the ad economy is worth building six
placements around, and it can now field five.

Two rules carry over, because they are what makes the existing one good:

- **An offer answers a shortage rather than interrupting.** Placement 1 only
  appears below half a pool; 3 and 5 only on a card the player already opened.
- **The reward is priced in the player's own production**, never as an absolute,
  so an ad is worth the same fraction of progress at hour 1 and hour 40.

**The per-day arithmetic has to be re-derived once all five exist**, and the
figure that used to sit here — *~10 ads/day adding ~12.5 h of production, so a
watcher progresses ~50% faster* — **was computed against a tap that minted and
is wrong by roughly two orders of magnitude.** Priced against the ground, a full
pool is ~5.5 minutes of the city's own production, so five ads a day buy a
watcher about **2–3%**, not 50%. The concern the old number raised — that
placements could stack into *a different game rather than a meaningful offer* —
has inverted: the live risk is now that five placements are not worth building.
**OQ-43, OQ-45, OQ-51.**

## 7. The read-out

One page, refreshed weekly:

1. **SKUs ranked** by confirmed purchases per player who saw them, with credit
   spent and refusals-for-lack-of-credit alongside.
2. **Placements ranked** by ad completions per session, and the resulting share
   of total progress that came from ads.
3. **The one honest caveat**, restated every time (§0).

Everything else the telemetry collects — session count, session length, day index
of last session, quests claimed, Wonder levels bought, milestones reached —
serves the retention
read-out rather than this one. **No event pipeline exists today, which means
there is currently no way to produce a D30 at all.**

## 8. Exit gate

- Every SKU has a card, a price, a confirm step and a funnel.
- The budget is enforced and refills monthly; it is shown on the confirmation
  and nowhere else; the profile cannot be changed without a fresh game.
- No purchase can complete without passing a sheet that says `SIMULADO`.
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
| Mana refill | **0.34 of the cap a Gem** — any full pool is **3 Gems** | `mana.gem_refill_fraction` |
| Research slot | 10, `×3` | `research.slot_gem_cost_*` |
| Party slot | 25, `×2.2` | `party.slot_gem_cost_*` |
| Attunement slot | 20, `×2.5` | `attunement.slot_gem_cost_*` |
| Ad cooldown | 30–90 s | `ads.cooldown_*_seconds` |
| Ad eligibility | below half a pool | `ads.eligible_below_fraction` |
| Gem packs | 80 / 500 / 1200 for $1.99 / $9.99 / $19.99 | `Store` sheet |
| Monthly budgets | F2P $0 · Minnow $10 · Dolphin $50 · Whale $250 · Super Whale $2,000 | `payer.*_monthly_usd` |

**The first price in the game a player can put side by side is a Mana refill at
40 Gems against a hero pull at 30.** A refill is consumable and a hero is
permanent, so it may well be right — but it has never been argued, and it is
therefore the first price that can *feel* wrong. **OQ-27.**

## 10. Deliberately not in this design

A real charge, ever · a second premium currency · a gacha-exclusive power ceiling
· a free trial on the builder ([`06-construction.md`](06-construction.md) §5) · a
streak-repair SKU · loot boxes beyond the hero banner · an ad that gates rather
than accelerates · a cosmetic *pipeline* before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-27, OQ-29, OQ-30, OQ-31, OQ-32, OQ-43, OQ-45. OQ-28 (the budget's size and cadence) was closed on 2026-09-04 by the monthly profiles of §3.
