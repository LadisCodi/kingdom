// The quest tracker: the single answer to "what do I do now?", and the most
// important element on screen for a new player (§5.2).
//
// THE WHOLE CARD IS THE BUTTON (2026-09-02). It used to carry two of its own —
// "Show me" and "Claim" — which is one control too many for a widget whose
// entire job is to be obvious: at any moment exactly one of them was live, so
// the other was furniture, and both were competing for taps with the card that
// was already the biggest target on screen. Tapping it now does the only thing
// there is to do — point you at the goal, or take the reward when it is done.
//
// It also lost its wax seal and its reward row. The seal was decoration on a
// widget that has to read at a glance, and the reward is not a decision the
// player makes BEFORE finishing a quest — showing it early spends space on
// something they cannot act on. It appears when it becomes collectable, which
// is also what makes the finished state feel like a payout.
//
// Built once and mutated, not rebuilt: the old version called
// replaceChildren() on every tick, which is why the completed state could
// never have a transition.

import type { Game } from '../game';
import type { QuestDef } from '../sim/data/definitions';
import type { CurrencyId, DistrictId } from '../sim/state';
import { el } from './format';
import { iconEl, progress, currencyIcon, type IconName } from './kit';

/** The mark on the scroll's slot: WHAT the quest is about, in the kit's own
 *  icon — the coin it collects, the building it raises, the book it reads —
 *  so the card reads at a glance before its words do (mockup M1). */
const goalIcon = (quest: QuestDef): IconName => {
  switch (quest.goalType) {
    case 'CollectResource': case 'HoldResource':
      return (quest.goalTarget as CurrencyId | null) ?? 'quest';
    case 'BuildDistrict': case 'UpgradeDistrict':
      return (quest.goalTarget as DistrictId | null) ?? 'build';
    case 'CompleteTech': case 'CompleteTechs': return 'research';
    case 'ReachPopulation': return 'population';
    case 'AssignWorkers': return 'workers';
    case 'TrainArmy': case 'ClearGarrisons': return 'army';
    case 'CollectTaps': return 'showme';
    case 'DiscoverCells': case 'DiscoverFeature': return 'showme';
    case 'ClaimLandmarks': return 'Mana';
    case 'ReachDepth': case 'ClearRuins': return 'dungeon';
    case 'OwnArtifacts': return 'relics';
    case 'OwnHeroes': return 'Warrior';
    default: return 'quest';
  }
};

const rewardNodes = (quest: QuestDef): Node[] => {
  const parts: Node[] = [];
  for (const [c, n] of Object.entries(quest.reward) as Array<[CurrencyId, number]>) {
    parts.push(el('span', { class: 'q-reward-item' }, currencyIcon(c, { size: 'sm' }), String(n)));
  }
  if (quest.rewardKnowledge > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Knowledge', { size: 'sm' }), String(quest.rewardKnowledge)));
  }
  if (quest.rewardStardust > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Stardust', { size: 'sm' }), String(quest.rewardStardust)));
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
  const reward = el('div', { class: 'q-reward' });
  // The slot and the slab are the M1 card: a mark for what the quest is
  // about at the left, and the one verb the tap performs at the right. The
  // slab is drawn, not a control — the whole scroll is still the button.
  const slot = el('div', { class: 'q-slot' });
  const cta = el('span', { class: 'q-cta' }, 'Show me');

  const scroll = el('button', { class: 'q-scroll', type: 'button' },
    el('div', { class: 'q-head' }, slot, el('div', { class: 'q-text' }, chain, name, desc)),
    bar.root,
    el('div', { class: 'q-foot' }, reward, cta));
  // Read the state at CLICK time, not at render time: a tap can land in the
  // same frame the goal completes, and claiming a quest that is not finished
  // is refused by the sim anyway — but pointing at a goal you just met would
  // be a small lie.
  scroll.addEventListener('click', () => {
    if (game.questInfo()?.complete === true) game.doClaimQuest();
    else game.focusQuest();
  });
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
      slot.replaceChildren(iconEl(goalIcon(quest), { size: 'md' }));
    }
    cta.textContent = complete ? 'Claim' : 'Show me';
    // One read-out for every goal, large or small: a filled bar with the count
    // written inside it. Small goals used to get a row of stamps instead,
    // which meant the widget changed SHAPE from quest to quest — and the
    // player had to re-find the number each time, on the one element whose
    // whole job is to be scannable at a glance.
    bar.set(value / quest.goalAmount, `${value}/${quest.goalAmount}`);

    scroll.classList.toggle('is-complete', complete);
    // The reward is the payout, so it arrives with the payout.
    reward.hidden = !complete;
    // The card is one control that does two things; a screen reader has to be
    // told which, because the styling is all a sighted player gets.
    scroll.setAttribute(
      'aria-label',
      complete ? `Claim the reward for ${quest.name}` : `Show me where: ${quest.name}`,
    );
  };
  game.onChange(refresh);
  refresh();
}
