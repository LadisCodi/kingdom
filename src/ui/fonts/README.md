# Fonts

Self-hosted, so the GitHub Pages build stays self-contained — no CDN, and
nothing to go wrong offline.

| File | Face | Used for |
|---|---|---|
| `boldpixels-latin.woff2` | **BoldPixels** (400) | Titles only, and only at `--text-title` |
| `m6x11plus-latin.woff2` | **m6x11plus** (400) | Everything else — body copy, labels, and every number |

Declared in [`../styles/tokens.css`](../styles/tokens.css) as `Kingdom
Display` and `Kingdom Body`, behind `--font-display` / `--font-body`.

**Neither is OFL.** Both require attribution and BoldPixels is ShareAlike —
see [`NOTICE.md`](NOTICE.md). `OFL.txt` is left in place only because it
covers nothing that ships any more; delete it once the credits land.

## Legal sizes — the rule that governs everything else

A pixel face is drawn on a grid, and set at anything but a whole multiple of
that grid the outline falls between device pixels, where the rasteriser
antialiases the square edges into grey. Measured over the 117 characters the
subset actually ships (units-per-em ÷ the GCD of every point coordinate):

| Face | upm | grid | crisp at | cap height |
|---|---|---|---|---|
| BoldPixels | 1024 | 64 → **16 px/em** | 16, 32, 48 | 0.5 em |
| m6x11plus | 1152 | 64 → **18 px/em** | 18, 36 | 0.611 em |

So the tokens are *forced*, not chosen:

```
--text-title:  32px   BoldPixels at 2x — 16px caps, against Germania One's 17
                      at the old 22px. The same optical size.
--text-body:   18px   m6x11plus at 1x — 11px caps, exactly what PT Sans gave
                      at 15px, and within 3% of the same line width.
--text-helper: 18px   There is no smaller crisp size.
```

**`--text-helper` is no longer a size.** The helper tier is carried by
`--ink-muted` alone. It reads bigger than the 13px it replaces, which §6.12
wanted anyway; the cost is that helper lines run about 22% wider, and 40 rules
that sat at 10–17px moved up to 18.

`tests/fonts.test.ts` holds all of this: every hardcoded `font-size` on a
grid, the tokens on the grids, a base size declared on `<body>`, and the
display face used only at `--text-title`.

## Two things the previous pair did that these still do

- **The digits are tabular** — BoldPixels 576 units across, m6x11plus 448 — so
  counters do not jitter as they tick. That was the whole reason PT Sans was
  chosen over the old pixel face, and it survives the switch.
- **One weight each.** `font-synthesis-weight: none` in `tokens.css` refuses
  the fake bold a `font-weight: 700` would otherwise smear. Note the
  consequence: **`font-weight: 700` is now inert everywhere.** Rules that used
  bold for emphasis on numbers and chips render at 400; emphasis has to come
  from colour or size instead.

## Known gaps

m6x11plus ships 228 glyphs and lacks `→` `·` `−` `✓` `✕` `…` `’`; BoldPixels
lacks `✓` `✕`. CSS falls back **per glyph**, so these render from the system
face — present, but visibly not pixel art. Anything that must look drawn
belongs in the icon atlas, not in a string. The knob controls (`✕` `−` `+`
`✥`) are already in this category and are exempt from the size grid for the
same reason.

## Regenerating

Sources are the vendor TTFs in `Docs/art/fonts/`.

```sh
UNICODES="U+0020-007E,U+00A0,U+00A7,U+00B7,U+00D7,U+2013,U+2014,U+2018-201D,U+2022,U+2026,U+203A,U+2192,U+2212,U+2248,U+2264,U+2265,U+25C7,U+2605,U+2606,U+2713,U+2715"

pyftsubset Docs/art/fonts/BoldPixels.ttf --flavor=woff2 \
  --output-file=src/ui/fonts/boldpixels-latin.woff2 \
  --unicodes="$UNICODES" --layout-features='kern' --no-hinting --desubroutinize
pyftsubset Docs/art/fonts/m6x11plus.ttf --flavor=woff2 \
  --output-file=src/ui/fonts/m6x11plus-latin.woff2 \
  --unicodes="$UNICODES" --layout-features='kern,liga,ccmp' --no-hinting --desubroutinize
```

Subsetting is not only a size win here: over the **full** 1322-glyph
BoldPixels the coordinate GCD is 2, not 64 — some glyphs outside the subset
are off its own pixel grid. Every one of the 117 we ship is on it.

BoldPixels 158 KB → **1.8 KB**, m6x11plus 18 KB → **1.5 KB**. Both are now
**under Vite's 4096-byte inline threshold**, so they emit as base64 inside the
stylesheet rather than as separate hashed files — deliberate, and better here:
the CSS is render-blocking anyway, so it removes two round-trips and makes
`font-display: block` instant. Total font payload 18.7 KB → 3.3 KB.
