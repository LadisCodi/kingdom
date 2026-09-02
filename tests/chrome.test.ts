// The two chrome bars, and the two ways their metrics have gone wrong.
//
// `--hud-h` and `--nav-h` are what every screen positions against, and both
// failure modes were invisible in review because each individual rule read
// correctly:
//
//   1. The numbers were HAND-WRITTEN and drifted. The nav bar's `min-height`
//      is a floor, its content grew past it, and 16px of the district card
//      and the quest scroll were drawn under it. src/ui/chromeMetrics.ts
//      measures both bars now; the tokens are only the pre-paint fallback.
//   2. The safe-area inset was counted TWICE. The nav bar pads itself by
//      `env(safe-area-inset-bottom)`, so a measured `--nav-h` already
//      contains it — and six rules were anchoring at
//      `calc(var(--nav-h) + env(safe-area-inset-bottom))`, reserving a
//      notch's worth of screen for a notch that was already reserved.
//
// Neither is testable through a layout (no DOM here, and the whole point is
// that the CSS is self-consistent and still wrong). What IS testable is the
// contract between the watcher and the stylesheets, which is what broke.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../src/ui/styles/', import.meta.url);
const sheets = [
  ...readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => [f, `${dir}${f}`] as const),
  ...readdirSync(new URL('screens/', dir)).map((f) => [f, `${dir}screens/${f}`] as const),
  ['style.css', String(new URL('../src/style.css', import.meta.url))] as const,
]
  // COMMENTS OUT FIRST. Every one of these rules is about a mistake, so the
  // fix for each is described in a comment right beside it — and a scan that
  // reads comments flags the explanation of the bug as the bug.
  .map(([name, path]) => [
    name,
    readFileSync(new URL(path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
  ] as const);

const watcher = readFileSync(new URL('../src/ui/chromeMetrics.ts', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');

/** The custom properties chromeMetrics.ts writes onto :root at runtime. */
const PUBLISHED = [...watcher.matchAll(/publish\('(--[a-z-]+)'/g)].map((m) => m[1]);

describe('chrome metrics', () => {
  it('publishes the metrics the stylesheets position against', () => {
    expect(PUBLISHED).toEqual(expect.arrayContaining(['--hud-h', '--nav-h', '--quest-h']));
  });

  // A published variable with no token is a variable that is undefined until
  // the first ResizeObserver callback — which is a frame of every screen
  // laid out against nothing.
  it('declares a token fallback for every metric it publishes', () => {
    const missing = PUBLISHED.filter((name) => !new RegExp(`${name}:\\s*\\d`).test(tokens));
    expect(missing).toEqual([]);
  });

  // THE DOUBLE-COUNT. --nav-h is measured from the rendered nav bar, whose
  // own padding holds the safe-area inset, so any rule that adds env() on top
  // of it reserves the inset a second time. The nav bar itself is the one
  // place the inset belongs.
  it('never adds the bottom safe-area inset on top of --nav-h', () => {
    const offenders: string[] = [];
    for (const [name, css] of sheets) {
      for (const decl of css.split(';')) {
        if (!decl.includes('var(--nav-h)')) continue;
        if (decl.includes('env(safe-area-inset-bottom)')) {
          offenders.push(`${name}: ${decl.trim().replace(/\s+/g, ' ').slice(0, 90)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // The inset is the nav bar's job and nobody else's — it is the only element
  // that touches the bottom edge of the screen.
  it('reserves the bottom safe-area inset exactly once, in the nav bar', () => {
    const users = sheets
      .filter(([, css]) => css.includes('env(safe-area-inset-bottom)'))
      .map(([name]) => name);
    expect(users).toEqual(['nav.css']);
  });

  // The frame is pillarboxed to 9:16, so on a desktop the WINDOW is far wider
  // than the box the game is drawn in. A `@media (max-width: …)` therefore
  // asks about a width the player never has, which is how the HUD's phone
  // layout shipped without ever having been seen. Width-keyed rules belong to
  // the frame's container query instead.
  it('asks the frame about its width, never the window', () => {
    const offenders: string[] = [];
    for (const [name, css] of sheets) {
      for (const m of css.matchAll(/@media\s*\(([^)]*)\)/g)) {
        if (/\b(max|min)-width\b/.test(m[1])) offenders.push(`${name}: @media (${m[1]})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
