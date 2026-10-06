// Pieces every friends screen draws a kingdom with: its crest, and the tag
// that says how far it has come.

import { crestOf, type Crest } from '../../sim/crest';
import { chargeUrl, fieldUrl } from '../crestArt';
import { el, formatExact } from '../format';
import { iconEl } from '../kit';

/** A kingdom's crest: its field, its charge on it (sim/crest.ts) — the
 *  one it chose, else the one its nickname picks. The initial is there for
 *  a screen reader; the charge is the mark. */
export function crestEl(nickname: string, crest: string | null, size: 'md' | 'lg' | 'xl' = 'md'): HTMLElement {
  return crestOfEl(crestOf(nickname, crest), size, [...nickname.trim()][0]?.toUpperCase() ?? '?');
}

/** A crest drawn as given — the editor's preview and its choices. */
export function crestOfEl(c: Crest, size: 'sm' | 'md' | 'lg' | 'xl' = 'md', letter = ''): HTMLElement {
  const layer = (cls: string, url: string | null): HTMLElement =>
    el('span', { class: cls, ...(url === null ? {} : { style: `background-image: url('${url}')` }) });
  return el('span', { class: `fr-crest is-${c.tincture} is-${size}`, 'aria-hidden': 'true' },
    layer('fr-crest-field', fieldUrl(c.tincture)),
    layer('fr-crest-charge', chargeUrl(c.charge)),
    ...(letter === '' ? [] : [el('span', { class: 'fr-crest-letter' }, letter)]));
}

/** Which colour band a Townhall's level falls in: one per art tier pair. */
export const townhallBand = (level: number): number => Math.min(4, Math.max(0, Math.floor((level - 1) / 2)));

/** How far a kingdom has come: its Townhall, on a pill coloured by band. */
export function townhallTag(level: number): HTMLElement {
  return el('span', { class: `fr-th is-band-${townhallBand(level)}` },
    iconEl('Townhall', { size: 'sm' }),
    `Townhall ${formatExact(level)}`);
}
