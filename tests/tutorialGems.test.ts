// The First Morning never points the hand at Gems (Docs/features/23-tutorials.md
// §3; Docs/plans/ux-pass.md §2.3): a line may name a paid shortcut, but
// following the hand must never spend the player's Gems.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/sim/data/definitions';
import { GEM_CONTROLS } from '../src/ui/stage/targets';

/** The First Morning: the intro and every `morning*` scene (main.ts's 🎓). */
const FIRST_MORNING = SCENES.filter((s) => s.id === 'intro' || s.id.startsWith('morning'));

describe('the First Morning', () => {
  it('points the hand at nothing paid for with Gems', () => {
    expect(FIRST_MORNING.length).toBeGreaterThan(0);
    const paid = FIRST_MORNING.flatMap((s) => s.lines.map((l, i) => ({ scene: s.id, line: i + 1, point: l.point })))
      .filter((l) => l.point.startsWith('ui:') && GEM_CONTROLS.has(l.point.slice(3)));
    expect(paid).toEqual([]);
  });
});

describe('the Gem controls a line can point at', () => {
  // Every `coach(btn({ … kind: 'gem' … }), '<key>')` in the UI: a Gem button
  // the stage can find. Read from the source, so a new one cannot be missed.
  const root = new URL('../src/ui/', import.meta.url);
  const marked = new Set<string>();
  for (const file of readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(new URL(file, root), 'utf8');
    for (const m of src.matchAll(/coach\(\s*btn\(\{([\s\S]*?)\}\),\s*'([^']+)'\)/g)) {
      if (/kind:\s*'gem'/.test(m[1])) marked.add(m[2]);
    }
  }

  it('are all on the list the First Morning is held to', () => {
    expect(marked.size).toBeGreaterThan(0);
    expect([...marked].filter((k) => !GEM_CONTROLS.has(k))).toEqual([]);
  });

  it('are on it only while the UI still has them', () => {
    expect([...GEM_CONTROLS].filter((k) => !marked.has(k))).toEqual([]);
  });
});
