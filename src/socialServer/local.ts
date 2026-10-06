// THE LOCAL SOCIAL SERVER — a stand-in for the `social` edge function, in the
// browser, the way worldServer/local.ts stands in for the world's.
//
// It answers through `serveSocial`, the one function the real server runs,
// over tables kept under their own key. With no other players in a browser,
// it peoples them: a dozen made-up kingdoms that are found, suggested, ask
// the player to be friends and answer the player's requests a little later
// — all but one, who never does, so a request left waiting can be seen.

import { FRIENDS } from '../sim/data/definitions';
import { randInt } from '../sim/rng';
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

/** The one who never answers a request. */
const SHY = 'Greywater';
/** The two who ask the player first, the moment the player has a name. */
const EAGER = ['Foxhollow', 'Elderglen'];

const botId = (name: string) => `bot:${name}`;

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
    if (next !== undefined && t.profiles[me] !== undefined) t.requests[`${next}>${me}`] = now;
    this.store.save(t);
  }

  /** The tables, peopled the first time. */
  private tables(now: number): LocalTables {
    const t: LocalTables = this.store.load() ?? emptyTables();
    for (const p of PEOPLE) {
      const id = botId(p.name);
      t.profiles[id] ??= { userId: id, nickname: p.name, code: friendCodeFor(id, 0), townhall: p.townhall, cells: p.cells, seenAt: null };
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
    if (t.profiles[me] === undefined) return;
    const store = memorySocial(t);
    if (!(t.askedFirst ?? []).includes(me)) {
      t.askedFirst = [...(t.askedFirst ?? []), me]; // they ask once
      for (const name of EAGER) {
        const id = botId(name);
        if (t.friendships[`${id}>${me}`] === undefined) await store.addRequest(id, me, now);
      }
    }
    for (const { id, at } of (await store.links(me)).outgoing) {
      if (!id.startsWith('bot:') || id === botId(SHY)) continue;
      if (now < at + 15_000 + randInt(0x50c1a1, 45_000, 'answer', id)) continue;
      // The same cap as anyone's: a yes that would overfill either list is
      // a request dropped.
      if (await store.befriend(id, me, FRIENDS.max, now) !== 'ok') await store.dropRequest(me, id);
    }
  }
}
