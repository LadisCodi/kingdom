# The store's item bundles (Docs/plans/relics-and-bag.md, step 4)

Six store illustrations, `src/render/assets/<sprite>.png` at 256×256 like the
Gem packs. Attach `ref-store.png` (the Gem packs already in the store: the
style) and `ref-items.png` (the Bag's items: what goes inside).

## Prompt

GENERATE A NEW IMAGE. Do not edit or export the attached files: image 1 is ONLY the style reference — the six Gem packs already in this game's store; image 2 shows the game's item icons, so the bundles you draw must contain those exact objects. Match image 1's style exactly: the same chunky cartoon shapes, dark-brown outline, saturated colours with one soft shade and one highlight, gold trims, front three-quarter view, a slight heap spilling forward. No shadows under the objects.

A sheet of 6 store illustrations on a strict 3×2 grid (3 columns, 2 rows), one bundle per cell, centred, each filling about 80% of its cell; nothing may cross a cell boundary — keep a clear 40 px band between cells. No text, numbers, labels or price tags.

Row 1 — three speed-up bundles, growing like image 1's ladder:
1. a small open cloth satchel with two winged hourglasses (image 2) peeking out;
2. a wooden crate, lid off, holding four winged hourglasses;
3. a big brass-bound chest, open, overflowing with winged hourglasses.

Row 2:
4. a burlap sack, open, holding one red treasure chest with a golden question mark (image 2's choice chest) and a few gold coins;
5. a small wooden hand-cart loaded with three of those question-mark chests;
6. a builder's wooden toolbox crate with a hammer laid across it, holding winged hourglasses with a small hammer badge and one question-mark chest.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Sprites (reading order)

bundle_speed_s, bundle_speed_m, bundle_speed_l, bundle_res_s, bundle_res_m, bundle_builder
