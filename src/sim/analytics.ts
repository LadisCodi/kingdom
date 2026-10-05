// What the sim tells the analytics (Docs/plans/analytics.md §4): an event,
// at the sim's own time, into an outbox on the state that the game drains
// each tick. The sim never sends anything, reads no clock and knows no
// network; an event made while an absence is replayed says so.

import type { GameState } from './state';

/** One event waiting for the game to send it. */
export interface SimTrack {
  name: string;
  props: Record<string, unknown>;
  /** The sim's time when it happened (`lastAdvance`). */
  at: number;
  /** Made by the replay of an absence, not while the player watched. */
  offline: boolean;
}

/** Put an event in the outbox. */
export function track(state: GameState, name: string, props: Record<string, unknown> = {}): void {
  state.pendingAnalytics.push({ name, props, at: state.lastAdvance, offline: state.replaying });
}
