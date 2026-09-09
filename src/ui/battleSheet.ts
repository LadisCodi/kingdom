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
// The panel is a layer inside the sheet rather than a second overlay, because
// `#overlay` is a stacking context and nothing inside it may rise above the
// header or the nav — which is the design (CLAUDE.md). It closes on its own
// knob, on the scrim, and on the first Escape/back, and the screen behind it
// is still readable while it is open: the slots stay in view above it.

import { HEROES, UNITS } from '../sim/data/definitions';
import type { EnemySquad } from '../sim/gates';
import { heroIsBusy } from '../sim/expeditions';
import { rosterView } from '../sim/heroes';
import { spriteUrl } from '../render/sprites';
import type { CurrencyId, UnitId, Wallet } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { action, btn, iconEl, knob, sheet } from './kit';

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
  rewards: Array<{ icon: CurrencyId | 'ascension' | 'fragment'; label: string }>;
  /** One line under the chips: what winning is really for. */
  rewardNote?: string;
  actionLabel: string;
  onFight: () => void;
  /** Why the fight cannot start. A power SHORTFALL is never one of these: it
   *  warns and lets the player go anyway. */
  blocked: string | null;
}

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

/** A troop icon with a count under it — the shape both armies' slots share,
 *  so a filled slot on one side reads against the other at a glance. */
const squadFace = (unitId: UnitId, count: number): HTMLElement =>
  el('div', { class: 'bt-face' },
    iconEl(unitId, { size: 'lg' }),
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
  // The type is the whole decision this screen asks the player to make, so it
  // is spelled out rather than left to four similar silhouettes.
  box.append(el('div', { class: 'bt-army-note' }, view.enemy.threat === 'Any'
    ? 'A mixed warband — no single type answers it.'
    : `${view.enemy.threat}s. Bring what beats them.`));
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

function troopSlots(game: Game): HTMLElement {
  const row = el('div', { class: 'bt-slots' });
  const open = game.troopSlotsOpen();
  const ceiling = game.troopSlotCeiling();
  for (let i = 0; i < ceiling; i++) {
    const slot = game.expeditionParty[i];
    if (slot !== undefined) {
      const filled = el('div', { class: 'bt-slot is-filled' },
        squadFace(slot.unitId, slot.count),
        clearBadge(`Send no ${UNITS[slot.unitId].name}s`, () => game.clearTroopSlot(i)));
      filled.addEventListener('click', () => game.openBattlePicker('troops'));
      row.append(filled);
    } else if (i < open) {
      row.append(emptySlot('Add troops', () => game.openBattlePicker('troops')));
    } else {
      const next = i === open; // the one a purchase would open
      row.append(lockedSlot(next ? game.partySlotOffer().cost : null,
        'Buy another troop slot', () => game.doBuyPartySlot()));
    }
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
    el('div', { class: 'bt-army-note' }, view.enough
      ? 'Enough to win it.'
      : 'Short of them — you may still go, and lose only the supplies.'),
  );
}

// ------------------------------------------------------------- the panels

/** A card in a picker panel: art, a name, and one line about what tapping it
 *  does. The heroes screen's card, in a horizontal rail. */
function pickerCard(opts: {
  cls: string;
  art: HTMLElement;
  name: string;
  note: string;
  tag?: string;
  disabled?: boolean;
  onPick: () => void;
}): HTMLElement {
  const card = el('button', {
    class: `bt-card ${opts.cls}${opts.disabled === true ? ' is-out' : ''}`,
    type: 'button',
  },
    opts.tag === undefined ? '' : el('span', { class: 'bt-card-tag' }, opts.tag),
    opts.art,
    el('span', { class: 'bt-card-name' }, opts.name),
    el('span', { class: 'bt-card-note' }, opts.note),
  );
  if (opts.disabled === true) card.disabled = true;
  else card.addEventListener('click', opts.onPick);
  return card;
}

function troopRail(game: Game): HTMLElement {
  const rail = el('div', { class: 'bt-rail' });
  const roster = game.availableTroops();
  const owned = (Object.keys(roster) as UnitId[]).filter((u) => roster[u] > 0);
  if (owned.length === 0) {
    return el('div', { class: 'bt-rail-empty' },
      'No soldiers at home. Train some at a military hall first.');
  }
  for (const unitId of owned) {
    const unit = UNITS[unitId];
    const would = game.troopsAvailableFor(unitId);
    const left = game.troopsLeftAtHome(unitId);
    // A card that cannot be tapped says WHICH of the two ceilings stopped it,
    // because the answers are different errands: train more, or build a hall.
    const note = would > 0
      ? `Send ${would} of ${roster[unitId]}`
      : left === 0
        ? 'All of them are with the party'
        : 'No room left in the army cap';
    rail.append(pickerCard({
      cls: 'is-troop',
      art: el('span', { class: 'bt-card-art' }, iconEl(unitId, { size: 'lg' })),
      name: unit.name,
      note,
      tag: `atk ${unit.atk}`,
      disabled: would <= 0,
      onPick: () => game.assignTroop(unitId),
    }));
  }
  return rail;
}

function heroRail(game: Game): HTMLElement {
  const rail = el('div', { class: 'bt-rail' });
  const owned = rosterView(game.state).filter((h) => h.owned);
  if (owned.length === 0) {
    return el('div', { class: 'bt-rail-empty' }, 'No heroes yet. Call one at the banner.');
  }
  for (const view of owned) {
    const def = HEROES[view.id];
    const inParty = game.partyHeroes.includes(view.id);
    // A hero is never busy for a fight that resolves on entry
    // (Docs/features/10-heroes.md §2.5); a DELVE is the exception, and it is
    // the delve's own screen that says so.
    const busy = game.battleHeroesAreCommitted() && heroIsBusy(game.state, view.id);
    rail.append(pickerCard({
      cls: 'is-hero',
      art: art(def.sprite, def.glyph, 'bt-card-portrait'),
      name: def.name,
      note: inParty ? 'Already with the party' : busy ? 'Underground' : `Lv ${view.entry.level}`,
      tag: def.unitType,
      disabled: inParty || busy,
      onPick: () => game.assignHero(view.id),
    }));
  }
  return rail;
}

/** The panel itself: a scrim that closes it, and a drawer over the bottom of
 *  the screen. */
function picker(game: Game): HTMLElement {
  const kind = game.battlePicker!;
  const scrim = el('div', { class: 'bt-scrim' });
  scrim.addEventListener('click', () => game.closeBattlePicker());
  const panel = el('div', { class: 'bt-picker' },
    el('div', { class: 'bt-picker-head' },
      el('h3', {}, kind === 'troops' ? 'Who goes' : 'Who leads'),
      knob('✕', () => game.closeBattlePicker(), { label: 'Close the list' })),
    kind === 'troops' ? troopRail(game) : heroRail(game),
  );
  return el('div', { class: 'bt-layer' }, scrim, panel);
}

// -------------------------------------------------------------- the screen

export function renderBattleSheet(game: Game, view: BattleView): HTMLElement {
  const body = el('div', { class: 'bt' },
    // The sheet's plank is the battle's NAME, so the band under the art says
    // where it is and what it is worth instead of saying the name twice.
    el('div', { class: 'bt-head' },
      art(view.sprite, view.glyph, 'bt-art'),
      el('div', { class: 'bt-where' }, view.subtitle)),
    el('div', { class: 'bt-info' }, ...view.info),
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
  body.append(el('div', { class: 'bt-note' },
    'Supplies are spent whether you win or lose. Nobody dies, and you can '
    + 'come back as many times as you like.'));

  const close = btn({ label: 'Not yet', onClick: () => game.dismiss() });
  close.setAttribute('data-own-close', '');
  body.append(el('div', { class: 'bt-back' }, close));

  if (game.battlePicker !== null) body.append(picker(game));

  return sheet({ title: view.title, onClose: () => game.dismiss() }, body);
}
