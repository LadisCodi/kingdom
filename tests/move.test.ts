// Moving a building that already exists: the sim command, what it does to a
// crew mid-trip, and the two gestures that drive it (tap a cell, or drag the
// ghost).
//
// The claim the whole feature rests on: a move is FREE, INSTANT and takes
// nothing from the player. Everything below is a way of checking that the
// things position feeds — adjacency, influence, worker distance, the fog —
// follow the building rather than being quietly re-bought.
import { describe, expect, it } from 'vitest';
import { advance, changeWorkers, moveDistrict } from '../src/sim/commands';
import { canMoveDistrict, placementBlock, validPlacementCells } from '../src/sim/districts';
import { districtAdjacency } from '../src/sim/adjacency';
import { coordKey, districtById, getWallet, townhall, type Coord } from '../src/sim/state';
import {
  addBuilt, completeTech, freshGame, freshPresenter, fund, map, reveal, screenAt, T0,
} from './helpers';

// Real grassland from the authored map. The Townhall spans (0,0)-(1,1), so
// all three of these touch it or each other; (5,5) is open ground well clear
// of everything, which is what makes it useful as "nowhere near a neighbour".
const HOUSE_CELL: Coord = { x: 2, y: 0 };
const NEIGHBOUR_CELL: Coord = { x: 2, y: 1 };
const AWAY_CELL: Coord = { x: 0, y: 2 }; // touches the Townhall, not (2,1)
const FAR_CELL: Coord = { x: 5, y: 5 };

const houseAt = (state: ReturnType<typeof freshGame>, cell: Coord) => {
  addBuilt(state, 'Housing', cell);
  return state.city.districts[state.city.districts.length - 1];
};

describe('what may be moved', () => {
  it('a built building may; the Townhall never may', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    expect(canMoveDistrict(house)).toBe(true);
    // The Townhall is the origin every fog ring, build duration and worker
    // distance is measured from. Moving it would reprice the world in silence.
    expect(canMoveDistrict(townhall(state))).toBe(false);
    expect(moveDistrict(state, map, townhall(state).uniqueId, FAR_CELL, T0)).toBe('Immovable');
  });

  it('an unfinished building may not — Cancel is what that card offers', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    house.state = 'UnderConstruction';
    expect(canMoveDistrict(house)).toBe(false);
    expect(moveDistrict(state, map, house.uniqueId, NEIGHBOUR_CELL, T0)).toBe('Immovable');
    expect(house.location).toEqual(HOUSE_CELL);
  });
});

describe('where it may go', () => {
  // The rule that makes a one-cell nudge possible at all: a building does not
  // block itself. Without it nothing could ever move by less than its own
  // footprint, which is most of the moves a player actually wants.
  it('a building does not count as occupying its own ground', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    reveal(state, [HOUSE_CELL]);
    expect(placementBlock(state, map, 'Housing', HOUSE_CELL)).toBe('Occupied');
    expect(placementBlock(state, map, 'Housing', HOUSE_CELL, house.uniqueId)).toBe(null);
    // Somebody ELSE's ground is still occupied.
    const other = houseAt(state, NEIGHBOUR_CELL);
    reveal(state, [NEIGHBOUR_CELL]);
    expect(placementBlock(state, map, 'Housing', NEIGHBOUR_CELL, house.uniqueId)).toBe('Occupied');
    expect(placementBlock(state, map, 'Housing', NEIGHBOUR_CELL, other.uniqueId)).toBe(null);
  });

  // A move adds nothing to the count it would be measured against, so the cap
  // that stops a fourth house being BUILT must not stop the third being moved.
  it('the count limit does not apply to a move', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    // Fill the Townhall-1 Housing cap and then some.
    for (let i = 0; i < 6; i++) houseAt(state, { x: 2 + i, y: 3 });
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    expect(placementBlock(state, map, 'Housing', NEIGHBOUR_CELL)).toBe('CountLimit');
    expect(placementBlock(state, map, 'Housing', NEIGHBOUR_CELL, house.uniqueId)).toBe(null);
  });

  it('a house cannot anchor its own move on itself', () => {
    const state = freshGame();
    // A lone house far from the Townhall, with no other building near it.
    reveal(state, [FAR_CELL, { x: 4, y: 5 }]);
    const lonely = houseAt(state, FAR_CELL);
    // Standing next to where you already are is not neighbourliness: shifting
    // one cell sideways leaves it with nothing to be adjacent to.
    expect(placementBlock(state, map, 'Housing', { x: 4, y: 5 }, lonely.uniqueId))
      .toBe('NeedsHousingAdjacency');
  });

  it('every other placement rule still applies', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    // Unrevealed ground is unrevealed ground, moving or not.
    const dark = { x: 9, y: 9 };
    expect(placementBlock(state, map, 'Housing', dark, house.uniqueId)).not.toBe(null);
    expect(validPlacementCells(state, map, 'Housing', house.uniqueId))
      .not.toContainEqual(dark);
  });
});

describe('moving costs nothing and takes nothing', () => {
  it('is free and instant — no wallet touched, no queue item', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    const house = houseAt(state, HOUSE_CELL);
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);

    expect(moveDistrict(state, map, house.uniqueId, NEIGHBOUR_CELL, T0)).toBe('Moved');
    expect(house.location).toEqual(NEIGHBOUR_CELL);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(500);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(500);
    expect(state.city.queue).toHaveLength(0); // nothing to wait for
    expect(house.state).toBe('Built'); // and it never stops working
  });

  it('refuses a cell it does not fit on, and changes nothing when it does', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    const dark = { x: 9, y: 9 };
    expect(moveDistrict(state, map, house.uniqueId, dark, T0)).toBe('InvalidCell');
    expect(house.location).toEqual(HOUSE_CELL);
  });

  it('putting it back where it started is a no-op, not an error', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    expect(moveDistrict(state, map, house.uniqueId, HOUSE_CELL, T0)).toBe('SameCell');
  });

  // Position is priced by everything that reads it. This is the one that
  // would silently rot: the tax rate changes at the instant a house moves in
  // or out of a neighbour's range, and the anchor has to be settled THEN or
  // the player is paid the new rate for time elapsed at the old one.
  it('adjacency follows the building, and the tax anchor is settled on the way', () => {
    const state = freshGame();
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL, AWAY_CELL]);
    const a = houseAt(state, HOUSE_CELL);
    houseAt(state, NEIGHBOUR_CELL);
    // Housing crowds Housing at −1 gold/min; the two are edge-to-edge.
    const crowded = districtAdjacency(state, a);
    expect(crowded).toBeLessThan(0);

    // Still legal (it keeps touching the Townhall) but no longer crowded.
    expect(moveDistrict(state, map, a.uniqueId, AWAY_CELL, T0)).toBe('Moved');
    expect(districtAdjacency(state, a)).toBe(0);
    expect(state.city.lastTaxAt).toBe(T0); // repriced at the instant it moved
  });

  it('the new address pushes back the fog, exactly as finishing a build does', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    const frontier = { x: 3, y: 1 };
    expect(state.fog.revealed[coordKey(frontier)]).toBeUndefined();
    moveDistrict(state, map, house.uniqueId, NEIGHBOUR_CELL, T0);
    expect(state.fog.revealed[coordKey(frontier)]).toBe(true);
  });
});

describe('the crew comes with it', () => {
  /** A Sawmill with one worker, already out on a trip. */
  const staffedSawmill = () => {
    const state = freshGame();
    completeTech(state, 'Saws'); // the Sawmill is gated on it
    reveal(state, [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }]);
    addBuilt(state, 'Sawmill', { x: 1, y: 2 });
    const mill = state.city.districts[state.city.districts.length - 1];
    state.city.population = 2;
    changeWorkers(state, map, mill.uniqueId, 1, T0);
    return { state, mill };
  };

  it('a worker mid-walk is re-homed and keeps working', () => {
    const { state, mill } = staffedSawmill();
    advance(state, map, T0 + 2_000); // out on the trip
    const worker = state.workers.find((w) => w.buildingId === mill.uniqueId)!;
    expect(worker.claimedCell).not.toBeNull();

    expect(moveDistrict(state, map, mill.uniqueId, { x: 2, y: 2 }, T0 + 2_000)).toBe('Moved');
    // Not carrying: the claim is released, because the cell it was walking to
    // may be outside the radius the building now has.
    expect(worker.claimedCell).toBeNull();
    expect(worker.activity).toBe('Idle');
    // And it goes back to work from the new address rather than stalling.
    advance(state, map, T0 + 120_000);
    expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThan(0);
  });

  it('a worker carrying a load still delivers it — a move costs no trip', () => {
    const { state, mill } = staffedSawmill();
    // Walk it forward until it is on its way home with a load.
    let carrying = false;
    for (let t = 1_000; t <= 60_000 && !carrying; t += 500) {
      advance(state, map, T0 + t);
      const w = state.workers.find((x) => x.buildingId === mill.uniqueId)!;
      carrying = w.carrying && w.activity === 'MovingHome';
      if (carrying) {
        const before = getWallet(state.city.wallet, 'Wood');
        expect(moveDistrict(state, map, mill.uniqueId, { x: 2, y: 2 }, T0 + t)).toBe('Moved');
        expect(w.carrying).toBe(true); // the load is not confiscated
        expect(w.activity).toBe('MovingHome'); // just to a new address
        advance(state, map, T0 + t + 120_000);
        expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThan(before);
      }
    }
    expect(carrying, 'the worker never picked anything up').toBe(true);
  });
});

describe('the two gestures', () => {
  it('tapping a legal cell moves the ghost; tapping an illegal one does not', () => {
    const state = freshGame();
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    const house = houseAt(state, HOUSE_CELL);
    const game = freshPresenter(state);

    game.startMove(house.uniqueId);
    expect(game.mode.kind).toBe('moving');
    // It starts where the building already is — the player picked THAT up.
    expect(game.placementInfo()!.cell).toEqual(HOUSE_CELL);
    expect(game.placementInfo()!.unmoved).toBe(true);

    game.handleTap(...screenAt(game, NEIGHBOUR_CELL));
    expect(game.placementInfo()!.cell).toEqual(NEIGHBOUR_CELL);
    expect(game.placementInfo()!.unmoved).toBe(false);
    // Still only a ghost: nothing is committed until Move here.
    expect(house.location).toEqual(HOUSE_CELL);

    const dark = { x: 9, y: 9 };
    game.handleTap(...screenAt(game, dark));
    expect(game.placementInfo()!.cell).toEqual(NEIGHBOUR_CELL); // ignored
  });

  it('confirming commits it; cancelling leaves it where it was', () => {
    const state = freshGame();
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    const house = houseAt(state, HOUSE_CELL);
    const game = freshPresenter(state);

    game.startMove(house.uniqueId);
    game.handleTap(...screenAt(game, NEIGHBOUR_CELL));
    game.dismiss();
    expect(house.location).toEqual(HOUSE_CELL);
    expect(game.mode.kind).toBe('normal');

    game.startMove(house.uniqueId);
    game.handleTap(...screenAt(game, NEIGHBOUR_CELL));
    game.confirmMove();
    expect(house.location).toEqual(NEIGHBOUR_CELL);
    expect(game.mode.kind).toBe('normal');
    // And it lands back on the card, because that is what you just handled.
    expect(game.inspectedDistrictId).toBe(house.uniqueId);
  });

  // The gesture split: a press ON the ghost drags it, a press anywhere else
  // pans. Decided once, at pointerdown, so the two never fight mid-flick.
  it('a drag grabs the ghost only when it starts on it', () => {
    const state = freshGame();
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    const house = houseAt(state, HOUSE_CELL);
    const game = freshPresenter(state);
    game.startMove(house.uniqueId);

    expect(game.grabGhost(...screenAt(game, HOUSE_CELL))).toBe(true);
    expect(game.grabGhost(...screenAt(game, FAR_CELL))).toBe(false);

    game.dragGhostTo(...screenAt(game, NEIGHBOUR_CELL));
    expect(game.placementInfo()!.cell).toEqual(NEIGHBOUR_CELL);
    // The ghost moved, so the grab moved with it.
    expect(game.grabGhost(...screenAt(game, NEIGHBOUR_CELL))).toBe(true);
    expect(game.grabGhost(...screenAt(game, HOUSE_CELL))).toBe(false);
  });

  // Dragging across ground it cannot occupy leaves it on the last legal cell
  // rather than following the finger somewhere it would snap back from.
  it('a drag over an illegal cell leaves the ghost where it was', () => {
    const state = freshGame();
    reveal(state, [HOUSE_CELL, NEIGHBOUR_CELL]);
    const house = houseAt(state, HOUSE_CELL);
    const game = freshPresenter(state);
    game.startMove(house.uniqueId);

    game.dragGhostTo(...screenAt(game, NEIGHBOUR_CELL));
    game.dragGhostTo(...screenAt(game, { x: 9, y: 9 })); // unrevealed
    expect(game.placementInfo()!.cell).toEqual(NEIGHBOUR_CELL);
  });

  it('the same drag works on a NEW building being placed', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    const game = freshPresenter(state);
    game.startPlacement('Housing');
    const start = game.placementInfo()!.cell!;

    expect(game.grabGhost(...screenAt(game, start))).toBe(true);
    expect(game.grabGhost(...screenAt(game, { x: 9, y: 9 }))).toBe(false);

    const target = validPlacementCells(state, map, 'Housing')
      .find((c) => c.x !== start.x || c.y !== start.y)!;
    game.dragGhostTo(...screenAt(game, target));
    expect(game.placementInfo()!.cell).toEqual(target);
  });

  it('offers no ghost to grab when nothing is being placed', () => {
    const game = freshPresenter(freshGame());
    expect(game.mode.kind).toBe('normal');
    expect(game.grabGhost(...screenAt(game, HOUSE_CELL))).toBe(false);
  });

  it('marks the moved building as lifted, so it is not drawn twice', () => {
    const state = freshGame();
    const house = houseAt(state, HOUSE_CELL);
    const game = freshPresenter(state);
    expect(game.markers().liftedDistrictId).toBeNull();
    game.startMove(house.uniqueId);
    expect(game.markers().liftedDistrictId).toBe(house.uniqueId);
    game.dismiss();
    expect(game.markers().liftedDistrictId).toBeNull();
  });
});

describe('the presenter refuses what the sim refuses', () => {
  it('will not enter move mode for the Townhall', () => {
    const state = freshGame();
    const game = freshPresenter(state);
    game.startMove(townhall(state).uniqueId);
    expect(game.mode.kind).toBe('normal');
  });

  it('survives a district that vanished between press and handler', () => {
    const game = freshPresenter(freshGame());
    game.startMove('district_Housing_does_not_exist');
    expect(game.mode.kind).toBe('normal');
    expect(districtById(game.state, 'district_Housing_does_not_exist')).toBeUndefined();
  });
});
