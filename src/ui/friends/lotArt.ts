// A lot on the wish board (sim/trade.ts), drawn: a precious material's icon
// with its lot size, or a relic's picture with a shard on its corner and
// which fragment it is — a piece, or the keystone in gold.

import { ARTIFACTS, TRADE } from '../../sim/data/definitions';
import { KEYSTONE } from '../../sim/relics';
import type { TradeLot } from '../../sim/trade';
import { spriteImgAt, spriteUrl } from '../../render/sprites';
import { el, formatExact } from '../format';
import { iconEl } from '../kit';

/** What a lot is called: *Starmetal ×5*, *Verdant Seal piece 3*, *Verdant
 *  Seal keystone*. */
export function lotWords(l: TradeLot): string {
  if (l.kind === 'material') return `${l.id} ×${formatExact(TRADE.materialLot)}`;
  return `${ARTIFACTS[l.relic].name} ${l.slot === KEYSTONE ? 'keystone' : `piece ${formatExact(l.slot + 1)}`}`;
}

/** The lot's picture alone. */
export function lotArt(l: TradeLot): HTMLElement {
  if (l.kind === 'material') return el('span', { class: 'wb-art' }, iconEl(l.id, { size: 'lg' }));
  const def = ARTIFACTS[l.relic];
  const url = spriteUrl(def.sprite);
  // The fragment's own piece of the relic (relicSheet `fragmentArt`); the
  // relic with the generic shard while it has none.
  const piece = spriteUrl(`${def.sprite}_frag${l.slot}`);
  return el('span', { class: `wb-art is-fragment${l.slot === KEYSTONE ? ' is-keystone' : ''}` },
    ...(piece !== null ? [spriteImgAt(piece, 'wb-relic')] : [
      url ? spriteImgAt(url, 'wb-relic') : el('span', { class: 'wb-relic is-glyph' }, def.glyph),
      el('span', { class: 'wb-shard' }, iconEl('shard', { size: 'sm' }))]));
}

/** The lot as a tile: its picture, its name, and a line under it. */
export function lotTile(l: TradeLot, opts: { note?: string; count?: number } = {}): HTMLElement {
  return el('span', { class: 'wb-lot' },
    lotArt(l),
    ...(opts.count !== undefined && opts.count > 1 ? [el('b', { class: 'wb-count' }, `×${formatExact(opts.count)}`)] : []),
    el('span', { class: 'wb-lot-name' }, lotWords(l)),
    ...(opts.note === undefined ? [] : [el('span', { class: 'wb-lot-note' }, opts.note)]));
}
