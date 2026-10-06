// The world board on screen (Docs/features/19-world-map.md §1.2,
// Docs/art/art-direction.md §7): a pointy-top layout, tilted, two registers.
import { describe, expect, it } from 'vitest';
import { HexCamera } from '../src/render/world/hexCamera';
import {
  HEX_W, LABEL_MIN_HEX_W, STRATEGIC_W, TILT, labelShown, type WorldLabel, acrossEdge, edgeDir, hexCorners, hexToPlane, planeToHex, regionEdges,
} from '../src/render/world/hexLayout';
import { BOARD_HEXES, HEX_DIRS, WORLD_RADIUS, hexNeighbors } from '../src/sim/world/hex';

const phone = { clientWidth: 390, clientHeight: 844 };

describe('the hex layout', () => {
  it('lays hexes HEX_W apart across a row and 1.5 radii down, tilted', () => {
    expect(hexToPlane({ q: 1, r: 0 }).x - hexToPlane({ q: 0, r: 0 }).x).toBeCloseTo(HEX_W);
    const down = hexToPlane({ q: 0, r: 1 });
    expect(down.x).toBeCloseTo(HEX_W / 2);
    expect(down.y).toBeCloseTo((HEX_W / Math.sqrt(3)) * 1.5 * TILT);
    expect(TILT).toBeGreaterThan(0.5);
    expect(TILT).toBeLessThan(1);
  });

  it('finds every hex from its own centre and from near its corners', () => {
    for (const h of BOARD_HEXES) {
      const p = hexToPlane(h);
      expect(planeToHex(p.x, p.y)).toEqual(h);
      for (const c of hexCorners(p.x, p.y, (HEX_W / Math.sqrt(3)) * 0.9)) {
        expect(planeToHex(c.x, c.y)).toEqual(h);
      }
    }
  });

  it('names the neighbour across each edge', () => {
    // Edge 0 is the right-hand side: the neighbour to the east.
    expect(edgeDir(0)).toBe(0);
    const h = { q: 0, r: 0 };
    const across = [0, 1, 2, 3, 4, 5].map((k) => acrossEdge(h, k));
    expect(across.sort((a, b) => a.q - b.q || a.r - b.r))
      .toEqual(hexNeighbors(h).sort((a, b) => a.q - b.q || a.r - b.r));
    // Each edge's midpoint lies between the two hexes it separates.
    const corners = hexCorners(0, 0, 100);
    for (let k = 0; k < 6; k++) {
      const mid = { x: (corners[k].x + corners[(k + 1) % 6].x) / 2, y: (corners[k].y + corners[(k + 1) % 6].y) / 2 };
      const n = hexToPlane(HEX_DIRS[edgeDir(k)]);
      const len = Math.hypot(n.x, n.y);
      expect((mid.x * n.x + mid.y * n.y) / len).toBeGreaterThan(0);
    }
  });

  it('borders a region along its outside only', () => {
    expect(regionEdges([{ q: 0, r: 0 }])).toHaveLength(6);
    // Two neighbours share one edge, which neither draws.
    expect(regionEdges([{ q: 0, r: 0 }, { q: 1, r: 0 }])).toHaveLength(10);
  });
});

describe('the world camera', () => {
  it('draws a hex 130 px wide up close and ~45 px out', () => {
    const cam = new HexCamera(phone);
    cam.zoom = 1;
    expect(cam.hexWidth).toBeCloseTo(HEX_W);
    cam.zoomBy(0.01);
    expect(cam.hexWidth).toBeLessThanOrEqual(STRATEGIC_W);
    // Far enough out to see all eleven hexes across a phone.
    expect(cam.hexWidth * 11).toBeLessThanOrEqual(phone.clientWidth);
    cam.zoomBy(1000);
    expect(cam.zoom).toBe(cam.maxZoom);
  });

  it('round-trips every hex through the screen at both registers', () => {
    const cam = new HexCamera(phone);
    for (const zoom of [1, cam.minZoom]) {
      cam.zoom = zoom;
      cam.centerOnHex({ q: 1, r: 2 });
      for (const h of BOARD_HEXES) {
        const s = cam.hexToScreen(h);
        expect(cam.screenToHex(s.x, s.y)).toEqual(h);
      }
    }
  });

  it('keeps a fit asked for before the canvas has a size, and lets a gesture win over it', () => {
    const view = { clientWidth: 0, clientHeight: 0 };
    const cam = new HexCamera(view);
    cam.fitBoard();
    view.clientWidth = 390;
    view.clientHeight = 844;
    cam.settle();
    expect(cam.zoom).toBeCloseTo(cam.minZoom);

    view.clientWidth = 0;
    cam.fitBoard();
    view.clientWidth = 390;
    cam.zoomBy(2);
    const zoomed = cam.zoom;
    cam.settle();
    expect(cam.zoom).toBe(zoomed);
  });

  it("never lets the world slide off the screen", () => {
    const cam = new HexCamera(phone);
    cam.panByScreen(1e6, -1e6);
    expect(Math.abs(cam.x)).toBeLessThan(HEX_W * (WORLD_RADIUS + 1));
    expect(Math.abs(cam.y)).toBeLessThan(HEX_W * (WORLD_RADIUS + 1));
  });
});

describe('labels by importance (19 §1.2)', () => {
  it('everything shows in the tactical register, the least important go first as the camera goes out', () => {
    for (const label of Object.keys(LABEL_MIN_HEX_W) as WorldLabel[]) {
      expect(labelShown(label, HEX_W)).toBe(true);
      expect(labelShown(label, STRATEGIC_W)).toBe(false);
    }
    expect(LABEL_MIN_HEX_W.camp).toBeLessThan(LABEL_MIN_HEX_W.deposit);
    expect(LABEL_MIN_HEX_W.rival).toBeLessThan(LABEL_MIN_HEX_W.promise);
  });
});
