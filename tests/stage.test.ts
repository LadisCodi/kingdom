// THE STAGE'S DATA AGAINST THE GAME (Docs/features/23-tutorials.md,
// 24-dialogue.md): every speaker a line names exists, every control a line
// points at is one the UI actually tags, the First Morning cannot be
// skipped, and the conditions read the kingdom the way the scenes assume.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUESTS, SCENES, SPEAKERS } from '../src/sim/data/definitions';
import { buildShortfall, nextBuildCost, stockBuild } from '../src/sim/districts';
import { canAfford } from '../src/sim/wallet';
import { conditionHolds } from '../src/ui/stage/conditions';
import { grantItem, useItem } from '../src/sim/bag';
import { handPlace, resolveTarget } from '../src/ui/stage/targets';
import { dispatchExplorer, fogStateOf, homeIndex, readyAt, revealExplored } from '../src/sim/world/explorers';
import { PORTAL_INDEX, boardNeighbors } from '../src/sim/world/hex';
import { addBuilt, firstGame, freshPresenter, reveal, T0, WATCHTOWER } from './helpers';
import { LAIRS, LANDMARKS } from '../src/sim/data/definitions';

/** Every `data-coach` key the UI source writes: literals, and the prefix of
 *  every templated one (`tech:${id}` → `tech:`). */
function coachKeys(): { exact: Set<string>; prefixes: Set<string> } {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  // The shim's readdirSync lists names only, so the tree is walked by trying:
  // a name with no dot is a folder.
  const walk = (dir: URL): URL[] => readdirSync(dir).flatMap((name) =>
    (!name.includes('.') ? walk(new URL(`${name}/`, dir))
      : name.endsWith('.ts') ? [new URL(name, dir)] : []));
  for (const file of walk(new URL('../src/ui/', import.meta.url))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/'data-coach':\s*'([^']+)'/g)) exact.add(m[1]);
    for (const m of src.matchAll(/'data-coach':\s*`([^`$]*)\$\{/g)) prefixes.add(m[1]);
    // `coach(btn({...}), 'key')`: the key is the string after the call it wraps.
    if (src.includes('coach(')) for (const m of src.matchAll(/\}?\)\s*,\s*'([a-z][\w:-]*)'\)/g)) exact.add(m[1]);
    for (const m of src.matchAll(/dataset\.coach\s*=\s*'([^']+)'/g)) exact.add(m[1]);
    // `coach(upgrade, 'card:upgrade')`: a node already made, by name.
    for (const m of src.matchAll(/coach\(\w+,\s*'([a-z][\w:-]*)'\)/g)) exact.add(m[1]);
  }
  return { exact, prefixes };
}

const MORNING = SCENES.filter((s) => s.id === 'intro' || s.id.startsWith('morning'));

describe('the scenes, against the game', () => {
  it('names only speakers the cast has', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        expect(SPEAKERS[line.speaker], `${scene.id} gives a line to "${line.speaker}"`).toBeDefined();
      }
    }
  });

  it('points only at controls the UI tags', () => {
    const { exact, prefixes } = coachKeys();
    const known = (key: string) => exact.has(key) || [...prefixes].some((p) => key.startsWith(p));
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        if (line.point.startsWith('ui:')) {
          expect(known(line.point.slice(3)), `${scene.id} points at ${line.point}`).toBe(true);
        }
        if (line.until === 'ui') {
          expect(known(line.untilTarget), `${scene.id} waits on ui ${line.untilTarget}`).toBe(true);
        }
      }
    }
  });

  it('walks the First Morning over quests 1–7, and cannot be skipped', () => {
    const opening = new Set(QUESTS.slice(0, 7).map((q) => q.id));
    expect(MORNING.length).toBeGreaterThanOrEqual(7);
    for (const scene of MORNING) {
      expect(scene.skippable, `${scene.id} is skippable`).toBe(false);
      expect(scene.trigger).toBe('questReached');
      expect(opening.has(scene.triggerTarget), `${scene.id} rides on ${scene.triggerTarget}`).toBe(true);
    }
    // Every other scene is an introduction, which waits a breath after the last.
    for (const scene of SCENES.filter((s) => !MORNING.includes(s))) {
      expect(scene.skippable, `${scene.id} cannot be skipped`).toBe(true);
    }
  });

  it('plays at the first lair found, after its card is opened, and hands over no book', () => {
    const scene = SCENES.find((s) => s.id === 'firstLair')!;
    expect(scene).toMatchObject({ trigger: 'lairFound', triggerTarget: '' });
    // Before every scene a particular lair starts, so it is the one that plays.
    for (const lair of ['orcs', 'harpies']) {
      expect(SCENES.indexOf(scene), lair).toBeLessThan(SCENES.findIndex((s) => s.id === lair));
    }
    expect(scene.lines[0]).toMatchObject({ point: 'lair:', lock: 'target', until: 'ui', untilTarget: 'lair-card' });
    // The army is a lane of the kingdom's one tree, so nothing is handed over:
    // no scene gives a book (Docs/plans/tech-tree-rework.md §3.1).
    const gifts = SCENES.flatMap((s) => s.lines.filter((l) => l.gives).map(() => s.id));
    expect(gifts).toEqual([]);
  });

  it('never strands the Sawmill lesson on a short purse: Isolde makes up the Wood', () => {
    const scene = SCENES.find((s) => s.id === 'sawmill')!;
    expect(scene.lines.find((l) => l.stocks === 'Sawmill')).toMatchObject({ until: 'tap' });
    const game = freshPresenter(firstGame());
    const wallet = game.state.city.wallet;
    const cost = nextBuildCost(game.state, 'Sawmill');
    wallet.Wood = 0;
    wallet.Gold = 0;
    expect(buildShortfall(game.state, 'Sawmill')).toEqual(cost);
    stockBuild(game.state, 'Sawmill');
    expect(canAfford(wallet, cost)).toBe(true);
    // Exactly the difference: nothing past the price, nothing when it is met.
    expect(wallet.Wood).toBe(cost.Wood);
    expect(buildShortfall(game.state, 'Sawmill')).toEqual({});
    stockBuild(game.state, 'Sawmill');
    expect(wallet.Wood).toBe(cost.Wood);
  });

  it('steps back out to the map before it points at the nav bar', () => {
    // The nav bar steps aside for every sheet, card and placement bar, so a
    // line that points at it over one would point at nothing — and, locked
    // to it, leave the player nothing to tap. The line before always walks
    // them back out; on the map already, it is passed at once.
    for (const scene of SCENES) {
      scene.lines.forEach((line, i) => {
        if (!line.point.startsWith('ui:nav:')) return;
        expect(scene.lines[i - 1], `${scene.id}: "${line.text}"`)
          .toMatchObject({ point: 'back', until: 'mainScreen', lock: 'target' });
      });
    }
  });

  it('chains the lessons by their gifts: each ends on its quest claimed, Isolde asking only the first time', () => {
    // A lesson rides on its quest being reached, so the one before must be
    // claimed for the next to start: the hand leads the player to the pill.
    const opening = SCENES.filter((s) => s.trigger === 'questReached');
    const claims = opening.map((scene) => {
      const last = scene.lines[scene.lines.length - 1];
      expect(last, scene.id).toMatchObject({ point: 'quest', lock: 'target', until: 'questClaimed', untilTarget: scene.triggerTarget });
      return last;
    });
    expect(claims.filter((l) => l.text !== '').length).toBe(1);
    expect(claims[0].text).not.toBe('');
  });

  it('lets a line with nothing to say only point: never a tap, never at nothing', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines.filter((l) => l.text === '')) {
        expect(line.until, scene.id).not.toBe('tap');
        if (line.lock !== 'none') expect(line.point, scene.id).not.toBe('');
      }
    }
  });

  it('never locks a line to a target it does not point at', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        if (line.lock === 'target') expect(line.point, `${scene.id}: "${line.text}"`).not.toBe('');
      }
    }
  });
});

describe('the box', () => {
  // The box is one fixed size — three lines at its type (stage.css); a line
  // past that is set smaller to fit, and this keeps "smaller" a rare thing.
  it('holds every line within the box\'s budget', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        expect(line.text.length, `${scene.id}: "${line.text}"`).toBeLessThanOrEqual(140);
      }
    }
  });
});

describe('the faces', () => {
  it('draws every expression a line asks for — none falls back to rest unnoticed', () => {
    const art = new Set(readdirSync('src/render/assets').map((f) => f.replace(/\.png$/, '')));
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        if (line.expression === '') continue;
        const key = `${SPEAKERS[line.speaker].portrait}_${line.expression}`;
        expect(art.has(key), `${scene.id}: ${key}`).toBe(true);
      }
    }
  });
});

describe('the conditions read the kingdom', () => {
  const args = (kind: never, target = '', amount = 0) => ({ kind, target, amount, tapsAtStart: 0 });

  it('is back on the map only with nothing open', () => {
    const game = freshPresenter(firstGame());
    const main = () => conditionHolds(game, args('mainScreen' as never));
    expect(main()).toBe(true);
    game.inspectedSite = LANDMARKS[0].location;
    expect(main()).toBe(false);
    game.dismiss();
    game.inspectedDistrictId = game.state.city.districts[0].uniqueId;
    expect(main()).toBe(false);
    game.dismiss();
    game.openOverlay = 'research';
    expect(main()).toBe(false);
    game.dismiss();
    expect(main()).toBe(true);
  });

  it('follows the quest chain', () => {
    const game = freshPresenter(firstGame());
    expect(conditionHolds(game, args('questReached' as never, 'FirstSteps'))).toBe(true);
    expect(conditionHolds(game, args('questReached' as never, 'Woodcraft'))).toBe(false);
    expect(conditionHolds(game, args('questClaimed' as never, 'FirstSteps'))).toBe(false);
    game.state.quests.index = 1;
    expect(conditionHolds(game, args('questClaimed' as never, 'FirstSteps'))).toBe(true);
    expect(conditionHolds(game, args('questComplete' as never, 'FirstSteps'))).toBe(true);
  });

  it('sees what the Bag holds, by item or by kind, and when it is used', () => {
    const game = freshPresenter(firstGame());
    const holds = (t: string) => conditionHolds(game, args('holdsItem' as never, t));
    const used = (t: string) => conditionHolds(game, args('itemUsed' as never, t));
    expect(holds('WoodChest1h')).toBe(false);
    grantItem(game.state, 'WoodChest1h');
    expect(holds('WoodChest1h')).toBe(true);
    expect(holds('chest')).toBe(true);
    expect(used('WoodChest1h')).toBe(false);
    useItem(game.state, 'WoodChest1h', 1, game.state.lastAdvance);
    expect(used('WoodChest1h')).toBe(true);
    expect(holds('chest')).toBe(false);
  });

  it('sees the lairs, the buildings and the doors', () => {
    const game = freshPresenter(firstGame());
    expect(conditionHolds(game, args('lairFound' as never, 'Orcs'))).toBe(false);
    reveal(game.state, [LAIRS.Orcs.location]);
    game.tick();
    expect(conditionHolds(game, args('lairFound' as never, 'Orcs'))).toBe(true);
    expect(conditionHolds(game, args('bookOpen' as never, 'Sagas'))).toBe(false);
    expect(conditionHolds(game, args('built' as never, 'Tavern', 1))).toBe(false);
    addBuilt(game.state, 'Tavern', { x: 3, y: 1 });
    expect(conditionHolds(game, args('built' as never, 'Tavern', 1))).toBe(true);
    // A book opens on a fact about the world: a standing Tavern finds the Sagas.
    expect(conditionHolds(game, args('bookOpen' as never, 'Sagas'))).toBe(true);
    expect(conditionHolds(game, args('doorOpen' as never, 'heroes'))).toBe(true);
    expect(conditionHolds(game, args('built' as never, 'AnyWorkshop', 1))).toBe(false);
  });

  it('sees a level climbed or under way, soldiers, a full store and idle hands', () => {
    const game = freshPresenter(firstGame());
    const holds = (kind: string, t = '', n = 0) => conditionHolds(game, args(kind as never, t, n));
    // The Upgrade pressed is the lesson: a level in the queue counts.
    expect(holds('upgraded', 'Townhall', 2)).toBe(false);
    const hall = game.state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    game.state.city.queue.push({ uniqueId: 'q', kind: 'upgrade', districtUniqueId: hall.uniqueId, targetLevel: 2 } as never);
    expect(holds('upgraded', 'Townhall', 2)).toBe(true);
    game.state.city.queue.pop();
    hall.level = 2;
    expect(holds('upgraded', 'Townhall', 2)).toBe(true);
    expect(holds('upgraded', 'Townhall', 3)).toBe(false);
    // Soldiers, not villagers.
    expect(holds('troops', '', 1)).toBe(false);
    game.state.city.trainingQueue.push({ trainee: 'Villager' } as never);
    expect(holds('troops', '', 1)).toBe(false);
    game.state.city.trainingQueue.push({ trainee: 'Warrior' } as never);
    expect(holds('troops', '', 1)).toBe(true);
    // A crew of more hands than ground in reach stands about.
    expect(holds('idleCrew')).toBe(false);
    addBuilt(game.state, 'Sawmill', { x: 40, y: 40 });
    game.state.city.districts.find((d) => d.definitionId === 'Sawmill')!.assignedWorkers = 2;
    expect(holds('idleCrew')).toBe(true);
  });

  it('sees what stands past the fog, by kind, landmark kind or lair', () => {
    const game = freshPresenter(firstGame());
    game.state.fog.revealed = {}; // the opening's own ground already sights the tower
    const tower = WATCHTOWER;
    expect(conditionHolds(game, args('sighted' as never, tower.id))).toBe(false);
    reveal(game.state, [{ x: tower.location.x, y: tower.location.y + tower.sight }]);
    expect(conditionHolds(game, args('sighted' as never, tower.id))).toBe(true);
    expect(conditionHolds(game, args('sighted' as never, 'abandoned'))).toBe(true);
    expect(conditionHolds(game, args('sighted' as never, ''))).toBe(true);
  });

  it('points a placing line at the confirm, never at the ground — the ghost already stands on the best spot', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines) {
        if (line.until === 'placed') expect(line.point, `${scene.id}: ${line.text}`).toBe('ui:place-confirm');
      }
    }
  });

  it('never holds on a tap — a tap is the stage’s own event', () => {
    const game = freshPresenter(firstGame());
    expect(conditionHolds(game, args('tap' as never))).toBe(false);
  });
});

// The hand never stands on the line it illustrates (Docs/plans/ux-pass.md
// §2.4): it takes the target's other side, and the box moves only when both
// sides would meet it.
describe('the hand and the line box', () => {
  const hand = { w: 48, h: 56 };
  const frameH = 900;
  const target = { x: 180, y: 300, w: 60, h: 40 };

  it('stands above its target when the box is elsewhere', () => {
    const bottomBox = { x: 0, y: 700, w: 430, h: 160 };
    expect(handPlace(target, hand, bottomBox, frameH)).toEqual({ above: true, moveBox: false });
  });

  it('stands below its target when above would meet the box', () => {
    const topBox = { x: 0, y: 100, w: 430, h: 170 }; // ends 30 px over the target
    expect(handPlace(target, hand, topBox, frameH)).toEqual({ above: false, moveBox: false });
  });

  it('moves the box when a target near the top has the box right under it', () => {
    const high = { x: 180, y: 40, w: 60, h: 40 };
    const under = { x: 0, y: 100, w: 430, h: 160 };
    // Above does not fit the screen, below meets the box: the box moves.
    expect(handPlace(high, hand, under, frameH)).toEqual({ above: false, moveBox: true });
  });

  it('moves the box when both sides meet it', () => {
    const tall = { x: 0, y: 150, w: 430, h: 300 }; // wraps the target
    expect(handPlace(target, hand, tall, frameH)).toEqual({ above: true, moveBox: true });
  });

  it('stands as it always did with no box on screen', () => {
    expect(handPlace(target, hand, null, frameH)).toEqual({ above: true, moveBox: false });
  });
});

// The explorer's two scenes (Docs/features/19-world-map.md §3.3): what they
// wait on, and the hexes they point at.
describe('the explorer scenes', () => {
  const holds = (game: ReturnType<typeof freshPresenter>, kind: 'explorerSent' | 'explorerReady' | 'explorerRevealed') =>
    conditionHolds(game, { kind, target: '', amount: 0, tapsAtStart: 0 });

  it('wait on a trip sent, an explorer waiting, and a hex revealed', () => {
    const game = freshPresenter();
    game.now = () => T0;
    expect(holds(game, 'explorerSent')).toBe(false);
    const target = boardNeighbors(homeIndex(game.state)).find((n) => n !== PORTAL_INDEX)!;
    const r = dispatchExplorer(game.state, target, T0);
    if (r.kind !== 'Sent') throw new Error(r.kind);
    expect(holds(game, 'explorerSent')).toBe(true);
    expect(holds(game, 'explorerReady')).toBe(false);
    game.now = () => readyAt(r.trip);
    expect(holds(game, 'explorerReady')).toBe(true);
    expect(holds(game, 'explorerRevealed')).toBe(false);
    expect(resolveTarget(game, 'hex:ready', null)).toEqual({ kind: 'hex', index: target });
    revealExplored(game.state, target, readyAt(r.trip));
    expect(holds(game, 'explorerReady')).toBe(false);
    expect(holds(game, 'explorerRevealed')).toBe(true);
  });

  it('point a first explorer at misty ground next to the city', () => {
    const game = freshPresenter();
    game.now = () => T0;
    const t = resolveTarget(game, 'hex:explore', null);
    expect(t?.kind).toBe('hex');
    const index = (t as { index: number }).index;
    expect(fogStateOf(game.state, index)).toBe('Sensed');
    expect(boardNeighbors(homeIndex(game.state))).toContain(index);
  });

  it('send the first trip free, and teach it on the board and the reveal anywhere', () => {
    const explorer = SCENES.find((s) => s.id === 'explorer')!;
    const ready = SCENES.find((s) => s.id === 'explorerReady')!;
    expect(explorer).toMatchObject({ trigger: 'worldOpen', where: 'world', doneWhen: 'explorerSent' });
    expect(ready).toMatchObject({ trigger: 'explorerReady', where: 'any', doneWhen: 'explorerRevealed' });
    expect(explorer.lines.some((l) => l.point === 'hex:explore' && l.lock === 'target')).toBe(true);
    expect(ready.lines.some((l) => l.point === 'hex:ready' && l.lock === 'target' && l.until === 'explorerRevealed')).toBe(true);
    // The world's own scene goes first.
    expect(SCENES.indexOf(explorer)).toBe(SCENES.findIndex((s) => s.id === 'world') + 1);
  });
});
