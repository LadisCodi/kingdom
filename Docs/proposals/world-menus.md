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

### 3.1 Fog — Unknown and Sensed (m85)

- Vignette: the hex under cloud; a Sensed hex shows its shapes faintly.
- Tiles: *There and back* (compass), *To explore* (hourglass), *Explorers*
  2/3 (the explorer's face).
- **What exploring pays**: reward tiles (coins, Stardust…), Sensed only.
- Main button: **Explore** with its Gold inside. Blocked: padlock +
  *"Research Cartography in the Atlas"* with a *Go* link to the book.
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

### 3.4 A camp (m86)

- Vignette: the camp's art (`whex_camp_*`), the difficulty as a wax seal
  (*Easy … Deadly*, its colour).
- **ENEMY / YOUR ARMY** as the lair screen's two ribbons, power against
  power — the comparison is the whole decision.
- **Beaten, it pays**: reward tiles.
- Ribbon: *"It raids your Farm Lands in 1h 20m — beat it first"*.
- Main button: **Attack**. Secondary row: **Pay off** with its price inside
  and *"The camp leaves, and pays nothing"*.

### 3.5 The army sheet (m87)

- Keep the lair attack screen; fix what the world adds:
  - title = the target (*"Orc camp"*), never the route;
  - under the title a parchment strip: the target's vignette,
    *2 hexes · 4m march*, and the purpose (*Attack / Claim / Garrison /
    Delve / Descend*);
  - the ENEMY board shows the camp's creatures (their busts and counts),
    not an empty board; for a dungeon room, the room's guard; for a
    garrison or a claim, the board is replaced by the destination.
- The Mana price inside the main button.

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

### 3.8 A dungeon (sheet)

- Vignette: the dungeon's art; tiles *Depth 1/3*, *Room 1/8*, *Kingdoms
  racing 3*; the race rope in small. Main button: **Delve** (opens 3.9).

### 3.9 The delve

- No new mockup: m65 and m66 are the target. Close the gaps:
  - depths as the right-hand tab column (lit, padlocked) in place of the
    three buttons;
  - the race as banners on the rope, with each kingdom's shield;
  - the dock as the wooden bar of m65: hero faces with HP, troops ×n, Power,
    Fight (red) and Recall.

### 3.10 Unchanged

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
