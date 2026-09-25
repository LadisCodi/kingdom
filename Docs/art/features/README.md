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
| `mountain` | 1.55 | 1.25 | |
| `mountain_iron` | 1.55 | 1.45 | rust-red veins read at thumbnail size |
| `mountain_gold` | 1.55 | 1.34 | |
| `berry_bush` | 0.35 | 0.21 | waist-high on a villager |
| `wild_animals` | 0.27 | 0.23 | boar at knee height — it is a wild pig, not a bear |
| `fish_shoal` | 0.95 | 0.48 | lies flat, so it reads as the diamond itself |
