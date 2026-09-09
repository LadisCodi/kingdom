// Where a troop's art comes from, for every widget that draws one.
//
// A unit ships TWO files (Docs/art/portraits/unit-blocks.md §2): the whole
// soldier at 2:3, and a square bust cropped from the same master. Which one a
// widget wants is decided by its SIZE, not by its screen — a standing figure
// in a 48px slot is a smudge, and a bust in a panel that has room for a body
// wastes the art. So the choice is named at the call site and the fallbacks
// live here, once.
//
// The floor is the atlas cell, never the emoji: `tests/icons.test.ts` exists to
// keep that true, and it is why these return an `iconEl` rather than a glyph.
//
// Its own module because three screens draw troops now — the battle picker,
// the battle sheet's squad slots and the training section — and the helper used
// to live in `battlePicker`, which is a MOUNT. A mount is a bad place to import
// a function from.

import { UNITS } from '../sim/data/definitions';
import { spriteUrl } from '../render/sprites';
import type { UnitId } from '../sim/state';
import { el } from './format';
import { iconEl } from './kit';

const img = (url: string, cls: string): HTMLElement =>
  el('img', { class: cls, src: url, alt: '' });

/**
 * The bust — head and shoulders, square. For anything drawn at roughly 48–72px:
 * squad slots, the picker card, the training picker.
 *
 * Falls back to the whole soldier before the atlas, because a small full body
 * still beats a 16px silhouette while a set is half-finished.
 */
export function unitBust(unitId: UnitId, cls: string): HTMLElement {
  const { sprite } = UNITS[unitId];
  const url = spriteUrl(`${sprite}_avatar`) ?? spriteUrl(sprite);
  return url ? img(url, cls) : iconEl(unitId, { size: 'lg' });
}

/**
 * The whole soldier, 2:3. For a panel with room for one — the training detail,
 * where the player is reading about the unit rather than counting it.
 *
 * The container must be TALLER than it is wide or the figure letterboxes into
 * nothing; `.tr-portrait.is-body` is that shape.
 */
export function unitBody(unitId: UnitId, cls: string): HTMLElement {
  const { sprite } = UNITS[unitId];
  const url = spriteUrl(sprite) ?? spriteUrl(`${sprite}_avatar`);
  return url ? img(url, cls) : iconEl(unitId, { size: 'lg' });
}
