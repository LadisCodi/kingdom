// The attack screen (Docs/proposals/lairs.md §6).
//
// One screen serves every fight in the game — a lair today, whatever else
// fights tomorrow — so it takes a DESCRIPTOR rather than a lair: what the
// battle is called, what is standing there, what it costs and what the button
// does. The caller (`lairSheet.ts`) knows about lairs; this file knows about
// boards.
//
// TOP TO BOTTOM, and nothing else:
//
//   the enemy's board — its six troop slots, its hero slots, and its power;
//   your board — the same, and your power;
//   the ROSTER: one tile per troop type, one per hero;
//   the action box — the supplies over Attack, Quick deploy beside it, and
//   the soldiers the fight will cost as its hint.
//
// NO ROWS. A squad's place in the fight — in front or behind — is its unit
// type's (combat.md §8), never a choice the player makes, so the deploy
// screen does not draw it: six troop slots of anything, and the hero slots.
// The fight's playback is where the rows are seen (battleScreen.ts). Built
// from the kit the district card and the upgrade popup use — the inset box,
// the section heading, the game's buttons — so the screen reads as one of
// theirs rather than as a thing of its own.
//
// THE PLAYER NEVER PICKS A SLOT. A tap on a troop tile sends one squad into
// the next free troop slot (`Game.assignTroop`), a tap on a
// hero tile puts the hero in or takes it out, and a tap on a filled slot of
// your board sends it home. The board above only shows the party.

import { HEROES, UNIT_ORDER, UNITS } from '../sim/data/definitions';
import type { EnemySquad } from '../sim/combat';
import type { HeroId, UnitId, Wallet } from '../sim/state';
import type { Game } from '../game';
import { el, formatExact } from './format';
import { btn, headPanel, hpBar, iconEl, sectionHead, sheet } from './kit';
import { unitBust } from './unitArt';
import { emptyHeroSlot, heroCard } from './heroCard';

/** Everything the screen needs that is not the player's own army. */
export interface BattleView {
  /** What this fight is called — the sheet's title plank. */
  title: string;
  enemy: {
    squads: readonly EnemySquad[];
    power: number;
    /** The face a squad of each type wears on the enemy side: a lair's
     *  creatures, not the player's own soldiers. */
    portrait: (unitId: UnitId) => HTMLElement;
    /** The faces of the heroes or villains it fields, if any. */
    heroes?: HTMLElement[];
  };
  /** The party's power, and whether it beats the enemy's on paper. */
  attack: number;
  enough: boolean;
  supplies: Wallet;
  /** Soldiers the fight will cost the party as it stands. */
  fallen: number;
  actionLabel: string;
  onFight: () => void;
  /** What the fight is about beyond the two boards — a world fight's loot
   *  and ground — side by side over the price row. */
  widgets?: readonly HTMLElement[];
  /** Why the fight cannot start. A power SHORTFALL is never one of these: it
   *  warns and lets the player go anyway. */
  blocked: string | null;
}

/** A squad on the board: its face in the round frame, its count under it. */
const squadCell = (face: HTMLElement, count: number): HTMLElement =>
  el('span', { class: 'bt-cell is-filled' },
    el('span', { class: 'k-portrait' }, el('span', { class: 'k-portrait-mask' }, face)),
    el('span', { class: 'bt-count' }, `×${formatExact(count)}`));

const emptyCell = (): HTMLElement => el('span', { class: 'bt-cell is-empty', 'aria-hidden': 'true' });
const emptyCard = (): HTMLElement => el('span', { class: 'bt-card is-empty', 'aria-hidden': 'true' });

/** A line of slots — the troops' or the heroes' — padded with empty ones to
 *  `slots`, so both boards keep one shape. No label: a hero slot is its own
 *  SHAPE (a gilt square, battle.css), so the two lines read apart unnamed. */
const slotGroup = (label: string, cells: HTMLElement[], slots: number, cls: string): HTMLElement => {
  while (cells.length < slots) cells.push(cls === 'is-heroes' ? emptyCard() : emptyCell());
  return el('div', { class: `bt-group ${cls}`, role: 'group', 'aria-label': label }, ...cells);
};

/** A board in a head panel (kit `headPanel`): the enemy's plank red, ours
 *  blue, the side's name on it and its total power anchored right — the
 *  crossed swords and the number. */
const armyBox = (label: string, power: number, cls: string, groups: HTMLElement[]): HTMLElement =>
  headPanel({
    tone: cls.includes('is-enemy') ? 'red' : 'blue',
    title: label,
    trailing: [iconEl('power', { size: 'sm' }), formatExact(power)],
    cls: `bt-army ${cls}`,
  }, ...groups);

/** The enemy's board alone — its red plank, its power and its squads — for
 *  a screen that shows what a fight is against before it is composed (a
 *  world camp's card). */
export const enemyPanel = (squads: readonly EnemySquad[], power: number, portrait: (u: UnitId) => HTMLElement): HTMLElement =>
  armyBox('Enemy', power, 'is-enemy', [slotGroup('Troops', squads.map((s) => squadCell(portrait(s.unitId), s.count)), 0, 'is-troops')]);

/** An army already in the field — camped at a dungeon or in the Portal —
 *  as the deployment draws the player's own: troops above, heroes below,
 *  the empty slots kept so it reads as the same board. Nothing on it is
 *  pressed: what went out is what fights (Docs/proposals/world-menus.md
 *  §3.9). A squad's losses so far ride under its count; a hero's wounds on
 *  a bar under its card. */
export function fieldArmyPanel(
  game: Game,
  army: {
    power: number;
    troops: ReadonlyArray<{ unitId: UnitId; count: number; lost: number }>;
    heroes: ReadonlyArray<{ heroId: HeroId; hp: number; hpMax: number }>;
  },
): HTMLElement {
  const troops = army.troops.map((s) => {
    const cell = squadCell(unitBust(s.unitId, 'k-portrait-art'), s.count);
    cell.classList.add('is-mine');
    if (s.lost > 0) cell.append(el('span', { class: 'bt-lost' }, `−${formatExact(s.lost)}`));
    return cell;
  });
  const heroes = army.heroes.map((h) => el('span', { class: 'bt-field-hero' },
    heroCard(game, h.heroId, { small: true }), hpBar(Math.round(h.hp), Math.round(h.hpMax))));
  return armyBox('Your army', army.power, 'is-mine', [
    slotGroup('Troops', troops, game.troopSlotsOpen(), 'is-troops'),
    ...(heroes.length > 0 ? [slotGroup('Heroes', heroes, game.heroSlotCeiling(), 'is-heroes')] : []),
  ]);
}

/** A HERO OR VILLAIN SLOT is a card, 2:3 — they carry the detailed art, so
 *  they get more room and a shape of their own beside the troops' rounds. */
const cardSlot = (cls: string, ...children: HTMLElement[]): HTMLElement =>
  el('span', { class: `bt-card ${cls}` }, ...children);

// ------------------------------------------------------------- the enemy

/** The enemy shows only what it FIELDS: its squads, centred, and a line of
 *  heroes or villains only when it has any. An empty slot on their side says
 *  nothing the player can act on. */
function enemyBoard(view: BattleView): HTMLElement {
  const troops = view.enemy.squads.map((s) => squadCell(view.enemy.portrait(s.unitId), s.count));
  const heroes = (view.enemy.heroes ?? []).map((face) => squadlessCell(face));
  return armyBox('Enemy', view.enemy.power, 'is-enemy', [
    slotGroup('Troops', troops, 0, 'is-troops'),
    ...(heroes.length > 0 ? [slotGroup('Villains', heroes, 0, 'is-heroes')] : []),
  ]);
}

/** A villain on the enemy's side: its card, no count and no HP bar — what it
 *  has is the fight's business. */
const squadlessCell = (face: HTMLElement): HTMLElement => {
  face.classList.add('bt-card-art');
  return cardSlot('is-filled is-villain', face);
};

// -------------------------------------------------------------- your board

function partyBoard(game: Game, view: BattleView): HTMLElement {
  const troops = game.expeditionParty
    .map((slot, index) => {
      const cell = el('button', {
        class: 'bt-cell is-filled is-mine', type: 'button',
        'aria-label': `Send ${slot.count} ${UNITS[slot.unitId].name}s home`,
      },
      el('span', { class: 'k-portrait' },
        el('span', { class: 'k-portrait-mask' }, unitBust(slot.unitId, 'k-portrait-art'))),
      el('span', { class: 'bt-count' }, `×${formatExact(slot.count)}`));
      cell.addEventListener('click', () => game.clearTroopSlot(index));
      return cell;
    });

  const heroes: HTMLElement[] = [];
  const open = game.heroSlotsOpen();
  for (let i = 0; i < game.heroSlotCeiling(); i++) {
    const heroId = game.partyHeroes[i];
    // An open slot, filled or not, opens the hero picker for all of them.
    if (heroId !== undefined) {
      heroes.push(heroCard(game, heroId, {
        small: true, onClick: () => game.pickPartyHeroes(),
        label: `Choose heroes — ${HEROES[heroId].name} leads`,
      }));
    } else if (i < open) {
      heroes.push(emptyHeroSlot({ small: true, onClick: () => game.pickPartyHeroes(), label: 'Choose heroes' }));
    } else {
      // Only the NEXT slot carries a price: the ladder climbs, so printing
      // this one's Gems on every locked slot would quote the wrong number.
      const next = i === open;
      const cell = el('button', {
        class: 'bt-card is-locked', type: 'button', 'aria-label': 'Buy another hero slot',
      },
      iconEl('padlock', { size: 'md' }),
      ...(next ? [el('span', { class: 'bt-price' },
        iconEl('Gems', { size: 'sm' }), formatExact(game.heroSlotOffer().cost))] : []));
      cell.addEventListener('click', () => game.doBuyHeroSlot());
      heroes.push(cell);
    }
  }

  // No hero yet — the first comes from the Tavern's banner — and the line of
  // hero slots would offer nothing to pick.
  return armyBox('Your army', view.attack, `is-mine${view.enough ? '' : ' is-short'}`, [
    slotGroup('Troops', troops, game.troopSlotsOpen(), 'is-troops'),
    ...(game.state.heroes.owned.length > 0
      ? [slotGroup('Heroes', heroes, game.heroSlotCeiling(), 'is-heroes')] : []),
  ]);
}

// -------------------------------------------------------------- the roster

function troopTile(game: Game, unitId: UnitId): HTMLElement {
  const left = game.troopsLeftAtHome(unitId);
  const refusal = game.troopRefusal(unitId);
  // The board's own medallion, so a troop reads the same at home and in the
  // party; its name under it says which it is.
  const tile = el('button', {
    class: `bt-troop${left <= 0 ? ' is-out' : ''}${refusal !== null && left > 0 ? ' is-full' : ''}`,
    type: 'button',
    'aria-label': refusal ?? `Send a squad of ${UNITS[unitId].name}s`,
  },
  el('span', { class: 'bt-cell is-filled' },
    el('span', { class: 'k-portrait' }, el('span', { class: 'k-portrait-mask' }, unitBust(unitId, 'k-portrait-art'))),
    el('span', { class: 'bt-count' }, formatExact(left))),
  el('span', { class: 'bt-troop-name' }, UNITS[unitId].name));
  tile.addEventListener('click', () => game.assignTroop(unitId));
  return tile;
}

// -------------------------------------------------------------- the action

function actionBox(game: Game, view: BattleView): HTMLElement {
  // The upgrade popup's cost box: the price over the button, inside the box.
  const price = el('div', { class: 'bt-go-price' },
    ...Object.entries(view.supplies).map(([c, n]) =>
      el('span', { class: `bt-go-chip${game.walletValue(c as never) < (n as number) ? ' is-short' : ''}` },
        iconEl(c as never), el('b', {}, formatExact(n as number)))));
  const hint = view.blocked
    ?? (view.fallen === 0 ? 'No soldiers lost' : `Expected losses: ~${view.fallen} soldier${view.fallen === 1 ? '' : 's'}`);
  return el('div', { class: 'bt-go k-section' },
    el('div', { class: 'bt-go-row' },
      btn({ label: 'Quick deploy', kind: 'blue', onClick: () => game.quickDeploy() }),
      el('div', { class: 'bt-go-buy' },
        price,
        btn({
          label: view.actionLabel,
          kind: 'primary',
          onClick: view.onFight,
          disabledReason: view.blocked ?? undefined,
        }))),
    el('div', { class: 'bt-go-note' }, hint));
}

// -------------------------------------------------------------- the screen

export function renderBattleSheet(game: Game, view: BattleView): HTMLElement {
  const troops = UNIT_ORDER.filter((u) => UNITS[u] !== undefined);
  const body = el('div', { class: 'bt' },
    enemyBoard(view),
    partyBoard(game, view),
    sectionHead('Troops'),
    el('div', { class: 'bt-roster' }, ...troops.map((u) => troopTile(game, u))),
    ...(view.widgets === undefined || view.widgets.length === 0 ? [] : [el('div', { class: 'bt-widgets' }, ...view.widgets)]),
    actionBox(game, view),
  );
  // TALL: the two boards, the roster and the button are all read together,
  // and a drawer that grew a row every time a squad went on would move the
  // button the thumb is reaching for.
  const surface = sheet({ title: view.title, onClose: () => game.dismiss(), tall: true }, body);
  // …and it gives up the tall sheet's strip of sky (battle.css, `is-board`):
  // every pixel of it belongs to the boards, so the screen fits without a
  // scroll on a phone.
  surface.classList.add('is-board');
  return surface;
}
