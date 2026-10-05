// The Exchange chip — top left on the world board, under the explorers chip:
// the player's own precious material and how many offers stand for them to
// take. A tap opens the Exchange (Docs/features/19-world-map.md §7.5).
// Absent on the province.
//
// Built once and mutated, like the explorers chip.

import type { Game } from '../../game';
import type { PreciousId } from '../../sim/state';
import { el, formatCount } from '../format';
import { iconEl } from '../kit';
import { setHidden, setText } from '../domWrite';

export function mountExchangeChip(game: Game, root: HTMLElement): void {
  const count = el('span', { class: 'world-chip-count' });
  const slot = el('span', { class: 'world-chip-icon' });
  let shown: PreciousId | null = null;
  const chip = el('button', {
    class: 'hud-plaque world-chip', type: 'button', 'aria-label': 'The Exchange',
  }, slot, el('span', { class: 'world-chip-label' }, 'Exchange'), count);
  chip.addEventListener('click', () => game.openExchange());
  root.replaceChildren(chip);

  const refresh = (): void => {
    setHidden(root, game.scene !== 'world' || game.worldView === null || game.hasOpenSheet());
    if (game.scene !== 'world') return;
    const own = game.worldSource().board().materials[game.worldSeat()] ?? null;
    if (own !== shown && own !== null) {
      slot.replaceChildren(iconEl(own, { size: 'md' }));
      shown = own;
    }
    const open = (game.worldView?.offers ?? []).filter((o) => !o.mine).length;
    setText(count, open > 0 ? formatCount(open) : '');
  };
  game.onChange(refresh);
  refresh();
}
