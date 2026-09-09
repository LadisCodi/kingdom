import { advance } from '../src/sim/commands';
import { tapCell } from '../src/sim/harvest';
import { Game } from '../src/game';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { choosePayerProfile } from '../src/sim/store';
import { Camera } from '../src/render/camera';
import {
  DISTRICTS, ERA_UNLOCK_CELLS, TECHNOLOGIES, TECH_ORDER, TOME_ORDER, type DistrictDef,
} from '../src/sim/data/definitions';
import { ladderRank } from '../src/sim/data/techTreeRules';
import { districtCount } from '../src/sim/districts';
import {
  coordKey, getWallet, type Coord, type DistrictId, type GameState, type RuinId,
  type TechId, type UnitId,
} from '../src/sim/state';

export const map = buildMapData();
/** A Thursday. It was chosen to sit in the quiet gap between two Conjunction
 *  windows, back when the catalogue had one; the catalogue is empty now
 *  (2026-09-08), so nothing depends on the weekday and it is kept only
 *  because every stored expectation in the suite is priced against it. */
export const T0 = Date.parse('2026-08-20T12:00:00Z');

/** A fixed world seed. newGame() rolls a real one, so without this two
 *  freshGame()s would be two different worlds and every "replay equals
 *  ticking" assertion would compare apples to oranges. */
export const TEST_SEED = 0x5eed;

export const freshGame = (): GameState => {
  const state = newGame(map, T0);
  state.seed = TEST_SEED;
  // A payer profile, so the presenter does not hold every test behind the
  // profile sheet. Dolphin: enough budget to buy a pack, not everything.
  // tests/store.test.ts builds its own games to exercise the choice itself.
  choosePayerProfile(state, 'Dolphin', T0);
  return state;
};

/** The presenter, constructible under node: Camera reads nothing but the
 *  canvas's client size (stubbed below), playSfx swallows the missing
 *  AudioContext, and mapRenderer is only ever an erased `import type`. */
export const freshPresenter = (state: GameState = freshGame()): Game =>
  new Game(state, map, new Camera(
    { clientWidth: 720, clientHeight: 1280 } as unknown as HTMLCanvasElement,
  ));

/** Screen coords that land on `cell`, for driving handleTap / handleHold. */
export const screenAt = (game: Game, cell: Coord): [number, number] => {
  const { x, y, size } = game.camera.cellToScreen(cell);
  return [x + size / 2, y + size / 2];
};

/**
 * Top up a purse. Routed the way `Game.walletValue` routes reads, so a test
 * funds what it means to fund: KNOWLEDGE and STARDUST are kingdom-scoped —
 * both outlive the city that earned them — and Gems are the player's;
 * everything else is the city's (Docs/features/07-research.md §4).
 */
export const fund = (state: GameState, wallet: Record<string, number>): void => {
  const { Knowledge, Stardust, Gems, SilverKey, GoldKey, ...city } = wallet;
  Object.assign(state.city.wallet, city);
  if (Knowledge !== undefined) state.kingdom.wallet.Knowledge = Knowledge;
  if (Stardust !== undefined) state.kingdom.wallet.Stardust = Stardust;
  if (Gems !== undefined) state.player.wallet.Gems = Gems;
  // The gacha keys are the player's too. Named rather than left to the rest
  // spread, which would have posted them silently to the CITY.
  if (SilverKey !== undefined) state.player.wallet.SilverKey = SilverKey;
  if (GoldKey !== undefined) state.player.wallet.GoldKey = GoldKey;
};

/** The authored resource cells the early game is built around. None of them
 *  is inside the Townhall's opening REVEAL any more — the map puts them one
 *  ring out, so the player explores toward what they can see. Tests that are
 *  about what happens after the fog use `canGather`. */
export const FOREST: Coord = { x: 1, y: 3 };
export const BERRIES: Coord = { x: -2, y: 1 };
export const ANIMALS: Coord = { x: -1, y: -2 };

/**
 * A kingdom that can actually gather: Forestry researched, and the forest and
 * berry cells cleared.
 *
 * Forestry gates BOTH the Forest and the Berries (Docs/features/12-quests.md §2 steps
 * 2-3, revised): during the first-time experience the only thing the player
 * can do is tap fog, so no Food arrives before it is meant to. Every test
 * about the harvest loop, workers, taxes or offline replay is about what
 * happens AFTER that gate — the gate itself is defended in `harvest.test.ts`.
 */
export const canGather = (state: GameState): GameState => {
  completeTech(state, 'Forestry');
  reveal(state, [FOREST, BERRIES, ANIMALS]);
  return state;
};

export const reveal = (state: GameState, cells: Coord[]): void => {
  for (const c of cells) state.fog.revealed[coordKey(c)] = true;
};

/**
 * Take the gate down without fighting for it.
 *
 * Every ruin opens with a garrison, and nothing inside can be entered until
 * it falls (Docs/features/18-garrisons-and-raids.md §1). A test about DELVING
 * is not a test about the gate, so it says so here in one line;
 * tests/gates.test.ts is where the garrison itself is held to its contract.
 */
export const openRuin = (state: GameState, ruinId: RuinId): void => {
  state.gates[ruinId] = { nextRaidAt: null, trips: 0, hoard: {}, cleared: true };
};

/**
 * Reveal enough of the region to open every era bar in every book
 * (Docs/features/07-research.md §2.1) — what a test means by "the player has
 * been playing a while".
 *
 * A band past the first is a gate in the WORLD now, not a keystone, so a test
 * that starts an era-2 technology has to have explored for it. It takes real
 * map cells rather than invented keys so the count means the same thing the
 * game's does.
 */
export const openEveryEra = (state: GameState): void => {
  const most = Math.max(...TOME_ORDER.flatMap((t) => ERA_UNLOCK_CELLS[t]));
  // The FARTHEST cells, not the first ones the map happens to list. A test
  // about a building's discover radius is a test about the fog next to the
  // Townhall, and revealing that is not what "has explored a lot" should
  // mean here.
  const byDistance = [...map.terrain.keys()].sort((a, b) =>
    (map.distanceFromTownhall.get(b) ?? 0) - (map.distanceFromTownhall.get(a) ?? 0));
  for (const key of byDistance.slice(0, most)) state.fog.revealed[key] = true;
};

/** Test setup: drop an already-Built district onto the map (no cost, no
 *  placement checks) — e.g. Housing for population capacity. */
/** Tap a cell until it stops answering, and return what it gave up. Written
 *  against the DEPOT rather than a tap count, so it survives a change to
 *  `tap.work_seconds` or to a cell's stock. */
export const drain = (state: GameState, cell: Coord, now = T0): number => {
  let taken = 0;
  for (let i = 0; i < 200; i++) {
    const before = getWallet(state.city.wallet, 'Gold') + getWallet(state.city.wallet, 'Wood')
      + getWallet(state.city.wallet, 'Food') + getWallet(state.city.wallet, 'Stone');
    if (tapCell(state, map, cell, now) !== 'Harvested') return taken;
    const after = getWallet(state.city.wallet, 'Gold') + getWallet(state.city.wallet, 'Wood')
      + getWallet(state.city.wallet, 'Food') + getWallet(state.city.wallet, 'Stone');
    taken += after - before;
  }
  throw new Error('cell never drained');
};

export const addBuilt = (state: GameState, definitionId: DistrictId, location: Coord): void => {
  state.city.districts.push({
    uniqueId: `district_${definitionId}_${state.nextId++}`,
    definitionId,
    // Stamped the way `enqueueBuild` stamps it: the next one of its kind.
    ordinal: districtCount(state, definitionId) + 1,
    level: 1, assignedWorkers: 0, location, state: 'Built', visualVariant: 1,
  });
};

/** Test setup: the military building a unit type needs, plus enough army cap
 *  to actually recruit. Units are trained by their OWN building now, so almost
 *  every army assertion needs one. */
export const addTrainer = (state: GameState, unitId: UnitId, location: Coord): void => {
  const definitionId = (Object.values(DISTRICTS)
    .find((d) => d.trains.includes(unitId)) as DistrictDef).id;
  addBuilt(state, definitionId, location);
};

/** Drop every military building somewhere out of the way, for tests that only
 *  care that the army exists.
 *
 *  DISTINCT buildings — the Barracks turns out three of the four units, so
 *  adding one per unit would stack three Barracks on the city and treble the
 *  army cap. */
export const addAllTrainers = (state: GameState): void => {
  // Two cells apart, deliberately: halls that TOUCH train each other faster
  // (the AnyHall↔AnyHall rule, sim/adjacency.ts), and a test about a training
  // line should measure the authored duration rather than a layout. The
  // adjacency itself is tested in adjacency.test.ts.
  const cells: Coord[] = [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 8, y: 4 }, { x: 10, y: 4 }];
  const halls = Object.values(DISTRICTS)
    .filter((d) => d.armyCapPerLevel.length > 0)
    .map((d) => d.id);
  halls.forEach((id, i) => addBuilt(state, id, cells[i]));
};

/** Test setup: mark a technology as already researched. */
/**
 * Mark a technology done, AND everything it needs.
 *
 * Since the tree became three tomes paced by eras, "have Cavalry" means the
 * Warfare cover page, the keystones above it and every technology those
 * keystones require. A test that means "the player has researched this" wants
 * all of it; spelling the chain out per test would be forty lines of setup
 * that says nothing about what is under test.
 */
export const completeTech = (state: GameState, id: TechId): void => {
  for (const req of TECHNOLOGIES[id].requires) completeTech(state, req);
  if (!state.research.completed.includes(id)) state.research.completed.push(id);
};

/**
 * Every RANK LADDER in the shipped tree, keyed by its shared name, in rank
 * order — `{ Sawpits: ['SawpitsI', 'SawpitsII', 'SawpitsIII'], … }`.
 *
 * A ladder used to be a `line` field, and the field was deleted when a
 * technology started carrying its own `effects`. What is left is the naming
 * convention the tree has always followed and `tests/techTree.test.ts`
 * enforces: **a ladder is a stem plus a roman numeral**. So this reads the
 * ids, which means a test asking for "two ranks of Sawpits" keeps working
 * without a field in the data whose only reader was the tests.
 *
 * Decoding a numeral is the rules module's job (`ladderRank`), so there is
 * one of it: the editor's validation and the tests read a ladder the same way
 * or they disagree about what a ladder is.
 */
export const ladders = (() => {
  const ranked: Array<[string, number, TechId]> = [];
  for (const id of TECH_ORDER) {
    const r = ladderRank(id);
    if (r !== null) ranked.push([r.stem, r.rank, id]);
  }
  ranked.sort((a, b) => a[1] - b[1]);
  const out: Record<string, TechId[]> = {};
  for (const [stem, , id] of ranked) (out[stem] ??= []).push(id);
  return out;
})();

/** Which ladder a technology is a rank of, if any. `TapPowerIII` → `TapPower`;
 *  `Cartography` → undefined, because it is a major and not a rank. */
export const ladderOf: Partial<Record<TechId, string>> = (() => {
  const out: Partial<Record<TechId, string>> = {};
  for (const [stem, ranks] of Object.entries(ladders)) for (const id of ranks) out[id] = stem;
  return out;
})();

/** How many ranks of a ladder the player has finished — what `lineRank` used
 *  to count, now that a rank is a technology like any other. */
export const rankOf = (state: GameState, ladder: string): number =>
  ladders[ladder].filter((id) => state.research.completed.includes(id)).length;

/**
 * Research everything a technology waits on, so it is the next thing the
 * player could start.
 *
 * This replaced `ladderParent`, which answered "the major a ladder hangs off"
 * — a question the tree no longer has. A rank is an ordinary card gated by the
 * row above it, and WHICH cards those are is a drag away in `?dev=tree`, so a
 * test that needs a technology reachable asks for this instead of naming its
 * parent.
 */
export const completeRequirements = (state: GameState, id: TechId): void => {
  for (const req of TECHNOLOGIES[id].requires) completeTech(state, req);
};

/** The ladders whose ranks carry a BONUS — the 37 the old `line` field named,
 *  as opposed to the tome ladders (`Warband`, `Attunement`),
 *  whose ranks are cover pages and keystones. */
export const bonusLadders = Object.keys(ladders)
  .filter((stem) => ladders[stem].every((id) => TECHNOLOGIES[id].kind === 'bonus'))
  .sort();

/**
 * Research the first `rank` steps of a ladder — the replacement for the
 * `state.upgrades[line] = n` a levelled upgrade used to allow.
 *
 * Deliberately does NOT pull in the prerequisite chain the way `completeTech`
 * does. A ladder's effects are summed over its own completed ranks and ask
 * nothing about its parent, so pushing the ids alone is what ISOLATES the
 * ladder under test: recursing would hand every other era-1 ladder to the test
 * for free and a "Butchery adds +1" assertion would be measuring Tap Power as
 * well.
 *
 * It THROWS on a name it cannot find, because the alternative is the failure
 * this whole helper exists to prevent: a renamed technology turning fifty-odd
 * setup calls into no-ops and every assertion downstream into a tautology.
 */
export const completeRanks = (state: GameState, ladder: string, rank: number): void => {
  const ranks = ladders[ladder];
  if (ranks === undefined) {
    throw new Error(`no rank ladder called "${ladder}" — the tree has `
      + `${Object.keys(ladders).length}: ${Object.keys(ladders).sort().join(', ')}`);
  }
  for (const id of ranks.slice(0, rank)) {
    if (!state.research.completed.includes(id)) state.research.completed.push(id);
  }
};

/** Advance the unified sim to a given time. */
export const tickAt = (state: GameState, now: number) => advance(state, map, now);
