// The raid widget (Docs/features/18-garrisons-and-raids.md §7).
//
// A tab on the right edge, in the slot the Mana offer uses, saying which
// garrison is closest to walking down the hill — *Orcs at the Hollow Barrow
// raid in 27 min* — and, after one has, what it took.
//
// IT NEVER OPENS ITSELF. A raid is a bill on a clock, not an interruption, so
// the loudest this feature ever gets is a tab at the edge of the map with a
// countdown on it. Tapping it goes to the ruin, which is the only answer the
// game has: clear the gate.
//
// Built once and mutated, like the quest pill and the ad tab — a
// `replaceChildren` every second makes the element new, and a new element
// restarts its own slide-in animation.

import { RUINS } from '../sim/data/definitions';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { iconEl } from './kit';

export function mountRaidPill(game: Game, root: HTMLElement): void {
  const line = el('div', { class: 'raid-tab-line' }, '');
  const sub = el('div', { class: 'raid-tab-sub' }, '');
  const tab = el('button', {
    class: 'raid-tab', type: 'button', 'aria-label': 'A garrison is counting down',
  },
    el('div', { class: 'raid-tab-mark' }, iconEl('army', { size: 'md' })),
    el('div', { class: 'raid-tab-body' }, line, sub),
  );
  tab.addEventListener('click', () => {
    const widget = game.raidWidget();
    if (widget === null) return;
    // A report is news the player has now read; the countdown is a place to
    // go. Either way the ruin is what they want to look at.
    if (widget.took !== null) game.dismissRaids();
    game.showRuin(widget.ruinId);
  });
  root.replaceChildren(tab);

  let wasShowing = false;

  const refresh = (): void => {
    const widget = game.raidWidget();
    // Behind any sheet, exactly like the quest and delve pills.
    const showing = widget !== null && !game.hasOpenSheet();
    root.hidden = !showing;
    if (!showing) {
      wasShowing = false;
      return;
    }
    const name = RUINS[widget!.ruinId].name;
    if (widget!.took !== null) {
      // The two biggest, then a count. A slab is one line wide and four
      // materials do not fit in it — and "699 Gold" is the number the player
      // actually reacts to, so the tail is worth trading for a legible head.
      const entries = Object.entries(widget!.took)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      const head = entries.slice(0, 2).map(([c, n]) => `${n} ${c}`).join(', ');
      const rest = entries.length - 2;
      const took = rest > 0 ? `${head} and ${rest} more` : head;
      tab.classList.add('is-hit');
      line.textContent = widget!.reports === 1
        ? `${widget!.creature} raided the city`
        : `${widget!.reports} raids while you were away`;
      sub.textContent = took === '' ? `From ${name}` : `They took ${took}`;
    } else {
      tab.classList.remove('is-hit');
      const left = Math.max(0, (widget!.raidsAt! - game.now()) / 1000);
      line.textContent = `${widget!.creature} raid in ${formatDuration(left)}`;
      sub.textContent = widget!.others > 0
        ? `${name}, and ${widget!.others} more counting`
        : name;
    }
    if (!wasShowing) {
      tab.classList.remove('is-in');
      void tab.offsetWidth; // force the reflow, or the class lands too late
      tab.classList.add('is-in');
      wasShowing = true;
    }
  };

  game.onChange(refresh);
  refresh();
}
