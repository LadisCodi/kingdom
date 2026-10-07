# 14 · Monetisation — Gems, ads, and a store that never charges

> **Scope.** What a wallet may buy, the rewarded-video placements, and the
> **simulated** store: real in every way that produces data, fake in exactly one
> — the charge. The Mana placement is designed in
> [`08-magic.md`](08-magic.md) §6, the two call placements in
> [`10-heroes.md`](10-heroes.md) §6.2.
>
> **Status: built** — the payer profile and its monthly budget (§3); the
> Gem packs, the item bundles (§2.3), the **offers** and the **daily offers**
> (§2.4, §2.5), the **first-purchase pack** and its splash (§2.6) and the Survey's paid
> column for simulated dollars; builders, explorers, hero slots, keys and the
> rest of §1.1 for Gems; three ad placements and the builder offer. The
> store's layout is a stand-in until its redesign. The shop refresh, the town
> banner set and the other three placements are designed, not built.

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
| **Breadth** | builders, explorers, hero slots | more things at once |
| **Exploration** | the Survey's paid column ([`25-the-survey.md`](25-the-survey.md)) | more of what exploring finds — never a reveal |
| **Cosmetic** | a Townhall banner set | zero economic effect |

### 1.1 Gem sinks and faucet

- The Gems plaque in the header opens the store (§2.1).
- What Gems buy:
  - **keys** — a silver or a gold one, a call each;
  - **slots for good** — builders, explorers, hero slots, each on a doubling
    ladder;
  - **time** — finishing a build, a training line, a workshop item or an
    explorer's trip at `rush.secondsPerGem`;
  - **Mana** — a whole pool, on a ladder that resets daily
    ([`08-magic.md`](08-magic.md) §6);
  - **Knowledge** — a point at a fixed price, alone or all a technology
    still misses ([`07-research.md`](07-research.md) §3.2);
  - **relics** — the store's fragment pack, a forged replica, a premium
    Shrine ([`09-relics.md`](09-relics.md)).
- **Gems never buy a pull directly.** They buy a key, and the key is what a
  call spends ([`10-heroes.md`](10-heroes.md) §6.1).
- Faucet: **500 to start**, **750 across the quest chain**
  ([`12-quests.md`](12-quests.md) §2.2), **500 at the Survey's last level**,
  and **the Portal** every week — its final ranking and its floor milestones
  ([`19-world-map.md`](19-world-map.md)).
- Prices are displayed in dollars; they exist so a choice has a relative cost.
- **A `store` entry is real money.** Everything else is priced in Gems.

## 2. What is sold for money

- Every product is one entry of `store`, whole: its name, art, price and
  what it hands over — Gems, Bag items, a hero, slots for good.
- Each sits on one **shelf**:

| Shelf | What | Sold |
|---|---|---|
| `gems` | six Gem packs, Gems and nothing else (§2.2) | always |
| `bag` | the item bundles (§2.3) | always |
| `offer` | packs with a window of their own (§2.4) | when a trigger opens them |
| `daily` | the pool the day's offers are drawn from (§2.5) | in today's draw |
| `survey` | the Survey's paid column, **$9.99, once per kingdom** ([`25-the-survey.md`](25-the-survey.md)) | on the Survey |

- The second builder is also sold, for Gems, by the offer a refused build
  raises ([`06-construction.md`](06-construction.md) §2).

### 2.1 The store screen

- One screen, two doors: the **leftmost tab of the nav bar** and the **Gems
  plaque in the header**.
- Its own backdrop: a magic merchant's shop, soft and out of focus, under a
  warm dark wash. No title: a strip of wooden tabs with the close beside it,
  fixed at the top, over the open tab's page, which scrolls. The page runs
  the full width of the iPhone X:

| Tab | Content | Paid with |
|---|---|---|
| **Offers** — only while there is an offer or a daily offer | a banner per offer on sale (§2.4): its figure, name, pitch, up to four reward tiles (+N), value seal, countdown, price — a tap opens its splash; under them **Today** (§2.5) with the time to the next draw | the monthly budget |
| **Heroes** | the keys held, each with a **+** that buys one (Gems); **Call for aid** over a carousel of the roster — one hero at a time drifting right to left and fading into the next, every hero once before any repeats; **Odds** on a tap; a banner per call: the common call shows its silver key, the golden call (`showsHero`) a Legendary, a different one each time the store is opened, every one before any repeats; free calls today, *Call once* (free, an ad, or a key) and *Call ×10*, the pity. Padlocked until a Tavern stands ([`22-progression.md`](22-progression.md) §3) | keys |
| **Supplies** | the Bag's bundles (§2.3), the relic fragment pack, and the crew: a builder, an explorer (once *Cartography* is researched), a hero slot (once a Tavern stands) — at a ceiling it says so | money · Gems |
| **Gems** | six packs in a 3×2 grid — count over art over price. A tap opens the **confirmation** (§3.2) | the monthly budget |

- It opens on **Offers**, or on **Heroes** when there is none; a door that
  names a tab opens on it (a call for aid → Heroes, the Bag or a shortfall →
  Supplies).
- The store shows no budget line, no `SIMULADO` mark, and no price greyed out
  for a short allowance. The budget, the profile and the word `SIMULADO`
  appear in one place only: the confirmation (§3.2).
- Hiring a builder from the store keeps the store open; hiring one from the
  refused-build offer closes it.

### 2.2 The Gem ladder

- **500 Gems to the dollar, flat across every tier**: $0.99 buys 500, $99.99
  buys 50,000.
- **A Gem pack is the floor.** Every other product hands over more than its
  price buys as Gems; an offer many times more (§2.4).
- Every Gem sink is priced to the ladder (§9). Anchors: a second builder is
  the $4.99 pack; a silver key is 500 Gems and a gold one 1,500; an hour of
  speed-up is 720 Gems.
- The first pair of prices a player meets is a Mana refill against a silver
  key: **400 against 500** — one $0.99 pack buys either, with change on the
  refill. The refill then climbs (`08-magic.md` §6) and the key does not, so
  the second one of the day is already the dearer of the two.

### 2.3 The item bundles

- Six bundles of Bag items, always on sale: speed-ups in a satchel, a crate
  and a chest; choice chests in a sack and a cart; and the builder's crate.
- **They grant no Gems.** A bundle hands over the items, into the Bag.
- The row prints **what lands, line by line**, and the confirmation prints the
  same list above the price.

### 2.4 Offers

- An **offer** is a pack with a **window**: it opens on a trigger, closes on
  its countdown (`hours`, 0 = never) and sells `limit` (0 = no limit).
- What opens one (`opensOn`):

| Trigger | Opens | Comes back |
|---|---|---|
| `always` | with the store | no |
| `door` | when `door` opens | no |
| `after` | when `after` is bought — the next step of a chain | no |
| `townhall` | on every Townhall level from `townhall` on | yes |
| `manaLow` | the pool below the ad threshold (§6) | yes |
| `buildersBusy` | a build refused for want of a builder | yes |

- A trigger that comes back opens the window again once the last one has
  closed and `cooldownHours` have passed.
- Nothing opens before the store's door.
- **An offer that opens a slot is held back** while that slot would go over
  its ceiling — never sold half-useful.
- **Its value is computed**, never authored: what it hands over priced at the
  game's own Gem prices — time at `rush.secondsPerGem` (a chest's hours as
  time), a flask at the first refill's rung, a tome at the Knowledge price, a
  key at the store's, a hero at its banner's guarantee, a slot at its next Gem
  price — over the Gems its price buys as a pack, to the nearest 10%. It is
  printed as a wax seal.
- The catalogue:

| Offer | Price | Opens | Holds |
|---|---|---|---|
| **First Purchase Reward** | $4.99 | the heroes' door; full screen (§2.6) | **the Elven Princess**, keys, Gems; tomorrow her fragments, Gems, Hero XP |
| **The novice's pack** | $3.49 | the store's door | **a builder for good**, Gems, construction speed-ups, chests, keys |
| The squire's pack · the knight's pack | $9.99 · $19.99 | each after the one before | Gems, gold keys, speed-ups, chests, tomes |
| **A second explorer** | $4.99 | the world's door | **an explorer for good**, Gems, speed-ups, chests, flasks, keys |
| **A seat at the war table** | $4.99 | the heroes' door | **a hero slot for good**, Gems, keys, chests, speed-ups |
| A cask of Mana | $0.99 | Mana low; 24 h, back after 72 h | Gems, flasks, a Mana boost |
| Rush the works | $5.99 | a refused build; 4 days, back after a week | Gems, construction speed-ups, chests |
| The new charter | $9.99 | every Townhall level from 3; 48 h | Gems, construction speed-ups, chests, tomes |

- Opening is decided by the live game, not by `advance()`: an offer produces
  nothing, and a trigger met only inside a replayed absence opens nothing.
- **Every offer is shown the same way** (§2.6): a widget on the map opens
  its full-screen splash. What stands in its light is its `art` — a cut-out
  with no background — or its hero. Beside it, a hero's name and rarity, or
  the pack's own words and its step in a chain (*I / III*). Its rewards are
  tiles in a framed panel — over four, the Gems take a row of their own with
  a sack — with its value on a red wax seal; each slot it opens for good has
  a green **GIFT** panel; under the price, its countdown and *Once per
  kingdom* or what is left. A tap on its row in the store opens its splash.

### 2.5 Daily offers

- **`offers.dailyCount` (3) a day**, drawn from the `daily` shelf among the
  products the Townhall's level admits (`townhall`).
- The draw changes at midnight UTC and is the same however often it is asked.
- Each sells `limit` a day.

### 2.6 The first-purchase pack and the splash

- **First Purchase Reward**, an offer: **$4.99**, once per kingdom, opened by
  the heroes' door (a Tavern standing).
- Now: **the Elven Princess** (Legendary), 10 gold keys, 10 silver keys,
  300 Gems. A hero already held pays her duplicate fragments.
- **The next day** (from the next midnight UTC), **claimed by the player**:
  10 of her fragments — her first ascension — 200 Gems, 1,500 Hero XP.
- An offer with `splash` is shown **full screen at the start of every
  session** while it is on sale, from the session after its window opened,
  once the map is free (no sheet, fight, reveal, video or unlock splash). It
  sits over everything, the header too; its close knob closes it for the
  session.
- The splash's button is the **price**: it goes straight to the confirmation
  (§3.2), which returns to the map.
- Bought, the splash shows tomorrow's part **locked**; the *Tomorrow's part*
  notice ([`26-notices.md`](26-notices.md) §2.2) counts down to it, then glows
  and offers **Claim**. At the start of a
  session with a part ready, the splash opens on it, and its button claims.
- Any product may carry a next-day part (`nextDay*`); a hero's fragments
  need the product's `hero`.
- The offers with `widget` float on the map as **one widget under the
  Survey's**, top left: the icon (`sprite`) of the offer that leads — one
  with something to claim, then those on sale, then those waiting for
  tomorrow — a red badge counting them when there are two or more, and a
  small wooden sign whose words scroll: the lead's name (and its countdown,
  if its window closes), *Tomorrow in …*, then **Claim!** with a red dot.
- A tap opens the lead's splash with **every offer in a row along its top**,
  to step from one to the next. A splash opened by the session has no row.
- A `widget` offer's next-day part is shown there, not as a notice.

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
| Offers | price, contents, trigger, window, limit, cooldown | `store` (shelf `offer`) |
| Daily offers | **3 a day** from the `daily` shelf | `offers.dailyCount` · `store` (shelf `daily`) |
| First-purchase pack | $4.99 · the Elven Princess, 10 + 10 keys, 300 Gems · tomorrow 10 fragments, 200 Gems, 1,500 Hero XP | `store.FirstPurchase` |
| Explorer | **2,500**, `×2`, **2** for sale | `world.explorerGemCost*`, `world.explorersForSale` |
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
- **A login ladder.** A product's next-day part is one delivery, not a
  ladder.
- A power ceiling no amount of play can reach.
- A free trial on the builder ([`06-construction.md`](06-construction.md) §5).
- A streak-repair SKU.
- Loot boxes beyond the hero banner, at published odds. A **bundle is not a
  loot box**: it says exactly what is in it.
- An ad that gates rather than accelerates.
- A cosmetic pipeline before the probe reports.

**Open questions:** OQ-25, OQ-26, OQ-29, OQ-31, OQ-32, OQ-43, OQ-45, OQ-51.
