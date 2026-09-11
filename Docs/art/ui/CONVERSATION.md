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
- **Named in the manifest:** all seven drawn cells — `Planks`, `CutStone`,
  `Runestone`, `Carpenter`, `MasonsYard`, `Smelter`, `RuneCarver`. The four
  workshop cells waited one commit for those rows to become `DistrictId`s: the
  atlas's first gate ("ships no cell the kit cannot name") fails on a name the
  kit cannot resolve, which is a different gate from `AWAITING_ART`.

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


## The collection's own icons — seven singles, 2026-09-08

Not a sheet. Seven hand-authored 16 px icons, each its own file and its own
`dense: { size: 16, cols: 1 }` manifest entry, the way the two keys already
were: they were drawn one at a time for one screen, and a grid of seven would
only have been a container.

| Cell | File | Replaces |
|---|---|---|
| `Stardust` | `icon_currency_stardust.png` | the 🌟 emoji fallback — it had been on `AWAITING_ART` since the currency was renamed |
| `ascension` | `icon_ascendancy_star.png` | `star`, which is the district card's generic pip |
| `fragment` | `icon_hero_fragment.png` | `sparkle`, on hero fragments only |
| `heroXp` | `icon_currency_xp.png` | nothing yet — Hero XP is Step 8 |
| `atk` · `def` · `hp` | `icon_stat_attack/defense/hp.png` | `army`, `padlock`, `population` |

### The three things this taught

**A stand-in icon is a wrong picture, not a missing one.** A hero's three
numbers were drawn with a shield, a padlock and a crowd — so *defence* was a
padlock and *attack* was a shield, which is the shield pointing at the wrong
number in the same row. Nobody reads that as pending art; they read it as the
design.

**`star` and `ascension` are two names for a reason.** A rung of a ladder must
not change shape because a decoration did. They are separate cells even though
the first pass of both was a star.

**A single icon is not a sparse sheet.** `checkAlpha` failed the XP book at
alpha mean 0.81, on a threshold calibrated for a grid of icons on a canvas
that is mostly gutter. A chunky 16 px icon legitimately inks four fifths of
its box. The decisive test for a baked-in checkerboard is not the mean, it is
that **no pixel is transparent anywhere** — so that is what the check asserts
now, with the mean kept only for files that really are mostly gutter.

**Stardust was 13 px** and the dense path refuses a size that does not divide
the 32 px cell. It was padded to 16, not rescaled: a resample would have
softened every pixel of it.

## Seven more singles — three overrides and four new cells, 2026-09-09

Same shape as the collection's: one 16 px file per icon, one
`dense: { size: 16, cols: 1 }` entry each, appended to the manifest.

| Cell | File | Replaces |
|---|---|---|
| `Gems` | `icon_gems.png` | the gem in `currencies-16` |
| `quest` | `icon_quests.png` | the scroll in `ui-c-symbols` |
| `settings` | `icon_settings.png` | the cog in `ui-d-ui` |
| `relics` | `icon_relics.png` | `Mana` — the tab wore the pool's orb |
| `dungeon` | `icon_dungeon.png` | `quest` on the delve pill, `unknown` on a ruin's depth stat |
| `chest` | `icon_chest.png` | `quest` on the daily pill |
| `daily` | `icon_daily_rewards.png` | the word "Day" on every rung of the ladder |

### The order of the sheets is the override

Nothing new was needed to replace a cell: **slices are written by name, so the
last sheet to name one owns it.** `currencies-16` already relied on that to
beat `ui-a-resources`; these singles are appended after it and beat both. The
build says so out loud — `overrides Gems` — which is the line that tells a
reviewer a replacement was intended rather than a name collided.

### A borrowed icon is a claim about what the screen is

`Mana` on the Relics tab was true while the Reliquary explained the pool. The
pool moved to a sheet of its own the same day (`08-magic.md` §6), so the orb
became a picture of somewhere else — and the tab had no picture of a relic.
Same for the delve pill's quest scroll: an errand and a dungeon are not the
same promise.

### `chest` and `daily` are two cells because they say two things

The chest is the PRIZE and heads the pill that offers it. The calendar page is
the DAY and rides on each rung as the number's unit, the way a coin rides
beside an amount — which is also what let the ladder keep the word "Day" out of
a 50 px column.

### Four cells that never grey out

`relics`, `dungeon`, `chest` and `daily` join `locked.except`. A derived
`-locked` cell for a nav mark or a pill head is atlas space nothing can ask
for.

---

## M1–M4 — the smooth-chrome mockups (§7.19)

- **Date:** 2026-09-10
- **Conversation:** <https://chatgpt.com/c/6aa31e50-0190-83eb-b141-99e7dec54bd5>
  ("Diseñar UI de mapa", Codigames workspace), driven from Claude Code through
  the Chrome extension.
- **Model:** the workspace default, "Alta" reasoning.
- **Files:** `mockups/m1-map-and-chrome.png`, `mockups/m2-townhall-card.png`,
  `mockups/m3-build-sheet.png` (852×1846 each — the viewer's export, not the
  1080×2340 asked for; fine for a reference) and `mockups/m0-four-screens.png`
  (853×1844), a 2×2 sheet of all four screens the model produced unasked when
  given the M4 prompt; the Research page exists only there for now.
- **Prompt:** §7.17 style block v2 with `reference.png` attached to the first
  message, then §7.19 M1–M4 verbatim, one per message.
- **What worked:** the style block's "NOT pixel art … like Township / Hay Day
  menus" line and the percentages (header 5%, nav 6%, sheet 55–65%) landed
  first time; every screen came back at the requested density with legible
  labels.
- **What to know:** the composer stuck on "generating" after the 2×2 sheet
  and would not send again even after a reload — start a new conversation
  when that happens. Images are downloaded from the viewer (click the image,
  then the download icon top-right); the "Compartir" arrow under the image
  is a share menu, not a download.

---

## UI-A2 … UI-E2 — the smooth icon sheets (§7.18)

- **Date:** 2026-09-10
- **Conversation:** <https://chatgpt.com/c/6aa322bc-9084-83eb-ae38-bd37d3d098c3>
  ("Crear hoja de iconos UI", Codigames workspace), driven from Claude Code
  through the Chrome extension; `reference.png` attached to the first message.
- **Model:** the workspace default, "Alta" reasoning.
- **Files:** `sheets/ui-a2-currencies.png`, `ui-b2-buildings.png`,
  `ui-c2-people.png`, `ui-d2-symbols.png`, `ui-e2-marks.png` — 1254×1254,
  true alpha (`srgba(0,0,0,0)` at the corner), downloaded from the image
  viewer's download icon. The viewer export is no longer the opaque
  checkerboard the pixel-era entry warns about; the "corrected PNG" link
  never appeared (the image model answered without running code), and was
  not needed.
- **Prompt:** §7.18 verbatim, one sheet per message, "Same style" as the
  only anchor after the first. Every sheet came back on the strict 4×4 grid
  with generous margins first time; E2 left its empty row genuinely empty,
  so the manifest declares it 3×4 rather than 4×4 with nulls.
- **Manifest:** `cell: 64`, `smooth: true` (Lanczos, alpha left soft,
  `image-rendering: auto`); the pixel-era sheets stay in `sheets/` as
  provenance and are no longer sliced.

---

## T1 · D1 · F1 — textures, decorations and the frame (§7.21)

- **Date:** 2026-09-11
- **Conversation:** <https://chatgpt.com/c/6aa32c46-bbc8-83eb-9e5a-ea10725869e2>
  ("Generar texturas seamless", Codigames workspace), driven from Claude Code
  through the Chrome extension; `mockups/m3-build-sheet.png` attached to the
  first message as the material anchor instead of `reference.png` — the
  materials, not the world, were the point.
- **Model:** the workspace default, "Alta" reasoning.
- **Files:** `sheets/ui-t1-textures.png` (2×2 opaque tiles → `src/ui/assets/
  tex-{parchment,wood,wood-dark,cloth}.jpg`; the wood tiles ship as the 512
  quarter as drawn, since mirroring them into a seamless 1024 made every knot
  a symmetric pair; parchment and cloth are mirrored, which on a low-contrast
  fibre is invisible), `sheets/ui-d1-decor.png` (2×3 transparent objects →
  `deco-{rope,rope-v,seal,knob,nail,pennant}.png`, trimmed, ≤ 256px, cut by
  hand: they are not `IconName`s, so the atlas has no cell for them),
  `sheets/ui-f1-frame.png` (the nine-slice experiment → `frame-wood.png`,
  trimmed and halved to 600px: edge ~61px, corner blocks ~80px, so
  `border-image-slice: 80`).
- **Prompt:** §7.21 verbatim, one per message.
- **What worked:** the frame came back genuinely nine-sliceable — identical
  corner blocks, straight uniform edges, transparent centre — which the
  pixel-era §7.16 said image models could not do. The smooth style is what
  changed: no grid to misalign.
- **What to know:** the textures' seams are fine along the grain (horizontal)
  and faint across it; the chrome only ever repeats them horizontally over
  40–52px bands, so the cross-grain seam never shows.

---

## R1 — the research medallions (§7.22)

- **Date:** 2026-09-11
- **Conversation:** <https://chatgpt.com/c/6aa3334c-10a0-83ed-8fca-36c4b072e074>
  (Codigames workspace), driven from Claude Code through the Chrome extension;
  `mockups/m0-four-screens.png` attached as the anchor.
- **Model:** the workspace default, "Alta" reasoning.
- **File:** `sheets/ui-r1-seals.png` (2×2, 1254×1254, true alpha) →
  `src/ui/assets/seal-{plain,done,available,active}.png`, 160px, squared.
- **Prompt:** §7.22 verbatim. First time; the "NO emblem" clause held, so the
  kit's own icon sits on the wax.
- **What to know:** the viewer's download icon moves with the window width —
  find it as the "Guardar" button rather than by coordinates.

---

## M5–M14 · S1 — the rest of the menus, and the store's painted pieces (§7.19, §7.23)

- **Date:** 2026-09-11
- **Conversation:** <https://chatgpt.com/c/6aa340fa-60b0-83ed-b4d0-ed8cfa0a64c7>
  ("Design Mobile Game UI", Codigames workspace), driven from Claude Code
  through the Chrome extension; `mockups/m0-four-screens.png` attached to the
  first message as the anchor, the style block v2 sent on its own first, then
  one screen per message prefixed "Same style, same materials and chrome as
  the mockups above."
- **Model:** the workspace default, "Alta" reasoning.
- **Files:** `mockups/m5-store-sheet.png`, `m6-heroes-sheet.png`,
  `m7-reliquary-sheet.png`, `m8-daily-sheet.png`, `m9-settings-mana.png`
  (two sheets on one screen), `m10-battle-board.png`, `m11-map-panels.png`
  (the ruin card and the placement bar), `m12-map-floaters.png` (the daily
  pill, the raid and ad tabs, the toast, the pennant, the builder chip),
  `m13-welcome-back.png`, `m14-payer-and-iap.png` (1024×1536, see below),
  `m15-gacha-reveal.png`, `m16-battlefield.png`; the rest 852×1846, opaque.
  M15 and M16 were sent after re-attaching `m5-store-sheet.png`, which
  brought the style back after M14 drifted.
  `sheets/ui-s1-store.png` (3×3, 1254×1254, true alpha) → `src/ui/assets/
  art-key-silver.png`, `art-key-gold.png`, `art-hammer.png` and the six gem
  packs in `src/render/assets/gems_*.png`, each trimmed, squared and
  resampled to 256px.
- **Prompt:** §7.19 M5–M14 and §7.23 verbatim, one per message.
- **What worked:** with M0 as the anchor every screen came back in the same
  materials without restating them — the chrome, the plank, the nav beam and
  the type held across ten generations. Two sheets stacked on one screen (M9,
  M14) is a cheap way to get two small dialogs from one image.
- **What to know:** M14 came back 1024×1536 in a serif face with a different
  nav — ten generations in, the anchor had faded. Its LAYOUT is what the
  payer and purchase sheets follow; their materials and type follow M5–M13.
  Re-attach M0 (or M5) every six or seven prompts. Typing a prompt with a blank line SENDS the first half —
  the composer treats Enter as send. Keep a prompt to one paragraph. The
  viewer's download button is still "Guardar"; find it by name. A hung game
  tab (a hand-edited save) drops the extension's tab group: close the tab,
  call tabs_context again.
