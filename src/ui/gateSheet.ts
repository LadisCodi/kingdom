// The gate, on the battle screen (Docs/features/18-garrisons-and-raids.md §7).
//
// The board, the slots and the panels are `battleSheet.ts` — every fight in
// the game uses them. What a gate adds is its CLOCK, and the clock is why the
// player is here.
//
// So the dynamic band under the art is the countdown, the trips left in the
// garrison and what it is holding, and the Rewards box is the hoard — every
// unit of which comes home when the gate falls — with Hero XP and the ruin's
// first-clear Knowledge. There is nothing behind it (Docs/proposals/lairs.md).

import { RUINS } from '../sim/data/definitions';
import type { Game } from '../game';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { el, formatDuration } from './format';
import { iconEl } from './kit';
import type { CurrencyId } from '../sim/state';

export function renderGateSheet(game: Game): HTMLElement {
  const ruinId = game.gateRuin!;
  const ruin = RUINS[ruinId];
  const gate = game.gateFor(ruinId);
  const preview = game.gatePreview()!;

  const info: Array<Node | string> = [];
  if (gate !== null && gate.nextRaidAt !== null) {
    const left = Math.max(0, (gate.nextRaidAt - game.now()) / 1000);
    info.push(el('div', { class: 'bt-info-line' },
      iconEl('hourglass', { size: 'sm' }),
      `They come for the city in ${formatDuration(left)}`));
    info.push(el('div', { class: 'bt-info-line is-soft' },
      `${gate.tripsLeft} raid${gate.tripsLeft === 1 ? '' : 's'} left in them, `
      + 'and each takes a slice of what the city has banked.'));
  } else if (gate !== null) {
    info.push(el('div', { class: 'bt-info-line' },
      iconEl('clock', { size: 'sm' }),
      'They have taken all they came for, and sit on it.'));
  }

  const hoard = Object.entries(gate?.hoard ?? {}).filter(([, n]) => n > 0);
  if (hoard.length > 0) {
    info.push(el('div', { class: 'bt-info-line is-soft' },
      'Cleared, every unit of what they took comes home.'));
  }

  const view: BattleView = {
    title: `${gate?.creature ?? 'A warband'} at the gate`,
    subtitle: `${ruin.name} · tier ${ruin.tier}`,
    sprite: ruin.sprite,
    glyph: ruin.glyph,
    info,
    enemy: { squads: preview.enemy, power: preview.power, threat: preview.threat },
    attack: preview.attack,
    enough: preview.enough,
    supplies: preview.supplies,
    // The hoard, Hero XP by tier, and the ruin's first-clear Knowledge: a
    // gate is cleared once, so this is everything it will ever pay.
    rewards: [
      ...hoard.map(([c, n]) => ({ icon: c as CurrencyId, label: String(n) })),
      { icon: 'HeroXp' as CurrencyId, label: `+${ruin.tier}` },
      { icon: 'Knowledge' as CurrencyId, label: `+${preview.knowledge}` },
    ],
    rewardNote: hoard.length > 0
      ? 'Everything they took comes home with it.'
      : `Drive them out of ${ruin.name} for good.`,
    actionLabel: 'Clear the gate',
    // A garrison fights back, and how badly is the fight's own answer — so
    // this says what is at stake, not a number nothing can promise.
    actionNote: 'Supplies are spent whether you win or lose, and so are '
      + 'soldiers — a garrison fights back. You can come back as many times '
      + 'as you like.',
    onFight: () => game.doClearGate(),
    blocked: game.gateBlockText(),
  };

  return renderBattleSheet(game, view);
}
