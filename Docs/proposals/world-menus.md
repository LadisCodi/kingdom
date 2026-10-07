# World menus — redesign proposal

> **Scope:** every menu of the world board (`src/ui/world/`), rebuilt from the
> pieces and patterns the city's menus already use.
> **Status:** proposal, 2026-10-07. Each menu is implemented once its mockup
> is approved. Mockups m83–m89 in [`../art/ui/mockups/`](../art/ui/mockups),
> prompts in [`world-menus-prompts.md`](../art/ui/mockups/world-menus-prompts.md).

## 1. What is there today

| # | Menu | File | Today |
|---|---|---|---|
| 1 | The hex sheet (one sheet, eight cases) | `dispatchSheet.ts` | a title plank and lines of plain text; every action is an `action()` row with its reason in red text; no picture of the hex |
| 2 | The army sheet | `armySheet.ts` | the lair attack screen, but the enemy board is empty and the title is cut ("A camp of Orcs · 2 hex…") |
| 3 | The delve | `delveScreen.ts` | close to m65, short of it: no side depth tabs, the race rope is empty, the dock is a plain box |
| 4 | The Portal | inside `dispatchSheet.ts` | three lines and a text ranking ("1. Lady Maren — floor 4") |
| 5 | The name sheet | `nicknameSheet.ts` | already built from the kit; fine |
| 6 | The explorers chip, the minimap | `explorerChip.ts`, `minimap.ts` | already built from the kit; fine |

Reference captures: `m83-refs/ref-world-now.png` (today) and
`m83-refs/ref-city-menus.png` (the city's card, upgrade, lair, builders,
survey).

## 2. The shared pattern — the hex card

Every hex opens the same card, built like the district card (Townhall Lv 1):

- **Title plank** — the hex's name. An owned hex carries its owner's shield
  (`crestArt.ts`) at the left of the plank.
- **Head row** — a square parchment vignette with the hex's own art
  (`whex_*.png`, the art the board draws), and beside it:
  - no fog or ring pills: the board already shows both;
  - the distance as *"2 hexes · 4m march"* with a boot icon;
  - one sentence saying what it is.
- **Stat tiles** — the city card's tiles (icon, label, value): what the hex
  holds, stores, yields or guards. Never a line of text when a tile fits.
- **A red cloth ribbon** across the body for a threat (*"Orcs raid it in
  2h 10m"*), and the burnt / cut-off state.
- **Work under way** — the training row: bar, time left, total, Finish in Gems.
- **Two sections, never mixed:**
  - **THE HEX** — the ground: terrain, feature, ring, distance, march time
    across it, what it yields.
  - **DISTRICT** — what stands or can stand there, grouped with its stats
    and its button, laid out like the Townhall card's head (vignette, name,
    line, button at the right; stat tiles under it).
- **A button with a cost is the game's own** (`ref-cost-buttons.png`): a
  light parchment plate, the price on top, the slab with one verb under it.
  A blocked button keeps its warmth and shows a padlock and a reason.

## 3. Per menu

### 3.1 Fog — Unknown and Sensed (m85b, approved)

- **THE HEX**: the hex under cloud, the distance, one sentence; no tiles —
  nothing is known about the ground yet.
- **EXPLORE**: an explorer's vignette, the cost button **Explore**; tiles
  *There and back*, *To explore*.
- **EXPLORING IT PAYS** (Sensed only): reward tiles.
- Explorers free / out is not a stat of this card: it is shown up in the
  main HUD while the card is open, as the builders are when building.
- Blocked: padlock + *"Research Cartography in the Atlas"*.
- An explorer already out: the training row in place of the button.

### 3.2 Free ground — Build (m83)

- **THE HEX**: the bare hex art; *1 hex from your
  city*; tiles *Terrain*, *Feature*, *March 2m / hex*; *Yields Starmetal* on
  a deposit.
- **DISTRICT**: the district the hex takes (one per feature), its art, name
  and line; **Build** with its Gold; tiles *Food /h*, *Store*, *Build 30m*.
- The verb is **Build**, not Claim: building the district is what the
  player does.

### 3.3 Your district (m84c, m84d, m84e)

- Built, the hex and its district are one thing: one card, like a city
  building's card — no THE HEX / DISTRICT split.
  - Title plank: the district's name, the player's shield at its left.
  - Head: the district's art, what it does, the distance.
  - Four tiles: *Storage 240/360*, *Income 120 /h*, *Terrain*, *March*.
- No Collect button: a ready store is collected by tapping the district on
  the board, like a city building.
- No raid ribbon: a raid to come is the board's arrow from the camp.
- No level: a district has one level for now.
- **BUILDINGS** — the district's slots:
  - one slot; a Rural district (no feature) has two;
  - an empty slot is *Build here*; a tap opens the slot picker (m84e), the
    city's Build drawer with the buildings there are: Fortress and Chapel;
    a tap on a card builds it, as in the city's drawer;
  - a built slot shows its building (and the Fortress its level); a tap
    opens a popup with what the building does and its Upgrade button;
  - a Chapel carries a relic socket at its top right; a tap opens the relic
    picker the city's Shrine uses.
- **Rule change, not only UI**: today a hex may hold a Fortress AND a
  Chapel. Slots (one, two on Rural) are a new rule for the sim and the
  world server.
- Garrison: the army's portraits in a row, Recall.

### 3.4 A camp (m86b, approved with changes)

- **THE HEX**: the bare ground, the distance; tiles Terrain, Feature, March.
- **CAMP**: the camp's art with its difficulty seal, its creature and one
  line; the ENEMY ribbon with its power only — the player's own army is
  read on the deployment screen, after Attack.
- **BEATEN, IT PAYS**: reward tiles.
- One row, two answers to the same camp: **Negotiate** (its price on the
  plate above it, the shipped cost style) and **Attack** (no price).
- No raid ribbon: the board's arrow says which district it raids.

### 3.5 The deployment (m87b, in review)

- It is the lair's deployment screen, as it ships: ENEMY / YOUR ARMY,
  TROOPS, the price row, Quick deploy and Attack.
- A world camp's ENEMY board shows the camp's squads (done with §3.4).
- **Added**, between TROOPS and the price row, two widgets side by side:
  - **LOOT** — what beating it pays;
  - **TERRAIN** — the hex's ground and its modifiers on the fight.
- **Terrain modifiers are a new combat rule**, to be designed: e.g.
  Plains, cavalry attack up; Forest, archers' attack down. Today there are
  none, so the widget shows the ground alone until they exist.

### 3.6 The Portal (m88)

- Vignette: the Portal's art; a countdown ribbon (*Opens in 1d 16h* /
  *Closes in 5h*).
- Tiles: *Your floor 4/30*, *Clears today* as three pips, *Next floor
  power 1,240*.
- **Ranking**: the friends list's rows — rank ribbon (gold, silver, bronze,
  wood), shield, name, floor; the player's own row lit.
- Main button: **Descend** with Mana inside; shut, the padlock + time.

### 3.7 Cities — yours and a rival's (m89)

- **Yours**: shield and name on the plank; tiles for the three deposits
  with their material icon and ×3/×2/×1; a *Trade* link to the wish board.
- **A rival's**: their shield, name and Townhall level (the friends list's
  pill); *"A city can never be attacked"* as the line under it; if a friend,
  the *Profile* button the friends list opens.

### 3.8 A dungeon's card (m90, built with feedback)

- No THE HEX: a dungeon's ground does nothing to it.
- **DUNGEON**: the entrance's art, who holds it and its size, the distance,
  **Delve**; tiles Depth and Room — how far the player has gone.
- The player's army there is not on the card: the board shows it, with its
  power on a label under it (every army of the player's carries one).
- **THE RACE**: who closes it and what that pays, then every kingdom in it
  as the world ranking's rows — place, shield, name, Townhall, rooms
  cleared — in a list that scrolls in what is left of the card, opened on
  the player's own row.

### 3.9 The delve (m91b, built)

- Under the title, *Depth 2 · Room 5 of 8 · held by Orcs* and who closes
  it; no race rope.
- **The race is on the stair**: every kingdom's shield on the room it has
  reached, the player's own larger with *You*; the depth tabs down the right
  edge count the kingdoms in each.
- **No room shows its enemy**: cleared rooms ticked, the frontier's power
  and pay, the rooms ahead with their power, and only the boss still to beat
  with his face and his chest.
- **The dock is the player's army** as the deployment draws it — YOUR ARMY,
  its power, troops above (up to 6) with their losses, heroes below (up to 3)
  with their wounds — read only, then **Withdraw** and **Attack** (Mana on
  its plate), which fights the frontier at once.
- No Resupply: to send more, withdraw the army and send a new one — with
  other heroes, which rotates them.

### 3.10 The Portal's descent (m92, built)

- The Portal card's Descend opens a descent built like the delve, so the
  Portal is a place played on the map, not a ranking in a sheet:
  - a ribbon: when it closes;
  - the ranking as the race rope: each kingdom's shield at its deepest
    floor, a crown over the leader;
  - Clears today as pips on the right edge;
  - the floors going down: cleared, the frontier with its power and pay,
    the floors ahead that carry a pack or a milestone, the rest in mist;
  - the same army dock, with **Descend** (Mana) and **Recall**.
- Everything it shows exists today (floors, attempts, packs, milestones,
  the ranking): it is a screen, not a new rule.
- The Portal card's one button, **Descend**, opens it; the descent has
  **Send** (no army down), **Withdraw** and **Descend** (Mana on its plate).

## 3.12 The art these menus use

- **New** (ChatGPT, `Docs/art/originals/world-menus/`): the explorer's
  vignette (`whex_explorer`). The Portal's card shows the board's painted
  Portal, shut or open (`whex_portal`, `whex_portal_open`, Docs/art/world/portal/).
- **Recoloured** from shipped art: the purple ribbon (`ribbon-purple`, from
  the blue), the Portal's floor nodes (`portal-node*`, from the delve's) and
  its shaft's stone (`portal-rock`).
- **Reused as shipped**: the ribbons (red, blue, brown) for the boss's name,
  *You* and a kingdom's name; the wax seals for a camp's difficulty; the
  nav tabs for the depth tabs; the golden chest for a boss's pay; the gold
  rank ribbon over the Portal's leader.

### 3.11 Unchanged

- The name sheet, the explorers chip and the minimap already use the kit.

## 4. Order

1. The hex card (3.1–3.3) — the most-opened menu of the world.
2. The camp and the army sheet (3.4–3.5).
3. The Portal and the cities (3.6–3.7).
4. The dungeon sheet and the delve (3.8–3.9).

## 5. Deliberately not in this proposal

- A new kind of action or rule: every button above exists today.
- A full-screen Portal: it stays a sheet until it has more than a ranking.
- Changes to the board itself (hex art, floaters, minimap).
