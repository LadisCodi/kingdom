// The screen before a fight (Docs/features/11a-ruins-ui.md §2.5, §2.6).
//
// One screen serves every fight in the game — a gate today, a ruin's rooms
// when they land — so it takes a DESCRIPTOR rather than a ruin: what the
// battle is called, what is standing there, what the fight pays, and what the
// button says. The caller (`gateSheet.ts`) knows about garrisons; this file
// knows about boards.
//
// THE SCREEN IS A BOARD, NOT A FORM. The party used to be four steppers, one
// per unit type, and the player did arithmetic to fill them. It is slots now:
//
//   tap a slot → a panel of cards rises → tap a card → the slot fills
//
// and the count is the game's problem, not the player's — a card puts a whole
// squad in, or everything that is left of that type, or everything the army
// cap still allows (`Game.troopsAvailableFor`). What that buys is the thing
// the type chart needs to be legible: the decision on this screen is WHICH
// types stand against what is in the doorway, and a stepper buries that under
// eight plus-and-minus knobs.
//
// The panel is NOT drawn here: it is its own mount (`ui/battlePicker.ts`),
// built once and mutated. This sheet rebuilds on the tick — it carries a
// countdown — and a panel rebuilt with it restarts its slide-in animation
// every second, loses the rail's scroll position, and re-decodes every
// portrait on it. The same reason the quest pill and the ad tab are mutated
// rather than replaced.

import { HEROES, UNITS } from '../sim/data/definitions';
import type { EnemySquad } from '../sim/combat';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { CurrencyId, UnitId, Wallet } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { action, iconEl, sheet } from './kit';
import { unitBust } from './unitArt';

/** Everything the screen needs that is not the player's own army. */
export interface BattleView {
  /** What this fight is called — the loudest line on the screen. */
  title: string;
  /** Where it is happening. */
  subtitle: string;
  sprite: string;
  glyph: string;
  /** The dynamic band under the art: whatever this KIND of battle has to say
   *  — a garrison's countdown, a room's depth. Nodes, so the caller can put a
   *  countdown or a hoard in it. */
  info: Array<Node | string>;
  enemy: {
    squads: readonly EnemySquad[];
    power: number;
    threat: UnitId | 'Any';
  };
  /** The party's attack after the matchup, and what it is up against. */
  attack: number;
  enough: boolean;
  supplies: Wallet;
  /** What winning pays, as icon-and-amount chips. Empty is a legal state and
   *  says so — a gate's reward is the ruin behind it. */
  rewards: Array<{ icon: CurrencyId | 'ascension' | 'fragment' | 'pack'; label: string }>;
  /** One line under the chips: what winning is really for. */
  rewardNote?: string;
  actionLabel: string;
  /** The small print under the button, when this kind of fight has something
   *  to say that the board does not already show. Most do not. */
  actionNote?: string;
  onFight: () => void;
  /** Why the fight cannot start. A power SHORTFALL is never one of these: it
   *  warns and lets the player go anyway. */
  blocked: string | null;
}

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? spriteImgAt(url, cls)
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

/** A troop icon with a count under it — the shape both armies' slots share,
 *  so a filled slot on one side reads against the other at a glance. */
const squadFace = (unitId: UnitId, count: number): HTMLElement =>
  el('div', { class: 'bt-face' },
    unitBust(unitId, 'bt-portrait'),
    el('span', { class: 'bt-count' }, `x${count}`));

// ------------------------------------------------------------- the enemy

function enemyBox(view: BattleView): HTMLElement {
  const box = el('div', { class: 'bt-army is-enemy' },
    el('div', { class: 'bt-army-head' },
      el('h3', {}, 'Enemy army'),
      el('b', { class: 'bt-power' }, String(view.enemy.power))),
  );
  const row = el('div', { class: 'bt-slots' });
  for (const squad of view.enemy.squads) {
    row.append(el('div', { class: 'bt-slot is-filled' }, squadFace(squad.unitId, squad.count)));
  }
  box.append(row);
  // No line under the squads: the faces say what is standing there and the
  // number on the right says what it is worth. Prose that restates both is
  // what the screen was cut down to remove.
  return box;
}

// -------------------------------------------------------------- the party

/** The X in the corner of a filled slot. */
function clearBadge(label: string, onClear: () => void): HTMLElement {
  const b = el('button', { class: 'bt-clear', type: 'button', 'aria-label': label }, '✕');
  b.addEventListener('click', (event) => {
    event.stopPropagation(); // the slot underneath must not re-open the panel
    onClear();
  });
  return b;
}

/** An empty slot: the tap target that opens the panel. */
function emptySlot(label: string, onOpen: () => void): HTMLElement {
  const b = el('button', { class: 'bt-slot is-empty', type: 'button', 'aria-label': label },
    iconEl('plus', { size: 'lg' }));
  b.addEventListener('click', onOpen);
  return b;
}

/** A slot the player does not own yet. The padlock is the state; the price is
 *  the way out of it, and it is on the slot rather than in a separate button
 *  because the slot IS what is being bought. */
function lockedSlot(
  cost: number | null, label: string, onBuy: () => void,
): HTMLElement {
  const b = el('button', { class: 'bt-slot is-locked', type: 'button', 'aria-label': label },
    iconEl('padlock', { size: 'lg' }),
    // Only the NEXT slot carries a price. The ladder climbs, so printing this
    // one's Gems on all three would quote the wrong number twice.
    cost === null ? '' : el('span', { class: 'bt-price' },
      iconEl('Gems', { size: 'sm' }), String(cost)),
  );
  b.addEventListener('click', onBuy);
  return b;
}

/** The troop row. Every slot is open — there is no locked troop slot and
 *  nothing to buy, so this row has exactly two states. */
function troopSlots(game: Game): HTMLElement {
  const row = el('div', { class: 'bt-slots' });
  for (let i = 0; i < game.troopSlotsOpen(); i++) {
    const slot = game.expeditionParty[i];
    if (slot === undefined) {
      row.append(emptySlot('Add troops', () => game.openBattlePicker('troops')));
      continue;
    }
    const filled = el('div', { class: 'bt-slot is-filled' },
      squadFace(slot.unitId, slot.count),
      clearBadge(`Send no ${UNITS[slot.unitId].name}s`, () => game.clearTroopSlot(i)));
    filled.addEventListener('click', () => game.openBattlePicker('troops'));
    row.append(filled);
  }
  return row;
}

function heroSlots(game: Game): HTMLElement {
  const row = el('div', { class: 'bt-slots' });
  const open = game.heroSlotsOpen();
  for (let i = 0; i < game.heroSlotCeiling(); i++) {
    const heroId = game.partyHeroes[i];
    if (heroId !== undefined) {
      const def = HEROES[heroId];
      const filled = el('div', { class: 'bt-slot is-filled is-hero' },
        art(def.sprite, def.glyph, 'bt-portrait'),
        el('span', { class: 'bt-slot-name' }, def.unitType),
        clearBadge(`Leave ${def.name} behind`, () => game.clearHeroSlot(i)));
      filled.addEventListener('click', () => game.openBattlePicker('heroes'));
      row.append(filled);
    } else if (i < open) {
      row.append(emptySlot('Add a hero', () => game.openBattlePicker('heroes')));
    } else {
      const next = i === open;
      row.append(lockedSlot(next ? game.heroSlotOffer().cost : null,
        'Buy another hero slot', () => game.doBuyHeroSlot()));
    }
  }
  return row;
}

function partyBox(game: Game, view: BattleView): HTMLElement {
  return el('div', { class: `bt-army is-mine${view.enough ? '' : ' is-short'}` },
    el('div', { class: 'bt-army-head' },
      el('h3', {}, 'Your army'),
      el('b', { class: 'bt-power' }, String(view.attack))),
    troopSlots(game),
    el('div', { class: 'bt-army-label' }, 'Heroes'),
    heroSlots(game),
  );
}

// ------------------------------------------------------------- the panels

// -------------------------------------------------------------- the screen

export function renderBattleSheet(game: Game, view: BattleView): HTMLElement {
  const body = el('div', { class: 'bt' },
    // The sheet's plank is the battle's NAME, so the band under the art says
    // where it is and what it is worth instead of saying the name twice.
    // One parchment card (M10): the art down the left, the where-line and
    // the band's lines beside it.
    el('div', { class: 'bt-head' },
      art(view.sprite, view.glyph, 'bt-art'),
      el('div', { class: 'bt-where' }, view.subtitle),
      el('div', { class: 'bt-info' }, ...view.info)),
    enemyBox(view),
    partyBox(game, view),
  );

  const rewards = el('div', { class: 'bt-rewards' },
    el('div', { class: 'bt-army-head' }, el('h3', {}, 'Rewards')));
  if (view.rewards.length > 0) {
    rewards.append(el('div', { class: 'bt-chips' },
      ...view.rewards.map((r) => el('span', { class: 'bt-chip' },
        iconEl(r.icon, { size: 'sm' }), r.label))));
  }
  if (view.rewardNote !== undefined) {
    rewards.append(el('div', { class: 'bt-army-note' }, view.rewardNote));
  }
  body.append(rewards);

  body.append(action({
    label: view.actionLabel,
    kind: 'primary',
    onClick: view.onFight,
    cost: view.supplies,
    have: (c) => game.walletValue(c),
    disabledReason: view.blocked ?? undefined,
  }));
  if (view.actionNote !== undefined) {
    body.append(el('div', { class: 'bt-note' }, view.actionNote));
  }

  // No second way out: the sheet's own knob, top right, is the way back.
  // TALL, because this is a screen the player works in: the board has to be
  // readable against the room's, and a drawer that grew a row every time a
  // squad was added would move the button they are reaching for.
  return sheet(
    { title: view.title, onClose: () => game.dismiss(), tall: true }, body);
}
