# Ascension stars

`sheet.png` — ChatGPT, 2026-10-06, one message, true alpha first try.
References attached: `style-ref.png` (a montage of shipped hero, UI and
currency art) and `layout-ref.png` (another game's cards, for the concept
only). The prompt asked for a 2:1 sheet: the LIT star left, the EMPTY wooden
socket right, six diamond petals round one hub, one petal straight up, each
petal inside its own 60° slice — so a conic mask can uncover one petal a
point (`src/ui/styles/screens/ascension.css`).

`python3 cut.py sheet.png ../../../../src/ui/assets` writes
`ascension-star-lit.png` and `ascension-star-empty.png`, 256 px square,
centred on the hub.

## The gem alternative (not in the game)

`gem-sheet.png` — same chat setup, two messages: a pentagon amethyst cut into
five facets, seams to the vertices, one seam straight up (a 72° mask starting
at 0°). `python3 cut_gem.py gem-sheet.png <out>` centres the HUB, which on a
pentagon is ~55% down its box, not halfway. Drawn for the star-or-gem
comparison; the star is what ships.
