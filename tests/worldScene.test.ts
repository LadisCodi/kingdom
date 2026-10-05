// The world board as the player meets it: the door, the scene, a tap on a
// hex and Explore (Docs/features/19-world-map.md §1.2, §3;
// Docs/features/22-progression.md §3).
import { describe, expect, it } from 'vitest';
import { HexCamera } from '../src/render/world/hexCamera';
import { DOOR_HINT } from '../src/sim/doors';
import { PORTAL_INDEX, boardNeighbors, hexAt, hexIndex } from '../src/sim/world/hex';
import { setBit } from '../src/sim/world/fogBits';
import { hexActions } from '../src/ui/world/worldActions';
import { SEAT_INDICES } from '../src/sim/world/board';
import { hexTitle } from '../src/ui/world/dispatchSheet';
import { fogStateOf } from '../src/sim/world/explorers';
import type { Game } from '../src/game';
import { firstGame, freshGame, freshPresenter, T0 } from './helpers';

/** A presenter with the world's camera, as main wires it, on a phone. */
function world(state = freshGame()): { game: Game; toasts: string[] } {
  const game = freshPresenter(state);
  game.now = () => T0;
  game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
  const toasts: string[] = [];
  game.onToast((m) => toasts.push(m));
  return { game, toasts };
}

/** Screen coords of a board hex. */
const tapAt = (game: Game, index: number): [number, number] => {
  const s = game.worldCamera!.hexToScreen(hexAt(index));
  return [s.x, s.y];
};

describe('the world door', () => {
  it('stays shut behind the Watchtower, and says what opens it', () => {
    const { game, toasts } = world(firstGame());
    game.enterWorld();
    expect(game.scene).toBe('province');
    expect(toasts).toEqual([DOOR_HINT.world]);
  });

  it('opens on the city, up close, and the knob goes home', () => {
    const { game } = world();
    game.enterWorld();
    expect(game.scene).toBe('world');
    expect(game.worldCamera!.zoom).toBeCloseTo(game.worldCamera!.maxZoom);
    expect(hexIndex(game.worldCamera!.screenToHex(390 / 2, 844 / 2))).toBe(game.homeHex());
    game.leaveWorld();
    expect(game.scene).toBe('province');
  });

  it('takes the player home when the Build menu opens', () => {
    const { game } = world();
    game.enterWorld();
    game.setOverlay('build');
    expect(game.scene).toBe('province');
  });
});

describe('a tap on the board', () => {
  it('opens the hex it lands on, and off the board closes it', () => {
    const { game } = world();
    game.enterWorld();
    game.handleWorldTap(...tapAt(game, PORTAL_INDEX));
    expect(game.selectedHex).toBe(PORTAL_INDEX);
    expect(game.openOverlay).toBe('world');
    game.handleWorldTap(-5000, -5000);
    expect(game.selectedHex).toBeNull();
    expect(game.openOverlay).toBeNull();
  });

  it('names a hex only as far as the player has seen it', () => {
    const { game } = world();
    const board = game.worldSource().board();
    const t = (i: number) => hexTitle(game, board.hexes[i], fogStateOf(game.state, i, T0));
    expect(t(PORTAL_INDEX)).toBe('The Dark Portal');
    expect(t(game.homeHex())).toBe('Your city');
    const rival = SEAT_INDICES.find((i) => i !== game.homeHex())!;
    expect(t(rival)).toBe('Unknown ground');
    // The rim across the board from home: as far from anything seen as it gets.
    const home = hexAt(game.homeHex());
    const across = hexIndex({ q: (-home.q * 5) / 4, r: (-home.r * 5) / 4 });
    expect(t(across)).toBe('Unknown ground');
    // Next to the city: shapes in the mist.
    const beside = hexIndex({ q: (home.q * 5) / 4, r: (home.r * 5) / 4 });
    expect(t(beside)).toBe('Misty ground');
  });
});

describe('Explore', () => {
  it('needs Cartography, then sends an explorer and closes the sheet', () => {
    const { game, toasts } = world();
    game.enterWorld();
    const beside = boardNeighbors(game.homeHex()).find((n) => n !== PORTAL_INDEX)!;
    game.handleWorldTap(...tapAt(game, beside));
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/Cartography/);

    game.state.research.completed.push('Cartography');
    game.state.city.wallet.Gold = 0;
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/Not enough Gold/);

    game.state.city.wallet.Gold = 1e9;
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(1);
    expect(game.state.world.explorers[0].target).toBe(beside);
    expect(game.openOverlay).toBeNull();

    game.handleWorldTap(...tapAt(game, beside));
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(1);
    expect(toasts.at(-1)).toMatch(/Every explorer is out/);
  });

  it('will not go where it has not seen the way', () => {
    const { game, toasts } = world();
    game.state.research.completed.push('Cartography');
    game.enterWorld();
    game.selectedHex = hexIndex({ q: 0, r: -5 });
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/explored ground/);
  });

  it('has nothing to explore on ground already explored', () => {
    const { game, toasts } = world();
    game.state.research.completed.push('Cartography');
    game.enterWorld();
    game.handleWorldTap(...tapAt(game, PORTAL_INDEX));
    game.doSendExplorer();
    expect(game.state.world.explorers).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/Already explored/);
  });
});

describe('acting on the board', () => {
  it('offers nothing on ground not yet explored but Explore', async () => {
    const { game } = world();
    game.state.research.completed.push('Cartography');
    const board = game.worldSource().board();
    const beside = boardNeighbors(game.homeHex()).find((n) => board.hexes[n].role !== 'portal')!;
    expect(fogStateOf(game.state, beside, T0)).toBe('Sensed');
    expect(hexActions(game.worldSource(), game.worldSeat(), board.hexes[beside], { revealed: false })).toEqual([]);
    // Once seen, the same hex can be claimed.
    setBit(game.state.world.revealed, beside);
    expect(fogStateOf(game.state, beside, T0)).toBe('Revealed');
    expect(hexActions(game.worldSource(), game.worldSeat(), board.hexes[beside], { revealed: true })
      .some((a) => a.kind === 'claim')).toBe(true);
  });
});

