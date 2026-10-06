# 9 · Relics and the collection

> **Scope.** The eight relics as permanent kingdom passives with no ceiling,
> and the **collection** that levels them: a 28-day season of eight card albums,
> the packs the cards come in, duplicates, the vault, trading, wildcards, and
> the season hero. Heroes are [`10-heroes.md`](10-heroes.md); where the packs
> come from is §6.
>
> **Status: built** — the eight relics and their passives and actives, the
> nine packs and the vault's three chests, eight albums with a rotating relic
> pairing, the lap, the season and its melt-down, the payouts, the collection
> prize, the stars, the wildcards and their aimed offers, the close, and the
> screens of §11. Not built: **trading** (§8 — it waits on the social layer,
> OQ-89) and the **season hero's rate-up** (§10 — it waits on a banner
> payload in the timeline).
>
> **The free faucet is short of its target** — **OQ-102**.
>
> **The season is 28 days — four weeks**, sized so the free faucet of ~200
> packs reads as about seven a day
> ([`../proposals/collection-packs.md`](../proposals/collection-packs.md)), and
> the seasons **cycle**. `?dev`'s **🗓 end season** watches a close, a
> melt-down and the next season open without the wait, which is why the clock
> no longer has to be short to be testable.
>
> The store's three **card bundles** (§6.1) are built with them.
>
> The 72 card faces are painted, one 3×3 sheet per album.

## 1. The model

- A relic is a **permanent kingdom passive**: one effect, one number, and the
  number rises with the relic's **level**. There is no ceiling.
- **A relic is hosted, never worn.** A city relic acts from a Shrine while
  activated, a world relic from a Chapel; nothing carries one anywhere.
- **A relic is unlocked and levelled by completing its album** (§4). The
  first time a player closes it, the relic arrives at level 1; every close
  after, **+1 level**. Which album levels which relic **rotates a step a
  season** (§4), so eight seasons put every relic on every rung of the
  difficulty ladder exactly once.
- **A relic can rise more than once a season**, because the eight albums run
  in **laps** (§5.1) — but never ahead of the others: an album cannot close a
  second time until all eight have closed once.
- The relic itself never drops. Ruins pay **card packs** (§6), not relics.
- **A city relic is activated** (§2.1): hosted in a Shrine, it does nothing
  until the player pays its Mana; then its effect reaches the Shrine's aura
  for the Shrine's window. A world relic acts while a Chapel holds it, and
  two carry a spell (§2.2). The Magic tome holds no spells
  ([`07-research.md`](07-research.md) §6).
- The nav tab is **Relics** (§11.2). It is padlocked until the player holds
  a pack or a card.

## 2. The eight relics

Every effect is a number that grows without a ceiling — a speed or a yield,
never a discount, because a discount dies at 100%.

| Relic | Effect | Moves |
|---|---|---|
| **Staff of Renewal** | in-place recovery **+X% faster** — Forest, Crops, Stone and the two mountains | `recoverySpeed`, which `effectiveRecoveryMs` **divides** by |
| **Sickle of Plenty** | **natural resources +X%** (what a node holds) and **extraction speed +X%** (what a swing takes) | `harvestStock` and `harvestUnitsPerStrike`, both multipliers |
| **The Winged Hammer** | crews **swing and walk +X% faster** | `workerStrikeSpeed` and `workerSpeed` |
| **The Tribute Crown** | tax rate **+X%** | `taxRate` |
| **The Stargazer's Orb** | Stardust from rooms **+X%** | `stardustYield` |
| **The Wisp Lantern** | a room's **Gold and Stone +X%** | `roomHaul` |
| **Warhorn of the Host** | the army the halls field **+X%** | `armyCap` |
| **The Steward's Signet** | every world-map improvement's hourly grant **+X%** | `worldImprovementYield` — **not read yet** |

- **Five are the city's and three are the pillars outside it** — the dungeon,
  the war and the world map.
- **Three move nothing today** (**OQ-113**): the Orb's passive and the
  Lantern's passive and Lamplight act on rooms that no longer read them.
- **The Lantern takes a room's MATERIAL half only.** Its Stardust is the
  Orb's and its Hero XP is a legendary's boon; three permanent layers on
  one number would be unreadable.
- **A relic whose system does not exist yet says so on its card**, in muted
  ink with the reason, and its level accrues normally against the day it lands.
- **A relic may move more than one number with one value.** The Sickle's two and
  the Hammer's two are one idea each: half of either saturates or reads as
  nothing — a bigger swing empties a node it cannot exceed, and a crew that
  swung faster and walked at the old pace would be half a relic.

### 2.1 Activation — the city relics

- **Hosting is free; activating costs Mana.** A city relic in a Shrine sleeps
  until the player activates it. Then its effect reaches every cell of the
  Shrine's aura for a window.
- **The relic's level is the POWER**: its number (`X` below) and its reach.
  The aura is the Shrine's cell and **`activeRadius` cells round it**
  (Chebyshev), plus **one ring at relic levels 5, 10 and 20**.
- **The Shrine's level is the DURATION**: **5 min · 30 min · 1 h · 4 h · 8 h**
  at levels 1 to 5. A top Shrine covers a night away.
- **One activation, one price**: `activeManaCost` per relic (**20** on all
  four), whatever the window. A higher Shrine is more minutes for the same
  Mana.
- **No cooldown and no stacking.** It can be activated again the moment the
  window closes, never while it is open.
- **The window is priced when it opens.** A Shrine that climbs mid-window
  does not stretch it.
- **The window survives everything but leaving the Shrine.** It runs while
  the player is away and through a save; it follows a Shrine that is moved.
  Taking the relic out, or hosting it elsewhere, ends it.
- **The close is a boundary**: offline replay ends it at the same instant as
  live ticking, and rent inside the aura is repriced there.
- **On screen** (mockups M80–M85):
  - **Every fragment has its own art**: a broken piece of that relic, the
    keystone its heart in a gold rim (`<sprite>_frag<slot>`). A held slot
    shows its piece; a missing one, the piece's silhouette in chalk.
  - The Bag's card says where the relic stands: **Awake · 52m**, **Asleep**
    with its own Activate, **In the Bag**, or its fragments as a silhouette.
  - **A Shrine has no effect of its own** — no Harmony, no Mana: it holds a
    relic and wakes it.
  - The Shrine's card holds **one slot, drawn as a painting of the chapel
    inside** (the lair cards' 16:9 format): its altar's golden cradle
    carved with a **+** while it waits, the unlock splash's sunburst turning
    out of it (and the CTA on it when a relic in the Bag could go there), the relic set in it once placed. A tap opens the relic
    picker — the hero picker's flow: the restored city relics as cards, each
    with **what it does** (`+20% tax`) and the **Shrine mark** when it is
    already in one, the Shrine's slot under them, and **Select**. Selecting a
    relic that stands in another Shrine asks first — *Move it to this one?*
    Cancel / Move. Emptying the slot and selecting
    takes the relic out; closing changes nothing.
  - **On the Shrine's card everything sits on the painting**: the relic's name
    and effect on a dark band at the top, Activate (and, short of Mana, a
    flask) or the window's bar on the floor at the bottom.
  - The relic's sheet: a grey **Asleep** seal beside
    Activate, or an **Awake** ribbon and a gold bar running down the window.
    Short of the price, how soon the pool holds it, and the smallest Mana
    flask in the Bag.
  - On the map, an awake relic floats over its Shrine and the aura wears the
    zone's tint and wheel; a sleeping one rests dim on the altar under a
    bubble showing the relic **drained of colour, with resting Zs** — there,
    and off. A tap on the bubble, like a tap on the Shrine, opens its card
    and costs nothing; Activate there pays the Mana.
  - Houses an awake Crown pays, and buildings with crews an awake Hammer
    speeds, wear a **+X%** badge.
  - A wake sweeps a ring over the aura and floats **+30% tax · 1h**.
  - A window that closes raises a tab on the right edge — **The Tribute Crown
    is asleep** · Activate — one tab for all of them (*2 relics are asleep*).

### 2.2 The world relics' spells

Two world relics carry a spell, cast from the relic's card with Mana while a
Chapel holds it.

| Relic | Its spell | Cast on | Grows |
|---|---|---|---|
| **The Stargazer's Orb** | **Survey** — clears the fog around a cell you hold, free of Gold | a cell you hold | **radius** |
| **The Wisp Lantern** | **Lamplight** — the next rooms you clear pay double | nothing; it is lit and carried | **rooms** |

- **ACTIVE → COOLDOWN → READY**: a flat **5-minute** cooldown, counted from
  when the spell **closes**, that never moves with level.
- **`Survey` buys the GOLD, never the ladder.** The Townhall's reach still
  gates every cell, so the fog grows out of what the player holds.
- **Lamplight is counted in ROOMS, not minutes.** A charge cannot expire; the
  last one used is the close, and the cooldown counts from there. It is
  untargeted.
- **Radius steps** at levels 5, 10 and 20, one ring each, and stops there.
- The card shows the state, and the countdown derives from a timestamp.

- **Every passive keeps this rule**: a
  speed the call site divides by, a multiplier above 1, or a flat term on a
  base the data authors and never grows. Nothing falls, so no level is the
  last one worth having.
- **Nothing moves the respawn clock.** Berries, game and shoals come back on
  their authored time and the mechanic stays transparent to the player.
- `X = passiveBase + passivePerLevel × (level − 1)`, both authored per relic in
  `artifacts`. A level is **a season's worth of growth**, so `passivePerLevel`
  is sized to be **felt on a headline number** — of the order of +10% a level
  on the Crown — not to be safe.
- The Staff and the Sickle split the two harvest clocks between them: what grows
  back in place and what reappears elsewhere are different numbers, and one
  relic moves each.
- The effect is a **modifier at the base stage**, resolved where the number is
  owned. A relic level is not a technology and never expires.

## 3. The season

- The collection runs in **seasons of 28 days — four weeks — on a shared
  calendar.** Every
  player is in the same season at the same time; the season does not start
  when a player does, and a player who arrives on the last day has one day,
  like everyone else.
- The length is **a whole number of weeks**, so every season opens on the same
  weekday as the epoch.
- A season is **content**: its name, its frame, its dates and the season
  hero. It lives in a hand-written seasons file beside the events file
  ([`13-events.md`](13-events.md) §1); every number in it — Gems, hours,
  stars, odds — lives in the `collection` settings.
- **The eight albums and their cards are fixed**, and so is the difficulty
  ladder they climb (§4). **What rotates is which relic each album levels**,
  one step a season, because a fixed pairing on a fixed ladder would mean the
  relics behind the hardest albums never level for a player who does not buy
  packs. The album keeps its cards and their rarities; only the relic moves.
- **The seasons cycle.** The list is read in order and the last one is
  followed by the first again, for ever, so the calendar is never short of a
  season to open and shipping a new one is one more entry in the file. A
  season being repeated is the same 72 cards behind a frame and a name the
  player has seen before — which costs nothing, because the cards are wiped
  either way.
- **At the close, the UNSPENT cards melt into Gold and the stars are
  wiped.** A card an album spent when it closed (§5.1) is already gone. Relic
  levels stay, and so do the keys, the resources and the Gems the albums paid.
  Nothing else crosses the boundary, so hoarding is pointless and a spare card
  is a spare card.
- **What a card melts for is its rarity**, on the same stars ladder a
  duplicate is worth (§7) — a gold edition melts for double — and it is
  **priced in production**: so many seconds of the city's Gold income per
  star, with a floor under it, never a flat number that a late city would
  laugh at. **One copy of each card, never every copy**: a duplicate already
  paid its stars the day it landed.
- The melt-down is a **consolation, not a prize**. An album that ends on eight
  of nine leaves something behind; it never approaches what completing the
  album would have paid (§5).
- The next season opens the moment the last one closes, with the same eight
  albums — the same 72 cards behind a new season frame and name, and the relic
  pairing moved one step. New card art is a decision a season may take, never
  a requirement.
- The close is a **timer**: it resolves at its absolute timestamp inside the
  offline advance. A player away for a month
  comes back to the melted album and to **the season the calendar is in**, not
  to the one after the one they left — the season is a floor division from the
  epoch, so catching up is one step however long the absence was.
- The rollover **announces itself**: a banner names the new season and what
  the cards melted down for.

## 4. The albums and the cards

- A season holds **eight albums of nine cards — 72 in all, one album per
  relic**. Each card belongs to exactly one album.
- **The eight are a ladder, easy first**, and the theme climbs with the
  difficulty:

| # | Album | Nine slots | The page it is |
|---|---|---|---|
| 1 | **First Furrow** | 8×1★ · 1×2★ | the soil — closed in the first week on free packs |
| 2 | **The Wild Wood** | 5×1★ · 4×2★ | the woods |
| 3 | **Hands at Work** | 3×1★ · 4×2★ · 2×3★ | the trade — the first that a Green pack alone will not finish |
| 4 | **Market Day** | 2×1★ · 3×2★ · 3×3★ · 1×4★ | the market — a 1★ and a 4★, so no single pack can close it |
| 5 | **The King's Coin** | 4×2★ · 3×3★ · 1×4★ · 1×4★ gold | the money, and the first gold edition |
| 6 | **Under the Hill** | 4×3★ · 2×4★ · 2×4★ gold · 1×5★ | the deep |
| 7 | **The Long March** | 6×4★ · 2×5★ · 1×5★ gold | the war |
| 8 | **The Star Road** | 5×5★ · 2×4★ gold · 2×5★ gold | the heavens — the trophy, which no faucet closes alone |

- **Which relic an album levels rotates a step a season** (§3), so the ladder
  stays fixed while every relic takes every rung. Eight seasons is one full
  turn.
- Every card carries a **rarity**: **1★ to 5★**, plus **gold** editions of 4★
  and 5★ — seven faces in all, which is what a pack rolls and what a duplicate
  is priced by (§7).
- Which album a player closes **says what they were able to open**. That is
  the whole point of a fixed ladder: the difficulty is a fact about the page,
  not about the relic behind it.
- **Gold cards are what the last four albums turn on.** They fall only from
  the best packs (§6), they cannot be sent (§8), and no wildcard stands in for
  them (§9).
- Cards drop for every album from the first pack, so an unstarted relic is a
  page filling up, not a locked box.

## 5. What an album pays

Three things, on the ninth card, in one sheet:

| | What | Why |
|---|---|---|
| **The relic** | the first time its album is closed: the relic, at level 1. Every close after: **+1 level**, for ever | the permanent layer — the one the season leaves behind |
| **A chest of production** | **N hours of everything the city makes right now**, at the album's band | priced in production, so it is the same fraction of a day at every stage and spent as fast as it lands |
| **One key** | **a silver key on the first five, a gold one on the last three** | the ladder, in the currency the other collection spends |
| **Gems** | **2,000 an album, 16,000 across the eight — the first lap's only** (§5.1) | the spike that feeds the other collection |

- **A rung per album, and the ladder climbs.** Eight albums on a five-rung
  ladder is what the code did before this was authored, and it paid the three
  hardest pages a beginner's chest and no key at all. A test now refuses a
  ladder shorter than the album list.
- The hours are banded: the easy albums pay a morning, the hard ones a night
  (8 h) and never more.
- **Completing all eight pays the collection prize**: a **golden call that is
  guaranteed to be the season hero** (§10) and **25,000 Gems**. The prize is
  dealt in the gacha reveal screen, which is the most exciting screen the game
  has and the right place for the last card to lead.
- The prize rides the **eighth album's payout**, whichever album that turns
  out to be, and is paid **once a season** — not once a lap.
- **It is a call, so it pays what a call on the golden banner pays**: that
  banner's Stardust, and — for a hero the player already holds — that banner's
  duplicate Fragments rather than a second copy. A rate-up is half about
  duplicates (§10), and the guarantee is no different.
- **It is guaranteed, so it is not a roll**: it charges nothing, spends no
  randomness, and moves neither pity counter. A call that never rolled must
  not consume the pity a player has banked, nor advance it.
- The season's hero must therefore be **a hero the golden call can deal**.
  Naming one that banner never gives would make the prize a guarantee of
  something that cannot happen.
- **The album banners follow the prize**, so a run of eight ends on the hero
  rather than on a pennant.
- A relic level is not exciting on its own and is not meant to be. The chest
  and the keys sell the pack today; the level is why a player who has done
  three seasons has a kingdom no new player can buy.
- **Nothing rushes one relic ahead of the others.** A relic's level is the
  count of laps its album was closed on, and a lap is all eight or none of
  them (§5.1) — so a player's relic levels never spread out, and reading them
  reads their history.

## 5.1 The lap

The eight albums do not close once and go quiet for three weeks. **When all
eight are in, the eight reset and run again on the same season's cards.**

- **Closing an album spends its nine cards.** Duplicates survive, so a tenth
  copy fills its slot the moment the page empties and a hoard is worth
  holding. Without the spend the loop would not terminate: a reset that left
  the page full would re-close it on the very next tick, for ever.
- **Breadth before depth.** An album cannot close a second time until all
  eight have closed once. Only the REPEAT is gated — a player who closes three
  of eight still takes those three relic levels, exactly as before.
- **A lap counter rides beside the eight**, so a payout knows which lap it
  belonged to.
- **What repeats and what does not:**

| | Repeats? | Why |
|---|---|---|
| The relic level | **yes** | it is the thing the lap is for |
| The production chest | **yes** | priced in hours of what the city makes, so it is safe to repeat by construction |
| The keys | **yes** | they buy chests in a collection that has its own sinks |
| **The Gems** | **no — first lap only** | eight albums at 2,000 is most of a season's Gem budget, and a player running three laps would mint it over again |
| **The collection prize** | **no — once a season** | it is a fact about the season, not about the lap |

- The screen **says which lap it is on** once there has been more than one; a
  first season never mentions a number that would mean nothing to it.
- Whether a second lap is a pacing fix or a spender's feature is **OQ-100**:
  no single pack tier can do a lap, so the hardest albums want Blue, Purple
  and Golden packs on every one of them.

## 6. Packs

Cards arrive only in **packs**. A pack is **N slots**: some of them
**promised at a named face**, the rest rolled on **one seven-way distribution**
over the seven faces (1★ · 2★ · 3★ · 4★ · 5★ · gold 4★ · gold 5★), at
**published odds**.

- **Nothing is unreachable.** A pack of five rarity weights plus a coin
  flipped for gold built HARD WALLS — a bottom pack could never produce a 4★,
  so an album behind one was impossible rather than dear. One distribution
  containing the gold editions means the bottom pack hands over a gold 5★
  about once in 6,600: a lottery rather than a route, and the shelf says so.

| Tier | Slots | Guarantees | Falls from |
|---|---|---|---|
| **Green** | 2 | one 1★ | the pass's free column, the survey, a quest |
| **Yellow** | 3 | one 2★ | the pass's free column, the survey |
| **Rose** | 3 | one 3★ | the pass's free column, the Dark Portal's floors |
| **Blue** | 4 | one 4★ | the pass's and the survey's paid columns, **the store** |
| **Purple** | 6 | one 5★ | the pass's and the survey's paid columns, **the store** |
| **Golden** | 1 | — (it rolls **gold only**) | the paid columns, the Dark Portal's floors, **the store** |
| **Bronze chest** | 7 | one 3★ · one 4★ | **the vault** — bought with stars |
| **Silver chest** | 9 | one 4★ · one 5★ | **the vault** |
| **Gold chest** | 3 | one 5★ · one gold 4★ | **the vault** |

- **A pack's name and its promise are GENERATED from its `packs` entry**, so a retuned
  pack cannot leave a stale promise on a shelf.
- **The store sells the tiers the free column does not pay**, and only those:
  Blue, Purple and Golden, Gem-priced on the store's own Cards shelf
  ([`14-monetization.md`](14-monetization.md) §3). Selling a Green pack would
  undercut the only free source the collection has, and the shelf says so in
  one line of fine print — *green, yellow and rose packs come from the pass.*
- **The shelf is where the odds are published.** Each row prints what its
  tier can roll, as percentages: a player reading "a chance of a gold edition"
  is owed the number beside it, and a store is the one place that promise has
  to be kept where the money is.
- **The season pass's free column is the free faucet**: 24 packs a season,
  Green on most levels, Yellow and Rose on the fifths
  ([`20-season-pass.md`](20-season-pass.md) §2). The paid column pays Blue,
  Purple and Golden.
  **Dungeon rooms pay no packs**: what the dungeon feeds the collection is
  the pass missions it completes. The faucet at volume is **OQ-102**.
- The pace to author against is **how many of the eight a player who buys
  nothing completes in a season**. That number, not the price of a pack, is
  what decides whether the collection sells or stalls. **OQ-88.**
- **A pack the player WATCHED land opens itself**, in the reveal, wherever they
  were standing — claiming a pass cell, buying a bundle, closing an album. They
  are dealt one at a time and never into a screen that is already showing one.
- **A pack that arrived while nobody was looking waits** in the Collection and
  is opened by the button there. That is the offline line, and it is the same
  rule as before for the only case it ever really covered.
- **A guarantee names a FACE, not a rarity**, so it can ask for a gold 4★ as
  easily as for a plain one and can never come up empty. **Gold outranks every
  plain card**, whatever its rarity, which is what puts it on the last beat of
  the reveal.
- **A guarantee is filled first and the remaining slots roll**, so a pack
  always holds what it promises and the published odds count a guaranteed slot
  as its whole face.
- Opening a pack uses the **gacha reveal** ([`10-heroes.md`](10-heroes.md)
  §8.3): the cards turn one by one, a card the player had none of says **New**,
  and a tile that came as more than one says how many the PACK gave (§11.5).
  Skippable, never interrupted.
- A pack's cards are rolled by **hash on the pack's own id** — the season,
  the source and its ordinal — never on the moment it is opened, so an
  offline replay deals the same hand.

### 6.1 Card bundles

The collection's two Gem purchases — a pack (§6) and a wildcard (§9) —
sold together for **money** rather than for Gems, on the store's own shelf
([`14-monetization.md`](14-monetization.md) §2.3).

| Bundle | Price | Holds | Worth in Gems |
|---|---|---|---|
| **A collector's satchel** | **$4.99** | 2 Purple packs · one 4★ wildcard | 3,800 |
| **A collector's case** | **$9.99** | 5 Purple packs · one 5★ wildcard | 9,000 |
| **A collector's cabinet** | **$19.99** | 10 Purple packs · three 5★ wildcards | 19,500 |

- **Every bundle is a pack the STORE sells**, never one the faucet drips — a
  bundle of free packs would be the faucet sold back at a price. They hold
  **Purple** packs, which guarantee a 5★ rather than a gold edition; whether a
  bundle also carries a Golden is open.
- **A bundle grants no Gems**: it hands over
  the things, not the currency that buys them. The packs land **unopened**,
  like every pack that falls — ten bought together are ten to open in the
  Collection, not ten reveals at the till.
- **It beats the Gem ladder, and the dearer one beats the cheaper one**:
  1.5× at the satchel, 1.8× at the case, 2× at the cabinet, against the flat
  500 Gems to the dollar ([`14-monetization.md`](14-monetization.md) §2.2).
- **No bundle sells a gold wildcard**, at any price. §9's line holds against
  money exactly as it holds against Gems: the gold slots of the last two
  albums are earned or sent.
- **The shelf closes before the season does.** A bundle is packs and
  wildcards and the close wipes both (§3), so in the **last 24 hours** of a
  season the store withdraws the bundles rather than sell an hour of one. No
  row, no greyed-out price — a withdrawn product is not an offer. The next
  season opens the shelf again on its own; nothing is scheduled.
- The row prints **what lands, line by line**, and the confirmation prints
  the same list above the price: a bundle's whole argument is the hand, and
  it is not promised on one screen and left off the other.

## 7. Duplicates and the vault

- Every duplicate is worth **stars**, **per face** — the five rarities and the
  two gold editions each authored, because a gold edition is not always worth
  exactly twice its rarity and the data should be able to say so. Stars are a
  counter inside the collection, shown nowhere else — the Fragments precedent,
  not a wallet row.
- The **vault** is a **shelf of three chests**, bought with stars: bronze,
  silver and gold, each guaranteeing two named faces (§6). Prices on the
  sheet, and a **ten-at-once** button beside them.
- **A knob opens the shelf; it does not buy.** With three chests and a bulk
  button there is a choice to make, and a one-press knob could not say what it
  was about to spend.
- **Buying ten buys time, not a better price** — the ten-call's argument. Ten
  chests are ten different hands, never the same one ten over.
- **Every chest costs more stars than its own contents return.** That is
  arithmetic rather than balance, and a test asserts it: a vault that paid for
  itself would be perpetual motion.
- A duplicate is spent one of two ways — sent to a friend (§8) or left to the
  vault — and the vault is what makes a duplicate worth something to a player
  with nobody to send it to.
- **A season of 72 cards deals duplicates early**, so the vault is not a late
  screen: its first chest is meant to be reached in the first week, and it is
  the second faucet a player without friends has.
- Stars are wiped at the close; the cards themselves melt into Gold on the
  same ladder (§3), so the rarity that prices a duplicate prices the wipe too.

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
- It is **priced by the rarity it covers** — the 5★ one covers everything a
  wildcard can, so it costs a gold key. Bought with Gems, never with money.
- **It can never buy a duplicate.** A slot the player already holds refuses
  it: a wildcard landing on a card they have would be stars at a Gem price,
  which is the one thing a targeted purchase must not be.
- **Placing it is select-then-place**, the idiom placement and casting already
  use: arm the wildcard, and the grid lights every slot it could fill before a
  tap is spent finding out. A one-tap consumable needs the MODE to be visible,
  not a dialog after the fact.
- A wildcard **goes with the cards at the close** (§3). One held over would
  fill a slot in a season whose album it was never bought for.
- **There is no gold wildcard.** The gold slots of the last four albums are
  earned or sent, never bought outright, so the hardest pages on the ladder
  are the ones Gems cannot finish.
- Wildcards are **sold in offers**, aimed at the albums a player has nearly
  finished: an offer names the album, the missing count and a wildcard that
  covers it. They also sit on the season pass's paid column.
- **An offer answers a shortage rather than interrupting**
  ([`14-monetization.md`](14-monetization.md) §6), so it is keyed on the gap:
  an album nine cards short is not a shortage, it is a season, and the store
  says nothing about it. An album down to **gold slots alone** has nothing to
  sell, and the shelf drops the row rather than greying one out.
- The rarity offered is the **dearest missing slot's**, so one purchase fills
  any hole the album still has. A cheaper wildcard that covered only some of
  them would be an offer the player has to do arithmetic on.
- **Buying from an aimed offer opens that album with the wildcard armed.** The
  purchase and the placement are one intention, and sending the player off to
  find the album again would be a second errand.
- A wildcard is the one targeted purchase in the collection, and it respects
  the line: the same card is in every Green pack the pass pays.

## 10. The season hero

- Every season names one hero. During the season it is **rated up** on the
  golden banner; the collection prize is **a golden call guaranteed to be
  that hero** (§5).
- **Associated, not exclusive.** The hero is on the golden banner at its
  ordinary weight before, during and after; the season makes it easier to
  pull and, through the duplicates a rate-up brings, easier to ascend. Nothing
  about it expires.
- It is named **from the rarities the golden call deals**, because the prize
  is a call on that banner (§5).
- The rate-up is the timeline's existing **banner payload**
  ([`10-heroes.md`](10-heroes.md) §11), scheduled by the seasons file. The
  season is its first consumer.

## 11. The screens

A pill on the map, two levels behind one nav tab, a card, and the reveal the
gacha already owns. Mockups: M19–M22 in
[`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md) §7.19.

### 11.1 The season pill

- On the map, in the left column of pills, beside the season pass's.
- A parchment pill with the **season's crest**, its name, `12/72` cards and
  the time left. Tapping it opens the Collection.
- It **glows while a pack is unopened** and goes quiet once none is; it is
  never a badge with a count of things owed.
- **Hidden behind any sheet**, like every other pill, and absent entirely
  before the first card.

### 11.2 The Relics

**The nav tab is Relics, not Collection.** The cards were never the
destination: a player goes there to read what their relics DO and to close the
page that levels one. Naming the tab after the currency rather than after the
thing it buys put the relics a screen behind a screen.

- A header plate with the **season's name and its frame**, and under it a
  **prize band**: *Complete all eight to win*, the golden call and **25,000
  Gems** as two chips. The band is the screen's lede — the prize is what the
  eight albums are for. Once the prize is won the band says so, and it stays
  said for the rest of the season however many laps run.
- One line under the band: the **time left**, the season's total `12/72`, and
  — from the second lap on — a quiet **`Lap 2`** chip. The countdown derives
  from the close timestamp.
- **The eight RELICS as round medallions, three to a row** — three, three,
  then two centred: the relic's own art in a carved ring, a **`Lv 3`** tab on
  the ring (a padlock while it is unfound), its name under it, and an `x/9`
  pill for its album under that. One line that says both what you have and how
  close the next level is.
- **The grid is the roster, in the roster's own order.** Which album a relic
  draws rotates a season (§3), so a grid ordered by the album ladder would move
  every relic under the player once a month.
- **A page ready to close wears a tick**, and it is the only mark on this
  screen. Nothing closes itself any more (§11.3), so an album standing at nine
  would otherwise sit there saying nothing.
- **There is no separate albums strip.** One album per relic means the eight
  medallions already are the eight albums; the album's own medallion is drawn
  inside the relic's page and as the provisional face of all 72 cards.
- The unopened **pack** is the one thing on this screen that asks for a tap, so
  it sits under the grid as the only slab, naming the tier and how many wait.
- The **vault** is a round knob at the bottom-right, the way a safe sits in
  the corner of the screen it belongs to: the **stars** count rides it, and
  tapping it opens the shelf of three chests (§7).

### 11.3 One relic

**One page, not two.** A relic's card and its album's page used to be separate
screens, which put the thing nine cards are FOR one tap behind the nine cards,
and the button that spends them on neither.

Top to bottom:

- **The art on the LEFT, the words on the right.** Stacked, the space beside
  the relic was empty and the page said nothing until the player scrolled.
- **The level rides the art's own top-left corner**, as a bare label with no
  plaque behind it — a slab across the frame covered the thing the player
  opened the page to look at. *Level 3*, with no *of*: there is no cap.
- Beside it, the relic's **name** and **one sentence** saying what the passive
  does. A relic whose system does not exist yet says so above it, in muted ink
  with the reason (§2).
- **The passive's numbers as a centred band of small tiles**, one per number
  the relic moves, each carrying *value → value at the next level*. It is the
  building card's band with a delta in each tile, because a relic's page is its
  upgrade screen too — there is no separate popup to hold the before and after.
  A number the next level **leaves alone shows no delta** — just the value.
  The tile stays, so nothing goes missing and the stat is not mistaken for one
  the relic does not have; what goes is the arrow pointing at the same number
  again, which is a promise of a change that is not coming.
  - **No heading over it.** The sentence above already named the passive, and
    the section that does need naming is the one under it.
- **For a city relic, its activation** (§2.1): the aura's reach, *Asleep* with
  the **Activate** button and its Mana, or *Awake* with the time left.
- **For a world relic, a section named SPELL**, carrying the ability's name,
  what it does, **the same band of tiles** and the **cast button**. A level moves what the relic
  does all the time AND what its ability does for a minute, so a player should
  not have to learn two ways of reading the same kind of fact.
  - Its tiles are the questions in the order they are asked: **what it costs**,
    **how long it lasts**, **how far it reaches** and **how long until it comes
    back**.
  - **The cooldown is on the band although nothing ever moves it.** *This never
    gets shorter* is the answer to the obvious question, and a missing row
    would leave it unasked. It simply never shows a delta.
  - **Reach names the cells, not just the ring** — `3 · 49 cells` — because
    `(2r+1)²` is the number the player feels when a rung lands.
  - While the ability is running or resting the countdown replaces the button
    (§2.1). A relic whose spell is not written yet says so in muted ink rather
    than showing an empty section.
- Then the **album**: its medallion, its name and an `x/9` bar.
- The **3×3 grid**: each slot shows the card's own painting or its silhouette, its **rarity
  as stars above the card** — gold slots framed gold — its name on a ribbon
  along the bottom, and a **`+N` corner tag** for the duplicates it holds.
- A **duplicate can be tapped**: *Send* (three left today) or *To the vault*
  (its stars). A gold duplicate offers only the vault.
- A **missing card** can be tapped: what packs it falls from, and — if the
  player holds a wildcard that covers it — that wildcard, **armed**.
- A **strip above the grid** says what wildcards are in hand, and turns clay
  while one is armed: the difference between *you have one* and *the next tap
  spends it* is a colour, not a word. Every slot the armed wildcard can fill
  is ringed gold; the rest stay as they were.
- **At the foot, the slab that closes the album** — what the nine cards are
  for, under the nine cards. Its chips say what this close pays **on this
  lap**, so a repeat shows no Gems rather than a struck-through one (§5.1): a
  reward that is not coming should not be on the button at all. Short of nine,
  the button is padlocked and the count is its reason.
- **Closing is the PLAYER'S move.** A page used to close itself the instant its
  last slot filled, which meant a pack could spend nine cards and roll the lap
  while the player was watching a reveal for something else — they never chose
  the moment and could not see it coming. Now the page fills and waits.
- **Arrows at the two bottom corners** walk to the previous and the next relic
  without going back up. Eight is a short walk, and it is how a player checks
  what they are close to.

### 11.5 Opening a pack

- The reveal screen at z 100, one pack per opening, the cards dealt in
  rarity order and the best last.
- **One tile per CARD, not per copy.** A pack that hands over a pair draws one
  tile.
- Two independent marks, either or both: **New** when the player held none of
  that card before the pack, and **×N** for how many copies THIS PACK gave —
  never how many they now hold. `×1` is left unsaid.
- **A completed album interrupts nothing.** The cards finish turning, and what
  the album paid follows: the **collection prize** as a second reveal if the
  season just finished (§5), then a **banner per album** naming the relic and
  the level it reached. Nothing is dealt into a screen that is still busy, and
  the order holds however an album was finished — a pack dealing the ninth card
  or a wildcard laying it.

### 11.6 A spell on the map

An awake city relic's aura and a placed zone are the only things a relic puts
**on the world**, and both are drawn this way, the wheel on the Shrine counting
its window down. The map has to say two different things about them.

- **THE TINT SAYS *THERE IS MAGIC HERE*, AND THE WHEEL SAYS FOR HOW LONG**, and
  they are drawn on different things on purpose. The tint covers **every cell**
  the zone reaches, because the question it answers is *which ground*. The
  wheel sits on the **centre alone**, because a countdown repeated across
  twenty-five cells is twenty-five things to read that all say one number.
- **Violet, and violet is used by nothing else on the map.** The ground is warm
  greens and browns, so a player never has to ask whether a glow is terrain.
- **The border traces the outside of the whole zone**, never the grid inside
  it: what is enchanted is an area, not a set of squares.
- **Motes drift upward**, two a cell, each on a loop seeded by its own
  coordinates so no two cells shimmer alike. They are the living half of the
  read — a flat tint says a rule applies here, where something MOVING says a
  spell is working.
- **The wheel carries the relic's own glyph**, so two zones standing at once
  are told apart by whose they are rather than by where they happen to be.
- The whole thing is drawn **before every other marker**: a zone is a fact
  about the world, so a placement outline or a cast preview must be able to sit
  on top of it and still be read.
- The shimmer runs on the **wall clock**, never the sim's — it must keep moving
  between ticks, and it must never be something a replay could depend on. What
  the wheel counts comes down with the zone, computed once against the sim's
  own clock.

## 12. Dials, in the order to reach for them

Every number below is a **proposal until it is authored**; the ones marked
**fixed** were decided with the design.

| Dial | Value | Key |
|---|---|---|
| Season length | **28 days**, four weeks exactly, shared calendar | `pass.seasonDays` |
| Albums a season · cards an album | **8 · 9, fixed** — 72 | seasons file |
| Which relic each album levels | **one each, rotating one step a season** | derived, not authored |
| Gems an album pays · the collection prize | **2,000 each, 25,000 at the end, fixed** — 16,000 across the eight, **first lap only** | `collection.albumGems`, `collection.prizeGems` |
| Sends a day | **3, fixed**; gold never | `collection.sendsPerDay` |
| A relic's `passiveBase` and `passivePerLevel` | per relic | `artifacts` |
| What a level-up costs | **one fragment of each of the six slots**, every level, and **Stardust**: 100, ×1.5 a level (100 · 150 · 225 · 340…) | `relics.fragments`, `levelStardustBase` · `levelStardustGrowth` |
| How long a city relic stays awake, by Shrine level | **5 · 30 · 60 · 240 · 480 min** | `buildings`, Shrine `relicWindowMinutesPerLevel` |
| What activating a city relic costs | **20 Mana** each | `artifacts`, `activeManaCost` |
| How far a city relic's aura reaches at level 1 | **2** cells round the Shrine | `artifacts`, `activeRadius` |
| What a world spell costs and reaches | per relic | `artifacts`, `activeManaCost` · `activeRadius` |
| Uses an event-counted spell buys | **3 rooms, +1 a level** on the Lantern | `artifacts`, `activeCharges` · `activeChargesPerLevel` |
| A world spell's cooldown | **5 min, flat**, counted from its close | `artifactCooldownSeconds` |
| Where a reach steps up | **levels 5, 10 and 20**, one ring each — a city relic's aura and a world spell alike | `artifactRadiusSteps` |
| Production hours an album pays | 2 · 2 · 4 · 4 · 6 · 8 · 8 · 8 — **one rung per album** | `collection.albumHours` |
| Keys an album pays | **silver ×5, then gold ×3** — one key a page | `collection.albumSilverKeys`, `…GoldKeys` |
| Rarity per slot, per album | authored | seasons file |
| Pack tiers — slots, guarantees, the seven-way distribution | §6 | `packs` |
| What the store charges for a pack | **Blue 400, Purple 900, Golden 600**; blank = not sold | `packs`, `gemCost` |
| A wildcard's price, by the rarity it covers | **100 · 200 · 400 · 800 · 1,500** — the top one at a gold key | `collection.wildcardGemCosts` |
| How short an album must be for an offer | **3 cards** | `collection.wildcardOfferAt` |
| What a card bundle holds, and what it costs | **$4.99 / $9.99 / $19.99** for 2 / 5 / 10 Purple packs and 1 / 1 / 3 wildcards at 4★ / 5★ / 5★ (§6.1) | `store`, `packs` · `packTier` · `wildcards` · `wildcardRarity` |
| How close to the close the bundles come off the shelf | **24 hours** | `collection.bundleWithdrawHours` |
| Stars a duplicate is worth, **per face** | 2 · 6 · 16 · 40 · 100, and gold 80 · 200 | `collection.starsPerFace` |
| What a card melts for at the close | **30 seconds of the city's Gold income per star** it is worth, floored by the chest's floor | `collection.closeGoldSecondsPerStar` |
| What a vault chest costs in stars | **bronze 105 · silver 250 · gold 400** | `collection.chestStars` |
| Free albums a season, target | **the pacing number — OQ-88**; and the faucet it needs is **OQ-102** | derived, not authored |
| Season hero rate-up weight | — | `banners.rateUpWeight` |

## 13. Deliberately not in this design

- **Attunement.** Slots, the swap lock, the Gem slot ladder and the
  `Attunement`-slot modifier stat. Every relic the player has is on.
- **Stardust on a relic.** Stardust keeps the hero ascension toll and nothing
  here.
- **Ingredients, the 3×3 tier grid, and Fragments as a relic gate.** The
  album is all three.
- **A relic that drops.** Cards come in packs.
- **A level cap, or a tier.** A relic's level is one number with no top.
- **A discount as a relic effect.** Speeds and yields only.
- **A relic carried into a fight**, or one that is worn, slotted or equipped.
- **A city relic that is always on.** Its effect is bought in Mana, a window
  at a time.
- **A city relic spell.** The activation is the one thing a city relic is
  pressed for.
- **A cooldown on an activation**, or a window that stacks.
- **An ability that lives in a tome** ([`07-research.md`](07-research.md) §6).
- **A separate album screen.** A relic and its nine cards are one page
  (§11.3), and the button that spends them is on it.
- **An album that closes itself.** The ninth card makes a page CLOSABLE; the
  player closes it.
- **A card that survives the season**, or an extension for a late arrival.
- **Two albums for one relic**, or an album that levels no relic. One relic,
  one album — the relic strip, the badge and the signpost all collapse into
  the eight rows because of it.
- **Levelling one relic ahead of the others.** The lap (§5.1) buys a second
  level on all eight or on none; a wildcard, a gift and the vault all buy the
  same lap faster, never a relic out of turn.
- **A pack that cannot reach a rarity.** Every pack rolls all seven faces
  (§6); the bottom ones make the top faces a lottery rather than a wall.
- **A vault that pays for itself.** Every chest costs more stars than its
  contents return.
- **Selling a card.** Packs, and a wildcard that never covers gold. The melt-
  down (§3) is the close doing it once, to everything, on its own clock — not a
  button the player presses on a card they are tired of.
- **A stopped clock for a season with nothing after it.** The list cycles, so
  the calendar never runs out and there is no last season to handle.
- **A gold wildcard in a bundle**, or a bundle of the tiers the free column pays.
  Money buys §6.1's hand faster, never a card play cannot reach.
- **A bundle sold in the last day of a season**, or one whose packs and
  wildcards survive the close to be spent in the next.
- **A season-exclusive hero.** Associated: rated up now, in the pool for ever.
- **New card art every season** as a requirement.
- **Trading as a swap**, with offers or negotiation.
- **A duplicate melted into a currency on demand.** Stars are a counter in
  this screen, and a duplicate's two uses are the vault and a gift.
- **Stars, packs or wildcards melting at the close.** The card in the slot is
  what melts (§3); stars were already a duplicate's payout, and a pack or a
  wildcard is a card in waiting, which is why they go with the cards instead.
- Random stat rolls, standalone equipment, duplicate fusion.

**Open questions:** OQ-88, OQ-89, OQ-90, OQ-100, OQ-102, OQ-113 in
[`../open-questions.md`](../open-questions.md).
