// THE PLAYTEST ANALYTICS (Docs/plans/analytics.md): every event a row, with
// the envelope §2 says each one carries, waiting in a queue that outlives the
// page until a batch of it reaches the server.
//
// Nothing here knows Supabase or the DOM: what sends a batch and where the
// queue is kept are handed in, so the tests drive it with plain functions.

/** One row of `analytics_events`, as the client sends it. The server fills
 *  in the user (from the session) and when it arrived. */
export interface EventRow {
  id: string;
  session_id: string;
  seq: number;
  /** ISO, on the game's clock (the server's time). */
  at: string;
  game_version: string;
  save_version: number;
  name: string;
  props: Record<string, unknown>;
  th: number;
  quest: number;
  played_min: number;
  scene: string;
  offline: boolean;
  dev: boolean;
}

/** Where the player is, for every event: §2's context. */
export interface AnalyticsContext { th: number; quest: number; playedMin: number; scene: string }

/** Send a batch: true when the server has it. A batch sent twice is counted
 *  once — its rows' ids are the table's key. */
export type AnalyticsSend = (rows: EventRow[]) => Promise<boolean>;

/** Where the queue waits between pages: localStorage in the game. */
export interface AnalyticsStore { load(): string | null; save(text: string): void }

/** At most this many rows wait; past it the oldest go. */
export const QUEUE_MAX = 200;
/** At most this many go in one batch. */
export const BATCH_MAX = 100;
/** A row's props past this many characters are dropped for a note saying so. */
export const PROPS_MAX = 2000;
/** At most this many errors a session are sent: a loop that throws every
 *  frame must not fill the table. */
export const ERRORS_MAX = 20;

export interface AnalyticsOptions {
  send: AnalyticsSend;
  store: AnalyticsStore;
  context: () => AnalyticsContext;
  dev: boolean;
  gameVersion: string;
  saveVersion: number;
  newId?: () => string;
}

export class Analytics {
  sessionId: string;
  private seq = 0;
  private queue: EventRow[];
  private sending = false;
  private sessionStart: number | null = null;
  private errors = 0;
  private readonly newId: () => string;

  constructor(private o: AnalyticsOptions) {
    this.newId = o.newId ?? (() => globalThis.crypto.randomUUID());
    this.sessionId = this.newId();
    this.queue = readQueue(o.store);
  }

  /** Record one event at `at` (the game's clock, ms). */
  track(name: string, props: Record<string, unknown>, at: number, offline = false): void {
    if (name === 'client_error' && ++this.errors > ERRORS_MAX) return;
    const ctx = this.o.context();
    const text = JSON.stringify(props);
    this.queue.push({
      id: this.newId(),
      session_id: this.sessionId,
      seq: this.seq++,
      at: new Date(at).toISOString(),
      game_version: this.o.gameVersion,
      save_version: this.o.saveVersion,
      name,
      props: text.length > PROPS_MAX ? { truncated: text.length } : props,
      th: ctx.th,
      quest: ctx.quest,
      played_min: ctx.playedMin,
      scene: ctx.scene,
      offline,
      dev: this.o.dev,
    });
    if (this.queue.length > QUEUE_MAX) this.queue.splice(0, this.queue.length - QUEUE_MAX);
    this.persist();
  }

  /** A new session: a new id, its count from 0, and its first event. */
  startSession(at: number, props: Record<string, unknown> = {}): void {
    this.sessionId = this.newId();
    this.seq = 0;
    this.errors = 0;
    this.sessionStart = at;
    this.track('session_start', props, at);
  }

  /** The page is going out of sight: how long the session has run. A page
   *  that shows again soon carries on the same session, and its next end
   *  says the longer length. */
  endSession(at: number): void {
    if (this.sessionStart === null) return;
    this.track('session_end', { length_ms: Math.max(0, at - this.sessionStart) }, at);
  }

  /** How many rows wait. */
  pending(): number {
    return this.queue.length;
  }

  /** Send what waits, a batch at a time, until it is all sent or a batch
   *  fails — then the rest waits for the next flush. One flush at a time. */
  async flush(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, BATCH_MAX);
        let ok = false;
        try {
          ok = await this.o.send(batch);
        } catch {
          ok = false;
        }
        if (!ok) return;
        const sent = new Set(batch.map((r) => r.id));
        this.queue = this.queue.filter((r) => !sent.has(r.id));
        this.persist();
      }
    } finally {
      this.sending = false;
    }
  }

  private persist(): void {
    try {
      this.o.store.save(JSON.stringify(this.queue));
    } catch {
      // A full or blocked store: the queue still lives in memory.
    }
  }
}

function readQueue(store: AnalyticsStore): EventRow[] {
  try {
    const text = store.load();
    const rows = text === null ? [] : JSON.parse(text) as unknown;
    return Array.isArray(rows) ? (rows as EventRow[]).slice(-QUEUE_MAX) : [];
  } catch {
    return [];
  }
}

/** The queue in localStorage, under its own key. */
export const browserAnalyticsStore = (key = 'kingdom.analytics'): AnalyticsStore => ({
  load: () => { try { return localStorage.getItem(key); } catch { return null; } },
  save: (t) => { try { localStorage.setItem(key, t); } catch { /* private window */ } },
});
