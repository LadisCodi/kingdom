# UI-I2…I4 — one icon per Bag item

Every consumable in `src/sim/data/game/items.json` gets its own atlas icon,
named by its item id (`GeneralSpeedup1h`, `GoldChest8h`, …), the way the keys
already are. A timed item carries its duration on a ribbon drawn into the
art, and a speed-up shows what it speeds up. Attach `ref-consumables.png`:
the item icons already in the atlas, which these replace and sit beside.

## Shared block (end of every prompt)

GENERATE A NEW IMAGE. Do not edit or export the attached file: it is ONLY the style reference — icons already in this game's atlas. Your icons will sit right next to them; match their style exactly: the same chunky cartoon shapes, the same dark-brown outline, the same saturated colours with one soft shade and one highlight, the same gold trims, the same front three-quarter view.

THE RIBBON: every icon that has a label carries it on the same short red cloth ribbon (banner with notched ends) laid across the bottom of the icon, in front of the object, about 70% of the icon's width. The label is in big bold rounded cream-white letters with a thick dark-brown outline, filling the ribbon's height — it must stay readable when the icon is shown 64 px wide. Write each label EXACTLY as given, nothing else on the ribbon.

One object per cell, centred, each filling about 80% of its cell, generous empty margins; nothing may cross a cell boundary — keep a clear 40 px band between cells. Draw as if each icon is shown 64 px wide: big simple readable shapes, nothing thinner than the outline. No other text or numbers anywhere.

Do not draw grid lines, cell borders, labels outside the ribbons, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## UI-I2 — speed-ups (4 rows × 7 columns, landscape)

A landscape sheet of 28 game icons on a strict grid of 4 rows and 7 columns.

Each ROW is one kind of speed-up; every icon in it is the winged hourglass from the reference (small white wings on its sides, blue sand) with the row's object:
- Row 1 — GENERAL: the winged hourglass alone.
- Row 2 — CONSTRUCTION: the winged hourglass with a builder's HAMMER (like the reference hammer) crossed diagonally behind it.
- Row 3 — TRAINING (troops): the winged hourglass with a SWORD crossed diagonally behind it and a round wooden SHIELD with a steel rim leaning at its lower left.
- Row 4 — WORKSHOP: the winged hourglass standing on a small dark iron ANVIL (like the reference anvil).

Each COLUMN is a duration and its ribbon label; the hourglass frame gets richer from left to right, identical within a column:
1. "1m" — plain light wood frame;
2. "5m" — darker wood frame with iron bands;
3. "15m" — bronze frame;
4. "1h" — brass frame;
5. "3h" — silver frame;
6. "8h" — gold frame;
7. "24h" — gold frame set with a red gem, a soft golden glow behind it.

## UI-I3 — chests, choice chests, boosts (4×4)

A square sheet of 16 game icons on a strict 4×4 grid.

Columns 1–3 are the reference's open treasure chest, getting richer left to right, identical within a column: column 1 "10m" — a small plain wooden chest with iron bands; column 2 "1h" — the reference red chest with gold trim; column 3 "8h" — a bigger gold chest set with blue gems, overflowing more. The contents by row:
- Row 1: GOLD COINS (like the reference gold coin);
- Row 2: RED APPLES and a loaf of bread (food);
- Row 3: WOODEN LOGS;
- Row 4: GREY STONE BLOCKS.

Column 4, top to bottom:
1. the reference CLOSED red chest with the big golden QUESTION MARK, ribbon "1h";
2. the same question-mark chest but gold with blue gems (like column 3), ribbon "8h";
3. the reference COIN PURSE with spilling coins and a green up-arrow behind it — more rent — ribbon "8h";
4. the reference SICKLE crossed with golden wheat and a green up-arrow behind it — more harvest — ribbon "1h".

## UI-I4 — mana and knowledge (2 rows × 3 columns, landscape)

A landscape sheet of 5 game icons on a strict grid of 2 rows and 3 columns; the last cell of row 2 stays EMPTY.

Row 1:
1. the reference violet MANA CRYSTAL with a green up-arrow behind it — faster mana — ribbon "8h";
2. a SMALL round glass vial with a cork, half full of the reference's glowing violet-blue swirling mana liquid — a small mana flask, no ribbon;
3. a LARGE round glass flask with a cork and a gold neck band, brimming with the same glowing mana liquid, sparkles around it — a big mana flask, no ribbon.

Row 2:
1. a THIN blue booklet with brass corners and a small gold rune — a small knowledge tome, no ribbon;
2. the reference THICK blue tome with brass corners and the glowing gold rune, a bookmark ribbon and a soft golden glow — a big knowledge tome, no ribbon.

## Names (manifest order)

UI-I2: GeneralSpeedup1m … GeneralSpeedup24h, ConstructionSpeedup1m … 24h,
TrainingSpeedup1m … 24h, WorkshopSpeedup1m … 24h.

UI-I3: GoldChest10m, GoldChest1h, GoldChest8h, ChoiceChest1h,
FoodChest10m, FoodChest1h, FoodChest8h, ChoiceChest8h,
WoodChest10m, WoodChest1h, WoodChest8h, RentBoost8h,
StoneChest10m, StoneChest1h, StoneChest8h, HarvestBoost1h.

UI-I4: ManaBoost8h, ManaFlaskSmall, ManaFlask, KnowledgeTomeSmall,
KnowledgeTome, (empty).
