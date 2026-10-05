// Every world command and how the server answered it, as one event each
// (Docs/plans/analytics.md §3.5): the world server wrapped, so no call site
// in the game has to remember.

import type { WorldServerApi } from '../worldServer/local';

/** The commands worth an event: the player's actions, not the reads. */
const COMMANDS: ReadonlySet<string> = new Set([
  'join', 'claim', 'upgrade', 'tribute', 'repair', 'finish', 'collect', 'postOffer', 'takeOffer', 'withdrawOffer',
  'sendArmy', 'recall', 'delveRoom', 'descendPortal',
]);

/** The server, the same in every way, telling `track` of each command. */
export function trackedWorld(server: WorldServerApi, track: (name: string, props: Record<string, unknown>) => void): WorldServerApi {
  return new Proxy(server, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown;
      if (typeof key !== 'string' || typeof value !== 'function') return value;
      const fn = value as (...args: unknown[]) => unknown;
      if (!COMMANDS.has(key)) return fn.bind(target);
      return async (...args: unknown[]) => {
        const r = await fn.apply(target, args) as { ok?: boolean; why?: string } | null;
        if (r !== null && typeof r === 'object' && typeof r.ok === 'boolean') {
          track('world_cmd', { kind: key, ok: r.ok, ...(r.ok ? {} : { why: r.why }) });
        }
        return r;
      };
    },
  });
}
