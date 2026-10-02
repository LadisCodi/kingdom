// The explorers chip — top left on the world board, under the header: a
// compass and how many explorers are out of how many (mockups m55, m56).
// A tap glides to the one due home soonest. Absent until Cartography gives
// the first, and absent on the province.
//
// Built once and mutated, like the world knob.

import type { Game } from '../../game';
import { arrivesAt, returnsAt } from '../../sim/world/explorers';
import { el, formatCount } from '../format';
import { iconEl } from '../kit';
import { explorerCount } from './dispatchSheet';

export function mountExplorerChip(game: Game, root: HTMLElement): void {
  const count = el('span', { class: 'world-chip-count' });
  const chip = el('button', {
    class: 'hud-plaque world-chip', type: 'button', 'aria-label': 'Explorers',
  }, iconEl('compass', { size: 'md' }), count);
  chip.addEventListener('click', () => {
    const now = game.now();
    const trips = [...game.state.world.explorers].sort((a, b) => returnsAt(a) - returnsAt(b));
    const trip = trips[0];
    if (trip === undefined) return;
    // Where it is headed, or the city it is walking back to.
    game.showHex(now < arrivesAt(trip) ? trip.target : trip.path[0]);
  });
  root.replaceChildren(chip);

  const refresh = (): void => {
    const { out, slots } = explorerCount(game);
    root.hidden = game.scene !== 'world' || slots === 0 || game.hasOpenSheet();
    count.textContent = `${formatCount(slots - out)}/${formatCount(slots)}`;
  };
  game.onChange(refresh);
  refresh();
}
