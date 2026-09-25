# Terrain assets — masters, prompts and the normalisers

The isometric ground set, generated against
[`../style-reference.png`](../style-reference.png) under
[`../art-direction.md`](../art-direction.md).

Two kinds of piece, and the renderer that uses them is
[`src/render/terrain.ts`](../../../src/render/terrain.ts).

| | |
|---|---|
| `terrain_<id>.png` … `terrain_<id>_4.png` | the **tiles**: four drawings of the same ground, one of which each cell picks by a hash of its coordinates. Without them a field of 1,470 cells is a visible weave |
| `terrain_<id>_edge.png` | the **fringe**: that ground creeping over its neighbour, drawn once as a band across the top of a square and rotated in code onto all four sides |
| `<id>-<n>.prompt.txt` | the exact prompt, verbatim. **Attached as a file** to the ChatGPT message — a long prompt typed into the composer sends itself on the first newline |
| `<id>-<n>.master.png` | what came back, untouched |

Every piece is authored as a **plain 256 × 256 square** — no shape, no
outline, no silhouette. The renderer maps that square corner to corner onto
the cell's diamond (`onDiamond`, [`src/render/iso.ts`](../../../src/render/iso.ts)),
which is simply what an isometric camera does to a square of ground. It is
twice the diamond's 128 across because the renderer scales down, never up.

**Never ask the model to draw the diamond.** The first pipeline did, and what
came back was a rounded lozenge: 32 px from the centre its half-width was
32 px where a true diamond wants 64, so the corners — the one place four
tiles meet — were chamfered away. A flat surface has no silhouette, so its
outline is the one thing the model has no reference for. Asking for a plain
texture makes the corners exact by construction, and the 2:1 squash the
square gets on the way in IS the foreshortening.

The same trick carries the fringes: a square with a band of material across
its **top**, fading down into real alpha, which `onDiamond` lays on whichever
of the four sides the neighbour is across. One piece, four sides, and the
basis is ROTATED rather than mirrored.

## Making one

```sh
node make-prompt.mjs grassland 2      # -> grassland-2.prompt.txt
# attach style-reference.png AND the prompt to a new ChatGPT message
./ingest.sh grassland 2               # newest download -> master -> tile
```

`norm_edge.sh` warns on the two things that make a seam: a top edge that is
not solid, and ink reaching too far down the frame.

## What a master has to satisfy

- **No shape.** A tile fills its frame edge to edge and is **fully opaque**;
  `norm_tile.sh` fails on a single transparent pixel, because transparency
  means the model drew a tile rather than a texture. Only a fringe has alpha,
  and there it must be real: `magick m.png -format "%[pixel:p{0,0}]" info:` →
  `srgba(0,0,0,0)`.
- **No thickness.** A SURFACE seen from straight above. Any soil layer, rock
  face, bevelled rim or base makes it a diorama chunk.
- **Even, flat light.** No directional sun, no shadow, no vignette. A tile is
  laid next to copies of itself hundreds of times and an edge darker than the
  middle turns the field into a chequerboard; a fringe is rotated onto four
  sides, so directional light arrives from four directions on screen.
- **Evenly spread detail.** Nothing centred, nothing big or bright enough to
  be recognised and counted when the same tile turns up three cells away.

## Driving ChatGPT through the Chrome extension

Everything in [`../city/README.md`](../city/README.md) applies, plus one:

- **The icon under the bottom-right of an image is SHARE, not download.** The
  download is the arrow that appears when you hover over the image itself;
  the share dialog also offers `Descargar`, which is the safe way out of it.
  `ingest.sh` refuses a download older than five minutes for this reason —
  without that check it silently normalises whatever was in `~/Downloads`
  last, which is how a Rune Carver once became a grassland tile.

## Landed

All 30 pieces: six terrains × four tiles, plus a fringe each.

| | |
|---|---|
| Tiles | `grassland` `plains` `desert` `snow` `tundra` `water`, ×4. Every one fully opaque, no shape, harmonised onto its first variant |
| Fringes | one per terrain. Top band 0.98–0.99 solid, bottom two thirds below 1e-5 — the two numbers that decide whether a seam shows |

## Driving ChatGPT through the Chrome extension

A hard-won sequence. Everything in [`../city/README.md`](../city/README.md)
applies, plus:

- **Send with `document.querySelector('button[type=submit]').click()`.**
  Clicking the send button by coordinate or by element reference fails
  perhaps one time in three — the composer's layout shifts as attachment
  thumbnails load, and the click lands on nothing. The JS click never missed.
- **Get the render the same way**: draw the last square `<img>` onto a canvas
  and `toBlob` it into an `<a download>`. The page's CSP blocks `fetch` to
  anything off-origin, localhost included, so a local drop box does not work.
- **Chrome will block scripted downloads** after a few, silently, and the
  share dialog's `Descargar` button stops working too. Allow automatic
  downloads for `chatgpt.com` in the site settings; nothing in the page
  reveals the block, which is why `prep.sh` and the marker exist.
- **A render takes 60–110 seconds.** The grab reports `NOT READY` with the
  sizes it found, and `1024x1536` is the style reference in the composer, not
  a render in progress.
