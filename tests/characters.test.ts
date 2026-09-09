// The cast list is checked against the atlas, not against hope.
//
// `drawCharacter` returns false for a name the atlas lacks and the renderer
// falls through to the old worker sprite — which is exactly the failure that
// nobody notices in review. So: every name in CREW and VILLAGERS must exist,
// have an idle, and resolve every pose to real frames; and every frame must
// lie inside the shipped atlas.png, whose size is read from the PNG header.
//
// Runs in node — cast.ts and atlas.generated.ts are deliberately DOM-free.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, CHAR_ATLAS_H, CHAR_ATLAS_W } from '../src/render/characters/atlas.generated';
import { CREW, FRAME_MS, VILLAGERS, animFor, castFor, villagerFor } from '../src/render/cast';
import { DISTRICTS } from '../src/sim/data/definitions';
import type { DistrictId } from '../src/sim/state';

const castNames = [...Object.values(CREW).flat(), ...VILLAGERS];

describe('the character atlas', () => {
  it('matches the PNG it indexes', () => {
    const png = readFileSync(new URL('../src/render/characters/atlas.png', import.meta.url), 'latin1');
    const u32 = (at: number) => ((png.charCodeAt(at) << 24) >>> 0) + (png.charCodeAt(at + 1) << 16)
      + (png.charCodeAt(at + 2) << 8) + png.charCodeAt(at + 3);
    expect(png.slice(1, 4)).toBe('PNG');
    expect(u32(16)).toBe(CHAR_ATLAS_W); // IHDR width
    expect(u32(20)).toBe(CHAR_ATLAS_H); // IHDR height
  });

  it('keeps every frame inside the atlas with its feet inside the frame', () => {
    for (const [name, anims] of Object.entries(CHARACTERS)) {
      for (const [anim, frames] of Object.entries(anims)) {
        expect(frames.length, `${name}.${anim}`).toBeGreaterThan(0);
        for (const [x, y, w, h, ax] of frames) {
          expect(w, `${name}.${anim}`).toBeGreaterThan(0);
          expect(h, `${name}.${anim}`).toBeGreaterThan(0);
          expect(x + w, `${name}.${anim}`).toBeLessThanOrEqual(CHAR_ATLAS_W);
          expect(y + h, `${name}.${anim}`).toBeLessThanOrEqual(CHAR_ATLAS_H);
          expect(ax, `${name}.${anim}`).toBeGreaterThanOrEqual(0);
          expect(ax, `${name}.${anim}`).toBeLessThanOrEqual(w);
        }
      }
    }
  });

  it('has a cadence for every animation the cast can play', () => {
    for (const name of castNames) {
      for (const anim of Object.keys(CHARACTERS[name])) {
        expect(FRAME_MS[anim], `${name}.${anim}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the cast', () => {
  it('names only characters the atlas has, each with an idle', () => {
    for (const name of castNames) {
      expect(CHARACTERS[name], name).toBeDefined();
      expect(CHARACTERS[name].idle, `${name}.idle`).toBeDefined();
    }
  });

  it('resolves every pose to frames that exist', () => {
    for (const name of castNames) {
      for (const pose of ['idle', 'walk', 'work'] as const) {
        const [who, anim] = animFor(name, pose);
        expect(CHARACTERS[who]?.[anim], `${name} ${pose} → ${who}.${anim}`).toBeDefined();
      }
    }
  });

  it('gives every crew member a real walk and a real work loop', () => {
    // A crew that stands still while it slides to its cell, or idles while it
    // is "Working", is the pack's gap showing through. The fallback to idle is
    // for villagers; a working building's cast has to be complete.
    for (const crew of Object.values(CREW)) {
      for (const name of crew) {
        expect(animFor(name, 'walk')[1], `${name} walk`).toBe('walk');
        expect(animFor(name, 'work')[1], `${name} work`).toBe('action');
      }
    }
  });

  /**
   * Buildings that have a crew and no cast yet, stated rather than assumed.
   *
   * The same bargain `tests/icons.test.ts` strikes with `AWAITING_ART`: the
   * gate stays live for everything else while the outstanding ask is
   * reviewable in one place. The pack has no work loop for a carpenter or a
   * rune carver, so their villagers fall back to the legacy worker sprite —
   * deliberately, and only until those two loops are drawn.
   */
  const AWAITING_CAST: readonly DistrictId[] = ['Carpenter', 'RuneCarver'];

  it('casts every working building except the Docks', () => {
    for (const [id, def] of Object.entries(DISTRICTS)) {
      if (def.maxWorkersPerLevel.length === 0) continue;
      if (AWAITING_CAST.includes(id as DistrictId)) continue;
      const cast = castFor(id as DistrictId, 0);
      if (def.harvestSources.includes('Fish')) expect(cast, id).toBeNull();
      else expect(cast, id).not.toBeNull();
    }
  });

  it('drops a building from the pending-cast list as soon as it is cast', () => {
    // What stops the list above from rotting.
    for (const id of AWAITING_CAST) expect(castFor(id, 0), id).toBeNull();
  });

  it('casts by seed, stably, over the whole crew', () => {
    const farm = CREW.Farm!;
    expect(castFor('Farm', 0)).toBe(farm[0]);
    expect(castFor('Farm', farm.length)).toBe(farm[0]);
    expect(castFor('Farm', 1)).toBe(farm[1]);
    expect(villagerFor(VILLAGERS.length + 2)).toBe(VILLAGERS[2]);
  });
});
