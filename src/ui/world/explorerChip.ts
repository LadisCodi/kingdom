// The explorers chip — top left on the world board, under the header: a
// compass and how many explorers are out of how many (mockups m55, m56).
// A tap glides to one waiting for the player, else to the one whose wait ends
// soonest. Absent on the province.
//
// Built once and mutated, like the world knob.

import type { Game } from '../../game';
import { readyAt, readyTrips, returnsAt, tripPhase } from '../../sim/world/explorers';
import { el, formatCount } from '../format';
import { iconEl } from '../kit';
import { explorerCount } from './dispatchSheet';
import { setHidden, setText } from '../domWrite';
import { tr } from '../../i18n/tr';

export function mountExplorerChip(game: Game, root: HTMLElement): void {
  const count = el('span', { class: 'world-chip-count' });
  const chip = el('button', {
    class: 'hud-plaque world-chip', type: 'button', 'aria-label': tr('Explorers'),
  }, iconEl('compass', { size: 'md' }), count);
  chip.addEventListener('click', () => {
    const now = game.now();
    const waiting = readyTrips(game.state, now)[0];
    if (waiting !== undefined) {
      game.showHex(waiting.target);
      return;
    }
    const ends = (t: (typeof game.state.world.explorers)[number]): number =>
      (tripPhase(t, now) === 'home' ? returnsAt(t) : readyAt(t));
    const trip = [...game.state.world.explorers].sort((a, b) => ends(a) - ends(b))[0];
    if (trip === undefined) return;
    // The hex it is headed for or working, or the city it is walking back to.
    game.showHex(tripPhase(trip, now) === 'home' ? trip.path[0] : trip.target);
  });
  root.replaceChildren(chip);

  const refresh = (): void => {
    const { out, slots } = explorerCount(game);
    setHidden(root, game.scene !== 'world' || game.hasOpenSheet());
    setText(count, `${formatCount(slots - out)}/${formatCount(slots)}`);
  };
  game.onChange(refresh);
  refresh();
}
