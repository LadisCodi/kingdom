// Pointer input: distinguishes taps from camera drags from GHOST drags;
// wheel/pinch zooms. Taps that start over HTML UI never reach the canvas
// (the UI sits on top).
//
// A drag does one of two things, decided entirely at pointerdown: if the
// press landed on the building ghost, the drag moves the ghost; otherwise it
// pans the camera. Deciding once, on press, is what stops the two gestures
// fighting mid-flick — the alternative (hit-testing every move) would hand
// the ghost off to the camera the instant the finger left it.
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
//
// A SECOND finger turns the gesture into a pinch: the pair zooms about its
// midpoint and pans with it, so the ground under the fingers stays under
// them. A pinch ends the gesture as a tap, a hold and a ghost drag alike —
// lifting one finger leaves the other panning, and nothing fires on release.

import type { Camera } from './camera';

const DRAG_THRESHOLD_PX = 8;
const HOLD_START_MS = 350;
const HOLD_REPEAT_MS = 100;

export function wireInput(
  canvas: HTMLCanvasElement,
  /** What a gesture moves: the province's camera, or the world board's. */
  camera: Pick<Camera, 'panByScreen' | 'zoomAbout' | 'zoomBy'>,
  onTap: (sx: number, sy: number) => void,
  /** Returns true when the repeat consumed the gesture (it collected). */
  onHold: (sx: number, sy: number) => boolean,
  /** Does a drag from here grab the building ghost instead of the camera? */
  grabGhost: (sx: number, sy: number) => boolean,
  /** Drag the grabbed ghost to the pointer. */
  dragGhost: (sx: number, sy: number) => void,
  /** The finger took the ghost (true) or let it go (false). */
  holdGhost: (held: boolean) => void = () => {},
): void {
  let pointerDown = false;
  let dragged = false;
  let holdConsumed = false;
  let draggingGhost = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let holdTimer: number | null = null;
  let holdDelay: number | null = null;
  /** Every finger (or the mouse) currently down on the canvas. */
  const pointers = new Map<number, { x: number; y: number }>();
  /** The pinch under way: the first two fingers' spread and midpoint. */
  let pinch: { dist: number; mx: number; my: number } | null = null;

  const measurePinch = () => {
    const [a, b] = pointers.values();
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  };

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

  const startPinch = () => {
    stopHold();
    dragged = true; // no tap, no hold: the pinch owns the gesture now
    if (draggingGhost) holdGhost(false);
    draggingGhost = false;
    pinch = measurePinch();
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      startPinch();
      return;
    }
    if (pointers.size > 2) return;
    pointerDown = true;
    dragged = false;
    holdConsumed = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    stopHold();
    const rect = canvas.getBoundingClientRect();
    draggingGhost = grabGhost(e.clientX - rect.left, e.clientY - rect.top);
    if (draggingGhost) holdGhost(true);
    // A press on the ghost is never a hold-to-collect: there is nothing under
    // a ghost to harvest, and starting the timer would only race the drag.
    if (draggingGhost) return;
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
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (pointers.size < 2) return;
      const next = measurePinch();
      const rect = canvas.getBoundingClientRect();
      // Pan first, at the old zoom, so the ground under the old midpoint
      // lands under the new one; then zoom about that new midpoint.
      camera.panByScreen(next.mx - pinch.mx, next.my - pinch.my);
      camera.zoomAbout(next.mx - rect.left, next.my - rect.top, next.dist / pinch.dist);
      pinch = next;
      return;
    }
    if (!pointerDown) return;
    if (
      Math.abs(e.clientX - startX) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - startY) > DRAG_THRESHOLD_PX
    ) {
      dragged = true;
    }
    if (dragged) {
      if (draggingGhost) {
        const rect = canvas.getBoundingClientRect();
        dragGhost(e.clientX - rect.left, e.clientY - rect.top);
      } else {
        camera.panByScreen(e.clientX - lastX, e.clientY - lastY);
      }
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  const release = (e: PointerEvent, cancelled: boolean) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pinch) {
      if (pointers.size >= 2) {
        pinch = measurePinch(); // a third finger lifted: re-anchor on the pair left
        return;
      }
      pinch = null;
      if (pointers.size === 1) {
        // The finger left behind carries on panning from where it is.
        const [p] = pointers.values();
        lastX = p.x;
        lastY = p.y;
        return;
      }
    }
    if (pointers.size > 0) return;
    stopHold();
    // A drag that never crossed the threshold is still a tap, ghost or not —
    // tapping the ghost where it stands should not be swallowed.
    if (!cancelled && pointerDown && !dragged && !holdConsumed) {
      // Camera math expects canvas-relative coords; the canvas sits inside
      // the centered #app frame, so clientX/Y are offset from it.
      const rect = canvas.getBoundingClientRect();
      onTap(e.clientX - rect.left, e.clientY - rect.top);
    }
    pointerDown = false;
    if (draggingGhost) holdGhost(false);
    draggingGhost = false;
  };

  canvas.addEventListener('pointerup', (e) => release(e, false));
  canvas.addEventListener('pointercancel', (e) => release(e, true));

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );
}
