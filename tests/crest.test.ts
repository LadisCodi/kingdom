// A kingdom's crest (Docs/features/15-social.md §2.2): what one is, the one
// a nickname wears until its kingdom chooses, and how it travels — the save,
// the social server's hello, the world board's seat — and the friends door
// that opens once the kingdom has a name.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { CHARGES, TINCTURES, crestId, crestOf, defaultCrest, parseCrest } from '../src/sim/crest';
import { LANDMARKS } from '../src/sim/data/definitions';
import { isDoorOpen } from '../src/sim/doors';
import { deserialize, serialize } from '../src/sim/save';
import { memorySocial, serveSocial } from '../src/socialServer/serve';
import type { SocialCommand } from '../src/socialServer/types';
import { memoryBoards, serveWorld } from '../src/worldServer/serve';
import type { JoinResult } from '../src/worldServer/handle';
import type { WorldSnapshot } from '../src/worldServer/types';
import { firstGame, map, T0 } from './helpers';

describe('a crest', () => {
  it('is a tincture and a charge, written with a dot, and nothing else', () => {
    expect(parseCrest('gules.lion')).toEqual({ tincture: 'gules', charge: 'lion' });
    for (const bad of ['gules', 'gules.lion.x', 'pink.lion', 'gules.unicorn', '', null, 7]) expect(parseCrest(bad)).toBeNull();
    for (const t of TINCTURES) for (const c of CHARGES) expect(parseCrest(crestId({ tincture: t, charge: c }))).not.toBeNull();
  });

  it('has art for every tincture and every charge', () => {
    for (const t of TINCTURES) expect(existsSync(`src/ui/assets/crest/field-${t}.png`)).toBe(true);
    for (const c of CHARGES) expect(existsSync(`src/ui/assets/crest/charge-${c}.png`)).toBe(true);
  });

  it('is the one a nickname picks until one is chosen, whatever the case', () => {
    expect(defaultCrest('Oakville')).toEqual(defaultCrest('  oakville '));
    expect(crestOf('Oakville', null)).toEqual(defaultCrest('Oakville'));
    expect(crestOf('Oakville', 'vert.stag')).toEqual({ tincture: 'vert', charge: 'stag' });
    expect(crestOf('Oakville', 'nonsense')).toEqual(defaultCrest('Oakville'));
    const names = ['Ada', 'Bel', 'Cora', 'Dun', 'Eve', 'Fox', 'Gil', 'Hal', 'Ivo', 'Jem'];
    expect(new Set(names.map((n) => crestId(defaultCrest(n)))).size).toBeGreaterThan(5);
  });
});

describe('the profile in the save', () => {
  it('keeps the nickname and the crest chosen', () => {
    const state = firstGame();
    expect(state.kingdom.profile).toEqual({ nickname: null, crest: null });
    state.kingdom.profile = { nickname: 'Oakville', crest: 'azure.ship' };
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.kingdom.profile).toEqual({ nickname: 'Oakville', crest: 'azure.ship' });
  });
});

describe('the friends door', () => {
  it('opens with the world AND a name, not before', () => {
    const state = firstGame();
    const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
    state.kingdom.profile.nickname = 'Oakville';
    expect(isDoorOpen(state, 'friends')).toBe(false);
    state.landmarks.claimed[tower.id] = true;
    state.kingdom.profile.nickname = null;
    expect(isDoorOpen(state, 'friends')).toBe(false);
    state.kingdom.profile.nickname = 'Oakville';
    expect(isDoorOpen(state, 'friends')).toBe(true);
  });
});

describe('the servers', () => {
  it('social: a hello carries the crest to every friend, refuses a bad one, and an old client leaves it be', async () => {
    const store = memorySocial();
    const ask = async (user: string, cmd: SocialCommand) => {
      const r = await serveSocial(store, user, { cmd }, T0);
      if (r.status !== 200) throw new Error(r.error);
      return r.reply;
    };
    await ask('ana', { kind: 'name', nickname: 'Ana' });
    const hi = await ask('ana', { kind: 'hello', progress: { townhall: 2, cells: 5, crest: 'sable.tower' } });
    expect(hi.ok && hi.snapshot.me?.crest).toBe('sable.tower');
    await ask('ana', { kind: 'hello', progress: { townhall: 2, cells: 6 } });
    expect(store.tables.profiles.ana.crest).toBe('sable.tower');
    const bad = await serveSocial(store, 'ana', { cmd: { kind: 'hello', progress: { townhall: 2, cells: 6, crest: 'pink.cat' } } }, T0);
    expect(bad.status).toBe(400);
  });

  it('world: the seat wears the crest it is told, and every snapshot shows it', async () => {
    const store = memoryBoards();
    const send = (cmd: unknown, opId: string) => serveWorld(store, 'u1', { opId, ack: 0, cmd }, T0);
    const joined = await send({ kind: 'join', nickname: 'Ada' }, 'j');
    const seat = ((joined as { reply: JoinResult }).reply as { snapshot: WorldSnapshot }).snapshot.board.seat;
    expect(await send({ kind: 'setCrest', crest: 'celeste.dragon' }, 'c1')).toMatchObject({ status: 200 });
    const snap = (await send({ kind: 'snapshot' }, 's1') as { reply: WorldSnapshot }).reply;
    expect(snap.seats[seat]).toMatchObject({ you: true, crest: 'celeste.dragon' });
    // Nonsense, or null, is the nickname's crest again.
    await send({ kind: 'setCrest', crest: 'nonsense' }, 'c2');
    expect((await send({ kind: 'snapshot' }, 's2') as { reply: WorldSnapshot }).reply.seats[seat].crest).toBeNull();
  });
});
