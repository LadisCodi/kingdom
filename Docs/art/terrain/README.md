# Terrain assets — masters, prompts and the normalisers

The isometric ground set, generated against
[`../style-reference.png`](../style-reference.png) under
[`../art-direction.md`](../art-direction.md).

Two kinds of piece, and the renderer that uses them is
[`src/render/terrain.ts`](../../../src/render/terrain.ts).

| | |
|---|---|
| `terrain_<id>.png` … `terrain_<id>_4.png` | the **tiles**: four drawings of the same ground, one of which each cell picks by a hash of its coordinates. Without them a field of 1,470 cells is a visible weave |
| `terrain_<id>_edge.png` | the **fringe**: that ground creeping over its neighbour, drawn once for the diamond's upper-right edge and mirrored in code for the other three |
| `<id>-<n>.prompt.txt` | the exact prompt, verbatim. **Attached as a file** to the ChatGPT message — a long prompt typed into the composer sends itself on the first newline |
| `<id>-<n>.master.png` | what came back, untouched, with its real alpha |

Every piece is authored at **256 × 128** — twice the 128 × 64 diamond the game
draws — because the renderer always scales down and never up.

## Making one

```sh
node make-prompt.mjs grassland 2      # -> grassland-2.prompt.txt
# attach style-reference.png AND the prompt to a new ChatGPT message
./ingest.sh grassland 2               # newest download -> master -> tile
```

An edge piece is anchored, not trimmed — **where** the material sits inside
the diamond is the whole point — so it gets `norm_edge.sh`, which takes the
diamond's band out of the square master and checks two things: that the
upper-right edge is solid (anything soft there is a seam) and that the
lower-left is empty (anything there is not one edge).

## What a master has to satisfy

- **A real alpha channel.** `magick m.png -format "%[pixel:p{0,0}]" info:` →
  `srgba(0,0,0,0)`.
- **2:1.** `norm_tile.sh` fails outside 1.80–2.20; the squash shows in the
  game whatever the output size says.
- **No thickness.** A tile is a SURFACE. Any soil layer, rock face, bevelled
  rim or base makes it a diorama chunk and it will not abut its neighbours.
- **Even, flat light.** No directional sun, no shadow, no vignette. A tile is
  laid next to copies of itself hundreds of times and an edge darker than the
  middle turns the field into a chequerboard; a fringe is mirrored twice, so
  directional light arrives on the wrong side of two of the four edges.

## Driving ChatGPT through the Chrome extension

Everything in [`../city/README.md`](../city/README.md) applies, plus one:

- **The icon under the bottom-right of an image is SHARE, not download.** The
  download is the arrow that appears when you hover over the image itself;
  the share dialog also offers `Descargar`, which is the safe way out of it.
  `ingest.sh` refuses a download older than five minutes for this reason —
  without that check it silently normalises whatever was in `~/Downloads`
  last, which is how a Rune Carver once became a grassland tile.

## Landed

| Asset | Ratio | Notes |
|---|---|---|
| `terrain_grassland` | 2.01:1 | the first probe; even light, abuts cleanly |
