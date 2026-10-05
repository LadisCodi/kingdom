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
// It has also lost, in the same spirit, its "Quest 7 of 53" eyebrow: how far
// through the chain you are is not the answer to "what do I do now", and it
// was spending the line the DESCRIPTION needed — the description being the
// one that carries the goal, since a name like "First steps" carries none.
//
// It earlier lost its wax seal and its reward row. The seal was decoration on a
// widget that has to read at a glance, and the reward is not a decision the
// player makes BEFORE finishing a quest — showing it early spends space on
// something they cannot act on. It appears when it becomes collectable, which
// is also what makes the finished state feel like a payout.
//
// Built once and mutated, not rebuilt: the old version called
// replaceChildren() on every tick, which is why the completed state could
// never have a transition.

// THE SCROLL UNROLLS. A new quest arrives as the parchment unrolling — the
// base fades in and widens rightwards from its left roller — and its words fade in
// just before it reaches full size. A claimed quest plays it backwards, and
// a claim that hands over the next quest plays both, half a second apart.
// Built on the Web Animations API so each phase can be awaited in order.

import type { Game } from '../game';
import type { QuestDef } from '../sim/data/definitions';
import type { CurrencyId, DistrictId } from '../sim/state';
import { questLine } from '../sim/questProse';
import { playSfx } from '../audio/sfx';
import { el, formatExact } from './format';
import { ScrollRoll } from './scrollRoll';
import { iconEl, progress, currencyIcon, type IconName } from './kit';

/** The mark on the scroll's slot: WHAT the quest is about, in the kit's own
 *  icon — the coin it collects, the building it raises, the book it reads —
 *  so the card reads at a glance before its words do (mockup M1). */
const goalIcon = (quest: QuestDef): IconName => {
  switch (quest.goalType) {
    case 'CollectResource': case 'HoldResource':
      return (quest.goalTarget as CurrencyId | null) ?? 'quest';
    case 'BuildDistrict': case 'RepairDistrict': case 'UpgradeDistrict':
      return (quest.goalTarget as DistrictId | null) ?? 'build';
    case 'CompleteTech': case 'CompleteTechs': return 'research';
    case 'ReachPopulation': return 'population';
    case 'AssignWorkers': return 'workers';
    case 'TrainArmy': case 'ClearLairs': return 'army';
    case 'CollectTaps': return 'showme';
    case 'DiscoverCells': return 'tile';
    case 'FindLairs': return 'compass';
    case 'DiscoverFeature': return 'showme';
    case 'ClaimLandmarks': return 'Mana';
    case 'OwnArtifacts': return 'relics';
    case 'OwnHeroes': return 'Warrior';
    default: return 'quest';
  }
};

const rewardNodes = (quest: QuestDef): Node[] => {
  const parts: Node[] = [];
  for (const [c, n] of Object.entries(quest.reward) as Array<[CurrencyId, number]>) {
    parts.push(el('span', { class: 'q-reward-item' }, currencyIcon(c, { size: 'sm' }), formatExact(n)));
  }
  if (quest.rewardKnowledge > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Knowledge', { size: 'sm' }), formatExact(quest.rewardKnowledge)));
  }
  if (quest.rewardStardust > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Stardust', { size: 'sm' }), formatExact(quest.rewardStardust)));
  }
  if (quest.rewardMana > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      currencyIcon('Mana', { size: 'sm' }), formatExact(quest.rewardMana)));
  }
  if (quest.rewardGems > 0) {
    parts.push(el('span', { class: 'q-reward-item' },
      iconEl('Gems', { size: 'sm' }), formatExact(quest.rewardGems)));
  }
  return parts;
};

/** The pause between rolling one quest up and unrolling the next. */
const BETWEEN_MS = 500;

const sleep = (ms: number) => new Promise<void>((r) => { window.setTimeout(r, ms); });
const calm = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function mountQuestPill(game: Game, root: HTMLElement): void {
  const name = el('div', { class: 'q-name' });
  const desc = el('div', { class: 'q-desc' });
  const bar = progress('gold');
  const reward = el('div', { class: 'q-reward' });
  // A mark for what the quest is about. The whole scroll is the button: a
  // tap while the quest runs points you at the goal, a tap once it is done
  // takes the reward.
  const slot = el('div', { class: 'q-slot' });
  // Done, the scroll says only what it pays and the verb that takes it.
  const claim = el('span', { class: 'q-cta' }, 'Claim');

  // The parchment is its own layer so it can unroll under words that do not
  // reflow: it is nine-sliced, so its rollers stay whole at any width.
  const base = el('span', { class: 'q-base', 'aria-hidden': 'true' });
  const content = el('div', { class: 'q-content' },
    // The words; under them, the goal's mark resting on the start of its own
    // progress trough.
    el('div', { class: 'q-run' },
      el('div', { class: 'q-text' }, name, desc),
      el('div', { class: 'q-foot' }, slot, bar.root)),
    el('div', { class: 'q-done' }, reward, claim));
  const scroll = el('button', { class: 'q-scroll', type: 'button', 'data-coach': 'quest' }, base, content);

  // Nothing to tap while the scroll is rolling or unrolling.
  let busy = false;
  // Read the state at CLICK time, not at render time: a tap can land in the
  // same frame the goal completes, and claiming a quest that is not finished
  // is refused by the sim anyway — but pointing at a goal you just met would
  // be a small lie.
  scroll.addEventListener('click', () => {
    if (busy) return;
    if (game.questInfo()?.complete === true) game.doClaimQuest();
    else game.focusQuest();
  });
  root.replaceChildren(scroll);

  // The roll itself lives in ./scrollRoll.ts; every wait in it ends.
  const roll = new ScrollRoll(base, content, calm, playSfx);

  // Rebuild only what changes with the quest itself; the rest is mutated.
  let shownIndex = -1;
  // A quest that arrived while a sheet covered the map unrolls when the map
  // comes back, not while nobody can see it.
  let owedUnroll = true;

  const fill = (info: NonNullable<ReturnType<Game['questInfo']>>) => {
    const { quest } = info;
    shownIndex = info.index;
    name.textContent = quest.name;
    desc.textContent = questLine(quest, formatExact);
    reward.replaceChildren(...rewardNodes(quest));
    slot.replaceChildren(iconEl(goalIcon(quest), { size: 'md' }));
  };

  const live = (info: NonNullable<ReturnType<Game['questInfo']>>) => {
    const { quest, value, complete } = info;
    // One read-out for every goal, large or small: a filled bar with the count
    // written inside it. Small goals used to get a row of stamps instead,
    // which meant the widget changed SHAPE from quest to quest — and the
    // player had to re-find the number each time, on the one element whose
    // whole job is to be scannable at a glance.
    bar.set(value / quest.goalAmount, `${formatExact(value)}/${formatExact(quest.goalAmount)}`);

    // The reward is the payout, so it arrives with the payout — and then it
    // is all the scroll shows (quest.css swaps .q-run for .q-done).
    scroll.classList.toggle('is-complete', complete);
    // No CTA orb: a complete scroll already says so — its reward and its
    // Claim button are the whole of its face.
    // The card is one control that does two things; a screen reader has to be
    // told which, because the styling is all a sighted player gets.
    scroll.setAttribute(
      'aria-label',
      complete ? `Claim the reward for ${quest.name}` : `Show me where: ${quest.name}`,
    );
  };

  /** Roll the shown quest up and, if there is a next one, unroll it. */
  const handOver = async () => {
    busy = true;
    // The claimed card keeps its face while it rolls up, but stops bobbing.
    scroll.classList.add('is-leaving');
    let next = game.questInfo();
    try {
      await roll.rollUp();
      next = game.questInfo();
      if (next !== null) {
        await sleep(BETWEEN_MS);
        next = game.questInfo();
      }
    } finally {
      // Whatever ended the roll-up, the scroll does not stay rolled up and
      // busy: that was the blank scroll (Docs/plans/ux-pass.md §2.2).
      roll.settle();
      scroll.classList.remove('is-leaving');
      busy = false;
    }
    if (next === null) {
      // The chain is done: the scroll stays rolled up, and goes.
      shownIndex = -1;
      root.hidden = true;
      return;
    }
    fill(next);
    live(next);
    root.hidden = game.hasOpenSheet();
    await roll.unroll();
  };

  const refresh = () => {
    if (busy) return;
    // Between rolls, nothing may still hold the words faded out.
    roll.heal();
    const info = game.questInfo();
    if (info === null) {
      // Retired when the chain ends — rolled up first if it was on screen.
      if (shownIndex >= 0 && !root.hidden) void handOver();
      else root.hidden = true;
      return;
    }
    if (shownIndex >= 0 && info.index !== shownIndex && !root.hidden) {
      void handOver();
      return;
    }
    // Hidden while anything covers the map.
    root.hidden = game.hasOpenSheet();
    if (info.index !== shownIndex) {
      fill(info);
      owedUnroll = true;
    }
    live(info);
    if (owedUnroll && !root.hidden) {
      owedUnroll = false;
      void roll.unroll();
    }
  };
  game.onChange(refresh);
  refresh();
}
