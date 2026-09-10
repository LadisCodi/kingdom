// The type scale is a HIERARCHY with a FLOOR, and nothing else.
//
// The pixel faces that shipped until 2026-09-10 had legal sizes — whole
// multiples of a grid — and a test that held every font-size to that grid. PT
// Sans is an outline face: every whole pixel is legal, so what is left to hold
// is what the brief asks for (Docs/art/ui-menus-redesign.md §2): body copy at
// least 16px, the smallest helper line at least 13px, and a title that stands
// over both. Plus the three things that rot silently: a base size on <body>
// (or most of the game inherits the browser default), the weight on every
// title rule (so a single-weight title face can be swapped in by tokens
// alone), and @font-face files that actually exist (a renamed woff2 is a
// system fallback nobody notices until the phone).
//
// Runs in node; reads the stylesheets directly. See tests/node-shim.d.ts for
// why this is `node:fs` and not Vite's `?raw`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Below this a label is decoration, not text (the brief's helper floor is
 *  13; 11 and 12 are allowed only for the handful of tiny tags and the nav
 *  label, and never for a sentence). */
const MIN_ANY_PX = 11;
const MIN_HELPER_PX = 13;
const MIN_BODY_PX = 16;

const dir = new URL('../src/ui/styles/', import.meta.url);
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => `${dir}${f}`),
  ...readdirSync(new URL('screens/', dir)).map((f) => `${dir}screens/${f}`),
  String(new URL('../src/style.css', import.meta.url)),
];
const sheets = files.map((f) => [f.split('/').pop()!, readFileSync(new URL(f), 'utf8')] as const);
const tokens = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');

const tokenPx = (name: string): number => {
  const m = new RegExp(`--text-${name}:\\s*(\\d+)px`).exec(tokens);
  expect(m, `--text-${name} is not declared in px`).not.toBeNull();
  return Number(m![1]);
};

/** Every `selector { … }` block in the kit, with its file. Comments stripped
 *  first so a commented-out rule cannot vouch for or against anything. */
function blocks(): Array<{ file: string; sel: string; body: string }> {
  const out: Array<{ file: string; sel: string; body: string }> = [];
  for (const [file, css] of sheets) {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of bare.matchAll(/([^{}]*?)\{([^}]*)\}/gs)) {
      out.push({ file, sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
    }
  }
  return out;
}

describe('the type scale', () => {
  it('is a hierarchy: helper < body < title', () => {
    expect(tokenPx('helper')).toBeLessThan(tokenPx('body'));
    expect(tokenPx('body')).toBeLessThan(tokenPx('title'));
  });

  // §2 of the brief: ≥16px body text, ≥13px for the smallest helper line.
  it('meets the brief\'s minimums on the phone', () => {
    expect(tokenPx('body')).toBeGreaterThanOrEqual(MIN_BODY_PX);
    expect(tokenPx('helper')).toBeGreaterThanOrEqual(MIN_HELPER_PX);
  });

  // Everything unstyled inherits from <body>; left undeclared, most of the
  // game would be set at the browser default rather than the token.
  it('declares a base size on body, so nothing inherits the browser default', () => {
    const base = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    // `^body {` — not `\bbody`, which matches the `html, body { … }` reset first.
    const body = /^body\s*\{([^}]*)\}/ms.exec(base);
    expect(body, 'no body rule in style.css').not.toBeNull();
    expect(body![1]).toMatch(/font-size:\s*var\(--text-body\)/);
  });

  // Hardcoded sizes are allowed — glyph boxes, tags, the nav label — but not
  // below the point where text stops being readable on the device.
  it('never hardcodes a font-size below the floor', () => {
    const tiny = blocks()
      .map((b) => ({ ...b, px: /font-size:\s*(\d+)px/.exec(b.body)?.[1] }))
      .filter((b) => b.px !== undefined && Number(b.px) < MIN_ANY_PX)
      .map((b) => `${b.file} ${b.sel} = ${b.px}px`);
    expect(tiny).toEqual([]);
  });
});

describe('the title face', () => {
  // `--font-display` is PT Sans 700 today. A dedicated title face with one
  // weight (Germania One is the candidate) drops in by changing two tokens —
  // but only if every rule reads the weight from the token rather than
  // inheriting a user-agent bold from an <h2> or hardcoding 700.
  it('always carries --font-display-weight beside --font-display', () => {
    const bare = blocks().filter((b) => b.body.includes('var(--font-display)'));
    expect(bare.length).toBeGreaterThan(0);
    const missing = bare
      .filter((b) => !b.body.includes('var(--font-display-weight)'))
      .map((b) => `${b.file} ${b.sel}`);
    expect(missing).toEqual([]);
  });

  // A title smaller than the text under it is not a title. The plank sets
  // the family in one rule and the size in another, so it is checked by name.
  it('is only ever set at --text-title', () => {
    const wrong = blocks()
      .filter((b) => b.body.includes('var(--font-display)'))
      .map((b) => ({ ...b, size: /font-size:\s*([^;]+)/.exec(b.body)?.[1].trim() }))
      .filter((b) => !(b.size === undefined && b.sel === '.k-plank'))
      .filter((b) => b.size !== 'var(--text-title)')
      .map((b) => `${b.file} ${b.sel} = ${b.size ?? '(inherited)'}`);
    expect(wrong).toEqual([]);
  });
});

describe('the font files', () => {
  it('every @font-face points at a file that ships', () => {
    const urls = [...tokens.matchAll(/@font-face\s*\{[^}]*url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const rel of urls) {
      const path = new URL(rel, new URL('../src/ui/styles/', import.meta.url));
      expect(existsSync(path), `${rel} is declared but not on disk`).toBe(true);
    }
  });

  // Two families, three faces: PT Sans in both weights for copy and
  // numbers, Germania One in its one weight for titles (board, 2026-09-11).
  it('ships PT Sans 400 and 700 and Germania One 400, and nothing else', () => {
    const faces = [...tokens.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const declared = faces.map((f) =>
      `${/font-family:\s*'([^']+)'/.exec(f)?.[1]} ${/font-weight:\s*(\d+)/.exec(f)?.[1]}`).sort();
    expect(declared).toEqual(['Germania One 400', 'PT Sans 400', 'PT Sans 700']);
    // The display token names the one-weight face and asks for that weight.
    expect(tokens).toMatch(/--font-display:\s*'Germania One'/);
    expect(tokens).toMatch(/--font-display-weight:\s*400;/);
  });
});

// The map is a CANVAS, and `ctx.font` takes a number this test cannot see
// rendered — so it reads the renderer's own floors instead.
describe('the canvas labels', () => {
  const src = readFileSync(new URL('../src/render/mapRenderer.ts', import.meta.url), 'utf8');

  it('no longer snap to a pixel grid', () => {
    expect(src).not.toMatch(/snapPx|BODY_GRID_PX/);
  });

  it('floor every label at a legible size', () => {
    const floors = [...src.matchAll(/(?:labelFont|wholePx)\([^,]+,\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(floors.length).toBeGreaterThan(0);
    const tiny = floors.filter((px) => px < MIN_ANY_PX);
    expect(tiny, `canvas floors under ${MIN_ANY_PX}px: ${tiny.join(', ')}`).toEqual([]);
  });
});
