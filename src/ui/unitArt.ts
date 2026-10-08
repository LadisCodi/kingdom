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

import { TROOPS, rankOf, unitOf } from '../sim/data/definitions';
import { ROMAN_RANK } from '../sim/data/techTreeRules';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el } from './format';
import { tr } from '../i18n/tr';
import type { TrainableId, TroopId } from '../sim/state';
import { iconEl } from './kit';
import type { IconName } from './kit/icon';
import BUST_FRAMING from './bustFraming.json';

const img = (url: string, cls: string): HTMLElement => spriteImgAt(url, cls);

/** The asset stem a trainee's two files are named by. */
const stemOf = (trainee: TrainableId): string =>
  (trainee === 'Villager' ? 'unit_villager' : TROOPS[trainee].sprite);

/** The atlas cell drawn while the art is missing — a crowd for a villager,
 *  the unit's own silhouette for a soldier. */
const iconOf = (trainee: TrainableId): IconName =>
  (trainee === 'Villager' ? 'population' : unitOf(trainee));

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

/**
 * A UNIT'S ROUND PORTRAIT, built in three layers so any bust can go in it
 * (kit.css `.k-portrait`):
 *
 *   base   the round paper disc and its outline — the portrait's own frame;
 *   mask   a circle inside it that clips whatever sits under it;
 *   icon   the unit's bust, drawn a little larger than the mask, so a bust
 *          that carries a medallion of its own (the soldiers' do) has that
 *          ring cut away and every unit reads the same.
 *
 * Its size is the caller's `--portrait-size`; everything inside scales with it.
 */
export function unitPortrait(trainee: TrainableId, cls = ''): HTMLElement {
  return portraitFrame(unitBust(trainee, 'k-portrait-art'), trainee === 'Villager' ? null : trainee, cls);
}

/**
 * Any bust in the round frame, with its RANK when it is above I: the brass
 * coin over the bottom-right with the numeral pressed into it
 * (Docs/features/combat.md §6.5). The numeral is the UI's, never the art's,
 * so an enemy creature at a rank wears the same coin.
 */
export function portraitFrame(face: HTMLElement, troop: TroopId | null, cls = ''): HTMLElement {
  const badge = troop === null ? null : rankBadge(troop);
  const frame = el('span', { class: `k-portrait${cls ? ` ${cls}` : ''}` },
    el('span', { class: 'k-portrait-mask' }, face),
    ...(badge === null ? [] : [badge]));
  const framing = FRAMING_BY_URL.get(face.getAttribute('data-sprite') ?? '');
  if (framing !== undefined) {
    frame.style.setProperty('--bust-dx', String(framing.dx));
    frame.style.setProperty('--bust-dy', String(framing.dy));
    frame.style.setProperty('--bust-scale', String(framing.scale));
  }
  return frame;
}

/**
 * HOW EACH BUST SITS IN THE ROUND FRAME, by sprite (`bustFraming.json`):
 * scaled about its bottom centre, then moved `dx`/`dy` pixels of its 256px
 * file. Set by eye, bust by bust, so every face sits at the same height in
 * the circle. Only the frame reads it — a squad slot or a banner shows the
 * file as it is — which is why the PNGs are not re-cut to match.
 */
const FRAMING_BY_URL = new Map(
  Object.entries(BUST_FRAMING as Record<string, { dx: number; dy: number; scale: number }>)
    .flatMap(([key, f]) => {
      const url = spriteUrl(key);
      return url === null ? [] : [[url, f] as const];
    }),
);

/** The rank coin alone, or null at rank I. */
export function rankBadge(troop: TroopId): HTMLElement | null {
  const rank = rankOf(troop);
  if (rank <= 1) return null;
  // The numeral is an SVG so it scales with the coin, whatever size the frame
  // is given (a percentage in a slot, pixels on a card): a light copy one
  // unit down is the lip the light catches under a struck letter.
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  const size = ROMAN_RANK[rank].length > 2 ? 17 : 21;
  for (const [cls, dy] of [['k-rank-lip', 1.4], ['k-rank-cut', 0]] as const) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', '20');
    t.setAttribute('y', String(21 + dy));
    t.setAttribute('class', cls);
    t.setAttribute('font-size', String(size));
    t.textContent = ROMAN_RANK[rank];
    svg.append(t);
  }
  return el('b', { class: 'k-rank', role: 'img', 'aria-label': tr('Rank {rank}', { rank: ROMAN_RANK[rank] }) }, svg as unknown as HTMLElement);
}
