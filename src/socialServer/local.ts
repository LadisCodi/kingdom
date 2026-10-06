// THE LOCAL SOCIAL SERVER — a stand-in for the `social` edge function, in the
// browser, the way worldServer/local.ts stands in for the world's.
//
// It answers through `serveSocial`, the one function the real server runs,
// over tables kept under their own key. With no other players in a browser,
// it peoples them: a dozen made-up kingdoms that are found, suggested, ask
// the player to be friends and answer the player's requests a little later
// — one says no, so a declined request can be seen, and one never answers,
// so a request left waiting can be. On the wish board they keep a wish up
// each, and a friend among them fills the player's within a minute or two.
// They act through `serveSocial` like any player, so what they do lands in
// the player's Inbox as it would. Each friend among them helps the player
// once a day.

import { ARTIFACT_ORDER } from '../sim/data/definitions';
import { randInt } from '../sim/rng';
import type { TradeLot } from '../sim/trade';
import { emptyTables, friendCodeFor, memorySocial, serveSocial, type SocialTables } from './serve';
import type { SocialCommand, SocialReply } from './types';

/** What the client asks of the social server. Never throws: a request that
 *  cannot get through is refused as Offline. */
export interface SocialServerApi {
  send(cmd: SocialCommand): Promise<SocialReply>;
  /** Dev only: one of the stand-in's kingdoms asks the player to be friends. */
  devAsk?(): Promise<void>;
}

/** Where the stand-in keeps its tables. */
export interface SocialTablesStore {
  load(): SocialTables | null;
  save(t: SocialTables): void;
}

export const LOCAL_SOCIAL_KEY = 'kingdom.socialServer';

export const browserSocialStore = (): SocialTablesStore => ({
  load() {
    try {
      const raw = localStorage.getItem(LOCAL_SOCIAL_KEY);
      return raw === null ? null : JSON.parse(raw) as SocialTables;
    } catch {
      return null;
    }
  },
  save(t) {
    try { localStorage.setItem(LOCAL_SOCIAL_KEY, JSON.stringify(t)); } catch { /* private window */ }
  },
});

/** The made-up kingdoms: a name, a Townhall, cells revealed, and how long
 *  ago each was last in the game. */
const PEOPLE: ReadonlyArray<{ name: string; townhall: number; cells: number; awayMin: number }> = [
  { name: 'Aldermoor', townhall: 4, cells: 310, awayMin: 2 },
  { name: 'Briarwick', townhall: 2, cells: 95, awayMin: 50 },
  { name: 'Cindervale', townhall: 6, cells: 640, awayMin: 60 * 20 },
  { name: 'Dunmere', townhall: 1, cells: 30, awayMin: 60 * 30 },
  { name: 'Elderglen', townhall: 3, cells: 210, awayMin: 60 * 24 * 3 },
  { name: 'Foxhollow', townhall: 5, cells: 480, awayMin: 5 },
  { name: 'Greywater', townhall: 2, cells: 120, awayMin: 60 * 24 * 12 },
  { name: 'Hollowmere', townhall: 7, cells: 820, awayMin: 60 * 24 * 40 },
  { name: 'Ivybridge', townhall: 3, cells: 180, awayMin: 60 * 5 },
  { name: 'Juniper Keep', townhall: 1, cells: 45, awayMin: 60 * 24 * 70 },
  { name: 'Kestrel Rock', townhall: 8, cells: 990, awayMin: 15 },
  { name: 'Larkspur', townhall: 4, cells: 350, awayMin: 60 * 24 * 6 },
];

/** The one who never answers a request, and the one who says no. */
const SHY = 'Greywater';
const GRUMPY = 'Dunmere';
/** The two who ask the player first, the moment the player has a name. */
const EAGER = ['Foxhollow', 'Elderglen'];

const botId = (name: string) => `bot:${name}`;

/** What each made-up kingdom keeps wishing for on the wish board (§2.4):
 *  pinned again whenever the last one is filled or ends. */
const WISHES: Record<string, { need: TradeLot; give: TradeLot }> = {
  Foxhollow: { need: { kind: 'material', id: 'Heartwood' }, give: { kind: 'material', id: 'Moonglass' } },
  Elderglen: { need: { kind: 'material', id: 'Starmetal' }, give: { kind: 'fragment', relic: ARTIFACT_ORDER[0], slot: 1 } },
  Aldermoor: { need: { kind: 'fragment', relic: ARTIFACT_ORDER[1], slot: 2 }, give: { kind: 'material', id: 'Heartwood' } },
  'Kestrel Rock': {
    need: { kind: 'fragment', relic: ARTIFACT_ORDER[2], slot: 5 }, give: { kind: 'fragment', relic: ARTIFACT_ORDER[3], slot: 5 },
  },
};

/** The stand-in's tables, and who has been asked by the eager two. */
type LocalTables = SocialTables & { askedFirst?: string[] };

export class LocalSocialServer implements SocialServerApi {
  constructor(
    private store: SocialTablesStore,
    private playerId: () => string,
    private clock: () => number = () => Date.now(),
  ) {}

  async send(cmd: SocialCommand): Promise<SocialReply> {
    const now = this.clock();
    const t = this.tables(now);
    await this.play(t, now);
    const r = await serveSocial(memorySocial(t), this.playerId(), { cmd }, now);
    await this.play(t, now);
    this.store.save(t);
    if (r.status !== 200) return { ok: false, why: 'Offline', snapshot: null };
    return r.reply;
  }

  async devAsk(): Promise<void> {
    const now = this.clock();
    const t = this.tables(now);
    const me = this.playerId();
    const linked = (id: string) => t.friendships[`${id}>${me}`] !== undefined
      || t.requests[`${id}>${me}`] !== undefined || t.requests[`${me}>${id}`] !== undefined;
    const next = PEOPLE.map((p) => botId(p.name)).find((id) => !linked(id));
    const code = t.profiles[me]?.code;
    if (next !== undefined && code) await serveSocial(memorySocial(t), next, { cmd: { kind: 'request', target: code } }, now);
    this.store.save(t);
  }

  /** The tables, peopled the first time. */
  private tables(now: number): LocalTables {
    const t: LocalTables = this.store.load() ?? emptyTables();
    for (const p of PEOPLE) {
      const id = botId(p.name);
      t.profiles[id] ??= {
        userId: id, nickname: p.name, code: friendCodeFor(id, 0), townhall: p.townhall, cells: p.cells, crest: null, seenAt: null,
      };
      t.profiles[id].crest ??= null; // tables kept from before crests
      // Each keeps its own distance from now, so a week-old absence stays a
      // week old however long the stand-in has been kept.
      t.profiles[id].seenAt = now - p.awayMin * 60_000;
    }
    return t;
  }

  /** The made-up kingdoms' turn: two ask the player once they can be found,
   *  and each answers a request after its own short while. */
  private async play(t: LocalTables, now: number): Promise<void> {
    const me = this.playerId();
    const code = t.profiles[me]?.code;
    if (!code) return;
    const store = memorySocial(t);
    const as = (bot: string, cmd: SocialCommand) => serveSocial(store, bot, { cmd }, now);
    if (!(t.askedFirst ?? []).includes(me)) {
      t.askedFirst = [...(t.askedFirst ?? []), me]; // they ask once
      for (const name of EAGER) await as(botId(name), { kind: 'request', target: code });
    }
    for (const { id, at } of (await store.links(me)).outgoing) {
      if (!id.startsWith('bot:') || id === botId(SHY)) continue;
      if (now < at + 15_000 + randInt(0x50c1a1, 45_000, 'answer', id)) continue;
      // The same cap as anyone's: a yes that would overfill either list is
      // refused, and the request then declined.
      const yes = id !== botId(GRUMPY) && (await as(id, { kind: 'accept', code })).status === 200
        && !(await store.links(me)).outgoing.some((r) => r.id === id);
      if (!yes) await as(id, { kind: 'decline', code });
    }
    // The wish board: each keeps its wish up, and a friend among them fills
    // a wish of the player's after a little while.
    for (const [name, wish] of Object.entries(WISHES)) {
      const id = botId(name);
      if ((await store.openWishes([id])).length === 0) await as(id, { kind: 'pinWish', ...wish });
    }
    const friends = (await store.links(me)).friends.filter((id) => id.startsWith('bot:') && id !== botId(SHY));
    for (const w of await store.openWishes([me])) {
      const by = friends[randInt(0x50c1a1, Math.max(1, friends.length), 'fill', w.id)];
      if (by === undefined || now < w.at + 30_000 + randInt(0x50c1a1, 60_000, 'fillAt', w.id)) continue;
      await as(by, { kind: 'fillWish', id: w.id });
    }
    // Daily help (§3): each friend among them helps the player once a day,
    // a little while after they became friends; the server refuses a second.
    for (const id of friends) {
      const since = t.friendships[`${id}>${me}`] ?? now;
      if (now < since + 20_000 + randInt(0x50c1a1, 40_000, 'help', id)) continue;
      if ((await store.helpsSince(id, now - 24 * 3_600_000)).some((h) => h.to === me)) continue;
      await as(id, { kind: 'help', code });
    }
  }
}
