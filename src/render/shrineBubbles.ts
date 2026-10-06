// WHERE EACH SLEEPING SHRINE'S BUBBLE LANDED on the last frame, in canvas
// CSS pixels (Docs/features/09-relics.md §11.6). The bubble floats over the
// Shrine and may sit over other cells, so a tap on it is resolved here — to
// its Shrine, whose card holds Activate — before the tap becomes a cell. The
// same registry the lairs' warning bubbles keep (render/lairMap.ts).

import type { ArtifactId } from '../sim/state';

const rects = new Map<ArtifactId, { x: number; y: number; w: number; h: number }>();

export function clearShrineBubbles(): void { rects.clear(); }

export function markShrineBubble(relic: ArtifactId, r: { x: number; y: number; w: number; h: number }): void {
  rects.set(relic, r);
}

/** The relic whose Mana bubble covers the screen point, or null. */
export function shrineBubbleAt(sx: number, sy: number): ArtifactId | null {
  for (const [relic, r] of rects) {
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return relic;
  }
  return null;
}
