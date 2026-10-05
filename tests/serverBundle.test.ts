// The world server's rules leave the browser (scripts/server-bundle.mjs): the
// bundle the edge function runs reaches for nothing a server lacks, and it
// answers exactly as the source does.
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs script, typed by what this test reads.
import { browserReferences, bundleWorldServer } from '../scripts/server-bundle.mjs';
import { SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { emptyWorld } from '../src/worldServer/core';
import { handleWorld, type WorldRequest } from '../src/worldServer/handle';

const T0 = Date.parse('2026-08-20T12:00:00Z');

describe('the server bundle', () => {
  it('reaches for nothing a server lacks, and answers as the source does', async () => {
    const code: string = await bundleWorldServer();
    expect(browserReferences(code)).toEqual([]);

    // Loaded as a module of its own, the way Deno will load it.
    const url = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(code)))}`;
    const bundled = await import(/* @vite-ignore */ url) as { handleWorld: typeof handleWorld };

    const requests: WorldRequest[] = [
      { opId: 'a', playerId: 'me', ack: 0, cmd: { kind: 'join', nickname: 'Me' }, newBoard: { id: 'b', seed: 7 } },
      { opId: 'b', playerId: 'me', ack: 0, cmd: { kind: 'claim', index: boardNeighbors(SEAT_INDICES[1])[0] } },
      { opId: 'c', playerId: 'me', ack: 0, cmd: { kind: 'snapshot' } },
    ];
    const play = (handle: typeof handleWorld) => {
      const w = emptyWorld();
      const replies = requests.map((r, i) => handle(w, r, T0 + i * 60_000));
      return { w, replies };
    };
    expect(JSON.stringify(play(bundled.handleWorld))).toBe(JSON.stringify(play(handleWorld)));
  }, 30_000);
});
