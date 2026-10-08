// A buzz in the hand for the moments that land hard (the battle playback's
// heavy blows, wipes and verdict). Where the device has no vibration — iOS
// Safari, a desktop — it is nothing, and so it is for a player who asked for
// reduced motion: a shake is motion too.

const calm = (): boolean => typeof window === 'undefined'
  || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/** Never two buzzes closer than this (ms): a burst of blows is one. */
const GAP_MS = 120;
let last = 0;

export function haptic(pattern: number | number[]): void {
  const now = performance.now();
  if (now - last < GAP_MS || calm() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  last = now;
  try {
    navigator.vibrate(pattern);
  } catch { /* refused (no gesture yet, a frame without permission) — nothing */ }
}
