# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The one ad placement that ships is designed in
> [`08-magic.md`](08-magic.md) §6.
>
> **Status: the ad placement, the builder offer, and the store's first cut
> are built** — the payer profile and its monthly budget (§3), and three
> surfaces: builders for Gems, Gem packs for simulated dollars, and the hero
> banner (§2.1). The remaining SKUs, the other four placements and the
> telemetry pipeline (§4) are designed, not built.

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

- Wallets buy comfort and breadth; play buys everything else.
- Nothing is purchase-only that cannot also be earned. The first rung of every
  ladder is earned by play: research grants the second attunement slot and the
  third party slot before Gems can buy any; the daily chest pays Gems at the
  week marker.
- Nothing a wallet buys is access or power.

| Family | Examples | Effect |
|---|---|---|
| **Comfort** | rush a timer, refill Mana, refresh the shop | buys back the player's time |
| **Breadth** | attunement slots, party slots, builders, gacha pulls | more things at once, never stronger things |
| **Cosmetic** | a Townhall banner set | zero economic effect |

### 1.1 Gem sinks and faucet

- The Gems plaque in the header opens the store (§2.1).
- Gems buy **five** things: pulls, party slots, attunement slots, builders,
  Mana refills. Three of those are one-time ladders.
- Faucet: **3,750 up front plus ~1,000/month** — 500 to start, 750 across the
  quest chain, 500 a first delve clear, 250 at the week marker.

## 2. The catalogue

- Twelve SKUs in four families.
- Prices are displayed in dollars; they exist so a choice has a relative cost.
- The six Gem packs are built and live in the workbook's `Store` sheet. The
  builders are built and priced in Gems. Everything else is designed, not built.

| SKU | Family | Price | Grants |
|---|---|---|---|
| **Gems ×500 / ×2,500 / ×5,000 / ×10,000 / ×25,000 / ×50,000** | currency | **$0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99** | Gems — built; six packs on a 3×2 grid (§2.2) |
| **Second builder** | permanent comfort | Gems (2,500, ×2) | +1 builder — built |
| Third builder | permanent comfort | Gems | +1 more — built |
| **Monthly card** | subscription | $4.99/mo | Gems daily for 30 days |
| **Event pass, paid track** | season | $4.99 | unlocks the paid column |
| Fog charter | land | $2.99 | a bundle of instant reveals |
| Mana refill | consumable | Gems | fills the pool |
| Shop refresh | consumable | Gems / ad | refreshes event stock |
| Attunement / party slot | one-time ladder | Gems | built |
| **Town banner set** | cosmetic | $2.99 | a visual variant — the probe, §5 |

- The second builder is sold in two places: the offer raised by a refused
  build ([`06-construction.md`](06-construction.md) §2) and a card in the
  store.

### 2.1 The store screen

- One sheet, two doors: the **leftmost tab of the nav bar** and the **Gems
  plaque in the header**.
- Three sections, in this order:

| Section | Content | Paid with |
|---|---|---|
| **Heroes** | the hero banner itself — chance, pity, the Call button. The Reliquary's heroes tab keeps the roster and points here | Gems |
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
- Every Gem sink is priced to the ladder (§9). Anchors: a second builder is
  the $4.99 pack; a hero pull is 1,000 Gems; an hour of speed-up is 720 Gems.
- The first pair of prices a player meets is a Mana refill against a hero
  pull: 500 against 1,000 — one pack against two on the store.

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

## 6. Rewarded video: five placements

| # | Placement | Reward | Status |
|---|---|---|---|
| 1 | **Mana refill** | a full pool | built |
| 2 | Double a quest reward | ×2 on claim | designed |
| 3 | Refresh the event shop | one refresh | designed |
| 4 | Skip a builder timer | a slice of the remaining build | designed |
| 5 | A second daily chest | one extra ladder claim | designed |

- Placement 1: the reward is a whole pool; ten sanctuaries double the pool and
  therefore double every future ad; the offer only appears below half a pool;
  the cooldown is randomised 30–90 s.
- Wonders offer no ad placement ([`12-quests.md`](12-quests.md) §6): no timer
  to skip, no slot to reroll, and a Wonder discount would sell permanent
  progression (§1).
- An offer answers a shortage rather than interrupting: placement 1 only
  appears below half a pool; 3 and 5 only on a card the player already opened.
- The reward is priced in the player's own production, never as an absolute,
  so an ad is worth the same fraction of progress at hour 1 and hour 40.
- A full pool is ~5.5 minutes of the city's own production; five ads a day buy
  a watcher about **2–3%** faster progress. Re-derive once all five exist.
  **OQ-43, OQ-45, OQ-51.**

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
| Mana refill | **500 Gems a full pool** ($0.99), pro rata on what is missing | `mana.gem_refill_full_pool` |
| Rush a build or a training line | **5 s a Gem** — 720 an hour ($1.44) | `rush.seconds_per_gem` |
| Research slot | 2,500, `×2` ($4.99 / $9.99) | `research.slot_gem_cost_*` |
| Party slot | 1,500, `×2` ($2.99 / $5.99 / $11.99) | `party.slot_gem_cost_*` |
| Attunement slot | 1,000, `×2` ($1.99 / $3.99 / $7.99 / $15.99) | `attunement.slot_gem_cost_*` |
| Gem faucet | 500 start · 150/150/250/200 in the chain · 500 a first clear · 250 at the week marker | `Currencies`, `Quests`, `delve.first_clear_gems`, `daily.gems` |
| Ad cooldown | 30–90 s | `ads.cooldown_*_seconds` |
| Ad eligibility | below half a pool | `ads.eligible_below_fraction` |
| Gem packs | 500 · 2,500 · 5,000 · 10,000 · 25,000 · 50,000 for $0.99 · $4.99 · $9.99 · $19.99 · $49.99 · $99.99 — 500 Gems/$ | `Store` sheet |
| Monthly budgets | F2P $0 · Minnow $10 · Dolphin $50 · Whale $250 · Super Whale $2,000 | `payer.*_monthly_usd` |

## 10. Deliberately not in this design

- A real charge, ever.
- A second premium currency.
- A gacha-exclusive power ceiling.
- A free trial on the builder ([`06-construction.md`](06-construction.md) §5).
- A streak-repair SKU.
- Loot boxes beyond the hero banner.
- An ad that gates rather than accelerates.
- A cosmetic pipeline before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-29, OQ-31, OQ-32, OQ-43, OQ-45, OQ-51.
