# Proposal — relics found, restored, hosted and traded

> **What this is.** Relics stop being levelled by a 28-day card season. Each
> relic is an object of the old kingdom, broken into **fragments** that the
> fog, the lairs, the dungeons and the world hand back. A restored relic is an
> item in the **inventory** ([`inventory.md`](inventory.md)), and it does
> nothing until it is **hosted**: a **city relic** in a **Shrine** in the
> province, a **world relic** in a **Chapel** on a world district. A hosted
> relic has a **passive** over its host's area and an **active** cast there
> with Mana. Fragments are traded between the six players of a board, and
> every few weeks an **Excavation** on the board adds a new relic. 
> **Status: built, differently in places.** The live design is
> [`../features/09-relics.md`](../features/09-relics.md): a level takes a full
> set of six and Stardust, Shrines add no Mana or Harmony, and trading is the
> friends' wish board. Not built: the Excavation (§8), replicas, gilding and
> Dowser's maps.
>
> **It replaces** the season, the albums, the cards, the packs, the stars and
> the vault, the wildcards, the lap, the melt-down and the collection prize
> ([`../features/09-relics.md`](../features/09-relics.md) §3–§11), the
> kingdom-wide passives (§2 there), and the Reliquary tab. **It keeps** a
> relic as one idea with one number and no ceiling, and the active as a zone
> paid in Mana (§2.1 there).

## 1. The rules, up front

1. **A relic is six fragments**: five **pieces** and one **keystone**.
2. **Fragments are found, not opened.** They drop where the game already pays.
3. **The first fragment of every relic is found by play.** Nothing sells a
   relic the player has not met.
4. **Six distinct fragments restore it** at level 1; **spare fragments level
   it**, with no ceiling.
5. **A relic is either a city relic or a world relic.** A city relic is
   hosted only in a Shrine, a world relic only in a Chapel.
6. **An unhosted relic does nothing.** Hosts are scarce, so which relics are
   hosted, and where, is the decision.
7. **A relic is never lost.** When a host's hex is taken, the relic goes back
   to the inventory.
8. **Only found fragments can be sent.** Bought fragments are bound.
9. **Nothing expires.** No season, no wipe, no melt-down.

## 2. Fragments

| | Piece | Keystone |
|---|---|---|
| Per relic | 5 | 1 |
| Drop weight | common | rare (`keystoneShare`) |
| Worth as a spare | 1 | `keystoneWorth` |

- **Sources:** fog treasures, lairs, landmarks, dungeon rooms and bosses,
  world districts' stores, the Excavation.
- **A source names its families**: a fog treasure rolls city relics, a
  dungeon or a world hex rolls world relics. Which relic belongs to which
  source is data.
- **Rolled by counter/hash** on the event that paid it.
- A relic not yet met is never rolled until its first fragment is found by
  play — one authored door per relic, placed in `?dev=data#map`.
- Fragments are inventory items ([`inventory.md`](inventory.md) §2).

## 3. The seat's relics

- **Every seat on a world board is dealt relic families**, as it is dealt a
  precious material ([`../features/19-world-map.md`](../features/19-world-map.md)
  §7.4): two seats share each family.
- **A seat's wedge drops its families** at `seatShare`; the rest of the board
  drops any family evenly. The province drops every city family evenly.
- So every player is rich in some relics and short of others: the reason to
  trade (§7).

## 4. Restoring and levelling

- In the inventory's **Relics** tab: one card per relic met, its six slots,
  its spares, its level.
- **Restore** spends six distinct fragments: the relic at level 1.
- **Level up** spends spares: `levelCost(level)`, rising.
- **The gilded restoration** is a cosmetic finish on a restored relic.

## 5. The hosts

### 5.1 The Shrine — city relics

- **Found, not bought.** The province's shrine sites are ruins in the fog,
  authored in `?dev=data#map`. A revealed ruin is **repaired** like an
  abandoned building ([`../features/01-map-and-fog.md`](../features/01-map-and-fog.md))
  and becomes a Shrine.
- **A Shrine is a building**: 2×2, **movable** like any building
  ([`../features/05-city-and-districts.md`](../features/05-city-and-districts.md)
  §4.2), no crew, no store.
- Each Shrine **holds one city relic**, swapped from its card, free.
- Each Shrine adds **+10 max Mana** (what a claimed landmark adds today) and
  supplies **Harmony** (`harmonySupply`); the Harmony decoration called Shrine
  ([`../features/21-harmony.md`](../features/21-harmony.md) §2) is this
  building.
- **Its aura** is every cell within `shrineRadius(level)` (Chebyshev, like an
  area of influence). Levels are bought with Gold and goods, `shrineMaxLevel`.
- **The premium Shrine**: `premiumShrines` more, built anywhere with Gems.
  Breadth, like a builder; never a relic.

### 5.2 The Chapel — world relics

- **An upgrade built into a district that stands**
  ([`../features/19-world-map.md`](../features/19-world-map.md) §7.2), with
  Gold and a builder's time, like the Fortress. A district may carry both.
- Each Chapel **holds one world relic**.
- **Its area** is its own hex and the six around it — the shape a Fortress
  covers.
- **How many**: `chapelsPerHexes` — one per so many hexes held, plus one.
- **A Sanctuary district comes with a Chapel** that does not count.
- **Server state.** Everything a world relic moves is resolved by the world
  server, inside `handleWorld`.

### 5.3 Losing the hex

- A **conquest** hands the Chapel to the conqueror, empty; a **denial**
  leaves it standing, empty.
- **The relic goes back to its owner's inventory** either way, at its level.
- A Chapel's relic is visible to every player on the board.
- When a world season ends (**OQ-3**), every hosted world relic goes home.

### 5.4 Overlap

- Where two areas of the same relic overlap, **the stronger counts**. They
  never add.

## 6. The relics

**A passive** must: work on its own over time; improve an effect or hold a
constant one while hosted; act on its host's area; and act on things that
stay where they are, so placing a host is a layout decision, never a chase.
One effect, one number, rising with the level.

| Relic | Kind | Passive over the area | Active, cast on the area for Mana |
|---|---|---|---|
| **Dowsing Rod** | city | resource nodes **recover +X%** faster | **Divining** — every tired node wakes at once |
| **Gilded Ledger** | city | houses **pay +X%** rent | **Tithe** — pulls rent forward from every house, over and over |
| **Foreman's Sigil** | city | harvest crews **work and walk +X%** faster (not workshop crews) | **Haste** — crews work much faster for a window |
| **Verdant Seal** | city | workshop items **progress +X%** faster | **Rush of Sap** — workshops in the aura finish `X` minutes of work at once |
| **Bailiff's Tally** | world | districts **produce +X%** into their stores | **Levy** — every district store in the area fills by `X` hours |
| **Muster Horn** | world | garrisons **defend at +X%** strength | **Rally** — garrisons in the area fight at much more for a window |
| **Wanderer's Compass** | world | armies and explorers **march +X%** faster through the area | **Forced March** — the next march out of the area arrives at once |
| **Delver's Lantern** | world | a dungeon in the area **seeps Stardust and Hero XP** into the Chapel's store, by the hour | **Lamplight** — the next rooms of that dungeon pay double |

- **The active is cast on the host's area.** Moving a Shrine **ends** an
  active running in it; the cooldown keeps counting.
- **Mana on the world**: a world relic's active is paid from the same pool.
  It is the first thing on the world that costs Mana
  ([`../features/08-magic.md`](../features/08-magic.md) §3).
- **The Lantern's store** is a district store
  ([`../features/19-world-map.md`](../features/19-world-map.md) §7.3): it is
  collected by a tap and goes with the hex.
- The numbers are each relic's level curve in `artifacts`.

## 7. Trading

- **An envoy carries one fragment** to another player's city on the board,
  marching on the board's clock, and lands in the receiver's inventory.
- **One envoy at a time**, `sendsPerDay` sends a day; receiving is not capped.
- **The wanted board**: each player pins up to `wantedSlots` missing
  fragments; the board's six see them.
- **A send is a gift, one way.** No swap, no offer, no market.
- Bound fragments cannot be sent (rule 8).
- A server mutation on the model of daily help
  ([`../features/15-social.md`](../features/15-social.md) §3).

## 8. The Excavation

A live-ops event: a buried site opens on the board and gives up a **new
relic**.

- **The site is a fog island** ([`../features/13-events.md`](../features/13-events.md)
  §2.3) shared by the board's six: a cell dug by anyone is dug for all.
- **Digging spends tools**, earned by the core loop at the rates of
  `13-events.md` §2.2.
- **Three ladders:**

| Ladder | Counts | Pays |
|---|---|---|
| **The board's bar** | cells dug by all six | threshold rewards to everyone who dug |
| **The personal track** | cells dug by the player | free: the new relic's fragments, **the whole relic** at the last step · paid: more fragments, tools, Gems |
| **The ranking** | cells dug, among the six | titles and cosmetics — no power |

- **Ends when dug out, or after `excavationMaxDays`.** A new site every
  `excavationEvery` weeks.
- **Never exclusive**: afterwards the relic's fragments join the drop tables.
- **Sold:** the Excavation pass ($4.99) and tool packs.

## 9. What is sold

| Moment | Product | Family | Price | Free path |
|---|---|---|---|---|
| *I know it exists, not where* | **Dowser's map** — marks the cell of the next fragment of a chosen relic. Never reveals | Exploration | 300 Gems | a rewarded video a day; landmarks and quests |
| *One piece is missing* | **Replica** — forges it from spares plus Gems, offered on the relic's card | Power | 3 spares + 1,000 / 3,000 Gems | `replicaFreeSpares` spares, no Gems; a gift |
| *I want this relic higher* | **Restorer's chest** — `chestSize` fragments of a chosen restored relic, **published odds** | Power (chance) | 900 Gems | the drops |
| *I want another host* | **The premium Shrine** | Breadth | Gems, once each | the shrine ruins |
| *I want more trades* | a second and third envoy | Breadth | 2,500 Gems each | one envoy |
| *I want to show it* | Shrine finishes, gilded restorations | Cosmetic | $2.99 a set | — |

- **The deep sink is the level.** Levels have no ceiling and cost more
  spares; the Restorer's chest sells spares of the relic the player chose.
- **Chapels are never sold.** The world is where players meet.
- Consumables are [`inventory.md`](inventory.md) §5.

## 10. What changes elsewhere

| Where | Today | With this |
|---|---|---|
| `09-relics.md` | seasons, albums, packs; every relic on everywhere | this proposal |
| `08-magic.md` §3 | *every relic the player has is on* | only hosted relics act; a world active costs Mana |
| `08-magic.md` §5, `01-map-and-fog.md` | shrine landmarks claimed in place for +10 max Mana | shrine sites are ruins, repaired into movable Shrines that keep the +10 |
| `21-harmony.md` | the Shrine decoration, built at TH9 for 600,000 Gold | no longer built: every repaired or premium Shrine supplies its Harmony |
| `19-world-map.md` §7.2 | the Fortress is the only upgrade | the Chapel is the second |
| The nav | a Relics tab | the inventory |
| Season pass, the Survey, quests | card packs | fragments, maps, consumables |
| Card bundles | packs and wildcards | removed |
| Gem faucet | 2,000 an album, 25,000 a season | Gems on each first restoration and on the Excavation's bar |

## 11. Dials, in the order to reach for them

| Dial | Start | Moves |
|---|---|---|
| `levelCost(level)` | 2, +1 every 2 levels | the depth of the sink |
| `shrineRadius(level)` | 2, 3 at level 3, 4 at level 5 | how much of a city one relic reaches |
| `chapelsPerHexes` | 1 + 1 per 6 hexes held | how many world relics act |
| `premiumShrines` | 4 | the breadth sold |
| `keystoneShare` | 1 in 8 | how long the last fragment takes |
| `seatShare` | 60% | how much trading matters |
| `sendsPerDay` | 3 | how fast gifts move |
| `chestSize` | 5 | what a chest is worth |
| `replicaFreeSpares` | 6 piece · 12 keystone | the free player's last-piece wait |
| `excavationEvery` | 4 weeks | the live-ops cadence |
| `excavationMaxDays` | 14 | the site's fallback close |
| `wantedSlots` | 3 | how much a player can ask for |
| `keystoneWorth` | 3 | a keystone spare in levels |

## 12. Open questions

To add to [`../open-questions.md`](../open-questions.md):

- **Shrines**: one site in the province, four premium — five in all.
- **The Gem faucet's total** once the albums' Gems are gone.
- **Do relics carry to a new board** — they should; the Chapels do not.
- **Does a dungeon's relic family follow the dungeon or the seat?**
- **The level curves** of the four new passives.

## 13. Deliberately not in this design

- A season, a wipe, a melt-down, a lap.
- Cards, albums, packs opened in a reveal screen.
- Stars, the vault, wildcards, gold editions.
- A relic active everywhere; a relic in two hosts.
- Areas that add up where they overlap.
- A relic taken by another player.
- A Chapel sold for Gems.
- A fragment in a chest that waits to be opened.
- Swaps, offers, a market, a price set by players.
- Sending a bought fragment.
- A relic sold whole.
- Power from the Excavation's ranking.
