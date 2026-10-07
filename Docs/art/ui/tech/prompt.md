# UI-T1 — the technologies' missing icons

Every technology in `src/sim/data/tech-tree.json` names an atlas icon
(`icon`). Most reuse one already drawn — a building, a resource, a unit —
and these six are the ones nothing in the atlas could stand for. Two of them
are also the district icons the Tavern and the War Camp never had.

Attach `ref-atlas.png` (icons already in the atlas: style) and
`ref-tavern.png` (the Tavern's building on the city map: what its icon shows).

## Prompt

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY references. The first is icons already in this game's atlas — your icons will sit right next to them, so match their style exactly: the same chunky cartoon shapes, the same dark-brown outline, the same saturated colours with one soft shade and one highlight, the same front three-quarter view. The second is the game's Tavern building on the city map: icon 1 must be recognisably that building.

A landscape sheet of 6 game icons on a strict grid of 2 rows and 3 columns.

Row 1:
1. TAVERN — the attached tavern building as a compact icon, like the reference building icons (sawmill, farm, docks): a cosy two-storey timber-and-plaster inn with a warm lit window and a wooden hanging sign with a frothy beer mug on it.
2. WAR CAMP — a military camp icon: two pointed canvas tents (cream and red) behind a short wooden palisade, a tall pole with a red war banner, and two crossed spears leaning at the front.
3. SAPLING — a young green sapling with four fresh leaves growing out of a small mound of brown soil, a tiny curved green arrow circling it to say "grows back".

Row 2:
4. WATERING CAN — a green-painted metal watering can tilted forward, a few blue water drops falling from its spout onto a little tuft of golden wheat.
5. BOAT — a small wooden sailing boat with one cream sail and a red pennant, on a short band of blue wave.
6. SPYGLASS — a brass spyglass (telescope), extended, with dark leather bands, angled up to the right, a small sparkle at its far lens.

One object per cell, centred, each filling about 80% of its cell, generous empty margins; nothing may cross a cell boundary — keep a clear 40 px band between cells. Draw as if each icon is shown 64 px wide: big simple readable shapes, nothing thinner than the outline. No text, letters or numbers anywhere.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.
