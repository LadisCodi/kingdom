# Proposal — the packs, the chests and the star ladder

> **What this is.** The six packs cards come in, the three vault chests
> duplicates buy, what a duplicate is worth, and where each of them falls.
> Authored and checked in a spreadsheet; every figure below is **measured by
> simulation against those numbers**, not asserted.
>
> It is a **proposal**, not a feature doc: nothing here is built. The albums it
> fills are [`album-cycles.md`](album-cycles.md) §6.4; the relics they level
> are [`relic-effects.md`](relic-effects.md).

## 1. A pack is guarantees plus filler

The model changes. Today a card rolls a rarity from five weights and then
flips a **separate coin** for its gold edition, which creates hard walls: a
Bronze pack can *never* produce a 4★, so some albums are unreachable rather
than expensive.

The new shape: **a pack has N cards, some of them guaranteed at a named
rarity, and the rest roll one seven-way distribution that already contains the
gold editions.**

- **Nothing is unreachable.** Every pack has a path to every rarity. A Verde
  can hand over a gold 5★ about once in 6,600 — a lottery rather than a route,
  which is a fine thing for the cheapest pack to be, as long as it is called
  one.
- **The guarantee is the pack's identity**, and the six make one ladder a
  player can read without a legend: Verde 1★, Amarillo 2★, Rosa 3★, Azul 4★,
  Púrpura 5★, Dorado gold.

### 1.1 The six packs

| Pack | Cards | Guarantees | 1★ | 2★ | 3★ | 4★ | 5★ | 4★G | 5★G |
|---|---|---|---|---|---|---|---|---|---|
| **Verde** | 2 | 1× 1★ | 84.920% | 12.005% | 2.500% | 0.400% | 0.100% | 0.060% | 0.015% |
| **Amarillo** | 3 | 1× 2★ | 69.850% | 25.000% | 4.000% | 0.800% | 0.200% | 0.120% | 0.030% |
| **Rosa** | 3 | 1× 3★ | 59.800% | 29.900% | 8.000% | 1.500% | 0.500% | 0.225% | 0.075% |
| **Azul** | 4 | 1× 4★ | 50.000% | 35.000% | 9.000% | 4.000% | 1.200% | 0.550% | 0.250% |
| **Púrpura** | 6 | 1× 5★ | 40.000% | 34.000% | 14.500% | 7.000% | 3.000% | 1.050% | 0.450% |
| **Dorado** | 1 | — | | | | | | 75.000% | 25.000% |

The percentages apply to the `Cards − guarantees` slots that are left.

### 1.2 The three vault chests

Not a faucet — **what duplicates buy**. Bought with stars, never with Gems.

| Chest | Cards | Guarantees | Filler distribution | Stars |
|---|---|---|---|---|
| **Bronce** | 7 | 1× 3★, 1× 4★ | Verde's | **150** |
| **Silver** | 9 | 1× 4★, 1× 5★ | Rosa's | **250** |
| **Gold** | 3 | 1× 5★, 1× 4★G | Dorado's | **400** |

### 1.3 What a duplicate is worth

| | 1★ | 2★ | 3★ | 4★ | 5★ | 4★G | 5★G |
|---|---|---|---|---|---|---|---|
| **Stars** | 2 | 6 | 16 | 40 | 100 | **80** | **200** |
| Slots in the deck | 18 | 16 | 12 | 10 | 8 | 5 | 3 |

- A gold edition is worth **double its rarity**, which is the same rule the
  melt-down at the close already uses.

## 2. Where each one falls

| | Free | Paid |
|---|---|---|
| **Verde · Amarillo · Rosa** | the repeatable dungeon, the daily chest, the pass's free track | — |
| **Azul · Púrpura · Dorado** | — | the daily chest's paid track, the pass's paid column, the store's pack shelf |
| **Bronce · Silver · Gold** | the vault, for stars | the vault, for stars |

**The vault is the free player's only route to the high rarities**, and §4
measures exactly how much that matters.

### 2.1 The free 200, and where they come from

| Source | Rate | Packs a season |
|---|---|---|
| **The daily chest** | one a day, cycling Verde → Amarillo → Rosa | **28** |
| **The pass's free track** | one on every other rung, 14 rungs | **7** |
| **The repeatable dungeon** | one per run | **165** |
| | | **200** |

- **The dungeon is the engine, and that is deliberate.** The chest and the pass
  are clocks: they pay the same whether the player plays for two minutes or two
  hours. The dungeon is the only one of the three that answers *playing more*,
  so it carries five sixths of the faucet.
- **The five authored ruins cannot do this.** They hold 15 depths between them
  and they clear **once** — 15 packs in the lifetime of an account, not 15 a
  season. Everything in §4 therefore depends on the repeatable dungeon, which
  is designed and unbuilt
  ([`../implementation-plan.md`](../implementation-plan.md) §4). **OQ-102.**

### 2.2 What a repeatable run has to look like

165 packs a season is the requirement; the shape that delivers them is a
choice, and **one pack per authored-sized depth is not playable**:

| Packs a run | Rooms a run | Runs a day | **Fights a day** | Gold a season |
|---|---|---|---|---|
| 1 | 12 *(an authored depth)* | 5.9 | **71** | 78,870 |
| 1 | 5 | 5.9 | 29 | 32,862 |
| 2 | 8 | 2.9 | 24 | 26,290 |
| **3** | **5** | **2.0** | **10** | **10,954** |
| 5 | 10 | 1.2 | 12 | 13,145 |

- **A run should be SHORT and pay SEVERAL packs.** At an authored depth's
  twelve rooms and one pack, the faucet asks for **71 fights a day** and eats
  78,870 Gold a season — against a thirty-day harness that ends holding about
  113,000. That is not a session, it is a job.
- **The recommendation is three packs for a five-room run**: two runs a day,
  ten fights, and about 11,000 Gold of supplies a season. A run is then a
  ten-minute thing a player does twice, which is what a daily loop should feel
  like.
- **The repeatable dungeon's own numbers are now downstream of this.** How many
  rooms a run holds, what it charges in supplies and what else it pays are no
  longer free parameters: the collection needs 165 packs a season out of it,
  and that fixes the product of its run length and its frequency.

## 3. What a season costs

Measured over the eight albums (72 slots), opening the six packs evenly:

| | Packs |
|---|---|
| **To fill all 72 slots** | **158** |
| *(the same thing under the current model and today's five albums)* | *74* |
| Opening only Púrpura | 288 |
| Opening only Azul | 911 |
| Opening only Verde, Amarillo, Rosa or Dorado | never |

- **The free faucet is 200 packs a season** (§2.1) — Verde, Amarillo and Rosa
  from the repeatable dungeon, the daily chest and the pass's free track.
  Across 28 days that reads as **about seven a day**, which is what sized the
  season at four weeks rather than two (§3.1).
- A season deals **563 cards for 72 slots: 87% of everything opened is a
  duplicate**, worth **7,590 stars** if none are spent.

### 3.1 Why the season is four weeks

- **200 free packs is the number; the length follows from it.** Seven packs a
  day reads as a habit; fourteen reads as a chore, and three reads as nothing
  happening.
- **Four weeks, not a calendar month.** 30 days is not a whole number of weeks,
  so each season would open two weekdays later than the last and the shared
  calendar would drift through the week — Monday, then Wednesday, then Friday.
  28 days opens every season on the same weekday for ever, which is what
  [`09-relics.md`](../features/09-relics.md) §3 asks for and what live-ops
  needs.
- **The clock no longer has to be short to be testable.** `?dev`'s **🗓 end
  season** walks the close, the melt-down and the next season's content in one
  click, so nothing about the prototype argues for a fortnight any more.

## 4. What a free player actually closes

Verde, Amarillo and Rosa only, cashing the vault as it fills:

| Free packs | A1 | A2 | A3 | **A4** | A5 | A6 | A7 | A8 | Albums |
|---|---|---|---|---|---|---|---|---|---|
| 60 | 91% | 84% | 62% | 18% | 0% | 0% | 0% | 0% | 2.6 |
| 120 | 100% | 100% | 100% | **61%** | 8% | 0% | 0% | 0% | 3.7 |
| **200 — the authored rate** | **100%** | **100%** | **100%** | **92%** | **15%** | 1% | 6% | 0% | **4.1** |
| 400 | 100% | 100% | 100% | 100% | 34% | 10% | 19% | 0% | 4.6 |

- **Three albums always, a fourth usually, a fifth almost never, and album 8
  never.** At the authored 200 that is **4.1 of 8**, against **OQ-88**'s target
  of two of five — proportionally better than today.
- **The vault is what buys album 4.** Without cashing it A4 sits at 30% even at
  200 packs; with it, 92%. The Bronce and Silver chests guarantee a 4★ and a
  5★, and that is the free player's only reliable source of either.
- **Doubling the faucet to 400 buys half an album.** The curve is flat past
  200, which is the other half of why 200 is the right number: more free packs
  mostly make more duplicates.

### 4.1 And what money adds on top of it

Starting from the same 200 free packs:

| Paid packs | Albums closed | A5 | A6 | A7 | A8 |
|---|---|---|---|---|---|
| **0** | **4.1** | 15% | 1% | 6% | 0% |
| 25 | 6.2 | 78% | 64% | 59% | 24% |
| 50 | 7.4 | 95% | 92% | 85% | 67% |
| 100 | 7.9 | 100% | 100% | 95% | 94% |
| 200 | 8.0 | 100% | 100% | 100% | 99% |

- **A free player gets exactly half the collection**, and the half they get is
  the bottom four rungs.
- **The first 25 paid packs are worth more than the next 175.** They buy two
  albums; the next 25 buy 1.2, the next 50 buy 0.5, and the next 100 buy 0.1.
  A curve that flattens that hard is a healthy one: the first purchase is the
  one that matters and there is very little left to sell a whale.
- **Album 8 is the paywall**, and it is a clean one — 0% free, 24% at 25 paid
  packs, 94% at 100.

## 5. The chest prices are right, and I was wrong about them

A chest **returns stars** when its contents duplicate, so its real price is
`cost − return`:

| Chest | Price | Returns | Margin | Real price |
|---|---|---|---|---|
| Bronce | 150 | 71.8 | ×2.09 | **78** |
| Silver | 250 | 179.9 | ×1.39 | **70** |
| Gold | 400 | 290.0 | ×1.38 | **110** |

- **No loop.** Every chest costs more than it gives back, which is the one
  thing that cannot be got wrong — a chest priced under its own return is a
  perpetual motion machine.
- **The margins are thin on Silver and Gold**, and they should stay thin: the
  free player's entire vault budget is about 11 cash-outs a season, and raising
  the prices to widen the margin costs them album 4. Simulated at 275 / 600 /
  750, a free player's A4 falls from 78% to 44%.

### 5.1 Bronce is dominated

| | Net stars per 4★-or-better card |
|---|---|
| **Bronce** | **76** |
| Silver | 32 |
| Gold | 37 |

Silver has a **higher sticker price and a lower real one** (70 against 78) and
delivers more than twice as much. Nobody should ever buy Bronce except a player
who cannot yet afford 250, and that window is thin. To match Silver it wants to
cost about **105**, not 150 — the one price here that is wrong.

### 5.2 The whale cashes the vault 107 times, and price cannot fix it

A player finishing the season cashes **107 Silver chests** for about 14 new
cards — **0.18 cards a chest**, and 107 reveal screens.

Raising the price, or escalating it per purchase, does not separate the two
players, because the free player's whole budget is 11 cash-outs and the
completionist's is 107:

| Price growth per purchase | Free: cash-outs / A4 | Completionist: cash-outs / A8 |
|---|---|---|
| flat | 11.6 / **78%** | 107.0 / 90% |
| ×1.05 | 7.7 / 68% | 24.5 / 84% |
| ×1.18 | 5.1 / 60% | 12.0 / 82% |

Every rung that throttles the whale takes album 4 off the free player.

- **The answer is not a price, it is a BATCH.** The problem is 107 screens, not
  107 chests, and the game already made this argument once: the ten-call exists
  because *"buying in bulk buys TIME, not a better price"*
  ([`10-heroes.md`](../features/10-heroes.md) §6.4). A ten-chest button fixes
  the whole of §5.2 without moving a single number.

## 6. What this decides for the rest of the collection

- **The deck is the eight albums.** The authored distribution — 18 · 16 · 12 ·
  10 · 8 · 5 · 3 — is exactly the eight albums' 72 slots, so a season runs all
  eight rather than drawing five of them.
- **The collection prize and the album cycle are paid content.** Both need all
  eight albums, and a free player closes three or four. That is a legitimate
  thing for them to be; it is not a pacing feature and should not be argued as
  one. **OQ-100.**
- **The rotation is what saves the free player's relic ladder.** Closing four
  albums a season against a FIXED pairing means four relics at level 8 after
  eight seasons and four at zero, for ever. Rotating the pairing one step a
  season gives them **all eight relics at about level 4** in the same time.
  **OQ-101** is no longer a nicety; it is what makes seven of the eight relics
  exist at all for anybody who does not buy packs.

## 7. What it would take

| Step | Where |
|---|---|
| `PackDef` becomes `{ cards, guarantees: Partial<Record<Rarity, number>>, weights: [7] }` — gold is a rarity in the distribution, not a separate coin | `data/definitions.ts` |
| `packCards()` deals guarantees first, then rolls the remainder on seven ways | `sim/collection.ts` |
| The `Packs` sheet: seven guarantee columns and seven weight columns, replacing five weights + `gold_chance` + `gold_guaranteed` | `balance.xlsx`, `scripts/balance.mjs` |
| Nine pack ids, and a `source` for each — free, paid, or vault | the sheet |
| `starsFor` reads the authored ladder rather than `starsPerRarity × goldMultiplier` | `sim/collection.ts` |
| Three vault thresholds instead of two, and a ten-chest batch | `sim/collection.ts`, `ui/collectionSheet.ts` |

- **The rng is the thing to be careful with.** A pack's cards are rolled by
  hash on the pack's own id, and the roll order is part of that hash — so
  changing how many rolls a pack makes changes every pack's contents. Fine
  before launch, and a migration after it.

## 8. Deliberately not in this proposal

- **A pack that cannot reach a rarity at all.** Walls make albums impossible;
  odds make them expensive.
- **A chest priced under its own duplicate return.**
- **An escalating chest price**, which taxes the free player to throttle the
  whale (§5.2).
- **Selling Bronce, Silver or Gold for Gems.** They are what duplicates are
  for; a Gem price would retire the vault.
- **Selling Verde, Amarillo or Rosa.** They are the ruins' faucet, and selling
  them back is the line [`09-relics.md`](../features/09-relics.md) §6 already
  draws.

**Open questions:** OQ-88, OQ-100, OQ-101 in
[`../open-questions.md`](../open-questions.md).
