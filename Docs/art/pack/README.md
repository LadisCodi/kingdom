# The 16px pixel-art UI pack

Source art, not shipped art. Nothing in here is loaded by the game — the same
contract as `Docs/art/ui/sheets/`, which feeds `src/ui/assets/ui-atlas.png`
through `scripts/ui-atlas.mjs`. It arrived inside `src/ui/assets/` carrying
1,201 Unity `.meta` sidecars; those are deleted and the pack moved here so the
shipped directory holds only the two files the app actually loads.

**717 PNGs, 639 KB.** Everything is a multiple of 16 — 16×16, 32×16, 48×16,
32×32, 48×32, 48×48, 80×80. A genuine 16px baseline.

## Scale factor: ×3

`#app` is `max-width: calc(100vh * 9 / 16)` (`src/style.css`), so the frame is
~390 CSS px full-bleed on a phone and ~475–505 pillarboxed on desktop. At ×3
that is 130–168 source pixels of UI width — a sane pixel-art canvas — and a
16px element renders at a 48px touch target. ×4 drops it to 97 and is too
cramped.

## What is here

| Folder | Count | Use |
|---|---|---|
| `icons/16x16.png` | 1 sheet, 256×2192 | Dense 16×137 grid, 2,192 icons, **no gutters** — `sliceSheet()` reads gutters, so this needs a `dense` manifest mode. Rows 0–47 are objects (ores, ingots, logs, stone, books, fish, fruit, meat, gems, coins); 48+ are spell and weapon effects. |
| `icons/general` | 354 @ 16×16 | RPG loot set, unnamed and numbered. `spritesheet_16x16.png` is the same set packed. |
| `Background boxes` | 16 @ 48×48 | Panel frames, cleanly 9-sliceable. `BGbox_08B` is close to `--parchment`; `05A` is a wooden plank frame; `03A` has gold ornate corners. |
| `Buttons` | 55 | 6 style families × 3 widths (48×16, 32×16, 16×16) × Normal/Pressed/Selected. `_Selected` is a gold outline (→ `.hinted`), `_Pressed` is darker (→ `:active`). Only `Button_01A` ships `_Disabled`. |
| `Sliders & Bars` | 30 | 3 trough frames + 8 fills — cyan/red/orange/green, solid and segmented. Maps onto `progress()` and `.k-pips`. |
| `Title banners` | 36 @ 48×16 / 48×32 | Title plates → `.k-plank`, `.cast-banner`. |
| `Item slots` | 33 @ 16×16 | Coloured wells → `.k-slot`, `.tr-portrait`, `.tr-pick`. |
| `Spellbook & Tabs` | 54 @ 32×32 | 15 bottom tabs Normal/Selected → the nav bar. |
| `Resource orbs` | 11 @ 48×48 / 80×80 | HP/MP orbs → the header Mana gauge. |
| `Checkboxes` | 18 | Settings switches. |
| `Dividers` | 11 @ 48×16 | Section rules. |
| `Mini icons` | 96 @ 16×16 | 32 icons × Normal/Outline/Selected, unnamed. |

**Dropped on the way in** (487 files): `Cursors/` — touch game; `Buttons/Input_*`
— 224 gamepad prompt glyphs; `icons/spells/` — 220 spell icons with no surface
to live on; the four `Spellbook_*` 2048px page-turn filmstrips.

## Two gaps

- **No green button.** `--leaf` is the affordable/confirm colour; the families
  are rose, red, gold, grey, slate-blue and wine, and `tokens.css` bans
  blue-grey outright. Each sprite has only **6–13 colours**, so an ImageMagick
  remap onto the token palette is exact — and `scripts/ui-atlas.mjs` already
  shells out to `magick`, so it is a build step rather than manual work.
- **The icons are not the upgrade they look like.** Compared cell by cell
  against the shipped 32px atlas at 48px on parchment, the current art wins on
  Gold, Food, Iron, Stone and Meat, and ties elsewhere. The resource icons
  looked bad because the kit drew a 32px cell at 24 CSS px — a 0.75× sample —
  not because the art was weak. That is fixed in `kit.css` and gated by
  `tests/icons.test.ts`. **This pack's value is the chrome, not the icons.**

## Licence — UNRESOLVED

There is **no LICENSE, README or attribution file anywhere in the original
2,407 files**. `kingdom` is a work repo, so "free" has to mean a licence that
permits commercial use, and any attribution requirement has to be honoured.
Answer this before any of it ships in a build.
