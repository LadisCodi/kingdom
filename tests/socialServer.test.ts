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
    expect(await ask(store, 'ana', { kind: 'request', code: 'AAAA-BBBB' })).toMatchObject({ ok: false, why: 'NoName' });
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

  it('finds a kingdom by its code or the start of its name, never the player', async () => {
    const { store, code } = await withPlayers('Ana', 'Anselm', 'Bob');
    const byCode = await ask(store, 'Ana', { kind: 'search', query: code('Bob').toLowerCase() });
    expect(byCode.ok && byCode.found?.map((k) => k.nickname)).toEqual(['Bob']);
    const byName = await ask(store, 'Ana', { kind: 'search', query: 'an' });
    expect(byName.ok && byName.found?.map((k) => k.nickname)).toEqual(['Anselm']);
  });

  it('makes friends of a request and its answer, and of two requests that cross', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob', 'Cyd');
    const sent = await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
    expect(sent.ok && sent.snapshot.outgoing.map((k) => k.nickname)).toEqual(['Bob']);
    const bob = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 3, cells: 40 } });
    expect(bob.ok && bob.snapshot.incoming.map((k) => k.nickname)).toEqual(['Ana']);
    const yes = await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    expect(yes.ok && yes.snapshot.friends.map((k) => k.nickname)).toEqual(['Ana']);
    expect(yes.ok && yes.snapshot.incoming).toEqual([]);
    // Accepting again is the same friendship.
    expect(await ask(store, 'Bob', { kind: 'accept', code: code('Ana') })).toMatchObject({ ok: true });

    await ask(store, 'Cyd', { kind: 'request', code: code('Ana') });
    const crossed = await ask(store, 'Ana', { kind: 'request', code: code('Cyd') });
    expect(crossed.ok && crossed.snapshot.friends.map((k) => k.nickname).sort()).toEqual(['Bob', 'Cyd']);
    expect(crossed.ok && crossed.snapshot.outgoing).toEqual([]);
  });

  it('refuses the player themself, a stranger, and a friend asked again', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    expect(await ask(store, 'Ana', { kind: 'request', code: code('Ana') })).toMatchObject({ ok: false, why: 'Self' });
    expect(await ask(store, 'Ana', { kind: 'request', code: 'ZZZZ-ZZZZ' })).toMatchObject({ ok: false, why: 'NotFound' });
    expect(await ask(store, 'Ana', { kind: 'accept', code: code('Bob') })).toMatchObject({ ok: false, why: 'NotFound' });
    await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
    await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
    expect(Object.keys(store.tables.requests)).toHaveLength(1);
    await ask(store, 'Bob', { kind: 'accept', code: code('Ana') });
    expect(await ask(store, 'Ana', { kind: 'request', code: code('Bob') })).toMatchObject({ ok: false, why: 'AlreadyFriends' });
  });

  it('holds both players to the cap on friends, and the asker to the cap on requests', async () => {
    const others = Array.from({ length: FRIENDS.max + FRIENDS.maxSent + 1 }, (_, i) => `Player${i}`);
    const { store, code } = await withPlayers('Ana', 'Bob', ...others);
    for (const p of others.slice(0, FRIENDS.max)) {
      await ask(store, p, { kind: 'request', code: code('Ana') });
      await ask(store, 'Ana', { kind: 'accept', code: code(p) });
    }
    expect(await ask(store, 'Ana', { kind: 'request', code: code('Bob') })).toMatchObject({ ok: false, why: 'Full' });
    expect(await ask(store, 'Bob', { kind: 'request', code: code('Ana') })).toMatchObject({ ok: false, why: 'TheirFull' });

    const rest = others.slice(FRIENDS.max);
    for (const p of rest.slice(0, FRIENDS.maxSent)) {
      expect(await ask(store, 'Bob', { kind: 'request', code: code(p) })).toMatchObject({ ok: true });
    }
    expect(await ask(store, 'Bob', { kind: 'request', code: code(rest[FRIENDS.maxSent]) }))
      .toMatchObject({ ok: false, why: 'TooManySent' });
  });

  it('declines, takes back and removes', async () => {
    const { store, code } = await withPlayers('Ana', 'Bob');
    await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
    await ask(store, 'Bob', { kind: 'decline', code: code('Ana') });
    expect(store.tables.requests).toEqual({});
    await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
    await ask(store, 'Ana', { kind: 'cancel', code: code('Bob') });
    expect(store.tables.requests).toEqual({});
    await ask(store, 'Ana', { kind: 'request', code: code('Bob') });
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
    await ask(store, 'Friend', { kind: 'request', code: code('Ana') });
    const hello = await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 10 } });
    expect(hello.ok && hello.snapshot.suggestions.map((k) => k.nickname)).toEqual(['Mate', 'Near', 'Far']);
  });

  it('hands a code to a kingdom that only ever went out onto the world board', async () => {
    const store = memorySocial();
    await store.claimNickname('old', 'Old Timer'); // the world join's own claim
    await ask(store, 'Ana', { kind: 'name', nickname: 'Ana' });
    const found = await ask(store, 'Ana', { kind: 'search', query: 'old' });
    expect(found.ok && found.found?.[0].code).toBe(friendCodeFor('old', 0));
  });

  it('refuses a malformed request before reading it', async () => {
    const store = memorySocial();
    for (const body of [null, {}, { cmd: { kind: 'nope' } }, { cmd: { kind: 'hello', progress: { townhall: -1, cells: 0 } } },
      { cmd: { kind: 'request' } }, { cmd: { kind: 'search', query: 'x'.repeat(65) } }]) {
      expect((await serveSocial(store, 'ana', body, T0)).status).toBe(400);
    }
  });
});
