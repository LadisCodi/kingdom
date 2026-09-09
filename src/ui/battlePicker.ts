// The card panel that fills a slot on the battle screen
// (Docs/features/11a-ruins-ui.md §2.6).
//
// ITS OWN MOUNT, BUILT ONCE AND MUTATED. It used to be drawn inside the sheet,
// which rebuilds every tick because it carries a countdown — so the panel was
// a NEW element once a second, and a new element restarts its own animation,
// scrolls its rail back to the start and re-decodes every portrait on it. The
// player saw a panel that kept sliding in over itself. Same fault the quest
// pill and the ad tab were written to avoid, and the same fix.
//
// So this file draws nothing on the tick. It rebuilds the rail only when the
// rail's OWN inputs change — which panel is open, what is at home, and what is
// already on the board — and otherwise leaves the DOM exactly where the
// player's thumb left it.
//
// It sits after `#overlay` in the markup at the same z-index, so it stacks
// over the sheet it belongs to and still under the header and the nav — the
// stack is load-bearing (CLAUDE.md), and a panel is not a reason to cover the
// purse or the way out.

import { HEROES, UNITS, type UnitDef } from '../sim/data/definitions';
import { heroStats, rosterView } from '../sim/heroes';
import { spriteUrl } from '../render/sprites';
import type { UnitId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { iconEl, knob, stat } from './kit';

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

/**
 * A troop's face, at the size the widget actually draws.
 *
 * Units are the one thing on these screens shown SMALL almost everywhere —
 * 48px in a squad slot, 64px in a card — and a whole standing soldier at that
 * size is a smudge, which is why each one ships a bust beside its full body
 * (Docs/art/portraits/unit-blocks.md §2). So: the bust first, the whole
 * soldier if that is all there is, and the atlas icon when neither has landed.
 * The atlas cell is the floor, never the emoji — `tests/icons.test.ts` exists
 * to keep that true.
 *
 * Exported because `battleSheet` draws the same face in its slots, and it
 * already imports this module.
 */
export function unitFace(unitId: UnitId, cls: string): HTMLElement {
  const { sprite } = UNITS[unitId];
  const url = spriteUrl(`${sprite}_avatar`) ?? spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : iconEl(unitId, { size: 'lg' });
}

/**
 * A card: art, a name, the three numbers, the POWER it would put on the
 * board, and one line about what tapping it does.
 *
 * The power is the headline of the three, because it is the only one that
 * compares to the enemy box's number on the screen behind — the stats say
 * WHAT the thing is, the power says what choosing it is worth. Both are here
 * because a squad's power is its count times a stat the player cannot see
 * anywhere else on this screen.
 */
function pickerCard(opts: {
  cls: string;
  art: HTMLElement;
  /** The unit type, as a word. Four icons at 16px are four similar
   *  silhouettes, and this is the fact the type chart turns on. */
  type: string;
  name: string;
  stats: Array<{ icon: 'atk' | 'def' | 'hp'; value: number }>;
  /** What it adds to the party's power, all of it. */
  power: number;
  note: string;
  disabled?: boolean;
  onPick: () => void;
}): HTMLElement {
  const card = el('button', {
    class: `bt-card ${opts.cls}${opts.disabled === true ? ' is-out' : ''}`,
    type: 'button',
  },
    el('span', { class: 'bt-card-tag' }, opts.type),
    opts.art,
    el('span', { class: 'bt-card-name' }, opts.name),
    el('span', { class: 'bt-card-power' },
      el('b', {}, String(opts.power)), el('span', {}, 'power')),
    el('span', { class: 'bt-card-stats' },
      ...opts.stats.map((n) => stat(n.icon, String(n.value)))),
    el('span', { class: 'bt-card-note' }, opts.note),
  );
  if (opts.disabled === true) card.disabled = true;
  else card.addEventListener('click', opts.onPick);
  return card;
}

/** What KIND of soldier this is, in the words the targeting rules use. */
const kindOf = (unit: UnitDef): string => (unit.tags.includes('Distance')
  ? 'Ranged' : unit.tags.includes('Mounted') ? 'Mounted' : 'Melee');

function troopCards(game: Game): HTMLElement[] {
  const roster = game.availableTroops();
  const owned = (Object.keys(roster) as UnitId[]).filter((u) => roster[u] > 0);
  if (owned.length === 0) {
    return [el('div', { class: 'bt-rail-empty' },
      'No soldiers at home. Train some at a military hall first.')];
  }
  return owned.map((unitId) => {
    const unit = UNITS[unitId];
    const would = game.troopsAvailableFor(unitId);
    // The only ceiling a card can hit now is the roster: the army cap bounds
    // what the city OWNS, and every soldier it owns may be sent.
    const note = would > 0
      ? `Send ${would} of ${roster[unitId]}`
      : 'All of them are with the party';
    return pickerCard({
      cls: 'is-troop',
      art: el('span', { class: 'bt-card-art' }, unitFace(unitId, 'bt-card-portrait')),
      // The card's NAME is the type — Warrior, Lancer, Archer, Cavalry — so
      // the chip carries the kind instead of saying the same word twice.
      type: kindOf(unit),
      name: unit.name,
      stats: [
        { icon: 'atk', value: unit.atk },
        { icon: 'def', value: unit.def },
        { icon: 'hp', value: unit.hp },
      ],
      // The whole squad's worth, not one soldier's: what tapping this adds.
      power: would * unit.power,
      note,
      disabled: would <= 0,
      onPick: () => game.assignTroop(unitId),
    });
  });
}

function heroCards(game: Game): HTMLElement[] {
  const owned = rosterView(game.state).filter((h) => h.owned);
  if (owned.length === 0) {
    return [el('div', { class: 'bt-rail-empty' }, 'No heroes yet. Call one at the banner.')];
  }
  return owned.map((view) => {
    const def = HEROES[view.id];
    // Already on the board is the only reason a hero cannot be picked: no
    // hero is ever BUSY, because every fight resolves on entry
    // (Docs/features/10-heroes.md §2.5).
    const inParty = game.partyHeroes.includes(view.id);
    const line = heroStats(game.state, view.id);
    return pickerCard({
      cls: 'is-hero',
      art: art(def.sprite, def.glyph, 'bt-card-portrait'),
      // A hero's type is the one fact that decides whether it belongs in this
      // party: it fights on the chart with it, and it buffs the troops that
      // share it (Docs/features/10-heroes.md §2.4).
      type: def.unitType,
      name: def.name,
      stats: [
        { icon: 'atk', value: line.atk },
        { icon: 'def', value: line.def },
        { icon: 'hp', value: line.hp },
      ],
      // A hero's power is its attack, the same rule a soldier's power follows.
      power: line.atk,
      note: inParty ? 'Already with the party' : `Level ${view.entry.level}`,
      disabled: inParty,
      onPick: () => game.assignHero(view.id),
    });
  });
}

/**
 * What the rail is drawn FROM. Rebuild on a change to any of it, and on
 * nothing else — the countdown ticking on the sheet behind is not the panel's
 * business.
 */
function signature(game: Game): string {
  if (game.battlePicker === null) return '';
  const roster = game.availableTroops();
  return [
    game.battlePicker,
    Object.entries(roster).map(([u, n]) => `${u}:${n}`).join(','),
    game.expeditionParty.map((s) => `${s.unitId}x${s.count}`).join(','),
    game.partyHeroes.join(','),
    game.state.heroes.owned.join(','),
    game.troopSlotsOpen(),
    game.heroSlotsOpen(),
  ].join('|');
}

export function mountBattlePicker(game: Game, root: HTMLElement): void {
  const scrim = el('div', { class: 'bt-scrim' });
  scrim.addEventListener('click', () => game.closeBattlePicker());
  const title = el('h3', {}, '');
  const rail = el('div', { class: 'bt-rail' });
  const panel = el('div', { class: 'bt-picker' },
    el('div', { class: 'bt-picker-head' },
      title,
      knob('✕', () => game.closeBattlePicker(), { label: 'Close the list' })),
    rail,
  );
  root.replaceChildren(scrim, panel);
  root.hidden = true;

  let drawn = '';

  const refresh = (): void => {
    const kind = game.battlePicker;
    const showing = kind !== null;
    if (!showing) {
      root.hidden = true;
      drawn = '';
      return;
    }
    const now = signature(game);
    if (now === drawn) return; // nothing the panel draws has moved
    const opening = drawn === '';
    drawn = now;
    title.textContent = kind === 'troops' ? 'Who goes' : 'Who leads';
    rail.replaceChildren(...(kind === 'troops' ? troopCards(game) : heroCards(game)));
    if (opening) {
      root.hidden = false;
      // Restart the slide only when the panel genuinely arrives, with the
      // forced reflow the ad tab needs for the same reason.
      panel.classList.remove('is-in');
      void panel.offsetWidth;
      panel.classList.add('is-in');
      rail.scrollLeft = 0;
    }
  };

  game.onChange(refresh);
  refresh();
}
