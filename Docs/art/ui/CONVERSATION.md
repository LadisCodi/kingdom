# UI art — generation log

Provenance for everything in `sheets/`. The v2 sprite set lacks this, and
regenerating a sheet six months from now needs the conversation and the exact
prompt variant that produced it, not just the output.

Workflow is [`../ui-menus-redesign.md`](../ui-menus-redesign.md) §7.16.

---

## UI-A — resources & city status

- **Date:** 2026-09-01
- **Conversation:** <https://chatgpt.com/c/6a97455d-f794-83ed-9ddf-822d67c2aea9>
  ("Generate pixel art icons", Codigames workspace)
- **Model:** 5.6 Sol Ligero
- **File:** `sheets/ui-a-resources.png` — 1024×1024, true alpha
- **Prompt:** §7.2 sheet A + the §7.16 export block, with
  `Docs/art/reference.png` attached to the first message.
- **Contents** (reading order, 4 columns × 3 rows): gold coin, apple, cut
  logs, stone block, iron ingot, violet gem, parchment scroll, villager
  heads, hammer + hard hat, farmer, berries, fish.

### Two things worth knowing before doing this again

**1. There are two "download" buttons and only one gives you the real file.**

Clicking the image in the chat opens an *editor*, and its download button
exports what the editor is displaying: a **1254×1254 fully opaque** PNG with
the transparency checkerboard baked in as pixels. It looks right in a viewer
and is completely useless.

The real file is the **"Download the corrected PNG"** link in the message
body — the artifact the code interpreter wrote — which is the 1024×1024
true-alpha file that was asked for.

The §7.16 verification catches the wrong one immediately, and both halves are
needed:

```sh
magick sheet.png -format "%[pixel:p{0,0}]" info:          # srgba(0,0,0,0)
magick sheet.png -alpha extract -format "%[fx:mean]" info: # < 0.5
```

The editor export fails both (`srgb(253,253,253)`, mean `1`). A *faked*
checkerboard would pass the corner test alone, which is why the mean matters.

**2. The grid is not where a naive slicer would look.**

Asked for a strict 3×4 grid on a 1024² canvas, the model produced well-spaced,
consistently-sized icons — but laid the whole grid out with uneven margins:

```
content 884×702 at (72,156)   →  cell 221×234
top 156   bottom 166   left 72   right 68
```

Slicing on `1024/4 × 1024/3` would cut through the bottom row. **The slicer
must crop to the content bounding box first, then divide that** into cells.
The generous per-icon margins mean trim-to-bbox then recovers each icon
exactly, so this costs nothing as long as the tool does it in that order.
