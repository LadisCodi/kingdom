# Plan — what a world hex with several things on it looks like

> **What this is.** How a hex of the world board is drawn when it holds more
> than one thing — terrain, features, an improvement, an Outpost — and the
> art that needs. What the hex IS stays in
> [`../features/19-world-map.md`](../features/19-world-map.md) §2, §7, §8; the
> camera is [`../art/art-direction.md`](../art/art-direction.md) §7.1.
>
> **Status: built 2026-10-02** — the rules, the drawing and the whole art set. Mockups m60–m61
> ([`../art/ui/mockups/`](../art/ui/mockups)) set the style.
>
> **Changing with districts** ([`world-districts.md`](world-districts.md)):
> one feature a hex, Mountain a feature, a district in place of the Outpost
> and its improvement, and roads under the districts. §1–§3 describe the
> board as it is built today.

## 0. Decisions this plan rests on

- **Each combination is drawn as one piece of art**, not composed from loose
  props. A forested mountain is one sprite, not a mountain next to some trees.
- **Generation only makes combinations that make sense** (§1): every feature
  says which terrains it rolls on and what it never shares a hex with. That
  closes the set of combinations to draw.
- **An improvement works the feature it stands on** and its art includes it:
  the Logging Camp among its trees, the Stone Pit cut into its rock, the
  Homestead in its fields (§3).
- **The strategic zoom draws only the main things** (§4).

## 1. Which features roll where

| Feature | Rolls on | Never with |
|---|---|---|
| **Forest** | Grassland, Plains, Mountain | Fertile land, Game, any site |
| **Fertile land** | Grassland, Plains | Forest, any site |
| **Game** | Grassland, Plains, Desert | Forest, any site |
| **Dungeon** | any terrain; placed, and moves (19 §8.1) | every other feature |
| **Sanctuary** | Grassland, Plains (outer ring) | every other feature |
| **Landmark** | Grassland, Plains, Desert (corridors) | every other feature |

- Dungeon, Sanctuary and Landmark are **sites**: a site stands alone on its hex.
- **Fertile land and Game only roll where a Homestead can stand**, the only
  improvement they boost (19 §7).
- A Mountain is terrain, not a feature: Forest on a Mountain is the forested
  mountain. A Dungeon is always drawn as a cave in its own rock.
- Generation rolls features in their order (`WORLD_FEATURES`) and **skips one
  that does not fit** the terrain or a feature already rolled.
- The rules are data: a `featureRules` entry per feature in `worldGen`
  (`terrains`, `excludes`), edited at `?dev=data`, checked in `dataRules.ts`.
- `maxFeaturesPerHex` (2) stays as a ceiling; under these rules the only pair
  is Fertile land + Game.

## 2. The art a hex needs

A hex is **a terrain plate** under **at most one combination sprite**.

| Plates | |
|---|---|
| Grassland, Plains, Desert | the province's own textures, with their variants (one terrain set, art-direction §2) |
| Mountain | the province's tundra: mossy rock; the mountain itself is the combination sprite |

| Combination sprites (9) | On | Variants |
|---|---|---|
| Forest | Grassland, Plains | 4 |
| Fertile land | Grassland, Plains | 3 |
| Game | Grassland, Plains, Desert | 4 |
| Fertile land + Game | Grassland, Plains | 3 |
| Mountain | Mountain | 4 |
| Mountain + Forest | Mountain | 3 |
| Dungeon | any — its art carries its own rock | 3 |
| Sanctuary | Grassland, Plains | 3 |
| Landmark | Grassland, Plains, Desert | 3 |

- **Variants:** `name`, `name_2`, `name_3`…; a hex picks one by a hash of its
  index, so the same hex always draws the same one. Adding a variant is
  dropping a file.

- A combination sprite carries no ground: it stands on any plate it is listed
  for, so the same Forest serves grassland and plains.
- **How it sits on the tilted hex:** its footprint is the hex's top face
  (the hex squashed to 72 %), its foot line a little in front of the centre,
  and it may rise above the hex by up to 0.8 of the hex's width.
- **Authored** 512 px wide (2× the 256 px hex), transparent, no ground, no
  shadow. The canvas is the hex's width; **its bottom edge stands on the foot
  line**, and the art is centred on it.
- [`../art/world/norm_hex.py`](../art/world/norm_hex.py) cuts a sprite from a
  sheet, trims it, scales it to a share of the canvas width (0.88–0.92) and
  sets its lowest opaque row on the canvas's bottom edge.
- **Files:** `whex_<combination>[_n].png` for combinations,
  `whex_<improvement>_l1|l3|l5.png` for improvements
  (`src/render/world/hexArt.ts`). A missing file falls back to the province's
  sprites.

## 3. A hex with an improvement

- **The improvement's art includes the feature it works**, and replaces that
  feature's drawing:

| Improvement | Works | Art |
|---|---|---|
| Logging Camp | the Forest | a lodge and log pile among trees |
| Stone Pit | the Mountain | the mountain with a quarry cut into it and a crane |
| Homestead | Fertile land, if any | a farmhouse with its fields |
| Fortress | nothing | a stone keep |

- **What the improvement does not work stays drawn**, behind it, as its own
  combination sprite at 60 %:
  - Logging Camp on a forested mountain: the Mountain behind, the camp in front;
  - Stone Pit on a forested mountain: the Forest behind, the pit in front;
  - Homestead on Fertile land + Game: the Game in front of the house;
  - Fortress on a Forest: the Forest behind, the keep in front.
- Each improvement has **three art tiers** across its five levels, as a
  province building does.
- **The Outpost** is a small watch-tower at the hex's upper-right corner,
  always; it is never part of a combination.
  - Three variants (`whex_outpost[_n]`), picked like a combination's, and a
    scaffolded tower (`whex_outpost_building`) while its builder is at it.
  - Drawn 0.24 of the hex's width, on a 256 px canvas.

## 4. The strategic zoom

- Below about 70 px a hex: **Game and the Outpost are not drawn**;
  Fertile land + Game draws as Fertile land.
- Everything else — the combination, the improvement — draws as at the
  tactical zoom, smaller.
- Borders, pills and store bubbles draw at every zoom.

## 5. Fog

- **Sensed:** the same plate and sprite, dimmed and veiled (art-direction §8).
- **Unknown:** neither; the hex is mist.

## 6. Draw order on a hex

1. The tile's side (art-direction §7.1).
2. The plate.
3. What is left of the combination behind an improvement (§3).
4. The combination sprite, or the improvement.
5. Game in front of a Homestead.
6. The Outpost.
7. Sensed veil, the edge seam.
8. Over the whole board: borders, armies and explorers, pills and bubbles.

## 7. Build order

1. **Rules — built.** `featureRules` in `worldGen`, generation that skips
   what does not fit, the chances raised so a board holds as many of each
   feature as before (`tests/worldBoard.test.ts`).
2. **Draw by combination — built.** `src/render/world/hexArt.ts` names the
   art of a hex (`tests/hexArt.test.ts`); the renderer draws it, or the
   province's sprites standing in.
3. **Art — built.** 30 combination sprites, 12 improvement sprites and 4
   Outpost towers in eleven ChatGPT sheets, against m60–m61 and the shipped sprites
   ([`../art/art-direction.md`](../art/art-direction.md) §9). Prompts, the
   original sheets and the cutter are in [`../art/world/`](../art/world).

## 8. Deliberately not in this design

- Loose props laid out by slots.
- More than one combination sprite on a hex, except what an improvement
  leaves behind (§3).
- A Forest in the desert, two sites on one hex (§1).
- A separate drawing per terrain for the same combination (§2).
- Hex plates of their own: the province's terrain set serves the board (§2).
- Variants of an improvement: its three tiers are its variety (§3).
