# Relic fragments — ChatGPT prompts (2026-10-06)

Every relic's six fragments as broken pieces of THAT relic, so a slot says which piece it
is: slots 0–4 the pieces, slot 5 the keystone — the relic's heart, gold-rimmed.
`src/render/assets/<relic sprite>_frag<slot>.png`, 128×128, drawn by `relicSheet.ts`
`fragmentArt` (the relic's slots, the friends' wish board).

One chat per relic, eight in parallel. Attached: `ref-<relic>.png` (the relic itself) and
`ref-style.jpg` (the relic sheet, for the style). True alpha first try on six; the Lantern
and the Signet failed with a tool error and came back on "try again".

## The template

GENERA UNA IMAGEN NUEVA. No edites ni exportes los archivos adjuntos: son SOLO referencias.

Attached: the relic {NAME} (the first image — THE subject) and our game's relic sheet (style
reference). Match that art exactly: flat cartoon style, one bold uniform dark-brown outline
around every shape, flat colours with one shadow tone and one highlight, no textures, few
details, saturated colours, lit from the top-left. Draw as if each piece will be shown 64 px
wide, so bold simple shapes, nothing thinner than 4 px.

Draw {NAME} SHATTERED into SIX FRAGMENTS, each one a clearly recognisable broken chunk of THIS
relic — its own materials, colours and details — with jagged broken edges, so that together
they would make the relic again. Every fragment must look different from the others at a
glance (different part, different shape). Each fragment floats on its own, slightly tilted,
filling about 70% of its cell, with a faint glow of the relic's colour along its broken edges.

A 3x2 sheet, 1536x1024, one fragment per cell, centred:
- Top row, left to right: {P1}; {P2}; {P3}.
- Bottom row: {P4}; {P5}; and bottom-right the KEYSTONE — {KEY} — a little bigger than the
  others, set in a thin gold rim, glowing.

Nothing may cross into another cell: keep a clear empty band of 60 px between cells and along
the outer edges. No text, no numbers, no labels, no grid lines, no cell borders, no shadows on
the ground and no background. The background must be alpha 0 everywhere, not white, not a
checkerboard. Then apply the true-alpha transparency correction and give me the download link
for the corrected PNG.

## The keystones

Staff — its green crystal · Sickle — the blade's engraved wheat ear · Hammer — the rune face ·
Crown — the central ruby · Orb — its starry core · Lantern — the wisp · Warhorn — the rune
band · Signet — the emerald with its tower.

## Cut

`python3 -I cut.py sheet-<relic>.png ../../../../src/render/assets artifact_<relic>_frag`
— by silhouette, each blob to the cell holding its centre, trimmed onto 128×128 at 90%.
