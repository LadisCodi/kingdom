// Trading with friends on the wish board (Docs/features/15-social.md §2.4):
// what pairs with what, what the player may wish for and give, and the
// server's rules — the cap on wishes and on fills, a wish filled once, a
// stake that always comes back, and goods that land as deliveries.
import { describe, expect, it } from 'vitest';
import { ARTIFACT_ORDER, TRADE } from '../src/sim/data/definitions';
import { addGood, getGood } from '../src/sim/goods';
import { KEYSTONE } from '../src/sim/relics';
import { canNeed, giveProblem, pairs, receiveLot, takeLot, type TradeLot } from '../src/sim/trade';
import { memorySocial, serveSocial, type SocialStore } from '../src/socialServer/serve';
import type { SocialCommand, SocialReply } from '../src/socialServer/types';
import { firstGame } from './helpers';

const T0 = Date.parse('2026-10-06T12:00:00Z');
const HOUR = 3600_000;
const relic = ARTIFACT_ORDER[0];
const piece = (slot = 0, r = relic): TradeLot => ({ kind: 'fragment', relic: r, slot });
const keystone = (r = relic): TradeLot => ({ kind: 'fragment', relic: r, slot: KEYSTONE });
const star: TradeLot = { kind: 'material', id: 'Starmetal' };
const heart: TradeLot = { kind: 'material', id: 'Heartwood' };

describe('what pairs with what', () => {
  it('is one lot for one lot, a keystone only for a keystone, never the same thing', () => {
    expect(pairs(star, heart)).toBe(true);
    expect(pairs(star, piece())).toBe(true);
    expect(pairs(piece(0), piece(1))).toBe(true);
    expect(pairs(keystone(), keystone(ARTIFACT_ORDER[1]))).toBe(true);
    expect(pairs(star, star)).toBe(false);
    expect(pairs(piece(2), piece(2))).toBe(false);
    expect(pairs(keystone(), piece())).toBe(false);
    expect(pairs(star, keystone())).toBe(false);
  });
});

describe('the player\'s goods', () => {
  it('wishes only for a missing fragment of a relic met and not restored', () => {
    const state = firstGame();
    expect(canNeed(state, piece(1))).toBe(false); // not met
    state.relics.held[relic] = { found: [1, 0, 0, 0, 0, 0], bound: [0, 0, 0, 0, 0, 0] };
    expect(canNeed(state, piece(1))).toBe(true);
    expect(canNeed(state, piece(0))).toBe(false); // held already
    expect(canNeed(state, star)).toBe(true);
  });

  it('gives only a duplicate, and only a found one', () => {
    const state = firstGame();
    state.relics.held[relic] = { found: [1, 2, 0, 0, 0, 0], bound: [0, 0, 2, 0, 0, 0] };
    expect(giveProblem(state, piece(0))).toBe('OnlyOne');
    expect(giveProblem(state, piece(1))).toBeNull();
    expect(giveProblem(state, piece(2))).toBe('Bound');
    expect(giveProblem(state, piece(3))).toBe('NotEnough');
    expect(giveProblem(state, star)).toBe('NotEnough');
    addGood(state.city.goods, 'Starmetal', TRADE.materialLot);
    expect(giveProblem(state, star)).toBeNull();
  });

  it('takes a lot out and puts one in', () => {
    const state = firstGame();
    addGood(state.city.goods, 'Starmetal', 12);
    takeLot(state, star);
    expect(getGood(state.city.goods, 'Starmetal')).toBe(12 - TRADE.materialLot);
    receiveLot(state, piece(4));
    expect(state.relics.held[relic]!.found[4]).toBe(1);
  });
});

async function ask(store: SocialStore, user: string, cmd: SocialCommand, now = T0): Promise<SocialReply> {
  const r = await serveSocial(store, user, { cmd }, now);
  if (r.status !== 200) throw new Error(r.error);
  return r.reply;
}

/** Ana and Bob, friends; Cyd, nobody's. */
async function board() {
  const store = memorySocial();
  for (const n of ['Ana', 'Bob', 'Cyd']) await ask(store, n, { kind: 'name', nickname: n });
  await ask(store, 'Ana', { kind: 'request', target: 'Bob' });
  await ask(store, 'Bob', { kind: 'request', target: 'Ana' });
  return store;
}

const snap = (r: SocialReply) => {
  if (r.snapshot === null) throw new Error('no snapshot');
  return r.snapshot;
};

describe('the wish board', () => {
  it('pins a wish that pairs, up to the cap, never the same need twice', async () => {
    const store = await board();
    expect(await ask(store, 'Ana', { kind: 'pinWish', need: keystone(), give: star })).toMatchObject({ ok: false, why: 'BadWish' });
    const r = await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: star });
    expect(snap(r).wishes.map((w) => w.need)).toEqual([heart]);
    expect(await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: piece() })).toMatchObject({ ok: false, why: 'SameWish' });
    for (let i = 1; i < TRADE.wishes; i++) await ask(store, 'Ana', { kind: 'pinWish', need: piece(i), give: star });
    expect(await ask(store, 'Ana', { kind: 'pinWish', need: piece(4), give: star })).toMatchObject({ ok: false, why: 'TooManyWishes' });
  });

  it('shows a wish to friends only, and a fill delivers to both and tells both', async () => {
    const store = await board();
    await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: piece(3) });
    const bob = snap(await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }));
    expect(bob.friendWishes.map((w) => w.owner.nickname)).toEqual(['Ana']);
    expect(snap(await ask(store, 'Cyd', { kind: 'hello', progress: { townhall: 2, cells: 1 } })).friendWishes).toEqual([]);
    const id = bob.friendWishes[0].id;
    expect(await ask(store, 'Cyd', { kind: 'fillWish', id })).toMatchObject({ ok: false, why: 'WishGone' });

    const filled = snap(await ask(store, 'Bob', { kind: 'fillWish', id }));
    expect(filled.deliveries.map((d) => [d.lot, d.why])).toEqual([[piece(3), 'youFilled']]);
    expect(filled.fillsLeft).toBe(TRADE.fillsPerDay - 1);
    expect(filled.inbox.filter((m) => m.kind === 'filledWish')).toHaveLength(1);
    const ana = snap(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } }));
    expect(ana.wishes).toEqual([]);
    expect(ana.deliveries.map((d) => [d.lot, d.why])).toEqual([[heart, 'filled']]);
    expect(ana.inbox.find((m) => m.kind === 'wishFilled')).toMatchObject({ from: { nickname: 'Bob' }, lots: { got: heart, gave: piece(3) } });
    // Filled once: a second fill finds it gone.
    expect(await ask(store, 'Bob', { kind: 'fillWish', id })).toMatchObject({ ok: false, why: 'WishGone' });
  });

  it('refuses a player their own wish, and a fill past the day\'s cap', async () => {
    const store = await board();
    await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: star });
    const own = snap(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } })).wishes[0].id;
    expect(await ask(store, 'Ana', { kind: 'fillWish', id: own })).toMatchObject({ ok: false, why: 'OwnWish' });
    // Bob fills the cap's worth over the day, one wish at a time.
    for (let i = 0; i < TRADE.fillsPerDay; i++) {
      const at = T0 + i * HOUR;
      if (i > 0) await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: star }, at);
      const w = snap(await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, at)).friendWishes[0];
      expect(await ask(store, 'Bob', { kind: 'fillWish', id: w.id }, at)).toMatchObject({ ok: true });
    }
    const late = T0 + TRADE.fillsPerDay * HOUR;
    await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: star }, late);
    const w = snap(await ask(store, 'Bob', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, late)).friendWishes[0];
    expect(await ask(store, 'Bob', { kind: 'fillWish', id: w.id }, late)).toMatchObject({ ok: false, why: 'NoFillsLeft' });
    // A day after the first fill, one comes back.
    expect(await ask(store, 'Bob', { kind: 'fillWish', id: w.id }, T0 + 24 * HOUR + 1)).toMatchObject({ ok: true });
  });

  it('gives the stake back on withdrawal and on expiry, and forgets a delivery once acknowledged', async () => {
    const store = await board();
    await ask(store, 'Ana', { kind: 'pinWish', need: heart, give: star });
    await ask(store, 'Ana', { kind: 'pinWish', need: piece(2), give: piece(1) });
    const pinned = snap(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } }));
    const back = snap(await ask(store, 'Ana', { kind: 'withdrawWish', id: pinned.wishes[0].id }));
    expect(back.deliveries.map((d) => [d.lot, d.why])).toEqual([[star, 'withdrawn']]);

    const late = T0 + TRADE.wishHours * HOUR;
    const expired = snap(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1 } }, late));
    expect(expired.wishes).toEqual([]);
    expect(expired.deliveries.map((d) => d.why)).toEqual(['withdrawn', 'expired']);
    expect(expired.inbox[0]).toMatchObject({ kind: 'wishExpired', lots: { got: piece(1), gave: null } });

    const seq = expired.deliveries[1].seq;
    const acked = snap(await ask(store, 'Ana', { kind: 'hello', progress: { townhall: 2, cells: 1, ack: seq } }, late));
    expect(acked.deliveries).toEqual([]);
  });
});

describe('the client', () => {
  /** A FriendsClient over a stand-in game and a server whose answers the
   *  test writes. */
  async function client(answer: (cmd: SocialCommand) => SocialReply) {
    const { FriendsClient } = await import('../src/friendsClient');
    const state = firstGame();
    const saved: number[] = [];
    const game = {
      state, now: () => T0, notify() {}, setOverlay() {}, toast() {}, track() {},
      persist: () => saved.push(state.kingdom.trade.seq),
      doorOpen: () => true, worldNickname: () => null, openOverlay: null,
    } as unknown as ConstructorParameters<typeof FriendsClient>[0];
    const f = new FriendsClient(game, { send: async (cmd) => answer(cmd) });
    return { f, state, saved };
  }
  const base = {
    at: T0, me: null, friends: [], incoming: [], outgoing: [], suggestions: [], inbox: [],
    wishes: [], friendWishes: [], fillsLeft: TRADE.fillsPerDay,
  };

  it('applies a delivery once however often it comes, and saves it', async () => {
    const deliveries = [{ seq: 7, lot: star, why: 'filled' as const }];
    const { f, state, saved } = await client(() => ({ ok: true, snapshot: { ...base, deliveries } }));
    await f.hello();
    await f.hello();
    expect(getGood(state.city.goods, 'Starmetal')).toBe(TRADE.materialLot);
    expect(state.kingdom.trade.seq).toBe(7);
    expect(saved).toEqual([7]);
  });

  it('takes the stake when a wish is pinned, and gives it back if the server says no', async () => {
    let ok = true;
    const { f, state } = await client(() => (ok
      ? { ok: true, snapshot: { ...base, deliveries: [] } }
      : { ok: false, why: 'TooManyWishes', snapshot: { ...base, deliveries: [] } }));
    addGood(state.city.goods, 'Starmetal', TRADE.materialLot * 2);
    f.wishNeed = heart;
    f.wishGive = star;
    await f.pinWish();
    expect(getGood(state.city.goods, 'Starmetal')).toBe(TRADE.materialLot);
    ok = false;
    f.wishNeed = heart;
    f.wishGive = star;
    await f.pinWish();
    expect(getGood(state.city.goods, 'Starmetal')).toBe(TRADE.materialLot);
  });
});
