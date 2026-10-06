// THE SHIELD EDITOR (Docs/features/15-social.md §2.2): the pencil on the
// player's own card opens it over the friends list. The crest large, then
// its field and its charge, each picked by a tap and shown at once; Save
// keeps it, and the X leaves it as it was. Every choice is free.

import type { Game } from '../../game';
import { CHARGES, CHARGE_NAMES, TINCTURES, TINCTURE_NAMES, type Crest } from '../../sim/crest';
import { el } from '../format';
import { btn, sectionHead, sheet } from '../kit';
import { crestOfEl } from './kingdomBits';

export function renderCrestEditor(game: Game): HTMLElement {
  const f = game.friends;
  const draft = f.crestDraft ?? game.myCrest();
  const pick = (next: Crest): void => { f.crestDraft = next; game.notify(); };
  const choice = (label: string, picked: boolean, art: HTMLElement, next: Crest): HTMLElement => {
    const b = el('button', {
      class: `fr-pick${picked ? ' is-picked' : ''}`, type: 'button', 'aria-label': label, 'aria-pressed': picked ? 'true' : 'false',
    }, art);
    b.addEventListener('click', () => pick(next));
    return b;
  };
  const fields = TINCTURES.map((t) => choice(TINCTURE_NAMES[t], t === draft.tincture,
    crestOfEl({ tincture: t, charge: draft.charge }, 'sm'), { ...draft, tincture: t }));
  const charges = CHARGES.map((c) => choice(CHARGE_NAMES[c], c === draft.charge,
    crestOfEl({ tincture: draft.tincture, charge: c }, 'sm'), { ...draft, charge: c }));
  return sheet({ title: 'Your crest', onClose: () => f.closeCrestEditor(), centred: true },
    el('div', { class: 'fr-crest-ed' },
      el('div', { class: 'fr-crest-ed-preview' }, crestOfEl(draft, 'xl')),
      el('div', { class: 'fr-crest-ed-name' }, game.state.kingdom.profile.nickname ?? ''),
      sectionHead('Field'),
      el('div', { class: 'fr-picks' }, ...fields),
      sectionHead('Charge'),
      el('div', { class: 'fr-picks is-charges' }, ...charges),
      btn({ label: 'Save', kind: 'primary', onClick: () => f.saveCrest() })));
}
