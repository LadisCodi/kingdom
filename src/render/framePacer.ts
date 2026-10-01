// HOW OFTEN THE MAP IS REDRAWN.
//
// The map is a full repaint, so every frame costs the same whether anything
// moved or not. A finger on the glass gets the display's own rate — a pan
// that lags the thumb reads as broken. Left alone, the only motion is the
// ambient kind (walk cycles, bobbing bubbles, a spell's shimmer), and that
// reads the same at 30. Under a menu the map is scenery behind a dim, and
// slower still.

/** The rate while nothing is being touched. */
export const IDLE_FPS = 30;
/** The rate while a menu or sheet stands over the map. */
export const COVERED_FPS = 15;
/** How long after the last touch, or the last camera move, the map stays at
 *  the full rate — long enough to cover a tap's punch and a glide's tail. */
export const ACTIVE_HOLD_MS = 800;
/** Slack under the idle interval, a quarter of a 60 Hz frame: a 60 Hz display
 *  then lands on every other frame instead of drifting between one and three. */
const SLACK_MS = 4;

export interface Pace {
  now: number;
  /** When the map was last drawn. */
  lastDraw: number;
  /** When the player last touched it, or the camera last moved. */
  lastActive: number;
  /** A menu or sheet is over the map. */
  covered: boolean;
}

/** Should this animation frame redraw the map? */
export function shouldDraw({ now, lastDraw, lastActive, covered }: Pace): boolean {
  if (now - lastActive < ACTIVE_HOLD_MS) return true;
  const fps = covered ? COVERED_FPS : IDLE_FPS;
  return now - lastDraw >= 1000 / fps - SLACK_MS;
}
