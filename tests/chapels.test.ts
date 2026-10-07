// The Chapel (Docs/proposals/relic-restoration.md §5.2, §5.3): the second
// upgrade built into a world district, which hosts one world relic. A lost
// hex sends its relic home.
import { describe, expect, it } from 'vitest';
import { buildBoard, generateEnemy } from '../src/sim/battle';
import { WORLD_BUILD } from '../src/sim/data/definitions';
import { SEAT_INDICES, generateBoard } from '../src/sim/world/board';
import { PORTAL_INDEX, boardNeighbors, hexAt, hexDistance, hexIndex, hexLine } from '../src/sim/world/hex';
import {
  chapelsAllowed, claim, claimRefusal, districtOf, drainEffects, emptyWorld, hasChapel, hostRelic, join, resolveTo, tribute,
  sendArmy, snapshotOf, unhostRelic, upgrade, upgradeRefusal,
} from '../src/worldServer/core';
import type { ServerBoard } from '../src/worldServer/types';
import { artifactLevel, grantArtifactLevel } from '../src/sim/artifacts';
import { resolve } from '../src/sim/modifiers';
import { freshGame } from './helpers';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;
const CHAPEL_MS = WORLD_BUILD.upgrades.Chapel.levels[0].buildSeconds * 1000;
const data = generateBoard('test', 0x5eed);

function quietBoard(): { b: ServerBoard; seat: number } {
  const w = emptyWorld();
  const { board, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  return { b: board, seat };
}

const army = (power: number, key: string) => {
  const plan = generateEnemy({ seed: 1, parts: ['test', key], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, plan.fighters);
};

/** A held, active hex beside `seat`'s city that is not a Shrine district. */
function holdOne(b: ServerBoard, seat: number, t: number): { index: number; t: number } {
  const index = boardNeighbors(SEAT_INDICES[seat])
    .filter((n) => claimRefusal(b, seat, n, t) === null && districtOf(data.hexes[n]) !== 'Shrine')
    .sort((x, y) => hexDistance(hexAt(x), hexAt(PORTAL_INDEX)) - hexDistance(hexAt(y), hexAt(PORTAL_INDEX)))[0];
  claim(b, seat, index, t);
  resolveTo(b, t + CLAIM_MS);
  return { index, t: t + CLAIM_MS };
}

/** …with a Chapel standing in it. */
function chapelOn(b: ServerBoard, seat: number, t0: number): { index: number; t: number } {
  const { index, t } = holdOne(b, seat, t0);
  const r = upgrade(b, seat, index, 'Chapel', t);
  if (!r.ok) throw new Error(r.why);
  resolveTo(b, t + CHAPEL_MS);
  return { index, t: t + CHAPEL_MS };
}

describe('the Chapel', () => {
  it('is built into a district that stands, once', () => {
    const { b, seat } = quietBoard();
    const { index, t } = chapelOn(b, seat, T0);
    expect(b.hexes[index].chapel).toBe(1);
    expect(hasChapel(b, index)).toBe(true);
    expect(upgradeRefusal(b, seat, index, 'Chapel', t)).toBe('MaxLevel');
    // The Fortress is a separate upgrade on the same district.
    expect(upgradeRefusal(b, seat, index, 'Fortress', t)).toBeNull();
    expect(snapshotOf(b, seat, t).hexes.find((h) => h.index === index)?.chapel).toBe(true);
  });

  it('is one, and one more per so many hexes held', () => {
    const { b, seat } = quietBoard();
    expect(chapelsAllowed(b, seat)).toBe(1);
    const { t } = chapelOn(b, seat, T0);
    const second = holdOne(b, seat, t);
    if (WORLD_BUILD.chapelsPerHexes > 2) {
      expect(upgradeRefusal(b, seat, second.index, 'Chapel', second.t)).toBe('TooManyChapels');
    }
  });
});

describe('a world relic in a Chapel', () => {
  it('needs a Chapel and a world relic', () => {
    const { b, seat } = quietBoard();
    const bare = holdOne(b, seat, T0);
    expect(hostRelic(b, seat, bare.index, 'MusterHorn', 1, bare.t)).toMatchObject({ ok: false, why: 'NoChapel' });
    const { index, t } = chapelOn(b, seat, bare.t);
    expect(hostRelic(b, seat, index, 'GildedLedger', 1, t)).toMatchObject({ ok: false, why: 'NotAWorldRelic' });
    expect(hostRelic(b, seat, index, 'MusterHorn', 3, t).ok).toBe(true);
    // Every player sees it, at its level.
    expect(snapshotOf(b, 1, t).hexes.find((h) => h.index === index)?.relic).toEqual({ id: 'MusterHorn', level: 3 });
  });

  it('holds one relic, and a relic is in one Chapel', () => {
    const { b, seat } = quietBoard();
    const { index, t } = chapelOn(b, seat, T0);
    hostRelic(b, seat, index, 'MusterHorn', 1, t);
    hostRelic(b, seat, index, 'BailiffsTally', 1, t);
    expect(b.hexes[index].relic).toBe('BailiffsTally');
    expect(unhostRelic(b, seat, 'BailiffsTally', t).ok).toBe(true);
    expect(b.hexes[index].relic).toBeNull();
    expect(unhostRelic(b, seat, 'BailiffsTally', t)).toMatchObject({ ok: false, why: 'NothingThere' });
  });

  // THE GATE (Docs/plans/relics-and-bag.md §4, step 7): a conquered Chapel's
  // relic is back with its owner, at its level.
  it('goes home when its ground is taken, and the Chapel stands empty', () => {
    const { b, seat } = quietBoard();
    const rival = 1;
    // The rival builds a road towards the player and a Chapel at its end.
    const line = hexLine(hexAt(SEAT_INDICES[rival]), hexAt(SEAT_INDICES[seat])).map(hexIndex);
    let t = T0;
    for (const i of line.slice(1, -1)) {
      // A camp on the road is paid off first.
      if (claimRefusal(b, rival, i, t) === 'Guarded') tribute(b, rival, i, t);
      if (b.hexes[i] === undefined && claimRefusal(b, rival, i, t) === null) {
        claim(b, rival, i, t);
        t += CLAIM_MS;
        resolveTo(b, t);
      }
    }
    const target = line[line.length - 2];
    b.hexes[target].chapel = 1;
    expect(hostRelic(b, rival, target, 'MusterHorn', 4, t).ok).toBe(true);

    const r = sendArmy(b, seat, { purpose: 'attack', target, heroes: [], board: army(300, 'a') }, t);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    expect(b.hexes[target].owner).toBe(seat);
    expect(b.hexes[target].relic).toBeNull();
    expect(hasChapel(b, target)).toBe(true);
    expect(drainEffects(b, rival).some((e) => e.kind === 'report' && e.text.includes('Warhorn of the Host'))).toBe(true);
    // The rival's client: the relic is no longer in a Chapel, and its level
    // is untouched — it was never taken out of the save.
    const theirs = freshGame();
    grantArtifactLevel(theirs, 'MusterHorn');
    theirs.world.chapels = snapshotOf(b, rival, r.arrivesAt).hexes
      .filter((h) => h.owner === rival && h.relic !== null).map((h) => h.relic!.id);
    expect(theirs.world.chapels).toEqual([]);
    expect(artifactLevel(theirs, 'MusterHorn')).toBe(1);
    expect(resolve(theirs, 'armyCap', 1)).toBe(1);
  });
});
