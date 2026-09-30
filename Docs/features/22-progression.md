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
> **Status: designed 2026-10-01; built on `feat/ftue`.**

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
| **Minute 0–10** · the First Morning | fog, the quest scroll, the Book of Civics, Knowledge, tapping, Mana, building, Food, a villager, rent | the scripted opening ([`23-tutorials.md`](23-tutorials.md) §3) |
| **Session 1** | farms, workers, the Sawmill, Townhall 2, the daily chest | the quest chain |
| **Session 2** · ~hour 2 | **the Orcs**: a lair, raids, **the Warden**, **the Book of Warfare**, the Barracks, soldiers | revealing the Orcs' ground |
| **Session 2–3** | the first battle, the first card pack, **Relics** | clearing the Orcs |
| **Day 1–2** | the Thorned Shrine, **the Book of Magic**, the Sanctum; era 2 of every book | claiming the shrine; 30 cells revealed |
| **Day 2** | **the Tavern**: heroes, the banner, **the Sagas** | building the Tavern |
| **Day 2–3** | Townhall 3, Mining, the Harpies | the chain; the fog |
| **Day 4–6** | Townhall 4, era 3, workshops and refined goods | Magistracy; 100 cells revealed |
| **Day 5–7** | **the Watchtower**: the world door, **the Atlas** | claiming the Watchtower |
| **Week 2+** | decorations and Harmony, Townhall 5–10, the deep lairs | the Townhall ladder |

## 3. The doors

| Door | Opens when | While shut |
|---|---|---|
| **Research** (nav) | the quest `Woodcraft` is reached | padlocked — *Finish your first task* |
| **Build** (nav) | the quest `ARoof` is reached | padlocked — *Gather some Wood first* |
| **Heroes** (nav) | a **Tavern** stands | padlocked — *Build a Tavern to call heroes* |
| **Relics** (nav) | the kingdom has held a card or a pack | padlocked — *Clear a lair to find your first cards* |
| **Store** (nav) | always open | — |
| **The world** (map knob, right edge) | the **Watchtower** is claimed | padlocked — *Claim the Watchtower to see beyond the province* |
| **Knowledge** tab | Research opens | absent |
| **Daily chest** pill | the First Morning ends (quest `TaxDay` claimed) | absent |
| **Season** pill | as today — a card or a pack held | absent |
| **The Book of Civics** | always open | — |
| **The Book of Warfare** | the first lair is **discovered** | a padlocked bookmark — *Find a lair* |
| **The Book of Magic** | the first landmark is **claimed** | a padlocked bookmark — *Claim a landmark* |
| **The Sagas** (found) | a **Tavern** stands | not on the shelf |
| **The Atlas** (found) | the **Watchtower** is claimed | not on the shelf |
| **The banner** (in the Store and the Tavern) | a Tavern stands | padlocked in the Store |

- A padlocked door is drawn in its place, greyed, with a brass padlock over
  its icon. A tap shakes the padlock and shows its line in a tooltip; it
  never opens anything.
- **A door opening is an event**: the padlock breaks off with a short
  animation and the introduction for that door plays
  ([`23-tutorials.md`](23-tutorials.md) §4).
- The general books show their bookmark padlocked; a found book has no
  bookmark until it is found — a book the player has never heard of is not a
  promise.

## 4. The books

| Book | Kind | Opens when | Remit |
|---|---|---|---|
| **Civics** | general | from the first minute | the city and its purse |
| **Warfare** | general | the first lair is discovered | the army, and the lairs it clears |
| **Magic** | general | the first landmark is claimed | Mana, Knowledge, the Sanctum, the water and the heights |
| **Sagas** | found | a Tavern stands | heroes, and the Tavern that hosts them |
| **Atlas** | found | the Watchtower is claimed | sight, landmarks, and the world beyond |

- **Opening a book is a fact about the world, never a research.** No
  technology opens a book.
- Inside an open book the era bars still pace the page, on cells revealed
  ([`07-research.md`](07-research.md) §2.1).
- **What makes a book open is code** (`sim/research.ts`, `TOME_OPENS`); what is
  in it is the tree file.
- A book, once open, is open for ever.
- **Found books are the pattern for everything later**: a far lair, an event
  or the world map may each pay a book. The two above are the first.

## 5. Places that open a mechanic

| Place | Where | Found | Claimed or cleared |
|---|---|---|---|
| **The Orcs** (lair, tier 1) | 5 rings east of the Townhall | **the Warden joins**; the Book of Warfare opens; the raid clock starts | the hoard, 15 Knowledge, Hero XP; **the first card pack** (quest `DriveThemOut`) |
| **The Thorned Shrine** (landmark) | inside the Orcs' ground | — | +10 max Mana, 5 Knowledge; **the Book of Magic opens** |
| **The Watchtower** (landmark, new kind) | 8 rings north of the Townhall, 10,000 Gold | — | **the world door and the Atlas open**; discovers **8 rings** round it instead of 5; +10 max Mana, 5 Knowledge |

- **A landmark inside a standing lair's ground cannot be claimed.** The
  Thorned Shrine waits for the Orcs to fall, so the book of the army always
  opens before the book of magic.
- The Watchtower is claimed like any landmark. Its kind is what makes it a
  door; its price is authored in the map editor.
- **The world door opens a preview** until the world map is built: a sheet
  showing the province as one hex among its neighbours, the other kingdoms
  in fog, and *The roads beyond the mountains are being scouted.*

## 6. The Tavern and the heroes

- **The Tavern** is a building, one per city, 2×1, on the Economy tab,
  unlocked by **Hospitality** (Civics, era 2's first row).
- **L1 opens the Heroes tab, the banner and the Sagas.** The banner lives in
  the Tavern's card; the Store keeps a copy, padlocked until a Tavern stands.
- **Every level adds +10% Hero XP** (`buildings` › `heroXpBonusPerLevel`).
  Its levels 2–5 are unlocked by the Sagas.
- **Heroes arrive by story, then by the banner:**

| Hero | Arrives | How |
|---|---|---|
| **The Warden** | the moment the first lair is discovered | granted — she is the captain of the guard, and the first fight needs a hero |
| **Bess, the Cook** | the moment the first Tavern is finished | granted — she runs the Tavern |
| **The first call** | on the banner, free | **always a hero**: the free call cannot miss |

- A new kingdom owns **no hero** until the first lair.

## 7. The first card pack

- The quest `DriveThemOut` — clear the first lair — pays a **Green pack** — the first rung of the pack ladder
  (`quests` › `rewardPack`).
- Holding it opens the Relics tab and the season pill, so the collection is
  met through play before any price is shown.

## 8. The pace of the tree

### 8.1 What Knowledge a day brings

| Source | A day |
|---|---|
| the drip, three visits a day | ~20 (at most 24) |
| the quest chain, days 1–2 | ~27 in all |
| a landmark claimed | 5 each (+Wayposts) |
| a lair cleared | 15 each (+Bounties) |

### 8.2 What a card costs

| Era | Minor | Major | A full band, all books |
|---|---|---|---|
| **1** | 1–2 K | 2 K | ~75 K — the quest chain funds Civics' |
| **2** | 2–4 K | 4–8 K | ~190 K |
| **3** | 6–12 K | 15–25 K | ~800 K |
| **4** | — | 40 K (the keystones) | 80 K |

### 8.3 The target

| Milestone | Day |
|---|---|
| Civics era 1 done | 1 |
| era 2 open in every book | 1–2 |
| Townhall 3 (Bureaucracy) | 2 |
| Townhall 4 (Magistracy) | 5–6 |
| era 2 done in every open book | ~10 |
| era 3 done | ~6 weeks |

- **The tree is the long arc.** It outlasts the thirty-day window by design;
  the Townhall ladder and the lairs carry the month, the tree the season
  after.

## 9. The shape of a book

A page mixes four kinds of card, in the proportion Elvenar's research does:

| Card | Share | Examples |
|---|---|---|
| **Opens a building** | ~1 in 8 | Saws → the Sawmill; Hospitality → the Tavern |
| **Opens a building level** | ~1 in 8 | Urban Planning → Housing L2; Timber Framing → Sawmill L3 |
| **Opens a mechanic** | a few per book | Forestry → the forest tap; Sailing → the water |
| **A small economy bonus** | the rest | +10% Wood from forests, +10% build speed |

- **Every bonus is a positive percentage that stacks.** It never reduces a
  number: a wait is moved by a **speed** the time is divided by, so a bonus
  can climb for ever without reaching zero
  ([`07-research.md`](07-research.md) §1.2).
- **No discounts.** A card never makes a thing cheaper; it makes the kingdom
  produce more.
- **A yield bonus is a percentage, not a unit.** *+10% Wood from forests* is
  the same share of a level-1 city's Wood and a level-10 city's; fractions
  carry, so a crew may bring home 1 on one trip and 2 on the next.

## 10. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| What each card costs | §8.2 | `?dev=data#tree` |
| What each band asks for in revealed cells | 0 · 30 · 100 · 220 | `?dev=data#tree` |
| The Watchtower's place and price | (0, −8) · 10,000 Gold | `?dev=data#map` |
| The Watchtower's discover radius | 8 | `exploration` › `fog.watchtowerDiscoverRadius` |
| The first pack | a Green pack on `DriveThemOut` | `quests` › `rewardPack` |
| Hero XP per Tavern level | +10% | `buildings` › `Tavern` › `heroXpBonusPerLevel` |
| Which quest opens Research and Build | `Woodcraft` · `ARoof` | `sim/unlocks.ts` |
| What opens a book | §4 | `sim/research.ts` `TOME_OPENS` |

## 11. Deliberately not in this design

- A door opened by Gems, Gold or an ad.
- A door that shuts again, or a book that is lost.
- A hidden door with no padlock: every door the player will one day use is on
  screen from the first minute, except a found book.
- A technology that opens a book.
- A tutorial level or sandbox separate from the real kingdom: the First
  Morning is played on the save.
- Heroes before the first lair; a random first free call.
- A Tavern that sells calls. The banner sells them; the Tavern hosts it.
- The world map itself — the door opens a preview until it is built
  (**OQ-114**).

**Open questions:** **OQ-114**, **OQ-115**, **OQ-116**.
