// The quest tracker: the single answer to "what do I do now?", and the most
// important element on screen for a new player (§5.2).
//
// It was already the best-designed thing in the build; it just looked like a
// debug read-out. Now it is an unrolled scroll, the reward is loot rather
// than a sentence, `🔍` is a labelled button, and the chain finally shows its
// own length — questInfo() has always returned index and total, and the UI
// threw both away, so the player could not tell that finishing this one was
// progress through anything.
//
// Built once and mutated, not rebuilt: the old version called
// replaceChildren() on every tick, which is why the completed state could
// never have a transition.

import type { Game } from '../game';
import type { QuestDef } from '../sim/data/definitions';
import type { CurrencyId } from '../sim/state';
import { el } from './format';
import { btn, iconEl, progress, pips, currencyIcon } from './kit';

/** Above this, a bar says it better than a row of stamps. */
const PIP_LIMIT = 10;

const rewardNodes = (quest: QuestDef): Node[] => {
  const parts: Node[] = [];
  for (const [c, n] of Object.entries(quest.reward) as Array<[CurrencyId, number]>) {
    parts.push(el('span', { class: 'q-reward-item' }, currencyIcon(c, { size: 'sm' }), String(n)));
  }
  if (quest.rewardGems > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Gems', { size: 'sm' }), String(quest.rewardGems)));
  }
  return parts;
};

export function mountQuestPill(game: Game, root: HTMLElement): void {
  const chain = el('div', { class: 'q-chain' });
  const name = el('div', { class: 'q-name' });
  const desc = el('div', { class: 'q-desc' });
  const bar = progress('gold');
  const stamps = el('div', { class: 'q-pips' });
  const reward = el('div', { class: 'q-reward' });

  const showMe = btn({ label: 'Show me', icon: 'showme', onClick: () => game.focusQuest() });
  const claim = btn({ label: 'Claim', kind: 'primary', onClick: () => game.doClaimQuest() });
  const foot = el('div', { class: 'q-foot' }, reward, showMe, claim);

  const scroll = el('div', { class: 'q-scroll' },
    el('div', { class: 'q-seal' }, iconEl('quest', { size: 'sm' })),
    chain, name, desc, bar.root, stamps, foot);
  root.replaceChildren(scroll);

  // Rebuild only what changes with the quest itself; the rest is mutated.
  let shownIndex = -1;

  const refresh = () => {
    const info = game.questInfo();
    // Hidden while anything covers the map, and retired when the chain ends.
    root.hidden = game.hasOpenSheet() || info === null;
    if (info === null) return;

    const { quest, value, complete, index, total } = info;
    if (index !== shownIndex) {
      shownIndex = index;
      chain.textContent = `Quest ${index + 1} of ${total}`;
      name.textContent = quest.name;
      desc.textContent = quest.description;
      reward.replaceChildren(el('span', { class: 'q-reward-label' }, 'Reward'), ...rewardNodes(quest));
      // Small, countable goals read better as stamps than as a percentage.
      stamps.hidden = quest.goalAmount > PIP_LIMIT;
    }
    bar.root.hidden = quest.goalAmount <= PIP_LIMIT;
    if (quest.goalAmount > PIP_LIMIT) bar.set(value / quest.goalAmount, `${value}/${quest.goalAmount}`);
    else stamps.replaceChildren(pips(value, quest.goalAmount), el('span', {}, `${value}/${quest.goalAmount}`));

    scroll.classList.toggle('is-complete', complete);
    showMe.hidden = complete;
    claim.hidden = !complete;
  };
  game.onChange(refresh);
  refresh();
}
