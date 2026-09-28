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

**Not yet in `src/render/assets/`.** The renderer is still top-down until lane A
lands ([`../../plans/the-4x-build.md`](../../plans/the-4x-build.md) §2), and an
isometric building on a top-down floor is a regression for no gain. These move
across when the projection does.
