# Sprite generation prompts (ChatGPT / GPT-4o images)

Prompts for the first real art pass, replacing the emoji placeholders.
**The art style is defined by [`reference.png`](reference.png)** — bright,
cheerful top-down pixel art: saturated spring greens, soft rounded tree
canopies built from clustered blobs, tiny cream-walled cottages with warm
brown/terracotta roofs, mossy white-grey rocks, tan dirt paths.

Target: square PNGs with transparent background, downscaled to ~128×128
before dropping into `src/render/assets/`.

## How to use these

- **Attach `reference.png` to the ChatGPT conversation and generate the whole
  set in that ONE conversation.** The image is a far stronger consistency
  anchor than any wording — every prompt below assumes it's attached and
  says "match the attached reference". For later sprites, also add *"same
  style as the previous sprite"*.
- If the first result's style is off, fix it on sprite #1 (iterate: "greener",
  "simpler shapes", "bigger pixels", "less detail") before doing the rest.
- Ask for **transparent background** explicitly every time; ChatGPT sometimes
  forgets and paints a backdrop.
- A good consistency trick: first generate the **style sheet** prompt (all
  buildings in one image) to lock the look, then ask for each sprite
  individually "matching the sheet".
- Image models fake pixel art at high resolution — that's fine. Downscale
  with **nearest-neighbor** to keep pixels crisp:
  `magick in.png -filter point -resize 128x128 out.png`.
  The renderer draws with `imageSmoothingEnabled = false` so they stay sharp.
- Detail that vanishes at 128px was wasted anyway — prefer chunky shapes.

## Shared style block

Every prompt below starts with this paragraph — paste it verbatim (with
`reference.png` attached):

> Pixel-art game sprite matching the attached reference image exactly: a
> cheerful top-down fantasy village style with bright saturated spring
> greens, chunky rounded shapes, soft two-tone shading with subtle darker
> outlines, and a warm palette of cream walls, brown/terracotta roofs and
> tan paths. High-angle top-down view like the reference (roofs dominant,
> one facade hinted). Single subject, centered, **transparent background**,
> square canvas, no ground beneath it. No text, no watermark, no background
> scenery. Subject fills about 85% of the canvas.

## 0. Style sheet (lock the look first)

> [style block] …but instead of a single subject: a 3×2 grid of six separate
> sprites on one transparent canvas, evenly spaced, none touching: a small
> town hall with a bell tower; a cozy cottage; a small farm barn with a tiny
> attached silo; a wooden sawmill hut with a visible circular saw blade and
> a small log pile; a cluster of three round leafy trees; a tiny villager in
> a straw hat. All six in exactly the same style, palette and camera angle
> as the attached reference village.

## 1. Townhall (`townhall.png`)

> [style block] Subject: a modest medieval town hall like the larger
> buildings in the reference — two floors, cream plaster walls with wooden
> beams, a small bell tower, a warm terracotta roof, a crest over wooden
> double doors, a tiny banner. Grand but cozy, the most important building
> of a small village.

*Level 2+ variant (optional, `townhall_l2.png`):* "Same building, upgraded:
slightly taller, gilded roof trim, larger banner, small flags."

## 2. Housing (`housing.png`)

> [style block] Subject: a small cozy cottage — cream plaster walls with
> wooden beams, a plump thatched roof, a brick chimney with a wisp of smoke,
> a round window, a flower box. Inviting and warm.

## 3. Farm (`farm.png`)

> [style block] Subject: a small farm building — a warm brown wooden barn
> with a hay loft, a tiny grain silo attached, a couple of hay bales and a
> pitchfork leaning on the wall. Same cottage style as the reference
> village. No fields or crops around it, just the building.

## 4. Crop plot / FarmLands (`farmlands.png` + `farmlands_exhausted.png`)

This one is flat — it should read as ground cover, not a building:

> [style block] Subject: a square plot of tilled farmland seen from above —
> neat rows of ripe golden wheat on dark brown soil, a few sprouting greens,
> slightly rounded edges so it sits like a garden bed. Flat to the ground,
> no building.

*Exhausted variant:* "Same plot, but harvested and depleted: dry brown
stubble rows, cracked pale soil, one wilted plant."

## 5. Sawmill (`sawmill.png`)

> [style block] Subject: a small wooden sawmill — an open-sided timber hut
> with a slanted plank roof, a big circular saw blade visible inside, a
> neat stack of cut logs beside it, sawdust at the base.

## 6. Forest (`forest.png` + `forest_exhausted.png`)

> [style block] Subject: a tight cluster of three plump round leafy trees
> exactly like the trees in the reference — canopies built from clustered
> green blobs with lighter highlight dots, slightly different heights, a
> small mossy rock at the base.

*Exhausted variant:* "Same spot after logging: two tree stumps, one small
pile of logs, a single tiny sapling regrowing."

## 7. Worker (`worker.png` + `worker_carrying.png`)

Drawn at ~60% of a tile, so keep it extra simple:

> [style block] Subject: a tiny villager worker — straw hat, simple tunic,
> rolled-up sleeves, cheerful posture, walking. Very simple, readable at
> small size; big head, small body, no facial detail beyond dots.

*Carrying variant:* "Same villager carrying a bulging brown backpack /
sack over the shoulder, leaning slightly forward."

## 8. Terrain tiles (phase 2 — optional, seamless)

These replace the flat colors in `TERRAIN_COLORS`, one per terrain. Only do
this after buildings look good; tileability is the hard part:

> Seamless tileable square ground texture in the exact pixel-art style of the
> attached reference image, top-down view, soft subtle detail, low contrast
> so game sprites read clearly on top of it, edges must tile perfectly with
> itself, no text, no objects. Subject: …
>
> - Grassland: "…bright spring-green meadow grass like the reference's open fields, with tiny lighter tufts and specks."
> - Plains: "…dry yellow-green plains grass with sparse tufts."
> - Desert: "…warm sand with faint dune ripples."
> - Snow: "…fresh snow with faint blue undulations."
> - Tundra: "…grey-green frozen tundra with patches of frost."
> - Water: "…calm deep blue water with soft wave highlights."
>
> Note: the current `TERRAIN_COLORS` flat colors are darker and more muted
> than the reference. When terrain art (or sprites on flat color) lands,
> rebalance those hexes toward the reference's brighter palette so sprites
> and ground agree.

## File name → code mapping

| File | Replaces | Drawn in |
|---|---|---|
| `townhall.png` | 🏛️ | `mapRenderer.ts` district pass |
| `housing.png` | 🏠 | 〃 |
| `farm.png` | 🌾 | 〃 |
| `farmlands.png` / `_exhausted` | 🟩 / 🥀 | 〃 |
| `sawmill.png` | 🪚 | 〃 |
| `forest.png` / `_exhausted` | 🌲 / 🪵 | feature pass |
| `worker.png` / `_carrying` | 🧑‍🌾 / 🎒 | worker pass |
| terrain set | `TERRAIN_COLORS` | terrain pass |

Overlay icons stay emoji for now: 🚧 construction, ⚠️ needs workers,
🌧️ rain, and all UI/menu glyphs.
