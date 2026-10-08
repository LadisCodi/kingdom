// THE NEWS INBOX (Docs/features/26-notices.md §1, §7): what happened that the
// player may not have seen, kept in the save until its bubble is opened.
//
// A news is written by the sim — `advance()` and the commands — so an absence
// leaves the same news a watched afternoon would: the replay walks the same
// boundaries. Its KEY names the event, never the moment it was noticed, so
// the same event never makes two, however the work is grouped.
//
// The standing STATES (the Mana refill, a relic asleep, a raid coming…) are
// not here: they are derived from the state on every notify, by the game.

import { NOTICES } from './data/definitions';
import type { AdvanceResult } from './commands';
import { completesAt } from './state';
import type { GameState, GoodId, LairId, UnitId, Wallet, WorldBuildWhat } from './state';

/** What a news is about; one bubble per group. */
export type NewsGroup =
  | 'raided' | 'built' | 'trained' | 'goods' | 'sighted'
  | 'worldBuild' | 'armyHome' | 'world' | 'portal' | 'event' | 'chainDone';

interface NewsBase { key: string; at: number }

export type News = NewsBase & (
  /** A construction (`level` 1) or an upgrade completed. */
  | { group: 'built'; district: string; level: number }
  /** A military building's training queue ran dry: it stands idle.
   *  `unit` is the last one it trained. */
  | { group: 'trained'; district: string; unit: UnitId }
  | { group: 'goods'; district: string; good: GoodId; count: number }
  | { group: 'raided'; lair: LairId; took: Wallet }
  /** A landmark, lair or abandoned building sighted, by id. */
  | { group: 'sighted'; site: string }
  | { group: 'worldBuild'; hex: number; what: WorldBuildWhat; level: number }
  | { group: 'armyHome'; troops: number; fallen: number }
  /** A world server report; `hex` is where it happened, when it has a place. */
  | { group: 'world'; text: string; good: boolean; hex?: number }
  /** The Dark Portal opened; or closed with the player ranked where it
   *  pays nothing (a place that pays is a prize to claim instead). */
  | { group: 'portal'; open: true; closesAt: number }
  | { group: 'portal'; open: false; place: number; of: number; floor: number }
  | { group: 'event'; entry: string; title: string; detail: string }
  | { group: 'chainDone' }
);

/** Every group, in the order the column shows news of equal age. */
export const NEWS_GROUPS: readonly NewsGroup[] = [
  'raided', 'built', 'trained', 'goods', 'sighted', 'worldBuild', 'armyHome', 'world', 'portal', 'event', 'chainDone',
];

/** File a news, newest first. The same event twice is one; past the cap the
 *  oldest goes. */
export function postNews(state: GameState, news: News): void {
  if (state.notices.some((n) => n.key === news.key)) return;
  const at = state.notices.findIndex((n) => n.at <= news.at);
  state.notices.splice(at < 0 ? state.notices.length : at, 0, news);
  if (state.notices.length > NOTICES.kept) state.notices.length = NOTICES.kept;
}

/** The news of one group, newest first. */
export const newsOf = (state: GameState, group: NewsGroup): News[] =>
  state.notices.filter((n) => n.group === group);

/** Read a group: its bubble goes. */
export function readNews(state: GameState, group: NewsGroup): void {
  state.notices = state.notices.filter((n) => n.group !== group);
}

/** A saved news, if it is one this build knows; anything else is dropped. */
export function readSavedNews(dto: unknown): News | null {
  if (typeof dto !== 'object' || dto === null) return null;
  const n = dto as Partial<News>;
  if (typeof n.key !== 'string' || typeof n.at !== 'number') return null;
  if (!NEWS_GROUPS.includes(n.group as NewsGroup)) return null;
  // A 'trained' news from before it meant an idle hall was one per batch of
  // soldiers, with no hall: dropped rather than shown as something it is not.
  if (n.group === 'trained' && typeof (n as { district?: unknown }).district !== 'string') return null;
  return n as News;
}

/** Where `advance()`'s report stood before a boundary's work: what it adds
 *  past these is that boundary's news. */
export interface NewsMark {
  completed: number; linesDone: number; goods: number; raids: number; schedule: number; worldBuilds: number;
}

export const newsMark = (out: AdvanceResult): NewsMark => ({
  completed: out.completedItems.length, linesDone: out.linesDone.length, goods: out.goodsMade.length,
  raids: out.raids.length, schedule: out.scheduleEvents.length,
  worldBuilds: out.worldBuildsDone.length,
});

/** File the news of the work one boundary did, at `t` (sim/commands.ts
 *  `applyDueAt`). Live and in replay alike: the boundary is the same. */
export function postBoundaryNews(state: GameState, t: number, out: AdvanceResult, from: NewsMark): void {
  for (const item of out.completedItems.slice(from.completed)) {
    const level = item.kind === 'build' ? 1 : item.targetLevel ?? 1;
    postNews(state, {
      group: 'built', key: `built:${item.districtUniqueId}:${level}`, at: Math.min(completesAt(item), t),
      district: item.districtUniqueId, level,
    });
  }
  // Not every soldier: the hall that has run out of them (§4).
  for (const l of out.linesDone.slice(from.linesDone)) {
    postNews(state, {
      group: 'trained', key: `trained:${l.buildingId}:${l.at}`, at: Math.min(l.at, t), district: l.buildingId, unit: l.unit,
    });
  }
  const goods = new Map<string, { good: GoodId; count: number }>();
  for (const g of out.goodsMade.slice(from.goods)) {
    const was = goods.get(g.districtUniqueId);
    goods.set(g.districtUniqueId, { good: g.good, count: (was?.count ?? 0) + 1 });
  }
  for (const [district, g] of goods) {
    postNews(state, { group: 'goods', key: `goods:${district}:${t}`, at: t, district, good: g.good, count: g.count });
  }
  for (const r of out.raids.slice(from.raids)) {
    if (Object.keys(r.took).length === 0) continue;
    postNews(state, { group: 'raided', key: `raided:${r.lairId}:${r.at}`, at: r.at, lair: r.lairId, took: r.took });
  }
  for (const e of out.scheduleEvents.slice(from.schedule)) {
    if (e.transition !== 'opened') continue;
    postNews(state, {
      group: 'event', key: `event:${e.entryId}:${t}`, at: t, entry: e.entryId, title: e.title, detail: e.detail,
    });
  }
  for (const b of out.worldBuildsDone.slice(from.worldBuilds)) {
    postNews(state, {
      group: 'worldBuild', key: `worldBuild:${b.index}:${b.what}:${b.level}`, at: Math.min(b.finishesAt, t),
      hex: b.index, what: b.what, level: b.level,
    });
  }
}
