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

**2. The grid is never where a slicer would assume.**

Asked for a strict 3×4 grid on a 1024² canvas, the model produced well-spaced,
consistently-sized icons — and then placed the grid with uneven margins:

```
content 884×702 at (72,156)   →  top 156  bottom 166  left 72  right 68
```

So the canvas cannot be divided directly. Cropping to the content bounding
box and dividing THAT survived UI-A but failed on UI-D, where the research
icon sits close enough to the settings cog that an equal quarter-width
boundary fell inside the book: the spacing is not uniform either.

The slicer therefore **reads the grid off the sheet**, finding the empty
columns and rows (gutters ≥ 12px) and taking each band as a column or row.
That is immune to both problems, and it turns a whole class of "regenerate
the sheet" into no work at all. It also gives a much better error: if the
band count disagrees with the manifest, either the manifest is wrong or two
icons are touching — both actionable.

---

## UI-B, UI-C, UI-D

Same conversation, 2026-09-02, continued so the model kept UI-A in context as
its own style reference — which is why the four sheets read as one set.

| Sheet | Grid | Contents |
|---|---|---|
| `ui-b-buildings.png` | 3×3 | Townhall, Housing, Farm, FarmLands, Sawmill, Market, Quarry, Docks, Mine |
| `ui-c-symbols.png` | 4×3 | quest, showme, padlock, hourglass, clock, tick, close, plus, minus, sparkle, unknown, Meat |
| `ui-d-ui.png` | 4×2 | build, army, research, settings, population, builders, workers, star |

### The prompt correction that mattered

UI-A's status icons came back as little illustrated *characters* — a farmer
with a hoe, three villagers with faces. Charming at 64px, mud at 16. The
contact sheet made that obvious immediately.

Every later prompt therefore leads with: **"these must be SYMBOLS, not little
characters. No faces, no bodies, no people."** UI-D re-does the three status
icons on that basis (faceless silhouettes, a hard hat on its own, crossed
tools), and the manifest skips UI-A's originals rather than generating art
that is immediately overwritten.

For the six abstract marks (check, cross, plus, minus, sparkle, question) the
extra instruction that worked was a concrete floor: *"THICK and CHUNKY — at
least 20 pixels of stroke width at this canvas size — so they survive being
shrunk."* Without it they come back as thin drawn strokes.

### It self-corrects if you let it

On UI-C the model reported: *"The first alpha pass exposed residual
checkerboard texture rather than clean transparency, so it didn't meet the
export rule."* — and ran a second, tighter matte removal unprompted. Stating
the export rule as a rule, not a preference, is what makes that happen.
