// The playtest analytics (Docs/plans/analytics.md): the envelope every event
// carries, the queue that outlives the page, what the sim and the game record,
// and the world wrapped so every command is one event.
import { describe, expect, it } from 'vitest';
import {
  Analytics, BATCH_MAX, ERRORS_MAX, LEAVING_BYTES_MAX, QUEUE_MAX, type AnalyticsStore, type EventRow,
} from '../src/analytics/analytics';
import { buyBuilder, buyKeys } from '../src/sim/commands';
import { pull, STANDARD_BANNER } from '../src/sim/heroes';
import { grantItem } from '../src/sim/bag';
import { BANNERS } from '../src/sim/data/definitions';
import { trackedWorld } from '../src/analytics/worldEvents';
import { markDoorSeen } from '../src/sim/doors';
import { deserialize, serialize } from '../src/sim/save';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import { freshGame, freshPresenter, map, T0 } from './helpers';

/** A store in memory, and a sender that keeps what it was sent. */
function rig(opts: { fail?: boolean } = {}) {
  let text: string | null = null;
  const store: AnalyticsStore = { load: () => text, save: (t) => { text = t; } };
  const sent: EventRow[][] = [];
  const sentLeaving: EventRow[][] = [];
  let n = 0;
  const make = () => new Analytics({
    send: async (rows) => {
      if (opts.fail) return false;
      sent.push(rows);
      return true;
    },
    sendLeaving: async (rows) => {
      sentLeaving.push(rows);
      return true;
    },
    store,
    context: () => ({ th: 3, quest: 7, playedMin: 42, scene: 'province' }),
    dev: false,
    gameVersion: '9.9.9',
    saveVersion: 88,
    newId: () => `id-${n++}`,
  });
  return { make, sent, sentLeaving, stored: () => text };
}

describe('an event', () => {
  it('waits in the store the moment it is made', () => {
    const r = rig();
    const a = r.make();
    a.startSession(T0, { away_ms: 5 });
    a.track('quest_done', { index: 2 }, T0 + 1000);
    const rows = JSON.parse(r.stored()!) as EventRow[];
    expect(rows.map((e) => [e.name, e.props])).toEqual([['session_start', { away_ms: 5 }], ['quest_done', { index: 2 }]]);
  });

  it('is numbered within its session, and a new session starts again from 0', async () => {
    const { make, sent } = rig();
    const a = make();
    a.startSession(T0);
    a.track('heartbeat', {}, T0 + 60_000);
    const first = a.sessionId;
    a.startSession(T0 + 3_600_000);
    await a.flush();
    const rows = sent.flat();
    expect(rows.map((r) => [r.name, r.seq])).toEqual([['session_start', 0], ['heartbeat', 1], ['session_start', 0]]);
    expect(rows[0]).toMatchObject({
      session_id: first, at: new Date(T0).toISOString(), game_version: '9.9.9', save_version: 88,
      th: 3, quest: 7, played_min: 42, scene: 'province', offline: false, dev: false,
    });
    expect(rows[2].session_id).not.toBe(first);
  });

  it('says how long the session ran when the page goes out of sight', async () => {
    const { make, sent } = rig();
    const a = make();
    a.startSession(T0);
    a.endSession(T0 + 90_000);
    await a.flush();
    expect(sent.flat().at(-1)).toMatchObject({ name: 'session_end', props: { length_ms: 90_000 } });
  });

  it('drops props too big to send for a note of their size', async () => {
    const { make, sent } = rig();
    const a = make();
    a.track('client_error', { message: 'x'.repeat(5000) }, T0);
    await a.flush();
    expect(sent.flat()[0].props).toEqual({ truncated: expect.any(Number) });
  });

  it('sends only so many errors a session', () => {
    const { make } = rig();
    const a = make();
    a.startSession(T0);
    for (let i = 0; i < ERRORS_MAX + 10; i++) a.track('client_error', { message: 'loop' }, T0);
    expect(a.pending()).toBe(1 + ERRORS_MAX);
  });
});

describe('the queue', () => {
  it('outlives the page, and empties as batches reach the server', async () => {
    const r = rig();
    const a = r.make();
    for (let i = 0; i < BATCH_MAX + 5; i++) a.track('heartbeat', {}, T0 + i);
    // The page goes; the next one finds the queue where it was left.
    const b = r.make();
    expect(b.pending()).toBe(BATCH_MAX + 5);
    await b.flush();
    expect(r.sent.map((batch) => batch.length)).toEqual([BATCH_MAX, 5]);
    expect(b.pending()).toBe(0);
    expect(r.make().pending()).toBe(0);
  });

  it('keeps what a failed batch held, for the next flush', async () => {
    const r = rig({ fail: true });
    const a = r.make();
    a.track('heartbeat', {}, T0);
    await a.flush();
    expect(a.pending()).toBe(1);
  });

  it('sends one batch on the request that outlives the page as it goes away, small enough for it', async () => {
    const { make, sent, sentLeaving } = rig();
    const a = make();
    for (let i = 0; i < BATCH_MAX; i++) a.track('heartbeat', { pad: 'x'.repeat(900) }, T0 + i);
    await a.flush(true);
    expect(sent).toEqual([]);
    expect(sentLeaving).toHaveLength(1);
    expect(JSON.stringify(sentLeaving[0]).length).toBeLessThanOrEqual(LEAVING_BYTES_MAX);
    expect(a.pending()).toBe(BATCH_MAX - sentLeaving[0].length);
  });

  it('holds at most so many, the oldest dropped first', () => {
    const { make } = rig();
    const a = make();
    for (let i = 0; i < QUEUE_MAX + 3; i++) a.track('heartbeat', { i }, T0 + i);
    expect(a.pending()).toBe(QUEUE_MAX);
  });
});

describe('what the sim records', () => {
  it('puts an event in the outbox at the sim\'s time, marked when an absence is being replayed', () => {
    const state = freshGame();
    markDoorSeen(state, 'world');
    state.replaying = true;
    markDoorSeen(state, 'heroes');
    state.replaying = false;
    markDoorSeen(state, 'world'); // already open: no second event
    expect(state.pendingAnalytics.filter((e) => e.name === 'door_opened')).toEqual([
      { name: 'door_opened', props: { id: 'world' }, at: state.lastAdvance, offline: false },
      { name: 'door_opened', props: { id: 'heroes' }, at: state.lastAdvance, offline: true },
    ]);
  });

  it('names the sink of every Gem spent', () => {
    const state = freshGame();
    state.player.wallet.Gems = 100_000;
    buyBuilder(state);
    buyKeys(state, STANDARD_BANNER, 2);
    const spent = state.pendingAnalytics.filter((e) => e.name === 'gems_spent').map((e) => e.props.sink);
    expect(spent).toEqual(['builder', 'keys']);
  });

  it('records every call on a banner, hit or miss', () => {
    const state = freshGame();
    grantItem(state, BANNERS[STANDARD_BANNER].key, 10);
    for (let i = 0; i < 5; i++) pull(state, STANDARD_BANNER);
    const calls = state.pendingAnalytics.filter((e) => e.name === 'hero_call');
    expect(calls.map((e) => e.props.n)).toEqual([1, 2, 3, 4, 5]);
    expect(calls[0].props).toMatchObject({ banner: STANDARD_BANNER, hero: expect.any(String) });
  });

  it('never saves the outbox, and keeps the time on screen', () => {
    const state = freshGame();
    markDoorSeen(state, 'world');
    state.signals.playMs = 123_456;
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.pendingAnalytics.filter((e) => e.name === 'door_opened')).toEqual([]);
    expect(back.signals.playMs).toBe(123_456);
  });
});

describe('what the game records', () => {
  function tracked() {
    const game = freshPresenter(freshGame());
    game.now = () => T0;
    const { make, sent } = rig();
    game.analytics = make();
    return { game, sent };
  }

  it('drains the sim\'s outbox into the queue on the tick', async () => {
    const { game, sent } = tracked();
    markDoorSeen(game.state, 'world');
    game.tick();
    await game.analytics!.flush();
    expect(sent.flat().some((r) => r.name === 'door_opened')).toBe(true);
    expect(game.state.pendingAnalytics).toEqual([]);
  });

  it('says once a dry spell that a tap found no Mana', async () => {
    const { game, sent } = tracked();
    const tap = (): void => (game as unknown as { outOfMana(c: { x: number; y: number }): void }).outOfMana({ x: 0, y: 0 });
    game.state.city.wallet.Mana = 0;
    tap();
    tap();
    game.tick();
    game.state.city.wallet.Mana = 5;
    game.tick();
    game.state.city.wallet.Mana = 0;
    tap();
    await game.analytics!.flush();
    expect(sent.flat().filter((r) => r.name === 'mana_empty')).toHaveLength(2);
  });

  it('follows the store\'s funnel: a confirmation opened, then dismissed or bought', async () => {
    const { game, sent } = tracked();
    game.doChoosePayerProfile('Dolphin');
    game.setOverlay('store');
    game.openIap('GemsPouch');
    game.dismiss();
    game.openIap('GemsPouch');
    game.confirmIap();
    await game.analytics!.flush();
    const funnel = sent.flat().map((r) => r.name).filter((n) => ['store_opened', 'confirm_opened', 'dismissed', 'purchased'].includes(n));
    expect(funnel).toEqual(['store_opened', 'confirm_opened', 'dismissed', 'confirm_opened', 'purchased']);
    const bought = sent.flat().find((r) => r.name === 'purchased')!;
    expect(bought.props).toMatchObject({ sku: 'GemsPouch', price_cents: expect.any(Number), credit_cents: expect.any(Number) });
  });

  it('makes every world command one event, with the server\'s answer', async () => {
    const seen: Array<[string, Record<string, unknown>]> = [];
    const server = trackedWorld(new LocalWorldServer(memoryStore(), () => T0), (n, p) => seen.push([n, p]));
    await server.connect('me');
    await server.join('Mel');
    await server.claim(-1);
    expect(seen).toEqual([
      ['world_cmd', { kind: 'join', ok: true }],
      ['world_cmd', { kind: 'claim', ok: false, why: 'NoSuchHex' }],
    ]);
    expect(server.clockOffset()).toBe(0);
  });
});
