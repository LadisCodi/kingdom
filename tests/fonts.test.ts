// The type scale is a HIERARCHY with a FLOOR, and nothing else.
//
// The pixel faces that shipped until 2026-09-10 had legal sizes — whole
// multiples of a grid — and a test that held every font-size to that grid.
// Nunito is an outline face: every whole pixel is legal, so what is left to
// hold is what the brief asks for (Docs/art/ui-menus-redesign.md §2): body
// copy at least 16px, the smallest helper line at least 13px, and a title that
// stands over both.
//
// And since 2026-09-11 the WEIGHT carries as much as the size: one family sets
// the whole game, so 800 / 700 / 600 / 400 are what separate a heading from a
// button from a sentence from the caption under it. Four things rot silently
// and are held below: a base size AND weight on <body> (or most of the game
// inherits the browser default), the weight on every title rule, a role for
// every weight the CSS asks for — with a face that actually ships behind it,
// or the browser fakes it — and @font-face files that exist (a renamed woff2
// is a system fallback nobody notices until the phone).
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
  it('declares a base size and weight on body, so nothing inherits a default', () => {
    const base = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    // `^body {` — not `\bbody`, which matches the `html, body { … }` reset first.
    const body = /^body\s*\{([^}]*)\}/ms.exec(base);
    expect(body, 'no body rule in style.css').not.toBeNull();
    expect(body![1]).toMatch(/font-size:\s*var\(--text-body\)/);
    // Ordinary prose is 600. Undeclared, every sentence in the game would come
    // back at Nunito Regular — thin on parchment, and wrong against the mocks.
    expect(body![1]).toMatch(/font-weight:\s*var\(--weight-body\)/);
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
  // One family sets the whole game now, so what makes a title a title is the
  // WEIGHT. That only holds if every rule reads it from the token rather than
  // inheriting a user-agent bold from an <h2> or hardcoding a number — which
  // is also what lets a second display face drop back in by one line.
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

  // ONE family, FOUR weights — and the four are the four roles of §2 (board,
  // 2026-09-11): 800 a heading, 700 a button or an amount or a name, 600
  // ordinary prose, 400 the small description under it. A fifth face on this
  // list is a weight nothing names and a download nobody asked for.
  it('ships Nunito at 400, 600, 700 and 800, and nothing else', () => {
    const faces = [...tokens.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const declared = faces.map((f) =>
      `${/font-family:\s*'([^']+)'/.exec(f)?.[1]} ${/font-weight:\s*(\d+)/.exec(f)?.[1]}`).sort();
    expect(declared).toEqual(['Nunito 400', 'Nunito 600', 'Nunito 700', 'Nunito 800']);
    // Both type tokens name the same family: the split is the weight now.
    expect(tokens).toMatch(/--font-display:\s*'Nunito'/);
    expect(tokens).toMatch(/--font-body:\s*'Nunito'/);
  });

  // Every weight the CSS asks for has to be a face that ships, or the browser
  // synthesises it — a smeared fake bold that looks almost right on the
  // desktop and wrong on the phone.
  it('names a role for every weight, and a shipped face for every role', () => {
    const roles = ['title', 'strong', 'body', 'small'] as const;
    const shipped = new Set([...tokens.matchAll(/@font-face\s*\{[^}]*font-weight:\s*(\d+)/g)]
      .map((m) => Number(m[1])));
    for (const role of roles) {
      const m = new RegExp(`--weight-${role}:\\s*(\\d+);`).exec(tokens);
      expect(m, `--weight-${role} is not declared`).not.toBeNull();
      expect(shipped.has(Number(m![1])), `--weight-${role} is ${m![1]}, which ships no face`)
        .toBe(true);
    }
    // The display weight is the title role, not a number of its own.
    expect(tokens).toMatch(/--font-display-weight:\s*var\(--weight-title\);/);
  });

  // The 700s that were the ONLY emphasis PT Sans could offer are now one of
  // four roles, and a bare number in a rule is a weight that escaped the
  // system — it cannot be retuned with the others.
  it('never hardcodes a weight outside the @font-face declarations', () => {
    const bare = blocks()
      .filter((b) => !b.sel.includes('@font-face'))
      .filter((b) => /font-weight:\s*\d+/.test(b.body))
      .map((b) => `${b.file} ${b.sel}`);
    expect(bare).toEqual([]);
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
