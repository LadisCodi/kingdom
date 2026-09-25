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

## The rule

A feature STANDS on its plot, so the renderer scales it to the plot's ground
diamond (128 px across for a 1×1) and puts its **bottom edge on the diamond's
bottom corner** (`drawStanding`, [`src/render/iso.ts`](../../../src/render/iso.ts)).

Normalising is therefore just: trim to the ink, scale so the ink is 256 wide —
twice the diamond, because the renderer scales down and never up. **Height is
free**: a peak is taller art, not a different anchor, and `spriteInkTop` reads
back where the top really is so a label hangs clear of it.

`norm_prop.sh` reports the height in plots. Around 0.85–0.95 is a prop that
stands up; 0.5 is something lying flat, which is right for a shoal and wrong
for a mountain.

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

| Asset | Height | Notes |
|---|---|---|
| `forest` | 0.86 | canopies overlap into continuous woodland when cells adjoin |
| `mountain` | 0.81 | |
| `mountain_iron` | 0.94 | rust-red veins read at thumbnail size |
| `mountain_gold` | 0.86 | |
| `berry_bush` | 0.59 | low by design — it is a bush |
| `wild_animals` | 0.87 | boar, gameplay-scale |
| `fish_shoal` | 0.50 | exactly the diamond's own proportions, which is what a thing lying flat on water wants |
