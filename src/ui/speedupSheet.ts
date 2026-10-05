// The Speed-up picker (Docs/art/ui-inventory.md §3.7, mockup M71): how a
// speed-up is really used. Opened by a timer's Speed up — a build, an
// upgrade, a training line, a workshop item — and by the Bag.
//
// The job at the top, its time left large; Auto over the rows; one row per
// speed-up that fits, typed first, then General, smallest first; Finish with
// its Gem price last, never first. Each Use shortens the time in place, and
// when it reaches zero the sheet closes on the job finishing.

import type { Game } from '../game';
import { ITEMS } from '../sim/data/definitions';
import type { SpeedJob } from '../sim/speedups';
import { el, formatDuration, formatExact } from './format';
import { btn, iconEl, progress, sheet } from './kit';
import { tileArt } from './bagSheet';

/** Auto's face: what it will spend, largest first — "2× 1h, 1× 15m". */
const planWords = (plan: Array<{ id: keyof typeof ITEMS; n: number }>): string =>
  [...plan]
    .sort((a, b) => ITEMS[b.id].seconds - ITEMS[a.id].seconds)
    .map((p) => `${formatExact(p.n)}× ${formatDuration(ITEMS[p.id].seconds)}`)
    .join(', ');

export function renderSpeedupSheet(game: Game): HTMLElement {
  const view = game.speedupScreen();
  const close = () => game.closeSpeedup();
  if (view === null) return sheet({ title: 'Speed up', onClose: close, centred: true });

  const bar = progress('blue');
  bar.run(view.progress, view.left * 1000, '');
  const job = el('div', { class: 'spd-job' },
    el('div', { class: 'spd-job-icon' }, iconEl(view.icon, { size: 'lg' })),
    el('div', { class: 'spd-job-mid' },
      el('div', { class: 'spd-job-name' }, view.title),
      bar.root),
    el('div', { class: 'spd-left' }, formatDuration(Math.ceil(view.left))));

  const rows = view.rows.length === 0
    ? [el('p', { class: 'spd-none' }, 'No speed-ups for this in the Bag')]
    : view.rows.map((r) => el('div', { class: 'spd-row' },
      el('div', { class: `bag-tile spd-tile is-tier-${r.def.tier}` },
        el('span', { class: 'bag-tile-size' }, formatDuration(r.def.seconds)),
        ...tileArt(r.def, {}),
        el('span', { class: 'bag-tile-count' }, formatExact(r.count))),
      el('div', { class: 'spd-row-name' }, r.def.name),
      btn({ label: 'Use', kind: 'primary', onClick: () => game.doSpeedup(r.id) })));

  return sheet({ title: 'Speed up', onClose: close, centred: true },
    job,
    ...(view.auto.length > 0
      ? [el('div', { class: 'spd-auto' },
        btn({ label: `Auto · ${planWords(view.auto)}`, kind: 'gold', onClick: () => game.doAutoSpeedup() }))]
      : []),
    el('div', { class: 'spd-rows' }, ...rows),
    el('div', { class: 'spd-finish' }, btn({
      label: 'Finish',
      kind: 'gem',
      onClick: () => game.doFinishSpeedJob(),
      cost: { Gems: view.gems },
      have: (c) => game.walletValue(c),
    })));
}

/**
 * A TIMER'S BUTTON: Speed up when the Bag holds something that fits — the
 * picker, with Finish inside it, last — and the bare Gem Finish when it holds
 * nothing, so a player with no speed-ups is not sent through a sheet of
 * empty rows to pay.
 */
export function timerButton(game: Game, job: SpeedJob, finish: HTMLElement): HTMLElement {
  if (!game.hasSpeedups(job)) return finish;
  return btn({ label: 'Speed up', kind: 'blue', icon: 'hourglass', onClick: () => game.openSpeedup(job) });
}
