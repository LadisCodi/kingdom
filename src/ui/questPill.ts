// The quest pill: a slim tappable strip under the header showing the active
// quest and its progress ("📜 Timber! 4/10"). Tapping expands a small card
// with the description, a progress bar, and the reward; when the goal is met
// the pill pulses and the card's button becomes Claim.

import { icon, type Game } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';
import { button, el } from './format';

let expanded = false; // survives the per-tick re-render

const rewardText = (reward: Wallet): string =>
  Object.entries(reward).map(([c, n]) => `${n} ${icon(c as CurrencyId)}`).join(' · ');

export function mountQuestPill(game: Game, root: HTMLElement): void {
  const refresh = () => {
    root.replaceChildren();
    const info = game.questInfo();
    if (info === null) return; // chain finished — the pill retires
    const { quest, value, complete } = info;

    const pill = el('button', { class: `quest-pill${complete ? ' cta' : ''}` },
      el('span', {}, `📜 ${quest.name}`),
      el('span', { class: 'muted' },
        complete ? '✓' : ` ${value}/${quest.goalAmount}`));
    pill.addEventListener('click', () => {
      expanded = !expanded;
      game.notify();
    });
    root.append(pill);

    if (!expanded) return;
    const card = el('div', { class: 'quest-card' },
      el('div', { class: 'muted' }, quest.description));
    const bar = el('div', { class: 'progress' },
      el('div', { class: 'fill' }),
      el('div', { class: 'label' }, `${value}/${quest.goalAmount}`));
    (bar.querySelector('.fill') as HTMLElement).style.width =
      `${(value / quest.goalAmount) * 100}%`;
    card.append(bar);
    const claimBtn = button('Claim', () => {
      game.doClaimQuest();
    });
    claimBtn.disabled = !complete;
    card.append(el('div', { class: 'action-row' },
      el('span', { class: 'info' }, `Reward: ${rewardText(quest.reward)}`),
      claimBtn));
    root.append(card);
  };
  game.onChange(refresh);
  refresh();
}
