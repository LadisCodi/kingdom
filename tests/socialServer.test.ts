// The friends list's rules, on the server (Docs/features/15-social.md §2.1):
// what a player may ask of whom, the caps, and that every command is safe to
// send twice.
import { describe, expect, it } from 'vitest';
import { FRIENDS } from '../src/sim/data/definitions';
import { friendCodeFor, memorySocial, normalCode, serveSocial, type SocialStore } from '../src/socialServer/serve';
import type { SocialCommand, SocialReply } from '../src/socialServer/types';

const T0 = Date.parse('2026-10-06T12:00:00Z');

async function ask(store: SocialStore, user: string, cmd: SocialCommand, now = T0): Promise<SocialReply> {
  const r = await serveSocial(store, user, { cmd }, now);
  if (r.status !== 200) throw new Error(r.error);
  return r.reply;
}

/** A store with these players named and in the game. */
async function withPlayers(...names: string[]): Promise<{ store: ReturnType<typeof memorySocial>; code: (u: string) => string }> {
  const store = memorySocial();
  for (const n of names) {
    await ask(store, n, { kind: 'name', nickname: n });
    await ask(store, n, { kind: 'hello', progress: { townhall: 2, cells: 10 } });
  }
  return { store, code: (u) => store.tables.profiles[u].code! };
}

describe('the social server', () => {
  it('knows nobody without a nickname, and refuses them everything but taking one', async () => {
    const store = memorySocial();
    const hello = await ask(store, 'ana', { kind: 'hello', progress: { townhall: 1, cells: 0 } });
    expect(hello).toMatchObject({ ok: true, snapshot: { me: null, friends: [] } });
    expect(await ask(store, 'ana', { kind: 'request', target: 'AAAA-BBBB' })).toMatchObject({ ok: false, why: 'NoName' });
    expect(await ask(store, 'ana', { kind: 'name', nickname: 'x' })).toMatchObject({ ok: false, why: 'BadNickname' });
    const named = await ask(store, 'ana', { kind: 'name', nickname: '  Ana   Bel ' });
    expect(named.ok && named.snapshot.me?.nickname).toBe('Ana Bel');
    expect(named.ok && normalCode(named.snapshot.me!.code)).toBe(named.ok && named.snapshot.me!.code);
  });

  it('keeps a nickname unique whatever its case, and a player\'s first one for good', async () => {
    const store = memorySocial();
    await ask(store, 'ana', { kind: 'name', nickname: 'Ana' });
    expect(await ask(store, 'bob', { kind: 'name', nickname: 'ANA' })).toMatchObject({ ok: false, why: 'NicknameTaken' });
    const again = await ask(store, 'ana', { kind: 'name', nickname: 'Other' });
    expect(again.ok && again.snapshot.me?.nickname).toBe('Ana');
  });

  it('reads a code however it is typed', () => {
    const code = friendCodeFor('someone', 0);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalCode(code.toLowerCase().replace('-', ' '))).toBe(code);
    expect(normalCode('ABC')).toBeNull();
    expect(normalCode('OOOO-1111')).toBeNull(); // letters a code never uses
  });

  it('asks a kingdom by its code or its whole name in any case — never by a part of it', async () => {
    const { store, code } = await withPlayers('Ana', 'Anselm', 'Bob');
    const byCode = await ask(store, 'Ana', { kind: 'request', target: code('Bob').toLowerCase() });
    expect(byCode.ok && byCode.to?.nickname).toBe('Bob');
    expect(await ask(store, 'Ana', { kind: 'request', target: 'ans' })).toMatchObject({ ok: false, why: 'NotFound' });
    const byName = await ask(store, 'Ana', { kind: 'request', target: '  anSELM ' });
    expect(byName.ok && byName.snapshot.outgoing.map((k) => k.nickname).sort()).toEqual(['Anselm', 'Bob']);
  });

  it('makes friends of a request and its answer, and of two requests that cross', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob', 'Cyd');
    const sent = await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    expect(sent.ok && sent.snapshot.outgoing.map((k) => k.nickname)).toEqual(['Bob']);
    const bob = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 3, cells: 40 } });
    expect(bob.ok && bob.snapshot.incoming.map((k) => k.nickname)).toEqual(['Ana']);
    const yes = await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    expect(yes.ok && yes.snapshot.friends.map((k) => k.nickname)).toEqual(['Ana']);
    expect(yes.ok && yes.snapshot.incoming).toEqual([]);
    // Accepting again is the same friendship.
    expect(await ask(store, 'Bob', { kind: 'accept', code: code('Ana') })).toMatchObject({ ok: true });

    await ask(store, 'Cyd', { kind: 'request', target: code('Ana') });
    const crossed = await ask(store, 'Ana', { kind: 'request', target: code('Cyd') });
    expect(crossed.ok && crossed.snapshot.friends.map((k) => k.nickname).sort()).toEqual(['Bob', 'Cyd']);
    expect(crossed.ok && crossed.snapshot.outgoing).toEqual([]);
  });

  it('refuses the player themself, a stranger, and a friend asked again', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    expect(await ask(store, 'Ana', { kind: 'request', target: code('Ana') })).toMatchObject({ ok: false, why: 'Self' });
    expect(await ask(store, 'Ana', { kind: 'request', target: 'ZZZZ-ZZZZ' })).toMatchObject({ ok: false, why: 'NotFound' });
    expect(await ask(store, 'Ana', { kind: 'accept', code: code('Bob') })).toMatchObject({ ok: false, why: 'NotFound' });
    await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    expect(Object.keys(store.tables.requests)).toHaveLength(1);
    await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    expect(await ask(store, 'Ana', { kind: 'request', target: code('Bob') })).toMatchObject({ ok: false, why: 'AlreadyFriends' });
  });

  it('holds both players to the cap on friends, and the asker to the cap on requests', async () => {
    const others = Array.from({ length: FRIENDS.max + FRIENDS.maxSent + 1 }, (_, i) => `Player${i}`);
    const { store, code } = await withPlayers('Ana', 'Bob', ...others);
    for (const p of others.slice(0, FRIENDS.max)) {
      await ask(store, p, { kind: 'request', target: code('Ana') });
      await ask(store, 'Ana', { kind: 'accept', code: code(p) });
    }
    expect(await ask(store, 'Ana', { kind: 'request', target: code('Bob') })).toMatchObject({ ok: false, why: 'Full' });
    expect(await ask(store, 'Bob', { kind: 'request', target: code('Ana') })).toMatchObject({ ok: false, why: 'TheirFull' });

    const rest = others.slice(FRIENDS.max);
    for (const p of rest.slice(0, FRIENDS.maxSent)) {
      expect(await ask(store, 'Bob', { kind: 'request', target: code(p) })).toMatchObject({ ok: true });
    }
    expect(await ask(store, 'Bob', { kind: 'request', target: code(rest[FRIENDS.maxSent]) }))
      .toMatchObject({ ok: false, why: 'TooManySent' });
  });

  it('declines, takes back and removes', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    await ask(store, 'Bob', { kind: 'decline', code: code('Ana') });
    expect(store.tables.requests).toEqual({});
    await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    await ask(store, 'Ana', { kind: 'cancel', code: code('Bob') });
    expect(store.tables.requests).toEqual({});
    await ask(store, 'Ana', { kind: 'request', target: code('Bob') });
    await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    const gone = await ask(store, 'Bob', { kind: 'remove', code: code('Ana') });
    expect(gone.ok && gone.snapshot.friends).toEqual([]);
    expect(store.tables.friendships).toEqual({});
  });

  it('suggests the world board first, then the nearest Townhall, never anyone already linked', async () => {
    const { store, code } = await withPlayers('Ana', 'Far', 'Near', 'Mate', 'Friend');
    await ask(store, 'Far', { kind: 'hello', progress: { townhall: 9, cells: 10 } });
    await ask(store, 'Mate', { kind: 'hello', progress: { townhall: 9, cells: 10 } });
    store.tables.boards = { Ana: 'b1', Mate: 'b1', Far: 'b2' };
    await ask(store, 'Friend', { kind: 'request', target: code('Ana') });
    const hello = await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 10 } });
    // Three rows, one of them Friend's request: two suggestions fill it.
    expect(hello.ok && hello.snapshot.suggestions.map((k) => k.nickname)).toEqual(['Mate', 'Near']);
  });

  it('hands a code to a kingdom that only ever went out onto the world board', async () => {
    const store = memorySocial();
    await store.claimNickname('old', 'Old Timer'); // the world join's own claim
    await ask(store, 'Ana', { kind: 'name', nickname: 'Ana' });
    const sent = await ask(store, 'Ana', { kind: 'request', target: 'old timer' });
    expect(sent.ok && sent.to?.code).toBe(friendCodeFor('old', 0));
  });

  it('refuses a malformed request before reading it', async () => {
    const store = memorySocial();
    for (const body of [null, {}, { cmd: { kind: 'nope' } }, { cmd: { kind: 'hello', progress: { townhall: -1, cells: 0 } } },
      { cmd: { kind: 'request' } }, { cmd: { kind: 'request', target: 'x'.repeat(65) } }, { cmd: { kind: 'read', ids: [7] } }]) {
      expect((await serveSocial(store, 'ana', body, T0)).status).toBe(400);
    }
  });
});

describe('the Inbox', () => {
  const HOUR = 3600_000;
  const box = (r: SocialReply) => (r.ok ? r.snapshot.inbox : []).map((m) => `${m.kind}:${m.from.nickname}:${m.state ?? '-'}:${m.readAt === null ? 'new' : 'read'}`);

  it('gets a request; its answer marks it and tells the asker; sending one writes nothing to the sender', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob', 'Cyd');
    const sent = await ask(store, 'Ana', { kind: 'request', target: 'Bob' });
    expect(box(sent)).toEqual([]);
    expect(box(await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }))).toEqual(['request:Ana:pending:new']);
    // A request is not read by looking: only by answering.
    const looked = await ask(store, 'Bob', { kind: 'read', ids: ['req:Ana'] });
    expect(box(looked)).toEqual(['request:Ana:pending:new']);
    expect(box(await ask(store, 'Bob', { kind: 'accept', code: code('Ana') }))).toEqual(['request:Ana:accepted:read']);
    expect(box(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } }))).toEqual(['accepted:Bob:-:new']);

    await ask(store, 'Cyd', { kind: 'request', target: 'Ana' });
    await ask(store, 'Ana', { kind: 'decline', code: code('Cyd') });
    const cyd = await ask(store, 'Cyd', { kind: 'hello', progress: { townhall: 2, cells: 1 } });
    expect(box(cyd)).toEqual(['declined:Ana:-:new']);
  });

  it('takes a request back out of their Inbox when it is cancelled', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    await ask(store, 'Ana', { kind: 'request', target: 'Bob' });
    await ask(store, 'Ana', { kind: 'cancel', code: code('Bob') });
    expect(box(await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }))).toEqual([]);
  });

  it('reads what is new, and deletes what is read — never a request still waiting', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob', 'Cyd');
    await ask(store, 'Ana', { kind: 'request', target: 'Bob' });
    await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    await ask(store, 'Cyd', { kind: 'request', target: 'Ana' });
    const before = await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } });
    const ids = before.ok ? before.snapshot.inbox.map((m) => m.id) : [];
    const read = await ask(store, 'Ana', { kind: 'read', ids });
    expect(box(read).sort()).toEqual(['accepted:Bob:-:read', 'request:Cyd:pending:new']);
    expect(box(await ask(store, 'Ana', { kind: 'deleteRead' }))).toEqual(['request:Cyd:pending:new']);
  });

  it('lets a request expire after its hours, both ways, and a message go after its days', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    await ask(store, 'Ana', { kind: 'request', target: 'Bob' });
    const waiting = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } });
    expect(waiting.ok && waiting.snapshot.inbox[0].expiresAt).toBe(T0 + FRIENDS.requestHours * HOUR);
    const late = T0 + FRIENDS.requestHours * HOUR;
    const bob = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, late);
    expect(bob.ok && bob.snapshot.incoming).toEqual([]);
    expect(box(bob)).toEqual(['request:Ana:expired:new']);
    expect(await ask(store, 'Bob', { kind: 'accept', code: code('Ana') }, late)).toMatchObject({ ok: false, why: 'NotFound' });
    const ana = await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, late);
    expect(ana.ok && ana.snapshot.outgoing).toEqual([]);
    const gone = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, T0 + FRIENDS.messageDays * 24 * HOUR);
    expect(box(gone)).toEqual([]);
  });
});
