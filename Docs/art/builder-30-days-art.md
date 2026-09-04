# Art — the builder for thirty days

> **What this is.** The art side of
> [`../plans/builder-30-days.md`](../plans/builder-30-days.md): every sprite
> and icon the eleven steps need, the filename it must land under, the
> ChatGPT prompt that produces it and the local command that normalizes it.
> Style, workflow and the alpha correction are
> [`sprite-prompts.md`](sprite-prompts.md) and
> [`ui-menus-redesign.md`](ui-menus-redesign.md) §7.16 — this file adds no
> new rules, only the queue.
>
> **Status: done, bar one atlas sheet.** Every world sprite the eleven steps
> need is in `src/render/assets/`, and the goods icons are in the atlas. What
> is left is **UI-I** (§5) — the ten late menu icons, which cannot be cut
> until their districts are `DistrictId`s. Tick the table in §6.

## 1. Three tiers per building, not ten

Every building in the programme reaches level 10. Ten drawings a building is
not a queue anyone finishes, so a building is drawn **three times** and the
level bands share them:

| Level | File |
|---|---|
| 1–3 | `<sprite>_l1` |
| 4–7 | `<sprite>_l4` |
| 8–10 | `<sprite>_l8` |

The tiers read as *improvised → established → industrial*, the same arc the
existing `_l1..l3` set already walks.

**This needs one code change** (`mapRenderer.ts:362-368`): the district pass
tries `<sprite>_l<level>` and then the un-leveled `<sprite>`, so a level-5
building with `_l1` and `_l4` on disk falls through to the emoji. It must
**walk down** — from the district's level to the highest authored tier at or
below it, then the base sprite, then the glyph. Three lines, and it makes the
existing set right too: Townhall L4 and Sanctum L2–L5 fall to emoji today.

The buildings that already have `_l1`, `_l2`, `_l3` **keep all three** — the
walk-down gives them L1→`_l1`, L2→`_l2`, L3–7→`_l3`, L8–10→`_l8`, so they
need only the new top tier.

Sizes follow the footprint: 1×1 → 128×128, 2×1 → 256×128, 2×2 → 256×256.

## 2. Every filename

**New — the four workshops** (step 3, 1×1):

| Sprite stem | Building | Tiers |
|---|---|---|
| `carpenter` | Carpenter → Planks | `_l1` `_l4` `_l8` |
| `masons_yard` | Mason's Yard → Cut Stone | `_l1` `_l4` `_l8` |
| `smelter` | Smelter → Iron | `_l1` `_l4` `_l8` |
| `rune_carver` | Rune Carver → Runestone | `_l1` `_l4` `_l8` |

**New — the six decorations** (step 6, `max_level` 1, so one tier each):

| Sprite stem | Footprint | File |
|---|---|---|
| `garden` | 1×1 | `garden_l1` |
| `well` | 1×1 | `well_l1` |
| `orchard` | 2×1 | `orchard_l1` |
| `statue` | 1×1 | `statue_l1` |
| `plaza` | 2×2 | `plaza_l1` |
| `shrine` | 2×2 | `shrine_l1` |

`_l1` and not the bare stem because the placement preview asks for
`<sprite>_l1` first (`mapRenderer.ts:488`).

**New — the four systems-as-buildings** (steps 8–11):

| Sprite stem | Footprint | Tiers |
|---|---|---|
| `reliquary` | 1×1 | `_l1` `_l4` `_l8` |
| `tavern` | 2×1 | `_l1` `_l4` `_l8` |
| `watchtower` | 2×2 | `_l1` `_l4` `_l8` |
| `dragon_nest` | 2×2 | `_l1` `_l4` `_l8` |

**Existing — the new top tier only** (`_l1..l3` already on disk):

`townhall_l8`, `housing_l8`, `farm_l8`, `sawmill_l8`, `quarry_l8`,
`market_l8`, `docks_l8` (256×128).

**Existing — the halls and the Sanctum** (one un-leveled sprite today, which
the walk-down leaves serving L1–3):

`sanctum_l4` `sanctum_l8`, `barracks_l4` `barracks_l8`,
`spear_hall_l4` `spear_hall_l8`, `shooting_grounds_l4` `shooting_grounds_l8`,
`stables_l4` `stables_l8`.

**Step 11 props** (not tiles — they appear in the Nest card):

`egg_stone`, `egg_ember`, `egg_storm`, `creature_wyrmling`, `creature_drake`.

**UI atlas** — the goods, sliced into the atlas by `npm run art`, named to
match `IconName` (`src/ui/kit/icon.ts`, held by `tests/icons.test.ts`):
`Planks`, `CutStone`, `Iron` *(exists)*, `Runestone`.

Every **new district also needs a build-menu icon** in the atlas under its
district id — `Carpenter`, `MasonsYard`, `Smelter`, `RuneCarver`, `Garden`,
`Well`, `Orchard`, `Statue`, `Plaza`, `Shrine`, `Reliquary`, `Tavern`,
`Watchtower`, `DragonNest`. Sheets UI-G and UI-H in §5.

## 3. The world sheets

One ChatGPT conversation, `reference.png` attached to the first message, the
[`sprite-prompts.md`](sprite-prompts.md) **shared style block** at the top of
every prompt, and the closing line verbatim: *"Then apply the true-alpha
transparency correction and give me the download link for the corrected
PNG."* Four vignettes a sheet, described by grid position, never touching.

A cell whose asset is 2×1 asks for a scene **wider than tall**; the crop and
the trim do the rest (§4). Thirteen sheets, fifty-two assets.

**Every level-1 tier must read as something BUILT.** A tile holds either a
building the player raised or a natural resource they harvest, and the two
must never be confused — a carpenter's bench alone reads as loose props, a
mason's blocks alone read as a stone deposit. So the humblest tier still
carries a crude open lean-to: a slanted plank roof on two log posts, cruder
and smaller than a hut. This is the same correction that made `sawmill_l1`
what it is (`sprite-prompts.md` §5).

### SPR-E — the workshops, level 1

> [style block] …but instead of one scene: a 2×2 grid of four separate
> vignettes on one transparent canvas, evenly spaced, none touching.
> TOP-LEFT: a carpenter's improvised bench — a rough sawhorse with a plank
> across it, a hand saw, three cut planks stacked beside it, wood shavings.
> TOP-RIGHT: a stonecutter's yard — two rough grey blocks, one half-dressed
> with a chisel and mallet on it, a low canvas shade on two poles, stone
> chips. BOTTOM-LEFT: a small clay bloomery furnace — a squat beehive of
> clay with a dark mouth, a tiny bellows, a heap of black charcoal, one
> orange ember glow. BOTTOM-RIGHT: a rune carver's stump — a flat stone slab
> on a tree stump with one small carved stone shard glowing pale blue, a
> chisel, two candles. All four improvised and humble, the same tiny world
> scale as the reference.

→ `carpenter_l1` `masons_yard_l1` `smelter_l1` `rune_carver_l1`

### SPR-F — the workshops, level 4

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a timber carpentry workshop — a small hut with a terracotta roof
> and one open side showing a workbench, two neat stacks of planks outside, a
> drying rack. TOP-RIGHT: a mason's shed — a small stone-walled shed with a
> slate roof, a two-man stone saw over a block, four dressed cream blocks
> stacked. BOTTOM-LEFT: a stone smelting furnace — a chimney stack with a
> thin smoke wisp, a bright orange glow at its mouth, an ore heap and four
> grey iron ingots. BOTTOM-RIGHT: a rune carver's hut — a small hut with a
> standing stone beside it etched with pale blue glowing runes, a low stone
> wall, one candle lantern.

→ `carpenter_l4` `masons_yard_l4` `smelter_l4` `rune_carver_l4`

### SPR-G — the workshops, level 8

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a carpentry yard — two timber buildings with terracotta roofs, a
> treadle lathe under an awning, tall stacks of planks, a small hoist crane.
> TOP-RIGHT: a walled masonry yard — a stone workshop, a wooden derrick crane
> lifting a block, pallets of dressed blocks, a finished stone arch.
> BOTTOM-LEFT: twin blast furnaces — two tall stone stacks with bright orange
> mouths and smoke, a dark slag heap, pallets of iron ingots.
> BOTTOM-RIGHT: a rune workshop — a small domed building beside a ring of
> three standing stones with bright blue glowing runes and faint blue light on
> the ground.

→ `carpenter_l8` `masons_yard_l8` `smelter_l8` `rune_carver_l8`

### SPR-H — the small decorations

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a tiny flower garden — four small beds of red, yellow and violet
> flowers in neat rows with a narrow tan path between them, one small bush.
> TOP-RIGHT: a village well — a round cobbled stone well with a small wooden
> roof on two posts and a bucket on a rope, two cobblestones at its foot.
> BOTTOM-LEFT: a stone statue — a small cream stone figure of a crowned
> monarch on a square plinth, two steps at its base, a tiny hedge either side.
> BOTTOM-RIGHT: an orchard, WIDER than tall — two neat rows of three small
> round fruit trees with red apples, short grass between the rows, a wicker
> basket of apples.

→ `garden_l1` `well_l1` `statue_l1` `orchard_l1` (2×1)

### SPR-I — the big decorations, and the first Reliquary and Tavern

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a paved town plaza — a square of tan and cream cobblestones with
> a small round fountain in the middle, two wooden benches, four potted
> shrubs at the corners.
> TOP-RIGHT: a stone shrine courtyard — a small round temple of pale stone
> with four columns and a low domed roof on a cobbled platform, a ring of
> glowing pale-blue runes on the stones, two braziers with small flames.
> BOTTOM-LEFT: a tiny reliquary chapel — a small cream stone chapel with a
> steep terracotta roof and a round window, a faint violet glow at its door,
> one candle beside the step.
> BOTTOM-RIGHT: a small tavern, WIDER than tall — a low timber inn with a
> terracotta roof and a hanging painted sign on a post, two barrels and a
> bench outside, warm yellow light at the door.

→ `plaza_l1` (2×2) `shrine_l1` (2×2) `reliquary_l1` `tavern_l1` (2×1)

### SPR-J — the Reliquary and the Tavern grow

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a grander reliquary — a cream stone chapel with a short bell
> tower, two stained-glass slits glowing violet, a small walled garden of two
> hedges, a cobbled step.
> TOP-RIGHT: a great reliquary — a small domed cathedral of pale cream stone
> with a violet-glowing dome lantern, two side chapels, a cobbled forecourt
> with a stone urn.
> BOTTOM-LEFT: a bigger tavern, WIDER than tall — a two-part timber inn with
> a stable lean-to, four barrels, three outdoor tables with benches, a
> lantern on a post, a tan path.
> BOTTOM-RIGHT: a great tavern, WIDER than tall — a three-part timber and
> stone inn with two chimneys smoking, a covered terrace of five tables, a
> stable block, a big painted sign, lanterns.

→ `reliquary_l4` `reliquary_l8` `tavern_l4` (2×1) `tavern_l8` (2×1)

### SPR-K — the Watchtower, and the first nest

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a wooden watchtower — a simple square timber tower on four legs
> with a small roofed platform and a ladder, a tiny blue pennant, a firewood
> pile at its base.
> TOP-RIGHT: a stone watchtower — a round grey stone tower with a
> crenellated top and a blue pennant, a small attached guardroom with a
> terracotta roof, a low stone wall.
> BOTTOM-LEFT: a great watchtower — a tall round stone keep with two tiers of
> crenellations, a beacon brazier burning at the top, two blue pennants, a
> walled yard with a gatehouse.
> BOTTOM-RIGHT: a dragon's nest, first tier — a shallow crater of dark rock
> and grey ash holding one big speckled egg on a bed of straw, a ring of small
> stones around it, two wooden posts with hanging bones.

→ `watchtower_l1` `_l4` `_l8` (2×2 each) `dragon_nest_l1` (2×2)

### SPR-L — the nest grows, and the Sanctum

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a dragon's nest, second tier — a rocky mound with two eggs on
> straw inside a low stone ring, a timber shelter roof over half of it, a
> feeding trough, orange embers in a fire pit.
> TOP-RIGHT: a dragon's nest, third tier — a stone eyrie built into a jagged
> black rock outcrop, an arched cave mouth glowing orange, three eggs on a
> stone platform, claw-scratched flagstones, two braziers.
> BOTTOM-LEFT: a shrine of magic — a small hexagonal stone shrine with a pale
> blue crystal floating above its open roof, a faint blue glow on the ground,
> two standing stones.
> BOTTOM-RIGHT: a domed arcane observatory — a cream stone building with a
> deep blue dome and a gold band, a bright blue crystal above it, a ring of
> small standing stones with blue runes, a cobbled path.

→ `dragon_nest_l4` `_l8` (2×2) `sanctum_l4` `sanctum_l8`

### SPR-M — the existing producers, level 8

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching. Each
> is the biggest, most industrious version of a building that started as a
> hut — dense, busy, prosperous, but still tiny and cozy at the reference's
> world scale.
> TOP-LEFT: a great hall town — a dense hamlet on a grey rocky mound, twelve
> tiny cream houses with terracotta roofs, a tall central tower with a gold
> roof and two blue banners, a cobbled spiral path, a market stall.
> TOP-RIGHT: a townhouse block — six tiny two-storey cream houses with
> terracotta roofs packed tight around a small cobbled square with a tree,
> flower boxes, a lamp post.
> BOTTOM-LEFT: a great farmstead — a big red-roofed barn with two grain
> silos, a windmill with four sails, a fenced pen with three white sheep, a
> loaded hay cart, tilled rows.
> BOTTOM-RIGHT: a great sawmill — a timber mill with a large water wheel on a
> narrow sluice, a circular saw under an open roof, four tall stacks of
> planks and logs, a log ramp.

→ `townhall_l8` `housing_l8` `farm_l8` `sawmill_l8`

### SPR-N — the quarry, the market, the harbour, and a drake

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a great quarry — a stepped grey rock pit with two terraces, a
> wooden derrick crane, a stone-cutting shed with a terracotta roof, pallets
> of cut blocks, a loaded cart.
> TOP-RIGHT: a great market — four striped awning stalls around a small
> cobbled square with a well, crates and barrels, sacks of grain, two
> pennants on poles.
> BOTTOM-LEFT: a great harbour, WIDER than tall — a long wooden pier with two
> mooring posts, a stone quay with a crane, two small fishing boats with
> furled sails, stacked crab pots, a net drying rack, a small warehouse with a
> terracotta roof.
> BOTTOM-RIGHT: not a scene but a single creature, centred and larger than
> the buildings: a red-orange young dragon standing on four legs, wings half
> open, a short snout with two small horns, dot eyes, cute and not menacing.

→ `quarry_l8` `market_l8` `docks_l8` (2×1) `creature_drake`

### SPR-O — the Barracks and the Spear Hall

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a timber warrior hall — a longhouse with a terracotta roof, a
> weapon rack of four swords outside, two round wooden shields on the wall, a
> straw practice dummy, a fenced sand ring.
> TOP-RIGHT: a walled warrior compound — a stone hall with a red-tiled roof
> and a square gate tower, a walled drill yard with three dummies and a
> weapon rack, two red banners.
> BOTTOM-LEFT: a spear longhouse — a timber hall with a thatched roof, a long
> rack of six upright spears beside the door, two round shields, a sand ring
> with a wooden post.
> BOTTOM-RIGHT: a pillared spear hall — a stone hall with six short columns
> and a terracotta roof, two racks of spears, a drill yard of pale sand with
> three posts, a green banner.

→ `barracks_l4` `barracks_l8` `spear_hall_l4` `spear_hall_l8`

### SPR-P — the Shooting Grounds and the Stables

> [style block] …2×2 grid, four vignettes, evenly spaced, none touching.
> TOP-LEFT: a roofed archery range — a long open shed with a plank roof, a
> bench of three bows, and beyond it three round straw targets with red
> centres on the grass.
> TOP-RIGHT: a tiered archery range — a stone-fronted range building with a
> terracotta roof and an open shooting gallery, five straw targets in a row at
> increasing distance, a tall arrow rack, a yellow banner.
> BOTTOM-LEFT: a stable block — a timber stable with a terracotta roof and
> three open stall doors, one brown horse standing outside, a hay pile, a
> water trough, a fenced paddock corner.
> BOTTOM-RIGHT: a stud farm — a bigger stable with a hayloft and a weather
> vane, a second smaller stable, a fenced oval paddock with two horses, a hay
> cart.

→ `shooting_grounds_l4` `_l8` `stables_l4` `_l8`

### SPR-Q — the eggs and the wyrmling

Props for the Nest card, not tiles: each is a **single object**, centred, and
larger in its cell than a building would be.

> [style block] …but instead of scenes: a 2×2 grid of four separate objects
> on one transparent canvas, evenly spaced, none touching, each centred in its
> own quadrant and filling most of it, no ground, no nest, no shadow plate.
> TOP-LEFT: a big grey dragon egg speckled with darker grey flecks.
> TOP-RIGHT: a big dark red dragon egg with faint orange cracks glowing.
> BOTTOM-LEFT: a big pale blue-white dragon egg with tiny white sparks around
> it.
> BOTTOM-RIGHT: a chubby green baby dragon sitting, oversized head, two small
> wings folded, dot eyes, a stubby tail, cheerful and cute, facing the viewer
> three-quarters.

→ `egg_stone` `egg_ember` `egg_storm` `creature_wyrmling`

## 4. Normalizing

`Docs/art/originals/v2-sheets/norm.fish` crops a quadrant, trims to its
content and rescales onto 128×128 at a fill fraction; `norm_wide.fish` does
the same onto 256×128. Fill fractions carry the growth **within** a building, and were checked
against the shipped tiles rather than guessed: `_l1` **0.72**, `_l4` **0.82**,
`_l8` **0.92**. Decorations sit lower — a garden should not fill its tile like
a town — at **0.70**.

2×2 footprints (`plaza`, `shrine`, `watchtower`, `dragon_nest`) need a
256×256 target, which neither script does: `norm_sq.fish <sheet> <quad>
<frac> <out> 256` is the generalized version, added with this pass.

Sheets and the exact command that produced each file are logged in
[`originals/v3-sheets/LOG.md`](originals/v3-sheets/LOG.md).

## 5. The atlas sheets

Both follow [`ui-menus-redesign.md`](ui-menus-redesign.md) §7.16 — a 4×4 grid
at most, the coarse-cell paragraph, the alpha line — with one change that
matters: the anchor is not `reference.png` but **a montage of icons already in
the atlas**, attached, with *"they must be indistinguishable in style from
these"*. A sheet that has to sit inside an existing atlas is matching the
atlas, not the world.

**A refined good must not look like the raw one it is made from.** Planks came
back as round logs — the shipped `Wood` icon — and at 32 px the input and the
output were the same picture. Specify the silhouette, not the subject.

### UI-H — the refined goods (4×2) ✅ landed

Drawn, in reading order: sawn planks, a dressed stone block, a rune stone, a
saw over a sawhorse, a mallet and chisel, a furnace, a rune chisel, one empty
cell. **Named in the manifest:** `Planks`, `CutStone`, `Runestone`. The four
workshop cells are drawn and held at `null` until those districts exist,
because the atlas's first gate refuses a cell the kit cannot name — a
different gate from `AWAITING_ART`, which only tracks names with no art.

`Iron` is deliberately absent: the ore cell from UI-A doubles as the ingot,
which at 16 px is the same picture.

### UI-I — the late menu icons (4×3), not yet cut

Ten district cells whose `DistrictId`s arrive with steps 6 and 8–11 —
`Garden`, `Well`, `Orchard`, `Statue`, `Plaza`, `Shrine`, `Reliquary`,
`Tavern`, `Watchtower`, `DragonNest` — plus `Harmony` and `Creature`. Cut it
when those rows land, so no cell is orphaned; the world art for every one of
them is already on disk.

## 6. Queue

Priority is the plan's step order: the workshops gate step 3, the spine.

| # | Sheet | Files | Step | Status |
|---|---|---|---|---|
| 1 | SPR-E | the four workshops, `_l1` | 3 | ☑ |
| 2 | SPR-F | the four workshops, `_l4` | 4 | ☑ |
| 3 | SPR-G | the four workshops, `_l8` | 7 | ☑ |
| 4 | UI-H | `Planks` `CutStone` `Runestone` + 4 workshop cells held at `null` | 2 | ☑ |
| 5 | SPR-H | `garden_l1` `well_l1` `statue_l1` `orchard_l1` | 6 | ☑ |
| 6 | SPR-I | `plaza_l1` `shrine_l1` `reliquary_l1` `tavern_l1` | 6, 8, 9 | ☑ |
| 7 | SPR-J | `reliquary_l4` `_l8`, `tavern_l4` `_l8` | 8, 9 | ☑ |
| 8 | SPR-K | `watchtower_l1` `_l4` `_l8`, `dragon_nest_l1` | 10, 11 | ☑ |
| 9 | SPR-L | `dragon_nest_l4` `_l8`, `sanctum_l4` | 7, 11 | ☑ |
| 9b | SPR-R | `sanctum_l8` — a single-subject image, not a sheet | 7 | ☑ |
| 10 | UI-I | the ten late menu icons — waits for their `DistrictId`s | 6–11 | ☐ |
| 11 | SPR-M | `townhall_l8` `housing_l8` `farm_l8` `sawmill_l8` | 7 | ☑ |
| 12 | SPR-N | `quarry_l8` `market_l8` `docks_l8` `creature_drake` | 7, 11 | ☑ |
| 13 | SPR-O | `barracks_l4` `_l8`, `spear_hall_l4` `_l8` | 7 | ☑ |
| 14 | SPR-P | `shooting_grounds_l4` `_l8`, `stables_l4` `_l8` | 7 | ☑ |
| 15 | SPR-Q | `egg_stone` `egg_ember` `egg_storm` `creature_wyrmling` | 11 | ☑ |

## Deliberately not in this design

- **Ten drawings a building.** Three tiers and a walk-down say the same thing
  for a third of the work; the level number on the card carries the rest.
- **Per-level art for the decorations.** They cap at level 1 by design.
- **A locked variant of any atlas icon.** Derived locally by desaturation
  (§7.16), which also guarantees the silhouette never shifts.
- **Portraits.** Heroes, units and artifacts are a separate style decision
  (`sprite-prompts.md`, "Portraits — a new class of art") and no step in the
  programme needs one.
