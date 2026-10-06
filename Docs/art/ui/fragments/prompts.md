# Hero fragments — the prompts (2026-10-06)

One icon per hero: the hero's head-and-shoulders portrait painted on a jigsaw
piece whose colour is the hero's rarity. Taken from the hero-fragment tile of
`Docs/art/ui/mockups/m86b-offer-first-purchase.png` (`style-reference.png`).

- Rarity colours: Common steel teal-blue `#5f8fa8`, Rare violet `#8a6bc4`, Legendary gold `#d99a2b`.
- Six sheets, 3 columns × 2 rows (C3 is 2 × 1), grouped by rarity (`sheets.tsv` has the order).
- Attached to each: `refs/style-reference-x3.png` (the reference ×3) and
  `refs/heroes-<sheet>.png` (that sheet's hero sprites, numbered in reading
  order). After L1 was locked, `sheets/L1.png` was attached to every other
  sheet as the style anchor.
- Raw sheets in `sheets/`; cut by connected blob into cells
  (`cut.py`), trimmed and centred on 256×256 at 90% fill, saved as
  `src/render/assets/<sprite>_fragment.png`.

## The prompt (one per sheet)

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style references.

[LOCK]Make game icons: hero FRAGMENTS. Each is one jigsaw puzzle piece with a hero's head-and-shoulders portrait painted on it, exactly like the attached style-reference (ignore its square parchment tile and its "×10" text: draw only the puzzle piece). One image, a grid of [GRID], [N] separate pieces, one per cell, in the order of the numbered heroes in the attached heroes sheet (1 top-left, reading order). Each face MUST be that hero as drawn in the heroes sheet: the same face, hair, headwear, skin, colours and expression.

The piece: the SAME jigsaw silhouette for every hero, so they read as one family — a rounded square body tilted about 10°, two round knobs sticking OUT on the top and on the right side, notches cut in on the left and bottom, as in the reference. The portrait fills the body, cropped at the shoulders; hair, ears, horns or headwear may spill a little over the piece's edge, as in the reference. Around the portrait the piece's own colour shows as its rim and background and fills the knobs: [COLOUR] for every piece in this image (it is the rarity colour), with one lighter highlight on top and one darker shadow tone, like glazed enamel on wood. The heroes' flat cartoon style: bold uniform dark-brown outline around the whole piece, flat colour, one shadow tone, one highlight. Draw as if shown 128 px wide: no line thinner than 4 px.

Layout: each piece centred in its own cell, filling about 80% of it, with a clear empty band of at least 40 px between cells; nothing may cross the cell lines.

Do not draw grid lines, cell borders, labels, numbers, counts, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

Fill-ins: L1 `[COLOUR]` = "warm gold #d99a2b"; R1/R2 "violet #8a6bc4"; C1–C3 "steel teal-blue #5f8fa8". `[GRID]` = "3 columns × 2 rows" (C3: "2 columns × 1 row"), `[N]` = six (C3: two). `[LOCK]` is empty on L1; on every other sheet it is:

> STYLE LOCKED: the attached L1.png is the approved sheet of these icons (gold ones). Match its piece silhouette, tilt, size in the cell, outline weight and painting exactly; only the heroes and the piece colour change.

## What came back

- All six sheets came back on the first message each, true alpha (corner `srgba(0,0,0,0)`); L1 was locked straight away and every face matches its sprite.
- The pieces' colours read right per rarity, but they are more saturated than the hexes: the Rare violet is deeper and more purple than `#8a6bc4`, and the Common blue is brighter and more cyan than `#5f8fa8`.
- On R1, neighbouring pieces touch, so `cut.py` erodes the alpha until there is one core per cell, then floods each pixel to its nearest core.
- C3 (two heroes) came back 1774×887 instead of 1536×1024.
