# The friends list — the prompts (2026-10-06)

Two ChatGPT images, both true alpha or opaque on the first try.

## M73 — the screen (`m73-friends.png`)

Attached: `m73-refs/game-screens.png` (the map, the Bag, Settings, the map
again, at 390×844). Asked for a new menu built from the game's own pieces —
the coin plank, the wooden window, the red close, parchment, painted
buttons — holding, top to bottom: requests under three tabs (received, sent,
suggested) with shields, Townhall pills and round check/cross buttons; a
search field; the player's code on a brass plate and a green *Invite*; the
ranked list with gold/silver/bronze/wood ribbons and last seen; the reward
path at 1, 3, 5 and 10 friends. Opened with *GENERA UNA IMAGEN NUEVA* so the
upload was read as a reference, not a file to edit.

## The pieces (`../sheets/ui-f1-friends.png`)

Attached: a montage of twelve shipped atlas icons (style) and M73 (subject).
A 4×4 sheet: eight heraldic shields (red lion, blue fleur-de-lis, green oak,
purple crown, black tower, orange star, teal eagle, maroon key), four blank
ribbons (gold, silver, bronze, wood), and four small icons (friends, share,
copy, search). Ended with the true-alpha wording from the art pipeline;
corner `srgba(0,0,0,0)`, alpha mean 0.50.

- Shields → `src/ui/assets/crest-<tincture>.png` (144×160).
- Ribbons → `src/ui/assets/rank-<tone>.png` (96×128).
- Share, copy, search → `src/ui/assets/fr-*.png` (96×96).
- Friends → the UI atlas (`friends`, `atlas.manifest.json`).

Cut by tile, dropping any blob under 2% of the largest (a neighbour's
bleed), trimmed and fitted onto the canvas.
