# UI-Q1 — the quest goals' missing icons

The quest scroll wears a mark for what a quest asks (`src/ui/questIcon.ts`).
Every goal reuses an atlas icon except these two:

1. `tree` — *find forests* (`DiscoverFeature` › `Trees`).
2. `landmark` — *claim landmarks* (`ClaimLandmarks`), which wore the Mana orb.

Attach `ref-atlas.png` (icons already in the atlas: style) and `ref-map.png`
(the forest and the standing stones on the map: what the icons show).

## Prompt

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY references. The first is icons already in this game's atlas — your icons will sit right next to them, so match their style exactly: the same chunky cartoon shapes, the same dark-brown outline, the same saturated colours with one soft shade and one highlight, the same front three-quarter view. The second is two things on the game's map: icon 1 must be recognisably that forest, icon 2 recognisably those standing stones.

A landscape sheet of 2 game icons on a strict grid of 1 row and 2 columns.

1. TREE — one single round leafy green tree, the same kind as the attached forest's trees, with a short brown trunk on a small tuft of grass. One tree, not a forest.
2. LANDMARK — the attached ring of ancient grey standing stones as a compact icon: three tall rough menhirs with a lintel stone across two of them, a faint violet magic glow between them, on a small mound of grass.

One object per cell, centred, each filling about 80% of its cell, generous empty margins; nothing may cross the cell boundary — keep a clear 40 px band between the cells. Draw as if each icon is shown 64 px wide: big simple readable shapes, nothing thinner than the outline. No text, letters or numbers anywhere.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.
