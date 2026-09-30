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
//   the enemy's board — heroes, back row, front row, and its power;
//   your board — front row, back row, heroes, and your power;
//   the ROSTER: one tile per troop type, one per hero;
//   the action box — the supplies over Attack, Quick deploy beside it, and
//   the soldiers the fight will cost as its hint.
//
// The two front rows face each other across the gap between the boxes. Built
// from the kit the district card and the upgrade popup use — the inset box,
// the section heading, the game's buttons — so the screen reads as one of
// theirs rather than as a thing of its own.
//
// THE PLAYER NEVER PICKS A SLOT. A tap on a troop tile sends one squad into
// the next free slot of that unit's own row (`Game.assignTroop`), a tap on a
// hero tile puts the hero in or takes it out, and a tap on a filled slot of
// your board sends it home. The board above only shows the party.

import { HEROES, UNIT_ORDER, UNITS } from '../sim/data/definitions';
import type { EnemySquad } from '../sim/combat';
import { rowFor, type Row } from '../sim/battle';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { HeroId, UnitId, Wallet } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl, sectionHead, sheet } from './kit';
import { unitBust } from './unitArt';

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
  };
  /** The party's power, and whether it beats the enemy's on paper. */
  attack: number;
  enough: boolean;
  supplies: Wallet;
  /** Soldiers the fight will cost the party as it stands. */
  fallen: number;
  actionLabel: string;
  onFight: () => void;
  /** Why the fight cannot start. A power SHORTFALL is never one of these: it
   *  warns and lets the player go anyway. */
  blocked: string | null;
}

const SLOTS_PER_ROW = 3;

/** A squad on the board: its face in the round frame, its count under it. */
const squadCell = (face: HTMLElement, count: number): HTMLElement =>
  el('span', { class: 'bt-cell is-filled' },
    el('span', { class: 'k-portrait' }, el('span', { class: 'k-portrait-mask' }, face)),
    el('span', { class: 'bt-count' }, `×${count}`));

const emptyCell = (): HTMLElement => el('span', { class: 'bt-cell is-empty', 'aria-hidden': 'true' });

/** A row of the board: its name, then its slots — never fewer than three, so
 *  both boards keep one shape. */
const boardRow = (label: string, cells: HTMLElement[], cls = ''): HTMLElement => {
  while (cells.length < SLOTS_PER_ROW) cells.push(emptyCell());
  return el('div', { class: `bt-row${cls ? ` ${cls}` : ''}` },
    el('span', { class: 'bt-row-label' }, label),
    el('div', { class: 'bt-row-slots' }, ...cells));
};

/** A board in its inset box, headed like a section — `ENEMY · 60`. */
const armyBox = (label: string, power: number, cls: string, rows: HTMLElement[]): HTMLElement => {
  const head = sectionHead(`${label} · ${power}`);
  head.classList.add('bt-army-head');
  return el('section', { class: `bt-army k-section ${cls}` }, head, ...rows);
};

const heroFace = (heroId: HeroId): HTMLElement => {
  const def = HEROES[heroId];
  const url = spriteUrl(def.sprite);
  return url ? spriteImgAt(url, 'k-portrait-art') : el('span', { class: 'k-portrait-art is-glyph' }, def.glyph);
};

// ------------------------------------------------------------- the enemy

function enemyBoard(view: BattleView): HTMLElement {
  const cellsIn = (row: Row): HTMLElement[] => view.enemy.squads
    .filter((s) => rowFor(s.unitId) === row)
    .map((s) => squadCell(view.enemy.portrait(s.unitId), s.count));
  // Inverted: from the top, heroes, then the back row, then the FRONT — so
  // the front row stands nearest ours, across the gap.
  return armyBox('Enemy', view.enemy.power, 'is-enemy', [
    boardRow('Heroes', [], 'is-heroes'),
    boardRow('Back row', cellsIn('back')),
    boardRow('Front row', cellsIn('front')),
  ]);
}

// -------------------------------------------------------------- your board

function partyBoard(game: Game, view: BattleView): HTMLElement {
  const cellsIn = (row: Row): HTMLElement[] => game.expeditionParty
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => rowFor(slot.unitId) === row)
    .map(({ slot, index }) => {
      const cell = el('button', {
        class: 'bt-cell is-filled is-mine', type: 'button',
        'aria-label': `Send ${slot.count} ${UNITS[slot.unitId].name}s home`,
      },
      el('span', { class: 'k-portrait' },
        el('span', { class: 'k-portrait-mask' }, unitBust(slot.unitId, 'k-portrait-art'))),
      el('span', { class: 'bt-count' }, `×${slot.count}`));
      cell.addEventListener('click', () => game.clearTroopSlot(index));
      return cell;
    });

  const heroes: HTMLElement[] = [];
  const open = game.heroSlotsOpen();
  for (let i = 0; i < game.heroSlotCeiling(); i++) {
    const heroId = game.partyHeroes[i];
    if (heroId !== undefined) {
      const cell = el('button', {
        class: 'bt-cell is-filled is-mine is-hero', type: 'button',
        'aria-label': `Leave ${HEROES[heroId].name} behind`,
      }, el('span', { class: 'k-portrait' }, el('span', { class: 'k-portrait-mask' }, heroFace(heroId))));
      cell.addEventListener('click', () => game.clearHeroSlot(i));
      heroes.push(cell);
    } else if (i < open) {
      heroes.push(emptyCell());
    } else {
      // Only the NEXT slot carries a price: the ladder climbs, so printing
      // this one's Gems on every locked slot would quote the wrong number.
      const next = i === open;
      const cell = el('button', {
        class: 'bt-cell is-locked', type: 'button', 'aria-label': 'Buy another hero slot',
      },
      iconEl('padlock', { size: 'md' }),
      ...(next ? [el('span', { class: 'bt-price' },
        iconEl('Gems', { size: 'sm' }), String(game.heroSlotOffer().cost))] : []));
      cell.addEventListener('click', () => game.doBuyHeroSlot());
      heroes.push(cell);
    }
  }

  return armyBox('Your army', view.attack, `is-mine${view.enough ? '' : ' is-short'}`, [
    boardRow('Front row', cellsIn('front')),
    boardRow('Back row', cellsIn('back')),
    boardRow('Heroes', heroes, 'is-heroes'),
  ]);
}

// -------------------------------------------------------------- the roster

function troopTile(game: Game, unitId: UnitId): HTMLElement {
  const left = game.troopsLeftAtHome(unitId);
  const refusal = game.troopRefusal(unitId);
  const tile = el('button', {
    class: `bt-tile k-section${left <= 0 ? ' is-out' : ''}${refusal !== null && left > 0 ? ' is-full' : ''}`,
    type: 'button',
    'aria-label': refusal ?? `Send a squad of ${UNITS[unitId].name}s`,
  },
  unitBust(unitId, 'bt-tile-art'),
  el('span', { class: 'bt-tile-emblem' }, iconEl(unitId, { size: 'sm' })),
  el('span', { class: 'bt-tile-count' }, String(left)));
  tile.addEventListener('click', () => game.assignTroop(unitId));
  return tile;
}

function heroTile(game: Game, heroId: HeroId): HTMLElement {
  const picked = game.partyHeroes.includes(heroId);
  const def = HEROES[heroId];
  const tile = el('button', {
    class: `bt-tile k-section is-hero${picked ? ' is-picked' : ''}`,
    type: 'button',
    'aria-label': picked ? `Leave ${def.name} behind` : `Take ${def.name}`,
    'aria-pressed': picked ? 'true' : 'false',
  },
  heroFace(heroId),
  el('span', { class: 'bt-tile-count' }, `Lv ${game.heroLevelOf(heroId)}`),
  ...(picked ? [el('span', { class: 'bt-tile-check' }, iconEl('tick', { size: 'md' }))] : []));
  tile.addEventListener('click', () => game.toggleHero(heroId));
  return tile;
}

// -------------------------------------------------------------- the action

function actionBox(game: Game, view: BattleView): HTMLElement {
  // The upgrade popup's cost box: the price over the button, inside the box.
  const price = el('div', { class: 'bt-go-price' },
    ...Object.entries(view.supplies).map(([c, n]) =>
      el('span', { class: `bt-go-chip${game.walletValue(c as never) < (n as number) ? ' is-short' : ''}` },
        iconEl(c as never), el('b', {}, String(n)))));
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
    sectionHead('Heroes'),
    el('div', { class: 'bt-roster is-heroes' },
      ...game.state.heroes.owned.map((h) => heroTile(game, h))),
    actionBox(game, view),
  );
  // TALL: the two boards, the roster and the button are all read together,
  // and a drawer that grew a row every time a squad went on would move the
  // button the thumb is reaching for.
  return sheet({ title: view.title, onClose: () => game.dismiss(), tall: true }, body);
}
