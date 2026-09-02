// The resource HUD: a wooden plank of coins, and one plaque hanging under it.
//
// What changed and why (§5.1). This was nine widgets of equal weight —
// Gold, Food, Wood, Stone, Iron, Gems, population, builders, free workers,
// plus a save-mode badge — wrapping onto two rows on a phone, so none of
// them read. Now:
//
//   * three coins that gate the early game, with Stone and Iron appearing
//     only once they mean something;
//   * MANA, then Gems past the rope. Mana is the energy every tap is paid
//     from, so it is never hidden and never contextual — a player who cannot
//     see it cannot tell why a tap just refused;
//   * POPULATION is not here at all. It lives on the world, over the
//     Townhall, which is where villagers are trained and therefore where a
//     player looks when they want more of them. The header is for things you
//     spend from anywhere; population is a property of one building;
//   * the plaque under the plank keeps only the CONTEXTUAL read-outs
//     (workers while staffing, builders while building);
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


  // ONE gauge and ONE net rate. Never "+6/h base −4/h upkeep = +2/h" — that
  // breakdown is the reliquary's job, on tap, where the player asked for it.
  const manaGauge = el('button', {
    class: 'hud-mana', type: 'button', 'aria-label': 'Mana',
  });
  const manaFill = el('span', { class: 'hud-mana-fill' });
  const manaValue = el('b', {}, '');
  const manaRate = el('span', { class: 'hud-mana-rate' }, '');
  manaGauge.append(manaFill, currencyIcon('Mana', { size: 'sm' }), manaValue, manaRate);
  manaGauge.addEventListener('click', () => game.setOverlay('reliquary'));
  plank.append(coins, manaGauge, el('span', { class: 'hud-divider' }), gems);
  root.replaceChildren(plank, el('div', { class: 'hud-under' }, plaque));

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
    // Population is drawn on the world now, over the Townhall, so the plaque
    // only appears when it has something ELSE to say.
    plaque.hidden = slot.kind === 'population';
    if (!plaque.hidden) {
      // md, not sm: the status icons carry more internal detail than a coin
      // and turn to mush at 16px — the contact sheet made that obvious.
      plaqueIcon.replaceChildren(iconEl(SLOT_ICON[slot.kind]));
      plaqueValue.textContent = `${slot.value}/${slot.max}`;
      plaque.setAttribute('aria-label', `${SLOT_LABEL[slot.kind]} ${slot.value} of ${slot.max}`);
      plaque.disabled = true; // both remaining kinds are read-outs
    }

    // Mana is ALWAYS on the plank. It used to appear only once the player had
    // met magic, which was right when it only paid for relics; it now pays
    // for every tap, so hiding it would hide the reason a tap refused.
    const m = game.manaInfo();
    manaValue.textContent = `${m.value}/${m.cap}`;
    manaRate.textContent = `+${m.net}/h`;
    manaFill.style.width = `${m.cap === 0 ? 0 : Math.min(100, (m.value / m.cap) * 100)}%`;
    // Full and OVERCHARGED are different states: full means the next hour is
    // spilling, overcharged means an ad bought a pool the ceiling cannot hold.
    manaGauge.classList.toggle('is-full', m.value >= m.cap && !m.over);
    manaGauge.classList.toggle('is-over', m.over);
    manaGauge.setAttribute('aria-label', m.over
      ? `Mana ${m.value}, overcharged past a ceiling of ${m.cap}`
      : `Mana ${m.value} of ${m.cap}, gaining ${m.net} an hour`);
  };
  game.onChange(refresh);
  refresh();
}
