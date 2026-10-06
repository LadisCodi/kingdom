// The social server's stand-in (socialServer/local.ts): made-up kingdoms that
// ask the player once they have a name, and answer the player's requests a
// little later — all but one.
import { describe, expect, it } from 'vitest';
import { LocalSocialServer, type SocialTablesStore } from '../src/socialServer/local';
import type { SocialTables } from '../src/socialServer/serve';

const T0 = Date.parse('2026-10-06T12:00:00Z');

function stand(): { server: LocalSocialServer; at: (ms: number) => void } {
  let kept: SocialTables | null = null;
  const store: SocialTablesStore = { load: () => (kept === null ? null : structuredClone(kept)), save: (t) => { kept = structuredClone(t); } };
  let now = T0;
  return { server: new LocalSocialServer(store, () => 'me', () => now), at: (ms) => { now = T0 + ms; } };
}

describe('the social stand-in', () => {
  it('is asked by two kingdoms the moment the player has a name', async () => {
    const { server } = stand();
    const before = await server.send({ kind: 'hello', progress: { townhall: 2, cells: 10 } });
    expect(before.ok && before.snapshot.me).toBeNull();
    await server.send({ kind: 'name', nickname: 'Oakvale' });
    const after = await server.send({ kind: 'hello', progress: { townhall: 2, cells: 10 } });
    expect(after.ok && after.snapshot.incoming.map((k) => k.nickname).sort()).toEqual(['Elderglen', 'Foxhollow']);
    expect(after.ok && after.snapshot.suggestions.length).toBeGreaterThan(0);
  });

  it('answers a request within a minute — Dunmere with a no, and Greywater never', async () => {
    const { server, at } = stand();
    const named = await server.send({ kind: 'name', nickname: 'Oakvale' });
    await server.send({ kind: 'request', target: 'Aldermoor' });
    await server.send({ kind: 'request', target: 'greywater' });
    await server.send({ kind: 'request', target: 'Dunmere' });
    expect(named.ok).toBe(true);
    at(61_000);
    const later = await server.send({ kind: 'hello', progress: { townhall: 2, cells: 10 } });
    expect(later.ok && later.snapshot.friends.map((k) => k.nickname)).toEqual(['Aldermoor']);
    expect(later.ok && later.snapshot.outgoing.map((k) => k.nickname)).toEqual(['Greywater']);
    // Both answers are in the Inbox, new.
    expect(later.ok && later.snapshot.inbox.filter((m) => m.readAt === null && m.kind !== 'request')
      .map((m) => `${m.kind}:${m.from.nickname}`).sort()).toEqual(['accepted:Aldermoor', 'declined:Dunmere']);
  });

  it('can be asked by one more kingdom from the dev bar', async () => {
    const { server } = stand();
    await server.send({ kind: 'name', nickname: 'Oakvale' });
    await server.devAsk();
    const r = await server.send({ kind: 'hello', progress: { townhall: 2, cells: 10 } });
    expect(r.ok && r.snapshot.incoming).toHaveLength(3);
  });
});
