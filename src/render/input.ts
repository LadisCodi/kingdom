// Pointer input: distinguishes taps from camera drags; wheel/pinch zooms.
// Taps that start over HTML UI never reach the canvas (the UI sits on top).
// Holding (press without drag) repeats onHold — the sim's collect cooldown
// paces the actual collection, so the repeat rate here just needs to be finer.

import type { Camera } from './camera';

const DRAG_THRESHOLD_PX = 8;
const HOLD_REPEAT_MS = 100;

export function wireInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  onTap: (sx: number, sy: number) => void,
  onHold: (sx: number, sy: number) => void,
): void {
  let pointerDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let holdTimer: number | null = null;

  const stopHold = () => {
    if (holdTimer !== null) {
      clearInterval(holdTimer);
      holdTimer = null;
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    dragged = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    stopHold();
    holdTimer = window.setInterval(() => {
      if (!pointerDown || dragged) return;
      const rect = canvas.getBoundingClientRect();
      onHold(lastX - rect.left, lastY - rect.top);
    }, HOLD_REPEAT_MS);
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
    if (pointerDown && !dragged) {
      // Camera math expects canvas-relative coords; the canvas sits inside
      // the centered #app frame, so clientX/Y are offset from it.
      // (After a hold that already collected, this tap lands OnCooldown —
      // harmless.)
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
