// The quest tracker: an always-open card under the header showing the active
// quest — name, description, progress bar, and reward. It belongs to the main
// screen only: while any menu, panel, or placement mode is on top it hides,
// reappearing when the player dismisses back to the map.

import { icon, type Game } from '../game';
import type { QuestDef } from '../sim/data/definitions';
import type { CurrencyId } from '../sim/state';
import { button, el } from './format';

const rewardText = (quest: QuestDef): string =>
  Object.entries(quest.reward).map(([c, n]) => `${n} ${icon(c as CurrencyId)}`)
    .concat(quest.rewardGems > 0 ? [`${quest.rewardGems} ${icon('Gems')}`] : [])
    .join(' · ');

export function mountQuestPill(game: Game, root: HTMLElement): void {
  const refresh = () => {
    root.replaceChildren();
    if (game.dismissible()) return; // something is on top of the main screen
    const info = game.questInfo();
    if (info === null) return; // chain finished — the tracker retires
    const { quest, value, complete } = info;

    const card = el('div', { class: 'quest-card' },
      el('div', { class: 'name' }, `📜 ${quest.name}`),
      el('div', { class: 'muted' }, quest.description));
    const bar = el('div', { class: 'progress' },
      el('div', { class: 'fill' }),
      el('div', { class: 'label' }, `${value}/${quest.goalAmount}`));
    (bar.querySelector('.fill') as HTMLElement).style.width =
      `${(value / quest.goalAmount) * 100}%`;
    card.append(bar);
    // Complete → Claim; otherwise 🔍 navigates to where the quest is done.
    const actionBtn = complete
      ? button('Claim', () => game.doClaimQuest(), 'cta')
      : button('🔍', () => game.focusQuest());
    if (!complete) actionBtn.setAttribute('aria-label', 'Show me where');
    card.append(el('div', { class: 'action-row' },
      el('span', { class: 'info' }, `Reward: ${rewardText(quest)}`),
      actionBtn));
    root.append(card);
  };
  game.onChange(refresh);
  refresh();
}
