// Where a trainee's art comes from, for every widget that draws one.
//
// A unit ships TWO files (Docs/art/portraits/unit-blocks.md §2): the whole
// figure at 2:3, and a square bust cropped from the same master. Which one a
// widget wants is decided by its SIZE, not by its screen — a standing figure
// in a 48px slot is a smudge, and a bust in a panel that has room for a body
// wastes the art. So the choice is named at the call site and the fallbacks
// live here, once.
//
// A VILLAGER is a trainee too — the Townhall turns them out on the same block
// the halls use for soldiers — but it is not in the UNITS table, so its stem
// is named here rather than read from a row. Its files follow the troops'
// naming (`unit_villager`, `unit_villager_avatar`) so the same two-file rule
// and the same crop tool apply (unit-blocks.md §3).
//
// The floor is the atlas cell, never the emoji: `tests/icons.test.ts` exists to
// keep that true, and it is why these return an `iconEl` rather than a glyph.
//
// Its own module because three screens draw troops now — the battle picker,
// the battle sheet's squad slots and the training section — and the helper used
// to live in `battlePicker`, which is a MOUNT. A mount is a bad place to import
// a function from.

import { UNITS } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { TrainableId } from '../sim/state';
import { iconEl } from './kit';
import type { IconName } from './kit/icon';

const img = (url: string, cls: string): HTMLElement => spriteImgAt(url, cls);

/** The asset stem a trainee's two files are named by. */
const stemOf = (trainee: TrainableId): string =>
  (trainee === 'Villager' ? 'unit_villager' : UNITS[trainee].sprite);

/** The atlas cell drawn while the art is missing — a crowd for a villager,
 *  the unit's own silhouette for a soldier. */
const iconOf = (trainee: TrainableId): IconName =>
  (trainee === 'Villager' ? 'population' : trainee);

/**
 * The bust — head and shoulders, square. For anything drawn at roughly 48–72px:
 * squad slots, the picker card, the training picker and queue.
 *
 * Falls back to the whole figure before the atlas, because a small full body
 * still beats a 16px silhouette while a set is half-finished.
 */
export function unitBust(trainee: TrainableId, cls: string): HTMLElement {
  const stem = stemOf(trainee);
  const url = spriteUrl(`${stem}_avatar`) ?? spriteUrl(stem);
  return url ? img(url, cls) : iconEl(iconOf(trainee), { size: 'lg' });
}

/**
 * The whole figure, 2:3. For a panel with room for one — the training detail,
 * where the player is reading about the trainee rather than counting it.
 *
 * The container must be TALLER than it is wide or the figure letterboxes into
 * nothing; `.tr-portrait.is-body` is that shape.
 */
export function unitBody(trainee: TrainableId, cls: string): HTMLElement {
  const stem = stemOf(trainee);
  const url = spriteUrl(stem) ?? spriteUrl(`${stem}_avatar`);
  return url ? img(url, cls) : iconEl(iconOf(trainee), { size: 'lg' });
}
