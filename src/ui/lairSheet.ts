// The lair, on the battle screen (Docs/features/18-garrisons-and-raids.md §7).
//
// The board, the slots and the panels are `battleSheet.ts` — every fight in
// the game uses them. What a lair adds is its CLOCK, and the clock is why the
// player is here.
//
// So the dynamic band under the art is the countdown, the trips left in the
// garrison and what it is holding, and the Rewards box is the hoard — every
// unit of which comes home when the lair falls — with Hero XP and the lair's
// first-clear Knowledge. There is nothing behind it (Docs/proposals/lairs.md).

import { LAIRS } from '../sim/data/definitions';
import type { Game } from '../game';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { el, formatDuration } from './format';
import { iconEl } from './kit';
import type { CurrencyId } from '../sim/state';

export function renderLairSheet(game: Game): HTMLElement {
  const lairId = game.lairId!;
  const def = LAIRS[lairId];
  const lair = game.lairFor(lairId);
  const preview = game.lairPreview()!;

  const info: Array<Node | string> = [];
  if (lair !== null && lair.nextRaidAt !== null) {
    const left = Math.max(0, (lair.nextRaidAt - game.now()) / 1000);
    info.push(el('div', { class: 'bt-info-line' },
      iconEl('hourglass', { size: 'sm' }),
      `They come for the city in ${formatDuration(left)}`));
  }

  const hoard = Object.entries(lair?.hoard ?? {}).filter(([, n]) => n > 0);
  if (hoard.length > 0) {
    info.push(el('div', { class: 'bt-info-line is-soft' },
      'Cleared, every unit of what they took comes home.'));
  }

  const view: BattleView = {
    title: def.name,
    subtitle: `${lair?.creature ?? 'A warband'} · tier ${def.tier}`,
    sprite: def.sprite,
    glyph: def.glyph,
    info,
    enemy: { squads: preview.enemy, power: preview.power, threat: preview.threat },
    attack: preview.attack,
    enough: preview.enough,
    supplies: preview.supplies,
    // The hoard, Hero XP by tier, and the lair's first-clear Knowledge: a
    // lair is cleared once, so this is everything it will ever pay.
    rewards: [
      ...hoard.map(([c, n]) => ({ icon: c as CurrencyId, label: String(n) })),
      { icon: 'HeroXp' as CurrencyId, label: `+${def.tier}` },
      { icon: 'Knowledge' as CurrencyId, label: `+${preview.knowledge}` },
    ],
    rewardNote: hoard.length > 0
      ? 'Everything they took comes home with it.'
      : 'Drive them out of their lair for good.',
    actionLabel: 'Clear the lair',
    // They fight back, and how badly is the fight's own answer — so
    // this says what is at stake, not a number nothing can promise.
    actionNote: 'Supplies are spent whether you win or lose, and so are '
      + 'soldiers — they fight back. You can come back as many times '
      + 'as you like.',
    onFight: () => game.doAttackLair(),
    blocked: game.lairBlockText(),
  };

  return renderBattleSheet(game, view);
}
