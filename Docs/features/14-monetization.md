# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The Mana placement is designed in
> [`08-magic.md`](08-magic.md) §6, the two call placements in
> [`10-heroes.md`](10-heroes.md) §6.2.
>
> **Status: three ad placements, the builder offer, the Royal chest and the
> store's first cut are built** — the payer profile and its monthly budget (§3), and four
> surfaces: builders for Gems, keys for Gems, Gem packs for simulated dollars,
> and the two hero banners (§2.1). The remaining SKUs, the other four
> placements and the telemetry pipeline (§4) are designed, not built.

## 0. Rules

- **Nothing here ever takes money.** Monetisation is simulated and
  instrumented: nothing charges, everything is recorded.
- **An intent is not a conversion.** A free tap measures desire with the
  price friction removed: an upper bound that ranks surfaces against each
  other, not a conversion rate, an ARPPU or an LTV. No report made from this
  data may imply otherwise.
- **What this cannot answer:** CPI, IPM, real conversion, ARPDAU, cohorted D30,
  price elasticity.

## 1. What a wallet is allowed to buy

- **A wallet buys power.** A gold key calls a Legendary hero, and a Legendary
  hero is stronger than a Common one — better stats and a bigger trait. That
  is the product, not a concession.
- **The one line: nothing a wallet buys is out of reach by play.** A wallet
  buys it sooner, in quantity, and without the wait; the free path to the same
  thing always exists. The daily free golden call is the worked example — a
  Legendary is a wallet's fastest purchase and roughly thirty free calls a
  month otherwise ([`10-heroes.md`](10-heroes.md) §6.2).
- The first rung of every ladder is earned by play: research grants the second
  attunement slot before Gems can buy any, and **a hero slot is the only slot
  in a party that is ever sold** — every troop slot on the board is open from
  the first fight ([`combat.md`](combat.md) §3); the daily
  chest's free track pays Gems every season, and the Royal chest's own gold
  keys are the same keys an ad already gives away daily.

| Family | Examples | Effect |
|---|---|---|
| **Power** | silver and gold keys | stronger heroes, sooner — at published odds |
| **Comfort** | rush a timer, refill Mana, refresh the shop | buys back the player's time |
| **Breadth** | attunement slots, hero slots, builders | more things at once |
| **Cosmetic** | a Townhall banner set | zero economic effect |

### 1.1 Gem sinks and faucet

- The Gems plaque in the header opens the store (§2.1).
- Gems buy **five** things: **keys**, hero slots, attunement slots, builders,
  Mana refills. Three of those are one-time ladders; the refill is a ladder
  that **resets every day** ([`08-magic.md`](08-magic.md) §6).
- **Gems never buy a pull directly.** They buy a key, and the key is what a
  call spends — so the two banners have two prices without a second Gem price
  ([`10-heroes.md`](10-heroes.md) §6.1).
- Faucet: **3,750 up front plus ~4,500/month** — 500 to start, 750 across the
  quest chain, 500 a first delve clear, and **3,000 a daily-chest season** (a
  season is 20 days, so ~4,500 a month — [`12-quests.md`](12-quests.md) §3.2).
  The season is the faucet; everything else is the opening. A free player
  earns three gold keys, or a builder and change, every month.

## 2. The catalogue

- Fourteen SKUs in five families.
- Prices are displayed in dollars; they exist so a choice has a relative cost.
- The six Gem packs are built and live in the workbook's `Store` sheet. The
  builders and the two keys are built and priced in Gems — a Gem price is not
  a `Store` row. **A `Store` row is real money**; most of them grant Gems, and
  the ones that do not (the Royal chest, the banner set) grant a lot for a
  season or once and never a currency drip. Everything else is designed, not built.

| SKU | Family | Price | Grants |
|---|---|---|---|
| **Gems ×500 / ×2,500 / ×5,000 / ×10,000 / ×25,000 / ×50,000** | currency | **$0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99** | Gems — built; six packs on a 3×2 grid (§2.2) |
| **Silver key** | chance | Gems (500) | one common call — built |
| **Gold key** | chance | Gems (1,500) | one golden call — built |
| **Second builder** | permanent comfort | Gems (2,500, ×2) | +1 builder — built |
| Third builder | permanent comfort | Gems | +1 more — built |
| **Royal chest** | season | **€9.99** | the daily chest's paid column for one 20-day season — 25,000 Gems, ten gold keys and 100,000 Hero XP across 14 rungs: **50,000 Gems of value** ([`12-quests.md`](12-quests.md) §3.3) |
| **Event pass, paid track** | season | $4.99 | unlocks the paid column |
| Fog charter | land | $2.99 | a bundle of instant reveals |
| Mana refill | consumable | Gems (400 → 2,000 by rung, 5 a day) | a whole pool — built |
| Shop refresh | consumable | Gems / ad | refreshes event stock |
| Attunement / hero slot | one-time ladder | Gems | built |
| **Town banner set** | cosmetic | $2.99 | a visual variant — the probe, §5 |

- The second builder is sold in two places: the offer raised by a refused
  build ([`06-construction.md`](06-construction.md) §2) and a card in the
  store.

### 2.1 The store screen

- One sheet, two doors: the **leftmost tab of the nav bar** and the **Gems
  plaque in the header**.
- Four sections, in this order:

| Section | Content | Paid with |
|---|---|---|
| **Heroes** | the two banners themselves — chance, both pities, the Call and Call ×10 buttons, the free call. **Moving to the Tavern** (decided 2026-09-08): heroes are unlocked by that building and called by tapping it ([`10-heroes.md`](10-heroes.md) §8). Here until the Tavern is built | a key |
| **Keys** | one card per banner: what a key costs in Gems and how many the player holds. **This section stays** when the banners leave — the store is where a currency is bought | Gems |
| **Builders** | the same hire the refused-build offer sells, with the crew's size beside it; at the ceiling it says so and sells nothing | Gems |
| **Gems** | six packs on a **3×2 grid of upright cards** — count over art over price, each with its own sprite (`render/assets/gems_*.png`). A tap opens the **confirmation** (§3.2), never a grant | the monthly budget |

- The store shows no budget line, no `SIMULADO` mark, and no price greyed out
  for a short allowance. The budget, the profile and the word `SIMULADO`
  appear in one place only: the confirmation (§3.2).
- Hiring a builder from the store keeps the store open; hiring one from the
  refused-build offer closes it.

### 2.2 The Gem ladder

- **500 Gems to the dollar, flat across every tier**: $0.99 buys 500, $99.99
  buys 50,000. No tier is a better deal than another.
- **The Royal chest sits outside the ladder on purpose** — €9.99 for 50,000
  Gems of value, ten times the rate, paid out over fourteen logins in twenty
  days. A pack is Gems now; the pass is Gems, keys and XP for showing up. Half
  its value is not Gems at all, which is what keeps the packs worth measuring
  ([`12-quests.md`](12-quests.md) §3.2).
- Every Gem sink is priced to the ladder (§9). Anchors: a second builder is
  the $4.99 pack; a silver key is 500 Gems and a gold one 1,500; an hour of
  speed-up is 720 Gems.
- The first pair of prices a player meets is a Mana refill against a silver
  key: **400 against 500** — one $0.99 pack buys either, with change on the
  refill. The refill then climbs (`08-magic.md` §6) and the key does not, so
  the second one of the day is already the dearer of the two.

## 3. The simulated budget

- Each playtester declares once who they are playing as. The game holds them to
  that profile's budget every month.
- Purchases are granted for real, out of the budget.

| Profile | Budget a month | Who it stands for |
|---|---|---|
| **F2P** | **$0** | never spends; walks the same store and is refused every price |
| **Minnow** | **$10** | a pack or two a month |
| **Dolphin** | **$50** | buys what saves time; a chest of Gems most weeks |
| **Whale** | **$250** | buys what they want, when they want it |
| **Super Whale** | **$2,000** | the store is not a constraint; represents the top of the spend curve, so the read-out can tell "wanted it" from "could afford it" |

- The grant is real; the economy stays coherent.
- Choices are exclusive within a budget.
- A tap on something the player cannot afford: record the intent, refuse the
  grant, show the balance. The save keeps a **refusal count** beside the
  purchase log.
- The confirmation says `SIMULADO` and shows the budget; nothing else in the
  game does. Every purchase passes through it. The profile sheet (§3.1) states
  up front that nothing charges real money — the disclosure OQ-29 asks for,
  made once, before the first price.

### 3.1 The profile

- A save with no profile stops at a sheet before the map is playable: five
  options, each with its budget and a line about who it is, and a line about
  why the game is asking.
- The sheet has no close knob and the scrim does not dismiss it. The presenter
  forces it over anything else that asks to open, and lets the waiting request
  (chiefly the welcome-back report) through once a profile is picked.
- The choice is final for the save. The only way to change it is **start
  over**, named on the sheet and in Settings; the fresh game asks again.
- A save without the field is asked on its next launch (additive field, no
  migrator).
- The budget period is the **calendar month, UTC**, derived from the sim's
  timestamp, never from a counter.
- Nothing rolls over: the first of the month is a full budget, not last month's
  remainder plus one.
- Budgets and prices are stored in **cents, never dollars**, and compared as
  integers.

### 3.2 The confirmation

- A tap on a price opens a centred sheet: what the pack grants, its price, what
  is left of the month, and either what would be left after or how far short
  the player is.
- With budget the button buys. Without, the button is dead with its reason
  attached — *your budget refills in 3 days*, or *you are playing as someone
  who never spends*.
- Nothing is granted from the store card itself.

## 4. The funnel and the log

```
offer_shown → store_opened → sku_viewed → confirm_opened
            → purchased | dismissed | refused_no_credit
```

- Every row carries: player id, session id, wall-clock ms, day index, SKU,
  price, credit remaining, and three pieces of game context — Townhall level,
  minutes played to date, and what the player was doing when the offer
  appeared.
- Until the pipeline exists (designed, not built), the save is the log:
  `player.payer` keeps every purchase (SKU, price, when) and the refusal
  count. It lacks the game context above and can be reset by the player.
- Server side, insert-only: a policy that permits insert on rows whose owner is
  the caller, and no read, update or delete from the client.
- Batched, never per-tap: queue locally, flush every N events or on page hide.

## 5. Cosmetics — one probe

- One cosmetic family, as a probe. Not a system.
- A set of Townhall banners: three or four colour variants of one sprite,
  enough to occupy a store card and measure whether anyone taps it.
- If it ranks, cosmetics become a pipeline decision; if it does not, the
  cosmetic thesis is recorded as weaker than assumed. **OQ-26.**

## 6. Rewarded video: seven placements

| # | Placement | Reward | Status |
|---|---|---|---|
| 1 | **Mana refill** | a full pool, 5 a day | built |
| 2 | **A free common call** | one pull, 5 a day | built |
| 3 | **A free golden call** | one pull, 1 a day | built |
| 4 | Double a quest reward | ×2 on claim | designed |
| 5 | Refresh the event shop | one refresh | designed |
| 6 | Skip a builder timer | a slice of the remaining build | designed |
| 7 | A second daily chest | one extra ladder claim | designed |

- Placement 1: the reward is a whole pool, so the Sanctum — which raises the
  cap — raises the value of every future ad with it; the offer only appears
  below half a pool; the cooldown is randomised 30–90 s; and it is capped at
  **5 a day**, which is what the session arithmetic already assumed
  ([`08-magic.md`](08-magic.md) §6).
- Placement 1 is also the only one with a **paid twin**: the same whole pool
  on a rising Gem ladder beside it, on its own counter. The video is the free
  path and the ladder is what a player who has spent it can still buy.
- Placements 2 and 3 are the free path to a hero
  ([`10-heroes.md`](10-heroes.md) §6.2). Like placement 1 they carry a **daily
  cap** rather than a shortage condition, because a call answers no shortage —
  the cap is what keeps them from becoming the whole game.
- Wonders offer no ad placement ([`12-quests.md`](12-quests.md) §6): no timer
  to skip, no slot to reroll, and a Wonder discount would sell permanent
  progression (§1).
- An offer answers a shortage rather than interrupting: placement 1 only
  appears below half a pool; 5 and 7 only on a card the player already opened.
- The reward is priced in the player's own production, never as an absolute,
  so an ad is worth the same fraction of progress at hour 1 and hour 40.

### 6.1 What the ads are worth

- **A day is about eleven ads**, and each placement's own cap is what says so:
  five Mana refills, five common calls, one golden call. Only the first five
  buy production.
- A tap hands back **10 seconds** of what was tapped and costs **1 Mana**, so
  Mana is a production budget: the base **12/h** pays for **288 taps a day**,
  worth **48 minutes** of production against the 24 hours the city runs
  anyway — taps are **~3%** of a day's income.
- A refill is a full pool, **100 Mana** at the base cap. Five of them add
  **500 taps**, worth **83 minutes** of production — the watcher's day is
  **~6% richer**, and their tap budget is close to **three times** the
  non-watcher's.
- The six call placements buy **no production at all**: they buy roughly
  **150 common calls and 30 golden ones a month**, which is what makes a
  Legendary reachable without a wallet (§1).
- Both figures scale with the Sanctum, which raises the cap and therefore the
  size of every refill. **OQ-43, OQ-45, OQ-51.**

## 7. The read-out

One page, refreshed weekly:

1. **SKUs ranked** by confirmed purchases per player who saw them, with credit
   spent and refusals-for-lack-of-credit alongside.
2. **Placements ranked** by ad completions per session, and the resulting share
   of total progress that came from ads.
3. **The caveat** of §0, restated every time.

- Everything else the telemetry collects — session count, session length, day
  index of last session, quests claimed, Wonder levels bought, milestones
  reached — serves the retention read-out, not this one.
- No event pipeline exists yet, so no D30 can be produced.

## 8. Exit gate

- Every SKU has a card, a price, a confirm step and a funnel.
- The budget is enforced and refills monthly; it is shown on the confirmation
  and nowhere else; the profile cannot be changed without a fresh game.
- No purchase can complete without passing a sheet that says `SIMULADO`.
- The funnel table is insert-only from the client, verified by trying to read
  it.
- Two weeks of at least five playtesters produce a ranking that is stable
  between week one and week two. If the ranking is not stable, the sample is
  the finding, and the report says so instead of ranking noise.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Gacha pull | **1,000** Gems ($1.99) | `gacha.pull_gem_cost` |
| Second builder | **2,500**, `×2` per builder ($4.99 / $9.99 / $19.99) | `kingdom.builder_gem_cost_*` |
| Mana refill | a whole pool, **400 / 600 / 800 / 1,000 / 2,000** by rung, 5 a day | `mana.gem_refill_costs` |
| Video refill | a whole pool, **5 a day** | `ads.mana_refills_per_day` |
| Rush a build or a training line | **5 s a Gem** — 720 an hour ($1.44) | `rush.seconds_per_gem` |
| Research slot | 2,500, `×2` ($4.99 / $9.99) | `research.slot_gem_cost_*` |
| Party slot | 1,500, `×2` ($2.99 / $5.99 / $11.99) | `party.slot_gem_cost_*` |
| Attunement slot | 1,000, `×2` ($1.99 / $3.99 / $7.99 / $15.99) | `attunement.slot_gem_cost_*` |
| Gem faucet | 500 start · 150/150/250/200 in the chain · 500 a first clear · **3,000 a 20-day season** | `Currencies`, `Quests`, `delve.first_clear_gems`, `daily.gems` |
| The Royal chest | **€9.99** a season; 25,000 Gems, ten gold keys, 100,000 XP | `Store` sheet, `daily.premium_*` |
| Ad cooldown | 30–90 s | `ads.cooldown_*_seconds` |
| Ad eligibility | below half a pool | `ads.eligible_below_fraction` |
| Gem packs | 500 · 2,500 · 5,000 · 10,000 · 25,000 · 50,000 for $0.99 · $4.99 · $9.99 · $19.99 · $49.99 · $99.99 — 500 Gems/$ | `Store` sheet |
| Monthly budgets | F2P $0 · Minnow $10 · Dolphin $50 · Whale $250 · Super Whale $2,000 | `payer.*_monthly_usd` |

## 10. Deliberately not in this design

- A real charge, ever.
- A second premium currency.
- **A monthly card.** A subscription measured in calendar days over a ladder
  that is not; the Royal chest is the season product
  ([`12-quests.md`](12-quests.md) §3.3).
- A power ceiling no amount of play can reach.
- A free trial on the builder ([`06-construction.md`](06-construction.md) §5).
- A streak-repair SKU.
- Loot boxes beyond the hero banner.
- An ad that gates rather than accelerates.
- A cosmetic pipeline before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-29, OQ-31, OQ-32, OQ-43, OQ-45, OQ-51.
