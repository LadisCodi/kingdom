# Fonts

Self-hosted, so the GitHub Pages build stays self-contained — no CDN, and
nothing to go wrong offline.

| File | Face | Role | Used for |
|---|---|---|---|
| `nunito-800-latin.woff2` | **Nunito** ExtraBold | `--weight-title` | headings — *Store*, *Heroes*, *Timber!* |
| `nunito-700-latin.woff2` | **Nunito** Bold | `--weight-strong` | buttons, amounts, names |
| `nunito-600-latin.woff2` | **Nunito** SemiBold | `--weight-body` | ordinary prose — the default on `<body>` |
| `nunito-400-latin.woff2` | **Nunito** Regular | `--weight-small` | the small description under it |

Declared in [`../styles/tokens.css`](../styles/tokens.css) behind
`--font-body`, `--font-display` and the four `--weight-*` tokens.

**Licence: SIL Open Font License 1.1** — [`OFL.txt`](OFL.txt) covers all four
files. No attribution line is owed to players; see [`NOTICE.md`](NOTICE.md).

## One family, four weights

Nunito replaced the PT Sans + Germania One pair on **2026-09-11**: it is the
face the mockups are drawn in, and a title and a caption out of one family read
as one voice where two families read as two. The rounded terminals are the
warmth the parchment chrome was reaching for.

**The four weights are four roles.** A rule names the role, never the number,
so retuning the colour of text across the whole game is four values in
`tokens.css`. `--font-display` and `--font-body` name the same family now —
what separates a title from a caption is the weight — and both tokens stay
because the split is real and because a second display face drops back in by
changing one line.

**600 for prose is the point of the change.** On parchment, at 16px, Nunito
Regular reads thin; SemiBold reads like the mockups. 400 is left to the helper
line, where it is the *contrast* against the 600 above it that does the work.

## And why no size rule

The chrome stopped being pixel art on 2026-09-10. The two pixel faces before
this had *legal sizes* — whole multiples of their grid — which forced 24px body
copy and coarse rungs (18 · 24 · 36) that no phone layout could fit. Nunito is
an outline face: every whole pixel is legal, so the tokens are chosen for
legibility on the 402×874 device and nothing else:

```
--text-title:  22px
--text-body:   16px   the iOS reading size
--text-helper: 13px   the brief's floor for a helper line (§2)
```

`tests/fonts.test.ts` holds the hierarchy (helper < body < title), the two
minimums, a base size *and weight* on `<body>`, the weight on every title rule,
a declared role behind every weight with a shipped face behind every role, and
that every `@font-face` points at a file that exists.

**The digits are tabular without asking.** Nunito has no `tnum` feature, and
needs none: its figures are 600 units wide at every weight, so a counter does
not jitter as it ticks.

## Regenerating

The TTFs live in [`../../../Docs/art/fonts/`](../../../Docs/art/fonts/)
(Google Fonts' Nunito **v3.602**, the static instances). Each shipped file is a latin
subset cut with `pyftsubset`:

```fish
set -l U "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,\
U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2212,U+2215,U+FEFF,\
U+FFFD,U+2248,U+2264,U+2265"

for pair in Regular:400 SemiBold:600 Bold:700 ExtraBold:800
    set -l s (string split : $pair)
    pyftsubset Docs/art/fonts/Nunito-$s[1].ttf \
        --output-file=src/ui/fonts/nunito-$s[2]-latin.woff2 \
        --flavor=woff2 --unicodes=$U
end
```

That is Google's own `latin` range plus `≈ ≤ ≥`, which the chrome uses and the
range does not carry. `★` is **not** in it — Nunito has no star glyph at all,
so the rarity marks fall to the system face, exactly as they did under PT Sans.

Each file is ~15 KB — above Vite's 4096-byte inline threshold, so they ship as
hashed files with `font-display: swap`; `boot()` waits for all four (with a
ceiling) before the first mount so nothing reflows.
