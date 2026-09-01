# Fonts

Self-hosted, so the GitHub Pages build stays self-contained — no CDN, and
nothing to go wrong offline. Both faces are SIL OFL 1.1; the licence ships
beside them in `OFL.txt`, which the OFL requires.

| File | Face | Used for |
|---|---|---|
| `pixelify-sans-latin.woff2` | **Pixelify Sans** (variable, `wght` 400–700) | Titles, numbers, canvas labels |
| `nunito-latin.woff2` | **Nunito** (variable, `wght` 200–1000) | Body copy |

Declared in [`../styles/tokens.css`](../styles/tokens.css) as `Kingdom
Display` and `Kingdom Body`, behind `--font-display` / `--font-body`, so
swapping a face is a one-line change.

## Why these two

**Pixelify Sans** over the obvious alternatives: *Press Start 2P* is an 8×8
arcade face — extremely wide, no cozy register, and only legible at multiples
of 8; *Silkscreen* is a 5px bitmap with no descender room, which falls apart
at the 20–24px titles the kit calls for. Pixelify Sans has real lowercase
with descenders and reads as storybook rather than arcade.

**Nunito** has the highest x-height of the OFL rounded faces, which decides
it at the 13px floor set by §6.12 of the redesign brief.

## Regenerating

Both come from the Google Fonts **latin** subset, narrowed further to the
characters this game actually uses. Reproduce with:

```sh
# The latin-subset URLs come from the css2 API with a modern user-agent:
#   curl -A "<modern UA>" "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;700&display=swap"
# and picking the @font-face whose unicode-range starts U+0000-00FF.
curl -o pixelify-raw.woff2 "https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9Jn0Ei0tSaJ0.woff2"
curl -o nunito-raw.woff2   "https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaBTMnFcQ.woff2"

UNICODES="U+0020-007E,U+00A0,U+00B7,U+00D7,U+2013,U+2014,U+2018-201D,U+2022,U+2026,U+2192,U+2212,U+2605,U+2606,U+2713,U+2715"

pyftsubset pixelify-raw.woff2 --flavor=woff2 --output-file=pixelify-sans-latin.woff2 \
  --unicodes="$UNICODES" --layout-features='' --no-hinting --desubroutinize
pyftsubset nunito-raw.woff2 --flavor=woff2 --output-file=nunito-latin.woff2 \
  --unicodes="$UNICODES" --layout-features='' --no-hinting --desubroutinize
```

Nunito goes 39 KB → 19 KB, Pixelify Sans 12 KB → 5 KB. Both stay comfortably
over Vite's 4096-byte inline threshold, so they emit as real files with
content hashes rather than bloating the stylesheet as base64.

The `wght` axis is deliberately preserved — 700 is a real instance of the
variable font, not a synthesised bold.

## Known gaps

`→` (U+2192), `✓` (U+2713) and `★` (U+2605) are in the subset list but exist
in **neither** face, so they fall back to a system font. That is fine: they
are placeholder glyphs for icons the atlas will replace. Don't add a title
that depends on them rendering in the pixel face.
