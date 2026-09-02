// Pixel faces have LEGAL SIZES, and CSS cannot say so.
//
// Both faces are drawn on a grid. Set one at anything but a whole multiple of
// its grid and the outline lands between device pixels, where the rasteriser
// antialiases the square edges into grey — which is the entire thing a pixel
// face exists not to do. Measured over the 117 characters the subset ships
// (units-per-em ÷ the GCD of every point coordinate):
//
//   BoldPixels   1024 / 64 = 16 px per em  ->  16, 32, 48
//   m6x11plus    1152 / 64 = 18 px per em  ->  18, 36
//
// This is the same failure the icon atlas had at 24px against a 32px cell,
// and it is invisible the same way: every individual number looks reasonable,
// and the constraint lives in a font file that no stylesheet mentions.
//
// Runs in node; reads the stylesheets directly. See tests/node-shim.d.ts for
// why this is `node:fs` and not Vite's `?raw`.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DISPLAY_GRID = 16; // BoldPixels
const BODY_GRID = 18; // m6x11plus

const dir = new URL('../src/ui/styles/', import.meta.url);
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => `${dir}${f}`),
  ...readdirSync(new URL('screens/', dir)).map((f) => `${dir}screens/${f}`),
  String(new URL('../src/style.css', import.meta.url)),
];
const sheets = files.map((f) => [f.split('/').pop()!, readFileSync(new URL(f), 'utf8')] as const);

/**
 * Rules whose `font-size` sizes a GLYPH BOX — an emoji, a `▶`, a `✕` — rather
 * than text set in either face. None of them render through the pixel fonts,
 * so the grid does not apply.
 *
 * An explicit list rather than a name convention, because it has to stay
 * reviewable: adding a selector here is how you would silently opt a real
 * piece of text out of the rule.
 */
const GLYPH_BOXES: readonly string[] = [
  '.exp-relic-art.is-glyph', '.rel-art--glyph', '.chk-hero.is-glyph',
  '.exp-ruin-art.is-glyph, .exp-portrait.is-glyph, .exp-troop-art.is-glyph, .exp-prize-art.is-glyph',
  '.rel-socket-empty',
  '.b-glyph', '.site-art--glyph', '.ad-screen-fake-mark',
  '.tech-node', '.tech-node.silhouette', '.tech-node.upgrade',
  '.ad-offer-film', '.k-knob', '.legacy-close',
];

/** Every `selector { … font-size: Npx … }` in the kit, with its file. */
function hardcodedSizes(): Array<{ file: string; sel: string; px: number }> {
  const out: Array<{ file: string; sel: string; px: number }> = [];
  for (const [file, css] of sheets) {
    for (const m of css.matchAll(/([^{}]*?)\{([^}]*)\}/gs)) {
      const sel = m[1].split('*/').pop()!.trim().replace(/\s+/g, ' ');
      const fs = /font-size:\s*(\d+)px/.exec(m[2]);
      if (fs) out.push({ file, sel, px: Number(fs[1]) });
    }
  }
  return out;
}

describe('the pixel faces are only ever set at a legal size', () => {
  it('sizes every hardcoded font-size on one of the two grids', () => {
    const offGrid = hardcodedSizes()
      .filter((r) => !GLYPH_BOXES.includes(r.sel))
      .filter((r) => r.px % BODY_GRID !== 0 && r.px % DISPLAY_GRID !== 0)
      .map((r) => `${r.file} ${r.sel} = ${r.px}px`);
    expect(offGrid).toEqual([]);
  });

  // The tokens are the sizes almost everything actually resolves to, so they
  // get their own assertion rather than riding on the sweep above.
  it('puts the type tokens on the grids', () => {
    const tokens = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');
    const px = (name: string) => {
      const m = new RegExp(`--text-${name}:\\s*(\\d+)px`).exec(tokens);
      expect(m, `--text-${name} is not declared in px`).not.toBeNull();
      return Number(m![1]);
    };
    expect(px('title') % DISPLAY_GRID).toBe(0); // set in BoldPixels
    expect(px('body') % BODY_GRID).toBe(0);
    expect(px('helper') % BODY_GRID).toBe(0);
  });

  // Everything unstyled inherits from <body>, and the browser's 16px default
  // is off the body grid — so leaving this undeclared silently softens most
  // of the text in the game. It was undeclared until the pixel faces landed.
  it('declares a base size on body, so nothing inherits the browser default', () => {
    const base = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    // `^body {` — not `\bbody`, which matches the `html, body { … }` reset first.
    const body = /^body\s*\{([^}]*)\}/ms.exec(base);
    expect(body, 'no body rule in style.css').not.toBeNull();
    expect(body![1]).toMatch(/font-size:\s*var\(--text-body\)/);
  });

  // BoldPixels is only crisp at 16/32/48, and 16 gives 8px caps — shorter than
  // the body face's 11. So a display-face rule is either a real title at
  // --text-title, or it should not be in the display face at all.
  it('uses the display face only at --text-title', () => {
    const wrong: string[] = [];
    for (const [file, css] of sheets) {
      for (const m of css.matchAll(/([^{}]*?)\{([^}]*var\(--font-display\)[^}]*)\}/gs)) {
        const sel = m[1].split('*/').pop()!.trim().replace(/\s+/g, ' ');
        const size = /font-size:\s*([^;]+)/.exec(m[2])?.[1].trim();
        // `.k-plank` sets the family in one rule and the size in another.
        if (size === undefined && sel === '.k-plank') continue;
        if (size !== 'var(--text-title)') wrong.push(`${file} ${sel} = ${size ?? '(inherited)'}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
