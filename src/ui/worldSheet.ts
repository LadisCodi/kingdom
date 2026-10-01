// THE WORLD BEYOND — what the Watchtower's door opens onto until the world map
// is built (Docs/features/22-progression.md §5).
//
// A sheet of parchment with the board drawn on it in ink: the shared lattice
// of hexes, our province as one of them, five neighbours under a wash of fog
// and the Dark Portal at the heart (Docs/features/19-world-map.md §1). It
// promises the shape and says plainly that the roads are still being
// scouted — a door that opens onto a sign, not onto nothing.

import type { Game } from '../game';
import { el } from './format';
import { sheet } from './kit';

/** Rings of the board: 91 hexes is a radius of five (19-world-map.md §1). */
const RADIUS = 5;
/** Where the six kingdoms sit — the second ring from the rim, a hex apart. */
const KINGDOMS: ReadonlyArray<[number, number]> = [
  [0, -4], [4, -4], [4, 0], [0, 4], [-4, 4], [-4, 0],
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string | number>): SVGElement => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** A pointy-top hex's corners, centred on (cx, cy). */
const hexPoints = (cx: number, cy: number, r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

function boardDrawing(): SVGElement {
  const r = 16;
  const w = Math.sqrt(3) * r;
  const size = (RADIUS * 2 + 1) * w + 8;
  const root = svg('svg', {
    viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`,
    class: 'world-board', role: 'img', 'aria-label': 'The world map, still in fog',
  });
  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let s = -RADIUS; s <= RADIUS; s++) {
      if (Math.abs(q + s) > RADIUS) continue;
      const cx = w * (q + s / 2);
      const cy = 1.5 * r * s;
      const ours = q === KINGDOMS[3][0] && s === KINGDOMS[3][1];
      const kingdom = KINGDOMS.some(([kq, ks]) => kq === q && ks === s);
      const portal = q === 0 && s === 0;
      const kind = ours ? 'is-ours' : portal ? 'is-portal' : kingdom ? 'is-kingdom' : 'is-wild';
      root.append(svg('polygon', { points: hexPoints(cx, cy, r - 1), class: `world-hex ${kind}` }));
      if (kingdom && !ours) {
        // A rival's banner, half lost in the fog.
        root.append(svg('path', {
          d: `M${cx - 3},${cy + 6} L${cx - 3},${cy - 8} L${cx + 6},${cy - 5} L${cx - 3},${cy - 2}`,
          class: 'world-flag',
        }));
      }
    }
  }
  const [oq, os] = KINGDOMS[3];
  const ox = w * (oq + os / 2);
  const oy = 1.5 * r * os;
  root.append(svg('circle', { cx: ox, cy: oy, r: 6, class: 'world-home' }));
  root.append(svg('circle', { cx: 0, cy: 0, r: 7, class: 'world-portal' }));
  return root;
}

export function renderWorldSheet(game: Game): HTMLElement {
  return sheet({ title: 'The world beyond', onClose: () => game.dismiss() },
    el('div', { class: 'world-sheet' },
      boardDrawing(),
      el('div', { class: 'world-key' },
        el('span', { class: 'world-key-home' }, 'Your province'),
        el('span', { class: 'world-key-rival' }, 'Other kingdoms'),
        el('span', { class: 'world-key-portal' }, 'The Dark Portal')),
      el('p', { class: 'world-line' },
        'From the Watchtower the land runs on past the mountains, and other banners fly out there. '
        + 'The roads beyond are still being scouted.'),
      el('p', { class: 'world-line world-soon' }, 'The world map opens soon.')));
}
