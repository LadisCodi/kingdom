# The Royal Survey — ChatGPT mockup prompts

The Survey sheet (`src/ui/surveySheet.ts`) and its pill on the map
(`src/ui/surveyPill.ts`), redrawn as a full-screen menu at the narrowest
phone, the iPhone X (375×812 points, 1125×2436 pixels). Design:
[`../../../features/25-the-survey.md`](../../../features/25-the-survey.md).

Attach, in this order (`m62-refs/`):

1. `ref-main-screen.jpg` — the game today at 375×812: the world, the header
   plank, the Knowledge tab hanging under it, the nav beam, the current pill;
2. `ref-season-pass.png` — M27, the season pass: the two-column ladder and
   the kit's look;
3. `ref-ui-kit.png` — pieces of the shipped UI atlas, labelled: build with
   these;
4. `ref-survey-now.jpg` — the Survey as it is today: its content, and what is
   wrong with it (a row holding two rewards spills out of its tile).

## M62 — the menu

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style and content references.

Mobile game UI mockup, portrait iPhone X screen, exactly 1125×2436, for a cozy fantasy kingdom builder. Image 1 is the game as it ships: keep its world, its header plank and its look. Image 2 is an older mockup of a similar menu: borrow its two-column ladder and its finish. Image 3 is a labelled sheet of the UI pieces the game ALREADY HAS — window frame, title plank, wood/blue planks, parchment panel and plates, ribbons, the four wax seals (blue = current, gold = reached, green = claimed, cream = ahead), the green / gold / purple / wood buttons, the red close knob, the bar trough and its gold fill, nails, corner ornaments, the red badge orb, and the reward icons (gold coin, gem, gold key, silver key, Knowledge book, Stardust, card pack, tick, padlock, compass). BUILD THE MENU OUT OF THESE PIECES, drawn the same way; invent a new piece only where none fits. Image 4 is the same menu today: its content is right, its layout is not.

Materials, as everywhere in this UI: warm, natural, textured — carved wood, yellowed parchment, rope, cloth, wax, brass — lit from above, never flat fills, never plastic gloss, never glass. A symbol on a piece is carved or embossed INTO it. Text is dark-brown ink on parchment and cream with a dark outline on wood, in a chunky rounded sans-serif.

The screen: THE ROYAL SURVEY — the crown's ledger of the province won back from the fog, one level for every so many cells cleared, a free column and a paid one. It is a FULL-SCREEN menu:
- The header plank from image 1 stays at the very top, untouched (Gold 3,073 · Food 18 · Wood 8 · Mana 15 · Gems 650 with its green +). Everything else is the menu: it runs edge to edge across the full width, from just under the header down to the bottom of the screen, leaving only the home-indicator strip. The nav beam is NOT visible. The map is not visible.
- The menu is one big parchment page inside a thin carved wooden frame (image 3's window frame), nails at the corners.
- TOP: the title plank across the full width, "The Royal Survey" in cream lettering, a round brass compass medallion set into its left end, the red wood close knob with a carved X at its right end.
- UNDER IT, the progress band, on a parchment strip with faint surveyor's map lines (grid, a coastline, a compass rose watermark): a big BLUE wax seal "5" at the left (the level you are on), a wide gold-filled trough "64 / 70" in the middle, a cream seal "6" at the right; one small line under it: "64 of 1,470 cells won back".
- THE TWO COLUMN HEADS, side by side: left a wood plank "Free"; right a gold plank "Royal Survey" with an embossed padlock, and on it a green button "Buy" with "$9.99" on its face. One word on the button, the price inside it.
- THE LADDER, the rest of the page, scrolling: down the middle a vertical rope threading one wax seal per level, numbered; each level is one row with its FREE tile left of the rope and its PAID tile right of it. A tile is a parchment plate (image 3) holding at most TWO rewards side by side, each a big reward icon — as big as the coins on the header plank — with its amount beside it; nothing ever spills out of a tile. Paid tiles are warmer, gold-edged parchment, and carry a small embossed padlock while the column is not bought.
  Show levels 1 to 8:
  - level 1, CLAIMED: its seal green; free tile "450" gold + 1 silver key, dimmed, with a green tick stamped on it; paid tile 160 gems + a blue card pack, padlocked.
  - levels 2 to 5, READY: seals gold; the free tiles glow with a warm gold rim and carry a small red badge orb at the corner — 2: 450 gold · 3: 450 gold + 1 Knowledge · 4: 450 gold + a green card pack · 5: 450 gold + 1 gold key. Paid: 170 gems + blue pack · 180 gems + 1 gold key · 190 gems + 100 Stardust · 200 gems + a purple pack, all padlocked.
  - levels 6 to 8, AHEAD: seals cream, tiles faded — 6: 450 gold / 210 gems + 1 gold key · 7: 450 gold + 1 silver key / 220 gems + blue pack · 8: 450 gold / 230 gems + 100 Stardust.
- AT THE BOTTOM, pinned under the scrolling ladder, the GRAND PRIZE: a wide gold-trimmed plank with a small open treasure chest, "Level 36", its free half "500" gems + 1 gold key and its paid half "10,000" gems + 5 gold keys, padlocked.

Every tap target at least 44 points; generous spacing; nothing cramped. Legible chunky lettering; if a word is unclear, prefer fewer, larger words. No watermark, no logo, no phone bezel. Raw image only — do not resize, verify or save a corrected file.

## M63 — the widget on the map (same chat)

Same style, LOCKED. Now the MAP SCREEN of image 1, at the same iPhone X size, 1125×2436, and everything on it as in image 1 — the header plank, the Knowledge tab hanging under the plank's centre, the settings knob, the world, the quest scroll bottom-left, the ad offer at the right, the nav beam — except the Survey's widget at the top-left, redrawn:
- It is the menu's entry, so it is a small piece of the same ledger: a parchment card nailed to a short wooden backing, about 38% of the screen width — narrow enough to sit LEFT of the Knowledge tab without touching it (today's pill runs under the tab and its title is cut).
- On its left, the round brass compass medallion from the menu's title, with the red badge orb on its rim showing "4" — the levels ready to claim.
- Beside it: "Survey" (one word), under it a slim gold-filled trough "64 / 70", and a small blue wax seal "5" at the trough's end — the level.
- Because levels are ready, the card has the same warm gold rim glow as the menu's ready tiles.
No new text anywhere else. Raw image only — do not resize, verify or save a corrected file.

## Results (2026-10-02)

- `m62-royal-survey.png` — the menu, first take. Built from the atlas pieces
  as asked; the only miss is the card packs, drawn as crowned card decks
  rather than the atlas's sealed envelope (the game draws its own pack art).
- `m63-survey-widget.png` — the widget, first take: clear of the Knowledge
  tab, about 48% of the width.
- Both came back 853×1844, the iPhone X's aspect, not its pixel size.

## The pieces (2026-10-02)

The menu is built from the shipped kit (seals, vertical rope, buttons, badge
orb, close knob, bar, red ribbon, `plate-parchment`, icons) and five new
pieces, one ChatGPT image each, so each comes back at full size. Originals in
`Docs/art/ui/survey/`, cut into `src/ui/assets/` by `Docs/art/ui/survey/cut.sh`.

Every prompt opens with:

> GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY references. Image 1 is the mockup of the menu this piece belongs to; the other images are pieces of the same UI that already ship — match their drawing, outline, shading and materials exactly: warm, natural, textured, lit from above, never flat fills, never plastic gloss.

and every transparent one ends with:

> One piece alone, centred, filling the canvas edge to edge with only a thin margin. Do not draw text, labels, captions, shadows, glow, sparkles or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

- **`survey-compass`** (refs: m62, `ref-ui-kit.png`) — square. The round brass medallion at the left end of the mockup's title plank: a thick polished brass ring with a fine rope-twist edge, inside it a parchment-cream face with an engraved compass rose, eight points, the north point gilded, a small brass pin at the centre.
- **`survey-chest`** (refs: m62, the atlas `chest` slice) — square. The mockup's grand-prize chest: a wooden treasure chest bound in gold, its lid thrown open, heaped with violet gems and a few gold coins, seen from the front three-quarters.
- **`plank-gold`** (refs: m62, `plank-wood.png`, `plank-blue.png`) — exactly the shape and proportions of the attached planks, 765×170: the same long rounded board with a brass nail near each end, but painted a rich golden yellow over the wood, its grain still showing through, the edges darker gold — the mockup's "Royal Survey" column head.
- **`plate-gold`** (refs: m62, `plate-parchment.png`) — exactly the shape and proportions of the attached plate, 572×258: the same panel of warm parchment inside a frame with a nail in each corner, but the frame is gilded — warm gold-painted wood with a brass sheen — and the parchment a shade warmer; the mockup's paid tiles.
- **`survey-map`** (refs: m62, `tex-parchment.jpg`) — OPAQUE, wide, 1500×500: yellowed parchment like the attached texture, drawn over with a surveyor's map in faint brown ink — a light square grid, a winding coastline, a river, a few little hills and trees, a compass rose in one corner — all faint, so ink text on top stays readable. It fills the whole canvas, no border, no frame. Raw image only — do not resize, verify or save a corrected file.
