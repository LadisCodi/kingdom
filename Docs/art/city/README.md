# City assets — masters, prompts and the normaliser

The isometric city set, generated against
[`../style-reference.png`](../style-reference.png) under
[`../art-direction.md`](../art-direction.md).

| | |
|---|---|
| `<name>.prompt.txt` | the exact prompt, verbatim. **Attached as a file** to the ChatGPT message — a long prompt typed into the composer sends itself on the first newline |
| `<name>.master.png` | what came back, untouched, with its real alpha |
| `<name>.png` | the same master normalised onto its footprint's canvas — what the game uses |
| `norm_iso.py` | master → game asset |

## Making one

```sh
# 1. attach style-reference.png AND <name>.prompt.txt to a new ChatGPT message
# 2. save what comes back as <name>.master.png
# 3. normalise it (footprint in TILES)
python3 norm_iso.py townhall-l1.master.png 2 2 townhall_l1.png
```

`ingest_named.sh <slug-lN> fw fh [foot FILL]` takes `~/Descargas/kd-<slug-lN>.png` through either normaliser into both folders.

For a loose building that nothing traces the plot of — a hut whose eaves are its
widest point, a windmill whose sails are — use `norm_foot.sh master W H fill out`
instead: it scales the drawing to `fill` of the canvas width and stands its
lowest pixel on the canvas's bottom edge.

`norm_iso.py` finds the ground diamond from the master's opaque extents, scales
it so the diamond is `128 × footprint` wide, and anchors it on the diamond's
centre. **It prints the projection ratio and warns below 1.85:1** — the error a
contact sheet hides and the game does not.

## Driving ChatGPT through the Chrome extension

Four things about the composer, each learned the expensive way:

- **Never type the prompt into the composer.** Its first newline sends the
  message, so only the first line arrives. Attach the `.txt` and say *follow
  the attached prompt exactly*.
- **The file input only exists once the page has hydrated.** The first `find`
  after `navigate` usually fails; wait ~10s and look again, or click the `+`.
- **Do not press Escape after uploading.** It moves focus to the `+` button and
  the next `type` goes nowhere. If the `+` menu is open, dismiss it by clicking
  the composer itself.
- **Click the composer's own placeholder row before typing**, at its actual
  y (read it off a screenshot — it moves as the attachment thumbnails load).
  `form_input` does not work on it: it is a contenteditable `div`, not an input.

## What the master has to satisfy

- **A real alpha channel.** `magick m.png -format "%[pixel:p{0,0}]" info:` →
  `srgba(0,0,0,0)`, and one connected opaque component, no stray specks.
- **No ground plate.** The terrain tile under the building supplies the ground.
- **2:1 projection.** A ground square drawn exactly twice as wide as it is tall.

## Landed

| Asset | Footprint | Projection | Notes |
|---|---|---|---|
| `townhall_l1` | 2×2 | 1.99:1 | the first probe; two passes — the first came back at 1.57:1 on a turf block |
| every levelled building, `_l1`–`_l3` | its own | — | **the first three levels climb three materials**: `_l1` a wooden camp (logs, planks, stakes); `_l2` rough grey fieldstone walls under timber and thatch or shingles; `_l3` cream dressed stone and blue tiles. One ChatGPT conversation per building, `_l1` then `_l2`, with `_l3` attached as the ceiling; where `_l3` was missing (the Tavern) or a copy (the Mason's Yard was the Carpenter's) it was drawn first |
| `farm_l1`–`_l4`, `_l8` | 1×1 | — | **the Farm is a windmill**, every tier: wooden post mill → smock mill → mill house → tower mill → great mill. `norm_foot.sh` at 1.0, because the sails are the widest point |
| `sanctum_l1`, `_l2`, `housing_l1`, `_l2` | — | — | through `norm_foot.sh` (0.6, 0.82, 0.82, 0.9): a loose shrine, tower or hut that `norm_iso.py` blows up to the plot's width |
| `housing_ruin`, `farm_ruin`, `sawmill_ruin` | 1×1 | — | the camps' ruins, each drawn from its own `_l1` master attached as the subject |
| the military halls, the Sanctum and the workshops, all tiers | 2×2 | as their 1×1 cut | re-cut from the same masters with `norm_iso.py <master> 2 2`: a 1×1 plot drew them as models beside the Townhall |

