# 9 · Relics and the collection

> **Scope.** The five relics as permanent kingdom passives with no ceiling,
> and the **collection** that levels them: a 30-day season of five card albums,
> the packs the cards come in, duplicates, the vault, trading, wildcards, and
> the season hero. Heroes are [`10-heroes.md`](10-heroes.md); the ruins the
> packs fall from are [`11-expeditions.md`](11-expeditions.md).
>
> **Status: designed 2026-09-09, not built.** The build still carries the
> previous model — five relics found at the bottom of a ruin, attunement
> slots, Stardust levels and a Fragments tier gate — and every one of those is
> replaced by this document. The rework is sequenced in
> [`../implementation-plan.md`](../implementation-plan.md) §4.

## 1. The model

- A relic is a **permanent kingdom passive**: one effect, one number, and the
  number rises with the relic's **level**. There is no ceiling.
- **Every relic the player has is always on.** Nothing is worn, socketed or
  swapped, and nothing carries one anywhere.
- **A relic is unlocked and levelled by completing its album** (§4). Each
  relic has **exactly one album, the same one every season**. The first season
  a player completes it, the relic arrives at level 1; every season after,
  **+1 level**. A relic rises at most one level a season, and only by its own
  album.
- The relic itself never drops. Ruins pay **card packs** (§6), not relics.
- A relic has no active. Abilities are spells, nodes in the Magic tome
  ([`07-research.md`](07-research.md) §6). **A relic is what the kingdom has;
  a spell is what the player knows.**
- The **Collection** tab replaces the Relics tab in the nav. It is hidden
  until the player holds a card, and appears the moment they open their first
  pack.

## 2. The five relics

Every effect is a number that grows without a ceiling — a speed or a yield,
never a discount, because a discount dies at 100%.

| Relic | Effect | Moves |
|---|---|---|
| **Dowsing Rod** | in-place recovery **+X% faster** — Forest, Crops, Stone and the two mountains | `recoverySeconds` ([`04-harvest.md`](04-harvest.md) §2) |
| **Verdant Seal** | respawn **+X% faster** — berries, game and shoals | `respawnSeconds` ([`04-harvest.md`](04-harvest.md) §3) |
| **Foreman's Sigil** | worker yield **+X** | `workerYield` |
| **Gilded Ledger** | tax rate **+X%** | `taxRate` |
| **Wanderer's Compass** | Stardust from rooms **+X%** | `stardustYield` |

- `X = base + per_level × (level − 1)`, both authored per relic on the
  `Artifacts` sheet. A level is **a season's worth of growth**, so `per_level`
  is sized to be **felt on a headline number** — of the order of +10% a level
  on the Ledger — not to be safe.
- The Rod and the Seal split the two harvest clocks between them: what grows
  back in place and what reappears elsewhere are different numbers, and one
  relic moves each.
- The effect is a **modifier at the base stage**, resolved where the number is
  owned. A relic level is not a technology and never expires.

## 3. The season

- The collection runs in **seasons of 30 days, on a shared calendar.** Every
  player is in the same season at the same time; the season does not start
  when a player does, and a player who arrives on day 25 has five days, like
  everyone else.
- A season is **content**: its name, its frame, its dates, the rarity each
  album's nine slots carry, and the season hero. **Which relic each album
  levels is not per-season content** — it is one album per relic, in the same
  order, for ever. It lives in a hand-written seasons file beside the events
  file ([`13-events.md`](13-events.md) §1); every number in it — Gems, hours,
  stars, odds — lives on the `Collection` sheet.
- **At the close, the cards and the stars are wiped.** Relic levels stay. So
  do the keys, the resources and the Gems the albums paid. Nothing else
  crosses the boundary, so hoarding is pointless and a spare card is a spare
  card.
- The next season opens the moment the last one closes, with the same five
  albums — the same 45 cards behind a new season frame and name. New card art
  is a decision a season may take, never a requirement.
- The close is a **timer**, not production: it resolves in the uncapped tail
  of the offline advance, at its absolute timestamp. A player away for a week
  comes back to the wiped album and the new season, and to whatever their
  albums had already paid.
- This is a different clock from the daily chest's 20-day season
  ([`12-quests.md`](12-quests.md) §3), which counts from the player's own
  first day. Both keep the word: the chest's is *your* season, the
  collection's is *the* season.

## 4. The albums and the cards

- A season holds **five albums of nine cards — one per relic**. Each card
  belongs to exactly one album, and each album to exactly one relic:

| # | Album | Levels | Rarity |
|---|---|---|---|
| 1 | the harvest album | **Dowsing Rod** | 1★–2★ |
| 2 | the wilds album | **Verdant Seal** | 1★–3★ |
| 3 | the labour album | **Foreman's Sigil** | 2★–4★ |
| 4 | the coin album | **Gilded Ledger** | 3★–5★, gold |
| 5 | the stars album | **Wanderer's Compass** | 3★–5★, gold |

- **Completing an album is done once a season.** A ninth card lands, the album
  pays (§5), and it is marked complete; further copies are duplicates.
- Every card carries a **rarity**: **1★ to 5★**, plus **gold** editions of
  4★ and 5★. Which rarities each of the nine slots carries is authored per
  album, and the five are ordered from easy to hard: the first two hold 1★ to
  3★, the third brings 4★, and **the last two bring 5★ and the gold
  editions**.
- The order is the ladder of what a relic is worth. The two harvest clocks are
  the cheap levels a first-season player will actually close; the tax rate and
  the Stardust yield are behind the gold cards.
- **Gold cards are what the last two albums turn on.** They fall only from the
  best packs (§6), they cannot be sent (§8), and no wildcard stands in for
  them (§9).
- Cards drop for every album from the first pack, so an unstarted relic is a
  page filling up, not a locked box.

## 5. What an album pays

Three things, on the ninth card, in one sheet:

| | What | Why |
|---|---|---|
| **The relic** | the first season its album is completed: the relic, at level 1. Every season after: **+1 level**, for ever | the permanent layer — the one the season leaves behind |
| **A chest of production** | **N hours of everything the city makes right now**, at the album's band | priced in production, so it is the same fraction of a day at every stage and spent as fast as it lands |
| **Keys and Gems** | silver keys on the first three, gold on the last two; **2,000 Gems each, 10,000 across the five** | the spike that feeds the other collection |

- The hours are banded: the easy albums pay a morning, the hard ones the whole
  offline cap and never more — a chest that outpays a night's sleep would make
  the night look small.
- **Completing all five pays the collection prize**: a **golden call that is
  guaranteed to be the season hero** (§10) and **25,000 Gems**. The prize is
  dealt in the gacha reveal screen, which is the most exciting screen the game
  has and the right place for the last card to lead.
- A relic level is not exciting on its own and is not meant to be. The chest
  and the keys sell the pack today; the level is why a player who has done
  three seasons has a kingdom no new player can buy.
- **Nothing rushes one relic ahead of the others.** A relic's level is the
  count of seasons its album was completed, so three seasons closed in full is
  level 3 on all five, and a player's relic levels read their history.

## 6. Packs

Cards arrive only in **packs**. A pack has a tier, and the tier says how many
cards it holds and which rarities it can hold, at **published odds**.

| Tier | Cards | Can hold | Falls from |
|---|---|---|---|
| **Bronze** | 3 | 1★–2★ | every ruin room, the daily chest's free track, quests |
| **Silver** | 4 | 1★–3★ | a depth's boss, the weekly event track |
| **Gold** | 5 | 2★–4★, a chance of gold | the season pass's paid column, the Royal chest, the vault, store offers |
| **Star** | 6 | 3★–5★, **one gold guaranteed** | the collection's own late milestones, guild chests, store offers |

- **Ruins are the free faucet.** An ordinary room pays a Bronze pack beside
  its formula reward; a boss pays a Silver one in its authored chest
  ([`11-expeditions.md`](11-expeditions.md) §7). The five authored ruins
  clear once, so the faucet that renews every season is the **repeatable
  dungeon**, which is designed to follow ([`../implementation-plan.md`](../implementation-plan.md) §4). Until it lands, a player who has bottomed
  every ruin gets packs from the chest, the event, the pass and the store
  only. **OQ-88.**
- The pace to author against is **how many of the five a player who buys
  nothing completes in 30 days**. That number, not the price of a pack, is
  what decides whether the collection sells or stalls. **OQ-88.**
- Opening a pack uses the **gacha reveal** ([`10-heroes.md`](10-heroes.md)
  §8.3): the cards turn one by one, a new card says so, a duplicate shows its
  count. Skippable, never interrupted.
- A pack's cards are rolled by **hash on the pack's own id** — the season,
  the source and its ordinal — never on the moment it is opened, so an
  offline replay deals the same hand.

## 7. Duplicates and the vault

- Every duplicate is worth **stars**, by rarity. Stars are a counter inside
  the collection, shown nowhere else — the Fragments precedent, not a wallet
  row.
- The **vault** turns stars into packs at fixed thresholds: a Gold pack at
  the first, a Star pack at the last. Prices on the sheet.
- A duplicate is spent one of two ways — sent to a friend (§8) or left to the
  vault — and the vault is what makes a duplicate worth something to a player
  with nobody to send it to.
- **A season of 45 cards deals duplicates early**, so the vault is not a late
  screen: its first threshold is meant to be reached in the first week, and it
  is the second faucet a player without friends has.
- Stars are wiped with the cards at the close.

## 8. Trading

- Trading is **a gift, one way**: a player sends a card they hold to a friend,
  and it is gone from their album. There is no swap, no offer and no
  negotiation.
- **Three sends a day.** Receiving is not capped.
- **Gold cards cannot be sent.**
- The send is a server mutation on the model of daily help
  ([`15-social.md`](15-social.md) §3): idempotent, capped server-side, drained
  by the receiver at next load before the offline advance.
- Who a friend is, and what else the trade screen carries, is the social
  layer's question and open: **OQ-89**. Until it is built the collection
  stands on packs and the vault alone.

## 9. Wildcards

- A **wildcard** stands in for any card of its rarity or lower in any album.
  It is placed by the player, in the slot they choose, and consumed.
- **There is no gold wildcard.** The gold slots of the last two albums — the
  Ledger's and the Compass's — are earned or sent, never bought outright, so
  the two strongest relics are the two Gems cannot finish.
- Wildcards are **sold in offers**, aimed at the albums a player has nearly
  finished: an offer names the album, the missing count and a wildcard that
  covers it. They also sit on the season pass's paid column.
- A wildcard is the one targeted purchase in the collection, and it respects
  the line: the same card is in every Bronze pack the ruin pays.

## 10. The season hero

- Every season names one hero. During the season it is **rated up** on the
  golden banner; the collection prize is **a golden call guaranteed to be
  that hero** (§5).
- **Associated, not exclusive.** The hero is on the golden banner at its
  ordinary weight before, during and after; the season makes it easier to
  pull and, through the duplicates a rate-up brings, easier to ascend. Nothing
  about it expires.
- The rate-up is the timeline's existing **banner payload**
  ([`10-heroes.md`](10-heroes.md) §11), scheduled by the seasons file. The
  season is its first consumer.

## 11. The screens

A pill on the map, two levels behind one nav tab, a card, and the reveal the
gacha already owns. Mockups: M19–M22 in
[`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md) §7.19.

### 11.1 The season pill

- On the map, in the left column, **directly under the daily chest's pill**
  ([`12-quests.md`](12-quests.md) §3.4) — the two seasons sit together, and
  the collection's is the second thing a returning player reads.
- A parchment pill with the **season's crest**, its name, `12/45` cards and
  the time left. Tapping it opens the Collection.
- It **glows while a pack is unopened** and goes quiet once none is; it is
  never a badge with a count of things owed.
- **Hidden behind any sheet**, like every other pill, and absent entirely
  before the first card.

### 11.2 The Collection

- A header plate with the **season's name and its frame**, and under it a
  **prize band**: *Complete all five to win*, the golden call and **25,000
  Gems** as two chips. The band is the screen's lede — the prize is what the
  five albums are for.
- One line under the band: the **time left** and the season's total, `12/45`.
  The countdown derives from the close timestamp.
- **The five albums as round medallions, three to a row** — three, then two
  centred: the album's art in a carved ring, its name under it, an `x/9` pill
  under that, and **the relic it levels as a small badge on the ring** with
  its current level, in silhouette while the relic is unfound. A completed
  medallion is ringed gold with a wax tick, and an album one card short says
  so.
- **There is no separate relics strip.** One album per relic means the five
  medallions already are the five relics, and a strip above them would be the
  same list twice.
- The **vault** is a round knob at the bottom-right, the way a safe sits in
  the corner of the screen it belongs to: the **stars** count rides it, and
  tapping it opens the vault and its next threshold.

### 11.3 An album

- A **reward band across the top**: the relic's art in a frame at the left,
  *Complete the album to win*, and the three rewards as chips — **+1 level**
  on the relic (or the relic itself, padlocked, if it is unfound), the
  production chest's hours, and the keys and Gems. The chips are struck
  through once the album is complete.
- One album per relic means the album screen *is* the relic screen; the
  relic's frame in the band opens its card (§11.4).
- The **3×3 grid**: each slot shows the card or its silhouette, its **rarity
  as stars above the card** — gold slots framed gold — its name on a ribbon
  along the bottom, and a **`+N` corner tag** for the duplicates it holds.
- A **duplicate can be tapped**: *Send* (three left today) or *To the vault*
  (its stars). A gold duplicate offers only the vault.
- A **missing card** can be tapped: what packs it falls from, and the wildcard
  offer if one covers it.
- Under the grid, the album's own count — `Album 4 / 9` — and **arrows at the
  two bottom corners** that walk to the previous and the next album without
  going back up. Five albums is a short walk, and it is how a player checks
  what they are close to.

### 11.4 A relic's card

- Opened from the album's reward band or from a medallion's badge. The relic's
  art on a stage, its name, its **level with no *of*** — *Level 3*, because
  there is no cap — and the season's line: *+1 level when its album closes.*
- Two rows of the effect: **at this level** and **at the next**, the second in
  muted ink, so what a level is worth is the card's plainest fact.
- A line naming **its album and where that album stands**, `7/9`, which is
  also the way back to it.
- **The card has no buttons but the way out.** Nothing is attuned, cast,
  studied or removed (§13) — a relic is what the kingdom has, and reading it
  is all there is to do.

### 11.5 Opening a pack

- The reveal screen at z 100, one pack per opening, the cards dealt in
  rarity order and the best last. **New** on a first copy; the count on a
  duplicate. A completed album interrupts nothing: its sheet follows the
  reveal.

## 12. Dials, in the order to reach for them

Every number below is a **proposal until the sheet exists**; the ones marked
**fixed** were decided with the design.

| Dial | Value | Key |
|---|---|---|
| Season length | **30 days, fixed**, shared calendar | seasons file |
| Albums a season · cards an album | **5 · 9, fixed** | seasons file |
| Which relic each album levels | **one each, the same order every season, fixed** | seasons file |
| Gems an album pays · the collection prize | **2,000 each, 25,000 at the end, fixed** — 10,000 across the five, as before | `collection.album_gems`, `collection.prize_gems` |
| Sends a day | **3, fixed**; gold never | `collection.sends_per_day` |
| A relic's `base` and `per_level` | per relic | `Artifacts` sheet |
| Production hours an album pays | 2 h · 2 h · 4 h · 8 h · 8 h | `collection.album_hours_*` |
| Keys an album pays | silver · silver · silver · gold · gold | `collection.album_keys_*` |
| Rarity per slot, per album | authored | seasons file |
| Pack tiers — cards, rarity range, odds | §6 | `Packs` sheet |
| Stars a duplicate is worth | 1 · 2 · 5 · 10 · 25, gold ×2 | `collection.stars_*` |
| Vault thresholds | 50 → Gold, 200 → Star | `collection.vault_*` |
| Free albums a season, target | **the pacing number — OQ-88**; two of five free, five for a Dolphin | derived, not authored |
| Season hero rate-up weight | — | `Banners.rate_up_weight` |

## 13. Deliberately not in this design

- **Attunement.** Slots, the swap lock, the Gem slot ladder and the
  `Attunement`-slot modifier stat. Every relic the player has is on.
- **Stardust on a relic.** Stardust keeps the hero ascension toll and nothing
  here.
- **Ingredients, the 3×3 tier grid, and Fragments as a relic gate.** The
  album is all three.
- **A relic from a ruin.** Ruins pay packs.
- **A level cap, or a tier.** A relic's level is one number with no top.
- **A discount as a relic effect.** Speeds and yields only.
- **An active on a relic**, or a relic carried into a fight.
- **A card that survives the season**, or an extension for a late arrival.
- **Two albums for one relic**, or an album that levels no relic. One relic,
  one album, one level a season — the relic strip, the badge and the signpost
  all collapse into the five rows because of it.
- **Levelling one relic twice in a season.** A wildcard, a gift and the vault
  all buy the same single level faster; none of them buys a second.
- **Selling a card.** Packs, and a wildcard that never covers gold.
- **A season-exclusive hero.** Associated: rated up now, in the pool for ever.
- **New card art every season** as a requirement.
- **Trading as a swap**, with offers or negotiation.
- **A duplicate melted into a currency.** Stars are a counter in this screen.
- Random stat rolls, standalone equipment, duplicate fusion.

**Open questions:** OQ-88, OQ-89, OQ-90, OQ-91 in
[`../open-questions.md`](../open-questions.md).
