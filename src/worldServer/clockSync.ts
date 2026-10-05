// How far the server's clock runs ahead of this device's. The game keeps its
// time on the server's (Game.now), so a time the server sends — a build done,
// an army home — means the same thing on both sides.
//
// Each answer carries the server's time (`WorldSnapshot.at`). It was read
// somewhere between sending and receiving, so the guess is the middle of the
// round trip, and the error is at most half of it: the quickest recent round
// trip is the one to believe. Only the recent ones, so a device whose clock
// is changed under it is followed within a few answers.

/** How many recent round trips are weighed. */
const KEPT = 8;

export class ClockSync {
  private samples: Array<{ rtt: number; offset: number }> = [];

  /** One answer: when it was asked (device time), the server's time in it,
   *  and when it came back (device time). */
  observe(sentAt: number, serverAt: number, receivedAt: number): void {
    const rtt = Math.max(0, receivedAt - sentAt);
    this.samples.push({ rtt, offset: Math.round(serverAt - (sentAt + rtt / 2)) });
    if (this.samples.length > KEPT) this.samples.shift();
  }

  /** The best guess, in ms; 0 before any answer. */
  offset(): number {
    let best: { rtt: number; offset: number } | null = null;
    for (const s of this.samples) if (best === null || s.rtt < best.rtt) best = s;
    return best?.offset ?? 0;
  }
}
