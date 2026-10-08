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

import { COMBAT, HEROES, TROOPS, VILLAINS, unitOf, type SkillId } from '../sim/data/definitions';
import { SKILLS, type SkillKind } from '../sim/skills';
import { setBattleMusic } from '../audio/music';
import { playSfx, warmBattleSfx, type BattleSfx } from '../audio/sfx';
import { haptic } from './haptics';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { targetingFor } from '../sim/battle';
import type { BattleEvent, BattleLog, BoardSlot, Side, SlotRef } from '../sim/battle';
import type { UnitId } from '../sim/state';
import type { BattleBackdrop, Game } from '../game';
import { createFxLayer, type Pt } from './battleFx';
import fieldGround from './assets/battle-ground-field.jpg?url';
import dungeonGround from './assets/battle-ground-dungeon.jpg?url';
import bossGround from './assets/battle-ground-boss.jpg?url';
import portalGround from './assets/battle-ground-portal.jpg?url';
import { el, formatExact, formatShort } from './format';
import { btn, iconEl } from './kit';
import { rankBadge } from './unitArt';

/** How long the white flash sits on a slot that was hit. Two frames of a
 *  stepped animation — a pixel-art screen snaps, it does not glow. */
const FLASH_MS = 180;

/** A slot's face: the troop's bust — or, on a side that fields creatures, the
 *  creature's (`enemyFaces`) — a hero's portrait, a villain's. */
function face(slot: BoardSlot, faces?: Partial<Record<UnitId, string>>): HTMLElement {
  if (slot.unitId !== null) {
    const { sprite } = TROOPS[slot.unitId];
    const creature = faces?.[unitOf(slot.unitId)];
    const url = (creature ? spriteUrl(creature) : null)
      ?? spriteUrl(`${sprite}_avatar`) ?? spriteUrl(sprite);
    return url
      ? spriteImgAt(url, 'bs-portrait')
      : iconEl(unitOf(slot.unitId), { size: 'lg' });
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
  /** A glow behind the portrait, lit in a skill's tint: the caster
   *  charging, a rally landing. */
  aura: HTMLElement;
  /** What the slot's shield has left, and the bubble that shows it. */
  shield: number;
  bubble: HTMLElement | null;
}

function slotView(slot: BoardSlot, side: Side, faces?: Partial<Record<UnitId, string>>): SlotView {
  const count = el('span', { class: 'bs-count' }, slot.kind === 'hero' ? '' : `x${formatExact(slot.count)}`);
  const life = el('span', { class: 'bs-life' });
  const aura = el('span', { class: 'bs-aura' });
  const root = el('div', { class: `bs-slot is-${slot.kind} is-${side}` },
    aura,
    life,
    face(slot, faces),
    ...(slot.unitId === null ? [] : [rankBadge(slot.unitId)].filter((b): b is HTMLElement => b !== null)),
    count,
    el('span', { class: 'bs-skull' }, iconEl('skull', { size: 'lg' })));
  const max = Math.max(1, slot.hpUnit * slot.count);
  life.style.setProperty('--life', String(slot.hpPool / max));
  life.style.setProperty('--ghost', String(slot.hpPool / max));
  return {
    root, count, life, type: slot.type, kind: slot.kind, power: slot.power, troops: slot.count,
    pool: slot.hpPool, max, at: { x: 0, y: 0 }, lunge: null, aura, shield: 0, bubble: null,
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

/** The armies marching on before the first blow: the replay holds this long
 *  (real ms) while the rows slide in and the swords on the bar clash. */
const INTRO_MS = 800;
/** The last blow, in slow motion: from this far (ms of the fight) before the
 *  end, the replay runs at `SLOW_FACTOR` for `SLOW_MS` of real time. */
const SLOW_LEAD = 300;
const SLOW_FACTOR = 0.3;
const SLOW_MS = 1000;
/** The plaque comes down this long (real ms) after the last blow — after
 *  the flash, not on top of it. */
const PLAQUE_DELAY_MS = 600;
/** A loss worth this share of a side's opening power shakes the bar. */
const BAR_SHAKE = 0.04;

/**
 * Cracks across a ring that has gone down, as an SVG: three or four grooves
 * from the rim inward, each with a lit lower edge, so the crack is CUT into
 * the material rather than drawn on it. The shape is the slot's own — a
 * hash of `seed`, the same every time that slot falls.
 */
function crackSvg(seed: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  let x = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  const next = (): number => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x1_0000_0000;
  };
  const lines: string[] = [];
  const n = 3 + (next() < 0.5 ? 1 : 0);
  const base = next() * Math.PI * 2;
  for (let i = 0; i < n; i += 1) {
    let a = base + (i * Math.PI * 2) / n + (next() - 0.5) * 0.6;
    let r = 50;
    const pts: string[] = [`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`];
    const stop = 8 + next() * 14;
    for (let k = 0; k < 3; k += 1) {
      r -= (50 - stop) / 3;
      a += (next() - 0.5) * 0.7;
      pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
    }
    lines.push(`M${pts.join(' L')}`);
  }
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-50 -50 100 100');
  svg.setAttribute('class', 'bs-crack');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const cls of ['is-edge', 'is-groove']) {
    for (const d of lines) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '100');
      path.setAttribute('class', cls);
      svg.append(path);
    }
  }
  return svg;
}

/** A skill's colours: the light of its caster's aura and of what it throws,
 *  and the dyed cloth of the ribbon that names it. By kind, except the
 *  three rallies, which each say what they raise. */
interface Tint { glow: string; cloth: string }
const KIND_TINT: Record<SkillKind, Tint> = {
  strike: { glow: '#ffb13b', cloth: '#a8452a' },
  heal: { glow: '#8fe26c', cloth: '#4b7f36' },
  shield: { glow: '#8fc8ff', cloth: '#3d6a96' },
  daze: { glow: '#c9a2ff', cloth: '#64458f' },
  rally: { glow: '#ff7a5c', cloth: '#93321f' },
  spoils: { glow: '#ffd36a', cloth: '#8a6420' },
};
const RALLY_TINT: Partial<Record<SkillId, Tint>> = {
  Bulwark: { glow: '#d6dde6', cloth: '#56606c' },
  Vigour: { glow: '#8fe26c', cloth: '#4b7f36' },
};
const tintOf = (id: SkillId): Tint => RALLY_TINT[id] ?? KIND_TINT[SKILLS[id].kind];

/** A skill CHARGES this long (ms of the fight) before it lands: the caster
 *  glows and the ribbon unrolls, so the player looks before it happens. */
const CHARGE_MS = 320;
/** …and is CAST this long before it lands — the arrows of a Volley in the
 *  air, an Ambush on its way across. */
const SKILL_LUNGE = 180;
const CAST_LEAD: Partial<Record<SkillId, number>> = {
  Volley: 260, Cleave: SKILL_LUNGE, Crush: SKILL_LUNGE, Ambush: 240, Sharpshot: 40,
};
/** A bolt from a healer, a shield-bearer or a dazer to whoever it is for. */
const CARE_FLIGHT = 260;
/** The rallies are named after the armies have marched on (real ms apart). */
const RALLY_GAP_MS = 520;

/** What a blow sounds like, by who struck it. */
const hitSound = (from: { kind: BoardSlot['kind']; type: UnitId }): BattleSfx => (
  targetingFor(from.type) === 'ranged' ? 'arrowHit'
    : from.type === 'Lancer' ? 'lanceHit'
      : from.type === 'Cavalry' ? 'cavalryHit'
        : 'swordHit');
/** A skill strike with a sound of its own — one per skill, however many it
 *  hits. The rest (Volley, Sharpshot, Ambush) sounded when they were cast
 *  and land as ordinary blows. */
const SKILL_HIT: Partial<Record<SkillId, BattleSfx>> = { Cleave: 'cleave', Crush: 'crush' };
const RALLY_SOUND: Partial<Record<SkillId, BattleSfx>> = { WarCry: 'warCry', Bulwark: 'bulwark', Vigour: 'vigour' };

/** The ground each kind of fight is drawn on, seen from above: quiet in the
 *  middle where the armies stand, its props at the edges
 *  (Docs/art/battle/). Fetched when a fight of that kind first opens. */
const GROUND: Record<BattleBackdrop, string> = {
  field: fieldGround, dungeon: dungeonGround, boss: bossGround, portal: portalGround,
};

/** The speed knob's turns. */
const SPEEDS = [1, 2, 4];

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
    const opening = { ...power };
    /** What the two numbers SHOW, rolling down to what they are. */
    const shown = { ...power };
    const paintBar = (): void => {
      const total = Math.max(1, power.ours + power.theirs);
      fill.style.width = `${Math.round((power.ours / total) * 100)}%`;
    };
    const rollBar = (ms: number): void => {
      for (const side of ['ours', 'theirs'] as Side[]) {
        const gap = power[side] - shown[side];
        shown[side] = Math.abs(gap) < 1 ? power[side] : shown[side] + gap * Math.min(1, ms / 160);
      }
      mine.textContent = formatExact(Math.round(shown.ours));
      yours.textContent = formatExact(Math.round(shown.theirs));
    };
    paintBar();
    let barShookAt = -Infinity;
    /** A big loss jolts the bar and pops the number that fell. */
    const shakeBar = (side: Side, lost: number): void => {
      const now = game.now();
      if (lost < opening[side] * BAR_SHAKE || now - barShookAt < 250) return;
      barShookAt = now;
      bar.animate([
        { translate: '0 0' }, { translate: `${-3 * unit}px 0` }, { translate: `${3 * unit}px ${unit}px` },
        { translate: `${-2 * unit}px 0` }, { translate: '0 0' },
      ], { duration: 220 });
      (side === 'ours' ? mine : yours).animate([
        { scale: '1' }, { scale: '1.25', color: '#fff6dc', offset: 0.3 }, { scale: '1' },
      ], { duration: 300 });
    };

    // THE CLOCK'S TWO KNOBS: the speed — ×1, ×2, ×4 in turn, kept for the
    // next fight — and straight to the end. A fight lasts tens of seconds, a
    // dungeon has many. The knob says the speed it is playing at.
    const speed = el('button', { class: 'bs-knob', type: 'button', 'aria-label': 'Playback speed' });
    const paintSpeed = (): void => {
      const now = game.battle?.speed ?? 1;
      speed.textContent = `×${formatExact(now)}`;
      speed.setAttribute('aria-pressed', now > 1 ? 'true' : 'false');
    };
    speed.addEventListener('click', () => {
      const now = game.battle?.speed ?? 1;
      game.setBattleSpeed(SPEEDS[(SPEEDS.indexOf(now) + 1) % SPEEDS.length] ?? 1);
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
    /** The white of the last blow. */
    const flash = el('div', { class: 'bs-flash' });
    const gap = el('div', { class: 'bs-gap' });
    const board = el('div', { class: 'bs-board' }, ...theirs.rows, gap, ...ours.rows);
    const where = el('div', { class: 'bs-where' },
      el('b', {}, playback.title),
      el('span', {}, playback.subtitle));
    const screen = el('div', { class: `bs is-${playback.backdrop}` },
      bar,
      where,
      knobs,
      board,
      fx.canvas,
      floats,
      flash,
      plaque,
      exit,
    );

    /** One design pixel (`--px`) in CSS pixels: a slot is 66 of them. */
    let unit = 1;
    const measure = (): void => {
      const box = screen.getBoundingClientRect();
      if (box.width === 0) return;
      // From the LAYOUT, not the screen rect: a slot mid-lunge or a row
      // mid-entrance must not move where everything aims at it.
      for (const v of all) {
        let x = v.root.offsetWidth / 2;
        let y = v.root.offsetHeight / 2;
        for (let node: HTMLElement | null = v.root; node !== null && node !== screen;
          node = node.offsetParent as HTMLElement | null) {
          x += node.offsetLeft;
          y += node.offsetTop;
        }
        v.at = { x, y };
      }
      unit = (all[0]?.root.offsetWidth ?? 66) / 66;
      gapY = gap.offsetTop + gap.offsetHeight / 2;
      for (let node = gap.offsetParent as HTMLElement | null; node !== null && node !== screen;
        node = node.offsetParent as HTMLElement | null) gapY += node.offsetTop;
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
        // The bowstring at the release, after the draw.
        window.setTimeout(() => playSfx(from.kind === 'hero' ? 'boltCast' : 'arrowLoose',
          { group: 'loose', limit: 2 }), Math.max(0, LUNGE_LEAD - late) / pace());
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
      const cavalry = from.type === 'Cavalry';
      const reach = ranged(from) ? 3 * unit
        : Math.min(dist * (cavalry ? 0.4 : 0.28), (cavalry ? 32 : 20) * unit);
      if (lunge(from, ux, uy, reach, (ranged(from) ? 6 : 3) * unit, LUNGE_LEAD, late) && cavalry) {
        fx.dust(from.at, t - LUNGE_LEAD);
        playSfx('cavalryCharge', { group: 'gallop', limit: 1 });
      }
    };

    /** Draw back along (ux, uy), go `reach` toward it — peaking `lead` ms
     *  of the fight after it starts, on the blow — and come home. False
     *  when the slot is still in its last one. */
    const lunge = (
      from: SlotView, ux: number, uy: number, reach: number, back: number, lead: number, late: number,
    ): boolean => {
      if (from.lunge?.playState === 'running') return false;
      const total = lead + LUNGE_BACK;
      const peak = lead / total;
      from.lunge = from.root.animate([
        { translate: '0 0', easing: 'ease-out' },
        { translate: `${-ux * back}px ${-uy * back}px`, offset: peak * 0.4, easing: 'ease-in' },
        { translate: `${ux * reach}px ${uy * reach}px`, offset: peak, easing: 'ease-out' },
        { translate: '0 0' },
      ], { duration: total / pace(), composite: 'add' });
      if (late > 0) from.lunge.currentTime = late / pace();
      return true;
    };

    let lastHold = -Infinity;
    const hold = (t: number, ms: number): void => {
      if (t - lastHold < HOLD_GAP) return;
      lastHold = t;
      game.holdBattle(ms);
      // What freezes the screen also lands in the hand.
      haptic(ms >= HOLD_WIPE_MS ? 25 : 12);
    };

    /** The blow landing: the target flinches away from it, the blade's
     *  mark, the sparks. Weighed by how much of the slot it took. */
    /** The target flinching away from a blow along `angle`; `heavy` 0…1. */
    const flinch = (to: SlotView, angle: number, heavy: number): void => {
      const k = (3 + 6 * heavy) * unit;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      to.root.animate([
        { translate: '0 0' },
        { translate: `${ux * k}px ${uy * k}px`, offset: 0.25 },
        { translate: `${-ux * k * 0.35}px ${-uy * k * 0.35}px`, offset: 0.6 },
        { translate: '0 0' },
      ], { duration: 180 / pace(), composite: 'add' });
    };

    const impact = (e: Attack, from: SlotView, to: SlotView, t: number): void => {
      const angle = Math.atan2(to.at.y - from.at.y, to.at.x - from.at.x);
      const heavy = Math.min(1, (e.dealt / to.max) / (HEAVY * 2));
      flinch(to, angle, heavy);
      if (ranged(from)) {
        fx.sparks(to.at, angle, t, 3);
      } else {
        fx.strike(from.type === 'Lancer' ? 'thrust' : 'slash', to.at, angle, t,
          from.type === 'Cavalry' ? 1.25 : from.kind === 'hero' ? 1.1 : 1);
        fx.sparks(to.at, angle, t, 4 + Math.round(heavy * 4));
      }
      if (e.edge === 'adv' && e.dealt >= to.max * HEAVY) hold(t, HOLD_MS);
    };

    // ------------------------------------------------------------ skills

    /** Every slot a skill at `index` reaches: the events that follow it on
     *  its tick, up to the next skill or the next ordinary blow. */
    const targetsOf = (index: number): SlotView[] => {
      const head = log.events[index] as Extract<BattleEvent, { kind: 'skill' }>;
      const found: SlotView[] = [];
      for (let i = index + 1; i < log.events.length; i += 1) {
        const e = log.events[i]!;
        if (!('tick' in e) || e.tick !== head.tick || e.kind === 'skill') break;
        if (e.kind === 'attack' && e.skill !== head.skill) break;
        const ref = e.kind === 'attack' ? e.to
          : e.kind === 'healed' || e.kind === 'shielded' || e.kind === 'dazed' ? e.at : null;
        const v = ref === null ? undefined : viewOf(ref);
        if (v !== undefined && !found.includes(v)) found.push(v);
      }
      return found;
    };

    /** The aura behind a slot, flaring in `tint` for `ms` of the fight. */
    const glow = (v: SlotView, tint: Tint, ms: number): void => {
      v.aura.style.setProperty('--glow', tint.glow);
      v.aura.animate([
        { opacity: 0, scale: '0.6' },
        { opacity: 1, scale: '1.25', offset: 0.7 },
        { opacity: 0, scale: '1.45' },
      ], { duration: ms / pace() });
    };

    /** THE RIBBON: one strip of dyed cloth across the line between the two
     *  armies, naming the skill. One at a time — a new one replaces it. It
     *  comes from the caster's side. */
    let ribbon: HTMLElement | null = null;
    let gapY = 0;
    const announce = (side: Side, id: SkillId): void => {
      ribbon?.remove();
      const node = el('div', { class: `bs-ribbon is-${side}` }, el('span', {}, SKILLS[id].name));
      node.style.setProperty('--cloth', tintOf(id).cloth);
      node.style.top = `${gapY}px`;
      screen.append(node);
      ribbon = node;
      playSfx('ribbon', { group: 'ribbon', limit: 1 });
      window.setTimeout(() => { if (node.isConnected) node.remove(); }, 1300);
    };

    /** A timed skill CHARGES: its caster glows and the ribbon names it. */
    const charge = (e: Extract<BattleEvent, { kind: 'skill' }>): void => {
      const from = viewOf(e.from);
      if (from === undefined || from.root.classList.contains('is-dead')) return;
      glow(from, tintOf(e.skill), CHARGE_MS + 220);
      fx.motes(from.at, e.tick * COMBAT.tickMs - CHARGE_MS, 5, tintOf(e.skill).glow);
      announce(e.from.side, e.skill);
      playSfx('skillCharge', { group: 'skill', limit: 2 });
    };

    /** …then is CAST, timed to land on its tick: what it throws is in the
     *  air, or its caster is on the way. */
    const cast = (e: Extract<BattleEvent, { kind: 'skill' }>, targets: SlotView[]): void => {
      const from = viewOf(e.from);
      if (from === undefined || targets.length === 0) return;
      const t = e.tick * COMBAT.tickMs;
      const tint = tintOf(e.skill);
      const toward = (to: Pt): { ux: number; uy: number; dist: number } => {
        const dx = to.x - from.at.x;
        const dy = to.y - from.at.y;
        const dist = Math.hypot(dx, dy) || 1;
        return { ux: dx / dist, uy: dy / dist, dist };
      };
      switch (e.skill) {
        case 'Volley':
          playSfx('volley');
          // Arrows fall out of the sky onto every one of them.
          targets.forEach((to, i) => {
            for (let k = 0; k < 2; k += 1) {
              const off = (k === 0 ? -8 : 9) * unit;
              fx.shoot('arrow', { x: to.at.x + off * 1.5, y: to.at.y - 150 * unit },
                { x: to.at.x + off, y: to.at.y }, t - 220 - k * 40 - i * 10, t - k * 30, 0);
            }
          });
          break;
        case 'Cleave':
        case 'Crush': {
          const mid = {
            x: targets.reduce((n, v) => n + v.at.x, 0) / targets.length,
            y: targets.reduce((n, v) => n + v.at.y, 0) / targets.length,
          };
          const { ux, uy, dist } = toward(mid);
          lunge(from, ux, uy, Math.min(dist * 0.45, 40 * unit), 6 * unit, SKILL_LUNGE, 0);
          break;
        }
        case 'Ambush': {
          // The caster crosses the board to the back rank and comes home.
          const { ux, uy, dist } = toward(targets[0]!.at);
          from.root.style.zIndex = '5';
          from.lunge?.cancel();
          if (lunge(from, ux, uy, dist * 0.8, 4 * unit, CAST_LEAD.Ambush!, 0)) {
            from.lunge!.addEventListener('finish', () => { from.root.style.zIndex = ''; });
          }
          fx.dust(from.at, t - CAST_LEAD.Ambush!);
          playSfx('ambush');
          break;
        }
        case 'Sharpshot':
          fx.beam(from.at, targets[0]!.at, t - CAST_LEAD.Sharpshot!, tint.glow);
          playSfx('sharpshot');
          break;
        default:
          // A heal, a shield, a daze: a bolt of its light to each of them.
          if (e.skill === 'Wave') fx.shock(from.at, t - CARE_FLIGHT, 46, tint.glow);
          playSfx('boltCast', { group: 'loose', limit: 2 });
          for (const to of targets) fx.shoot('bolt', from.at, to.at, t - CARE_FLIGHT, t, 16, tint.glow);
      }
    };

    /** A skill's strike landing — weightier than a swing, and its own. */
    const skillImpact = (e: Attack, id: SkillId, from: SlotView, to: SlotView, t: number): void => {
      const angle = Math.atan2(to.at.y - from.at.y, to.at.x - from.at.x);
      flinch(to, angle, id === 'Crush' ? 1 : 0.6);
      switch (id) {
        case 'Volley':
          fx.sparks(to.at, Math.PI / 2, t, 4);
          break;
        case 'Cleave':
          fx.strike('slash', to.at, angle, t, 1.5);
          fx.sparks(to.at, angle, t, 5);
          break;
        case 'Crush':
          fx.strike('slash', to.at, angle, t, 1.7);
          fx.shock(to.at, t, 50);
          fx.sparks(to.at, angle, t, 14);
          board.animate([
            { translate: '0 0' }, { translate: `${-5 * unit}px ${3 * unit}px` }, { translate: `${4 * unit}px ${-3 * unit}px` },
            { translate: `${-2 * unit}px ${unit}px` }, { translate: '0 0' },
          ], { duration: 260 });
          hold(t, HOLD_WIPE_MS);
          break;
        case 'Ambush':
          fx.strike('slash', to.at, angle, t, 1.4);
          fx.sparks(to.at, angle, t, 8);
          break;
        default:
          fx.sparks(to.at, angle, t, 8);
          fx.shock(to.at, t, 24, tintOf(id).glow);
      }
      if (e.edge === 'adv' && e.dealt >= to.max * HEAVY) hold(t, HOLD_MS);
    };

    /** A shield takes a blow: it wobbles, or — spent — shatters. */
    const soak = (v: SlotView, absorbed: number, t: number, quiet: boolean): void => {
      v.shield = Math.max(0, v.shield - absorbed);
      const bubble = v.bubble;
      if (bubble === null) return;
      if (v.shield > 0) {
        if (!quiet) playSfx('shieldSoak', { group: 'soak', limit: 2 });
        if (!quiet && motion) bubble.animate([{ scale: '1' }, { scale: '0.9', opacity: 0.5 }, { scale: '1' }], { duration: 200 });
        return;
      }
      bubble.remove();
      v.bubble = null;
      if (!quiet) playSfx('shieldBreak');
      if (!quiet && motion) {
        fx.chips(v.at, t, 10, 'sky');
        fx.shock(v.at, t, 38, KIND_TINT.shield.glow);
      }
    };

    /** THE RALLIES, named one by one after the armies march on: the ribbon,
     *  then every slot on that side flares in the rally's colour. */
    const rallies: Extract<BattleEvent, { kind: 'skill' }>[] = [];
    const rallyTimers: number[] = [];
    const nameRallies = (): void => {
      rallies.forEach((e, i) => {
        rallyTimers.push(window.setTimeout(() => {
          if (game.battle?.phase !== 'playing') return;
          announce(e.from.side, e.skill);
          const call = RALLY_SOUND[e.skill];
          if (call !== undefined) playSfx(call);
          if (!motion) return;
          const tint = tintOf(e.skill);
          const caster = viewOf(e.from);
          if (caster !== undefined) glow(caster, tint, 600);
          for (const v of views[e.from.side].values()) {
            if (v.root.classList.contains('is-dead')) continue;
            glow(v, tint, 700);
            fx.motes(v.at, game.battleMs(game.now()), 3, tint.glow);
          }
        }, (motion ? INTRO_MS : 0) + 120 + i * RALLY_GAP_MS));
      });
    };

    /** A mark held on a slot for a while — a daze. */
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
        // A rally is named once the armies have marched on; a timed skill
        // was already charged and cast ahead of its tick (`moments`).
        if (event.tick === 0 && !quiet) rallies.push(event);
        return;
      }
      if (event.kind === 'healed') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        if (!quiet) float(view, 'is-heal', event.amount, t);
        if (!quiet && motion) fx.motes(view.at, t, 7, KIND_TINT.heal.glow);
        if (!quiet) playSfx('heal', { group: 'heal', limit: 1 });
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
        if (view === undefined) return;
        view.shield = event.amount;
        if (!quiet) playSfx('shieldUp', { group: 'shieldUp', limit: 1 });
        if (view.bubble === null) {
          view.bubble = el('span', { class: 'bs-bubble' });
          view.root.append(view.bubble);
        }
        return;
      }
      if (event.kind === 'dazed') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        // The fight's ticks, at the playback's speed, in real time.
        const ms = (event.ticks * COMBAT.tickMs) / pace();
        mark(view, 'is-dazed', ms);
        if (!quiet) {
          playSfx('daze', { group: 'daze', limit: 1 });
          view.root.querySelector('.bs-stars')?.remove();
          const stars = el('span', { class: 'bs-stars' },
            el('i', {}), el('i', {}), el('i', {}));
          view.root.append(stars);
          window.setTimeout(() => stars.remove(), ms);
        }
        return;
      }
      if (event.kind === 'attack') {
        const view = viewOf(event.to);
        const from = viewOf(event.from);
        if (view === undefined) return;
        setLife(view, view.pool - event.dealt);
        if ((event.absorbed ?? 0) > 0) soak(view, event.absorbed!, t, quiet);
        if (quiet) return;
        view.root.classList.remove('is-hit');
        void view.root.offsetWidth; // restart the flash, however fast they land
        view.root.classList.add('is-hit');
        window.setTimeout(() => view.root.classList.remove('is-hit'), FLASH_MS);
        if (event.dealt > 0) {
          float(view, event.edge === 'adv' ? 'is-adv' : event.edge === 'dis' ? 'is-dis' : '', event.dealt, t);
        }
        if ((event.absorbed ?? 0) > 0) float(view, 'is-shield', event.absorbed!, t);
        if (motion && from !== undefined) {
          if (event.skill !== undefined) skillImpact(event, event.skill, from, view, t);
          else impact(event, from, view, t);
        }
        if (from !== undefined) {
          const heavy = Math.min(1, (event.dealt / view.max) / (HEAVY * 2));
          const skilled = event.skill === undefined ? undefined : SKILL_HIT[event.skill];
          if (skilled !== undefined) playSfx(skilled, { group: 'skillHit', limit: 1 });
          else playSfx(hitSound(from), { group: 'battle', limit: 3, gain: 0.8 + 0.4 * heavy });
        }
        return;
      }
      if (event.kind === 'troops_lost') {
        const view = viewOf(event.at);
        if (view === undefined) return;
        const lostTroops = view.troops - event.alive;
        const lost = lostTroops * view.power;
        power[event.at.side] -= lost;
        view.troops = event.alive;
        setLife(view, event.hpPool);
        if (!quiet && motion) shakeBar(event.at.side, lost);
        if (view.count.textContent !== '') {
          view.count.textContent = `x${formatExact(event.alive)}`;
          if (!quiet && motion) {
            // A helmet or two rolls off the ring for the men who fell.
            fx.helmets(view.at, t, Math.min(3, Math.ceil(lostTroops / 4)));
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
        // The ring cracks, goes grey and takes the skull, stamped. A
        // hero's gold ring breaks and the portrait slumps in it.
        view.root.classList.add('is-dead');
        view.bubble?.remove();
        view.bubble = null;
        view.shield = 0;
        view.root.append(crackSvg(event.at.id + (event.at.side === 'ours' ? 0 : 100)));
        view.count.textContent = '';
        setLife(view, 0);
        if (quiet) return;
        const hero = view.kind === 'hero';
        if (motion) {
          view.root.animate([
            { translate: '0 0' }, { translate: `${-4 * unit}px ${unit}px` }, { translate: `${4 * unit}px ${-unit}px` },
            { translate: `${-3 * unit}px 0` }, { translate: `${2 * unit}px 0` }, { translate: '0 0' },
          ], { duration: 260, composite: 'add' });
          fx.chips(view.at, t, hero ? 14 : 9, hero ? 'gold' : 'wood');
          fx.dust(view.at, t);
          fx.shock(view.at, t + 140, hero ? 44 : 34);
          hold(t, HOLD_WIPE_MS);
          if (event.tick === log.ticks && finalBlow) {
            flash.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
          }
        }
        playSfx('squadDown', { group: 'death', limit: 2 });
        window.setTimeout(() => playSfx('skullStamp', { group: 'stamp', limit: 2 }), 140);
        if (hero) playSfx('heroDown', { group: 'heroDown', limit: 1 });
      }
    };

    // ------------------------------------------------------------ the clock

    let next = 1; // 0 is `start`, which built the board
    let cue = 1; // reads ahead of `next`, for the swings
    let swings: { at: number; event: Attack }[] = [];
    let moments: { at: number; run: () => void }[] = [];
    let lastT = 0;
    let fxT = 0;
    let lastReal = game.now();
    /** The fight ended on a blow, not on the clock: it gets the slow motion
     *  and the flash. */
    const finalBlow = log.events[log.events.length - 1]?.kind === 'end'
      && (log.events[log.events.length - 1] as Extract<BattleEvent, { kind: 'end' }>).reason === 'wiped';
    const endMs = log.ticks * COMBAT.tickMs;
    let slowed = false;
    let resultAt: number | null = null;

    /** Walk the playback to now: the swings that start, the blows that
     *  land, the phase. Safe to call from anywhere, any number of times. */
    const pump = (): number => {
      const now = game.now();
      const t = game.battleMs(now);
      const quiet = t - lastT > CATCH_UP_MS || game.battle?.phase !== 'playing';
      if (quiet) {
        swings = [];
        moments = [];
        fx.clear();
      } else if (motion) {
        while (cue < log.events.length) {
          const event = log.events[cue]!;
          if ('tick' in event && event.tick * COMBAT.tickMs - CUE_LEAD > t) break;
          // A skill's strike is the skill's to draw (`cast`), not a swing.
          if (event.kind === 'attack' && event.skill === undefined) swings.push({ at: swingAt(event), event });
          if (event.kind === 'skill' && event.tick > 0) {
            const at = event.tick * COMBAT.tickMs;
            const targets = targetsOf(cue);
            const e = event;
            moments.push({ at: at - CHARGE_MS, run: () => charge(e) });
            moments.push({ at: at - (CAST_LEAD[e.skill] ?? CARE_FLIGHT), run: () => cast(e, targets) });
          }
          cue += 1;
        }
        swings = swings.filter((s) => {
          if (s.at > t) return true;
          swing(s.event, t - s.at);
          return false;
        });
        moments = moments.filter((m) => {
          if (m.at > t) return true;
          m.run();
          return false;
        });
      }
      if (motion && finalBlow && !slowed && !quiet && t >= endMs - SLOW_LEAD) {
        slowed = true;
        game.slowBattle(SLOW_FACTOR, SLOW_MS);
        playSfx('finalBlow');
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
      rollBar(now - lastReal);
      lastReal = now;

      game.advanceBattle(now);
      const after = game.battle?.phase;
      if (after === undefined) return fxT;
      if (after !== 'playing') {
        knobs.classList.add('is-hidden');
        resultAt ??= now;
      }
      if (resultAt !== null && now - resultAt >= PLAQUE_DELAY_MS && plaque.classList.contains('is-hidden')) {
        const won = log.winner === 'ours';
        plaque.classList.remove('is-hidden');
        plaque.classList.add(won ? 'is-won' : 'is-lost');
        // The word sits over the cracks: carved on, after the wood split.
        plaque.replaceChildren(el('span', { class: 'bs-plaque-word' }, won ? 'Victory' : 'Defeat'));
        // The fight's tune gives way to the verdict's.
        setBattleMusic(false);
        playSfx(won ? 'victory' : 'defeat');
        haptic(won ? [30, 60, 30] : 90);
        // A defeat lands cracked, and the field goes grey under it.
        if (!won) {
          plaque.append(crackSvg(log.ticks));
          screen.classList.add('is-lost');
        }
        if (motion) {
          const mid = { x: screen.clientWidth / 2, y: screen.clientHeight / 2 };
          fx.shock(mid, fxT + 180, 70, won ? '#ffd36a' : 'rgba(60, 36, 18, 0.8)');
          if (won) {
            fx.sparks(mid, -Math.PI / 2, fxT + 180, 14);
            fx.chips(mid, fxT + 220, 16, 'gold');
            fx.sparks(mid, -Math.PI / 2, fxT + 420, 10);
          } else {
            fx.chips(mid, fxT + 180, 8, 'wood');
          }
        }
        // The bar tells the truth at the end: a wiped side is worth nothing.
        power[won ? 'theirs' : 'ours'] = 0;
        paintBar();
      }
      // The way out, once the verdict is up and nothing is left to hand over
      // (a fight's spoils deal over it first). Not before the plaque: a
      // skipped fight reaches `done` in one step, and stopping then would
      // leave neither the verdict nor the way out on screen.
      if (after === 'done' && !plaque.classList.contains('is-hidden')) {
        exit.classList.remove('is-hidden');
        stop();
      }
      return fxT;
    };

    screen.style.setProperty('--bs-ground', `url("${GROUND[playback.backdrop]}")`);
    root.replaceChildren(screen);
    measure();
    setBattleMusic(true);
    warmBattleSfx();
    playSfx('battleStart');
    // THE ARMIES MARCH ON: the replay holds while each side's rows slide in
    // from its own edge, front rank first, and the swords on the bar clash.
    if (motion) {
      game.holdBattle(INTRO_MS);
      const march = (rows: HTMLElement[], from: number): void => {
        rows.forEach((row, i) => {
          row.animate([
            { translate: `0 ${from * 60 * unit}px`, opacity: 0 },
            { translate: '0 0', opacity: 1 },
          ], { duration: 420, delay: i * 90, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)', fill: 'backwards' });
        });
      };
      march([...theirs.rows].reverse(), -1); // their front is nearest the gap
      march(ours.rows, 1);
      bar.classList.add('is-clash');
      // The place's plaque swings down on its rope as they arrive, and the
      // knobs come after it.
      where.animate([
        { translate: `0 ${-40 * unit}px`, rotate: '-6deg', opacity: 0 },
        { translate: '0 0', rotate: '2deg', opacity: 1, offset: 0.7 },
        { translate: '0 0', rotate: '0deg', opacity: 1 },
      ], { duration: 520, delay: 120, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'backwards' });
      knobs.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500, fill: 'backwards' });
    }
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
      for (const id of rallyTimers) window.clearTimeout(id);
      setBattleMusic(false);
    };
    frame = requestAnimationFrame(loop);
    pump();
    nameRallies();
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
