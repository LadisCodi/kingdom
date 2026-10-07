// The offers on the map (Docs/features/14-monetization.md §2.6), grouped as
// one widget under the Survey's widget, top left: the icon of one offer —
// turning to the next each time its sign has scrolled its whole name by,
// with a short fade — on a soft golden glow with a few sparkles coming and
// going over it (the splash's light, quieter), and a small wooden sign whose
// words scroll by: its name, the time to tomorrow's part, or "Claim!". A tap
// opens the one on show's splash with every offer in a row along its top.
//
// Built again only when the set of offers changes; the sign's words are
// written in place on every notify, so its scroll never restarts.

import type { Game, OfferWidget } from '../game';
import { HEROES, STORE } from '../sim/data/definitions';
import type { StoreSkuId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatCount, formatCountdown } from './format';
import { setHidden } from './domWrite';
import { iconEl, type IconName } from './kit';

/** A picture of what an offer is for, while it has no icon of its own. */
export function kindIcon(sku: StoreSkuId): IconName {
  const s = STORE[sku];
  if (s.explorers > 0) return 'compass';
  if (s.heroSlots > 0) return 'helmet';
  if (s.opensOn === 'manaLow') return 'manaFlask';
  if (s.opensOn === 'buildersBusy' || s.opensOn === 'townhall') return 'speedup';
  return 'chest';
}

/** An offer's icon: its own art, or — until it lands — its hero's bust, or
 *  a picture of what it is for, on the gold reward tile. The widget and the
 *  splash's row of offers both draw it. */
export function offerIcon(w: OfferWidget): HTMLElement {
  const url = spriteUrl(w.sprite);
  if (url !== null) return spriteImgAt(url, 'ofw-icon');
  const bust = w.hero === null ? null : spriteUrl(`${HEROES[w.hero].sprite}_avatar`);
  return el('span', { class: 'ofw-icon is-fallback' },
    bust === null ? iconEl(kindIcon(w.sku), { size: 'lg' }) : spriteImgAt(bust, 'ofw-bust'));
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
  let lead: OfferWidget | null = null;
  /** Which offer is on show: the next one each lap of the sign. */
  let turn = 0;
  // The words twice, one after the other, so the scroll loops without a
  // seam: the track moves by exactly one copy and starts again.
  const texts = [el('span', { class: 'ofw-text' }, ''), el('span', { class: 'ofw-text', 'aria-hidden': 'true' }, '')];
  const iconSlot = el('span', { class: 'ofw-slot' });
  // A sparkle at each spot, on its own delay, so they never light together.
  const sparkles = [['78%', '14%', 1, 0], ['16%', '30%', 0.7, 1.3], ['70%', '68%', 0.8, 2.4]] as const;
  const node = el('button', { class: 'ofw', type: 'button', 'aria-label': 'Offers' },
    el('span', { class: 'ofw-glow', 'aria-hidden': 'true' }),
    iconSlot,
    ...sparkles.map(([left, top, s, delay]) => el('span', {
      class: 'ofw-sparkle', 'aria-hidden': 'true',
      style: `left:${left};top:${top};--s:${s};animation-delay:${delay}s`,
    })),
    el('span', { class: 'ofw-sign' }, el('span', { class: 'ofw-track' }, ...texts)));
  node.addEventListener('click', () => { if (lead !== null) game.openOfferSplash(lead.sku, true); });
  root.replaceChildren(node);

  const refresh = (): void => {
    const list = game.offerWidgets();
    const showing = list.length > 0 && !game.hasOpenSheet() && game.offerSplashOnScreen() === null;
    setHidden(root, !showing);
    if (!showing) return;
    // The next offer each lap of the sign, in order — only what the widget
    // shows, not the sim.
    lead = list[turn % list.length];
    const next = `${lead.sku}:${lead.state}`;
    if (next !== key) {
      const turned = key !== '' && list.length > 1;
      key = next;
      iconSlot.replaceChildren(offerIcon(lead));
      if (turned) {
        node.classList.remove('is-turning');
        void node.offsetWidth; // restart the fade
        node.classList.add('is-turning');
      }
    }
    const text = words(game, lead);
    for (const t of texts) if (t.textContent !== text) t.textContent = text;
    node.classList.toggle('is-ready', lead.state === 'ready');
    node.setAttribute('aria-label', list.length > 1 ? `${formatCount(list.length)} offers` : lead.name);
  };

  game.onChange(refresh);
  // The next offer comes when the sign has carried the whole of this one's
  // words past: on each lap of its scroll. Without motion there is no lap,
  // so a clock of the same length stands in.
  const track = node.querySelector<HTMLElement>('.ofw-track')!;
  const turnNext = (): void => { turn += 1; refresh(); };
  track.addEventListener('animationiteration', turnNext);
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setInterval(turnNext, ROTATE_MS);
  refresh();
}

/** One lap of the sign (offer.css `ofw-scroll`): how long an offer stays
 *  when nothing moves. */
const ROTATE_MS = 7000;
