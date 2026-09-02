// Pointer input: distinguishes taps from camera drags; wheel/pinch zooms.
// Taps that start over HTML UI never reach the canvas (the UI sits on top).
//
// A press becomes a HOLD only after HOLD_START_MS, then auto-repeats. Two
// rules keep a hold and a tap from both firing for one gesture — since
// manual taps are deliberately not cooldown-gated, a double-fire would mean
// one press collecting twice:
//   1. the first repeat waits out HOLD_START_MS, longer than any real tap;
//   2. if a repeat actually DID something (onHold returned true), the tap on
//      release is suppressed — the hold already consumed the gesture.
// A repeat that did nothing (held over empty ground, or waiting out the
// auto-tap cooldown) leaves the release-tap alone, so pressing a building
// still opens its card.

import type { Camera } from './camera';

const DRAG_THRESHOLD_PX = 8;
const HOLD_START_MS = 350;
const HOLD_REPEAT_MS = 100;

export function wireInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  onTap: (sx: number, sy: number) => void,
  /** Returns true when the repeat consumed the gesture (it collected). */
  onHold: (sx: number, sy: number) => boolean,
): void {
  let pointerDown = false;
  let dragged = false;
  let holdConsumed = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let holdTimer: number | null = null;
  let holdDelay: number | null = null;

  const stopHold = () => {
    if (holdTimer !== null) {
      clearInterval(holdTimer);
      holdTimer = null;
    }
    if (holdDelay !== null) {
      clearTimeout(holdDelay);
      holdDelay = null;
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    dragged = false;
    holdConsumed = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    stopHold();
    const repeat = () => {
      if (!pointerDown || dragged) return;
      const rect = canvas.getBoundingClientRect();
      if (onHold(lastX - rect.left, lastY - rect.top)) holdConsumed = true;
    };
    holdDelay = window.setTimeout(() => {
      holdDelay = null;
      repeat();
      holdTimer = window.setInterval(repeat, HOLD_REPEAT_MS);
    }, HOLD_START_MS);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointerDown) return;
    if (
      Math.abs(e.clientX - startX) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - startY) > DRAG_THRESHOLD_PX
    ) {
      dragged = true;
    }
    if (dragged) {
      camera.panByScreen(e.clientX - lastX, e.clientY - lastY);
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('pointerup', (e) => {
    stopHold();
    if (pointerDown && !dragged && !holdConsumed) {
      // Camera math expects canvas-relative coords; the canvas sits inside
      // the centered #app frame, so clientX/Y are offset from it.
      const rect = canvas.getBoundingClientRect();
      onTap(e.clientX - rect.left, e.clientY - rect.top);
    }
    pointerDown = false;
  });

  canvas.addEventListener('pointercancel', () => {
    stopHold();
    pointerDown = false;
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );
}
