# Map features — masters, prompts and the normaliser

Everything that STANDS on a tile but is not a building: forests, peaks,
berry bushes, game, shoals, the authored landmarks and the ruins. Generated
against [`../style-reference.png`](../style-reference.png) under
[`../art-direction.md`](../art-direction.md).

| | |
|---|---|
| `<id>.png` | what the game uses. The filename IS the contract — it is the `sprite` on the feature, landmark or ruin in `src/sim/data/definitions.ts` |
| `<id>.prompt.txt` | the exact prompt, verbatim, **attached as a file** to the ChatGPT message |
| `<id>.master.png` | what came back, untouched, with its real alpha |
| `props.json` | what each one IS, in a sentence — the only file to edit to add one |

## Two rules, and only one of them is the renderer's

**Where it stands** is the renderer's rule, and it has no exceptions: a
feature is scaled to its plot's ground diamond and its bottom edge goes on
the diamond's bottom corner (`drawStanding`,
[`src/render/iso.ts`](../../../src/render/iso.ts)).

**How big it is** could never be a rule. A boar is knee-high on a farmhand
and a forest towers over a cottage, and nothing in the renderer can tell
which is which — drawn to one rule they came out the same size, and the map
read as a petting zoo of giant pigs under bonsai. So size is AUTHORED, as
`scale` in `props.json`: the fraction of the plot's diamond the drawing
spans. `norm_prop.sh` bakes it in.

The canvas it bakes it onto is **two plots wide** (`FEATURE_PLOTS`), which is
the other half of the same problem. A building is drawn exactly to its plot,
but a feature is not: a boar covers a fraction of a tile and a stand of trees
spreads half a tile past its own ground onto its neighbours — and it SHOULD,
because that overlap is what makes a wood read as a wood instead of a row of
separate tiles. A one-plot canvas can express the boar but not the trees: the
drawing would have to be wider than the file, and `-extent` answered that by
slicing the trees flat down both sides.

The yardstick is the cast, not a tape measure: **a villager is about 0.38 of
a plot tall** (`UNIT_PLOTS`, src/render/characters.ts) and a 1×1 cottage about 1.5, so a boar wants ~0.5 and a stand
of trees ~1.25. `norm_prop.sh` prints the drawn height in plots for exactly
that comparison.

## The one asset that tiles

A **field** breaks both of the rules above, so it has its own template
(`_field-template.txt`) and its own check.

- Its own GROUND is the asset, where every other feature is forbidden to draw
  ground at all.
- Its edges must be STRAIGHT, where every other feature's must not: the game
  lays crop plots side by side, and a ragged edge leaves gaps.
- It is authored ONE plot wide, not two, because it goes through the district
  draw path (`canvasPlots: 1` in `props.json`).

And the crop STANDS UP out of the soil. A field drawn as a flat texture is a
square billboard tilted out of its own tile; a field drawn with height has a
lip of earth along its near edges and stalks standing clear of it.

`check_field.mjs` measures whether the soil really is a 2:1 diamond, and it
earns its keep: the first ripe-wheat render came back at 1.61:1 — 250 px wide
and 164 tall where it wanted 125 — and two plots of it met at the wrong angle
and left a notch where four corners should have touched. The check reads the
ink row by row, takes the widest row as the diamond's left and right corners
and the lowest as its bottom, and fails anything outside 1.9–2.1. The crop
above the widest row is ignored, which is the point: it is the SOIL that
tiles.

## Making one

```sh
node make-prompt.mjs forest     # -> forest.prompt.txt
./prep.sh                       # mark the grab
# attach style-reference.png AND the prompt to a new ChatGPT message
./ingest.sh forest              # newest download -> master -> sprite
```

The ChatGPT sequence that works is written up in
[`../terrain/README.md`](../terrain/README.md) — send with a scripted click on
the submit button, take the render off a canvas, and allow automatic downloads
for the site. One difference here: **the frame comes back square or 2:1 at
random**, and it does not matter, because the normaliser trims to the ink.

## Landed

| Asset | Scale | Drawn height | Notes |
|---|---|---|---|
| `forest` | 1.45 | 1.37 plots | three trees, not a thicket: trunks read, gaps let the ground through, and the crowns interleave across tile edges |
| `mountain` | 1.55 | 1.51 | six or seven broad facets; craggy on every side |
| `mountain_iron` | 1.55 | 1.53 | two or three bold rust-red seams — few and large enough to read at thumbnail size |
| `mountain_gold` | 1.55 | 1.54 | the same, in gold |
| `berry_bush` | 0.35 | 0.21 | waist-high on a villager |
| `wild_animals` | 0.27 | 0.23 | boar at knee height — it is a wild pig, not a bear |
| `fish_shoal` | 0.95 | 0.48 | lies flat, so it reads as the diamond itself |
| `forest_exhausted` | 1.0 | 0.55 | three stumps, a cut log, one sapling — the same place, logged |
| `farmlands` | 1.0 | 0.56 | a field: one plot wide, soil 1.92:1, wheat standing clear of it |
| `farmlands_exhausted` | 1.0 | 0.51 | the same field cut to stubble; soil 1.97:1 |
