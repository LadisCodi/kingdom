// First-time discoveries: the sim records the first time something new
// enters the game — a resource entering the city wallet, or a map site coming
// into view — into a PERSISTED set, and pushes the key onto a transient queue
// the UI drains into banners. Announced once, ever.

import type { CurrencyId, GameState } from './state';

export const resourceDiscoveryKey = (currency: CurrencyId): string => `resource:${currency}`;

/** Landmarks and ruins, keyed by content id. One namespace for both: the
 *  banner is "you found something out there", and the drain in `game.ts`
 *  looks the id up in whichever list holds it. */
export const siteDiscoveryKey = (id: string): string => `site:${id}`;

/** Mark a resource as collected for the first time (no-op afterwards). */
export function recordResourceDiscovery(state: GameState, currency: CurrencyId): void {
  record(state, resourceDiscoveryKey(currency));
}

/** Mark a map site as SEEN for the first time (no-op afterwards). */
export function recordSiteDiscovery(state: GameState, id: string): void {
  record(state, siteDiscoveryKey(id));
}

function record(state: GameState, key: string): void {
  if (state.discoveries[key]) return;
  state.discoveries[key] = true;
  state.pendingDiscoveries.push(key);
}
