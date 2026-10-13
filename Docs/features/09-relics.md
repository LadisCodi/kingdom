# 9 · Relics

> **Scope.** The eight relics: permanent kingdom effects with no ceiling,
> each restored from six fragments, levelled with a full set again and
> Stardust, and hosted where it acts — a city relic in a Shrine, a world
> relic in a Chapel. Where fragments come from, the store's fragment pack,
> trading, and the screens. The Bag's items are
> [`29-the-bag.md`](29-the-bag.md); trading's board
> is [`15-social.md`](15-social.md) §2.4.
>
> **Status: built** — fragments, restoration, levelling, the Shrines and
> their activation, the Chapels and the two world spells, every fragment
> source of §5–§6, the fragment pack, trading, and the screens of §11.
> **Three world relics move nothing yet**: the Stargazer's Orb's and the
> Wisp Lantern's passives and Lamplight act on numbers nothing reads, and the
> Steward's Signet's stat is not read either (**OQ-113**). Their cards say so
> where the data carries a `pending` line.

## 1. The model

- A relic is **one effect, one number, no ceiling**. The number rises with
  the relic's **level**.
- **A relic is six fragments**: five pieces and a keystone. Six distinct
  fragments **restore** it at level 1; every level after takes **one of each
  of the six again, and Stardust** (§4).
- **Fragments are found** (§5–§6), bought in the store's pack (§7) or traded
  between friends (§8). A missing fragment is never made.
- **A relic acts only where it is hosted**:
  - a **city relic** in a **Shrine** (§2.1, §2.3), inside the Shrine's aura,
    for a window opened with Mana;
  - a **world relic** in a **Chapel** on a world district (§2.2), for as
    long as the Chapel holds it.
  - An unhosted relic waits in the Bag and does nothing.
- **One relic, one host.** Hosting a relic takes it from where it was.
- **A relic is never lost.** Nothing expires, and a relic in a lost Chapel
  comes home to the Bag (§9).
- A relic is not worn, slotted or carried into a fight.

## 2. The eight relics

Every effect is a speed or a yield, never a discount. Four are the city's and
four the world's (`artifacts` › `kind`).

| Relic | Kind | Effect | Moves |
|---|---|---|---|
| **Staff of Renewal** | city | forests, fields and shoals in the aura **hold +X% and grow back +X% faster** | `harvestStock`, `recoverySpeed` |
| **Sickle of Plenty** | city | **every swing and every tap** in the aura takes **+X%** | `harvestUnitsPerStrike` |
| **The Winged Hammer** | city | crews in the aura **swing and walk +X% faster**; buildings there **train +X% faster** | `workerStrikeSpeed`, `workerSpeed`, `trainingSpeed` |
| **The Tribute Crown** | city | houses in the aura **pay +X% tax** | `taxRate` |
| **The Stargazer's Orb** | world | rooms pay **+X% Stardust** — **not read** (OQ-113); spell **Survey** | `stardustYield` |
| **The Wisp Lantern** | world | a room's **Gold and Stone +X%** — **not read** (OQ-113); spell **Lamplight** | `roomHaul` |
| **Warhorn of the Host** | world | the army the halls field **+X%** | `armyCap` |
| **The Steward's Signet** | world | every world district's hourly yield **+X%** — **not read** | `worldImprovementYield` |

- **`X = passiveBase + passivePerLevel × effect steps`**, both per relic in
  `artifacts`. On a world relic every level after the first is an effect
  step; on a city relic the effect steps are the ones its cycle gives (§2.1).
- A relic with two or three stats moves them all with one value.
- **The Staff's regrowth is priced when a cell empties**: a cell that runs dry
  inside an awake aura keeps the shorter wait.
- **The Hammer prices training when it starts**: a trainee whose clock starts
  inside an awake aura keeps the faster time; one already running is never
  repriced.
- **Where two auras of one relic overlap, the stronger counts.** They never
  add.
- **A relic's effect is a stage of its own**: base → technologies → relic
  auras → modifiers. A world relic in a Chapel is a permanent modifier at the
  base stage.

### 2.1 Activation — the city relics

- **Hosting is free; activating costs Mana.** A city relic in a Shrine sleeps
  until the player activates it. Then its effect reaches every cell of the
  Shrine's aura for a window.
- **The relic's level sets all three**: its number, its reach and its window.
  At level 1:
  - the number is `passiveBase`;
  - the aura is the Shrine's cell and **`activeRadius` cells round it**
    (Chebyshev, 2);
  - the window is **30 min**.
- **Every level-up raises one of the three, round a fixed cycle**
  (`relics.cityLevels.cycle`):

  | Level | 2 | 3 | 4 | 5 | 6 | 7 | … |
  |---|---|---|---|---|---|---|---|
  | Raises | window | reach | number | window | reach | number | … |

  - **Window** steps **30 min → 1 h → 2 h → 4 h → 8 h**
    (`relics.cityLevels.windowMinutes`).
  - **Reach** adds one ring.
  - **Number** adds `passivePerLevel`.
  - **A window step past 8 h raises the number instead.**
- **One activation, one price**: `activeManaCost` (**20** on every city
  relic), whatever the window.
- **No cooldown and no stacking.** It can be activated again the moment the
  window closes, never while it is open.
- **The window is priced when it opens.** A level-up mid-window does not
  stretch it.
- **The window survives everything but leaving the Shrine.** It runs while
  the player is away, through a save, and follows a Shrine that is moved.
  Taking the relic out, or hosting it elsewhere, ends it.
- **The close is a boundary** of the offline advance; rent inside the aura is
  repriced at it, as at every host, unhost, move and activation.
- A window that closes raises the *Relic asleep* notice
  ([`26-notices.md`](26-notices.md) §2.2).

### 2.2 World relics — Chapels and spells

- **A Chapel** is a world-district building (`world` › `upgrades.Chapel`:
  5,000 Gold, 4 h), opened by **Holy Ground** in the Atlas.
  - It takes one of the district's building slots.
  - A seat may build **one, plus one per `chapelsPerHexes` (6) hexes it
    holds**, plus what technologies add (`chapelSlots`).
  - A **Shrine district** on the world board has a Chapel of its own, which
    does not count.
- **A world relic acts while a Chapel holds it**, at the level the client
  sends when hosting; a level-up re-sends it. Every player sees the relic in
  the Chapel.
- Hosting, removing and moving are server commands through `handleWorld`.
- **Two world relics carry a spell**, cast from the relic's sheet with Mana
  while a Chapel holds the relic:

| Relic | Spell | Cast on | Mana | Grows |
|---|---|---|---|---|
| **The Stargazer's Orb** | **Survey** — clears the province's fog around a revealed cell, free of Gold | a revealed cell inside the Townhall's reach | 25 | **radius**: 2, one ring more at levels 5, 10 and 20 |
| **The Wisp Lantern** | **Lamplight** — the next rooms pay double | nothing | 20 | **rooms**: 3, +1 a level |

- **ACTIVE → COOLDOWN → READY**: a flat **5-minute** cooldown
  (`artifactCooldownSeconds`), counted from when the spell **closes**.
- **Survey buys the Gold, never the reach.** Only unrevealed cells the
  Townhall can already reach are cleared, nearest first; they count towards
  the fog's treasures like a paid reveal.
- **Lamplight is counted in rooms**: its charges never expire; the last one
  spent is the close. **Nothing spends a charge** (OQ-113): a cast Lamplight
  stays lit.
- The countdown derives from a timestamp.

### 2.3 Shrines

- **A Shrine is a 1×1 building** (`buildings` › `Shrine`, `hostsRelic`): one
  level, no crew, **no effect of its own**. It holds one city relic and wakes
  it.
- **The first is a ruin**, the Thorned Shrine in the province, repaired once
  the Orcs' lair no longer holds its ground. No technology is asked.
- **Then `shrines.materialBuilds` (1) for materials**, from the Build menu's
  Decoration tab once **Sacred Masonry** (Kingdom, chapter 4) is researched:
  the level-1 cost at its ordinal — 60,000 Gold for the second
  (`instanceLinearGrowth` 29).
- **Then Gems only**, one price each from `shrines.premiumGems` — 3,000 ·
  5,000 · 8,000.
- **The cap is 5** (`maxCountPerTownhallLevel`). Until the ruin is repaired
  the Build menu says *Repair the old shrine first*.
- **A Shrine is moved like any building.** Holding a relic, the ghost carries
  the gold aura and a **+X%** badge on everything the relic would work on
  there — resource cells for the Staff and the Sickle, buildings for the
  Hammer and the Crown. The move bar says **Reaches N** (green when it beats
  the current spot, red when it loses) over **M where it stands**.
- Repairing the Thorned Shrine plays the tutorial scene that hands over the
  Staff of Renewal whole (§10).

## 3. Fragments

- **Six slots a relic**: pieces 1–5 and the keystone (slot 6).
- **A fragment's slot is rolled**: the keystone one time in `keystoneOneIn`
  (8), otherwise one of the five pieces, evenly.
- **Found and bound are counted apart**, slot by slot (`state.relics.held`):
  - **found** — dropped by play, or received in a trade;
  - **bound** — bought (the fragment pack, §7).
  - Only a found fragment may be traded (§8).
- Fragments are not Bag items; the Bag's Relics tab shows them (§11.1).

## 4. Restoring and levelling

- **Restore**: six distinct fragments, one of each slot. One of each is
  spent; the relic is level 1.
- **Level up**: one fragment of each of the six slots again, and the level's
  **Stardust** — `levelStardustBase` (100) × `levelStardustGrowth` (1.5) per
  level, rounded to three significant figures. Every level, no ceiling.
- **Bound fragments are spent before found ones.**
- Nothing is spent when either falls short.

## 5. Each relic's door

**The first fragment of a relic is found by play, at its door** — piece 1,
the first time the door pays. A drop never rolls a relic the player has not
met.

| Relic | Its door |
|---|---|
| Staff of Renewal | the **Orcs'** lair, cleared |
| Sickle of Plenty | the **Harpies'** lair |
| The Winged Hammer | the **Goblins'** lair |
| The Tribute Crown | the **Wolf Riders'** lair |
| The Stargazer's Orb | a **Dark Portal** floor |
| The Wisp Lantern | a **dungeon room** |
| Warhorn of the Host | a **dungeon boss** — a depth's last room, or closing the dungeon |
| The Steward's Signet | **scouting** a world hex whose promise is a pack |

## 6. Where more fragments come from

Every drop picks evenly among the relics of its kind the player has **met**,
rolled by hash on the event that paid it.

| Source | Kind | How many |
|---|---|---|
| **Fog treasures** | city | 1 on every 6th treasure (`treasureEvery`) |
| **Lairs** | city | by tier: 1 · 1 · 2 · 2 · 3 (`perLairTier`), after the door |
| **Quests** | any | the quest's `rewardFragments` |
| **Research chapters** | any | finishing a Kingdom chapter whole: 1 · 1 · 1 · 2 · 2 · 2 · 3 · 4 for chapters 2–9 (`tech-tree.json` › `eraRewards`) |
| **The Survey** | any | its free track's `freeFragments` ([`25-the-survey.md`](25-the-survey.md)) |
| **Dungeon bosses** | world | 1 |
| **Dark Portal floors** | world | by the floor's pack: Rose (every 5th) 2, Golden (every 10th) 4 (`perPackTier`) |
| **Scouting** | world | by the hex's pack tier (`perPackTier`) |
| **The fragment pack** | any | §7 — bound |

- A source with nothing met of its kind pays nothing.
- A dungeon room and a world camp pay none; a room opens its door (§5).

## 7. The fragment pack

- Sold on the store's **Supplies** tab: **5 bound fragments** of relics the
  player has met, at random, for **900 Gems** (`fragmentPackSize`,
  `fragmentPackGems`).
- Not sold until a relic has been met.
- The keystone falls at the same `keystoneOneIn` as any drop.
- Opening it plays the gacha reveal (§11.5).

## 8. Trading

- Friends trade relic fragments (and precious materials) on the **wish
  board** ([`15-social.md`](15-social.md) §2.4, `src/sim/trade.ts`).
- **One lot for one lot**: a piece for a piece or a material; **a keystone
  only for a keystone**.
- **A fragment may be wished for only if missing** — a relic met and not
  restored, none held in that slot.
- **A fragment may be given only if it is a duplicate** — two or more in its
  slot — and **found**, never bound.
- A fragment received by trade is found.
- A wish whose stake is a fragment of a relic the player has never met cannot
  be filled by them.
- Caps and windows are `social` › `trade` (`wishes`, `wishHours`,
  `fillsPerDay`).

## 9. Where a relic is kept

- **In the Bag** while unhosted.
- **In a Shrine** (city relics): the province can never be attacked, so a
  Shrine's relic is never at risk.
- **In a Chapel** (world relics): a hex that is **taken or denied** sends its
  relic home to the Bag at its level, and the Chapel stands empty. The owner
  gets a report.
- **A Shrine that holds another relic hands that one back to the Bag**; a
  Chapel does the same.

## 10. Meeting the first relic

- The Bag's door opens with the first item or the first relic fragment; the
  Relics door with the first fragment met (`sim/doors.ts`).
- **The tutorial hands over the Staff of Renewal whole** when the Thorned
  Shrine is repaired (scene `shrineRelic`, a line's `restores`): restored at
  level 1, no fragments asked. The scene ends when it is hosted.

## 11. The screens

Mockups: M67, M72, M80–M85 ([`../art/ui-relics.md`](../art/ui-relics.md),
[`../art/ui-inventory.md`](../art/ui-inventory.md)).

### 11.1 The Bag's Relics tab

- Relics live in the **Bag**, on its **Relics** tab. There is no relic tab
  on the nav.
- At the top, **Shrines n / max**, and *More from the Build menu* while
  there is room for more.
- Then **City**, then **World**, under thin headers: every relic met, as
  cards, two a row.
- Before any fragment: *Relic fragments turn up in lairs and in the fog*.

### 11.2 A relic's card

- The relic's art, its name, and its level seal (blue wax) once restored.
- Under the name, where it stands:
  - **in fragments** — its six slots, and *Ready to restore* or `n / 6`;
  - **Awake · 52m** on a gold plank;
  - **asleep** — resting Zs on the art and its own **Activate**;
  - **In a Chapel** · **In the Bag**.
- A tap opens the relic's sheet.

### 11.3 The relic's sheet

Top to bottom:

- The art (an **Awake** ribbon, or resting Zs while asleep).
- **One sentence** saying what it does, with the numbers of its level in it.
- **A band of tiles**, one per number the relic moves: *value → value at the
  next level*; a number the next level leaves alone shows no arrow. A
  `pending` line under it in muted ink when the effect is not read.
- **The level section**: *Level n* or *Not restored*; the six slots large,
  each fragment's own art where held (with its count past one), its
  silhouette in chalk where missing, the keystone last and gold-rimmed;
  **Restore**, or **Level up** with its Stardust (*A piece in every slot to
  level up* while a slot is empty); and, while a slot is empty, where
  fragments come from.
- **Shrine** or **Chapel**: where it is hosted, a **Host** button per Shrine
  or Chapel it could go to (naming what that one holds), and **Remove**.
- **A city relic's activation**: asleep, a grey **Asleep** seal, **Activate**
  with its Mana, and *Awake for {window} over {n} cells round its Shrine*;
  short of Mana, how soon the pool holds the price and the smallest Mana
  flask in the Bag. Awake, a blue bar running down the window.
- **A world relic's spell**: its name and text, **Cast**, or *lit — n rooms
  left* / *running* / *Ready again in*.
- At the foot, one **Store** button: the store's Supplies tab, at the pack.
- While an asleep relic's Activate is on the sheet, Level up steps down to
  the secondary button.

### 11.4 The Shrine's card and the picker

- The Shrine's card holds **one slot, drawn as a painting of the chapel
  inside**: its altar's golden cradle carved with a **+** while it waits,
  the unlock splash's sunburst turning out of it (with the CTA when a relic
  in the Bag could go there), the relic set in it once placed — dim asleep,
  lit awake.
- On the painting: the relic's name, level and effect on a band at the top;
  Activate (and, short of Mana, a flask) or the window's bar at the bottom.
- A tap opens the **relic picker**, the hero picker's flow: the restored city
  relics as cards with what each does and the **Shrine mark** on those
  already in one, the Shrine's slot, and **Select**. A relic in another Shrine
  asks first — *Move it to this one?* Emptying the slot and selecting takes
  the relic out; closing changes nothing.
- A Chapel's card on the world board uses the same picker over the restored
  world relics.

### 11.5 The fragment reveal

- The fragment pack opens on the **gacha reveal** from the violet **relic
  chest**: one piece a card, the same piece counted once, **keystones last**.
- Closing it, the pieces **fly to the nav's Bag**, as everything that lands
  in the Bag does.

### 11.6 On the map

- **An awake relic floats over its Shrine**, and its aura is drawn on the
  ground in **gold**, breathing, its border tracing the outside of the zone.
- **An asleep relic rests on the altar under a bubble** showing it drained
  of colour with resting Zs. A tap on the bubble, like a tap on the Shrine,
  opens its card and costs nothing.
- Houses an awake Crown pays, and buildings an awake Hammer speeds, wear a
  **+X%** badge.
- A wake sweeps a ring over the aura and floats **+30% tax · 1h**.
- The motion runs on the wall clock, never the sim's.

## 12. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| A relic's number at level 1, and per effect step | per relic | `artifacts` › `passiveBase` · `passivePerLevel` |
| What a level-up costs | a full set, and Stardust 100 × 1.5 a level | `relics.fragments` › `levelStardustBase` · `levelStardustGrowth` |
| How often a fragment is the keystone | **1 in 8** | `relics.fragments.keystoneOneIn` |
| What a city relic's level-ups raise, in turn | **window → reach → number**, from level 2 | `relics.cityLevels.cycle` |
| A city relic's window, by step | **30 · 60 · 120 · 240 · 480 min** | `relics.cityLevels.windowMinutes` |
| What activating a city relic costs | **20 Mana** | `artifacts` › `activeManaCost` |
| A city relic's aura at level 1 | **2** cells round the Shrine | `artifacts` › `activeRadius` |
| A world spell's Mana and reach | Survey 25 · radius 2 | `artifacts` › `activeManaCost` · `activeRadius` |
| Lamplight's rooms | **3, +1 a level**, double pay | `artifacts` › `activeCharges` · `activeChargesPerLevel` · `activePower` |
| A world spell's cooldown | **5 min**, from its close | `relics.artifactCooldownSeconds` |
| Where Survey's reach steps up | **levels 5, 10, 20** | `relics.artifactRadiusSteps` |
| Each relic's door | §5 | `artifacts` › `door` |
| Fragments from treasures, lairs, packs of the world | every 6th treasure · 1·1·2·2·3 by lair tier · by pack tier | `relics.fragments` › `treasureEvery` · `perLairTier` · `perPackTier` |
| Fragments from quests, chapters, the Survey | per entry | `quests` › `rewardFragments`, `tech-tree.json` › `eraRewards`, `survey` › `freeFragments` |
| The fragment pack | **5 for 900 Gems** | `relics.fragments` › `fragmentPackSize` · `fragmentPackGems` |
| Shrines for materials, then for Gems | **1**, then **3,000 · 5,000 · 8,000** | `relics.shrines` › `materialBuilds` · `premiumGems` |
| The Shrine cap | **5** | `buildings` › `Shrine` › `maxCountPerTownhallLevel` |
| A Chapel's price, and how many a seat may build | 5,000 Gold · 4 h; 1 + 1 per 6 hexes | `world` › `upgrades.Chapel`, `chapelsPerHexes` |
| Trading's caps | §8 | `social` › `trade` |

## 13. Deliberately not in this design

- A level cap, or a tier.
- A discount as a relic effect.
- A relic carried into a fight, worn, slotted or equipped.
- A city relic that is always on, a cooldown on an activation, or a window
  that stacks.
- A city relic spell.
- A Shrine that levels, or anything a Shrine adds of its own.
- A choice of what a level-up raises.
- A fragment made, crafted or converted from spares.
- A drop of a relic the player has not met.
- Trading bound fragments, or a keystone for a piece.
- A relic that is lost for good.
- Random stat rolls, standalone equipment, duplicate fusion.

**Open questions:** OQ-113 in [`../open-questions.md`](../open-questions.md).
