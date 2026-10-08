// A hero's fragment: the hero's face on a jigsaw piece in the colour of their
// rarity (Docs/art/ui/fragments/), `render/assets/<sprite>_fragment.png`.
// Every place a hero's fragments are counted draws this one — the roster
// card, the ascension price, the recruit price, the reveal, an offer — so a
// fragment always says WHOSE it is. The atlas's generic piece stands in until
// a hero's art lands.

import { HEROES } from '../sim/data/definitions';
import type { HeroId } from '../sim/state';
import { spriteUrl } from '../render/sprites';
import { el } from './format';
import { tr } from '../i18n/tr';
import { iconEl, type IconOpts } from './kit';

export function heroFragmentIcon(id: HeroId, opts: IconOpts = {}): HTMLElement {
  const def = HEROES[id];
  const url = spriteUrl(`${def.sprite}_fragment`);
  const label = opts.label ?? tr("{name}'s fragment", { name: def.name });
  if (url === null) return iconEl('fragment', { ...opts, label });
  const size = opts.size === 'sm' ? ' icon--sm' : opts.size === 'lg' ? ' icon--lg' : '';
  return el('img', {
    class: `icon hero-frag${size}${opts.locked ? ' is-locked' : ''}`,
    src: url, alt: label, draggable: 'false',
  });
}
