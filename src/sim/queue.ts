// The build queue engine: the Advance algorithm doubles as the offline
// catch-up engine (Docs/06).

import { completesAt, type QueueItem } from './state';

const isCompleteAt = (item: QueueItem, now: number): boolean =>
  item.startedAt !== null && completesAt(item) <= now;

/**
 * Advance the queue. Promoted items are stamped with the moment their slot
 * actually freed (the completed item's CompletesAt), NOT `now` — that is what
 * makes a long offline gap complete a chain of queued work in true
 * chronological order in a single call.
 */
export function advanceQueue(queue: QueueItem[], now: number, maxConcurrent: number): QueueItem[] {
  const completed: QueueItem[] = [];
  const slots = Math.max(1, maxConcurrent);
  for (;;) {
    const active = queue.slice(0, Math.min(slots, queue.length));
    // 1. Initial fill: any active item never started gets stamped `now`
    //    (promoted items get stamped in step 3 instead).
    for (const item of active) {
      if (item.startedAt === null) item.startedAt = now;
    }
    // 2. Among active items already complete, pick the EARLIEST-finishing one.
    let earliest: QueueItem | null = null;
    for (const item of active) {
      if (isCompleteAt(item, now) && (earliest === null || completesAt(item) < completesAt(earliest))) {
        earliest = item;
      }
    }
    if (earliest === null) return completed;
    queue.splice(queue.indexOf(earliest), 1);
    completed.push(earliest);
    // 3. The item that just entered the active window starts when the slot freed.
    const promoted = queue[slots - 1];
    if (promoted !== undefined && promoted.startedAt === null) {
      promoted.startedAt = completesAt(earliest);
    }
  }
}
