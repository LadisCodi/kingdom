# Offer kit — the prompts (2026-10-06)

The offer splash's UI pieces (Job 1) and a bust portrait of every hero (Job 2),
taken from `Docs/art/ui/mockups/m86b-offer-first-purchase.png`.

- Every chat gets `m86b-offer-first-purchase.png` and `m86-refs/ref-ui-kit.png` attached.
- Bust sheets also get `refs/bust-reference-x3.png` (m86b's princess tile, ×3) and
  `refs/heroes-<sheet>.png` (that sheet's sprites, numbered; the order is `refs/heroes-<sheet>.txt`).
- Raw sheets in `sheets/`. Cut by connected blob, trimmed, normalised.

## K1 — ribbon, plaque, sparkle

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style references (the first is the target look, the second our UI kit).

Make three separate game UI pieces on one transparent canvas, taken from the attached first-purchase mockup, all EMPTY (no text, no letters, no icons on them):

1. TOP, spanning the whole width: the big red cloth BANNER from the top of the mockup ("First Purchase Reward") but with no text — a gently ARCHED red ribbon with a gold trim along both its long edges and a folded tail at each end (the tails fold back behind the band and end in a swallowtail notch). About 4:1 including the tails. The centre band must be a clean, fairly uniform red, because text will be laid over it.
2. BOTTOM LEFT: the wooden TITLE PLAQUE from the mockup ("Yours now" / "Tomorrow") with no text — a horizontal warm-wood board with rounded ends, a darker inner bevel, and one small round brass nail near each end. The middle must be plain uniform wood (no knots, nails or marks), so it can be stretched horizontally. About 5:1.
3. BOTTOM RIGHT: one magic SPARKLE particle — a 4-pointed star twinkle, white core shading to warm gold, with a soft round glow, like the sparkles around the princess in the mockup. Square.

Style: our UI is made of materials — warm wood, yellowed parchment, brass, red cloth — lit from above; flat cartoon with a bold uniform dark-brown outline, two or three flat tones, never glossy plastic. Nothing under 4 px.

Layout: the three pieces separated by a clear empty band of at least 40 px; nothing touches or overlaps.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## K2 — frame, tile, gold tile

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style references (the first is the target look, the second our UI kit).

Make three separate game UI pieces on one transparent canvas, in one row (3 columns × 1 row), each EXACTLY SQUARE and all EMPTY (no text, no icons, no numbers), taken from the attached first-purchase mockup:

1. LEFT: a 9-SLICE PANEL FRAME like the mockup's "Yours now" box: a thick warm-wood border with a darker inner bevel, one round BRASS NAIL in each of the four corners, and the inside filled with flat, even yellowed parchment. The border must be the SAME thickness on all four sides, and each straight edge must be perfectly uniform along its length — no knots, nails, cracks or details in the middle of a side — so the middle of each side can be stretched. Each nail sits fully inside its corner square of the border.
2. MIDDLE: ONE REWARD TILE as in the mockup's key/gem tiles: a square parchment card with a thin dark-wood inset border and four small brass rivets in its corners, empty.
3. RIGHT: the HIGHLIGHTED tile for a legendary hero (the mockup's princess tile): same size and shape as the middle one, but a glowing GOLD frame with brass rivets, a warm golden-yellow radiant inside (brighter at the centre), and tiny white-gold sparkles in two opposite corners, empty.

Style: our UI is made of materials — warm wood, yellowed parchment, brass — lit from above; flat cartoon with a bold uniform dark-brown outline, two or three flat tones, never glossy plastic.

Layout: each piece centred in its own third, with a clear empty band of at least 40 px between them; nothing touches or overlaps.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## A–D — hero busts (one per sheet)

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY references.

[LOCK]Make hero AVATARS for a game: a head-and-shoulders BUST portrait of each hero, exactly like the princess in the attached bust-reference (the gold "×1" tile of the first-purchase mockup) — but draw ONLY the bust: no tile, no frame, no glow, no "×1", no background. One image, a grid of [GRID], [N] busts, one per cell, in the order of the numbered heroes in the attached heroes sheet (1 top-left, reading order). Each bust MUST be THAT character as drawn in the heroes sheet: the same face, hair, headwear, skin, ears, horns, colours, collar and expression — the same character, not a reinterpretation.

The bust: facing the viewer (a slight three-quarter turn is fine), head and shoulders, cropped by a straight horizontal cut across the chest; the head fills the upper two-thirds; the same scale and framing for every hero so they read as one family. Big headwear, horns or ears may make a bust wider, but stay inside the cell. No hands, weapons or props unless they sit on the shoulders. The heroes' flat cartoon style: bold uniform dark-brown outline, flat colour, one shadow tone, one highlight. Draw as if shown 128 px wide: no line thinner than 4 px.

Layout: each bust centred in its own cell, filling about 80% of it, with a clear empty band of at least 40 px between cells; nothing may cross the cell lines.

Do not draw grid lines, cell borders, labels, numbers, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

Fill-ins: `[GRID]` = "3 columns × 3 rows", `[N]` = nine (D: "3 columns × 2 rows", five, the last cell empty). `[LOCK]` is empty on A; on B–D it is:

> STYLE LOCKED: the attached A.png is the approved sheet of these avatars. Match its framing, crop line, head size in the cell, outline weight and painting exactly; only the heroes change.

## Results and cutting

- Every sheet came back true alpha on the first message (corner `srgba(0,0,0,0)`); A was locked as generated.
- `kit.py` cuts K1 (ribbon → 1024 wide, plaque → 512 wide, sparkle → 128², 96% fill) by region.
- `frame.py` squares K2's pieces without distorting the nails: a uniform scale to the shorter side, then the
  longer axis spliced at its middle (the straight edges are uniform, so the seam is invisible).
  Frame 512², tiles 256². Frame border: 55 px left/right, ~58–62 px top/bottom; nails end at ~64 px,
  the parchment's rounded inner corner at ~75 px → **9-slice inset 80 px**. Plaque: nails end at ~44 px →
  **end cap 60 px**.
- `avatars.py A B C D` cuts busts by connected blob onto 256², 92% of the width, bottom-aligned (height
  capped at 97%). On C the Warden and the Quartermaster touch: a merged blob is split at the emptiest
  row/column near each cell line, and slivers under 10% go back to their neighbour.
