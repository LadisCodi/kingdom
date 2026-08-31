// Pointer input: distinguishes taps from camera drags; wheel/pinch zooms.
// Taps that start over HTML UI never reach the canvas (the UI sits on top).

import type { Camera } from './camera';

const DRAG_THRESHOLD_PX = 8;

export function wireInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  onTap: (sx: number, sy: number) => void,
): void {
  let pointerDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    dragged = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
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
    if (pointerDown && !dragged) {
      // Camera math expects canvas-relative coords; the canvas sits inside
      // the centered #app frame, so clientX/Y are offset from it.
      const rect = canvas.getBoundingClientRect();
      onTap(e.clientX - rect.left, e.clientY - rect.top);
    }
    pointerDown = false;
  });

  canvas.addEventListener('pointercancel', () => {
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
