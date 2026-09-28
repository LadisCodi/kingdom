# Art direction — the world

> **Scope.** How every asset of the **world** is made: the look, the isometric
> projection the city stands in, terrain, buildings, units, the hex board, the
> map's states, and the pipeline from prompt to atlas.
>
> **Not in scope: the chrome.** Menus, sheets, cards, icons and type are
> [`ui-menus-redesign.md`](ui-menus-redesign.md) and
> [`ui-long-game.md`](ui-long-game.md), and their authority is the 26 mockups in
> [`ui/mockups/`](ui/mockups). The chrome is settled; the world is not.
>
> **Status: designed, not built.** Every sprite shipping today is top-down pixel
> art and contradicts this document.

## 1. The anchor

- **The style is [`style-reference.png`](style-reference.png).** Everything is
  generated against it, attached to the first message of the conversation.
- **The prompt is [`style-prompt.md`](style-prompt.md).** Its `LOCKED VISUAL
  STYLE` block is pasted verbatim into every generation; only the `NEW SCENE`
  and `COMPOSITION` blocks change.
- **Two probes already prove it holds across classes:** the diorama in
  `style-reference.png` and the unit portraits in
  [`portraits/units/`](portraits/units). They read as one art team. Match them
  before inventing.

In one line: **a bright stylized-3D diorama under a midday sun** — saturated
spring greens, cream stone, golden timber, blue and gold heraldry; rounded
chunky silhouettes; smooth simplified materials with no photographic texture;
every object readable at thumbnail size.

**The style is not pixel art and nothing in the world is scaled with
nearest-neighbour ever again.**

## 2. Two cameras, one hand

| | **The city** | **The world board** |
|---|---|---|
| Camera | **isometric 2:1** (§3) | **flat, top-down** |
| The unit | a square cell, drawn as a diamond | a pointy-top hexagon |
| What it is for | *a diorama you look into* | *a map you read* |
| Palette | the same | the same |

- **One palette, one terrain set, one light.** The two scales differ in camera,
  never in colour: a single set of terrain art serves both, and the money saved
  is a second terrain set never made (closes OQ-66).
- The world board is flat because its job is **counting** — hexes, distance,
  borders, ownership ([`../features/19-world-map.md`](../features/19-world-map.md)
  §1.2). An isometric hex board makes distance harder to read, which is the
  hexagon's only job.
- What carries continuity between them is the palette, the light and the
  silhouettes — not the camera.

## 3. The isometric projection

**2:1, the mobile builder standard.** A cell's ground is a diamond **128 × 64**
world pixels at zoom 1.

```
screenX = (cell.x - cell.y) * 64
screenY = (cell.x + cell.y) * 32
```

- **Integer arithmetic at every zoom step that is a power of two.** No rounding
  drift, no seams between neighbouring tiles.
- **Draw order is `x + y` ascending** — the painter's algorithm. Tiles further
  from the camera are drawn first.
- **A sprite's anchor is the centre of its ground diamond**, not its own centre
  and not a corner.
- **Buildings rise; they never lean forward.** A sprite may overlap the tiles
  *behind* it (north), never the tiles *in front* (south). That is what keeps
  the painter's algorithm correct with no depth sorting inside a tile.

### 3.1 Canvas sizes

| Footprint | Ground diamond | Canvas | Anchor (from canvas top-left) | Headroom |
|---|---|---|---|---|
| **1 × 1** | 128 × 64 | **128 × 192** | (64, 160) | 128 |
| **2 × 1** | 256 × 64 | 256 × 192 | (128, 160) | 128 |
| **2 × 2** | 256 × 128 | **256 × 320** | (128, 256) | 192 |
| **3 × 3** | 384 × 192 | 384 × 448 | (192, 384) | 256 |

- The ground diamond always sits flush with the **bottom** of the canvas.
  Headroom is everything above it, and it is where the building stands.
- **Generate at 2× and downscale** with a smooth filter. Never author at final
  size, and never upscale.
- Every canvas is a power-of-two multiple, so atlas packing stays tidy.

## 4. Terrain

- Six terrains, full-bleed and self-tiling, one diamond each: **Grassland,
  Plains, Desert, Snow, Tundra, Water**.
- A terrain tile is **quiet**. It is the floor everything else stands on, it is
  seen a thousand times a session, and anything eye-catching in it competes with
  the things that matter. Variation belongs in features, not in the ground.
- **No visible grid lines.** The diamond's edge reads from the terrain's own
  softly rounded, raised diorama edge — the style block already asks for this.
- Water gets the one exception to the quiet rule: clear cyan, gently animated.

## 5. Buildings

- **Silhouette first.** A building is identified at thumbnail size by its
  outline, before any detail resolves. If two buildings share a silhouette, one
  of them is wrong.
- Compact proportions with **slightly oversized roofs, doors, windows and the
  feature that says what the building does** — the mill's wheel, the barracks'
  banner, the sanctum's crystal.
- **Levels read as growth, not as replacement.** A building's levels keep its
  silhouette and its palette and add mass, storeys and props. A player should
  never have to re-learn a building because it levelled.
- The renderer tries `<sprite>_l<level>.png`, then `<sprite>.png`
  (`src/render/assets/README.md`), so levelled art can land one file at a time.
- **Small decorative details, used sparingly.** Tidy vegetation, clustered
  rounded canopies, no clutter.

## 6. Units and characters

- Units are **gameplay-scale figures integrated into the environment**. They
  never pose, never face the camera, and are never the subject.
- **A villager stands ~48 px tall** on a 128 × 64 tile — about a third of a 1×1
  building's headroom. Big enough to read as a person, small enough that the
  city reads as a city.
- Portraits are the opposite discipline and have their own rules:
  [`portraits/prompt-template.md`](portraits/prompt-template.md). **A portrait is
  a face; a unit is a silhouette.**
- Animation is loose frames in [`characters/`](characters), assembled by
  `npm run art:characters`. Walk cycles are 4 frames, work loops 2.

## 7. The hex board

- **Pointy-top hexagons, flat camera.**
- Two zoom registers ([`../features/19-world-map.md`](../features/19-world-map.md)
  §1.2), one asset set serving both:

| Register | Hex width on screen | Its job |
|---|---|---|
| Tactical | ~130 pt | look at a place |
| Strategic | ~45 pt | count hexes and plan |

- **Author at the tactical size and downscale.** A hex asset is **256 px wide ×
  296 px tall** (pointy-top: height = width × 2/√3), generated at 2×.
- **A hex holds 0…N features**, so its art is a base terrain plate plus
  composable props — never one baked illustration per combination.
- **Three or four content elements read comfortably on a tactical hex.** Past
  that, the hex is overloaded and something must be dropped or merged.
- Ownership reads as a **border colour on the hex edge**, never as a tint over
  the ground — a tinted hex fights the terrain it is meant to identify.

## 8. States the map has to show

Every one of these is a treatment of the same asset, never a second asset.

| State | Treatment |
|---|---|
| **Undiscovered** | opaque rolling mist; the hex or cell is not there |
| **Discovered / Sensed** | dimmed, desaturated, half-veiled; silhouettes show through |
| **Revealed** | full colour, the default |
| **Exhausted** (a harvest cell) | the same tile, spent — stumps, bare soil, still clearly the same place |
| **Under construction** | scaffold and a pit, at the building's own footprint |
| **Selected / valid target** | a warm rim on the diamond's edge, never a fill |
| **Inactive** (a world hex off the chain) | greyed toward the Sensed treatment, buildings intact |

- **Unexplored ground is darker, simpler and less saturated — and still the same
  stylized world.** It is never a flat grey void.

## 9. The pipeline

1. **Generate.** One ChatGPT conversation, `style-reference.png` attached to the
   first message, the `LOCKED VISUAL STYLE` block verbatim at the top of every
   prompt. A montage of already-shipped assets attached alongside it is a better
   anchor than the reference alone, because the reference is a *scene* and the
   assets are *trimmed tiles*.
2. **Trim and place.** Crop to content, rescale onto the fixed canvas for the
   footprint (§3.1), anchored on the ground diamond's centre. The scripts in
   [`originals/v3-sheets/`](originals/v3-sheets) generalise this — **with their
   `-filter point` replaced by a smooth filter.** Trimming and padding survive
   the change of style; nearest-neighbour does not.
3. **Verify the alpha.** The background must be genuinely transparent:
   `magick sheet.png -format "%[pixel:p{0,0}]" info:` → `srgba(0,0,0,0)`, and
   `-alpha extract -format "%[fx:mean]"` → below 0.5.
4. **Wire it.** Drop the PNG in `src/render/assets/` — it is picked up by
   filename, no code change (`src/render/assets/README.md`).
5. **Look at it in the game before believing it.** Every asset that looked right
   on a contact sheet and wrong in play was wrong in play.

## 10. The dials, in the order to reach for them

| Dial | Moves | Reach for it when |
|---|---|---|
| **Tile diamond** (128 × 64) | everything | never, in practice — this is the one number everything else is derived from |
| **Headroom per footprint** (§3.1) | how much a building towers | buildings hide each other, or look squat |
| **Villager height** (48 px) | whether the city reads as a city | people vanish, or dominate |
| **Hex width** (256 px authored) | how much a hex can hold | content stops fitting at the tactical size |
| **Terrain busyness** | how much the ground competes | the map feels noisy and nothing pops |

## 11. Deliberately not in this design

- **Pixel art**, anywhere in the world, and `image-rendering: pixelated` on
  anything.
- **Nearest-neighbour scaling**, and the 4-px minimum feature size that went
  with it.
- **The "manage from afar" 80° camera** that showed the top face of everything.
  That was a rule for pixel tiles and it dies with them.
- **A second palette for the world board** (§2).
- **An isometric hex board** (§2).
- **Visible grid lines** on the city ground (§4).
- **Baked hex illustrations** per feature combination (§7).
- **Chrome.** It is specified elsewhere and this document does not touch it.

---

**This replaces** `sprite-prompts.md`, `world-map-mockup-prompts.md` and
`builder-30-days-art.md`, which directed a top-down pixel set against a
reference that no longer exists. They are on the `archive/pixel-art-era`
branch.
