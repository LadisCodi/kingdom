// The asleep tab (Docs/features/09-relics.md §2.1, M85): when a city relic's
// window closes — while the player watched or while they were away — a small
// wooden slab slides in from the right edge with the relic's art, "The Tribute
// Crown is asleep" and an Activate chip with its Mana. Several asleep at once
// share one tab: "2 relics are asleep", whose body opens the Bag's Relics.
//
// Built once and mutated, never rebuilt, for the reason the ad tab beside it
// is (`adOfferPill.ts`): a new element restarts its own slide.

import type { Game } from '../game';
import { ARTIFACTS } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatExact } from './format';
import { btn } from './kit';
import { setHidden, setText } from './domWrite';

export function mountRelicAsleepPill(game: Game, root: HTMLElement): void {
  const art = el('span', { class: 'rs-tab-art' });
  const words = el('span', { class: 'rs-tab-words' }, '');
  const body = el('button', { class: 'rs-tab-body', type: 'button' }, art, words);
  body.addEventListener('click', () => game.openAsleepNotice());
  const chip = el('span', { class: 'rs-tab-chip' });
  const tab = el('div', { class: 'rs-tab' }, body, chip);
  root.replaceChildren(tab);

  let wasShowing = false;
  let drawn = '';

  const refresh = (): void => {
    const n = game.asleepNotice();
    // Hidden behind any sheet, like every pill on the map.
    const showing = n !== null && !game.hasOpenSheet();
    setHidden(root, !showing);
    if (!showing) {
      wasShowing = false;
      return;
    }
    const key = `${n!.relic}|${n!.count}|${n!.cost}|${n!.affordable}`;
    if (key !== drawn) {
      drawn = key;
      const def = ARTIFACTS[n!.relic];
      const url = spriteUrl(def.sprite);
      art.replaceChildren(url ? spriteImgAt(url, 'rs-tab-img') : el('span', {}, def.glyph));
      setText(words, n!.count === 1 ? `${def.name} is asleep` : `${formatExact(n!.count)} relics are asleep`);
      chip.replaceChildren(btn({
        label: 'Activate',
        kind: 'primary',
        costExtra: [{ icon: 'Mana', amount: formatExact(n!.cost), short: !n!.affordable }],
        onClick: () => game.doActivateRelic(n!.relic),
      }));
    }
    if (!wasShowing) {
      // Restart the slide only when it genuinely arrives.
      tab.classList.remove('is-in');
      void tab.offsetWidth;
      tab.classList.add('is-in');
      wasShowing = true;
    }
  };

  game.onChange(refresh);
  refresh();
}
