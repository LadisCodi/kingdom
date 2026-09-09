// The fight, played back (Docs/features/11a-ruins-ui.md §2.5,
// Docs/features/combat.md §13).
//
// THE FIGHT IS ALREADY OVER. The resolver ran the instant the player tapped,
// the rewards are in the wallet and the fallen are off the roster. What this
// screen does is replay the event list at the tick it was written in — so an
// interrupted replay costs nothing, and the same code plays back a room
// fought here or a PvP fight resolved somewhere else.
//
// Its own mount, for the reason `gachaScreen.ts` gives: `#overlay` has a
// z-index and is therefore a stacking context, so nothing inside it can rise
// above the nav. It sits one layer UNDER the reveal, because the spoils of a
// cleared room are dealt over the board that won them.
//
// Built once and mutated. A fight is thirty to a hundred events, each landing
// on a slot that has to flash and then stop flashing: rebuilding the DOM per
// event would restart every animation on the board and re-decode every
// portrait (the fault `battlePicker.ts` documents).

import { HEROES, UNITS, VILLAINS } from '../sim/data/definitions';
import { playSfx } from '../audio/sfx';
import { spriteUrl } from '../render/sprites';
import type { BattleEvent, BattleLog, BoardSlot, Side } from '../sim/battle';
import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl } from './kit';

/** How long the white flash sits on a slot that was hit. Two frames of a
 *  stepped animation — a pixel-art screen snaps, it does not glow. */
const FLASH_MS = 180;

/** A slot's face: the troop's bust, a hero's portrait, a villain's. */
function face(slot: BoardSlot): HTMLElement {
  if (slot.unitId !== null) {
    const { sprite } = UNITS[slot.unitId];
    const url = spriteUrl(`${sprite}_avatar`) ?? spriteUrl(sprite);
    return url
      ? el('img', { class: 'bs-portrait', src: url, alt: '' })
      : iconEl(slot.unitId, { size: 'lg' });
  }
  const def = slot.fighterId !== null && slot.fighterId in HEROES
    ? HEROES[slot.fighterId as keyof typeof HEROES]
    : slot.fighterId !== null && slot.fighterId in VILLAINS
      ? VILLAINS[slot.fighterId as keyof typeof VILLAINS]
      : null;
  const url = def === null ? null : spriteUrl(def.sprite);
  return url
    ? el('img', { class: 'bs-portrait', src: url, alt: '' })
    : el('div', { class: 'bs-portrait is-glyph' }, def?.glyph ?? '?');
}

/** One slot, and the two marks it can take: a flash and a skull. */
interface SlotView {
  root: HTMLElement;
  count: HTMLElement;
  power: number;
  troops: number;
}

function slotView(slot: BoardSlot): SlotView {
  const count = el('span', { class: 'bs-count' }, slot.kind === 'hero' ? '' : `x${slot.count}`);
  const root = el('div', { class: `bs-slot is-${slot.kind}` },
    face(slot),
    count,
    el('span', { class: 'bs-skull' }, iconEl('skull', { size: 'lg' })));
  return { root, count, power: slot.power, troops: slot.count };
}

/** The six rows, top to bottom: their heroes, their back, their front, then
 *  ours the other way up. The gap in the middle is the two armies facing each
 *  other, and it is the only thing on the screen that means nothing else. */
function boardRows(slots: readonly BoardSlot[], side: Side): {
  rows: HTMLElement[];
  views: Map<number, SlotView>;
} {
  const views = new Map<number, SlotView>();
  const row = (cls: string, of: readonly BoardSlot[]): HTMLElement => {
    const line = el('div', { class: `bs-row ${cls}` });
    for (const slot of of) {
      const view = slotView(slot);
      views.set(slot.id, view);
      line.append(view.root);
    }
    return line;
  };
  const heroes = slots.filter((s) => s.kind === 'hero');
  const back = slots.filter((s) => s.kind === 'troop' && s.row === 'back');
  const front = slots.filter((s) => s.kind === 'troop' && s.row === 'front');
  const rows = side === 'theirs'
    ? [row('is-heroes', heroes), row('is-back', back), row('is-front', front)]
    : [row('is-front', front), row('is-back', back), row('is-heroes', heroes)];
  return { rows, views };
}

export function mountBattleScreen(game: Game, root: HTMLElement): void {
  /** The playback on screen. Identity, not a flag: `notify()` fires every
   *  tick and rebuilding mid-fight would start the battle again. */
  let showing: unknown = null;
  let timer: number | null = null;

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const build = (playback: NonNullable<Game['battle']>): void => {
    const { log } = playback;
    const start = log.events[0];
    if (start?.kind !== 'start') return;

    const ours = boardRows(start.ours, 'ours');
    const theirs = boardRows(start.theirs, 'theirs');
    const views: Record<Side, Map<number, SlotView>> = {
      ours: ours.views,
      theirs: theirs.views,
    };

    // THE BAR. Two numbers and one split: what each side is still worth, as
    // the squads under it come apart (§12).
    const power: Record<Side, number> = { ours: 0, theirs: 0 };
    for (const side of ['ours', 'theirs'] as Side[]) {
      for (const v of views[side].values()) power[side] += v.power * v.troops;
    }
    const mine = el('span', { class: 'bs-bar-mine' }, String(power.ours));
    const yours = el('span', { class: 'bs-bar-theirs' }, String(power.theirs));
    const fill = el('div', { class: 'bs-bar-fill' });
    const bar = el('div', { class: 'bs-bar' }, fill, mine, yours);
    const paintBar = (): void => {
      const total = Math.max(1, power.ours + power.theirs);
      fill.style.width = `${Math.round((power.ours / total) * 100)}%`;
      mine.textContent = String(power.ours);
      yours.textContent = String(power.theirs);
    };
    paintBar();

    const plaque = el('div', { class: 'bs-plaque is-hidden' });
    const exit = el('div', { class: 'bs-exit is-hidden' },
      btn({ label: 'Leave the field', kind: 'primary', onClick: () => game.dismissBattle() }));
    const screen = el('div', { class: 'bs' },
      bar,
      el('div', { class: 'bs-where' },
        el('b', {}, playback.title),
        el('span', {}, playback.subtitle)),
      el('div', { class: 'bs-board' }, ...theirs.rows, el('div', { class: 'bs-gap' }), ...ours.rows),
      plaque,
      exit,
    );

    /** Apply one event to the board. The screen never works anything out —
     *  every number it paints came off the log (§13). */
    const apply = (event: BattleEvent): void => {
      if (event.kind === 'attack') {
        const view = views[event.to.side].get(event.to.id);
        if (view === undefined) return;
        view.root.classList.remove('is-hit');
        void view.root.offsetWidth; // restart the flash, however fast they land
        view.root.classList.add('is-hit');
        window.setTimeout(() => view.root.classList.remove('is-hit'), FLASH_MS);
        playSfx('hit', { group: 'battle', limit: 2 });
        return;
      }
      if (event.kind === 'troops_lost') {
        const view = views[event.at.side].get(event.at.id);
        if (view === undefined) return;
        power[event.at.side] -= (view.troops - event.alive) * view.power;
        view.troops = event.alive;
        view.count.textContent = `x${event.alive}`;
        paintBar();
        return;
      }
      if (event.kind === 'slot_wiped') {
        const view = views[event.at.side].get(event.at.id);
        if (view === undefined) return;
        view.root.classList.add('is-dead');
        view.count.textContent = '';
        playSfx('death', { group: 'battle', limit: 2 });
      }
    };

    let next = 1; // 0 is `start`, which built the board
    const draw = (): void => {
      const tick = game.battleTick(game.now());
      while (next < log.events.length) {
        const event = log.events[next]!;
        if (event.kind === 'start' || event.kind === 'end') { next += 1; continue; }
        if (event.tick > tick) break;
        apply(event);
        next += 1;
      }
      game.advanceBattle(game.now());
      const phase = game.battle?.phase;
      if (phase === undefined) return;
      if (phase !== 'playing' && plaque.classList.contains('is-hidden')) {
        plaque.classList.remove('is-hidden');
        plaque.classList.add(log.winner === 'ours' ? 'is-won' : 'is-lost');
        plaque.textContent = log.winner === 'ours' ? 'Victory' : 'Defeat';
        // The bar tells the truth at the end: a wiped side is worth nothing.
        power[log.winner === 'ours' ? 'theirs' : 'ours'] = 0;
        paintBar();
      }
      if (phase === 'done') {
        exit.classList.remove('is-hidden');
        stop();
      }
    };

    root.replaceChildren(screen);
    // Ticks are 100 ms and frames are not, so this runs on the log's own
    // clock rather than the game's one-second one.
    timer = window.setInterval(draw, 50);
    draw();
  };

  const refresh = (): void => {
    const playback = game.battle;
    if (playback === null) {
      if (showing !== null) {
        stop();
        root.replaceChildren();
        showing = null;
      }
      return;
    }
    if (playback === showing) return; // mid-fight; leave it alone
    showing = playback;
    build(playback);
  };

  game.onChange(refresh);
  refresh();
}

export type { BattleLog };
