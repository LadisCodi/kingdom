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

  it('gives every crew a work loop, and a walk to those that go out', () => {
    // A crew that idles while it is "Working" is a gap in the cast showing
    // through, so the work loop is required of everybody.
    //
    // A WALK is required only of the crews that leave the building. A
    // workshop's people are drawn at its door and never travel, so drawing
    // them a walk cycle would be asking for art nothing can ever show — and
    // the rule is read off the building rather than listed here, because a
    // district that harvests is exactly one that sends its crew out.
    for (const [id, crew] of Object.entries(CREW)) {
      const goesOut = DISTRICTS[id as DistrictId].harvestSources.length > 0;
      for (const name of crew) {
        expect(animFor(name, 'work')[1], `${name} work`).toBe('action');
        if (goesOut) expect(animFor(name, 'walk')[1], `${name} walk`).toBe('walk');
      }
    }
  });

  it('casts every working building, with nothing left awaiting one', () => {
    // There is no pending list any more: the Docks were the last exception,
    // and they are cast now too — their member is the boat. A building that
    // takes workers and draws nothing of its own would fall through to an
    // emoji, so the gate is simply "all of them".
    for (const [id, def] of Object.entries(DISTRICTS)) {
      if (def.maxWorkersPerLevel.length === 0) continue;
      expect(castFor(id as DistrictId, 0), id).not.toBeNull();
    }
  });

  it('casts by seed, stably, over the whole crew', () => {
    // The PROPERTY again, not a fixed index — a crew of one is legal.
    for (const [id, crew] of Object.entries(CREW)) {
      for (let k = 0; k < crew.length; k++) {
        expect(castFor(id as DistrictId, k), `${id} seed ${k}`).toBe(crew[k]);
        expect(castFor(id as DistrictId, crew.length + k), `${id} wrap ${k}`)
          .toBe(crew[k]);
      }
    }
    // The PROPERTY, not a fixed index: a seed past the end of the list wraps
    // to the same face it started on. Asserting VILLAGERS[2] assumed a list
    // three long, and broke the day the pixel pack was cut back to one.
    for (let k = 0; k < VILLAGERS.length; k++) {
      expect(villagerFor(VILLAGERS.length + k), `seed ${k}`).toBe(VILLAGERS[k]);
    }
  });
});
