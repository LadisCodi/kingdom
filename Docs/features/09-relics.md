# 9 · Relics and the collection

> **Scope.** The five relics as permanent kingdom passives with no ceiling,
> and the **collection** that levels them: a 30-day season of ten card albums,
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
- **A relic is unlocked and levelled by completing its albums** (§4). The
  first album ever completed for a relic hands it over at level 1; every album
  completed after that adds a level.
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
  `Artifacts` sheet. `per_level` is sized to be **felt on a headline number**
  — of the order of +10% a level on the Ledger — not to be safe.
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
- A season is **content**: which ten albums it holds, which relic each one
  levels, the season hero, and its dates. It lives in a hand-written seasons
  file beside the events file ([`13-events.md`](13-events.md) §1); every
  number in it — Gems, hours, stars, odds — lives on the `Collection` sheet.
- **At the close, the cards and the stars are wiped.** Relic levels stay. So
  do the keys, the resources and the Gems the albums paid. Nothing else
  crosses the boundary, so hoarding is pointless and a spare card is a spare
  card.
- The next season opens the moment the last one closes, with the same ten
  albums — the same 90 cards behind a new season frame and name. New card art
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

- A season holds **ten albums of nine cards**, two per relic. Each card
  belongs to exactly one album.
- **Completing an album is done once a season.** A ninth card lands, the album
  pays (§5), and it is marked complete; further copies are duplicates.
- Every card carries a **rarity**: **1★ to 5★**, plus **gold** editions of
  4★ and 5★. Which rarities each of the nine slots carries is authored per
  album, and albums are ordered from easy to hard: the first albums hold 1★
  to 3★, the middle ones bring 4★ and its gold, the last two bring 5★ and its
  gold.
- **Gold cards are what the last albums turn on.** They fall only from the
  best packs (§6), they cannot be sent (§8), and no wildcard stands in for
  them (§9).
- Cards drop for every album from the first pack, so an unstarted relic is a
  page filling up, not a locked box.

## 5. What an album pays

Three things, on the ninth card, in one sheet:

| | What | Why |
|---|---|---|
| **The relic** | its first album ever: the relic, at level 1. Any album after: **+1 level**, for ever | the permanent layer — the one the season leaves behind |
| **A chest of production** | **N hours of everything the city makes right now**, at the album's band | priced in production, so it is the same fraction of a day at every stage and spent as fast as it lands |
| **Keys and Gems** | silver keys on the early albums, gold on the late ones; **1,000 Gems each, 10,000 across the ten** | the spike that feeds the other collection |

- The hours are banded: the easy albums pay a morning, the hard ones the whole
  offline cap and never more — a chest that outpays a night's sleep would make
  the night look small.
- **Completing all ten pays the collection prize**: a **golden call that is
  guaranteed to be the season hero** (§10) and **25,000 Gems**. The prize is
  dealt in the gacha reveal screen, which is the most exciting screen the game
  has and the right place for the last card to lead.
- A relic level is not exciting on its own and is not meant to be. The chest
  and the keys sell the pack today; the level is why a player who has done
  three seasons has a kingdom no new player can buy.

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
- The pace to author against is **how many albums a player who buys nothing
  completes in 30 days**. That number, not the price of a pack, is what
  decides whether the collection sells or stalls.
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
- **There is no gold wildcard.** The last slot of the last album is earned or
  sent — never bought outright.
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

Two levels behind one nav tab, plus the reveal the gacha already owns.

### 11.1 The Collection

- A header with the **season's name, its frame, and the time left**. The
  countdown derives from the close timestamp.
- The **stars** count and the vault's next threshold on one line; tapping it
  opens the vault.
- **The ten albums, two to a row**, in season order: the album's art, its
  name, `7/9`, and the relic it levels as a small badge. A completed album
  reads as a gold tile with a tick; an album one card short says which.
- A **relics strip** above the albums — five tiles, level on each, unfound
  ones in silhouette with *Album 3* under them as a signpost. Tapping one
  opens the relic's card: art, name, level, the effect at this level and at
  the next.

### 11.2 An album

- The **3×3 grid**: each slot shows the card or its silhouette, its rarity
  as stars — gold slots framed gold — and its duplicate count as `×3`.
- A **duplicate can be tapped**: *Send* (three left today) or *To the vault*
  (its stars). A gold duplicate offers only the vault.
- A **missing card** can be tapped: what packs it falls from, and the wildcard
  offer if one covers it.
- The album's three rewards are printed under the grid before it completes
  and struck through after.

### 11.3 Opening a pack

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
| Albums a season · cards an album | **10 · 9, fixed** | seasons file |
| Albums per relic | **2, fixed** | seasons file |
| Gems an album pays · the collection prize | **1,000 each, 25,000 at the end, fixed** | `collection.album_gems`, `collection.prize_gems` |
| Sends a day | **3, fixed**; gold never | `collection.sends_per_day` |
| A relic's `base` and `per_level` | per relic | `Artifacts` sheet |
| Production hours an album pays, by band | 2 h · 4 h · 8 h | `collection.album_hours_*` |
| Keys an album pays, by band | 1 silver · 1 silver · 1 gold | `collection.album_keys_*` |
| Rarity per slot, per album | authored | seasons file |
| Pack tiers — cards, rarity range, odds | §6 | `Packs` sheet |
| Stars a duplicate is worth | 1 · 2 · 5 · 10 · 25, gold ×2 | `collection.stars_*` |
| Vault thresholds | 50 → Gold, 200 → Star | `collection.vault_*` |
| Free albums a season, target | **the pacing number — OQ-88** | derived, not authored |
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
- **Selling a card.** Packs, and a wildcard that never covers gold.
- **A season-exclusive hero.** Associated: rated up now, in the pool for ever.
- **New card art every season** as a requirement.
- **Trading as a swap**, with offers or negotiation.
- **A duplicate melted into a currency.** Stars are a counter in this screen.
- Random stat rolls, standalone equipment, duplicate fusion.

**Open questions:** OQ-88, OQ-89, OQ-90, OQ-91 in
[`../open-questions.md`](../open-questions.md).
