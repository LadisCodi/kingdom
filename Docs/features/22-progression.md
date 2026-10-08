# 22 · Progression — how the game opens up

> **Scope.** The order in which a new kingdom meets every system: the doors
> and what opens each one, when each book opens, the places on the map that
> open a mechanic when claimed, how heroes arrive, the first card pack, and
> the pace the Knowledge bar sets over the first month. How a door is
> *taught* is [`23-tutorials.md`](23-tutorials.md). How a line of dialogue is
> shown is [`24-dialogue.md`](24-dialogue.md). The quest chain that walks the
> player through it is [`12-quests.md`](12-quests.md) §2. The tree's content
> is [`tech-tree.md`](tech-tree.md).
>
> **Status: built.**

## 1. The rules

1. **One new thing at a time.** A door opens when the player has a reason to
   walk through it, never before.
2. **A door is opened by play, never by a purchase.** It opens on a fact
   about the kingdom: a quest reached, a building standing, a place found or
   claimed.
3. **A shut door is visible.** It carries a padlock, and a tap on it says
   what opens it (§3). A readout with nothing to show yet (a pill, a gauge)
   is simply absent until it has something.
4. **A door never shuts again.** Every condition is one the kingdom can only
   gain.
5. **The world teaches the pace.** The map hands out the doors: a lair
   found opens the army, a landmark claimed opens magic, a far tower
   claimed opens the world.
6. **A kingdom saved before this design opens with every door open**, and
   every introduction already seen.

## 2. The first week

| When | What the player meets | Opened by |
|---|---|---|
| **Minute 0–10** · the First Morning | fog, a treasure, the quest scroll, the research tree, Knowledge, tapping, Mana, **repairing the old House**, Food, a villager, rent | the scripted opening ([`23-tutorials.md`](23-tutorials.md) §3) |
| **Session 1** | silhouettes in the fog; the old plots, the old Farm and workers; **the Build tab** and a second House; the old Sawmill; Townhall 2 | the quest chain |
| **Session 1–2** | Agriculture, Farming and Saws: building more of what the fog kept | the quest chain |
| **Session 2** · ~hour 2 | **the Orcs**: a lair, raids, **the Warden** (captain of the guard) steps forward, the Warrior, the Barracks, soldiers | revealing a lair's ground |
| **Session 2–3** | the first battle, the first card pack, **Relics** | clearing the Orcs |
| **Session 2–3** | **the Watchtower**, repaired with the lens the Orcs carried: the world door, **the Atlas** | the Orcs' prize; the repair, forced by a scene |
| **Day 1–2** | the Thorned Shrine, the Sanctum; Bureaucracy, the end of chapter 2 | claiming the shrine; the chain |
| **Day 2** | **the Tavern**: the banner, **the first hero**, **the Sagas** | building the Tavern |
| **Day 2–3** | Townhall 3, Mining, the Harpies | the chain; the fog |
| **Day 4–6** | Townhall 4, chapter 4, workshops and refined goods | Magistracy; 160 cells revealed |
| **Week 2+** | decorations and Harmony, Townhall 5–10, the deep lairs | the Townhall ladder |

## 3. The doors

| Door | Opens when | While shut |
|---|---|---|
| **Research** (nav) | the quest `Woodcraft` is reached | padlocked — *Finish your first task to open this* |
| **Build** (nav) | the quest `GrowingTown` is reached — the first building the fog did not keep | padlocked — *Settle a second villager to open this* |
| **Heroes** (nav) | a **Tavern** stands | padlocked — *Build a Tavern to open this* |
| **Relics** (nav) | the kingdom has held a card or a pack | padlocked — *Clear a lair to open this* |
| **Store** (nav), and the Gems on the plank | the Townhall reaches **level 2** | padlocked — *Raise the Townhall to level 2 to open this* |
| **Survey** pill ([`25-the-survey.md`](25-the-survey.md)) | the Townhall reaches **level 2**, with the Store | absent |
| **The world** (map knob, bottom right above the nav) | the **Watchtower** stands, repaired | hidden until the Watchtower is sighted, then padlocked — *Repair the Watchtower to open this* |
| **Knowledge** tab | Research opens | absent |
| **Season** pill | a card or a pack held | absent |
| **The tree** | always open | — |
| **The Sagas** (found) | a **Tavern** stands | not on the shelf |
| **The Atlas** (found) | the **Watchtower** stands, repaired | not on the shelf |
| **The banner** (in the Store and the Tavern) | a Tavern stands | padlocked in the Store |

- A padlocked tab is its empty plate and a brass padlock — **no icon, no
  name**: what is behind it stays a surprise. A tap shakes the padlock and
  shows its line, which says what opens it and not what it is; it never
  opens anything.
- **A door opening is an event**: the padlock breaks off with a short
  animation, its splash names it, and the introduction for that door plays
  ([`23-tutorials.md`](23-tutorials.md) §4, §4.6). A book opening is
  announced the same way.
- The general books show their bookmark padlocked; a found book has no
  bookmark until it is found — a book the player has never heard of is not a
  promise.

## 4. The books

| Book | Kind | Opens when | Remit |
|---|---|---|---|
| **Kingdom** | the tree | from the first minute | everything the kingdom learns, in nine chapters |
| **Sagas** | found | a Tavern stands | heroes, and the Tavern that hosts them |
| **Atlas** | found | the Watchtower is repaired | sight, landmarks, and the world beyond |

- **The tree is one book** read in chapters, each opened on revealed cells and
  closed by a finale that opens the next Townhall level
  ([`07-research.md`](07-research.md) §2.1).
- **Opening a found book is a fact about the world, never a research.** No
  technology opens a book.
- **What makes a book open is code** (`sim/research.ts`, `TOME_OPENS`); what is
  in it is the tree file.
- A book, once open, is open for ever.
- **Found books are the pattern for everything later**: a far lair, an event
  or the world map may each pay a book. The two above are the first.

## 5. Places that open a mechanic

| Place | Where | Found | Claimed or cleared |
|---|---|---|---|
| **The Orcs** (lair, tier 1) | 6 rings south of the Townhall, past the shrine; its ground (radius 2) lies past the first Townhall's reach, so it is found at Townhall 2 | **the Warden steps forward**; the raid clock starts | the hoard, 3 Knowledge, Hero XP; **the first card pack** (quest `DriveThemOut`) |
| **The Thorned Shrine** (landmark) | inside the Orcs' ground | — | +10 max Mana, 3 Knowledge |
| **The Watchtower** (a ruin) | 5 rings north of the Townhall — reached at Townhall 2 | its lens is in the Orcs' prize | repaired in a minute: **the world door and the Atlas open**; discovers **8 rings** round it; +10 max Mana, 3 Knowledge |

- **A landmark inside a standing lair's ground cannot be claimed.** The
  Thorned Shrine waits for the Orcs to fall.
- **The Watchtower is repaired, not claimed**: an abandoned building
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3) that needs **the
  Watchtower's lens** — the Orcs' prize hands it over — plus 200 Gold, 100
  Wood and a builder for one minute.
- **The repair is forced**: the moment it can be paid, on the main screen, a
  scene takes the player to the tower and lets them press only *Repair*. When
  the tower stands and nothing is open, a second takes them out to the world
  ([`23-tutorials.md`](23-tutorials.md) §4.3).
- **The world door opens the world board**
  ([`19-world-map.md`](19-world-map.md)): the knob takes the player out to
  the board and, wearing the castle, back home. The kingdom's own explorer is
  ready the moment the board opens, and Wren sends it on its first trip, free
  ([`19-world-map.md`](19-world-map.md) §3.3).

## 6. The Tavern and the heroes

- **The Tavern** is a building, one per city, 2×1, on the Economy tab,
  unlocked by **Hospitality** (chapter 2 of the tree).
- **L1 opens the Heroes tab, the banner and the Sagas.** The banner lives in
  the Tavern's card; the Store keeps a copy, padlocked until a Tavern stands.
- **Every level adds +10% Hero XP** (`buildings` › `heroXpBonusPerLevel`).
  Its levels 2–5 are unlocked by the Sagas.
- **Every hero comes from the banner.** The kingdom starts with none.
- **The first call is free and always a hero** — a random one. Quest
  `FirstSummon` asks for it; `Fellowship` asks for two heroes later.
- **The first two calls, on either banner, are each a new hero**
  (`heroLadder` › `firstCallsNewHero`).
- Before the Tavern the attack sheet shows no hero slots: the Orcs are
  fought by soldiers alone.
- The Warden and Bess speak in the tutorial as the captain of the guard and
  the Tavern keeper; as heroes they are called like any other.

## 7. The first card pack

- The quest `DriveThemOut` — clear the first lair — pays a **Green pack** — the first rung of the pack ladder
  (`quests` › `rewardPack`).
- Holding it opens the Relics tab and the season pill, so the collection is
  met through play before any price is shown.

## 8. The pace of the tree

### 8.1 What Knowledge a day brings

| Source | A day |
|---|---|
| the drip, three visits a day | ~23 (at most 24) |
| the quest chain, days 1–2 | ~28 in all |
| a landmark claimed | 3 each |
| a lair cleared | 3 each |

### 8.2 The budget

- **A chapter's spine costs what the three-visits-a-day player earns in its
  days**; the dead ends are Knowledge on top, for a player who buys it or
  plays more. Per chapter: [`tech-tree.md`](tech-tree.md) §1.

| Townhall | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| **Target day** | 1 | 2 | 5 | 7 | 10 | 14 | 20 | 24 | 30 |

- The opening's chapters (1 and 2) are funded by the quest chain.

## 9. The shape of a chapter

Columns 1–3 wide, read down the page, that converge on one finale:

| Card | Share | Examples |
|---|---|---|
| **Opens a building** or a building level | ~4 in 10 | Townhouses → Housing L4; Ironmongery → the producers L5 |
| **A filler**: a real step on something the player already uses | ~4 in 10 | +15% Wood per strike, +25% store in the Farm |
| **A dead end**: optional | ~2 in 10 | an army stat step |
| **The finale** | one | Charter → Townhall 5 |

- **Every bonus is a positive percentage or step that stacks.** It never
  reduces a number: a wait is moved by a **speed** the time is divided by
  ([`07-research.md`](07-research.md) §1.2).
- **No discounts.** A card never makes a thing cheaper; it makes the kingdom
  produce more.
- **A yield bonus is a percentage, not a unit**; fractions carry.
- **Nothing on the tap or the Mana pool.**

## 10. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| What each card costs | [`tech-tree.md`](tech-tree.md) | `?dev=data#tree` |
| What each chapter asks for in revealed cells | 0 · 20 · 100 · 160 · 220 · 280 · 340 · 400 · 460 | `?dev=data#tree` |
| What finishing a chapter pays | a card pack each | `?dev=data#tree` (`eraRewards`) |
| The Watchtower's place | (−3, −5) | `?dev=data#map` (an abandoned building) |
| The Watchtower's price, minute and lens | 200 Gold, 100 Wood · 60 s · `WatchtowerLens` | `buildings` › Watchtower (`costPerLevel`, `buildDurationSeconds`, `repairItem`) |
| Where the lens comes from | the tier-1 lair's prize — the Orcs | `garrisons` › tier 1 › `rewardItems` |
| The Watchtower's discover radius | 8 | `buildings` › Watchtower › `fogDiscoverRadius` |
| The first pack | a Green pack on `DriveThemOut` | `quests` › `rewardPack` |
| Hero XP per Tavern level | +10% | `buildings` › `Tavern` › `heroXpBonusPerLevel` |
| Which quest opens Research and Build | `Woodcraft` · `GrowingTown` | `sim/doors.ts` |
| What opens a found book | §4 | `sim/research.ts` `TOME_OPENS` |

## 11. Deliberately not in this design

- A door opened by Gems, Gold or an ad.
- A door that shuts again, or a book that is lost.
- A hidden door with no padlock: every door the player will one day use is on
  screen from the first minute, except a found book.
- A technology that opens a book.
- A tutorial level or sandbox separate from the real kingdom: the First
  Morning is played on the save.
- A hero granted by the story rather than called.
- A Tavern that sells calls. The banner sells them; the Tavern hosts it.

**Open questions:** **OQ-115**, **OQ-116**.
