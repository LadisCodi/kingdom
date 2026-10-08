// The builder sheet (§5.6, M50–M51): raised by a build or an upgrade that
// every builder is too busy for.
//
// THE REFUSAL IS THE OFFER. There is no waiting line in this game: a job
// starts because a builder is free, or not at all
// (Docs/features/06-construction.md). So the sheet shows the crew — one row
// per builder, up to the ceiling — and what each of them is doing, with the
// time left and a Gem Finish that frees them now. The next empty place holds
// Hire.
//
// It never closes on its own. A job that ends while it is open — by itself,
// or by Finish — turns its builder's row FREE in place, and that row offers
// the very job the sheet was raised for: Build the Sawmill, Upgrade the
// Quarry. Spending Gems and spending the building's price stay two presses.

import { DISTRICTS, KINGDOM_DEF } from '../sim/data/definitions';
import { gemRushCost } from '../sim/commands';
import { queueProgress, remainingSeconds } from '../sim/state';
import { buildingArtUrl, spriteImgAt } from '../render/sprites';
import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { btn, iconEl, progress } from './kit';
import { timerButton } from './speedupSheet';
import type { SpeedJob } from '../sim/speedups';
import { sheet } from './kit/surface';

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const nth = (i: number): string => ORDINAL[i] ?? `${i + 1}th`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function renderBuilderSheet(game: Game): HTMLElement {
  const { builders, ceiling, cost: hireCost } = game.builderOffer();
  const jobs = game.builderJobs();
  const worldJobs = game.builderWorldJobs();
  const free = Math.max(0, builders - jobs.length - worldJobs.length);
  const ask = game.builderAskJob();
  const close = () => game.setOverlay(null);

  // ------------------------------------------------------------ the rows
  const rows: HTMLElement[] = [];

  // A free builder — hired just now, or whose job just ended — offers the
  // job the sheet was raised for. Listed first: it is the thing to press.
  for (let i = 0; i < free; i++) {
    rows.push(el('div', { class: 'crew-row k-section is-free' },
      el('span', { class: 'crew-medal' }, iconEl('builders', { size: 'lg' })),
      el('div', { class: 'crew-mid' },
        el('div', { class: 'crew-free' }, 'Free'),
        // Only the first free builder is offered the job; one job, one button.
        el('div', { class: 'crew-task' }, i === 0 && ask !== null ? ask.what : 'Ready for the next job')),
      ...(ask !== null && i === 0
        ? [btn({
            label: ask.verb,
            kind: 'primary',
            onClick: ask.start,
            cost: ask.cost,
            have: (c) => game.walletValue(c),
          })]
        : [])));
  }

  const t = game.now();
  for (const { item, district, name, task } of jobs) {
    const def = DISTRICTS[district.definitionId];
    // The highest art tier at or below its level, walked down as the map does.
    const art = buildingArtUrl(def.sprite, district.level);
    const bar = progress('blue');
    const left = remainingSeconds(item, t);
    bar.run(queueProgress(item, t), left * 1000, formatDuration(left));
    rows.push(el('div', { class: 'crew-row k-section' },
      el('div', { class: 'crew-art' }, art ? spriteImgAt(art) : iconEl(def.id, { size: 'lg' })),
      el('div', { class: 'crew-mid' },
        el('div', { class: 'crew-name' }, name),
        el('div', { class: 'crew-task' }, task),
        bar.root),
      timerButton(game, { kind: 'queue', itemId: item.uniqueId }, btn({
        label: 'Finish',
        kind: 'gem',
        onClick: () => game.doRush(item.uniqueId),
        cost: { Gems: gemRushCost(item, t) },
        have: (c) => game.walletValue(c),
      }))));
  }

  // A builder out on the world board: the server's timer. No Finish here —
  // that is on the hex's sheet — but a speed-up from the Bag, when one fits.
  for (const job of worldJobs) {
    const speed: SpeedJob = { kind: 'hex', index: job.index };
    const bar = progress('blue');
    const leftMs = Math.max(0, job.startedAt + job.durationMs - t);
    bar.run(job.durationMs > 0 ? Math.min(1, Math.max(0, (t - job.startedAt) / job.durationMs)) : 1,
      leftMs, formatDuration(leftMs / 1000));
    rows.push(el('div', { class: 'crew-row k-section' },
      el('div', { class: 'crew-art' }, iconEl('build', { size: 'lg' })),
      el('div', { class: 'crew-mid' },
        el('div', { class: 'crew-name' }, job.name),
        el('div', { class: 'crew-task' }, job.task),
        bar.root),
      ...(game.hasSpeedups(speed)
        ? [btn({ label: 'Speed up', kind: 'blue', icon: 'hourglass', onClick: () => game.openSpeedup(speed) })]
        : [])));
  }

  // The places still to hire, up to the ceiling: the next one holds the
  // offer, the ones past it are only their socket.
  for (let i = builders; i < ceiling; i++) {
    const next = i === builders;
    rows.push(el('div', { class: `crew-row k-section is-empty${next ? '' : ' is-far'}` },
      el('span', { class: 'crew-socket' }, iconEl('builders', { size: 'lg' })),
      el('div', { class: 'crew-mid' }, el('div', { class: 'crew-task' }, `A ${nth(i)} builder`)),
      ...(next
        ? [btn({
            label: 'Hire',
            kind: 'gem',
            // The sheet stays: the new builder's row turns Free with the job.
            onClick: () => game.doBuyBuilder({ closeSheet: false }),
            cost: { Gems: hireCost },
            have: (c) => game.walletValue(c),
          })]
        : [])));
  }

  // --------------------------------------------------------- the headline
  const subject = ask?.what.replace(/^Ready to /, '') ?? 'it';
  const head = free > 0
    ? (free === 1 ? 'A builder is free' : `${formatExact(free)} builders are free`)
    : builders === 1 ? 'Your builder is busy' : `All ${formatExact(builders)} builders are busy`;
  const note = free > 0
    ? `${cap(subject)} now, or keep it for later.`
    : 'Nothing waits in line — finish a job to free a builder.';

  return sheet({ title: 'Builders', onClose: close, centred: true },
    el('div', { class: 'crew' },
      el('div', { class: 'crew-top' },
        el('div', { class: 'crew-illus', role: 'img', 'aria-label': 'Two builders' }),
        el('div', { class: 'crew-copy' },
          el('div', { class: 'crew-head' }, head),
          el('div', { class: 'crew-note' }, note))),
      el('div', { class: 'crew-rows' }, ...rows),
      ...(builders >= ceiling
        ? [el('div', { class: 'crew-ceiling' }, `${formatExact(KINGDOM_DEF.maxBuilders)} is as large as a crew gets.`)]
        : [])));
}
