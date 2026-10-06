# Plan — what a world hex looks like

> **What this is.** How a hex of the world board is drawn — its terrain, its
> feature, its district, the Fortress built into it, the roads between
> districts — and the art that needs. What the hex IS stays in
> [`../features/19-world-map.md`](../features/19-world-map.md) §2, §7, §8; the
> camera is [`../art/art-direction.md`](../art/art-direction.md) §7.1; how
> districts came to be is [`world-districts.md`](world-districts.md).
>
> **Status: built.** Mockups m60–m61 ([`../art/ui/mockups/`](../art/ui/mockups))
> set the style.

## 0. Decisions this plan rests on

- **A hex holds one feature, and each is drawn as one piece of art**, not
  composed from loose props.
- **A district works the feature it stands on** and its art includes it: the
  Logging Camp among its trees, the Quarry cut into its rock (§3).
- **The board reads as land, not tiles**: features spill past their hex,
  small decorations fill the ground, terrains blend where they meet, and
  the seam between hexes is faint (§3.1).
- **Roads are one texture, laid by the game** along winding curves, under
  every district alike (§5).
- **The strategic zoom draws only the main things** (§6).

## 1. Which features roll where

19-world-map §9.1 is the table. A feature stands alone on its hex; a Mountain
is a feature, its sprite carrying its own rock, on any terrain.

## 2. The art a hex needs

A hex is **a terrain plate** under **at most one sprite**: its feature's, or
its district's.

| Plates | |
|---|---|
| Grassland, Plains, Desert | the province's own textures, with their variants (one terrain set, art-direction §2) |

| Feature sprites | Variants |
|---|---|
| Forest | 4 |
| Mountain | 4 |
| Fertile land | 3 |
| Game | 4 |
| Dungeon (a cave in its own rock) | 3 |
| Sanctuary | 3 |
| Landmark | 3 |
| Heartwood Grove (a deposit, Docs/plans/precious-deposits.md) | 2 |
| Starfall Crater — carries its own sand (it stands on Desert) | 2 |
| Moonglass Spires | 1 |

- **Variants:** `name`, `name_2`, `name_3`…; a hex picks one by a hash of its
  index, so the same hex always draws the same one. Adding a variant is
  dropping a file.
- **How it sits on the tilted hex:** its footprint is the hex's top face
  (the hex squashed to 72 %), its foot line a little in front of the centre,
  and it may rise above the hex by up to 0.8 of the hex's width.
- **Authored** 512 px wide (2× the 256 px hex), transparent, no ground, no
  shadow. The canvas is the hex's width; **its bottom edge stands on the foot
  line**, and the art is centred on it.
- [`../art/world/norm_hex.py`](../art/world/norm_hex.py) cuts a sprite from a
  sheet, trims it, scales it to a share of the canvas width (0.88–0.92) and
  sets its lowest opaque row on the canvas's bottom edge.

## 3. A hex with a district

- **The district's art includes its feature** and replaces the feature's
  drawing:

| District | Art | Variants |
|---|---|---|
| Rural district | a hamlet: cottages, a well, a vegetable patch | 4 |
| Logging Camp | a lodge and log pile among trees | 1 |
| Quarry | the mountain with a cut face and a shed | 1 |
| Farm Lands | a farmhouse with its fields | 1 |
| Hunting Grounds | a log cabin, a drying rack, game nearby | 2 |
| Observatory | the landmark's stones and a domed stargazer's tower | 1 |
| Shrine | the sanctuary's spring and a small chapel | 1 |
| Grove Camp | the heartwood grove with a woodcutters' hut and glowing logs | 1 |
| Starmetal Dig | the crater with a winch and ore carts | 1 |
| Spire Quarry | the moonglass spires with a cutters' shed and crates | 1 |

- **A district going up** draws faint, at 45 %.
- **Until a district has art**, its feature is drawn with a province building
  standing in front of it.
- **The Fortress** is a small keep at the hex's rear corner, 0.3 of the hex's
  width — the `whex_fortress_l1|l3|l5` keep for its levels 1, 2 and 3 — faint
  while its first level goes up. It never replaces the district.
- **The Chapel** is a small chapel at the other rear corner, 0.2 of the
  hex's width (`whex_chapel`), faint while it goes up. The world relic it
  holds hovers over it, small; over a Shrine district, over the Shrine.
- **Files:** `whex_<feature>[_n].png`, `whex_<district>[_n].png`
  (`src/render/world/hexArt.ts`).

### 3.1 Land, not tiles

- **Decorations** — grass tufts, clover and wildflowers, bushes and a fern,
  rocks, lone trees (`wdeco_*.png`, sixteen) — are scattered over every hex
  without a district, by a hash of its index, so a hex always looks the
  same (`src/render/world/hexScatter.ts`):

| The hex holds | How many | Mostly |
|---|---|---|
| nothing | 11, anywhere | grass, flowers, bushes |
| Forest | 8, round its edge | lone trees, bushes |
| Mountain | 7, round its edge | rocks |
| Fertile land, Game | 6–7, round its edge | grass, flowers, bushes |
| a site | 6, round its edge | rocks, flowers |

- A decoration may stand a little past its hex's edge, so neighbours blend,
  but never where the cloud bank lies. None at the strategic zoom.
- **A feature's drawing is nudged** off the middle and drawn 1.08–1.18 of
  the hex's width, so it reaches the edges and the rows do not line up.
- **Terrains blend where they meet**: the rarer ground's plate is drawn again
  over the edge, feathered — Plains over Grassland, Desert over both.
- **The seam between hexes is faint**; borders and the selection rim are
  what outline a hex.
- **Art:** one ChatGPT sheet of sixteen
  ([`../art/world/decorations.prompt.txt`](../art/world/decorations.prompt.txt)),
  cut by [`../art/world/cut_decos.py`](../art/world/cut_decos.py).

## 4. Fog

- **Sensed:** the plate and sprite under the veil, what stands a pale
  silhouette (art-direction §8.1).
- **Unknown:** neither; the hex is cloud.

## 5. Roads

- **One strip of road** (`wroad.png`): packed earth with cart ruts and grassy
  verges, running left to right, seamless end to end
  ([`../art/world/norm_road.py`](../art/world/norm_road.py) heals the seam).
- The game lays it **from hex centre to hex centre** between every two
  neighbouring hexes one seat holds — a standing district, or its city —
  along a curve: its two bends swing aside by up to a third of its length,
  by a hash of the pair, so some roads arc and some snake. The strip is laid
  along the curve piece by piece, squashed with the ground, about 0.2 of a
  hex wide, each road a little wider or narrower and starting somewhere else
  on the strip. Roads meet under the district at their hex.
- Drawn on the ground, after the plates, so the districts stand over it.

## 6. The strategic zoom

- Below about 70 px a hex, Game is not drawn.
- Everything else draws as at the tactical zoom, smaller.

## 7. Draw order on a hex

1. The tile's side (art-direction §7.1).
2. The plate, the seam, then the blended edges and every road on the board.
3. The rims on the hex edges: borders, the selection.
4. The decorations behind the middle, the feature or the district, the
   decorations in front; the Fortress's keep.
5. Pills and store bubbles.
6. Over the whole board: armies and explorers.

## 8. Deliberately not in this design

- Loose props laid out by slots.
- More than one feature on a hex.
- A separate drawing per terrain for the same feature or district.
- Hex plates of their own: the province's terrain set serves the board.
- Road pieces drawn per direction: one texture, laid by the game.
- Hex outlines drawn strongly: the board is land with hexes in it.
