// One ROOM of a ruin, on the battle screen
// (Docs/features/11-expeditions.md §5, Docs/features/11a-ruins-ui.md §2.5).
//
// The board, the slots and the card panels are `battleSheet.ts` — every fight
// in the game uses them. What a room adds is THE WIDGET AT THE TOP: where the
// player is standing, as an address and as two ladders.
//
//   Depth  ▓▓▓▓▓▓░░░░   how far into the ruin
//   Room   ▓▓░░░░░░░💀  how far into this depth, and the door at the end
//
// Two bars rather than one count, because they are two different questions —
// "how much ruin is left" is the campaign and "how much depth is left" is
// tonight — and the boss on the end of the second one is what the room ladder
// is walking towards.
//
// There is no "how far will you go" on this screen, because there is no
// journey: one room, one fight, decided now (§5). What is NOT here any more,
// and each was a whole control: the safe depth (there is no run to be safe
// through), the standing order (there is nothing to stand), the checkpoint
// (nothing waits), and the relic in the pack — a relic is worn by the kingdom
// or it is on the shelf (Docs/features/09-relics.md §5). Enter, see, decide
// again.

import { ARTIFACTS, RUINS } from '../sim/data/definitions';
import type { CurrencyId } from '../sim/state';
import type { Game } from '../game';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { el } from './format';
import { iconEl, progress } from './kit';

/**
 * One ladder: a word, a trough, and — on the room's — the door at the end of
 * it.
 *
 * The FILL is what is behind the player and the LABEL is where they are
 * standing, which are deliberately two different numbers: standing in room 1
 * of 8 with nothing cleared is an empty bar, and it should be.
 */
function track(
  label: string, at: number, total: number, tone: 'sky' | 'gold', end?: HTMLElement,
): HTMLElement {
  const bar = progress(tone);
  bar.set(total === 0 ? 0 : (at - 1) / total, `${Math.min(at, total)} / ${total}`);
  return el('div', { class: 'exp-track' },
    el('span', { class: 'exp-track-name' }, label),
    bar.root,
    ...(end === undefined ? [] : [end]));
}

export function renderExpeditionSheet(game: Game): HTMLElement {
  const ruinId = game.expeditionRuin!;
  const ruin = RUINS[ruinId];
  const preview = game.expeditionPreview()!;
  const relic = ARTIFACTS[ruin.artifact];
  const alreadyHave = game.state.ruinsCleared[ruinId] === true;

  // THE WIDGET: where the player is standing. A room is one fight and the
  // address is the whole of the context — how far in, how far left, and
  // whether the thing behind this door is the depth's boss.
  //
  // Both bars count what is BEHIND the player: the room they are about to
  // fight is the one the fill stops at, never one the bar has already eaten.
  const boss = el('span', {
    class: `exp-track-boss${preview.isBoss ? ' is-now' : ''}`,
    title: 'The boss of this depth',
  }, iconEl('skull', { size: 'md' }));
  const info: Array<Node | string> = [
    el('div', { class: 'exp-safe' },
      el('b', {}, `${preview.depth}·${preview.room}`),
      el('span', {}, preview.isBoss
        ? `Depth ${preview.depth}, and this one is the boss`
        : `Depth ${preview.depth} · Room ${preview.room}`)),
    track('Depth', preview.depth, preview.depths, 'sky'),
    track('Room', preview.room, preview.roomsInDepth, 'gold', boss),
    el('div', { class: 'bt-info-line is-soft' },
      'Rooms are fought one at a time, in order, and never again. Clearing the '
      + 'last one of a depth opens the next.'),
    el('div', { class: 'bt-info-line is-soft' }, alreadyHave
      ? `${relic.name} is already home; the rooms still pay.`
      : `${relic.name} is behind the last room of the last depth.`),
  ];

  const reward = preview.reward;
  const view: BattleView = {
    title: ruin.name,
    subtitle: `Tier ${ruin.tier} ruin · Depth ${preview.depth} · Room ${preview.room}`,
    sprite: ruin.sprite,
    glyph: ruin.glyph,
    info,
    enemy: { squads: preview.enemy, power: preview.power, threat: preview.threat },
    attack: preview.attack,
    enough: preview.enough,
    supplies: preview.supplies,
    rewards: [
      ...Object.entries(reward.wallet)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => ({ icon: c as CurrencyId, label: String(n) })),
      { icon: 'HeroXp' as CurrencyId, label: `+${reward.heroXp}` },
      ...(reward.fragments > 0
        ? [{ icon: 'fragment' as const, label: `+${reward.fragments}` }] : []),
    ],
    rewardNote: preview.isBoss
      ? 'A boss pays four times a room, and the depth behind it opens on the way out.'
      : 'Paid the moment the room falls — there is nothing to carry home.',
    actionLabel: preview.isBoss ? 'Fight the boss' : 'Enter the room',
    onFight: () => game.doLaunchExpedition(),
    blocked: game.expeditionLaunchBlock(),
  };

  return renderBattleSheet(game, view);
}
