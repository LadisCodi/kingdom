# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The Mana placement is designed in
> [`08-magic.md`](08-magic.md) §6, the two call placements in
> [`10-heroes.md`](10-heroes.md) §6.2.
>
> **Status: three ad placements, the builder offer and the
> store are built** — the payer profile and its monthly budget (§3);
> builders and keys for Gems; the **item bundles** (§2.3), the Gem packs and
> the Survey's paid column for simulated dollars; and the two hero banners
> (§2.1). The shop
> refresh, the town banner set, the other three placements and the telemetry
> pipeline (§4) are designed, not built.

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
- The first rung of every ladder is earned by play: **a hero slot is the only
  slot in a party that is ever sold** — every troop slot on the board is open
  from the first fight ([`combat.md`](combat.md) §3) — and the Survey's paid
  gold keys are the same keys an ad already gives away daily.

| Family | Examples | Effect |
|---|---|---|
| **Power** | silver and gold keys | stronger heroes, sooner — at published odds |
| **Comfort** | rush a timer, refill Mana, buy Knowledge, item bundles, refresh the shop | buys back the player's time |
| **Breadth** | hero slots, builders | more things at once |
| **Exploration** | the Survey's paid column ([`25-the-survey.md`](25-the-survey.md)) | more of what exploring finds — never a reveal |
| **Cosmetic** | a Townhall banner set | zero economic effect |

### 1.1 Gem sinks and faucet

- The Gems plaque in the header opens the store (§2.1).
- Gems buy **five** things: **keys**, hero slots, builders, Mana refills and
  **Knowledge** at a fixed price a point
  ([`07-research.md`](07-research.md) §3.2). Two of those are one-time ladders;
  the refill is a ladder that **resets every day**
  ([`08-magic.md`](08-magic.md) §6).
- **Gems never buy a pull directly.** They buy a key, and the key is what a
  call spends — so the two banners have two prices without a second Gem price
  ([`10-heroes.md`](10-heroes.md) §6.1).
- Faucet: **1,250 up front** — 500 to start and 750 across the quest chain
  ([`12-quests.md`](12-quests.md) §2.2) — and **500 at the Survey's last
  level**. There is no recurring Gem faucet: past those, Gems are bought.
- Prices are displayed in dollars; they exist so a choice has a relative cost.
- The six Gem packs are built and live in `store`. The
  builders and the two keys are built and priced in Gems — a Gem price is not
  a `store` entry. **A `store` entry is real money**; most of them grant Gems, and
  the ones that do not (the Survey's paid column, the item bundles, the
  banner set) grant a lot once and never a currency drip. Everything
  else is designed, not built.

| SKU | Family | Price | Grants |
|---|---|---|---|
| **Gems ×500 / ×2,500 / ×5,000 / ×10,000 / ×25,000 / ×50,000** | currency | **$0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99** | Gems — built; six packs on a 3×2 grid (§2.2) |
| **Silver key** | chance | Gems (500) | one common call — built |
| **Gold key** | chance | Gems (1,500) | one golden call — built |
| **Second builder** | permanent comfort | Gems (2,500, ×2) | +1 builder — built |
| Third builder | permanent comfort | Gems | +1 more — built |
| **The Survey, paid column** | exploration | **$9.99**, once per kingdom | Gems on every one of 36 levels climbed by cells revealed, with gold keys, Stardust, relic fragments and chests, opened for every level already reached ([`25-the-survey.md`](25-the-survey.md)) — built |
| Mana refill | consumable | Gems (400 → 2,000 by rung, 5 a day) | a whole pool — built |
| Shop refresh | consumable | Gems / ad | refreshes event stock |
| Hero slot | one-time ladder | Gems | built |
| **Item bundles** | comfort | **$1.99 / $4.99 / $9.99** | speed-ups, choice chests, or the builder's crate, into the Bag (§2.3) — built |
| **Town banner set** | cosmetic | $2.99 | a visual variant — the probe, §5 |

- The second builder is sold in two places: the offer raised by a refused
  build ([`06-construction.md`](06-construction.md) §2) and a card in the
  store.

### 2.1 The store screen

- One sheet, two doors: the **leftmost tab of the nav bar** and the **Gems
  plaque in the header**.
- Five sections, in this order:

| Section | Content | Paid with |
|---|---|---|
| **Heroes** | the two banners themselves — chance, both pities, the Call and Call ×10 buttons, the free call. Padlocked until a Tavern stands ([`22-progression.md`](22-progression.md) §3) | a key |
| **Bundles** | the item bundles of §2.3. Shown once the Bag is open | the monthly budget |
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
- Every Gem sink is priced to the ladder (§9). Anchors: a second builder is
  the $4.99 pack; a silver key is 500 Gems and a gold one 1,500; an hour of
  speed-up is 720 Gems.
- The first pair of prices a player meets is a Mana refill against a silver
  key: **400 against 500** — one $0.99 pack buys either, with change on the
  refill. The refill then climbs (`08-magic.md` §6) and the key does not, so
  the second one of the day is already the dearer of the two.

### 2.3 The item bundles

- Six bundles of Bag items, sold for money: speed-ups in a satchel, a crate
  and a chest; choice chests in a sack and a cart; and the builder's crate.
- **They grant no Gems.** A bundle hands over the items, into the Bag.
- The row prints **what lands, line by line**, and the confirmation prints the
  same list above the price.

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

- **The First Morning is played before anything is asked**
  ([`23-tutorials.md`](23-tutorials.md) §3). Once it is over, a save with no
  profile stops at a sheet: five options, each with its budget and a line
  about who it is, and a line about why the game is asking.
- **A playtest organiser can set it in the link**: `?payer=<Profile>`
  (`F2P`, `Minnow`, `Dolphin`, `Whale`, `SuperWhale`) chooses it at launch and
  the sheet never shows. A link cannot change a profile already chosen.
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
- The pipeline is planned in [`../plans/analytics.md`](../plans/analytics.md).
- Until it exists, the save is the log:
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

## 6. Rewarded video: six placements

| # | Placement | Reward | Status |
|---|---|---|---|
| 1 | **Mana refill** | a full pool, 5 a day | built |
| 2 | **A free common call** | one pull, 5 a day | built |
| 3 | **A free golden call** | one pull, 1 a day | built |
| 4 | Double a quest reward | ×2 on claim | designed |
| 5 | Refresh the event shop | one refresh | designed |
| 6 | Skip a builder timer | a slice of the remaining build | designed |

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
- Wonders offer no ad placement ([`12-quests.md`](12-quests.md) §5): no timer
  to skip, no slot to reroll, and a Wonder discount would sell permanent
  progression (§1).
- An offer answers a shortage rather than interrupting: placement 1 only
  appears below half a pool; 5 only on a card the player already opened.
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
- The six calls a day buy **no production at all**: they buy roughly
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
| Keys | **500** a silver key, **1,500** a gold key | `banners.*.keyGemCost` |
| Second builder | **2,500**, `×2` per builder ($4.99 / $9.99 / $19.99) | `kingdom.builderGemCost*` |
| Mana refill | a whole pool, **400 / 600 / 800 / 1,000 / 2,000** by rung, 5 a day | `mana.gemRefillCosts` |
| Video refill | a whole pool, **5 a day** | `ads.manaRefillsPerDay` |
| Rush a build or a training line | **5 s a Gem** — 720 an hour ($1.44) | `rush.secondsPerGem` |
| A point of Knowledge | **200**, fixed — **OQ-105** | `knowledge.gemsPerPoint` |
| Hero slot | 2,500, `×2` ($4.99 / $9.99) | `party.heroSlotGemCost*` |
| Gem faucet | 500 start · 150/250/200/150 in the chain · 500 at the Survey's last level | `currencies`, `quests`, `survey.freeGems` |
| Item bundles | **$1.99 / $4.99 / $9.99**, what each holds | `store` · `items` |
| Ad cooldown | 30–90 s | `ads.cooldown*Seconds` |
| Ad eligibility | below half a pool | `ads.eligibleBelowFraction` |
| Gem packs | 500 · 2,500 · 5,000 · 10,000 · 25,000 · 50,000 for $0.99 · $4.99 · $9.99 · $19.99 · $49.99 · $99.99 — 500 Gems/$ | `store` |
| Monthly budgets | F2P $0 · Minnow $10 · Dolphin $50 · Whale $250 · Super Whale $2,000 | `payer.*MonthlyUsd` |

## 10. Deliberately not in this design

- A real charge, ever.
- **A reveal for sale.** The fog is bought with Gold, a tap at a time; what
  money buys is what exploring finds — the Survey.
- A second premium currency.
- **A monthly card.** A subscription measured in calendar days over a ladder
  that is not; the Survey is the ladder product
  ([`25-the-survey.md`](25-the-survey.md)).
- **A season pass.** A seasonal reward ladder, its missions and its paid
  column.
- **A login ladder.**
- A power ceiling no amount of play can reach.
- A free trial on the builder ([`06-construction.md`](06-construction.md) §5).
- A streak-repair SKU.
- Loot boxes beyond the hero banner, at published odds. A **bundle is not a
  loot box**: it says exactly what is in it.
- An ad that gates rather than accelerates.
- A cosmetic pipeline before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-29, OQ-31, OQ-32, OQ-43, OQ-45, OQ-51.
