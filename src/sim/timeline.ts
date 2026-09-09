// The timeline (Docs/implementation-plan.md §1).
//
// Everything that HAPPENS ON A SCHEDULE or STOPS BEING TRUE goes through here:
// seasons, events and gacha banners. It exists so that
// content with a wall-clock lifetime is DATA rather than code.
//
// It is deliberately built WITH its first two consumers rather than before
// them. The boundary machinery in commands.ts is the valuable half and stands
// alone; the entry list, the handlers and the reconciliation are the part
// whose shape only a real consumer can dictate.
//
// THREE THINGS THAT ARE EASY TO GET WRONG, and that this file gets right:
//
//  1. CATALOGUE RECONCILIATION, NOT SAVE-BAKING. Authored windows are merged
//     into state.schedule at load from the BUILD's catalogue, and before the
//     offline advance — otherwise a save written before a content drop never
//     learns the new event exists.
//  2. WINDOWS THAT OPENED *AND* CLOSED DURING AN ABSENCE STILL FIRE. They do,
//     because boundaries are absolute-time and reconciliation happens before
//     the replay. That is the payoff for the whole boundary design.
//  3. `phase` MUST PERSIST. It is the termination guarantee — applyDueAt
//     transitions it, so the same boundary can never be proposed twice — and
//     it is also what stops an event that already paid out paying again on
//     reload.
//
// Handlers are PURE functions of (state, entry, t). No closures over UI: the
// moment an effect can only be replayed by re-running the UI, the determinism
// argument the whole sim rests on collapses.

import { EVENTS } from './data/definitions';
import type { GameState, ScheduledEntry, SchedulePayload } from './state';

/** How far ahead and behind reconciliation materialises occurrences. Thirty
 *  days each way covers any plausible absence without turning a recurring
 *  weekly window into an unbounded list. */
const HORIZON_MS = 30 * 86_400_000;

/** Occurrence ids are `<template>#<n>` where n counts from the template's
 *  epoch — stable across clients, which is what makes them reconcilable. */
const occurrenceId = (templateId: string, n: number): string => `${templateId}#${n}`;

/**
 * Merge the build's authored catalogue into `state.schedule`.
 *
 * Called from deserialize BEFORE the offline advance, and from newGame. Adding
 * an occurrence that is already present is a no-op, so this is safe to run on
 * every load — which is exactly what makes a content drop reach an existing
 * save.
 */
export function reconcileSchedule(
  state: GameState,
  now: number,
  /** A kingdom that did not exist a moment ago. A window ALREADY IN PROGRESS
   *  opened before it, so it never happened TO this player and must not pay
   *  its opening lump — see `entryFor`. */
  opts: { fresh?: boolean } = {},
): void {
  const known = new Set(state.schedule.map((e) => e.id));
  for (const template of EVENTS) {
    const period = template.periodMs;
    if (period <= 0) {
      // A one-off: it exists whether or not it is in the horizon, so a very
      // old save still learns it happened.
      const id = occurrenceId(template.id, 0);
      if (!known.has(id)) {
        state.schedule.push(entryFor(
          template.id, id, template.startsAt, template.durationMs, 0, now, opts.fresh === true));
      }
      continue;
    }
    const first = Math.floor((now - HORIZON_MS - template.startsAt) / period);
    const last = Math.ceil((now + HORIZON_MS - template.startsAt) / period);
    for (let n = Math.max(0, first); n <= last; n++) {
      const id = occurrenceId(template.id, n);
      if (known.has(id)) continue;
      state.schedule.push(entryFor(
        template.id, id, template.startsAt + n * period, template.durationMs, n, now,
        opts.fresh === true,
      ));
    }
  }
  // Occurrences that have been done for longer than the horizon are dead
  // weight in every future save; drop them.
  state.schedule = state.schedule.filter(
    (e) => e.phase !== 'done' || (e.endsAt ?? e.startsAt) > now - HORIZON_MS,
  );
  state.schedule.sort((a, b) => a.startsAt - b.startsAt);
}

function entryFor(
  templateId: string,
  id: string,
  startsAt: number,
  durationMs: number,
  occurrence: number,
  reference: number,
  fresh: boolean,
): ScheduledEntry {
  const endsAt = durationMs > 0 ? startsAt + durationMs : null;
  return {
    id,
    templateId,
    startsAt,
    endsAt,
    payload: { kind: 'banner', occurrence },
    // `templateId` is kept on the entry so a future payload kind can be told
    // apart without a migration; nothing reads it to branch today.
    // WHAT COUNTS AS ALREADY OVER depends on whether this timeline is
    // resuming or beginning.
    //
    // A RESUMED save missed the window while the player was away, so a window
    // that opened before `reference` is still pending and fires during the
    // replay — that is the absence being paid out, and it is point 2 of the
    // header. Only a window that had already CLOSED never happened.
    //
    // A NEW kingdom missed nothing, because it did not exist. A window in
    // progress opened before there was anyone to open it for, so it starts
    // done: an event is something that happens to you while you play, and a
    // window firing on turn zero used to hand a brand-new game a lump and a
    // week-long boon it never played through — a starting grant wearing an
    // event's clothes.
    phase: (fresh ? startsAt <= reference : endsAt !== null && endsAt <= reference)
      ? 'done'
      : 'pending',
  };
}

/** Gacha banners currently running. */
export const activeBanners = (state: GameState): ScheduledEntry[] =>
  state.schedule.filter((e) => e.payload.kind === 'banner' && e.phase === 'active');

// --------------------------------------------------------------- the handlers

export interface ScheduleEvent {
  entryId: string;
  kind: SchedulePayload['kind'];
  transition: 'opened' | 'closed';
  /** Player-facing summary, for the banner and the offline report. */
  title: string;
  detail: string;
}

function open(state: GameState, entry: ScheduledEntry, t: number): ScheduleEvent {
  void state;
  void t;
  return {
    entryId: entry.id,
    kind: 'banner',
    transition: 'opened',
    title: 'A new banner',
    detail: 'Someone new is willing to be found.',
  };
}

function close(state: GameState, entry: ScheduledEntry): ScheduleEvent {
  // The modifier expires on its own (its expiresAt IS this instant), but
  // removing it here keeps the stack tidy for a window closed by a content
  // change rather than by the clock.
  state.modifiers = state.modifiers.filter((m) => m.id !== `season:${entry.id}`);
  return {
    entryId: entry.id,
    kind: entry.payload.kind,
    transition: 'closed',
    title: 'A banner closed',
    detail: 'It will come round again.',
  };
}

/**
 * Transition every entry whose moment has come. Called from `applyDueAt`.
 *
 * `phase` is what makes this terminate: an entry moves pending → active →
 * done exactly once, so the same boundary can never be proposed twice.
 */
export function advanceSchedule(state: GameState, t: number): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  for (const entry of state.schedule) {
    if (entry.phase === 'pending' && entry.startsAt <= t) {
      entry.phase = 'active';
      events.push(open(state, entry, t));
      // An instant entry (no end) is finished the moment it fires.
      if (entry.endsAt === null) entry.phase = 'done';
    }
    if (entry.phase === 'active' && entry.endsAt !== null && entry.endsAt <= t) {
      entry.phase = 'done';
      events.push(close(state, entry));
    }
  }
  return events;
}

/** A boundary source: the next moment a window opens or closes. */
export function nextScheduleBoundary(state: GameState, after: number): number | null {
  let best: number | null = null;
  const consider = (at: number | null): void => {
    if (at === null || at <= after) return;
    if (best === null || at < best) best = at;
  };
  for (const e of state.schedule) {
    if (e.phase === 'pending') consider(e.startsAt);
    else if (e.phase === 'active') consider(e.endsAt);
  }
  return best;
}

/** Debug/dev only: force the next scheduled window open right now. */
export function forceNextWindow(state: GameState, now: number): void {
  const next = state.schedule.find((e) => e.phase === 'pending');
  if (!next) return;
  const span = (next.endsAt ?? next.startsAt + 86_400_000) - next.startsAt;
  next.startsAt = now;
  next.endsAt = now + span;
}
