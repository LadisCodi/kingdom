// "Your party waits at depth 3 — 12 fragments so far."
//
// A checkpoint never expires, which is what stops delves becoming an
// interruption engine — but a decision nobody can see is a decision nobody
// makes. This pill is the other half of that bargain: the parked party is the
// return hook, so it has to be visible the moment the player opens the game,
// without being a modal that demands an answer.
//
// It sits under the quest tracker and disappears the instant nothing is
// waiting. Built once and mutated, like the quest pill, so it can animate.

import { RUINS } from '../sim/data/definitions';
import type { Game } from '../game';
import { el } from './format';
import { iconEl } from './kit';

export function mountDelvePill(game: Game, root: HTMLElement): void {
  const list = el('div', { class: 'dv-list' });
  root.replaceChildren(list);

  const refresh = (): void => {
    const waiting = game.waitingDelves();
    // Hidden while a sheet is up, exactly like the quest tracker — the map
    // chrome should not compete with whatever the player just opened.
    root.hidden = waiting.length === 0 || game.hasOpenSheet();
    if (root.hidden) return;

    list.replaceChildren(...waiting.map((delve) => {
      const ruin = RUINS[delve.ruinId];
      const failed = delve.outcome === 'failed';
      const atBottom = delve.depth >= ruin.maxDepth;
      const carried = Object.values(delve.haul).reduce((a, b) => a + b, 0) + delve.haulFragments;
      const pill = el('button', {
        class: `dv-pill${failed ? ' is-failed' : ''}${atBottom ? ' is-bottom' : ''}`,
        type: 'button',
      },
        iconEl(failed ? 'unknown' : atBottom ? 'star' : 'quest', { size: 'sm' }),
        el('div', { class: 'dv-body' },
          el('div', { class: 'dv-name' }, failed
            ? `Driven out of ${ruin.name}`
            : atBottom
              ? `At the bottom of ${ruin.name}`
              : `Waiting at depth ${delve.depth} of ${ruin.maxDepth}`),
          el('div', { class: 'dv-haul' }, carried > 0
            ? `Carrying ${carried} things they have not brought home yet`
            : 'Nothing to show for it yet')),
        el('span', { class: 'dv-go' }, '›'),
      );
      pill.addEventListener('click', () => game.openCheckpointFor(delve.id));
      return pill;
    }));
  };

  game.onChange(refresh);
  refresh();
}
