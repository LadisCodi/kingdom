// MAKING A WISH, AND FILLING ONE (Docs/features/15-social.md §2.4).
//
// A wish is made in two windows, one after the other (M78):
//  1. What do you need? — one relic a row, its six slots across it, a
//     missing one picked; or a precious material.
//  2. What will you give? — only what pairs with the need, from the
//     player's duplicates and materials; what does not pair, or is held
//     once, greyed with why. Pin wish.
// And the window a fill opens: who, what went, what came.

import { fragmentArt } from '../relicSheet';
import type { Game } from '../../game';
import { ARTIFACT_ORDER, ARTIFACTS, TRADE } from '../../sim/data/definitions';
import { KEYSTONE, SLOTS, isMet, isRestored, slotCount } from '../../sim/relics';
import { canNeed, giveProblem, isKeystone, lotKey, pairs, type TradeLot } from '../../sim/trade';
import { PRECIOUS } from '../../sim/state';
import { spriteImgAt, spriteUrl } from '../../render/sprites';
import { el, formatExact } from '../format';
import { btn, iconEl, sectionHead, sheet } from '../kit';
import { crestEl } from './kingdomBits';
import { lotArt, lotTile, lotWords } from './lotArt';

// ------------------------------------------------------------ step 1

export function renderWishNeed(game: Game): HTMLElement {
  const f = game.friends;
  const s = game.state;
  const wished = new Set((f.snap?.wishes ?? []).map((w) => lotKey(w.need)));
  const pickable = (l: TradeLot) => canNeed(s, l) && !wished.has(lotKey(l));

  // Every relic met and not yet restored: one a row, its six slots across.
  const relics = ARTIFACT_ORDER.filter((id) => isMet(s, id) && !isRestored(s, id));
  const rows = relics.map((relic) => {
    const def = ARTIFACTS[relic];
    const url = spriteUrl(def.sprite);
    const slots = Array.from({ length: SLOTS }, (_, slot) => {
      const lot: TradeLot = { kind: 'fragment', relic, slot };
      const held = slotCount(s, relic, slot);
      const cls = `wb-slot${slot === KEYSTONE ? ' is-keystone' : ''}${held > 0 ? ' is-held' : ''}`;
      if (held > 0) return el('span', { class: cls, 'aria-label': `${slot === KEYSTONE ? 'Keystone' : `Piece ${slot + 1}`}: held` }, fragmentArt(def.sprite, slot, 'wb-frag'));
      const b = el('button', {
        class: `${cls} is-missing`, type: 'button',
        'aria-label': `Wish for ${def.name} ${slot === KEYSTONE ? 'keystone' : `piece ${slot + 1}`}`,
      }, fragmentArt(def.sprite, slot, 'wb-frag')) as HTMLButtonElement;
      if (pickable(lot)) b.addEventListener('click', () => f.pickNeed(lot));
      else b.disabled = true;
      return b;
    });
    return el('div', { class: 'wb-relic-row' },
      el('span', { class: 'wb-relic-art' }, url ? spriteImgAt(url, 'wb-relic') : el('span', { class: 'wb-relic is-glyph' }, def.glyph)),
      el('div', { class: 'wb-relic-body' },
        el('div', { class: 'wb-relic-name' }, def.name),
        el('div', { class: 'wb-slots' }, ...slots)));
  });

  const materials = PRECIOUS.map((id) => {
    const lot: TradeLot = { kind: 'material', id };
    const b = el('button', { class: 'wb-pick', type: 'button' }, lotTile(lot)) as HTMLButtonElement;
    if (pickable(lot)) b.addEventListener('click', () => f.pickNeed(lot));
    else {
      b.disabled = true;
      b.append(el('span', { class: 'wb-lot-note' }, 'Wished for already'));
    }
    return b;
  });

  return sheet({ title: 'What do you need?', onClose: () => f.closeWish(), tall: true },
    el('div', { class: 'wb-sheet' },
      el('p', { class: 'wb-step' }, 'Step 1 of 2'),
      ...(rows.length > 0
        ? [sectionHead('Relics'), el('div', { class: 'wb-relics' }, ...rows)]
        : [el('p', { class: 'fr-empty' }, 'No relic you have found is missing a fragment.')]),
      sectionHead('Materials'),
      el('div', { class: 'wb-grid is-three' }, ...materials)));
}

// ------------------------------------------------------------ step 2

export function renderWishGive(game: Game): HTMLElement {
  const f = game.friends;
  const s = game.state;
  const need = f.wishNeed;
  if (need === null) return renderWishNeed(game);

  /** A choice: pickable, or greyed with why. */
  const choice = (lot: TradeLot, count?: number): HTMLElement => {
    const problem = giveProblem(s, lot);
    const why = !pairs(need, lot)
      ? (isKeystone(lot) || isKeystone(need) ? 'Keystone only' : 'Not for itself')
      : problem === 'OnlyOne' ? 'Only 1' : problem === 'Bound' ? 'Bought, not found' : problem === 'NotEnough' ? 'Not enough' : null;
    const picked = f.wishGive !== null && lotKey(f.wishGive) === lotKey(lot);
    const b = el('button', {
      class: `wb-pick${picked ? ' is-picked' : ''}${why !== null ? ' is-out' : ''}`, type: 'button',
    }, lotTile(lot, { count, ...(why === null ? {} : { note: why }) })) as HTMLButtonElement;
    if (why === null) b.addEventListener('click', () => f.pickGive(lot));
    else b.disabled = true;
    return b;
  };

  // Every fragment held, duplicates first; a single one shows why it stays.
  const held: Array<{ lot: TradeLot; n: number }> = [];
  for (const relic of ARTIFACT_ORDER) {
    for (let slot = 0; slot < SLOTS; slot++) {
      const n = slotCount(s, relic, slot);
      if (n > 0) held.push({ lot: { kind: 'fragment', relic, slot }, n });
    }
  }
  held.sort((a, b) => Number(giveProblem(s, a.lot) !== null || !pairs(need, a.lot))
    - Number(giveProblem(s, b.lot) !== null || !pairs(need, b.lot)));

  const change = btn({ label: 'Change', onClick: () => f.openWishNeed() });
  const ready = f.wishGive !== null && pairs(need, f.wishGive) && giveProblem(s, f.wishGive) === null;
  return sheet({ title: 'What will you give?', onClose: () => f.closeWish(), tall: true },
    el('div', { class: 'wb-sheet' },
      el('p', { class: 'wb-step' }, 'Step 2 of 2'),
      el('div', { class: 'wb-need' }, el('span', {}, 'You need:'), lotTile(need), change),
      sectionHead('Your duplicates'),
      el('div', { class: 'wb-grid' }, ...(held.length > 0
        ? held.map((h) => choice(h.lot, h.n))
        : [el('p', { class: 'fr-empty' }, 'No relic fragments yet.')])),
      sectionHead('Materials'),
      el('div', { class: 'wb-grid is-three' }, ...PRECIOUS.map((id) => choice({ kind: 'material', id }))),
      el('p', { class: 'wb-held' }, iconEl('clock', { size: 'sm' }),
        `Held until a friend fills it, or for ${formatExact(TRADE.wishHours)} hours.`),
      btn({ label: 'Pin wish', kind: 'primary', onClick: () => void f.pinWish(), ...(ready ? {} : { disabledReason: 'Pick what you give' }) })));
}

// ------------------------------------------------------------ a fill

export function renderWishFilled(game: Game): HTMLElement {
  const f = game.friends;
  const done = f.justFilled;
  const close = (): void => f.closeFilled();
  if (done === null) return sheet({ title: 'Wish filled!', onClose: close, centred: true }, el('div', {}));
  return sheet({ title: 'Wish filled!', onClose: close, centred: true },
    el('div', { class: 'wb-filled' },
      crestEl(done.owner.nickname, done.owner.crest, 'lg'),
      el('div', { class: 'fr-name' }, done.owner.nickname),
      el('div', { class: 'wb-filled-row' }, el('span', {}, 'You gave'), lotArt(done.gave), el('b', {}, lotWords(done.gave))),
      el('div', { class: 'wb-filled-row is-got' }, el('span', {}, 'You got'), lotArt(done.got), el('b', {}, lotWords(done.got))),
      btn({ label: 'Great', kind: 'primary', onClick: close })));
}
