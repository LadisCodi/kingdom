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


## UI-F — unit portraits

Same conversation, 2026-09-02. `sheets/ui-f-units.png`, 1024×512, 1×4.

Drawn left to right as spearman, swordsman, archer, horseman, which maps to
**Lancer, Warrior, Archer, Cavalry** — the manifest names them in that order,
not in UNIT_ORDER, because the sheet is the thing being sliced.

This is the one sheet that deliberately breaks the "symbols, not characters"
rule from UI-C/UI-D: an army roster wants figures you can recognise and want,
and these are shown at 60px in a portrait frame, never inline. The rule is
about SIZE, not about taste.

What prompted it: `tests/icons.test.ts` failed the moment the Army screen
asked for a `Warrior` icon that had no cell — the guard doing exactly the job
it was written for, before a single unit had rendered as an emoji next to
forty pixel icons.


## UI-G — Mana, the Sanctum and the four military halls

Same conversation, 2026-09-02. `sheets/ui-g-special.png`, 1024×1024, 2×3:
mana orb, Sanctum, Barracks, Spear Hall, Shooting Grounds, Stables.

Buildings, so the UI-C/UI-D "symbols, not characters" rule applies in its
building form: *objects and buildings, three-quarter view, no faces, no
bodies, no people, no animals*. The last clause matters — "Stables" without it
invites a horse, and a horse at 16px is a smudge. It came back as a stable
with a horseshoe over the door, which is the right answer.

`Mana` was added to `tiny.only` in the manifest: it is a currency, and costs
render inline at 16px. `tests/icons.test.ts` caught the omission on the first
run after the sheet landed, which is the whole reason that assertion exists.

### The download button opens a viewer now

The message-body button no longer downloads directly — it opens the file in
ChatGPT's image viewer ("Biblioteca"), whose own top-right download icon is
what writes the real file. That is still the code-interpreter artifact, not
the editor export, and it passes both halves of the alpha check:

```
size=1024x1024 corner=srgba(0,0,0,0)   alphaMean=0.28
```

The editor trap from UI-A is unchanged; only the number of clicks moved.


## SPR-A — map sites

`sheets/spr-a-sites.png`, 1024×512, 2×4: shrine, standing stones, leyspring,
and the five ruins.

These are **map sprites, not menu icons**, and the prompt says so in its first
line. Three differences from every sheet above, and they are the difference
between art that sits on a tile and art that floats over one:

- three-quarter **top-down** view, "like a building tile in a cozy village
  builder seen from above at an angle" — the icon sheets are drawn front-on;
- each object **sitting on the ground with a little shadow**;
- 110px per sprite on a 512-tall canvas, because a map sprite is drawn at cell
  size and the extra resolution is wasted.

`node scripts/ui-atlas.mjs sprites` slices these into `src/render/assets/`
rather than into the atlas. It shares the band reading and the alpha check
with the icon path and differs in three deliberate ways: one 128px file per
name, per-sprite scaling (a shrine and a chapel really are different sizes on
the ground, and forcing one scale makes the small ones vanish at low zoom),
and **south gravity**, so a building meets the tile it stands on.


## SPR-B, SPR-C, SPR-D — city buildings, relics, heroes

Same conversation, 2026-09-02.

| Sheet | Grid | Contents | Treatment |
|---|---|---|---|
| `spr-b-city.png` | 2×3 | Sanctum, Barracks, Spear Hall, Shooting Grounds, Stables | map tile |
| `spr-c-relics.png` | 2×3 | the five artifacts | object icon |
| `spr-d-heroes.png` | 2×3 | the five heroes | full figure |

### "Leave the sixth cell completely empty"

All three sheets hold five things in a 2×3 grid, and asking for the empty cell
explicitly works — the model preserves it and says so. The slicer needs no
special case: columns are found across the WHOLE sheet, so the top row's three
icons establish three columns and the manifest's `null` skips the missing one.

### The gravity option

`sliceWorldSheet` places a sprite on the **south** edge of its frame, which is
right for a building meeting the tile it stands on and wrong for a compass in
an inventory slot — a centred object sunk to the bottom of its frame reads as
a layout bug. `spr-c` therefore sets `"gravity": "center"` in the manifest.
That one word is the whole difference between the two treatments in code; the
difference in the PROMPT is much larger, and it is the first line of each:
"MAP SPRITES, three-quarter top-down, sitting on the ground" against "OBJECT
ICONS, front-on three-quarter".

### The heroes break the symbol rule, and say why

Same reasoning as UI-F, stated in the prompt so the model does not apply the
earlier rule by inheritance: *"These ARE characters — unlike the icon sheets,
that rule does not apply here, because they are only ever shown at 48 pixels
or larger in a framed portrait."*

The unit portrait sheet is named as the pose and scale reference, which is
what keeps a hero and a soldier looking like they belong to the same army.

### The alpha guard earned its keep again

`spr-d` came back with a 33×33 block of opaque BLACK in the extreme top-left
corner — outside every cell, and exactly the "residual matte speck" the model
had announced it was clearing. The corner check caught it before it reached
the slicer, where it would have read as an extra column and produced a much
more confusing error.

Cleared locally rather than regenerated, because it is provably not art: the
nearest figure starts ~150px in, and the fix is scoped to fully-black opaque
pixels inside a 64×64 box.

```sh
magick spr-d-heroes.png -region 64x64+0+0 -fuzz 2% -transparent black +region spr-d-heroes.png
```

The guard was not relaxed to let the file through — it fired, and the file was
fixed until it passed. That distinction is the whole value of having it.

---

## UI-H — the refined goods

- **Date:** 2026-09-05
- **Conversation:** <https://chatgpt.com/c/6a9b4302-7a5c-83ed-84c4-bf6d9fa629b2>
  ("Crear atlas de iconos PNG", Codigames workspace, GPT-5.6 Sol)
- **Model:** 5.6 Sol
- **File:** `sheets/ui-h-goods.png` — 1024×1024, true alpha
- **Prompt:** the §7.16 coarse-cell block at 2 rows × 4 columns, but anchored on
  an attachment rather than on `reference.png`: a `magick montage` of six
  icons already in the atlas (Wood, Stone, Iron, Gold, Food, Knowledge, on
  parchment) with *"they must be indistinguishable in style from those"*. For a
  sheet that has to sit inside an existing atlas that anchor is stronger than
  the style block — one round came back in style.
- **Contents** (reading order): sawn planks, a dressed stone block, a rune
  stone, a saw over a sawhorse, a mallet and chisel, a furnace, a rune chisel,
  and one deliberately empty cell.
- **Named in the manifest:** `Planks`, `CutStone`, `Runestone` only. The four
  workshop cells are drawn but held at `null` until Carpenter, MasonsYard,
  Smelter and RuneCarver are `DistrictId` — the atlas's first gate ("ships no
  cell the kit cannot name") fails on a name the kit cannot resolve, which is a
  different gate from `AWAITING_ART`.

### The one thing this sheet taught

**A refined good must not look like the raw one it is made from.** The first
pass drew Planks as a stack of round logs with visible end grain — which is
exactly what the shipped `Wood` icon is, so at 32 px the player could not tell
the input from the output. The fix was to name the confusion in the request
("my game already has an icon for raw wood, and it is the third icon in the
attachment") and to specify the silhouette rather than the subject: *thin flat
rectangular boards, square-cut ends, no bark, no end-grain rings*. Ask for a
single-cell redraw and the model merges it into the approved sheet rather than
regenerating the other seven.
