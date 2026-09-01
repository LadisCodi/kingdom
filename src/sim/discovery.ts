// First-time discoveries: the sim records the first time something new
// enters the game (currently: a resource entering the city wallet) into a
// PERSISTED set, and pushes the key onto a transient queue the UI drains
// into "New resource discovered!" banners. Announced once, ever.

import type { CurrencyId, GameState } from './state';

export const resourceDiscoveryKey = (currency: CurrencyId): string => `resource:${currency}`;

/** Mark a resource as collected for the first time (no-op afterwards). */
export function recordResourceDiscovery(state: GameState, currency: CurrencyId): void {
  const key = resourceDiscoveryKey(currency);
  if (state.discoveries[key]) return;
  state.discoveries[key] = true;
  state.pendingDiscoveries.push(key);
}
