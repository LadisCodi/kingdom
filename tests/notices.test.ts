// The news inbox (Docs/features/26-notices.md §1, §7) and the column that
// shows it (§3).
import { describe, expect, it, vi } from 'vitest';
import { advance, enqueueBuild } from '../src/sim/commands';
import { NOTICES, UNITS } from '../src/sim/data/definitions';
import { validPlacementCells } from '../src/sim/districts';
import { newsOf, postNews, readNews, type News } from '../src/sim/notices';
import { deserialize, serialize } from '../src/sim/save';
import { completesAt, townhall, type GameState } from '../src/sim/state';
import { allNotices, columnNotices, newsNotices } from '../src/ui/notices/model';
import { trainUnit } from '../src/sim/army';
import { addAllTrainers, completeTech, freshGame, freshPresenter, fund, map, T0 } from './helpers';

// The column's model draws art; under node there is no image to load.
vi.mock('../src/render/sprites', () => ({ spriteUrl: () => null, spriteImg: () => null, spriteImgAt: () => null }));

const world = (key: string, at: number): News => ({ group: 'world', key, at, text: key, good: true });

/** A Housing queued at T0, and when it stands. */
function aHouseUnderway(): { state: GameState; doneAt: number } {
  const state = freshGame();
  completeTech(state, 'UrbanPlanning');
  townhall(state).level = 4;
  fund(state, { Gold: 10_000, Wood: 10_000, Stone: 10_000, Food: 10_000 });
  const cell = validPlacementCells(state, map, 'Housing')[0]!;
  expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
  state.lastAdvance = T0;
  advance(state, map, T0);
  return { state, doneAt: completesAt(state.city.queue[0]!) };
}

describe('the inbox', () => {
  it('files the newest first, an event once, and drops the oldest past the cap', () => {
    const state = freshGame();
    postNews(state, world('a', T0 + 1));
    postNews(state, world('b', T0 + 3));
    postNews(state, world('c', T0 + 2));
    postNews(state, world('b', T0 + 9)); // the same event again
    expect(state.notices.map((n) => n.key)).toEqual(['b', 'c', 'a']);
    for (let i = 0; i < NOTICES.kept + 5; i++) postNews(state, world(`n${i}`, T0 + 100 + i));
    expect(state.notices).toHaveLength(NOTICES.kept);
    expect(state.notices.some((n) => n.key === 'a')).toBe(false);
  });

  it('reads a whole group at once', () => {
    const state = freshGame();
    postNews(state, world('a', T0));
    postNews(state, { group: 'chainDone', key: 'chainDone', at: T0 });
    readNews(state, 'world');
    expect(state.notices.map((n) => n.group)).toEqual(['chainDone']);
  });

  it('is saved, and a news of a group the build does not know is dropped', () => {
    const state = freshGame();
    postNews(state, world('a', T0));
    const save = serialize(state, T0);
    (save.Modules['kingdom.notices'] as unknown[]).push({ group: 'nonsense', key: 'x', at: T0 });
    const loaded = deserialize(save, map, T0)!;
    expect(loaded.notices).toEqual([world('a', T0)]);
  });
});

describe('the news the sim files', () => {
  it('a finished build, at its own instant', () => {
    const { state, doneAt } = aHouseUnderway();
    advance(state, map, doneAt + 60_000);
    const built = newsOf(state, 'built');
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({ at: doneAt, level: 1 });
  });

  it('the same in one call as in steps — an absence leaves what a watched day would', () => {
    const one = aHouseUnderway();
    const WINDOW = one.doneAt - T0 + 30_000;
    advance(one.state, map, T0 + WINDOW);
    const stepped = aHouseUnderway().state;
    for (let t = 1000; t <= WINDOW; t += 1000) advance(stepped, map, T0 + t);
    expect(stepped.notices).toEqual(one.state.notices);
    expect(one.state.notices.length).toBeGreaterThan(0);
  });

  it('survives a reload that replays the absence', () => {
    const { state, doneAt } = aHouseUnderway();
    const loaded = deserialize(serialize(state, T0), map, doneAt + 60_000)!;
    expect(newsOf(loaded, 'built')).toHaveLength(1);
  });
});

/** Three Warriors queued at one hall at T0. */
function aQueueOfThree(): GameState {
  const state = freshGame();
  addAllTrainers(state);
  if (UNITS.Warrior.requiredTech !== null) completeTech(state, UNITS.Warrior.requiredTech);
  fund(state, { Gold: 200_000, Food: 90_000, Wood: 90_000, Stone: 40_000 });
  state.lastAdvance = T0;
  for (let i = 0; i < 3; i++) expect(trainUnit(state, 'Warrior', T0)).toBe('Queued');
  return state;
}
const HOUR = 3_600_000;

describe('a training queue', () => {
  it('files ONE news, when its hall runs dry — not one per soldier', () => {
    const state = aQueueOfThree();
    const hall = state.city.trainingQueue[0]!.buildingId;
    // Step until the first soldier is out and two are still waiting.
    let t = T0;
    while (state.army.length === 0) { t += 1000; advance(state, map, t); }
    expect(state.city.trainingQueue.length).toBeGreaterThan(0);
    expect(newsOf(state, 'trained')).toEqual([]);
    advance(state, map, T0 + HOUR);
    const news = newsOf(state, 'trained');
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ district: hall, unit: 'Warrior' });
  });

  it('the same in one call as in steps', () => {
    const one = aQueueOfThree();
    advance(one, map, T0 + HOUR);
    const stepped = aQueueOfThree();
    for (let t = 10_000; t <= HOUR; t += 10_000) advance(stepped, map, T0 + t);
    expect(newsOf(stepped, 'trained')).toEqual(newsOf(one, 'trained'));
    expect(newsOf(one, 'trained')).toHaveLength(1);
  });

  it('drops a saved per-soldier news from before', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    (save.Modules['kingdom.notices'] as unknown[]).push({ group: 'trained', key: 'trained:Warrior:1', at: T0, unit: 'Warrior', count: 3 });
    expect(newsOf(deserialize(save, map, T0)!, 'trained')).toEqual([]);
  });
});

describe('the column', () => {
  it('shows every news while they fit, else a +N over the first ones', () => {
    const game = freshPresenter();
    const groups: News[] = [
      world('w', T0 + 1),
      { group: 'chainDone', key: 'chainDone', at: T0 + 2 },
      { group: 'armyHome', key: 'army', at: T0 + 3, troops: 3, fallen: 0 },
      { group: 'worldBuild', key: 'wb', at: T0 + 4, hex: 0, what: 'Fortress', level: 1 },
      { group: 'sighted', key: 'sighted:Goblins', at: T0 + 5, site: 'Goblins' },
    ];
    for (const n of groups) {
      postNews(game.state, n);
      const all = newsNotices(game).map((x) => x.id);
      const shown = columnNotices(game, 4);
      if (all.length <= 4) {
        expect(shown.map((x) => x.id)).toEqual(all);
        continue;
      }
      expect(shown).toHaveLength(4);
      expect(shown[0]).toMatchObject({ kind: 'more' });
      expect(shown[0].rows).toHaveLength(all.length);
      expect(shown.slice(1).map((x) => x.id)).toEqual(all.slice(0, 3));
    }
    expect(newsNotices(game).length).toBeGreaterThan(4);
    // The newest news leads the news.
    expect(allNotices(game).find((n) => n.kind === 'news')?.id).toBe('news:sighted');
  });

  it('opening a news reads its group, and its card keeps what it said', () => {
    const game = freshPresenter();
    postNews(game.state, world('a', T0));
    postNews(game.state, world('b', T0 + 1));
    game.openNotice('news:world');
    expect(newsOf(game.state, 'world')).toEqual([]);
    expect(game.noticeCard?.news).toHaveLength(2);
    expect(game.openOverlay).toBe('notice');
  });
});
