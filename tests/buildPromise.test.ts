// The build card's copy, held to the space the card actually has.
import { describe, expect, it } from 'vitest';
import { DISTRICTS } from '../src/sim/data/definitions';
import { PROMISE, PROMISE_MAX } from '../src/ui/buildPromise';
import type { DistrictId } from '../src/sim/state';

describe('what a building promises', () => {
  it('fits the card, for every building', () => {
    // WHY THIS EXISTS. The card used to fall back to `def.description`, which
    // is the long form the district card and the upgrade sheet show — 91
    // characters at its longest, against the card's 42. Thirteen of the
    // twenty-three buildings were read as a paragraph cut off mid-word.
    const over = Object.entries(PROMISE)
      .filter(([, line]) => line.length > PROMISE_MAX)
      .map(([id, line]) => `${id} (${line.length})`);
    expect(over).toEqual([]);
  });

  it('says something the name does not', () => {
    // A promise that only repeats the name is a line the card spent for
    // nothing — the name is already the biggest thing on it.
    for (const [id, line] of Object.entries(PROMISE)) {
      expect(line.toLowerCase(), id).not.toBe(DISTRICTS[id as DistrictId].name.toLowerCase());
      expect(line.length, id).toBeGreaterThan(8);
    }
  });

  it('is one line — no full stop, no second sentence', () => {
    // The register: a label, not prose. The long form keeps its sentences.
    for (const [id, line] of Object.entries(PROMISE)) {
      expect(line, id).not.toMatch(/\.\s|\.$/);
      expect(line, id).toMatch(/^[A-Z]/);
    }
  });
});
