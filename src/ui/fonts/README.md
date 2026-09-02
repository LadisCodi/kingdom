# Fonts

Self-hosted, so the GitHub Pages build stays self-contained — no CDN, and
nothing to go wrong offline. All three faces are SIL OFL 1.1; the licence
ships beside them in `OFL.txt`, which the OFL requires.

| File | Face | Used for |
|---|---|---|
| `germania-one-latin.woff2` | **Germania One** (400) | Titles only — headings, sheet planks, proper names |
| `pt-sans-latin-400.woff2` | **PT Sans** (400) | Body copy |
| `pt-sans-latin-700.woff2` | **PT Sans** (700) | Numbers, button labels, anything emphatic |

Declared in [`../styles/tokens.css`](../styles/tokens.css) as `Kingdom
Display` and `Kingdom Body`, behind `--font-display` / `--font-body`, so
swapping a face is a one-line change.

## The split, and why it is the whole point

The pixel face these replace (Pixelify Sans) carried **titles and every number
in the game**. That is what forced a decorative face to be legible at 13px,
which it was not. The two jobs are now two faces:

- **`--font-display` is titles only**, and only at **15px and up**. Three rules
  that used it below that — a 10px banner eyebrow and two 11px uppercase
  section labels — moved to the body face, because a display face set at 11px
  is strictly worse than a text face at 11px.
- **`--font-body` is body copy AND every number.** A number has to be read at a
  glance at 13px; that is a text face's job.

**PT Sans for numbers is not arbitrary.** Its digits are all 545 units wide
(567 at bold), so figures are tabular *without* the `tnum` OpenType feature —
which PT Sans does not ship, so `font-variant-numeric: tabular-nums` would have
been inert. Counters do not jitter as they tick. Germania One's digits are
proportional (464–483), which is a second reason numbers never go in it.

**Germania One has one weight.** Five rules asked it for `font-weight: 700`,
which the browser would have synthesised into a smear; they are 400 now.

## Known gaps

`→` `★` `✓` `✕` `◇` `≈` `≤` `≥` are in the subset list but exist in **none** of
the faces, so they fall back to a system font. That was true of the previous
pair too, so nothing regressed. They are placeholder glyphs for icons the atlas
replaces — don't add a title that depends on them rendering in the title face.
Germania One additionally lacks `…` and `−`; neither appears in a title, and
the `−` stepper knob is a control, so it is set in the body face.

## Regenerating

All three come from the Google Fonts **latin** subset, narrowed further to the
characters this game actually uses.

```sh
# The latin-subset URLs come from the css2 API with a modern user-agent:
#   curl -A "<modern UA>" "https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Germania+One&display=swap"
# and picking each @font-face whose unicode-range starts U+0000-00FF.
curl -o ptsans-400-raw.woff2 "https://fonts.gstatic.com/s/ptsans/v18/jizaRExUiTo99u79D0KExQ.woff2"
curl -o ptsans-700-raw.woff2 "https://fonts.gstatic.com/s/ptsans/v18/jizfRExUiTo99u79B_mh0O6tLQ.woff2"
curl -o germania-raw.woff2   "https://fonts.gstatic.com/s/germaniaone/v21/Fh4yPjrqIyv2ucM2qzBjeS3uywhP.woff2"

UNICODES="U+0020-007E,U+00A0,U+00A7,U+00B7,U+00D7,U+2013,U+2014,U+2018-201D,U+2022,U+2026,U+203A,U+2192,U+2212,U+2248,U+2264,U+2265,U+25C7,U+2605,U+2606,U+2713,U+2715"

# kern/liga/ccmp are kept on the text face: this is body copy, and the old
# --layout-features='' would have stripped the kerning with everything else.
pyftsubset ptsans-400-raw.woff2 --flavor=woff2 --output-file=pt-sans-latin-400.woff2 \
  --unicodes="$UNICODES" --layout-features='kern,liga,ccmp' --no-hinting --desubroutinize
pyftsubset ptsans-700-raw.woff2 --flavor=woff2 --output-file=pt-sans-latin-700.woff2 \
  --unicodes="$UNICODES" --layout-features='kern,liga,ccmp' --no-hinting --desubroutinize
pyftsubset germania-raw.woff2 --flavor=woff2 --output-file=germania-one-latin.woff2 \
  --unicodes="$UNICODES" --layout-features='kern' --no-hinting --desubroutinize
```

PT Sans goes 44 KB → 6.7 KB per weight, Germania One 9 KB → 5.7 KB. All three
stay over Vite's 4096-byte inline threshold, so they emit as real files with
content hashes rather than bloating the stylesheet as base64. Total font
payload is 19 KB, slightly under the 23 KB the previous pair cost — for one
more file, because PT Sans is not variable and its bold is a second file.
