// Every battle sound the registry names has a file behind it
// (Docs/audio-wishlist.md, "The battle playback"). A name with none plays
// nothing and says nothing — this is where it says so.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const at = (path: string): URL => new URL(`../src/audio/${path}`, import.meta.url);
const source = readFileSync(at('sfx.ts'), 'utf8');
const mix = source.slice(source.indexOf('const BATTLE_MIX'), source.indexOf('};', source.indexOf('const BATTLE_MIX')));
const names = [...mix.matchAll(/^ {2}(\w+): \{ volume/gm)].map((m) => m[1]!);
const files = readdirSync(at('sounds/'));

describe('the battle sounds', () => {
  it('are read off the registry', () => {
    expect(names.length).toBeGreaterThan(20);
  });

  it.each(names)('%s has at least one take on disk', (name) => {
    expect(files.some((f) => new RegExp(`^battle_${name}(_\\d+)?\\.ogg$`).test(f))).toBe(true);
  });

  it('leave no file on disk that nothing plays', () => {
    const orphans = files.filter((f) => f.startsWith('battle_'))
      .filter((f) => !names.some((n) => new RegExp(`^battle_${n}(_\\d+)?\\.ogg$`).test(f)));
    expect(orphans).toEqual([]);
  });

  it('has the battle music', () => {
    expect(readdirSync(at('music/'))).toContain('music-battle.ogg');
  });
});
