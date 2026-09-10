# Fonts

Self-hosted, so the GitHub Pages build stays self-contained — no CDN, and
nothing to go wrong offline.

| File | Face | Used for |
|---|---|---|
| `pt-sans-400-latin.woff2` | **PT Sans** Regular | Body copy, labels, every number |
| `pt-sans-700-latin.woff2` | **PT Sans** Bold | Titles (`--font-display` at `--font-display-weight`), emphasis, counters |

Declared in [`../styles/tokens.css`](../styles/tokens.css) behind
`--font-body` and `--font-display`. One face, two weights: 700 is a real bold,
so `font-weight: 700` means what it says again.

**Licence: SIL Open Font License 1.1** (ParaType) — [`OFL.txt`](OFL.txt)
covers both files. No attribution line is owed to players; see
[`NOTICE.md`](NOTICE.md).

## Why PT Sans, and why no size rule

The chrome stopped being pixel art on 2026-09-10. The two pixel faces before
this had *legal sizes* — whole multiples of their grid — which forced 24px body
copy and coarse rungs (18 · 24 · 36) that no phone layout could fit. PT Sans is
an outline face: every whole pixel is legal, so the tokens are chosen for
legibility on the 402×874 device and nothing else:

```
--text-title:  22px
--text-body:   16px   the iOS reading size
--text-helper: 13px   the brief's floor for a helper line (§2)
```

`tests/fonts.test.ts` holds the hierarchy (helper < body < title), the two
minimums, a base size on `<body>`, the weight on every title rule, and that
every `@font-face` points at a file that exists.

The digits are tabular, so counters do not jitter as they tick — the property
PT Sans was first chosen for, back before the pixel detour.

`--font-display` is **Germania One** (400, `germania-one-400-latin.woff2`),
chosen on the board on 2026-09-11 over PT Sans 700; it has one weight, which is
what `--font-display-weight` exists to say. Titles only, never numbers: its
digits are proportional.

## Regenerating

The files are Google Fonts' own latin subsets (v18), fetched from the CSS at
`https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap`
(and `family=Germania+One` for the title face)
with a modern-browser User-Agent and downloading the two `/* latin */` URLs.
Each is ~11 KB — above Vite's 4096-byte inline threshold, so they ship as
hashed files with `font-display: swap`; `boot()` waits for both (with a
ceiling) before the first mount so nothing reflows.
