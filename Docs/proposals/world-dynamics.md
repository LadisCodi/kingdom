# Proposal — a living world map: camps, scouting rewards, precious materials, the delve

> **A proposal, not a spec.** Four additions that give the world board
> something to fight, something to find and something only it yields, and a
> dungeon screen that sells the descent. How each one hooks into what is
> built: [`../features/19-world-map.md`](../features/19-world-map.md) (the
> board, explorers, districts, armies), [`../features/11-expeditions.md`](../features/11-expeditions.md)
> and [`../features/11a-ruins-ui.md`](../features/11a-ruins-ui.md) (dungeons),
> [`../features/18-garrisons-and-raids.md`](../features/18-garrisons-and-raids.md)
> (the province's lairs), [`../features/17-workshops-and-goods.md`](../features/17-workshops-and-goods.md)
> (goods). The reference is Elvenar's province map: a reward to see before
> scouting, an encounter to beat before building, precious goods only the
> map yields.
>
> **Decided 2026-10-05:** camps are per player; the stand-in rivals beat
> camps; a camp can be paid off, dearer than fighting it; precious materials
> are traded, one of the three near each player; a little early, required
> later (§1.4, §3).
> **Built:** camps (§1.1–§1.4, Gold and Hero XP loot) — the spec is now
> [`19`](../features/19-world-map.md) §5.4. Still proposed: villain-led inner
> camps (§1.2), the precious-material and pack loot (§1.5) and camp raids
> (§1.6). Scouting rewards (§2) are built too — spec
> [`19`](../features/19-world-map.md) §3.2. Precious materials (§3.1–§3.3)
> are built — spec [`19`](../features/19-world-map.md) §7.4 — and paid by
> camps and scouting, and traded on the Exchange (§3.4, spec 19 §7.5);
> what they buy is built for buildings and the Fortress (§3.5, spec 19
> §7.6). The delve (§4) is built — spec 19 §8.2 — with the rooms' precious
> lumps. Camp raids (§1.6) are built — spec 19 §5.5 — burning the district
> rather than only emptying its store, a garrisoned Fortress fighting them.
> Still proposed: the Atlas chapters' prices (on hold for the tech-tree
> rebuild) and the Portal's lumps.
> **Mockups** (prompts in [`../art/ui/mockups/world-dynamics-prompts.md`](../art/ui/mockups/world-dynamics-prompts.md)):
> [M64 the map](../art/ui/mockups/m64-world-dynamics.png) — camps, scouting
> rewards, a rich hex; [M65 the delve](../art/ui/mockups/m65-delve.png);
> [M66 the spoils](../art/ui/mockups/m66-delve-spoils.png). Mockups, not
> art: M65 draws two of the army's squads as monsters and M66 a ninth room
> and its own header; the layout is what they are for.

## 0. The loop it makes

> **Scout a hex for what it promises → beat what guards it → build its
> district → it pays, and the precious materials it yields buy what the city
> cannot make.**

Today a revealed hex is claimed at once and pays a common resource. After
this, the board has three beats per hex — **find, fight, hold** — and a
reason to go far: the far hexes promise more, are guarded harder, and yield
what the province has no other source of.

## 1. Monster camps

### 1.1 What a camp is

- **A camp is a monster army standing on a hex**: one board of creatures,
  fought once, through the ordinary resolver ([`../features/combat.md`](../features/combat.md)).
  The province's lairs are the model; the creatures are theirs (Orcs,
  Harpies, Goblins, Wolf Riders, a Drake), so their art and their
  `generateEnemy` budgets carry over.
- **A hex with a camp cannot be claimed** until the player has beaten it:
  the claim is refused *Guarded*. Nothing else about the hex changes — its
  feature, its district-to-be, its scouting reward.
- **Each player beats a camp for themselves**, as each delves a dungeon for
  themselves. Clearing it opens the hex to *you*; a rival still has its own
  fight. Once anyone holds the hex the camp no longer matters: taking it from
  its holder is an attack on the holder (19 §6).
- **A camp never comes back.** The repeatable fight is the dungeon (§4); a
  camp is a gate on ground.

### 1.2 Where camps stand

- **Rolled with the board** from its seed, in the wedge, so every seat faces
  the same camps at the same distances (19 §9).
- **About one non-site hex in three** carries a camp, rings 2–6. **Never
  beside a city**: the first ring round a city is free ground, so expansion
  starts at once.
- **Power grows with the ring**: weakest on the home ring, strongest on the
  inner ring — the inner ring's +200% has to be earned. One per wedge on the
  inner ring is led by a villain ([`../features/22-progression.md`](../features/22-progression.md))
  instead of a lair creature.

### 1.3 Seen or lurking

| Kind | Share | Before the hex is explored | After |
|---|---|---|---|
| **Standing** | ~60% | its banner rises out of the veil on a Sensed hex; its marker shows the creature and the difficulty | the same |
| **Lurking** | ~40% | nothing — the hex looks free | appears when the explorer reveals it: *an ambush* |

- The difficulty label compares the camp's power with the player's
  strongest party: **Very easy · Easy · Fair · Hard · Deadly**, the label
  and its colour on the marker, as Elvenar's *Muy fácil*.

### 1.4 Fighting it

- **An army is sent to clear it** (a new army purpose, *clear*): the same
  party screen, march, slot and busy heroes as an attack (19 §4). It fights
  on arrival.
- **Won**: the camp is gone for this player, its loot is paid when the army
  is home (§1.5), and the hex can be claimed.
- **Lost**: the army walks home with its survivors; the camp stands, whole.
- Casualties and wounds as in any fight ([`../features/combat.md`](../features/combat.md) §4).
- **Or the camp is paid off** — its *tribute*, from the hex's sheet, with no
  army and no wait: Gold and refined goods, and from the corridors in the
  camp's precious material. **A tribute is always dearer than the fight**:
  it is `tributePremium` (×1.5) the cost of training the troops a winning
  army would lose against it. The player who will not fight can still
  expand; the player who fights expands for less. A paid camp pays no loot.

### 1.5 Loot

- **Gold and Hero XP** by its power, as a dungeon room pays (11 §7.1).
- **A precious material** (§3), the one its ground yields.
- **From the corridors in**: a chance of a card pack; the villain camps of
  the inner ring a hero-fragment chest (11 §7.2).

### 1.6 Pressure, not scenery

- **A standing camp beside a district raids its store** every 8 hours, by the
  lairs' rules (18 §4): from the store, never the wallet, priced in
  production, collecting is the defence.
- So a camp next to your border is a reason to fight it now, and a camp in
  the middle of nowhere can wait. A lurking camp does not raid until it has
  been revealed.

## 2. Scouting rewards

- **Every Sensed hex shows what it promises** — a reward icon over it and
  the Gold its exploring costs, both on the map, before any explorer is sent
  (the Elvenar map: a coin and a number under the icon).
- **Rolled with the board**, by ring, and the further out the richer:

| Ring | Mostly | Sometimes |
|---|---|---|
| home (5), outer (6) | Gold, Wood, Food, Stone | Hero XP |
| corridors (2–4) | Gold, a precious material, Knowledge | Stardust, a card pack |
| inner (1) | precious materials, Stardust | a Gem pouch, a Rose pack |

- **Paid when the explorer is home**, for the hex it was sent to: *"Your
  explorer is home — 6 new hexes, and 40 Starmetal from the vein."* The
  trip's return is already the one boundary it has (19 §3.1), so no new
  timer is needed (CLAUDE.md, invariant 1).
- The reward is the hex's **target** prize only: the six hexes revealed round
  it pay nothing, so the choice of where to send an explorer is the decision.
- A revealed hex shows no reward; a hex with a lurking camp shows its reward
  like any other — the ambush is the surprise, not the prize.

## 3. Precious materials

### 3.1 The three

| Material | Its ground | What it looks like |
|---|---|---|
| **Starmetal** | a rich Mountain | a pale-blue ingot with a star fleck |
| **Heartwood** | a rich Forest | a dark-red log with golden rings |
| **Moonglass** | rich Desert | a milky glass shard |

- **A rich hex** is about one feature hex in five (and one bare desert hex in
  four): its district pays its usual resource **and** a trickle of its
  precious material into a store of its own (small: a few a day, a day's
  worth of store). The map shows a sparkle on a rich hex.
- **Goods, not coins**: they live with the refined goods
  (`state.city.goods`, 17 §1), not on the plank — the genre's four-coin rule
  holds (CLAUDE.md).

### 3.2 Where they come from

| Source | How much |
|---|---|
| A rich district's store | the steady trickle — of the player's own material only |
| A camp's loot (§1.5) | a lump, mostly the player's own material |
| A scouting reward (§2) | a lump, mostly the player's own material |
| Dungeon rooms | the "materials" line of 11 §7.1, which today pays nothing |
| Portal floors | a lump on the authored floors |

### 3.3 One near, two by trade

- **Each seat is dealt one of the three** when the board is made — two seats
  each, shuffled by the board's seed. Every rich hex in a seat's wedge yields
  that seat's material, so the ground stays the same round every city
  (19 §9) and only what it yields differs.
- The other two come **a little from camps, scouting and dungeon rooms**, and
  in quantity **only by trade**.

### 3.4 Trading

- **The Exchange**, a sheet on the world board, opened with the world: a
  list of offers from the six players.
- **An offer**: give so many of one precious material for so many of
  another. What is offered is held by the server until the offer is taken or
  withdrawn; a taken offer pays both sides at once.
- **A fair offer is one for one.** The stand-in rivals take fair offers of
  what they have after a while, so a board of one player and five rivals
  still trades. An uneven offer waits for a player.
- An offer stands for 24 hours, then comes back.

### 3.5 What they buy

- **Early: a little, and any of the three.** The first prices that name a
  precious material — a level-5 building, Fortress level 2, the Atlas's
  first chapter — ask for a few (5–20) of *any* precious material, so the
  player's own pays and the mechanic is shown, never a wall.
- **Late: named, and more.** City buildings' last levels (8–10), Fortress
  level 3 and the Atlas's later chapters name each material, the two the
  player does not yield included: the late city needs the world, and the
  world needs trade.

## 4. The delve

### 4.1 What is wrong today

- A dungeon is a hex sheet: two lines (*Depth 2 of 3 · Room 5 of 8*) and an
  *Attack* button. It does not show the descent, what a room holds, what it
  pays, how the army is faring, or that the dungeon is a race.
- `11a-ruins-ui.md` already designs the screens — the depth stack, the room
  ladder, the room sheet, the result. This proposal builds them for the world
  board's dungeons, as one full-screen menu.

### 4.2 The delve screen

A full-screen menu, opened from the dungeon's hex (the sheet keeps a
*Delve* button, nothing else).

- **The title**: the dungeon's name (rolled with it: *The Sunken Barrow*),
  its creature, and *Depth 2 · Room 5 of 8*.
- **The race strip**, under the title: every player in the dungeon as a
  banner at their room, yours highlighted; *"First to beat the Hollow King
  closes it for everyone — his chest ×2."* (19 §8.1)
- **The descent** — the body: the depth drawn as a winding stair down into
  the rock, a node per room.
  - cleared: dimmed, ticked;
  - **the frontier**: lit, its creature's portrait, its power against the
    army's, what it pays (Gold, Hero XP, Stardust, Knowledge, a precious
    material) on a small plaque;
  - ahead: hazed, power shown, rewards hidden;
  - **the boss** at the bottom of the depth: its portrait large, its chest
    open to show what is inside (Gems, hero fragments; the found book on the
    last depth).
  - Depth tabs at the side: 1 · 2 · 3, locked ones padlocked with the boss
    that opens them.
- **The army**, docked at the foot: its heroes with their HP bars, its
  squads with their counts and the losses so far, its power. Buttons:
  **Fight** (the frontier room) and **Recall**. No army camped: **Send an
  army**.

### 4.3 After a room

- The fight plays as every fight does (11a §2.7); then **the spoils**: the
  room's chest opening over the descent, its rewards flying to the plank, the
  node ticking, the stair scrolling to the next room. *Fight next* or *Back
  to the descent*.
- A defeat shows the power gap and the losing matchup (11a §5.6) and offers
  *Recall* or *Fight again*.

### 4.4 The map marker

- The dungeon's hex carries a progress ring (*13/24*) and the banners of the
  players inside it; a badge when your army is camped and can fight.

## 5. How it fits what is built

| System | What changes |
|---|---|
| **Board generation** (19 §9) | rolls camps (kind, power, standing/lurking), scouting rewards and rich hexes, in the wedge |
| **Explorers** (19 §3.1) | the trip's return pays the target's reward; a reveal can uncover a lurking camp |
| **Claiming** (19 §5.1) | refused *Guarded* while the player has not beaten the hex's camp |
| **Armies** (19 §4) | a new purpose, *clear*; the camp's loot is paid with the army home |
| **Lairs** (18) | camps reuse their creatures, enemy budgets and raid rules |
| **Dungeons** (11, 11a) | the delve screen; rooms pay a precious material |
| **Goods** (17) | three new goods with no recipe; they price late levels, Fortresses, the Atlas |
| **World server** | holds which camps each seat has beaten, and the camps' raids; the camps themselves come from the board's seed |
| **Bots** | treat every camp as beaten after a delay by its power, so they keep pace; they take fair trades (§3.4) |

## 6. Order to build it

1. **Camps** — generation, *Guarded*, the *clear* army, loot. The board stops being free real estate.
2. **Scouting rewards** — the marker on Sensed hexes and the pay-out on return.
3. **Precious materials** — the goods, a material dealt to each seat, rich
   hexes, the early sinks.
4. **The Exchange** — trading, and the rivals taking fair offers; then the
   late sinks that need it.
5. **The delve screen** — after the mockups are approved.
6. **Camp raids** (§1.6) — once camps and districts have been played.

## 6.1 Dials, in the order to reach for them

| Dial | Moves |
|---|---|
| Camp density and ring power curve | how fast the board opens |
| Standing / lurking share | how much exploring surprises |
| Tribute premium (×1.5) | how much dearer paying a camp off is than fighting it |
| Scouting rewards by ring | how hard players push outward |
| Rich-hex share and trickle | how scarce precious materials are |
| Where precious materials are spent | how much the late city depends on the world |
| Camp raid interval | how much a camp beside a border hurts |

## 7. Deliberately not in this proposal

- **Camps that come back** or wander between hexes: the dungeon is the
  repeatable fight.
- **A camp shared between players** — beaten once for everyone.
- **Trading anything but precious materials**: refined goods, resources and
  Gold stay each player's own.
- **A rate set by the market**: one for one is fair, and nothing moves it.
