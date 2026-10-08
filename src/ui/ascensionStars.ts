// A HERO'S ASCENSION, as the stars the player counts rather than a number
// they read (Docs/features/10-heroes.md §4). Each star is the empty socket
// with the gold star laid over it, and a conic mask uncovers one petal per
// point filled, clockwise from the top (Docs/art/ui/ascension/). Every point
// of every star is one ascension; the stars before the current one are full,
// the ones after it empty.

import { HERO_LADDER } from '../sim/data/definitions';
import { fullStars, maxAscension } from '../sim/heroLadder';
import { el, formatExact } from './format';
import { tr, trn } from '../i18n/tr';

export function ascensionStars(ascension: number, cls = ''): HTMLElement {
  const per = HERO_LADDER.ascensionStepsPerStar;
  const row = el('span', {
    class: `asc-stars${cls ? ` ${cls}` : ''}`,
    style: `--asc-steps: ${per}`,
    role: 'img',
    'aria-label': ascensionLabel(ascension),
  });
  for (let i = 0; i < HERO_LADDER.ascensionStars; i++) {
    const points = Math.max(0, Math.min(per, ascension - i * per));
    row.append(el('span', {
      class: `asc-star${points === per ? ' is-full' : ''}`,
      style: `--asc-points: ${points}`,
      'aria-hidden': 'true',
    }));
  }
  return row;
}

/** "2 stars and 3 points" — what a screen reader hears for the row. */
export function ascensionLabel(ascension: number): string {
  if (ascension >= maxAscension()) return tr('Fully ascended');
  const stars = fullStars(ascension);
  const points = ascension - stars * HERO_LADDER.ascensionStepsPerStar;
  const s = trn(stars, '{n} star', '{n} stars', { n: formatExact(stars) });
  return points === 0 ? s
    : tr('{stars} and {points}', { stars: s, points: trn(points, '{n} point', '{n} points', { n: formatExact(points) }) });
}
