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

import { HEROES, UNITS } from '../sim/data/definitions';
import { heroIsBusy } from '../sim/expeditions';
import { rosterView } from '../sim/heroes';
import { spriteUrl } from '../render/sprites';
import type { UnitId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { iconEl, knob } from './kit';

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

/** A card: art, a name, and one line about what tapping it does. The heroes
 *  screen's card, in a horizontal rail. */
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
    const left = game.troopsLeftAtHome(unitId);
    // A card that cannot be tapped says WHICH of the two ceilings stopped it,
    // because the answers are different errands: train more, or build a hall.
    const note = would > 0
      ? `Send ${would} of ${roster[unitId]}`
      : left === 0
        ? 'All of them are with the party'
        : 'No room left in the army cap';
    return pickerCard({
      cls: 'is-troop',
      art: el('span', { class: 'bt-card-art' }, iconEl(unitId, { size: 'lg' })),
      name: unit.name,
      note,
      tag: `atk ${unit.atk}`,
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
    const inParty = game.partyHeroes.includes(view.id);
    // A hero is never busy for a fight that resolves on entry
    // (Docs/features/10-heroes.md §2.5); a DELVE is the exception, and it is
    // the delve's own screen that says so.
    const busy = game.battleHeroesAreCommitted() && heroIsBusy(game.state, view.id);
    return pickerCard({
      cls: 'is-hero',
      art: art(def.sprite, def.glyph, 'bt-card-portrait'),
      name: def.name,
      note: inParty ? 'Already with the party' : busy ? 'Underground' : `Lv ${view.entry.level}`,
      tag: def.unitType,
      disabled: inParty || busy,
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
