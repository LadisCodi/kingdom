# 22 · Progression — how the game opens up

> **Scope.** The order in which a new kingdom meets every system: the doors
> and what opens each one, when each book opens, the places on the map that
> open a mechanic, how heroes arrive, the first relic fragment, and the pace
> the Knowledge bar sets over the first month. How a door is *taught* is
> [`23-tutorials.md`](23-tutorials.md); how a line of dialogue is shown is
> [`24-dialogue.md`](24-dialogue.md); the quest chain is
> [`12-quests.md`](12-quests.md) §2; the tree's content is
> [`tech-tree.md`](tech-tree.md).
>
> **Status: built** (`sim/doors.ts`, `sim/research.ts` `TOME_OPENS`).

## 1. The rules

1. **One new thing at a time.** A door opens when the player has a reason to
   walk through it.
2. **A door is opened by play, never by a purchase**: a quest reached, a
   building standing, a place found or cleared, a thing held.
3. **A shut door is visible.** It carries a padlock, and a tap on it says
   what opens it (§3). A readout with nothing to show yet (a pill, a gauge,
   a knob) is absent until it has something.
4. **A door never shuts again.** The first time its condition holds it is
   recorded (`tutorial.seen['door:<id>']`) and stays open.
5. **The world hands out the doors**: a lair found opens the army, a lair
   cleared opens the relics, a far tower repaired opens the world.
6. **A kingdom saved before the doors existed** (`tutorial.veteran`) has
   every door and book open, and every introduction already seen.

## 2. The first week

| When | What the player meets | Opened by |
|---|---|---|
| **Minute 0–10** · the First Morning | fog, a treasure, the quest scroll, the research book, Knowledge, tapping, Mana, **repairing the old House**, Food, a villager, rent | the scripted opening ([`23-tutorials.md`](23-tutorials.md) §3) |
| **Session 1** | silhouettes in the fog; the old plots, the old Farm and workers; the first chest and **the Bag**; **the Build tab** and a second House; the old Sawmill; Townhall 2, **the Store** and **the Survey** | the quest chain |
| **Session 1–2** | Agriculture, Farming and Saws: more Houses, crop plots, a second Sawmill, the first levels, and **the first decorations** | the quest chain |
| **Session 2** · ~hour 2 | **the Orcs**: a lair, raids, **the Warden** steps forward, the Warrior, the Barracks, soldiers | revealing the lair's ground |
| **Session 2–3** | the first battle; **the first relic fragment** — the Staff of Renewal's | clearing the Orcs |
| **Session 2–3** | **the Watchtower**, repaired with the lens the Orcs carried: **the world** and **the Atlas** | the Orcs' prize; the repair, forced by a scene |
| **Day 1–2** | the Thorned Shrine repaired and the Staff in it; the Sanctum; Bureaucracy, the end of chapter 2 | the Orcs gone; the chain |
| **Day 2** | **the Tavern**: the banner, **the first hero**, **the Sagas** | building the Tavern |
| **Day 2–3** | Townhall 3, Mining | the chain |
| **Day 4–6** | Townhall 4, chapter 4, workshops and refined goods; the Harpies | Magistracy; 160 cells revealed |
| **Week 2+** | Harmony, Townhall 5–10, the deep lairs, the world board | the Townhall ladder |

## 3. The doors

| Door | Opens when | While shut |
|---|---|---|
| **Research** (nav) and the **Knowledge** tab | the quest `Woodcraft` is reached, or a technology is researched | Research padlocked — *Finish your first task to open this.*; the tab absent |
| **Build** (nav) | the quest `GrowingTown` is reached, or a building the fog did not keep stands | padlocked — *Settle a second villager to open this.* |
| **Bag** (nav) | an item is held, or a relic fragment | padlocked — *Find a chest to open this.* |
| **Heroes** (nav) and **the banner** | a **Tavern** stands | padlocked — *Build a Tavern to open this.*; the banner padlocked in the Store |
| **Relics** (the relic screens) | the first relic fragment is held | padlocked — *Clear a lair to open this.* |
| **Store** (nav), and the Gems on the plank | the Townhall reaches **level 2** | padlocked — *Raise the Townhall to level 2 to open this.* |
| **Survey** pill ([`25-the-survey.md`](25-the-survey.md)) | the Townhall reaches **level 2** | absent |
| **The world** (the map knob above the nav) | the **Watchtower** stands, repaired | hidden until the Watchtower is sighted, then padlocked — *Repair the Watchtower to open this.* |
| **Friends** (knob) | the world is open and the kingdom has chosen its name ([`15-social.md`](15-social.md) §2.1) | absent |
| **The tree** | always open | — |
| **The Sagas** (found) | a **Tavern** stands | not on the shelf |
| **The Atlas** (found) | the **Watchtower** stands, repaired | not on the shelf |

- The nav bar holds Store, Bag, Heroes, Research and Build.
- A padlocked tab is its plate and a brass padlock — no icon, no name. A tap
  shakes the padlock and shows its line, which says what opens it; it never
  opens anything.
- **A door opening is an event**: the padlock breaks off, its splash names
  it, and its introduction plays ([`23-tutorials.md`](23-tutorials.md) §4,
  §4.6). A book opening is announced the same way.
- A found book has no bookmark until it is found.

## 4. The books

| Book | Kind | Opens when | Remit |
|---|---|---|---|
| **Kingdom** | the tree | from the first minute | everything the kingdom learns, in nine chapters |
| **Sagas** | found | a Tavern stands | heroes, and the Tavern that hosts them |
| **Atlas** | found | the Watchtower is repaired | the world board |

- **The tree is one book** read in chapters, each opened on revealed cells and
  closed by a finale that opens the next Townhall level
  ([`07-research.md`](07-research.md) §2.1).
- **A found book opens on a fact about the world, never a research.**
- **What opens a book is code** (`sim/research.ts`, `TOME_OPENS`); what is in
  it is the tree file.
- A book, once open, is open for ever.

## 5. Places that open a mechanic

| Place | Where | Found | Cleared or repaired |
|---|---|---|---|
| **The Orcs** (lair, tier 1) | south-east of the Townhall; its ground lies past the first Townhall's reach, so it is found at Townhall 2 | **the Warden steps forward**; the raid clock starts | the hoard, 3 Knowledge, Hero XP, **the Watchtower's lens**, a speed-up, and **the Staff of Renewal's first fragment** — the Orcs are its door |
| **The Thorned Shrine** (an abandoned Shrine) | inside the Orcs' ground | — | repaired once the Orcs fall; the first Shrine standing hands over **the Staff of Renewal** whole and hosts it ([`23-tutorials.md`](23-tutorials.md) §4.4) |
| **The Watchtower** (an abandoned building) | 5 rings north of the Townhall, reached at Townhall 2 | its lens is in the Orcs' prize | repaired: **the world and the Atlas open**; discovers **8 rings** round it; +10 max Mana, 3 Knowledge |

- **Nothing on a standing lair's ground can be claimed or repaired.** The
  Thorned Shrine waits for the Orcs to fall.
- **The Watchtower is repaired, not claimed**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3): it needs **the
  Watchtower's lens** from the Bag, plus 200 Gold, 100 Wood and a builder for
  one minute.
- **The repair is forced**: the moment it can be paid, on the main screen, a
  scene takes the player to the tower and lets them press only *Repair*. When
  the tower stands, a second takes them out to the world
  ([`23-tutorials.md`](23-tutorials.md) §4.3).
- **The world door opens the world board**
  ([`19-world-map.md`](19-world-map.md)). The kingdom's explorer is ready the
  moment the board opens, and Wren sends it on its first trip, free
  ([`19-world-map.md`](19-world-map.md) §3.3).

## 6. The Tavern and the heroes

- **The Tavern** is a building, one per city, 2×1, on the Economy tab,
  unlocked by **Hospitality** (chapter 2).
- **Standing, it opens the Heroes tab, the banner and the Sagas.** The banner
  lives in the Tavern's card; the Store keeps a copy.
- **Every level adds +10% Hero XP** (`buildings` › Tavern ›
  `heroXpBonusPerLevel`). Its levels 2–5 are unlocked by the Sagas.
- **Every hero comes from the banner.** The kingdom starts with none.
- **The first call is free and always a hero.** Quest `FirstSummon` asks for
  it; `Fellowship` asks for two heroes.
- **The first two calls, on either banner, are each a new hero**
  (`heroLadder` › `firstCallsNewHero`).
- Before the Tavern the attack sheet shows no hero slots: the Orcs are fought
  by soldiers alone.
- The Warden and Bess speak in the tutorial as the captain of the guard and
  the Tavern keeper; as heroes they are called like any other.

## 7. The first relic fragment

- **Clearing the Orcs hands over the Staff of Renewal's first fragment**: the
  lair is that relic's door ([`09-relics.md`](09-relics.md)). Holding it opens
  Relics.
- The quest `DriveThemOut` — clear the first lair — pays **one more relic
  fragment** (`quests` › `rewardFragments`).
- The first Shrine standing then hands over the Staff restored, so the first
  relic is met, restored and hosted through play before any price is shown.

## 8. The pace of the tree

### 8.1 What Knowledge a day brings

| Source | A day |
|---|---|
| the drip, three visits a day | ~23 (at most 24) |
| the quest chain | 35 in all, 26 of it by quest 46 (`Attuned`) |
| a landmark claimed, the Watchtower repaired | 3 each |
| a lair cleared | 3 each |

### 8.2 The budget

- **A chapter's spine costs what the three-visits-a-day player earns in its
  days**; the optional cards are Knowledge on top. Per chapter:
  [`tech-tree.md`](tech-tree.md) §1.

| Townhall | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| **Target day** | 1 | 2 | 5 | 7 | 10 | 14 | 20 | 24 | 30 |

- The opening's chapters (1 and 2) are funded by the quest chain.

## 9. The shape of a chapter

Columns 1–3 wide, read down the page, converging on one finale:

| Card | Share | Examples |
|---|---|---|
| **Opens a building** or a building level | ~4 in 10 | Townhouses → Housing L4; Ironmongery → the producers L5 |
| **A filler**: a real step on something the player already uses | ~4 in 10 | +15% Wood per strike, +25% store in the Farm |
| **Optional**: off the spine | ~2 in 10 | an army stat step, a unit's rank |
| **The finale** | one | Charter → Townhall 5 |

- **Every bonus is a positive percentage or step that stacks.** A wait is
  moved by a **speed** the time is divided by
  ([`07-research.md`](07-research.md) §1.2).
- **No discounts.** A card makes the kingdom produce more.
- **A yield bonus is a percentage, not a unit**; fractions carry.
- **Nothing on the tap or the Mana pool.**

## 10. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| What each card costs | [`tech-tree.md`](tech-tree.md) | `?dev=data#tree` |
| What each chapter asks for in revealed cells | 0 · 20 · 100 · 160 · 220 · 280 · 340 · 400 · 460 | `?dev=data#tree` (`eras`) |
| What finishing a chapter pays | — · 1 · 1 · 1 · 2 · 2 · 2 · 3 · 4 relic fragments | `tech-tree.json` (`eraRewards`) |
| The Watchtower's place | (−3, −5) | `?dev=data#map` (an abandoned building) |
| The Watchtower's price, minute and lens | 200 Gold, 100 Wood · 60 s · `WatchtowerLens` | `buildings` › Watchtower (`costPerLevel`, `buildDurationSeconds`, `repairItem`) |
| Where the lens comes from | the tier-1 lair's prize — the Orcs | `garrisons` › tier 1 › `rewardItems` |
| The Watchtower's discover radius | 8 | `buildings` › Watchtower › `fogDiscoverRadius` |
| Which relic each lair is the door of | the Orcs → the Staff of Renewal | `artifacts` › `door` |
| The first quest fragment | 1 on `DriveThemOut` | `quests` › `rewardFragments` |
| Hero XP per Tavern level | +10% | `buildings` › Tavern › `heroXpBonusPerLevel` |
| New heroes guaranteed | the first 2 calls | `heroLadder` › `firstCallsNewHero` |
| What opens each door, and its padlock line | §3 | `sim/doors.ts` (`OPENS`, `DOOR_HINT`) |
| What opens a found book | §4 | `sim/research.ts` `TOME_OPENS` |

## 11. Deliberately not in this design

- A door opened by Gems, Gold or an ad.
- A door that shuts again, or a book that is lost.
- A hidden door with no padlock, except a found book and the readouts that
  have nothing to show yet.
- A technology that opens a book.
- A tutorial level or sandbox separate from the real kingdom: the First
  Morning is played on the save.
- A hero granted by the story rather than called.
- A Tavern that sells calls. The banner sells them; the Tavern hosts it.

**Open questions:** **OQ-115**, **OQ-116**.
