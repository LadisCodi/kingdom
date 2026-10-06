// The offers floating on the map (Docs/features/14-monetization.md §2.6): an
// offer with `widget` stands under the Survey's widget, top left, as its own
// icon over a small wooden sign whose words scroll by — the offer's name, the
// time to tomorrow's part, or "Claim!". A tap opens the offer's splash.
//
// Built again only when the set of offers changes; the sign's words are
// written in place on every notify, so its scroll never restarts.

import type { Game, OfferWidget } from '../game';
import { HEROES } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatCountdown } from './format';
import { setHidden } from './domWrite';

/** The icon: the offer's own art, or — until it lands — its hero's bust on
 *  the gold reward tile. */
function icon(w: OfferWidget): HTMLElement {
  const url = spriteUrl(w.sprite);
  if (url !== null) return spriteImgAt(url, 'ofw-icon');
  const bust = w.hero === null ? null : spriteUrl(`${HEROES[w.hero].sprite}_avatar`);
  return el('span', { class: 'ofw-icon is-fallback' }, ...(bust === null ? [] : [spriteImgAt(bust, 'ofw-bust')]));
}

/** What the sign says. */
function words(game: Game, w: OfferWidget): string {
  if (w.state === 'ready') return 'Claim!';
  const left = Math.max(0, Math.ceil((w.at - game.now()) / 1000));
  if (w.state === 'waiting') return `Tomorrow in ${formatCountdown(left)}`;
  return w.at > 0 ? `${w.name} · ${formatCountdown(left)}` : w.name;
}

export function mountOfferWidgets(game: Game, root: HTMLElement): void {
  let key = '';
  let signs: Array<{ w: OfferWidget; texts: HTMLElement[]; node: HTMLElement }> = [];

  const build = (list: OfferWidget[]): void => {
    signs = list.map((w) => {
      // The words twice, one after the other, so the scroll loops without a
      // seam: the track moves by exactly one copy and starts again.
      const texts = [el('span', { class: 'ofw-text' }, ''), el('span', { class: 'ofw-text', 'aria-hidden': 'true' }, '')];
      const node = el('button', { class: 'ofw', type: 'button', 'aria-label': w.name },
        icon(w),
        el('span', { class: 'ofw-dot', 'aria-hidden': 'true' }),
        el('span', { class: 'ofw-sign' }, el('span', { class: 'ofw-track' }, ...texts)));
      node.addEventListener('click', () => game.openOfferSplash(w.sku));
      return { w, texts, node };
    });
    root.replaceChildren(...signs.map((s) => s.node));
  };

  const refresh = (): void => {
    const list = game.offerWidgets();
    const showing = list.length > 0 && !game.hasOpenSheet() && game.offerSplashOnScreen() === null;
    setHidden(root, !showing);
    if (!showing) return;
    const next = list.map((w) => `${w.sku}:${w.state}`).join('|');
    if (next !== key) {
      key = next;
      build(list);
    }
    list.forEach((w, i) => {
      const sign = signs[i];
      if (sign === undefined) return;
      const text = words(game, w);
      for (const t of sign.texts) if (t.textContent !== text) t.textContent = text;
      sign.node.classList.toggle('is-ready', w.state === 'ready');
    });
  };

  game.onChange(refresh);
  refresh();
}
