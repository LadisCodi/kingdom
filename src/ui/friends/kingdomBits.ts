// Pieces every friends screen draws a kingdom with: its crest, the tag that
// says how far it has come, and the round buttons of a request.

import { el, formatExact } from '../format';
import { iconEl } from '../kit';

/** The heraldic fields a crest is painted in. */
const TINCTURES = ['gules', 'azure', 'vert', 'purpure', 'sable', 'tenne', 'murrey', 'celeste'] as const;

/** A kingdom's crest: a shield in a field of its own, its initial on it.
 *  The field is picked from the friend code, so a kingdom keeps its colours
 *  on every screen and every device. */
export function crestEl(nickname: string, code: string, size: 'md' | 'lg' = 'md'): HTMLElement {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tincture = TINCTURES[h % TINCTURES.length];
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? '?';
  return el('span', { class: `fr-crest is-${tincture} is-${size}`, 'aria-hidden': 'true' },
    el('span', { class: 'fr-crest-letter' }, initial));
}

/** Which colour band a Townhall's level falls in: one per art tier pair. */
export const townhallBand = (level: number): number => Math.min(4, Math.max(0, Math.floor((level - 1) / 2)));

/** How far a kingdom has come: its Townhall, on a pill coloured by band. */
export function townhallTag(level: number): HTMLElement {
  return el('span', { class: `fr-th is-band-${townhallBand(level)}` },
    iconEl('Townhall', { size: 'sm' }),
    `Townhall ${formatExact(level)}`);
}
