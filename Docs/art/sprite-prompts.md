# Sprite generation prompts (ChatGPT / GPT-4o images) — v2 "from afar"

Prompts for the second art pass. **The art style is defined by
[`reference.png`](reference.png)** — bright, cheerful top-down pixel art:
saturated spring greens, soft rounded tree canopies built from clustered
blobs, tiny cream-walled cottages with warm brown/terracotta roofs, mossy
white-grey rocks, tan dirt paths.

## v2 art direction: manage from afar

The v1 sprites (kept in `originals/` for reference) were large, detailed,
single 3/4-view buildings — a "one hero building fills the tile" look. That
does **not** match the reference mockup, which is seen from much further
out, like a Civilization map:

- **Camera**: very high angle, almost straight top-down (~75°). Roofs are
  most of what you see of a building; at most a sliver of one facade.
- **Scale**: buildings are TINY. A single cottage is a handful of chunky
  pixel clusters — roof, wall sliver, done. No window panes, no beams, no
  door handles. Detail that only reads when zoomed-in is wrong, not just
  wasted.
- **Tiles are vignettes, not hero buildings.** A district tile is a small
  *scene*: a cluster of tiny buildings, a patch of field, a camp. Higher
  levels add **more buildings and props to the cluster**, they don't blow
  one building up bigger.
- **Consistent world scale across every sprite**: one hut ≈ 25–35% of the
  canvas width, a villager ≈ 10%, a tree canopy ≈ 20–30%. If a level-1 tile
  is just one hut, the hut stays that small and the rest of the canvas is
  empty (transparent) — resist the urge to fill the tile.
- **Progression fantasy**: level 1 looks improvised/primitive (camp, hut,
  chopping block), level 3 reaches the reference's cozy medieval look. The
  Townhall literally starts as a campfire.

Target: square PNGs without background, downscaled to ~128×128
before dropping into `src/render/assets/`.

## Proven workflow (used for the v2 set, 2026-09-01)

What actually worked when generating the full v2 set with ChatGPT:

1. **One conversation, `reference.png` attached to the first message.**
2. **Generate in 2×2 vignette sheets**, four assets per image — massively
   better style/scale consistency than one-off sprites, and 4× fewer
   generations. Describe each vignette by grid position (TOP-LEFT …).
3. **ChatGPT bakes a fake checkerboard instead of real alpha.** Ask it,
   in the same message, to *"apply the true-alpha transparency correction
   and give me the download link for the corrected PNG"* — after being
   called out once it reliably runs its own alpha extraction + channel
   verification and hands back a genuinely transparent PNG. Verify
   locally anyway: `magick sheet.png -format "%[pixel:p{0,0}]" info:`
   must print `srgba(0,0,0,0)`.
4. **Full-bleed tiles (farmlands, terrain) go in their own sheets** where
   each quadrant is completely filled, flat and self-wrapping — never mix
   them with vignettes, and say "no rotation, no diamond shape, no 3D
   thickness" or fields come out isometric.
5. **Normalize scale locally, not in the prompt.** The generations keep
   the reference's world scale (tiny hut ≈ 15% of the canvas), which
   looks empty in-game. Each quadrant is cropped, trimmed to its content
   bounding box and rescaled onto a 128×128 canvas (256×128 for Docks) to
   a per-asset fill fraction — small for L1 (~0.55–0.75), near-full for
   L3 (~0.9), so tiles feel full while levels still read as growth.
   Scripts: `norm.fish` / `norm_wide.fish` (kept with the source sheets
   in `originals/v2-sheets/`).

## How to use these

- **Attach `reference.png` to the ChatGPT conversation and generate the
  whole set in that ONE conversation.** The image is a far stronger
  consistency anchor than any wording. For later sprites, also add *"same
  style and scale as the previous sprite"*.
- If the first result's style is off, fix it on sprite #1 (iterate:
  "smaller buildings", "more top-down", "chunkier pixels", "less detail")
  before doing the rest.
- Ask for **transparent background** explicitly every time; ChatGPT
  sometimes forgets and paints a backdrop.
- Consistency trick: first generate the **style sheet** prompt (several
  vignettes in one image) to lock look *and scale*, then ask for each
  sprite individually "matching the sheet".
- Image models fake pixel art at high resolution — that's fine. Downscale
  with **nearest-neighbor** to keep pixels crisp:
  `magick in.png -filter point -resize 128x128 out.png`.
  The renderer draws with `imageSmoothingEnabled = false`.
- Detail that vanishes at 128px was wasted anyway — prefer chunky shapes.

## Shared style block

Every prompt below starts with this paragraph — paste it verbatim (with
`reference.png` attached):

> Pixel-art game tile matching the attached reference image exactly: a
> cheerful fantasy kingdom map seen from very far away, almost straight
> top-down (roofs dominant, a thin sliver of one facade), bright saturated
> spring greens, chunky pixels, soft two-tone shading, warm palette of
> cream walls, brown/terracotta roofs, tan dirt paths. Buildings are TINY
> and extremely simple — a cottage is just a roof shape and a wall sliver,
> no windows or beams, matching the scale of the houses in the reference.
> The subject is a small scene of a few such elements, centered, on a
> **fully transparent background** — no ground plate, no grass base, no
> backdrop, only small soft shadows directly under objects. Square canvas,
> no text, no watermark, no border.

Follow it with a scale anchor when generating one-off sprites:

> Keep the same world scale as the reference: a single hut spans about a
> third of the canvas; empty canvas stays transparent.

## 0. Style sheet (lock look + scale first)

> [style block] …but instead of one scene: a 2×2 grid of four separate
> vignettes on one transparent canvas, evenly spaced, none touching:
> (1) a lone tiny thatched hut; (2) a campfire with two small tents;
> (3) a cluster of five tiny cream-walled cottages with terracotta roofs
> around a well; (4) three plump round leafy trees. All four at the same
> scale — the hut, a tent, a single cottage and a tree canopy are all
> roughly the same tiny size, exactly like buildings in the attached
> reference.

## 1. Townhall — 3 levels

`townhall_l1.png` — the settlement begins:

> [style block] Scene: a small pioneer camp — one campfire with a visible
> flame and a thin smoke wisp in the middle, two tiny brown canvas tents
> facing it, a log bench, a couple of supply crates and sacks. Improvised
> and humble, the very first spark of a kingdom.

`townhall_l2.png` — a proper village hall:

> [style block] Scene: a small timber longhouse hall with a terracotta
> roof and a tiny banner pole flying a blue pennant, flanked by two tiny
> thatched huts and a fire pit, a tan dirt path connecting them. Still
> modest, but clearly the heart of a young village.

`townhall_l3.png` — the hilltop town:

> [style block] Scene: a dense hamlet on a low grey rocky mound exactly
> like the hilltop village in the attached reference — eight to ten tiny
> cream-walled houses with terracotta roofs packed on the rock, a slightly
> taller tower with a blue banner at the top, a tan path spiraling up.
> The most important tile in the kingdom, still tiny and cozy.

## 2. Housing — 3 levels

`housing_l1.png`:

> [style block] Scene: one lone primitive hut — round mud-and-timber walls,
> a shaggy straw thatched roof, a tiny woodpile beside it. Nothing else;
> the rest of the canvas stays transparent.

`housing_l2.png`:

> [style block] Scene: two tiny cream-walled cottages with terracotta
> roofs, slightly different sizes and orientations, joined by a short tan
> dirt path, one small bush between them.

`housing_l3.png`:

> [style block] Scene: a cozy cluster of five tiny cream-walled cottages
> with terracotta roofs around a tiny stone well, short tan paths between
> them, two small bushes. A snug residential hamlet like the clusters in
> the reference.

## 3. Farm — 3 levels

`farm_l1.png`:

> [style block] Scene: a primitive smallholding — a small square patch of
> dark tilled soil rows, a tiny wooden shack with a straw roof at its
> corner, a simple scarecrow. Improvised, first-harvest feel.

`farm_l2.png`:

> [style block] Scene: a small farm — a tiny brown wooden barn with a
> terracotta roof, two hay bales, a small fenced plot of green sprouting
> rows beside it, a tan path stub.

`farm_l3.png`:

> [style block] Scene: a thriving farmstead cluster — a tiny barn with a
> small attached grain silo, a second smaller shed, a tiny fenced animal
> pen with two white specks of sheep, a hay cart, short tan paths.

## 4. Crop plot / FarmLands (`farmlands.png` + `farmlands_exhausted.png`)

No levels (not upgradeable). Flat ground cover, like the reference's
striped fields:

> [style block] Scene: a flat square patch of ripe farmland seen from
> above, exactly like the golden fields in the attached reference — neat
> vertical rows of yellow wheat with slightly darker row shadows, a thin
> brown tilled border, slightly irregular rounded edges so it sits like a
> hand-tended field. Completely flat to the ground, no building, no fence.

*Exhausted variant:* "Same flat patch, but harvested and depleted: dry
brown stubble rows, cracked pale soil, one wilted plant."

## 5. Sawmill / Lumber — 3 levels

`sawmill_l1.png` (v3, 2026-09-01 — the v2 "no building" camp read as a
chopped-trees feature, indistinguishable from the exhausted forest):

> [style block] Scene: a primitive logging camp that clearly reads as a
> small BUILT structure, not just felled trees — a rough open lean-to
> shelter (a slanted roof of rough wooden planks held up by two log posts,
> open sides) sheltering a chopping block with an axe stuck in it; beside
> it a small neat pile of three logs, one fresh tree stump, wood chips
> scattered. The lean-to is cruder and smaller than a proper hut — the
> tier BELOW the level-2 workbench hut.

`sawmill_l2.png`:

> [style block] Scene: a small open-sided timber hut with a slanted plank
> roof over a workbench, a neat small stack of cut logs beside it, one
> stump, sawdust at the base.

`sawmill_l3.png`:

> [style block] Scene: a proper little sawmill — a timber mill hut with a
> terracotta roof and a visible circular saw blade at its open side, a log
> ramp, two big neat stacks of logs and cut planks, a tan path stub.

## 6. Forest (`forest.png` + `forest_exhausted.png`)

> [style block] Scene: a tight cluster of three plump round leafy trees
> exactly like the trees in the reference — canopies built from clustered
> green blobs with lighter highlight dots, slightly different heights, a
> small mossy grey rock at the base.

*Exhausted variant:* "Same spot after logging: two tree stumps, one small
pile of logs, a single tiny sapling regrowing."

## 6b. Berry bush (`berry_bush.png`)

> [style block] Scene: a plump round berry bush — dense green foliage built
> from clustered blobs like the reference trees, dotted with bright
> blue-purple berries, low and wide, a few fallen leaves around it.

## 6c. Wild animals (`wild_animals.png`)

> [style block] Scene: a small group of wild boars — two or three chunky
> round-bodied boars, brown with lighter snouts, standing in a huddle.
> Cute, not menacing, tiny like everything else.

## 7. Worker (`worker.png` + `worker_carrying.png`)

Drawn at ~60% of a tile, so keep it extra simple:

> [style block] Scene: one tiny villager worker — straw hat, simple tunic,
> a few chunky pixels tall like a person would be next to the reference's
> houses, but centered and filling about half the canvas so it stays
> readable when scaled down. Big head, small body, dot eyes, cheerful.

*Carrying variant:* "Same villager carrying a bulging brown sack over the
shoulder, leaning slightly forward."

## 7b. Worker animation frames

The renderer animates units when frame files exist (see mapping below);
every frame falls back to the static sprite, so partial sets are fine.
Generated as 2×2 sheets in the same conversation, with extra registration
demands — paste this block before each animation sheet prompt:

> CRITICAL for animation: the character must be IDENTICAL in all four
> quadrants — same size, same colors, same position, facing the same
> direction, feet standing on the same baseline in every frame; ONLY the
> arms and legs (and the tool) change between frames.

Sheets (frames in reading order TL, TR, BL, BR):

- **Walk cycle** → `worker_walk_1..4.png`: (1) right leg forward, left
  arm forward; (2) legs passing, arms at sides; (3) left leg forward,
  right arm forward; (4) legs passing again. ✅ generated
- **Carrying walk** → `worker_carry_1..4.png`: same four poses with the
  bulging brown sack held rigid over the left shoulder. ✅ generated
- **Chop + mine** → `worker_chop_1/2.png`, `worker_mine_1/2.png`: top row
  a 2-frame axe loop (raised / struck low with wood chips), bottom row a
  2-frame pickaxe loop (raised / struck low with stone chips).
  ⏳ pending (ChatGPT Work quota)
- **Farm + row** → `worker_farm_1/2.png`, `fishing_boat_row_1/2.png`: top
  row a 2-frame sickle loop (raised / swung low with straw bits), bottom
  row the fishing boat with oars swept back / forward plus tiny ripples.
  ⏳ pending (ChatGPT Work quota)

**Processing**: frames of one loop must NOT be normalized per-frame (bbox
jitter) — use `originals/v2-sheets/anim_norm.fish`, which gives the whole
group one common scale and plants every frame's feet on a shared baseline:
`fish anim_norm.fish sheet.png 0.90 worker_walk_1.png:tl … worker_walk_4.png:br`.
The static `worker.png` / `worker_carrying.png` are copies of each cycle's
neutral passing frame (frame 2), so stopping never pops the character.

**Runtime mapping** (`mapRenderer.ts`): MovingToCell/MovingHome plays
`worker_walk_*` (or `worker_carry_*` when carrying) at 140 ms/frame with a
volume-preserving squash-and-stretch bounce per footfall, mirrored when
the leg heads left; Working plays the 2-frame loop for the building's
harvest source (Crops→farm, Forest→chop, Stone/Iron→mine) at 320 ms;
boats play `fishing_boat_row_*` while moving and bob gently. Ambient
villagers reuse the walk cycle.

## 8. Terrain tiles (seamless)

These replace the flat colors in `TERRAIN_COLORS`, one per terrain:

> Seamless tileable square ground texture in the exact pixel-art style of
> the attached reference image, top-down view, soft subtle detail, low
> contrast so game sprites read clearly on top of it, edges must tile
> perfectly with itself, no text, no objects. Subject: …
>
> - Grassland (`terrain_grassland.png`): "…bright spring-green meadow grass like the reference's open fields, with tiny lighter tufts and specks."
> - Plains (`terrain_plains.png`): "…dry yellow-green plains grass with sparse tufts."
> - Desert (`terrain_desert.png`): "…warm sand with faint dune ripples."
> - Snow (`terrain_snow.png`): "…fresh snow with faint blue undulations."
> - Tundra (`terrain_tundra.png`): "…grey-green frozen tundra with patches of frost."
> - Water (`terrain_water.png`): "…calm deep blue water with soft wave highlights."
>
> Note: the current `TERRAIN_COLORS` flat colors are darker and more muted
> than the reference. When terrain art (or sprites on flat color) lands,
> rebalance those hexes toward the reference's brighter palette so sprites
> and ground agree.

## File name → code mapping

The sprite store (`src/render/sprites.ts`) picks up any PNG in
`src/render/assets/` by filename. The district pass tries
**`<sprite>_l<level>`** first, then the un-leveled `<sprite>`, then the
emoji glyph — so leveled art can land one file at a time. The placement
preview uses `<sprite>_l1`.

| File | Replaces | Drawn in |
|---|---|---|
| `townhall_l1..l3.png` | 🏛️ | `mapRenderer.ts` district pass |
| `housing_l1..l3.png` | 🏠 | 〃 |
| `farm_l1..l3.png` | 🌾 | 〃 |
| `farmlands.png` / `_exhausted` | 🟩 / 🥀 | 〃 (no levels) |
| `sawmill_l1..l3.png` | 🪚 | 〃 |
| `forest.png` / `_exhausted` | 🌲 / 🪵 | feature pass |
| `berry_bush.png` | 🫐 | 〃 (finite — no exhausted variant) |
| `wild_animals.png` | 🐗 | 〃 (finite — no exhausted variant) |
| `worker.png` / `_carrying` | 🧑‍🌾 / 🎒 | worker pass |
| terrain set | `TERRAIN_COLORS` | terrain pass |

Gameplay note: current data caps levels below 3 for some districts
(Townhall/Farm max 2, Housing max 1) — the L3 art is ready for when the
balance sheet raises those caps.

Overlay icons stay emoji for now: 🚧 construction, ⚠️ needs workers,
and all UI/menu glyphs.
