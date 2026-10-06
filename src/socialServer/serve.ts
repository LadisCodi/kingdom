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

import { FRIEND_HELP, FRIENDS, TRADE } from '../sim/data/definitions';
import { parseCrest } from '../sim/crest';
import { randInt } from '../sim/rng';
import { nicknameProblem, normalNickname } from '../worldServer/nickname';
import { lotKey, pairs, validLot, type TradeLot } from '../sim/trade';
import type {
  DeliveryView, GiftLot, KingdomView, MessageKind, RequestState, RequestView, SocialCommand, SocialCommandKind, SocialProgress, SocialRefusal, SocialReply,
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
  /** A trade's: what this player got and gave. */
  lots?: { got: TradeLot; gave: TradeLot | null } | null;
}

/** A wish on the board (§2.4). `give` is held by the server while it is
 *  open; it ends filled, withdrawn or expired. */
export interface WishRow {
  id: string;
  userId: string;
  need: TradeLot;
  give: TradeLot;
  at: number;
  state: 'open' | 'filled' | 'withdrawn' | 'expired';
  filledBy: string | null;
  filledAt: number | null;
}

/** Goods owed to one player, numbered in the order they were owed. */
export interface DeliveryRow { userId: string; seq: number; lot: TradeLot | GiftLot; why: DeliveryView['why'] }

/** One friend helped by one player (§3). */
export interface HelpRow { from: string; to: string; at: number }

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
  /** Open wishes of these players. */
  openWishes(userIds: readonly string[]): Promise<WishRow[]>;
  addWish(row: WishRow): Promise<void>;
  /** End an open wish, as one: false if it is no longer open — someone
   *  else ended it first. */
  closeWish(id: string, end: Pick<WishRow, 'state' | 'filledBy' | 'filledAt'>): Promise<WishRow | null>;
  /** How many wishes this player has filled since `since`. */
  fillsSince(userId: string, since: number): Promise<number>;
  /** Owe a player a lot; the next number in their queue. */
  deliver(userId: string, lot: TradeLot | GiftLot, why: DeliveryRow['why']): Promise<void>;
  /** The friends a player has helped since `since` (§3). */
  helpsSince(userId: string, since: number): Promise<HelpRow[]>;
  addHelp(row: HelpRow): Promise<void>;
  deliveriesOf(userId: string): Promise<DeliveryRow[]>;
  /** Forget what the player has applied: every delivery up to `seq`. */
  dropDeliveries(userId: string, upTo: number): Promise<void>;
}

export type SocialServed =
  | { status: 200; reply: SocialReply }
  | { status: 400; error: string };

const KINDS: ReadonlySet<SocialCommandKind> = new Set<SocialCommandKind>([
  'hello', 'name', 'request', 'accept', 'decline', 'cancel', 'remove', 'read', 'deleteRead',
  'pinWish', 'withdrawWish', 'fillWish', 'help',
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
      if (p.ack !== undefined && !Number.isInteger(p.ack)) return 'ack';
      return null;
    }
    case 'name': return short(cmd.nickname, 64) ? null : 'nickname';
    case 'request': return short(cmd.target, 64) ? null : 'target';
    case 'read':
      return Array.isArray(cmd.ids) && cmd.ids.length <= 100 && cmd.ids.every((id) => short(id, 128)) ? null : 'ids';
    case 'deleteRead': return null;
    case 'pinWish': return validLot(cmd.need) && validLot(cmd.give) ? null : 'lot';
    case 'withdrawWish': case 'fillWish': return short(cmd.id, 128) ? null : 'id';
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
    const empty = emptySnapshot(now);
    return cmd.kind === 'hello' ? { ok: true, snapshot: empty } : refused('NoName', empty);
  }
  await expire(store, userId, now);
  if (cmd.kind === 'hello') {
    await store.touch(userId, cmd.progress, now);
    if (cmd.progress.ack !== undefined) await store.dropDeliveries(userId, cmd.progress.ack);
    return { ok: true, snapshot: await snapshotFor(store, userId, now) };
  }
  if (cmd.kind === 'pinWish' || cmd.kind === 'withdrawWish' || cmd.kind === 'fillWish') {
    const why = await trade(store, userId, cmd, now);
    const snapshot = await snapshotFor(store, userId, now);
    return why === null ? { ok: true, snapshot } : refused(why, snapshot);
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
    case 'help': {
      // A friend, once in any 24 hours, within the helps left (§3).
      if (!isFriend) return done('NotFriends');
      const helped = await store.helpsSince(userId, now - DAY);
      if (helped.some((h) => h.to === other)) return done('AlreadyHelped');
      if (helped.length >= FRIEND_HELP.perDay) return done('NoHelpsLeft');
      await store.addHelp({ from: userId, to: other, at: now });
      await store.deliver(other, { kind: 'gift', item: FRIEND_HELP.giftItem }, 'helped');
      await store.putMessage({ userId: other, id: `help:${userId}:${now}`, kind: 'helped', fromId: userId, at: now, readAt: null, state: null });
      return done(null);
    }
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
  await expireWishes(store, userId, now);
}

// ------------------------------------------------------------ the wish board

/** A wish's end, as messages and deliveries. Every lot that lands on a
 *  player goes through `deliver`, so the client applies each exactly once. */
async function trade(
  store: SocialStore, userId: string,
  cmd: Extract<SocialCommand, { kind: 'pinWish' | 'withdrawWish' | 'fillWish' }>, now: number,
): Promise<SocialRefusal | null> {
  if (cmd.kind === 'pinWish') {
    if (!pairs(cmd.need, cmd.give)) return 'BadWish';
    const mine = await store.openWishes([userId]);
    if (mine.length >= TRADE.wishes) return 'TooManyWishes';
    if (mine.some((w) => lotKey(w.need) === lotKey(cmd.need))) return 'SameWish';
    await store.addWish({
      id: `w:${userId}:${now}:${mine.length}`, userId, need: cmd.need, give: cmd.give, at: now,
      state: 'open', filledBy: null, filledAt: null,
    });
    return null;
  }
  if (cmd.kind === 'withdrawWish') {
    const w = (await store.openWishes([userId])).find((x) => x.id === cmd.id);
    if (w === undefined) return 'WishGone';
    const ended = await store.closeWish(w.id, { state: 'withdrawn', filledBy: null, filledAt: null });
    if (ended !== null) await store.deliver(userId, ended.give, 'withdrawn');
    return null;
  }
  // Fill: a friend's open wish, within its hours, and the fills left.
  const links = await store.links(userId);
  const w = (await store.openWishes(links.friends)).find((x) => x.id === cmd.id)
    ?? (await store.openWishes([userId])).find((x) => x.id === cmd.id);
  if (w === undefined || w.at + TRADE.wishHours * HOUR <= now) return 'WishGone';
  if (w.userId === userId) return 'OwnWish';
  if (!links.friends.includes(w.userId)) return 'NotFriends';
  if (await store.fillsSince(userId, now - DAY) >= TRADE.fillsPerDay) return 'NoFillsLeft';
  const filled = await store.closeWish(w.id, { state: 'filled', filledBy: userId, filledAt: now });
  if (filled === null) return 'WishGone';
  await store.deliver(w.userId, w.need, 'filled');
  await store.deliver(userId, w.give, 'youFilled');
  await store.putMessage({
    userId: w.userId, id: `fill:${w.id}`, kind: 'wishFilled', fromId: userId, at: now, readAt: null, state: null,
    lots: { got: w.need, gave: w.give },
  });
  await store.putMessage({
    userId, id: `filled:${w.id}`, kind: 'filledWish', fromId: w.userId, at: now, readAt: now, state: null,
    lots: { got: w.give, gave: w.need },
  });
  return null;
}

/** The player's wishes past their hours: their stakes come back. */
async function expireWishes(store: SocialStore, userId: string, now: number): Promise<void> {
  for (const w of await store.openWishes([userId])) {
    if (w.at + TRADE.wishHours * HOUR > now) continue;
    const ended = await store.closeWish(w.id, { state: 'expired', filledBy: null, filledAt: null });
    if (ended === null) continue;
    await store.deliver(userId, ended.give, 'expired');
    await store.putMessage({
      userId, id: `exp:${w.id}`, kind: 'wishExpired', fromId: userId, at: now, readAt: null, state: null,
      lots: { got: ended.give, gave: null },
    });
  }
}

const befriended = (r: 'ok' | 'full' | 'theirFull'): SocialRefusal | null =>
  r === 'ok' ? null : r === 'full' ? 'Full' : 'TheirFull';

const refused = (why: SocialRefusal, snapshot: SocialSnapshot | null): SocialReply => ({ ok: false, why, snapshot });

const emptySnapshot = (now: number): SocialSnapshot => ({
  at: now, me: null, friends: [], incoming: [], outgoing: [], suggestions: [], inbox: [],
  wishes: [], friendWishes: [], fillsLeft: 0, deliveries: [], helped: [], helpsLeft: 0,
});

/** Everything the friends screen shows, as it stands. */
async function snapshotFor(store: SocialStore, userId: string, now: number): Promise<SocialSnapshot> {
  const me = await store.profile(userId);
  if (me === null) return emptySnapshot(now);
  const links = await store.links(userId);
  const messages = await store.messagesOf(userId);
  const standing = (w: WishRow) => w.at + TRADE.wishHours * HOUR > now;
  const myWishes = (await store.openWishes([userId])).sort((a, b) => a.at - b.at);
  const theirWishes = (await store.openWishes(links.friends)).filter(standing).sort((a, b) => b.at - a.at);
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
    // A wish that expired is the player's own news: it comes from them.
    const row = m.fromId === userId ? me : view(m.fromId);
    if (row === undefined) return null;
    const expiresAt = m.state === 'pending' ? m.at + FRIENDS.requestHours * HOUR : m.at + FRIENDS.messageDays * DAY;
    return {
      id: m.id, kind: m.kind, from: await viewOf(store, row), at: m.at, readAt: m.readAt, state: m.state, expiresAt,
      ...(m.lots ? { lots: m.lots } : {}),
    };
  })));
  const mine = await viewOf(store, me);
  const helps = await store.helpsSince(userId, now - DAY);
  const wishView = async (w: WishRow) => {
    const row = w.userId === userId ? me : view(w.userId);
    return row === undefined ? null : {
      id: w.id, owner: w.userId === userId ? mine : await viewOf(store, row), need: w.need, give: w.give,
      at: w.at, expiresAt: w.at + TRADE.wishHours * HOUR,
    };
  };
  return {
    at: now,
    me: mine,
    friends,
    incoming,
    outgoing,
    suggestions: room > 0 ? await suggest(store, me, taken, now, room) : [],
    inbox,
    wishes: present(await Promise.all(myWishes.map(wishView))),
    friendWishes: present(await Promise.all(theirWishes.map(wishView))),
    fillsLeft: Math.max(0, TRADE.fillsPerDay - await store.fillsSince(userId, now - DAY)),
    deliveries: (await store.deliveriesOf(userId)).sort((a, b) => a.seq - b.seq).map((d) => ({ seq: d.seq, lot: d.lot, why: d.why })),
    helped: helps.flatMap((h) => {
      const code = view(h.to)?.code;
      return code ? [{ code, at: h.at }] : [];
    }),
    helpsLeft: Math.max(0, FRIEND_HELP.perDay - helps.length),
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
  /** Every wish, by id. */
  wishes?: Record<string, WishRow>;
  /** Goods owed, by player; `seq` counts across all of them. */
  deliveries?: Record<string, DeliveryRow[]>;
  seq?: number;
  /** Every help given (§3). */
  helps?: HelpRow[];
}

export const emptyTables = (): SocialTables => ({
  profiles: {}, requests: {}, friendships: {}, boards: {}, messages: {}, wishes: {}, deliveries: {}, seq: 0,
});

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
    async openWishes(ids) {
      return Object.values(t.wishes ??= {}).filter((w) => w.state === 'open' && ids.includes(w.userId)).map((w) => ({ ...w }));
    },
    async addWish(row) { (t.wishes ??= {})[row.id] = { ...row }; },
    async closeWish(id, end) {
      const w = (t.wishes ??= {})[id];
      if (w === undefined || w.state !== 'open') return null;
      Object.assign(w, end);
      return { ...w };
    },
    async fillsSince(id, since) {
      return Object.values(t.wishes ??= {}).filter((w) => w.filledBy === id && (w.filledAt ?? 0) > since).length;
    },
    async helpsSince(id, since) { return (t.helps ?? []).filter((h) => h.from === id && h.at > since).map((h) => ({ ...h })); },
    async addHelp(row) { (t.helps ??= []).push({ ...row }); },
    async deliver(id, lot, why) {
      t.seq = (t.seq ?? 0) + 1;
      ((t.deliveries ??= {})[id] ??= []).push({ userId: id, seq: t.seq, lot, why });
    },
    async deliveriesOf(id) { return ((t.deliveries ??= {})[id] ?? []).map((d) => ({ ...d })); },
    async dropDeliveries(id, upTo) {
      const box = (t.deliveries ??= {})[id];
      if (box !== undefined) t.deliveries[id] = box.filter((d) => d.seq > upTo);
    },
  };
}
