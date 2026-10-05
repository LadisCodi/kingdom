# Plan — districts on a bigger board

> **What this is.** The steps from today's world board — radius 5, up to two
> features a hex, an Outpost and then an improvement — to the design in
> [`../features/19-world-map.md`](../features/19-world-map.md): radius 6, one
> feature a hex, a district that is the claim. The art is
> [`world-hex-art.md`](world-hex-art.md).
>
> **Status: steps 1–3 of 4 built.**

## 1. Steps

| # | Step | What changes |
|---|---|---|
| 1 | **Design** | 19-world-map, 02-map-scopes, this plan, world-hex-art |
| 2 | **The board** | radius 6, the cities on ring 5; Mountain a feature, not a terrain; one feature a hex; the inner ring and the march factors follow. A save's world fog and its trips are reset, and the local world server's boards are thrown away: a hex's index changes with the board |
| 3 | **Districts** | the claim builds the hex's district, decided by its feature; one store per district, in its own currency; the Fortress an upgrade of any district; the bots, the hex sheet, the builder sheet and the save follow |
| 4 | **Art** | the new district sprites, the road pieces and the Fortress mark, from ChatGPT; roads drawn between the ground and the district |

- Each step is a branch and a PR into `develop`, and leaves the game
  playable: step 2 still builds Outposts and improvements, on the new board.

## 2. Districts and their art

| District | Feature | Art |
|---|---|---|
| Rural district | none | **new** — a small village: a few houses and a well |
| Logging Camp | Forest | `whex_logging_camp_l1` |
| Quarry | Mountain | `whex_stone_pit_l1` |
| Farm Lands | Fertile land | `whex_homestead_l1` |
| Hunting Grounds | Game | **new** — a hunter's lodge, drying racks, game nearby |
| Observatory | Landmark | **new** — the landmark's stones, with a small stargazer's tower |
| Shrine | Sanctuary | **new** — the sanctuary's spring, with a small shrine |

- A district's art **includes its feature** and replaces the feature's
  drawing, as an improvement's does today.
- **The Fortress** draws as a small keep at the hex's rear corner, its three
  levels the shipped `whex_fortress_l1|l3|l5` scaled down. It never replaces
  the district.

## 3. Roads

- **Three road pieces** — from the hex's centre to its east edge, its
  north-east edge and its south-east edge — and their mirrors for west,
  north-west and south-west. Authored on the hex's tilted top face, so a
  piece drawn at any hex meets its neighbour's at the shared edge.
- Drawn on the ground canvas, after the plate and before the district, for
  every pair of adjacent hexes one seat holds (its city included).
- Packed earth, the province's road tone; no kerbs, no props.

## 4. Deliberately not in this plan

- District levels, and every upgrade but the Fortress.
- Roads as something built or paid for: they follow the territory.
- Art for a district per terrain: a district stands on any plate, as a
  feature's sprite does.
