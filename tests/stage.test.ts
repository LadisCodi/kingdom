// THE STAGE'S DATA AGAINST THE GAME (Docs/features/23-tutorials.md,
// 24-dialogue.md): every speaker a line names exists, every control a line
// points at is one the UI actually tags, the First Morning cannot be
// skipped, and the conditions read the kingdom the way the scenes assume.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUESTS, SCENES, SPEAKERS } from '../src/sim/data/definitions';
import { giveBook } from '../src/sim/research';
import { conditionHolds } from '../src/ui/stage/conditions';
import { addBuilt, firstGame, freshPresenter, reveal } from './helpers';
import { FOG, LAIRS, LANDMARKS } from '../src/sim/data/definitions';

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

  it('hands over the Book of Warfare at the first lair found, after its card is opened', () => {
    const scene = SCENES.find((s) => s.id === 'firstLair')!;
    expect(scene).toMatchObject({ trigger: 'lairFound', triggerTarget: '' });
    // Before every scene a particular lair starts, so it is the one that plays.
    for (const lair of ['orcs', 'harpies']) {
      expect(SCENES.indexOf(scene), lair).toBeLessThan(SCENES.findIndex((s) => s.id === lair));
    }
    expect(scene.lines[0]).toMatchObject({ point: 'lair:', lock: 'target', until: 'ui', untilTarget: 'lair-card' });
    expect(scene.lines.at(-1)!.gives).toBe('Warfare');
    // And nothing else hands a book over.
    const gifts = SCENES.flatMap((s) => s.lines.filter((l) => l.gives).map(() => s.id));
    expect(gifts).toEqual(['firstLair']);
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

  it('follows the quest chain', () => {
    const game = freshPresenter(firstGame());
    expect(conditionHolds(game, args('questReached' as never, 'FirstSteps'))).toBe(true);
    expect(conditionHolds(game, args('questReached' as never, 'Woodcraft'))).toBe(false);
    expect(conditionHolds(game, args('questClaimed' as never, 'FirstSteps'))).toBe(false);
    game.state.quests.index = 1;
    expect(conditionHolds(game, args('questClaimed' as never, 'FirstSteps'))).toBe(true);
    expect(conditionHolds(game, args('questComplete' as never, 'FirstSteps'))).toBe(true);
  });

  it('sees the lairs, the buildings and the doors', () => {
    const game = freshPresenter(firstGame());
    expect(conditionHolds(game, args('lairFound' as never, 'Orcs'))).toBe(false);
    reveal(game.state, [LAIRS.Orcs.location]);
    game.tick();
    expect(conditionHolds(game, args('lairFound' as never, 'Orcs'))).toBe(true);
    // Found is not given: the book waits for Isolde's line.
    expect(conditionHolds(game, args('bookOpen' as never, 'Warfare'))).toBe(false);
    giveBook(game.state, 'Warfare');
    expect(conditionHolds(game, args('bookOpen' as never, 'Warfare'))).toBe(true);
    expect(conditionHolds(game, args('built' as never, 'Tavern', 1))).toBe(false);
    addBuilt(game.state, 'Tavern', { x: 3, y: 1 });
    expect(conditionHolds(game, args('built' as never, 'Tavern', 1))).toBe(true);
    expect(conditionHolds(game, args('doorOpen' as never, 'heroes'))).toBe(true);
    expect(conditionHolds(game, args('built' as never, 'AnyWorkshop', 1))).toBe(false);
  });

  it('sees what stands past the fog, by kind, landmark kind or lair', () => {
    const game = freshPresenter(firstGame());
    const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
    expect(conditionHolds(game, args('sighted' as never, 'Watchtower'))).toBe(false);
    reveal(game.state, [{ x: tower.location.x, y: tower.location.y + FOG.sight.watchtower }]);
    expect(conditionHolds(game, args('sighted' as never, 'Watchtower'))).toBe(true);
    expect(conditionHolds(game, args('sighted' as never, 'landmark'))).toBe(true);
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
