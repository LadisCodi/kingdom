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

import { COMBAT, HEROES, UNITS, VILLAINS } from '../sim/data/definitions';
import { SKILLS } from '../sim/skills';
import { playSfx } from '../audio/sfx';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { targetingFor } from '../sim/battle';
import type { BattleEvent, BattleLog, BoardSlot, Side, SlotRef } from '../sim/battle';
import type { UnitId } from '../sim/state';
import type { Game } from '../game';
import { createFxLayer, type Pt } from './battleFx';
import { el, formatExact, formatShort } from './format';
import { btn, iconEl } from './kit';

/** How long the white flash sits on a slot that was hit. Two frames of a
 *  stepped animation — a pixel-art screen snaps, it does not glow. */
const FLASH_MS = 180;

/** A slot's face: the troop's bust — or, on a side that fields creatures, the
 *  creature's (`enemyFaces`) — a hero's portrait, a villain's. */
function face(slot: BoardSlot, faces?: Partial<Record<UnitId, string>>): HTMLElement {
  if (slot.unitId !== null) {
    const { sprite } = UNITS[slot.unitId];
    const creature = faces?.[slot.unitId];
    const url = (creature ? spriteUrl(creature) : null)
      ?? spriteUrl(`${sprite}_avatar`) ?? spriteUrl(sprite);
    return url
      ? spriteImgAt(url, 'bs-portrait')
      : iconEl(slot.unitId, { size: 'lg' });
  }
  const def = slot.fighterId !== null && slot.fighterId in HEROES
    ? HEROES[slot.fighterId as keyof typeof HEROES]
    : slot.fighterId !== null && slot.fighterId in VILLAINS
      ? VILLAINS[slot.fighterId as keyof typeof VILLAINS]
      : null;
  const url = def === null ? null : spriteUrl(def.sprite);
  return url
    ? spriteImgAt(url, 'bs-portrait')
    : el('div', { class: 'bs-portrait is-glyph' }, def?.glyph ?? '?');
}

/** A slot on the board — its marks, and what the playback keeps about it. */
interface SlotView {
  root: HTMLElement;
  count: HTMLElement;
  /** The ring round the portrait: health left, as a share of what it
   *  walked in with. */
  life: HTMLElement;
  type: UnitId;
  kind: BoardSlot['kind'];
  power: number;
  troops: number;
  /** Health now and its whole — the ring is the one over the other. The
   *  whole is `hpUnit × count`, which for a wounded hero is more than it
   *  started with, so the ring shows the wound. */
  pool: number;
  max: number;
  /** Its middle in the screen's own pixels, measured once it is laid out. */
  at: Pt;
  lunge: Animation | null;
}

function slotView(slot: BoardSlot, side: Side, faces?: Partial<Record<UnitId, string>>): SlotView {
  const count = el('span', { class: 'bs-count' }, slot.kind === 'hero' ? '' : `x${formatExact(slot.count)}`);
  const life = el('span', { class: 'bs-life' });
  const root = el('div', { class: `bs-slot is-${slot.kind} is-${side}` },
    life,
    face(slot, faces),
    count,
    el('span', { class: 'bs-skull' }, iconEl('skull', { size: 'lg' })));
  const max = Math.max(1, slot.hpUnit * slot.count);
  life.style.setProperty('--life', String(slot.hpPool / max));
  life.style.setProperty('--ghost', String(slot.hpPool / max));
  return {
    root, count, life, type: slot.type, kind: slot.kind, power: slot.power, troops: slot.count,
    pool: slot.hpPool, max, at: { x: 0, y: 0 }, lunge: null,
  };
}

/** The six rows, top to bottom: their heroes, their back, their front, then
 *  ours the other way up. The gap in the middle is the two armies facing each
 *  other, and it is the only thing on the screen that means nothing else. */
function boardRows(
  slots: readonly BoardSlot[], side: Side, faces?: Partial<Record<UnitId, string>>,
): {
  rows: HTMLElement[];
  views: Map<number, SlotView>;
} {
  const views = new Map<number, SlotView>();
  const row = (cls: string, of: readonly BoardSlot[]): HTMLElement => {
    const line = el('div', { class: `bs-row ${cls}` });
    for (const slot of of) {
      const view = slotView(slot, side, faces);
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

type Attack = Extract<BattleEvent, { kind: 'attack' }>;

/** How long before a blow lands its swing starts, in ms of the fight. The
 *  lunge peaks — and the arrow arrives — ON the tick the log wrote, so the
 *  hit, the number and the count all fall on the blow. */
const LUNGE_LEAD = 130;
/** …and how long the swing takes to come back. */
const LUNGE_BACK = 170;
/** An arrow's flight, and a hero's bolt's. The archer looses this long
 *  before the blow lands. */
const ARROW_FLIGHT = 300;
const BOLT_FLIGHT = 240;
/** The furthest ahead of the clock the playback reads: an archer's draw. */
const CUE_LEAD = ARROW_FLIGHT + LUNGE_LEAD;
/** Blows on one slot closer together than this add up into ONE number that
 *  grows. A front line takes a dozen blows a second; a dozen numbers each
 *  is confetti, not information. */
const MERGE_MS = 260;
/** Never more numbers in the air than this — the oldest goes first. */
const MAX_FLOATS = 6;
const FLOAT_MS = 900;
/** Where the numbers on one slot sit, in turn, so two never stack. */
const FLOAT_SPREAD: readonly (readonly [number, number])[] = [[0, 0], [-20, 10], [20, -8], [-12, -14], [12, 14]];
/** A frame further on than this is a Skip, or a tab coming back: the board
 *  catches up and nothing flies. */
const CATCH_UP_MS = 600;
/** The freeze on a heavy blow and on a squad going down, in real ms — and
 *  never two closer than `HOLD_GAP` ms of the fight. */
const HOLD_MS = 70;
const HOLD_WIPE_MS = 110;
const HOLD_GAP = 500;
/** A blow that takes this share of a slot's whole health counts as heavy. */
const HEAVY = 0.08;

const calm = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function mountBattleScreen(game: Game, root: HTMLElement): void {
  /** The playback on screen. Identity, not a flag: `notify()` fires every
   *  tick and rebuilding mid-fight would start the battle again. */
  let showing: unknown = null;
  let teardown: (() => void) | null = null;

  const stop = (): void => {
    teardown?.();
    teardown = null;
  };

  const build = (playback: NonNullable<Game['battle']>): void => {
    stop();
    const { log } = playback;
    const start = log.events[0];
    if (start?.kind !== 'start') return;

    const ours = boardRows(start.ours, 'ours');
    const theirs = boardRows(start.theirs, 'theirs', playback.enemyFaces);
    const views: Record<Side, Map<number, SlotView>> = {
      ours: ours.views,
      theirs: theirs.views,
    };
    const all = [...ours.views.values(), ...theirs.views.values()];
    const viewOf = (ref: SlotRef): SlotView | undefined => views[ref.side].get(ref.id);

    // THE BAR. Two numbers and one split: what each side is still worth, as
    // the squads under it come apart (§12).
    const power: Record<Side, number> = { ours: 0, theirs: 0 };
    for (const side of ['ours', 'theirs'] as Side[]) {
      for (const v of views[side].values()) power[side] += v.power * v.troops;
    }
    const mine = el('span', { class: 'bs-bar-mine' }, formatExact(power.ours));
    const yours = el('span', { class: 'bs-bar-theirs' }, formatExact(power.theirs));
    const fill = el('div', { class: 'bs-bar-fill' });
    const bar = el('div', { class: 'bs-bar' }, fill, mine, yours);
    const paintBar = (): void => {
      const total = Math.max(1, power.ours + power.theirs);
      fill.style.width = `${Math.round((power.ours / total) * 100)}%`;
      mine.textContent = formatExact(power.ours);
      yours.textContent = formatExact(power.theirs);
    };
    paintBar();

    // THE CLOCK'S TWO KNOBS: twice the speed (kept for the next fight), and
    // straight to the end. A fight lasts tens of seconds, a dungeon has many.
    const speed = el('button', { class: 'bs-knob', type: 'button', 'aria-label': 'Play faster' });
    const paintSpeed = (): void => {
      const fast = (game.battle?.speed ?? 1) > 1;
      speed.textContent = fast ? '×1' : '×2';
      speed.setAttribute('aria-pressed', fast ? 'true' : 'false');
    };
    speed.addEventListener('click', () => {
      game.setBattleSpeed((game.battle?.speed ?? 1) > 1 ? 1 : 2);
      paintSpeed();
    });
    paintSpeed();
    const skip = el('button', { class: 'bs-knob', type: 'button' }, 'Skip');
    skip.addEventListener('click', () => game.skipBattle());
    const knobs = el('div', { class: 'bs-knobs' }, speed, skip);

    const plaque = el('div', { class: 'bs-plaque is-hidden' });
    const exit = el('div', { class: 'bs-exit is-hidden' },
      btn({ label: 'Leave the field', kind: 'primary', onClick: () => game.dismissBattle() }));
    // What moves between slots is drawn on one canvas over the board; the
    // numbers float in a layer of their own beside it, so a slot that greys
    // out on its death does not grey its last number with it.
    const fx = createFxLayer();
    const floats = el('div', { class: 'bs-floats' });
    const screen = el('div', { class: 'bs' },
      bar,
      el('div', { class: 'bs-where' },
        el('b', {}, playback.title),
        el('span', {}, playback.subtitle)),
      knobs,
      el('div', { class: 'bs-board' }, ...theirs.rows, el('div', { class: 'bs-gap' }), ...ours.rows),
      fx.canvas,
      floats,
      plaque,
      exit,
    );

    /** One design pixel (`--px`) in CSS pixels: a slot is 66 of them. */
    let unit = 1;
    const measure = (): void => {
      const box = screen.getBoundingClientRect();
      if (box.width === 0) return;
      for (const v of all) {
        const r = v.root.getBoundingClientRect();
        v.at = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      }
      unit = (all[0]?.root.offsetWidth ?? 66) / 66;
      fx.resize(box.width, box.height, unit);
    };

    const motion = !calm();
    const pace = (): number => game.battle?.speed ?? 1;

    // ------------------------------------------------------------ numbers

    interface Float { node: HTMLElement; slot: SlotView; cls: string; total: number; t: number; timer: number }
    let live: Float[] = [];
    const spread = new Map<SlotView, number>();
    const drop = (f: Float): void => {
      window.clearTimeout(f.timer);
      f.node.remove();
      live = live.filter((x) => x !== f);
    };
    const words = (cls: string, n: number): string => (
      cls === 'is-heal' ? `+${formatShort(n)}` : cls === 'is-shield' ? `(${formatShort(n)})` : `−${formatShort(n)}`);
    /** A number off a slot — or onto the one already rising off it, if that
     *  one is fresh and of the same kind. */
    const float = (slot: SlotView, cls: string, n: number, t: number): void => {
      const prev = live.find((f) => f.slot === slot && f.cls === cls);
      if (prev !== undefined && t - prev.t < MERGE_MS) {
        prev.total += n;
        prev.t = t;
        prev.node.textContent = words(cls, prev.total);
        // Re-pop: the number grows where it stands.
        prev.node.style.animation = 'none';
        void prev.node.offsetWidth;
        prev.node.style.animation = '';
        window.clearTimeout(prev.timer);
        prev.timer = window.setTimeout(() => drop(prev), FLOAT_MS);
        return;
      }
      const turn = spread.get(slot) ?? 0;
      spread.set(slot, turn + 1);
      const node = el('span', { class: `bs-float ${cls}` }, words(cls, n));
      const [ox, oy] = FLOAT_SPREAD[turn % FLOAT_SPREAD.length]!;
      node.style.left = `${slot.at.x + ox * unit}px`;
      node.style.top = `${slot.at.y + (oy - 6) * unit}px`;
      floats.append(node);
      const f: Float = { node, slot, cls, total: n, t, timer: 0 };
      f.timer = window.setTimeout(() => drop(f), FLOAT_MS);
      live.push(f);
      while (live.length > MAX_FLOATS) drop(live[0]!);
    };

    // ------------------------------------------------------------ the ring

    const setLife = (v: SlotView, pool: number): void => {
      v.pool = Math.max(0, pool);
      const share = String(v.pool / v.max);
      v.life.style.setProperty('--life', share);
      v.life.style.setProperty('--ghost', share);
    };

    // ------------------------------------------------------------ motion

    const ranged = (v: SlotView): boolean => targetingFor(v.type) === 'ranged';
    const flight = (v: SlotView): number => (v.kind === 'hero' ? BOLT_FLIGHT : ARROW_FLIGHT);
    /** When the swing of a blow landing at fight-time `at` starts. */
    const swingAt = (e: Attack): number => {
      const from = viewOf(e.from);
      const at = e.tick * COMBAT.tickMs;
      return from !== undefined && ranged(from) ? at - flight(from) - LUNGE_LEAD : at - LUNGE_LEAD;
    };

    /** The swing, `late` ms of the fight after it should have started. A
     *  melee slot lunges at its target; a shooter draws back and looses. */
    const swing = (e: Attack, late: number): void => {
      const from = viewOf(e.from);
      const to = viewOf(e.to);
      if (from === undefined || to === undefined || from.root.classList.contains('is-dead')) return;
      const dx = to.at.x - from.at.x;
      const dy = to.at.y - from.at.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const t = e.tick * COMBAT.tickMs;
      if (ranged(from)) {
        // Up to three shafts for a full line, landing together on the blow.
        const shafts = from.kind === 'hero' ? 1 : e.hits >= 12 ? 3 : e.hits >= 5 ? 2 : 1;
        for (let i = 0; i < shafts; i += 1) {
          const off = (i - (shafts - 1) / 2) * 9 * unit;
          fx.shoot(from.kind === 'hero' ? 'bolt' : 'arrow',
            { x: from.at.x + off, y: from.at.y },
            { x: to.at.x + off * 0.6, y: to.at.y },
            t - flight(from) - i * 35, t - i * 25, (e.from.id % 2 === 0 ? 1 : -1) * (14 + i * 4));
        }
      }
      if (from.lunge?.playState === 'running') return;
      const cavalry = from.type === 'Cavalry';
      const reach = ranged(from) ? 3 * unit
        : Math.min(dist * (cavalry ? 0.4 : 0.28), (cavalry ? 32 : 20) * unit);
      const back = (ranged(from) ? 6 : 3) * unit;
      const total = LUNGE_LEAD + LUNGE_BACK;
      const peak = LUNGE_LEAD / total;
      from.lunge = from.root.animate([
        { translate: '0 0', easing: 'ease-out' },
        { translate: `${-ux * back}px ${-uy * back}px`, offset: peak * 0.4, easing: 'ease-in' },
        { translate: `${ux * reach}px ${uy * reach}px`, offset: peak, easing: 'ease-out' },
        { translate: '0 0' },
      ], { duration: total / pace(), composite: 'add' });
      if (late > 0) from.lunge.currentTime = late / pace();
      if (cavalry) fx.dust(from.at, t - LUNGE_LEAD);
    };

    let lastHold = -Infinity;
    const hold = (t: number, ms: number): void => {
      if (t - lastHold < HOLD_GAP) return;
      lastHold = t;
      game.holdBattle(ms);
    };

    /** The blow landing: the target flinches away from it, the blade's
     *  mark, the sparks. Weighed by how much of the slot it took. */
    const impact = (e: Attack, from: SlotView, to: SlotView, t: number): void => {
      const angle = Math.atan2(to.at.y - from.at.y, to.at.x - from.at.x);
      const heavy = Math.min(1, (e.dealt / to.max) / (HEAVY * 2));
      const k = (3 + 6 * heavy) * unit;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      to.root.animate([
        { translate: '0 0' },
        { translate: `${ux * k}px ${uy * k}px`, offset: 0.25 },
        { translate: `${-ux * k * 0.35}px ${-uy * k * 0.35}px`, offset: 0.6 },
        { translate: '0 0' },
      ], { duration: 180 / pace(), composite: 'add' });
      if (ranged(from)) {
        fx.sparks(to.at, angle, t, 3);
      } else {
        fx.strike(from.type === 'Lancer' ? 'thrust' : 'slash', to.at, angle, t,
          from.type === 'Cavalry' ? 1.25 : from.kind === 'hero' ? 1.1 : 1);
        fx.sparks(to.at, angle, t, 4 + Math.round(heavy * 4));
      }
      if (e.edge === 'adv' && e.dealt >= to.max * HEAVY) hold(t, HOLD_MS);
    };

    /** A word rising off a slot: a skill's name. */
    const pop = (view: SlotView, text: string): void => {
      const p = el('span', { class: 'bs-pop' }, text);
      view.root.append(p);
      window.setTimeout(() => p.remove(), 950);
    };
    /** A mark held on a slot for a while — a shield, a daze. */
    const mark = (view: SlotView, cls: string, ms: number): void => {
      view.root.classList.add(cls);
      window.setTimeout(() => view.root.classList.remove(cls), ms);
    };

    /** Apply one event to the board. The screen never works anything out —
     *  every number it paints came off the log (§13). `quiet` is a board
     *  catching up: the state lands, nothing flies. */
    const apply = (event: BattleEvent, quiet: boolean): void => {
      const t = 'tick' in event ? event.tick * COMBAT.tickMs : 0;
      if (event.kind === 'skill') {
        const view = viewOf(event.from);
        if (view !== undefined && !quiet) pop(view, SKILLS[event.skill].name);
        return;
      }
      if (event.kind === 'healed') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        if (!quiet) float(view, 'is-heal', event.amount, t);
        setLife(view, event.hpPool);
        if (event.alive !== view.troops && view.count.textContent !== '') {
          power[event.at.side] += (event.alive - view.troops) * view.power;
          view.troops = event.alive;
          view.count.textContent = `x${formatExact(event.alive)}`;
          paintBar();
        }
        return;
      }
      if (event.kind === 'shielded') {
        const view = viewOf(event.at);
        if (view !== undefined) mark(view, 'is-shielded', 1500);
        return;
      }
      if (event.kind === 'dazed') {
        const view = viewOf(event.at);
        if (view !== undefined) mark(view, 'is-dazed', event.ticks * COMBAT.tickMs);
        return;
      }
      if (event.kind === 'attack') {
        const view = viewOf(event.to);
        const from = viewOf(event.from);
        if (view === undefined) return;
        setLife(view, view.pool - event.dealt);
        if (quiet) return;
        view.root.classList.remove('is-hit');
        void view.root.offsetWidth; // restart the flash, however fast they land
        view.root.classList.add('is-hit');
        window.setTimeout(() => view.root.classList.remove('is-hit'), FLASH_MS);
        if (event.dealt > 0) {
          float(view, event.edge === 'adv' ? 'is-adv' : event.edge === 'dis' ? 'is-dis' : '', event.dealt, t);
        }
        if ((event.absorbed ?? 0) > 0) float(view, 'is-shield', event.absorbed!, t);
        if (motion && from !== undefined) impact(event, from, view, t);
        playSfx('hit', { group: 'battle', limit: 2 });
        return;
      }
      if (event.kind === 'troops_lost') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        power[event.at.side] -= (view.troops - event.alive) * view.power;
        view.troops = event.alive;
        setLife(view, event.hpPool);
        if (view.count.textContent !== '') {
          view.count.textContent = `x${formatExact(event.alive)}`;
          if (!quiet && motion) {
            view.count.animate([
              { scale: '1' },
              { scale: '1.4', color: '#d4553e', offset: 0.3 },
              { scale: '1' },
            ], { duration: 280 });
          }
        }
        paintBar();
        return;
      }
      if (event.kind === 'slot_wiped') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        view.root.classList.add('is-dead');
        view.count.textContent = '';
        setLife(view, 0);
        if (quiet) return;
        if (motion) {
          fx.sparks(view.at, -Math.PI / 2, t, 10);
          fx.dust(view.at, t);
          hold(t, HOLD_WIPE_MS);
        }
        playSfx('death', { group: 'battle', limit: 2 });
      }
    };

    // ------------------------------------------------------------ the clock

    let next = 1; // 0 is `start`, which built the board
    let cue = 1; // reads ahead of `next`, for the swings
    let swings: { at: number; event: Attack }[] = [];
    let lastT = 0;
    let fxT = 0;
    let lastReal = game.now();

    /** Walk the playback to now: the swings that start, the blows that
     *  land, the phase. Safe to call from anywhere, any number of times. */
    const pump = (): number => {
      const now = game.now();
      const t = game.battleMs(now);
      const quiet = t - lastT > CATCH_UP_MS || game.battle?.phase !== 'playing';
      if (quiet) {
        swings = [];
        fx.clear();
      } else if (motion) {
        while (cue < log.events.length) {
          const event = log.events[cue]!;
          if ('tick' in event && event.tick * COMBAT.tickMs - CUE_LEAD > t) break;
          if (event.kind === 'attack') swings.push({ at: swingAt(event), event });
          cue += 1;
        }
        swings = swings.filter((s) => {
          if (s.at > t) return true;
          swing(s.event, t - s.at);
          return false;
        });
      }
      const tick = Math.floor(t / COMBAT.tickMs);
      while (next < log.events.length) {
        const event = log.events[next]!;
        if (event.kind === 'start' || event.kind === 'end') { next += 1; continue; }
        if (event.tick > tick) break;
        apply(event, quiet);
        next += 1;
      }
      cue = Math.max(cue, next);
      lastT = t;
      // The effects' clock is the fight's while it plays — so a held blow
      // freezes them — and runs on past its end so the last sparks land.
      const phase = game.battle?.phase;
      fxT = phase === 'playing' ? t : fxT + (now - lastReal) * pace();
      lastReal = now;

      game.advanceBattle(now);
      const after = game.battle?.phase;
      if (after === undefined) return fxT;
      if (after !== 'playing') knobs.classList.add('is-hidden');
      if (after !== 'playing' && plaque.classList.contains('is-hidden')) {
        plaque.classList.remove('is-hidden');
        plaque.classList.add(log.winner === 'ours' ? 'is-won' : 'is-lost');
        plaque.textContent = log.winner === 'ours' ? 'Victory' : 'Defeat';
        // The bar tells the truth at the end: a wiped side is worth nothing.
        power[log.winner === 'ours' ? 'theirs' : 'ours'] = 0;
        paintBar();
      }
      if (after === 'done') stop();
      return fxT;
    };

    root.replaceChildren(screen);
    measure();
    const resizer = new ResizeObserver(measure);
    resizer.observe(screen);
    // Frames draw the effects; the interval keeps the fight walking where
    // there are no frames (a throttled tab), on the log's own clock rather
    // than the game's one-second one.
    let frame = 0;
    const loop = (): void => {
      fx.draw(pump());
      if (teardown !== null) frame = requestAnimationFrame(loop);
    };
    const timer = window.setInterval(pump, 250);
    teardown = () => {
      window.clearInterval(timer);
      cancelAnimationFrame(frame);
      resizer.disconnect();
      for (const f of [...live]) drop(f);
    };
    frame = requestAnimationFrame(loop);
    pump();
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
