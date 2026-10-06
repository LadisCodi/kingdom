# Crest layers — ChatGPT prompts

The kingdom's crest is two layers: a blank FIELD (a shield in one tincture)
and a CHARGE drawn over it. Both were generated with ChatGPT on 2026-10-06,
each chat given `crests.png` — a montage of the eight original painted crests
(`src/ui/assets/crest-*.png`) — as the style reference. Normalized to a
144×160 canvas into `src/ui/assets/crest/`.

## Fields (one 4×2 sheet)

> GENERA UNA IMAGEN NUEVA. No edites ni exportes el archivo adjunto: es SOLO la referencia de estilo.
>
> Draw a 4×2 sheet of EIGHT EMPTY heraldic shields for a cozy cartoon mobile strategy game. Every shield must have exactly the shape, proportions, chunky gold rim with small rivets, glossy field and bold dark-brown outline of the shields in the reference — but with NO charge, NO emblem, NO symbol: the field is plain, a single flat colour with the same soft top highlight. All eight shields are identical in shape, size and pose; only the field colour changes. Field colours, left to right, top row then bottom row: 1 red (#c62828, like the lion shield), 2 royal blue (like the fleur-de-lis shield), 3 green (like the tree shield), 4 purple (like the crown shield), 5 charcoal black (like the tower shield), 6 orange (like the star shield), 7 teal (like the eagle shield), 8 dark wine crimson (like the key shield, darker and more purple than the red). Each shield upright and centred in its own cell of the 4×2 grid, with a clear 40 px empty band around every shield; nothing may cross the cell midlines. Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Charges (one 4×3 sheet)

> GENERA UNA IMAGEN NUEVA. No edites ni exportes el archivo adjunto: es SOLO la referencia de estilo.
>
> Draw a 4×3 sheet of TWELVE heraldic charges (the emblems that sit on a shield) for a cozy cartoon mobile strategy game, in exactly the style of the emblems on the shields in the reference: bold uniform dark-brown outline, flat colour with one shadow tone and one highlight, chunky simple shapes, few details. Draw ONLY the emblems — NO shield, NO rim, NO background behind them. Every emblem is the SAME pale gold-cream colour (light gold #f3d27a with cream highlights and a warm ochre shadow), so it reads on red, blue, green, purple, black, orange, teal and wine fields alike. All twelve at the same visual size, each roughly as wide as it is tall where the subject allows, centred in its cell. Left to right, top to bottom: 1 lion rampant (in profile, like the reference's lion), 2 fleur-de-lis, 3 round-crowned oak tree, 4 royal crown, 5 castle tower with crenellations, 6 eight-pointed star, 7 eagle displayed (wings spread, facing front, like the reference's eagle), 8 old ornate key standing upright, 9 two crossed swords (point up), 10 dragon rampant in profile, 11 stag's head with antlers seen from the front, 12 small sailing ship (cog with one square sail). Each emblem has a clear 40 px empty band around it; nothing may cross the cell midlines. Do not draw grid lines, cell borders, labels, captions, numbers, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Normalizing

Both sheets came back with true alpha on the first try. `cut.py` (in this
folder, `python3 cut.py <dir with the two sheets> src/ui/assets/crest`) cuts
them on the even grid:

- **Fields** share one scale and sit bottom-centred on 144×160, so all eight
  stack pixel-aligned (140×160 each).
- **Charges** fit an 88×88 box centred at (72, 76) — on the field, a little
  above the shield's middle — the size of the emblems on the original crests.

`preview.png`: two originals beside their layered remakes, the twelve charges
on varied fields, and the lion on all eight.
