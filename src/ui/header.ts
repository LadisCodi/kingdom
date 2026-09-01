// The resource HUD: a wooden plank of coins, and one plaque hanging under it.
//
// What changed and why (§5.1). This was nine widgets of equal weight —
// Gold, Food, Wood, Stone, Iron, Gems, population, builders, free workers,
// plus a save-mode badge — wrapping onto two rows on a phone, so none of
// them read. Now:
//
//   * three coins that gate the early game, with Stone and Iron appearing
//     only once they mean something;
//   * Gems set apart, because premium currency is a different kind of thing;
//   * ONE plaque showing whichever of population / workers / builders the
//     player can currently act on;
//   * the save badge moved to Settings, where it belongs.
//
// The presenter decides all of it (visibleCurrencies, hudSlot) — this file
// only draws.

import type { Game } from '../game';
import type { CurrencyId } from '../sim/state';
import { el } from './format';
import { currencyIcon, iconEl } from './kit';

/** What the plaque shows, per kind. */
const SLOT_ICON = { population: 'population', workers: 'workers', builders: 'builders' } as const;
const SLOT_LABEL = {
  population: 'Population', workers: 'Workers at work', builders: 'Builders free',
} as const;

export function mountHeader(game: Game, root: HTMLElement): void {
  root.classList.add('hud');
  const plank = el('div', { class: 'hud-plank' });
  const coins = el('div', { class: 'hud-coins' });
  const gems = el('button', { class: 'hud-gems', type: 'button', 'aria-label': 'Gems' });
  const plaque = el('button', { class: 'hud-plaque', type: 'button' });
  plank.append(coins, el('span', { class: 'hud-divider' }), gems);
  root.replaceChildren(plank, plaque);

  // Coin elements are rebuilt only when the VISIBLE SET changes; their values
  // are mutated in place. That keeps the shake animation and the counter
  // node stable across the per-second tick.
  const values = new Map<CurrencyId, HTMLElement>();
  let shown: string = '';

  const buildCoins = (list: CurrencyId[]) => {
    values.clear();
    coins.replaceChildren(...list.map((c) => {
      const value = el('b', {}, '0');
      values.set(c, value);
      // Tapping any coin opens the purse — the only place the game explains
      // that berries, meat and fish all count as Food.
      const coin = el('button', {
        class: 'hud-coin', type: 'button', 'data-currency': c, 'aria-label': c,
      }, currencyIcon(c), value);
      coin.addEventListener('click', () => game.setOverlay('purse'));
      return coin;
    }));
  };

  gems.append(currencyIcon('Gems'), el('b', {}, '0'), el('span', { class: 'hud-plus' }, '+'));
  const gemValue = gems.querySelector('b')!;
  gems.addEventListener('click', () => game.setOverlay('purse'));

  const plaqueIcon = el('span', { class: 'hud-plaque-icon' });
  const plaqueValue = el('b', {}, '');
  plaque.append(plaqueIcon, plaqueValue);
  plaque.addEventListener('click', () => game.focusTownhall());

  // A denied purchase shakes the currency, not the button: the money is what
  // is missing, and it is where the player's eye already is.
  game.onShake((currencies) => {
    for (const c of currencies) {
      const node = values.get(c)?.closest('.hud-coin') ?? (c === 'Gems' ? gems : null);
      if (!node) continue;
      node.classList.remove('is-shaking');
      void (node as HTMLElement).offsetWidth; // restart the animation
      node.classList.add('is-shaking');
    }
  });

  const refresh = () => {
    const list = game.visibleCurrencies();
    const key = list.join(',');
    if (key !== shown) {
      shown = key;
      buildCoins(list);
    }
    for (const [c, node] of values) node.textContent = String(game.effectiveWalletValue(c));
    gemValue.textContent = String(game.effectiveWalletValue('Gems'));

    const slot = game.hudSlot();
    plaqueIcon.replaceChildren(iconEl(SLOT_ICON[slot.kind], { size: 'sm' }));
    plaqueValue.textContent = `${slot.value}/${slot.max}`;
    plaque.setAttribute('aria-label', `${SLOT_LABEL[slot.kind]} ${slot.value} of ${slot.max}`);
    plaque.classList.toggle('is-population', slot.kind === 'population');
    // Only the population plaque leads anywhere; the others are read-outs.
    plaque.disabled = slot.kind !== 'population';
  };
  game.onChange(refresh);
  refresh();
}
