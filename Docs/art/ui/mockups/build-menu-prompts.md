# Build menu mockups prompts (m105-m107)

Purpose: the Build sheet redesigned to take the whole height under the header (no map, nav hidden), tabs fixed, a vertically scrolling catalogue. Two layouts compared on the same content — A, a two-column grid of cards; B, full-width rows — then A on the Decoration tab.

All three were generated in ONE ChatGPT chat (2026-10-08), so the style holds; "style LOCKED" was said after m105.

## References attached (first message only)

1. `current-build-economy.png` — the live Build drawer, 375×812 @2x capture of the game.
2. `m47-build-drawer.png` — the older approved drawer mockup.
3. `m48-build-military-decoration.png` — its Military/Decoration companion.
4. `ref-buildings.png` — a labelled `magick montage` of `src/render/assets/` `housing_l1`, `farm_l1`, `farmlands` (as crop_plot), `sawmill_l1`, `quarry_l1`, `tavern_l1`, `docks_l1`, `carpenter_l1`, `flowerbed_l1`, `bench_l1`, `lantern_l1`, `topiary_l1`, `banner_l1`, `birdbath_l1`, `garden_l1` on parchment.

## m105 Build — grid (variant A)

```
GENERATE A NEW IMAGE. The attached files are only references, do not edit or export them.

Draw a portrait mobile game screen mockup (iPhone X proportions, about 9:19.5), all text in English: the redesigned "Build" menu of a medieval kingdom city-builder called Kingdom, Economy tab open.

REFERENCES. Image 1 is the live game today (375x812 capture): copy its header plank, its "Build" title bar with the round red-wood close knob, its tabs, its parchment cards, price chips and footer strip EXACTLY in style. Images 2 and 3 are our older approved mockups of the same menu: same style. Image 4 is a montage of our real building sprites (housing_l1, farm_l1, crop_plot, sawmill_l1, quarry_l1, tavern_l1, docks_l1, carpenter_l1...): draw THOSE buildings on the cards, the wooden level-1 camps, not other buildings.

WHAT CHANGES: the Build sheet no longer sits at the bottom over the map. It now takes the WHOLE HEIGHT of the screen under the header. No map visible, no bottom nav bar.

SCREEN, top to bottom:
1. Our wooden coin plank header, unchanged (Gold 1,240, Food 860, Wood 312, Stone 40, Mana 100, Gems 500 with green +).
2. The wooden title bar "Build" with the round red-wood close knob carved with an X at its right.
3. Three wooden tabs fixed under it: Economy (gold coin, OPEN: raised, lit, yellowed parchment face), Military (crossed swords), Decoration (flower). These stay fixed.
4. Below, a VERTICALLY scrolling catalogue on a parchment page in a carved wooden frame: a TWO-COLUMN GRID of near-square parchment cards. Each card: the building's art LARGE on top, then the name in bold with a muted "#n", one short promise line, then price chips, then a darker footer strip with a sand-timer and the time at left and "Built x/y" at right. Show 4 rows; the LAST row is cut by the bottom edge of the screen so it is obvious the list scrolls.
Cards in this order, left to right, top to bottom:
 - Housing #3 - "Villagers live here and pay taxes" - Gold 59, Wood 39 - 35s - Built 2/4
 - Farm #2 - "Workers harvest crops nearby" - Gold 162, Wood 108 - 24s - Built 1/2
 - Crop plot #5 - "A crop the Farm can reap" - Gold 30, Wood 20 - 5s - Built 4/6
 - Sawmill #3 - "Woodcutters work the trees nearby" - Gold 126, Wood 84 - 24s - Built 2/3
 - Quarry #1 - "Masons cut the rock nearby" - Gold 45, Wood 30 - 24s - Built 0/1
 - Tavern #1 - "Heroes come for the soup" - Gold 5,400 (this number in RED, the player cannot afford it), Wood 250, Stone 50 - 1m - Built 0/1
 - Docks - LOCKED: the art dimmed to a sepia silhouette, a brass padlock, and a small line "Research Fishing" instead of prices
 - Carpenter - LOCKED: same, padlock, "Townhall 4" (this row is the one cut by the bottom edge)
PRICE ICONS ARE BIG: every coin, log and stone icon in a price chip is as large as the coins on the header plank, standing proud of the chip, not a text-sized speck. No buttons on the cards: the whole card is what you tap.

Everything is made of MATERIALS (warm carved wood, yellowed parchment, rope, brass nails, red wood), flat cartoon with a bold dark-brown outline, lit from above, symbols carved or embossed into the pieces, never flat fills, never plastic gloss, never blue glassy UI. Same style and render quality as image 1. Raw image only: do not resize, verify or save a corrected file.
```

Result: 852×1845, first try, kept. Two columns of near-square cards, 3½ rows visible (8 cards, the locked Docks/Carpenter row cut by the bottom edge). Real `_l1` sprites, plank-size price icons proud of their chips, Tavern's 5,400 in red with a third Stone chip, locked cards as sepia silhouettes under a brass padlock. Off: the locked cards still carry a footer strip reading "-- / Locked" (redundant with the padlock line); the building art is centred with a lot of empty parchment around it, so a card is ~210 px tall at 375 wide.

## m106 Build — rows (variant B), same chat

```
Perfect, style LOCKED. GENERATE A NEW IMAGE, the same screen with the same content, header, Build title bar, close knob, tabs (Economy open), colours, materials and render quality IDENTICAL to the image you just drew. Only the catalogue's layout changes.

VARIANT B: instead of the two-column grid, a LIST OF FULL-WIDTH ROWS, one building per row, vertically scrolling. Each row is a wide parchment card in a thin wood border:
 - at the LEFT a square thumbnail tile (parchment inset, wood rim) with the building's art filling it;
 - in the MIDDLE the name in bold with the muted "#n" and under it the one short promise line;
 - under the name, a line of price chips (icons as big as the header coins, proud of the chip) and, at the RIGHT end of the row, a small stacked block: sand-timer + time on top, "Built x/y" under it.
Same order and same numbers as before: Housing #3 (59 Gold, 39 Wood, 35s, Built 2/4), Farm #2 (162, 108, 24s, 1/2), Crop plot #5 (30, 20, 5s, 4/6), Sawmill #3 (126, 84, 24s, 2/3), Quarry #1 (45, 30, 24s, 0/1), Tavern #1 (5,400 Gold IN RED, 250 Wood, 50 Stone, 1m, 0/1), Docks LOCKED (sepia silhouette thumbnail, brass padlock, "Research Fishing" instead of prices), Carpenter LOCKED (padlock, "Townhall 4"). Show as many rows as fit; the last visible row is cut by the bottom edge so the list clearly scrolls. No buttons on the rows: the whole row is what you tap.

Everything made of MATERIALS (carved wood, yellowed parchment, brass, red wood), never flat fills or plastic gloss. Raw image only: do not resize, verify or save a corrected file.
```

Result: 852×1845, first try, kept. Header, title bar and tabs identical to m105. All EIGHT rows fit on one screen (~190 px a row at 2.27×), so nothing is cut by the bottom edge and the screen does not read as scrolling — the opposite of what was asked, but it is the honest answer to "how many fit". Promise lines fit on one line; Tavern's three chips crowd the row's width. Locked rows again carry a "-- / Locked" timer block that says nothing.

## m107 Build — grid, Decoration tab, same chat

```
Good, style still LOCKED. GENERATE A NEW IMAGE: go back to VARIANT A (the two-column grid of near-square cards, exactly as in your FIRST image), but now the DECORATION tab is open (raised, lit, yellowed parchment face, flower icon); Economy and Military are closed dark wood tabs. Header, Build title bar, close knob, card style, chips and footer strip identical to the first image.

Directly under the tabs, ONE small slim parchment hint strip (one line, small text, a tiny carved house-and-flower glyph at its left): "A house beside a decoration earns more Gold". No other text block, no Harmony line, no "+1" chips anywhere.

Cards, in this order, using the decoration sprites from image 4 (flowerbed_l1, bench_l1, lantern_l1, topiary_l1, banner_l1, birdbath_l1, garden_l1):
 - Flower bed #1 - "Brightens the houses beside it" - Gold 20, Wood 10 - Built 0/3
 - Bench #1 - "A seat for weary villagers" - Gold 25, Wood 15 - Built 0/2
 - Lantern #1 - "Lights the lane at night" - Gold 30, Wood 15 - Built 0/2
 - Topiary - LOCKED: sepia silhouette, brass padlock, "Research Civic Pride"
 - Banner - LOCKED: padlock, "Research Civic Pride"
 - Birdbath - LOCKED: padlock, "Research Civic Pride"
 - Garden - LOCKED: padlock, "Townhall 5" (bottom row, cut by the bottom edge of the screen so it clearly scrolls)
Decorations are placed instantly: the footer strip shows only "Built x/y" (no sand-timer). Locked cards have no footer price, just the padlock line. Price icons as big as the header coins, proud of the chip. No buttons on the cards.

Everything made of MATERIALS (carved wood, yellowed parchment, brass, red wood), never flat fills or plastic gloss. Raw image only: do not resize, verify or save a corrected file.
```

Result: 852×1845, first try, kept. Decoration tab raised, the one-line hint strip under the tabs, no Harmony anywhere, Garden cut by the bottom edge. Locked cards dropped the footer strip, which reads better than m105's. Off: the three promise lines were invented for the mockup (the brief gave none) and "no sand-timer" assumes decorations place instantly — check both against `buildings.json`; the coin face drifted from the crown to a flower stamp; the locked Topiary card stretches to its row-mate Lantern's height, so the grid's rows are uneven.
