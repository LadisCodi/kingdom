# Villagers — sprite sheets, prompts and the slicer

The people who live on the map, in the current style. Generated against
[`../style-reference.png`](../style-reference.png) under
[`../art-direction.md`](../art-direction.md), and packed into the character
atlas by `npm run art:characters` like every other character.

| | |
|---|---|
| `cast.json` | who each villager IS and what every frame of each animation shows — the only file to edit to add one |
| `<id>-<anim>.prompt.txt` | the exact prompt, **attached as a file** to the ChatGPT message |
| `<id>-<anim>.master.png` | the sheet that came back, untouched |
| `slice.mjs` | sheet → one frame PNG per pose, written straight into `../characters/` |

## Why a sheet and not a frame at a time

Ask an image model for one pose and then another and you get two different
people: the face drifts, the dress changes shade, the height moves. Ask for
**the whole cycle in one image** and it holds the character together, because
every frame is in front of it as it draws the next. That is the whole trick.

What it does not hold together is one sheet against another — this villager's
idle came back 371 px tall and her walk 268 — so `slice.mjs` rescales each
sheet to put its tallest frame at 256. Within a sheet the differences survive,
and they should: a passing pose really is taller than a stride, and that is
the bounce in the walk. Across sheets they must not, or she shrinks the moment
she starts walking.

## Cutting on the gaps

The frames are cut on the **empty columns between them**, not on an assumed
grid: the model spaces a row of poses by eye, and a fixed-width cut slices
arms off. Finding fewer or more figures than the animation asks for is how a
bad sheet is caught — two poses touching, or one missing.

The trim inside each frame runs at `-fuzz 3%`. The render leaves a contact
shadow that fades to one or two units of alpha, and a bare trim counts that as
ink: it made the same figure 387 px tall in one frame and 268 in the next.

## Making one

```sh
node make-prompt.mjs villager_1 walk   # -> villager_1-walk.prompt.txt
./prep.sh                              # mark the grab
# attach style-reference.png AND the prompt to a new ChatGPT message.
# For a second animation of a character that already exists, attach its
# first sheet's master too — it is the best reference for keeping the face.
./ingest.sh villager_1 walk 4          # sheet -> ../characters/villager_1_walk_*.png
npm run art:characters                 # repack the atlas
```

Then cast the name in [`src/render/cast.ts`](../../../src/render/cast.ts).
`tests/characters.test.ts` fails if a cast name has no frames.

## How big they are

`UNIT_PLOTS` in [`src/render/characters.ts`](../../../src/render/characters.ts)
is **0.38** — a villager stands a little over a third of a plot's diamond
width, a little under a cottage's door. It is the yardstick the map is scaled
against: every feature in [`../features/props.json`](../features/props.json)
is sized against a person, not against the tile.

The atlas records each character's own height, so the 22 px people of the
bought pixel pack and these 256 px renders stand the same height on the grass.

## Landed

| | idle | walk |
|---|---|---|
| `villager_1` — young woman, blue dress, cream apron | 2 | 4 |
