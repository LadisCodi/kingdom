// THE SOCIAL SERVER'S ONE DOOR (Docs/features/15-social.md §2.1): the friends
// list. One request from one signed-in player, against profiles and links
// kept in a database. The `social` edge function is only the glue around this
// — who the user is, the tables, the clock — and the local stand-in
// (local.ts) answers through the same function, so the two cannot drift.
//
// The rules hold here, not in the client: the cap on friends and on requests
// waiting, who may be asked, by what name. Every command is
// idempotent by what it says — asking twice is one request, accepting twice
// is one friendship — so a retry needs no command id.

import { FRIENDS } from '../sim/data/definitions';
import { parseCrest } from '../sim/crest';
import { randInt } from '../sim/rng';
import { nicknameProblem, normalNickname } from '../worldServer/nickname';
import type {
  KingdomView, MessageKind, RequestState, RequestView, SocialCommand, SocialCommandKind, SocialProgress, SocialRefusal, SocialReply,
  SocialSnapshot,
} from './types';

/** A player's row: who they are to everyone else. */
export interface ProfileRow {
  userId: string;
  nickname: string;
  /** Their friend code; null until the social server first hands one out. */
  code: string | null;
  townhall: number;
  cells: number;
  crest: string | null;
  seenAt: number | null;
}

/** A request between two players, by user id. */
export interface RequestRow { id: string; at: number }

/** A message in one player's Inbox. Its id is unique in that Inbox and says
 *  what it is about, so the same request is the same message: `req:<from>`
 *  for a request, `acc:`/`dec:<from>:<at>` for an answer. */
export interface MessageRow {
  userId: string;
  id: string;
  kind: MessageKind;
  fromId: string;
  at: number;
  readAt: number | null;
  state: RequestState | null;
}

/** Where profiles and links live: tables on the server, maps in the tests
 *  and in the stand-in. */
export interface SocialStore {
  profile(userId: string): Promise<ProfileRow | null>;
  profilesOf(userIds: readonly string[]): Promise<ProfileRow[]>;
  byCode(code: string): Promise<ProfileRow | null>;
  /** The player with exactly this nickname, whatever its case. */
  byNickname(nickname: string): Promise<ProfileRow | null>;
  /** Reserve a nickname: the one the player already has if any, else this
   *  one; null if another player has it, whatever its case. The world
   *  server's `claimNickname` — one name for both. */
  claimNickname(userId: string, nickname: string): Promise<string | null>;
  /** Give a player their code; false if another player has it. */
  setCode(userId: string, code: string): Promise<boolean>;
  /** The player is here, this far on. */
  touch(userId: string, progress: SocialProgress, now: number): Promise<void>;
  links(userId: string): Promise<{ friends: string[]; incoming: RequestRow[]; outgoing: RequestRow[] }>;
  /** A request from one to the other; nothing if it is already there. */
  addRequest(from: string, to: string, now: number): Promise<void>;
  dropRequest(from: string, to: string): Promise<void>;
  /** Make two players friends and drop the requests between them, as one —
   *  unless either already has `max` friends. Already friends is 'ok'. */
  befriend(a: string, b: string, max: number, now: number): Promise<'ok' | 'full' | 'theirFull'>;
  unfriend(a: string, b: string): Promise<void>;
  /** Players lately in the game, most recent first. */
  recentlySeen(since: number, limit: number): Promise<ProfileRow[]>;
  /** The other players seated on the player's world board. */
  boardmates(userId: string): Promise<string[]>;
  /** A player's Inbox, in no order. */
  messagesOf(userId: string): Promise<MessageRow[]>;
  /** Write a message, replacing one with its id in that Inbox. */
  putMessage(row: MessageRow): Promise<void>;
  /** Change a message, if it is there. */
  patchMessage(userId: string, id: string, patch: { readAt?: number; state?: RequestState }): Promise<void>;
  dropMessages(userId: string, ids: readonly string[]): Promise<void>;
}

export type SocialServed =
  | { status: 200; reply: SocialReply }
  | { status: 400; error: string };

const KINDS: ReadonlySet<SocialCommandKind> = new Set<SocialCommandKind>([
  'hello', 'name', 'request', 'accept', 'decline', 'cancel', 'remove', 'read', 'deleteRead',
]);

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** How far back a player counts as lately in the game, for suggestions. */
const RECENT_MS = 14 * DAY;

// ------------------------------------------------------------ friend codes

/** The letters a code is made of: no 0/O or 1/I to misread. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A player's code on its `attempt`th try: eight letters, read in two
 *  fours — "K7QD-M2XA". Derived from the user id, so it is the same on
 *  every server that hands it out. */
export function friendCodeFor(userId: string, attempt: number): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CODE_LETTERS[randInt(0x5eed, CODE_LETTERS.length, 'friendCode', userId, attempt, i)];
    if (i === 3) out += '-';
  }
  return out;
}

/** What a player typed, as a code if it can be one: case, spaces and the
 *  dash do not matter. */
export function normalCode(raw: string): string | null {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (bare.length !== 8 || [...bare].some((c) => !CODE_LETTERS.includes(c))) return null;
  return `${bare.slice(0, 4)}-${bare.slice(4)}`;
}

// ------------------------------------------------------------ the request

/** The shape of a request, checked before anything reads it. */
export function badSocialBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return 'not an object';
  const cmd = (body as { cmd?: unknown }).cmd as Record<string, unknown> | null | undefined;
  if (cmd === null || typeof cmd !== 'object' || !KINDS.has(cmd.kind as SocialCommandKind)) return 'cmd';
  const short = (v: unknown, n: number) => typeof v === 'string' && v.length <= n;
  switch (cmd.kind as SocialCommandKind) {
    case 'hello': {
      const p = cmd.progress as Record<string, unknown> | null;
      if (p === null || typeof p !== 'object') return 'progress';
      const count = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
      if (!count(p.townhall, 100) || !count(p.cells, 1_000_000)) return 'progress';
      if (p.crest !== undefined && p.crest !== null && parseCrest(p.crest) === null) return 'crest';
      return null;
    }
    case 'name': return short(cmd.nickname, 64) ? null : 'nickname';
    case 'request': return short(cmd.target, 64) ? null : 'target';
    case 'read':
      return Array.isArray(cmd.ids) && cmd.ids.length <= 100 && cmd.ids.every((id) => short(id, 128)) ? null : 'ids';
    case 'deleteRead': return null;
    default: return short(cmd.code, 32) ? null : 'code';
  }
}

/** Answer one player's request at the server's `now`. */
export async function serveSocial(store: SocialStore, userId: string, body: unknown, now: number): Promise<SocialServed> {
  const bad = badSocialBody(body);
  if (bad !== null) return { status: 400, error: `bad request: ${bad}` };
  const cmd = (body as { cmd: SocialCommand }).cmd;
  return { status: 200, reply: await answer(store, userId, cmd, now) };
}

async function answer(store: SocialStore, userId: string, cmd: SocialCommand, now: number): Promise<SocialReply> {
  if (cmd.kind === 'name') {
    if (await store.profile(userId) === null) {
      if (nicknameProblem(cmd.nickname) !== null) return refused('BadNickname', null);
      if (await store.claimNickname(userId, normalNickname(cmd.nickname)) === null) return refused('NicknameTaken', null);
    }
    return { ok: true, snapshot: await snapshotFor(store, userId, now) };
  }
  const me = await store.profile(userId);
  if (me === null) {
    // No nickname yet: nobody can find the player, and they can do nothing
    // but take one (§2.1, the first visit).
    const empty: SocialSnapshot = { at: now, me: null, friends: [], incoming: [], outgoing: [], suggestions: [], inbox: [] };
    return cmd.kind === 'hello' ? { ok: true, snapshot: empty } : refused('NoName', empty);
  }
  await expire(store, userId, now);
  if (cmd.kind === 'hello') {
    await store.touch(userId, cmd.progress, now);
    return { ok: true, snapshot: await snapshotFor(store, userId, now) };
  }
  if (cmd.kind === 'read') {
    const mine = new Map((await store.messagesOf(userId)).map((m) => [m.id, m]));
    for (const id of cmd.ids) {
      const m = mine.get(id);
      // A request waiting for an answer stays new until it is answered.
      if (m !== undefined && m.readAt === null && m.state !== 'pending') await store.patchMessage(userId, id, { readAt: now });
    }
    return { ok: true, snapshot: await snapshotFor(store, userId, now) };
  }
  if (cmd.kind === 'deleteRead') {
    const read = (await store.messagesOf(userId)).filter((m) => m.readAt !== null && m.state !== 'pending');
    await store.dropMessages(userId, read.map((m) => m.id));
    return { ok: true, snapshot: await snapshotFor(store, userId, now) };
  }
  let them: ProfileRow | null;
  if (cmd.kind === 'request') {
    // A friend code, else a nickname as typed — whole, whatever its case.
    const code = normalCode(cmd.target);
    them = code === null ? null : await store.byCode(code);
    if (them === null && nicknameProblem(cmd.target) === null) them = await store.byNickname(normalNickname(cmd.target));
  } else {
    const code = normalCode(cmd.code);
    them = code === null ? null : await store.byCode(code);
  }
  const done = async (why: SocialRefusal | null): Promise<SocialReply> => {
    const snapshot = await snapshotFor(store, userId, now);
    if (why !== null) return refused(why, snapshot);
    return cmd.kind === 'request' && them !== null ? { ok: true, snapshot, to: await viewOf(store, them) } : { ok: true, snapshot };
  };
  if (them === null) return done('NotFound');
  const other = them.userId;
  if (other === userId) return done('Self');
  const mine = await store.links(userId);
  const isFriend = mine.friends.includes(other);
  const asked = mine.incoming.some((r) => r.id === other);
  const asking = mine.outgoing.some((r) => r.id === other);
  /** The player says yes to their request: friends, the request message
   *  answered, and the asker told. */
  const accept = async (): Promise<SocialReply> => {
    const r = befriended(await store.befriend(userId, other, FRIENDS.max, now));
    if (r === null) await answered(store, userId, other, 'accepted', now);
    return done(r);
  };
  switch (cmd.kind) {
    case 'request': {
      if (isFriend) return done('AlreadyFriends');
      // They asked first: asking back is saying yes.
      if (asked) return accept();
      if (asking) return done(null);
      if (mine.friends.length >= FRIENDS.max) return done('Full');
      if (mine.outgoing.length >= FRIENDS.maxSent) return done('TooManySent');
      if ((await store.links(other)).friends.length >= FRIENDS.max) return done('TheirFull');
      await store.addRequest(userId, other, now);
      // It lands in their Inbox too; sending one writes nothing to the
      // sender's (§2.3).
      await store.putMessage({ userId: other, id: `req:${userId}`, kind: 'request', fromId: userId, at: now, readAt: null, state: 'pending' });
      return done(null);
    }
    case 'accept':
      if (isFriend) return done(null);
      if (!asked) return done('NotFound');
      return accept();
    case 'decline':
      if (!asked) return done(null);
      await store.dropRequest(other, userId);
      await answered(store, userId, other, 'declined', now);
      return done(null);
    case 'cancel':
      if (!asking) return done(null);
      await store.dropRequest(userId, other);
      await store.dropMessages(other, [`req:${userId}`]);
      return done(null);
    case 'remove':
      await store.unfriend(userId, other);
      return done(null);
  }
}

/** A request answered: the player's message says how, and is read; the
 *  asker gets a message of their own. */
async function answered(store: SocialStore, userId: string, asker: string, how: 'accepted' | 'declined', now: number): Promise<void> {
  await store.patchMessage(userId, `req:${asker}`, { state: how, readAt: now });
  await store.putMessage({
    userId: asker, id: `${how === 'accepted' ? 'acc' : 'dec'}:${userId}:${now}`, kind: how, fromId: userId,
    at: now, readAt: null, state: null,
  });
}

/** Requests past their hours go, both ways, and the request message says
 *  it expired; messages past their days go. Run on every call, for the
 *  player's own: the other side tidies its own on its own calls. */
async function expire(store: SocialStore, userId: string, now: number): Promise<void> {
  const due = (at: number) => at + FRIENDS.requestHours * HOUR <= now;
  const links = await store.links(userId);
  for (const r of links.incoming.filter((x) => due(x.at))) {
    await store.dropRequest(r.id, userId);
    await store.patchMessage(userId, `req:${r.id}`, { state: 'expired' });
  }
  for (const r of links.outgoing.filter((x) => due(x.at))) {
    await store.dropRequest(userId, r.id);
    await store.patchMessage(r.id, `req:${userId}`, { state: 'expired' });
  }
  const old = (await store.messagesOf(userId)).filter((m) => m.at + FRIENDS.messageDays * DAY <= now);
  if (old.length > 0) await store.dropMessages(userId, old.map((m) => m.id));
}

const befriended = (r: 'ok' | 'full' | 'theirFull'): SocialRefusal | null =>
  r === 'ok' ? null : r === 'full' ? 'Full' : 'TheirFull';

const refused = (why: SocialRefusal, snapshot: SocialSnapshot | null): SocialReply => ({ ok: false, why, snapshot });

/** Everything the friends screen shows, as it stands. */
async function snapshotFor(store: SocialStore, userId: string, now: number): Promise<SocialSnapshot> {
  const me = await store.profile(userId);
  if (me === null) return { at: now, me: null, friends: [], incoming: [], outgoing: [], suggestions: [], inbox: [] };
  const links = await store.links(userId);
  const messages = await store.messagesOf(userId);
  const taken = new Set([userId, ...links.friends, ...links.incoming.map((r) => r.id), ...links.outgoing.map((r) => r.id)]);
  const ids = [...new Set([...taken, ...messages.map((m) => m.fromId)])].filter((id) => id !== userId);
  const rows = new Map((await store.profilesOf(ids)).map((r) => [r.userId, r]));

  const view = (id: string) => rows.get(id);
  const asRequest = async (r: RequestRow): Promise<RequestView | null> => {
    const row = view(r.id);
    return row === undefined ? null : { ...await viewOf(store, row), at: r.at };
  };
  const newestFirst = (list: RequestRow[]) => [...list].sort((a, b) => b.at - a.at);
  const present = <T>(list: Array<T | null>): T[] => list.filter((x): x is T => x !== null);

  const friends = await Promise.all(links.friends.map((id) => view(id)).filter((r): r is ProfileRow => r !== undefined)
    .map((r) => viewOf(store, r)));
  const incoming = present(await Promise.all(newestFirst(links.incoming).map(asRequest)));
  const outgoing = present(await Promise.all(newestFirst(links.outgoing).map(asRequest)));
  // Suggestions only fill the requests list up to its rows, and never past
  // the room left for friends (§2.1).
  const room = Math.min(
    FRIENDS.requestRows - incoming.length - outgoing.length,
    FRIENDS.max - friends.length - outgoing.length,
  );
  const inbox = present(await Promise.all([...messages].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).map(async (m) => {
    const row = view(m.fromId);
    if (row === undefined) return null;
    const expiresAt = m.state === 'pending' ? m.at + FRIENDS.requestHours * HOUR : m.at + FRIENDS.messageDays * DAY;
    return { id: m.id, kind: m.kind, from: await viewOf(store, row), at: m.at, readAt: m.readAt, state: m.state, expiresAt };
  })));
  return {
    at: now,
    me: await viewOf(store, me),
    friends,
    incoming,
    outgoing,
    suggestions: room > 0 ? await suggest(store, me, taken, now, room) : [],
    inbox,
  };
}

/** Kingdoms the player might ask: their world board's other players first,
 *  then whoever was lately in the game nearest their own Townhall. */
async function suggest(
  store: SocialStore, me: ProfileRow, taken: ReadonlySet<string>, now: number, count: number,
): Promise<KingdomView[]> {
  const mates = new Set(await store.boardmates(me.userId));
  const recent = await store.recentlySeen(now - RECENT_MS, 40);
  const rows = new Map<string, ProfileRow>();
  for (const r of await store.profilesOf([...mates])) rows.set(r.userId, r);
  for (const r of recent) rows.set(r.userId, r);
  const picked = [...rows.values()]
    .filter((r) => !taken.has(r.userId))
    .sort((a, b) =>
      Number(mates.has(b.userId)) - Number(mates.has(a.userId))
      || Math.abs(a.townhall - me.townhall) - Math.abs(b.townhall - me.townhall)
      || (b.seenAt ?? 0) - (a.seenAt ?? 0)
      || a.userId.localeCompare(b.userId))
    .slice(0, count);
  return Promise.all(picked.map((r) => viewOf(store, r)));
}

/** A player as others see them — handing them their code the first time
 *  anyone needs it, so a kingdom that only ever went out onto the world
 *  board can still be found and asked. */
async function viewOf(store: SocialStore, row: ProfileRow): Promise<KingdomView> {
  let code = row.code;
  for (let attempt = 0; code === null && attempt < 16; attempt++) {
    const next = friendCodeFor(row.userId, attempt);
    if (await store.setCode(row.userId, next)) code = next;
  }
  row.code = code;
  return {
    code: code ?? '', nickname: row.nickname, townhall: row.townhall, cells: row.cells, crest: row.crest, seenAt: row.seenAt,
  };
}

// ------------------------------------------------------------ in memory

/** The tables, as maps: what the tests and the stand-in keep. */
export interface SocialTables {
  profiles: Record<string, ProfileRow>;
  /** `from>to` → when. */
  requests: Record<string, number>;
  /** `a>b`, both ways → since when. */
  friendships: Record<string, number>;
  /** A player's world board, for suggestions. */
  boards: Record<string, string>;
  /** Each player's Inbox, by message id. */
  messages: Record<string, Record<string, MessageRow>>;
}

export const emptyTables = (): SocialTables => ({ profiles: {}, requests: {}, friendships: {}, boards: {}, messages: {} });

/** A store over tables in memory. */
export function memorySocial(t: SocialTables = emptyTables()): SocialStore & { tables: SocialTables } {
  const pair = (a: string, b: string) => `${a}>${b}`;
  const ends = (key: string) => key.split('>') as [string, string];
  const friendsOf = (id: string) => Object.keys(t.friendships).map(ends).filter(([a]) => a === id).map(([, b]) => b);
  const copy = (r: ProfileRow | undefined) => (r === undefined ? null : { ...r });
  return {
    tables: t,
    async profile(id) { return copy(t.profiles[id]); },
    async profilesOf(ids) { return ids.map((id) => copy(t.profiles[id])).filter((r): r is ProfileRow => r !== null); },
    async byCode(code) { return copy(Object.values(t.profiles).find((r) => r.code === code)); },
    async byNickname(nickname) {
      const lower = nickname.toLowerCase();
      return copy(Object.values(t.profiles).find((r) => r.nickname.toLowerCase() === lower));
    },
    async claimNickname(id, nickname) {
      const mine = t.profiles[id];
      if (mine !== undefined) return mine.nickname;
      const lower = nickname.toLowerCase();
      if (Object.values(t.profiles).some((r) => r.nickname.toLowerCase() === lower)) return null;
      t.profiles[id] = { userId: id, nickname, code: null, townhall: 1, cells: 0, crest: null, seenAt: null };
      return nickname;
    },
    async setCode(id, code) {
      if (Object.values(t.profiles).some((r) => r.code === code && r.userId !== id)) return false;
      if (t.profiles[id] !== undefined) t.profiles[id].code = code;
      return true;
    },
    async touch(id, progress, now) {
      const r = t.profiles[id];
      if (r === undefined) return;
      r.townhall = progress.townhall;
      r.cells = progress.cells;
      if (progress.crest !== undefined) r.crest = progress.crest;
      r.seenAt = now;
    },
    async links(id) {
      const reqs = Object.entries(t.requests).map(([k, at]) => [...ends(k), at] as const);
      return {
        friends: friendsOf(id),
        incoming: reqs.filter(([, to]) => to === id).map(([from, , at]) => ({ id: from, at })),
        outgoing: reqs.filter(([from]) => from === id).map(([, to, at]) => ({ id: to, at })),
      };
    },
    async addRequest(from, to, now) { t.requests[pair(from, to)] ??= now; },
    async dropRequest(from, to) { delete t.requests[pair(from, to)]; },
    async befriend(a, b, max, now) {
      if (t.friendships[pair(a, b)] === undefined) {
        if (friendsOf(a).length >= max) return 'full';
        if (friendsOf(b).length >= max) return 'theirFull';
        t.friendships[pair(a, b)] = now;
        t.friendships[pair(b, a)] = now;
      }
      delete t.requests[pair(a, b)];
      delete t.requests[pair(b, a)];
      return 'ok';
    },
    async unfriend(a, b) {
      delete t.friendships[pair(a, b)];
      delete t.friendships[pair(b, a)];
    },
    async recentlySeen(since, limit) {
      return Object.values(t.profiles).filter((r) => (r.seenAt ?? -Infinity) >= since)
        .sort((a, b) => (b.seenAt ?? 0) - (a.seenAt ?? 0)).slice(0, limit).map((r) => ({ ...r }));
    },
    async boardmates(id) {
      const board = t.boards[id];
      return board === undefined ? [] : Object.keys(t.boards).filter((u) => u !== id && t.boards[u] === board);
    },
    async messagesOf(id) { return Object.values((t.messages ??= {})[id] ?? {}).map((m) => ({ ...m })); },
    async putMessage(row) { ((t.messages ??= {})[row.userId] ??= {})[row.id] = { ...row }; },
    async patchMessage(id, msg, patch) {
      const m = (t.messages ??= {})[id]?.[msg];
      if (m !== undefined) Object.assign(m, patch);
    },
    async dropMessages(id, ids) {
      const box = (t.messages ??= {})[id];
      if (box !== undefined) for (const m of ids) delete box[m];
    },
  };
}
