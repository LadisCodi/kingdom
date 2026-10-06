// The type system is the art checklist.
//
// ICON_EMOJI is exhaustive over IconName by construction, so adding a
// currency or district without a glyph already fails tsc. What tsc cannot
// see is the ATLAS: a new currency compiles fine and then renders as emoji
// next to a dozen pixel icons, which nobody notices in review.
//
// Runs in node — atlas.generated.ts is deliberately DOM-free.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_INDEX } from '../src/ui/kit/atlas.generated';
import { ICON_EMOJI } from '../src/ui/kit/icon';
import { CURRENCIES, DISTRICTS, ITEMS } from '../src/sim/data/definitions';


const cells = new Set(Object.keys(ICON_INDEX));
/** Cells the tool derived rather than an artist drawing them. */
const isDerived = (cell: string) => /-(sm|locked)$/.test(cell);

/**
 * Content that has shipped in the sim but is still WAITING for its sheet.
 *
 * This list is the honest version of "the art is coming": it keeps every gate
 * below live for everything else — nothing already drawn can silently vanish —
 * while making the outstanding ask reviewable in one place instead of hiding
 * in a green test run.
 *
 * `noPendingArtIsAlreadyDrawn` is what stops it rotting: the moment a sheet
 * lands, leaving the name here fails.
 */
const AWAITING_ART: readonly string[] = [
  // The Tavern (Docs/features/22-progression.md §6): its card icon and its
  // locked variant wait on the building's sheet.
  'Tavern',
  // The War Camp (Docs/features/19-world-map.md §4): its card icon and its
  // locked variant wait on the world board's art pass.
  'WarCamp',
];

const pending = new Set(AWAITING_ART);
const outstanding = (missing: string[]): string[] => missing.filter((n) => !pending.has(n));

describe('the icon atlas', () => {
  it('ships no cell the kit cannot name', () => {
    // Catches a typo in the manifest, which would otherwise pack a cell that
    // no call site can ever reach.
    // An item's own picture is named by its id (`itemArt.ts` asks for it).
    const known = new Set([...Object.keys(ICON_EMOJI), ...Object.keys(ITEMS)]);
    const orphans = [...cells]
      .map((c) => c.replace(/-(sm|locked)$/, '').replace(/-sm$/, ''))
      .filter((base) => !known.has(base));
    expect([...new Set(orphans)]).toEqual([]);
  });

  it('every currency has art', () => {
    const missing = (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>)
      .filter((c) => !cells.has(c));
    expect(outstanding(missing)).toEqual([]);
  });

  it('every district has art', () => {
    const missing = Object.keys(DISTRICTS).filter((d) => !cells.has(d));
    expect(outstanding(missing)).toEqual([]);
  });

  it('everything that can be gated has a locked variant', () => {
    // Currencies and districts are the things the UI greys out. Pure symbols
    // (a plus sign, a tick) never lock, and the manifest excludes them.
    const gateable = [...Object.keys(CURRENCIES), ...Object.keys(DISTRICTS)];
    const missing = gateable.filter((n) => !cells.has(`${n}-locked`));
    expect(outstanding(missing)).toEqual([]);
  });

  it('every currency has a 16px variant, since costs render inline', () => {
    const missing = (Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>)
      .filter((c) => !cells.has(`${c}-sm`));
    expect(outstanding(missing)).toEqual([]);
  });

  it('the drawn set covers every name the kit can ask for', () => {
    // The remaining gap, stated rather than assumed: these still fall back to
    // emoji, and the fallback is deliberate — not an oversight.
    const drawn = new Set([...cells].filter((c) => !isDerived(c)));
    const stillEmoji = Object.keys(ICON_EMOJI).filter((n) => !drawn.has(n));
    expect(outstanding(stillEmoji)).toEqual([]);
  });

  it('the pending list has not rotted — nothing on it is already drawn', () => {
    expect(AWAITING_ART.filter((n) => cells.has(n))).toEqual([]);
  });
});

// No rule on display sizes any more (2026-09-10). The chrome stopped being
// pixel art: `.icon` renders the atlas smooth, so `--icon-size` is a layout
// choice per element rather than a ratio of the 32px cell. What is still
// checked above is coverage — every name has a cell.

// The shipped folder, not the atlas.
//
// `sprites.ts` globs `./assets/*.png` and Vite bundles every match, so a file
// nobody asks for is weight the player downloads. Two ways in, both already
// taken once: a working MASTER copied next to its normalised sprite (ten of
// them, 7.6 MB), and a pixel-era stem left behind after its `_l1` landed,
// which the level chain in `mapRenderer` shadows for ever.
describe('src/render/assets', () => {
  const dir = new URL('../src/render/assets/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));

  it('ships no working masters', () => {
    // Masters live in Docs/art/<kind>/ — that is the workshop, not the game.
    expect(files.filter((f) => f.includes('.master.'))).toEqual([]);
  });

  it('ships no stem an _l1 already shadows', () => {
    // mapRenderer tries `<sprite>_l<level>` downwards, then the bare stem, so
    // a stem with a level-1 sibling can never be reached.
    const stems = new Set(files.map((f) => f.replace(/\.png$/, '')));
    const shadowed = [...stems].filter((s) => stems.has(`${s}_l1`));
    expect(shadowed).toEqual([]);
  });
});

// The chrome's materials, which no other test can see.
//
// `material.css` names its art in `url(...)` and the gallery names it in
// inline styles; neither is type-checked, so a renamed or deleted file blanks
// a panel's frame in the build and nothing fails. The frame is the one thing
// a player never reads as missing — it just looks flat.
describe('the chrome materials', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const assets = new Set(
    readdirSync(new URL('../src/ui/assets/', import.meta.url)),
  );

  it('every material.css url() points at a file that exists', () => {
    const css = read('../src/ui/styles/material.css');
    const wanted = [...css.matchAll(/url\('\.\.\/assets\/([^']+)'\)/g)].map((m) => m[1]);
    expect(wanted.length).toBeGreaterThan(0);
    expect(wanted.filter((f) => !assets.has(f))).toEqual([]);
  });

  it('every stem the kit gallery asks for exists', () => {
    // It resolves them through import.meta.glob, so a missing one is an empty
    // string rather than a 404 — silent twice over.
    const src = read('../src/ui/devGallery.ts');
    const stems = [...src.matchAll(/mat\('([^']+)'\)/g)].map((m) => m[1]);
    expect(stems.length).toBeGreaterThan(0);
    const have = new Set([...assets].map((f) => f.replace(/\.[a-z]+$/, '')));
    expect(stems.filter((s) => !have.has(s))).toEqual([]);
  });
});
