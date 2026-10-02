// The Survey: one ladder over the whole province, climbed by the cells the
// player reveals (Docs/features/25-the-survey.md §6).
//
// The season pass's ladder, and nothing above it but the province: how much
// of it is won back, and how many cells the next level asks for. There is no
// board — the work is the fog, out on the map — and no clock: the Survey
// never resets.

import type { Game } from '../game';
import type { Wallet } from '../sim/state';
import type { PackTier } from '../sim/data/definitions';
import { el, formatCount, formatUsd } from './format';
import { ctaBadge, iconEl } from './kit';
import { sheet } from './kit/surface';
import { prize } from './passSheet';

export function renderSurveySheet(game: Game): HTMLElement {
  const s = game.surveyScreen();
  const close = () => game.setOverlay(null);
  const price = formatUsd(Math.round(s.priceUsd * 100));

  // ---- the province: won back out of the whole, and the next level's count.
  const head = el('div', { class: 'pss-clock' },
    iconEl('showme', { size: 'sm' }),
    el('span', {}, `${formatCount(s.revealed)} of ${formatCount(s.total)} cells won back`),
    el('span', { class: 'pss-of' }, s.nextAt === null
      ? 'The whole province'
      : `Level ${formatCount(s.level + 1)} at ${formatCount(s.nextAt)}`));

  const heads = el('div', { class: 'pss-heads' },
    el('div', { class: 'pss-head is-free' }, 'Free'),
    el('div', { class: 'pss-head-pip' }, ''),
    s.owned
      ? el('div', { class: 'pss-head is-paid is-owned' }, iconEl('tick', { size: 'sm' }), 'Royal Survey')
      : el('button', {
          class: 'pss-head is-paid is-buy', type: 'button',
          'aria-label': `Unlock the Royal Survey for ${price}`,
        },
          iconEl('padlock', { size: 'sm' }),
          el('span', {}, 'Royal Survey'),
          el('b', { class: 'pss-price' }, price)));
  if (!s.owned) {
    heads.querySelector('.pss-head.is-buy')!.addEventListener('click', () => game.doBuySurvey());
  }

  // A cell is a <button> exactly when it can be taken.
  const cell = (
    track: 'free' | 'paid',
    level: number,
    c: { reward: Wallet; pack: PackTier | null; claimed: boolean; claimable: boolean; locked?: boolean },
    grand: boolean,
  ): HTMLElement => {
    const classes = `pss-cell is-${track}`
      + (c.claimed ? ' is-taken' : '')
      + (c.claimable ? ' is-claimable' : '')
      + (c.locked ? ' is-locked' : '')
      + (grand ? ' is-grand' : '');
    const bits = [
      ...prize(c.reward, c.pack),
      ...(c.claimed ? [iconEl('tick', { size: 'sm' })] : []),
      ...(c.locked && !c.claimed ? [iconEl('padlock', { size: 'sm' })] : []),
    ];
    if (!c.claimable) return el('div', { class: classes }, ...bits);
    const b = el('button', { class: classes, type: 'button' }, ...bits, ctaBadge(1, `survey:${track}:${level}`));
    b.addEventListener('click', () => game.doClaimSurveyCell(level, track));
    return b;
  };

  const ladder = s.ladder.map((r) => {
    const grand = r.level === s.length;
    return el('div', { class: `pss-row${r.reached ? ' is-reached' : ''}` },
      cell('free', r.level, r.free, grand),
      // The rung says the cells it asks for, under its number: the ladder is
      // climbed by the map, so the map's count is what a rung is.
      el('div', { class: `pss-pip is-rung${r.level === s.level ? ' is-here' : ''}`, title: `${formatCount(r.cells)} cells` },
        String(r.level)),
      cell('paid', r.level, r.paid, grand));
  });

  const body = el('div', { class: 'pss' },
    head,
    el('div', { class: 'pss-rungs' },
      heads,
      el('div', { class: 'pss-ladder', 'data-keep-scroll': 'survey-ladder' }, ...ladder)));
  const surface = sheet({ title: 'The Royal Survey', onClose: close, tall: true }, body);
  surface.classList.add('is-panes');
  return surface;
}
