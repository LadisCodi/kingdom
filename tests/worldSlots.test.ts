// A district's building slots (Docs/features/19-world-map.md §7.2): one, two
// on bare ground. A Fortress or a Chapel takes a slot; raising a Fortress a
// level does not.
import { describe, expect, it } from 'vitest';
import { WORLD_BUILD } from '../src/sim/data/definitions';
import { SEAT_INDICES, generateBoard } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import {
  claim, claimRefusal, districtOf, districtSlots, emptyWorld, join, resolveTo, slotsUsed, upgrade, upgradeRefusal,
} from '../src/worldServer/core';
import type { ServerBoard } from '../src/worldServer/types';
import type { WorldDistrict } from '../src/sim/world/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;
const FORT_MS = WORLD_BUILD.upgrades.Fortress.levels[0].buildSeconds * 1000;
const data = generateBoard('test', 0x5eed);

function quietBoard(): { b: ServerBoard; seat: number } {
  const w = emptyWorld();
  const { board, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  return { b: board, seat };
}

/** Hold a hex beside the city whose district `is` (or is not) Rural. */
function holdOne(b: ServerBoard, seat: number, rural: boolean): { index: number; t: number } | null {
  const index = boardNeighbors(SEAT_INDICES[seat]).find((n) => {
    const d: WorldDistrict | null = districtOf(data.hexes[n]);
    return claimRefusal(b, seat, n, T0) === null && d !== null && d !== 'Shrine' && (d === 'Rural') === rural;
  });
  if (index === undefined) return null;
  claim(b, seat, index, T0);
  resolveTo(b, T0 + CLAIM_MS);
  return { index, t: T0 + CLAIM_MS };
}

describe('a district’s slots', () => {
  it('are two on bare ground and one everywhere else', () => {
    for (const [id, def] of Object.entries(WORLD_BUILD.districts)) expect(def.slots, id).toBe(id === 'Rural' ? 2 : 1);
  });

  it('hold one building in a featured district', () => {
    const { b, seat } = quietBoard();
    const held = holdOne(b, seat, false);
    expect(held).not.toBeNull();
    if (held === null) return;
    const { index, t } = held;
    expect(districtSlots(b, index)).toBe(1);
    expect(upgrade(b, seat, index, 'Fortress', t).ok).toBe(true);
    // Going up, it already takes the slot.
    expect(slotsUsed(b, index)).toBe(1);
    resolveTo(b, t + FORT_MS);
    expect(upgradeRefusal(b, seat, index, 'Chapel', t + FORT_MS)).toBe('NoSlot');
    // A level on a building that stands needs no new slot.
    expect(upgradeRefusal(b, seat, index, 'Fortress', t + FORT_MS)).toBeNull();
  });

  it('hold two on bare ground', () => {
    const { b, seat } = quietBoard();
    const held = holdOne(b, seat, true);
    expect(held).not.toBeNull();
    if (held === null) return;
    const { index, t } = held;
    expect(districtSlots(b, index)).toBe(2);
    expect(upgrade(b, seat, index, 'Fortress', t).ok).toBe(true);
    resolveTo(b, t + FORT_MS);
    expect(upgradeRefusal(b, seat, index, 'Chapel', t + FORT_MS)).toBeNull();
  });
});
