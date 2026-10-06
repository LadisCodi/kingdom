// Daily help between friends (Docs/features/15-social.md §3): friends only,
// each once in any 24 hours, a few a day; the helper paid in their own Mana,
// the friend a gift in the Bag and a note in the Inbox.
import { describe, expect, it } from 'vitest';
import { FRIEND_HELP, FRIENDS } from '../src/sim/data/definitions';
import { helpMana, payHelper, receiveGift } from '../src/sim/friendHelp';
import { itemCount } from '../src/sim/bag';
import { mana, manaCap, manaNetRegen } from '../src/sim/mana';
import { memorySocial, serveSocial, type SocialStore } from '../src/socialServer/serve';
import type { SocialCommand, SocialReply } from '../src/socialServer/types';
import { freshGame } from './helpers';

const T0 = Date.parse('2026-10-06T12:00:00Z');
const HOUR = 3_600_000;

async function ask(store: SocialStore, user: string, cmd: SocialCommand, now = T0): Promise<SocialReply> {
  const r = await serveSocial(store, user, { cmd }, now);
  if (r.status !== 200) throw new Error(r.error);
  return r.reply;
}

/** Players named, in the game, and every one a friend of the first. */
async function circle(...names: string[]) {
  const store = memorySocial();
  for (const n of names) {
    await ask(store, n, { kind: 'name', nickname: n });
    await ask(store, n, { kind: 'hello', progress: { townhall: 2, cells: 10 } });
  }
  const code = (u: string) => store.tables.profiles[u].code!;
  for (const n of names.slice(1)) {
    await ask(store, names[0], { kind: 'request', target: code(n) });
    await ask(store, n, { kind: 'accept', code: code(names[0]) });
  }
  return { store, code };
}

describe('helping a friend, on the server', () => {
  it('gives the friend a gift and a note, once in any 24 hours', async () => {
    const { store, code } = await circle('Ana', 'Bob');
    const r = await ask(store, 'Ana', { kind: 'help', code: code('Bob') });
    expect(r.ok).toBe(true);
    expect(r.ok && r.snapshot.helped).toEqual([{ code: code('Bob'), at: T0 }]);
    expect(r.ok && r.snapshot.helpsLeft).toBe(FRIEND_HELP.perDay - 1);
    expect(await ask(store, 'Ana', { kind: 'help', code: code('Bob') }, T0 + 23 * HOUR)).toMatchObject({ ok: false, why: 'AlreadyHelped' });
    expect((await ask(store, 'Ana', { kind: 'help', code: code('Bob') }, T0 + 24 * HOUR + 1)).ok).toBe(true);

    // Two helps, a day apart: two gifts and two notes.
    const bob = await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 10 } }, T0 + 25 * HOUR);
    const snap = bob.ok ? bob.snapshot : null;
    const gift = { kind: 'gift', item: FRIEND_HELP.giftItem };
    expect(snap?.deliveries.filter((d) => d.why === 'helped').map((d) => d.lot)).toEqual([gift, gift]);
    expect(snap?.inbox.filter((m) => m.kind === 'helped').map((m) => m.from.nickname)).toEqual(['Ana', 'Ana']);
  });

  it('helps friends only, and only so many a day', async () => {
    const names = ['Ana', ...Array.from({ length: Math.min(FRIENDS.max, FRIEND_HELP.perDay + 1) }, (_, i) => `Friend${i}`), 'Zed'];
    const { store, code } = await circle(...names.slice(0, -1));
    await ask(store, 'Zed', { kind: 'name', nickname: 'Zed' });
    await ask(store, 'Zed', { kind: 'hello', progress: { townhall: 1, cells: 0 } });
    expect(await ask(store, 'Ana', { kind: 'help', code: code('Zed') })).toMatchObject({ ok: false, why: 'NotFriends' });
    const friends = names.slice(1, -1);
    for (const f of friends.slice(0, FRIEND_HELP.perDay)) expect((await ask(store, 'Ana', { kind: 'help', code: code(f) })).ok).toBe(true);
    if (friends.length > FRIEND_HELP.perDay) {
      expect(await ask(store, 'Ana', { kind: 'help', code: code(friends[FRIEND_HELP.perDay]) })).toMatchObject({ ok: false, why: 'NoHelpsLeft' });
    }
  });
});

describe('helping a friend, in the game', () => {
  it('pays the helper minutes of their own Mana, at least one, up to the pool', () => {
    const state = freshGame();
    expect(helpMana(state)).toBeGreaterThanOrEqual(1);
    expect(helpMana(state)).toBeLessThanOrEqual(Math.max(1, Math.ceil(manaNetRegen(state) * FRIEND_HELP.helperManaMinutes / 60 * 1.01)));
    state.city.wallet.Mana = 0;
    expect(payHelper(state)).toBe(helpMana(state));
    state.city.wallet.Mana = manaCap(state);
    expect(payHelper(state)).toBe(0);
    expect(mana(state)).toBe(manaCap(state));
  });

  it('puts a friend\'s gift in the Bag', () => {
    const state = freshGame();
    const before = itemCount(state, FRIEND_HELP.giftItem);
    receiveGift(state, FRIEND_HELP.giftItem);
    expect(itemCount(state, FRIEND_HELP.giftItem)).toBe(before + 1);
  });
});
