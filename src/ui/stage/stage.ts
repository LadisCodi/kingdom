// THE STAGE (Docs/features/24-dialogue.md) and the director that decides what
// plays on it (Docs/features/23-tutorials.md).
//
// A small visual-novel stage over the game: a character on each side, a box
// of text that types itself and can sit at the bottom, the top or the middle
// of the screen, a pointer at whatever the line is about, and — during the
// First Morning — a lock on every tap but the one the line asks for.
//
// It is UI. The sim never reads a scene; the save only remembers which ones
// have played (`state.tutorial.seen['scene:<id>']`) and which books a line
// has handed over (`gift:<book>`, sim/research.ts `giveBook`).
//
// One mount, `#stage`, above the nav and the battle playback and below the
// reveal and the rewarded video (style.css). Built once and mutated: a
// portrait that is rebuilt re-enters, and a box that is rebuilt re-types.

import {
  HELP, QUESTS, SCENES, SPEAKERS, type SceneDef, type SceneLine,
} from '../../sim/data/definitions';
import { tally } from '../../sim/events';
import { playSfx } from '../../audio/sfx';
import { spriteUrl } from '../../render/sprites';
import { CAMERA_GLIDE_MS } from '../../render/camera';
import type { Coord } from '../../sim/state';
import type { Game } from '../../game';
import { el } from '../format';
import { giveBook } from '../../sim/research';
import { buildShortfall, stockBuild } from '../../sim/districts';
import { conditionHolds } from './conditions';
import { bubbleTopOver, handPlace, resolveTarget, targetHasCell, targetRect, uiNode, type Rect, type Target } from './targets';

/** A scene on the stage, and where it has got to. */
interface Playing {
  scene: SceneDef;
  index: number;
  /** The `taps` odometer when this line began (`taps` is relative). */
  tapsAtStart: number;
  /** Characters typed so far. */
  typed: number;
  target: Target | null;
  /** Since when a map target has been out of sight (off the screen, or
   *  under the box), to bring the camera back to it. */
  hiddenSince?: number | null;
  /** When the lock's target went missing, for the failsafe. */
  missingSince: number | null;
  /** The failsafe fired: the lock has let go for the rest of this line. */
  lockReleased: boolean;
}

const sceneKey = (id: string): string => `scene:${id}`;

/** A typing tick every this many letters: at 40 a second, about thirteen a
 *  second — a patter, not a buzz. */
const TICK_EVERY = 3;

/** Scroll a control into its scroller when it sits clipped outside it — the
 *  build menu's row, a long list. Only when clipped, so a visible control
 *  never jitters. */
function bringIntoView(key: string): void {
  const node = uiNode(key);
  if (node === null) return;
  const r = node.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  for (let p = node.parentElement; p !== null; p = p.parentElement) {
    const style = getComputedStyle(p);
    const scrolls = /(auto|scroll)/.test(style.overflowX + style.overflowY);
    if (!scrolls) continue;
    const box = p.getBoundingClientRect();
    if (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom) {
      node.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    return;
  }
}

/** How long the box takes to move to a new place on screen. */
const BOX_MOVE_MS = 320;

/** How many magic motes drift off a highlighted target. */
const SPARKS = 14;

/** How long a map target may sit out of sight, the player's hands off the
 *  screen, before the camera brings it back. */
const REFOCUS_MS = 1500;

/** How far a press may travel and still be a tap rather than a pan. */
const TAP_SLOP_PX = 10;

/** Conditions that record how far the kingdom has got, and so can tell a
 *  scene where to resume. The rest (a sheet open, a control on screen, taps
 *  since the line began) are moments, not progress. */
const PROGRESS: ReadonlySet<string> = new Set([
  'questReached', 'questComplete', 'questClaimed', 'questProgress', 'techDone', 'techFilled',
  'placed', 'built', 'population', 'training', 'heroes', 'lairFound', 'lairDefeated', 'lairCleared',
  'landmarkClaimed', 'landmarkSeen', 'bookOpen', 'doorOpen', 'revealed',
  'treasureRevealed', 'treasurePicked', 'abandonedRevealed', 'repairing',
]);

export function mountStage(game: Game, root: HTMLElement, frame: HTMLElement): void {
  // ------------------------------------------------------------ the pieces
  // A CONTROL is highlighted by its own silhouette lit in a blue magic glow
  // (`.stg-glow` on the control itself); a MAP PLOT by the same glow drawn
  // as the plot's diamond ON THE GROUND — by the map, under the trees and
  // buildings standing on it (`game.tutorialFocus`, mapRenderer Pass 1.3).
  // The control's glow pulses as an opacity, composited: its silhouette is
  // lit once (`.stg-glow`, a still filter) and this soft light round its box
  // breathes.
  const halo = el('div', { class: 'stg-halo', 'aria-hidden': 'true' });
  halo.hidden = true;
  // The pointer: a gloved hand, pointing down at the target from above it —
  // or up from below.
  const handDown = spriteUrl('tutorial_hand_down');
  const handUp = spriteUrl('tutorial_hand_up');
  const arrow = el('img', {
    class: 'stg-hand', 'aria-hidden': 'true', draggable: 'false', alt: '', src: handDown ?? '',
  });
  const left = el('div', { class: 'stg-actor is-left' });
  const right = el('div', { class: 'stg-actor is-right' });
  const name = el('div', { class: 'stg-name' });
  const text = el('p', { class: 'stg-text' });
  // The quill that says a tap moves the line on.
  const more = el('img', {
    class: 'stg-more', 'aria-hidden': 'true', draggable: 'false', alt: '', src: spriteUrl('tutorial_quill') ?? '',
  });
  // Parchment on a carved wooden board, one nine-sliced piece of art
  // (stage.css), lifted off the map by its own shadow.
  const box = el('div', { class: 'stg-box', role: 'dialog', 'aria-live': 'polite' },
    el('div', { class: 'stg-frame', 'aria-hidden': 'true' }), left, right, name, text, more);
  const peek = el('button', { class: 'stg-peek', type: 'button' },
    el('span', { class: 'stg-peek-face' }), el('span', { class: 'stg-peek-say' }, 'Need a hand?'));
  // The cast stands ON the box (24-dialogue.md §1), so they are its
  // children and rise and fall with it wherever it sits.
  // Magic motes drifting out from the highlighted target, slowly, the glow's
  // own light coming off it. Each carries its own start, drift, size and
  // timing, so the drift never reads as a loop.
  const sparks = el('div', { class: 'stg-sparks', 'aria-hidden': 'true' });
  for (let i = 0; i < SPARKS; i++) {
    // A start on the target's outline: one of its four sides, anywhere along it.
    const side = i % 4;
    const along = Math.random() * 100;
    const [sx, sy] = side === 0 ? [along, 0] : side === 1 ? [100, along] : side === 2 ? [along, 100] : [0, along];
    // Outward from that side, and always a little upward: light rises.
    const out = 14 + Math.random() * 22;
    const [dx, dy] = side === 0 ? [(Math.random() - 0.5) * 16, -out]
      : side === 1 ? [out, -6 - Math.random() * 14]
        : side === 2 ? [(Math.random() - 0.5) * 16, out * 0.4 - 12]
          : [-out, -6 - Math.random() * 14];
    const mote = el('span', { class: 'stg-spark' });
    mote.style.cssText = `--sx:${sx}%;--sy:${sy}%;--dx:${dx.toFixed(1)};--dy:${dy.toFixed(1)};`
      + `--s:${(0.6 + Math.random() * 0.7).toFixed(2)};--t:${(2.4 + Math.random() * 2).toFixed(2)}s;`
      + `--delay:${(-Math.random() * 4).toFixed(2)}s`;
    sparks.append(mote);
  }
  // The hand last: it points over everything, the dialogue box included.
  const layer = el('div', { class: 'stg' }, halo, sparks, box, arrow);

  let playing: Playing | null = null;
  /** No introduction starts before this: the breath between two scenes. */
  let gapUntil = 0;
  /** A line that appeared on its own — a scene starting, a beat met — takes
   *  no input until this: the tap the player had already begun, meant for
   *  the game, never finishes or skips it. */
  let graceUntil = 0;
  const graced = (): void => { graceUntil = performance.now() + HELP.inputGraceSeconds * 1000; };
  const inGrace = (): boolean => playing !== null && performance.now() < graceUntil;
  const onStage: Record<'left' | 'right', string | null> = { left: null, right: null };

  // ------------------------------------------------------------ the cast
  /** The speaker's picture in a mood: `<portrait>_<expression>` where that
   *  art exists, the speaker's own picture otherwise. */
  const pictureOf = (speaker: string, expression: string): string | null => {
    const def = SPEAKERS[speaker];
    if (!def) return null;
    return (expression !== '' ? spriteUrl(`${def.portrait}_${expression}`) : null) ?? spriteUrl(def.portrait);
  };

  const portrait = (speaker: string, expression: string): HTMLElement => {
    const def = SPEAKERS[speaker];
    const url = pictureOf(speaker, expression);
    const frameKind = def?.frame ?? 'figure';
    // A missing picture is a parchment medallion with the speaker's initial
    // pressed into it — a placeholder that says so, never an emoji.
    if (url === null) {
      return el('div', { class: 'stg-portrait is-medallion is-placeholder' },
        el('span', { class: 'stg-initial' }, (def?.name ?? speaker).replace(/^The /, '').charAt(0)));
    }
    return el('div', { class: `stg-portrait is-${frameKind}` },
      el('img', { src: url, alt: def?.name ?? speaker, draggable: 'false' }));
  };

  /** Put `speaker` on `side`, sliding in if they were not already there — or,
   *  already there, simply changing face: a new expression swaps the picture
   *  in place, it does not make an entrance. */
  const cast = (side: 'left' | 'right', speaker: string, expression: string): void => {
    const slot = side === 'left' ? left : right;
    if (onStage[side] !== speaker) {
      onStage[side] = speaker;
      slot.replaceChildren(portrait(speaker, expression));
      slot.classList.remove('is-in');
      void slot.offsetWidth; // restart the entrance
      slot.classList.add('is-in');
      return;
    }
    const img = slot.querySelector('img');
    const url = pictureOf(speaker, expression);
    if (img !== null && url !== null && img.getAttribute('src') !== url) img.setAttribute('src', url);
  };
  const leave = (side: 'left' | 'right'): void => {
    onStage[side] = null;
    const slot = side === 'left' ? left : right;
    slot.classList.remove('is-in');
    slot.replaceChildren();
  };

  // ------------------------------------------------------------ lines
  const line = (): SceneLine | null => (playing === null ? null : playing.scene.lines[playing.index] ?? null);

  const lineHolds = (l: SceneLine): boolean => l.until !== 'tap' && conditionHolds(game, {
    kind: l.until, target: l.untilTarget, amount: l.untilAmount, tapsAtStart: playing!.tapsAtStart,
  });

  /** A line that `gives` a book hands it over as it is read — the book's
   *  unlock splash then follows the line (23-tutorials.md §4.6). One that
   *  `stocks` a building makes up what the wallet lacks for it. */
  const hand = (l: SceneLine): void => {
    if (l.gives) giveBook(game.state, l.gives);
    if (l.stocks) { stockBuild(game.state, l.stocks); game.notify(); }
  };

  /** A line that `stocks` a building has nothing to say while the wallet can
   *  already pay for one. */
  const needless = (l: SceneLine): boolean =>
    !!l.stocks && Object.keys(buildShortfall(game.state, l.stocks)).length === 0;

  /** Begin line `index` of the playing scene — or end the scene. */
  const begin = (index: number): void => {
    if (playing === null) return;
    // A BEAT CHECKS ITS CONDITION WHEN IT STARTS (23-tutorials.md §3): lines
    // already met are passed at once, so a reload resumes at the first one
    // still owed.
    while (index < playing.scene.lines.length) {
      const l = playing.scene.lines[index];
      playing.index = index;
      playing.tapsAtStart = tally(game.state, 'taps');
      if (needless(l)) { index += 1; continue; }
      if (l.until === 'tap' || !lineHolds(l)) break;
      hand(l);
      index += 1;
    }
    if (index >= playing.scene.lines.length) { end(); return; }
    const l = playing.scene.lines[index];
    playing.typed = 0;
    playing.missingSince = null;
    playing.lockReleased = false;
    playing.target = resolveTarget(game, l.point, null);
    // The camera flies to a map target before the line appears.
    if (playing.target?.kind === 'cell') {
      game.camera.centerOnCell(playing.target.cell, playing.target.span, CAMERA_GLIDE_MS);
    }
    cast(l.side, l.speaker, l.expression);
    const other = l.side === 'left' ? 'right' : 'left';
    left.classList.toggle('is-lit', l.side === 'left');
    right.classList.toggle('is-lit', l.side === 'right');
    // Someone else speaking on this side replaces whoever stood there; the
    // other side stays, dimmed.
    if (onStage[other] !== null) (other === 'left' ? left : right).classList.remove('is-lit');
    const speaker = SPEAKERS[l.speaker];
    name.textContent = speaker?.name ?? l.speaker;
    // Each speaker's ribbon has its own colour (stage.css).
    name.dataset.speaker = l.speaker;
    name.classList.toggle('is-right', l.side === 'right');
    box.classList.toggle('is-waiting', l.until !== 'tap');
    place(l);
    fitText(l.text);
    text.textContent = '';
  };

  /** Set the line at the box's type, or smaller until the WHOLE line fits the
   *  box's fixed height — measured on the full text before it types, so the
   *  size never changes mid-line. */
  const fitText = (full: string): void => {
    text.style.fontSize = '';
    text.textContent = full;
    let size = parseFloat(getComputedStyle(text).fontSize);
    const floor = size * 0.7;
    while (text.scrollHeight > text.clientHeight + 1 && size > floor) {
      size -= 0.5;
      text.style.fontSize = `${size}px`;
    }
  };

  const next = (): void => {
    if (playing === null) return;
    const l = line();
    if (l) hand(l);
    if (l?.exit) leave(l.side);
    begin(playing.index + 1);
  };

  const end = (): void => {
    if (playing !== null) {
      if (game.state.tutorial.seen[sceneKey(playing.scene.id)] !== true) game.track('scene_done', { id: playing.scene.id });
      game.state.tutorial.seen[sceneKey(playing.scene.id)] = true;
    }
    gapUntil = performance.now() + HELP.sceneGapSeconds * 1000;
    playing = null;
    boxShown = false;
    glow(null);
    leave('left');
    leave('right');
    root.replaceChildren();
    game.notify();
  };

  const start = (scene: SceneDef): void => {
    playing = {
      scene, index: 0, tapsAtStart: 0, typed: 0, target: null, missingSince: null, lockReleased: false,
    };
    // A SCENE RESUMES WHERE THE GAME IS (23-tutorials.md §3): after a reload
    // the player may already have done what its later lines ask, so it picks
    // up after the last line whose condition already holds, rather than
    // replaying the greeting to someone halfway through the morning.
    // Only PROGRESS counts — a quest, a research, a building: a sheet being
    // shut or a control being on screen says nothing about how far along
    // the player is.
    let resumeAt = 0;
    scene.lines.forEach((l, i) => {
      if (PROGRESS.has(l.until) && lineHolds(l)) resumeAt = i + 1;
    });
    root.replaceChildren(layer);
    graced();
    begin(resumeAt);
  };

  /** The box has been placed in this scene, so a new place is a move. */
  let boxShown = false;

  /** Where the box's top edge falls when it sits at the bottom. */
  /** Would the box at the BOTTOM — or anyone standing on it — cover `r`?
   *  Read off the layout (offsets, not rects), so a box mid-move or a
   *  figure mid-entrance is judged where it will settle. */
  const bottomCovers = (r: Rect): boolean => {
    const was = box.dataset.place;
    box.dataset.place = 'bottom';
    const f = frame.getBoundingClientRect();
    const l = layer.getBoundingClientRect();
    const b: Rect = {
      x: l.left - f.left + box.offsetLeft, y: l.top - f.top + box.offsetTop,
      w: box.offsetWidth, h: box.offsetHeight,
    };
    const parts: Rect[] = [b, ...[left, right].filter((a) => a.childElementCount > 0).map((a) => ({
      x: b.x + a.offsetLeft, y: b.y + a.offsetTop, w: a.offsetWidth, h: a.offsetHeight,
    }))];
    box.dataset.place = was ?? '';
    // Touching is not covering: the box sits just above the quest scroll.
    return parts.some((p) => r.x < p.x + p.w && p.x < r.x + r.w && r.y < p.y + p.h && p.y < r.y + r.h);
  };

  /** The cast stands on the box; where that would put a figure above the
   *  header — off the screen — it is not shown. Read while the box is still,
   *  so a move or an entrance does not flicker it. */
  const fitCast = (now = false): void => {
    if (!now && box.getAnimations().length > 0) return;
    const actors = [left, right].filter((a) => a.childElementCount > 0);
    if (actors.length === 0) return;
    const header = document.getElementById('header');
    const limit = header?.getBoundingClientRect().bottom ?? frame.getBoundingClientRect().top;
    const top = box.getBoundingClientRect().top + Math.min(...actors.map((a) => a.offsetTop));
    box.classList.toggle('no-cast', top < limit);
  };

  /** This line's box already moved out of the hand's way: once a line, so
   *  the box never flaps between the edges. */
  let boxMovedForHand = false;

  /** Where the box sits: its own place, or away from the target. */
  const place = (l: SceneLine): void => {
    let where = l.box;
    if (where === 'auto') {
      // BOTTOM, where the cast stands on it — unless the box, or someone
      // standing on it, would cover the very thing the line points at. Only
      // then the top, where there is no room for the cast.
      let r = playing?.target ? targetRect(game, playing.target, frame) : null;
      // A map target is being flown to the middle of the screen: judge it
      // where it is going, not where the glide has it now.
      if (r !== null && playing?.target?.kind === 'cell') {
        r = { ...r, x: (frame.clientWidth - r.w) / 2, y: (frame.clientHeight - r.h) / 2 };
      }
      where = r !== null && bottomCovers(r) ? 'top' : 'bottom';
    }
    boxMovedForHand = false;
    setPlace(where);
  };

  /** The box goes to `where`. */
  const setPlace = (where: string): void => {
    // A box already on screen MOVES to its new place — quickly, overshooting
    // a touch and settling back — rather than jumping there.
    const from = boxShown && box.dataset.place !== where ? box.getBoundingClientRect() : null;
    box.dataset.place = where;
    layer.dataset.place = where;
    boxShown = true;
    fitCast(true);
    if (from !== null) {
      const to = box.getBoundingClientRect();
      box.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: BOX_MOVE_MS, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
  };

  // ------------------------------------------------------------ taps
  /** A tap on the box finishes the line typing, then moves a tap line on —
   *  two taps, never one, so a line is never skipped unread. */
  const tapLine = (): void => {
    if (playing === null || inGrace()) return;
    const l = line();
    if (l === null) return;
    if (playing.typed < l.text.length) { playing.typed = l.text.length; text.textContent = l.text; return; }
    if (l.until === 'tap') next();
  };
  box.addEventListener('click', tapLine);

  /** A line that waits for a tap takes one ANYWHERE on the screen, as a
   *  visual novel does — and keeps it: the tap moves the dialogue on and
   *  reaches nothing behind it. Panning the map stays free. */
  const waitsForTap = (): boolean => playing !== null && line()?.until === 'tap';

  // ------------------------------------------------------------ the lock
  const lockNow = (): SceneLine['lock'] => {
    const l = line();
    if (playing === null || l === null || playing.lockReleased) return 'none';
    return l.lock;
  };

  /** THE ONE GATE ON THE MAP: which taps a line lets through. */
  game.tapGate = (cell: Coord | null, how: 'tap' | 'hold' | 'ghost'): boolean => {
    if (waitsForTap() || inGrace()) return false; // the frame's click moves the line on
    const lock = lockNow();
    if (lock === 'none' || lock === 'map') return true;
    if (lock === 'all') return false;
    const t = playing!.target;
    if (t === null || t.kind === 'ui') return false;
    return how !== 'ghost' && cell !== null && targetHasCell(t, cell);
  };

  // A capture-phase filter on the whole frame: during a lock, a press lands
  // only on the box, the target, the map (whose taps `tapGate` sifts) or the
  // dev bar. Panning is never locked.
  const allowed = (node: Node | null): boolean => {
    const lock = waitsForTap() || inGrace() ? 'all' : lockNow();
    if (lock === 'none') return true;
    if (node === null) return false;
    const elNode = node instanceof HTMLElement ? node : node.parentElement;
    if (elNode === null) return false;
    // A reveal or a splash that lands mid-line takes its own taps: it sits
    // above the stage, so a lock that refused them could never be lifted.
    if (box.contains(elNode) || elNode.closest('.dev-bar, #dev, .devbar, #unlock, #gacha') !== null) return true;
    if (elNode.tagName === 'CANVAS') return true;
    const t = playing!.target;
    if (lock !== 'all' && t?.kind === 'ui') {
      const target = uiNode(t.key);
      if (target !== null && target.contains(elNode)) return true;
    }
    // Placing a building is map work, and so is its panel's confirm.
    if (lock === 'map' && elNode.closest('#panel') !== null) return true;
    return false;
  };
  // Where the press began, so a pan of the map is never read as a tap.
  let downAt: { x: number; y: number } | null = null;
  frame.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; }, { capture: true });
  frame.addEventListener('click', (e) => {
    if (!waitsForTap()) return;
    const node = e.target instanceof HTMLElement ? e.target : (e.target as Node | null)?.parentElement ?? null;
    // An unlock splash or a pack reveal over a line takes its own tap.
    if (node === null || box.contains(node) || node.closest('.dev-bar, #dev, .devbar, #unlock, #gacha') !== null) return;
    const moved = downAt === null ? 0 : Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    if (moved < TAP_SLOP_PX) tapLine();
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });
  for (const type of ['pointerdown', 'mousedown', 'click'] as const) {
    frame.addEventListener(type, (e) => {
      if (allowed(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });
  }

  // ------------------------------------------------------------ the director
  /** May a scene start now? Never over a fight, a reveal or a video, nor
   *  before an unlock splash waiting to be shown — the splash names the
   *  thing, the scene then talks about it; over a sheet only when the scene
   *  says so. */
  const canStart = (scene: SceneDef): boolean => {
    if (game.state.player.payer === null) return false;
    if (game.battle !== null || game.gachaReveal !== null || game.adWatch() !== null) return false;
    if (game.unlockQueue.length > 0) return false;
    if (!scene.anywhere && game.hasOpenSheet()) return false;
    // The First Morning runs beat to beat; every introduction after it waits
    // for a breath, so the fog giving up three things at once is three
    // moments, not a queue.
    if (scene.skippable && performance.now() < gapUntil) return false;
    return true;
  };

  const due = (): SceneDef | null => {
    if (game.state.tutorial.veteran) return null;
    for (const scene of SCENES) {
      if (game.state.tutorial.seen[sceneKey(scene.id)]) continue;
      if (!conditionHolds(game, {
        kind: scene.trigger, target: scene.triggerTarget, amount: scene.triggerAmount, tapsAtStart: 0,
      })) continue;
      return canStart(scene) ? scene : null; // one at a time, in authored order
    }
    return null;
  };

  // ------------------------------------------------------------ idle help
  let lastActivity = performance.now();
  let advisorRestUntil = 0;
  let peekUntil = 0;
  frame.addEventListener('pointerdown', () => { lastActivity = performance.now(); }, { capture: true });
  peek.addEventListener('click', () => {
    peekUntil = 0;
    peek.classList.remove('is-in');
    lastActivity = performance.now();
    game.focusQuest();
  });
  const helpWindowOpen = (): boolean => {
    const until = QUESTS.findIndex((q) => q.id === HELP.untilQuest);
    return until < 0 || game.state.quests.index <= until;
  };

  const idleHelp = (now: number): void => {
    const quest = game.questInfo();
    const idle = (now - lastActivity) / 1000;
    const stuck = playing === null && quest !== null && !quest.complete && !game.hasOpenSheet()
      && !game.state.tutorial.veteran;
    document.getElementById('quest')?.classList.toggle('is-nudging', stuck && idle >= HELP.idleWiggleSeconds);
    const wantPeek = stuck && helpWindowOpen() && idle >= HELP.idleAdvisorSeconds && now >= advisorRestUntil;
    if (wantPeek && peekUntil === 0) {
      peekUntil = now + HELP.advisorShowSeconds * 1000;
      advisorRestUntil = now + HELP.advisorRestSeconds * 1000;
      const face = peek.querySelector('.stg-peek-face')!;
      face.replaceChildren(portrait('advisor', ''));
      if (!peek.isConnected) frame.append(peek);
      peek.classList.add('is-in');
    }
    if (peekUntil !== 0 && (now >= peekUntil || !stuck)) {
      peekUntil = 0;
      peek.classList.remove('is-in');
    }
  };

  // ------------------------------------------------------------ the frame
  let lastCheck = 0;
  let lastFrame = performance.now();
  /** Is a map target off the screen, or hidden under the box? */
  const outOfSight = (r: Rect): boolean => {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    if (cx < 0 || cy < 0 || cx > frame.clientWidth || cy > frame.clientHeight) return true;
    const f = frame.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const bx = b.left - f.left;
    const by = b.top - f.top;
    return cx > bx && cx < bx + b.width && cy > by && cy < by + b.height;
  };

  /** The control wearing the glow, so it can be taken off again. */
  let glowing: HTMLElement | null = null;
  const glow = (node: HTMLElement | null): void => {
    if (node === glowing) return;
    glowing?.classList.remove('stg-glow');
    node?.classList.add('stg-glow');
    glowing = node;
  };

  const drawTarget = (r: Rect | null): void => {
    const show = r !== null;
    // Read before anything is written, so the page lays out once: the box,
    // and the hand's size (a guess on the frame it first shows).
    const f = frame.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const boxRect = b.width > 0 ? { x: b.left - f.left, y: b.top - f.top, w: b.width, h: b.height } : null;
    const hand = { w: arrow.offsetWidth || 48, h: arrow.offsetHeight || 56 };
    const isCell = playing?.target?.kind === 'cell';
    glow(show && !isCell && playing?.target?.kind === 'ui' ? uiNode(playing.target.key) : null);
    game.tutorialFocus = show && playing?.target?.kind === 'cell'
      ? { cell: playing.target.cell, span: playing.target.span } : null;
    halo.hidden = glowing === null;
    arrow.hidden = !show;
    sparks.hidden = !show;
    if (!show) return;
    const pad = playing?.target?.kind === 'cell' ? 0 : 6;
    const padded = {
      left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + pad * 2}px`, height: `${r.h + pad * 2}px`,
    };
    if (!isCell) Object.assign(halo.style, padded);
    Object.assign(sparks.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    // Over a building with its collect bubble up, the hand stands above the
    // bubble: a line asking the player to gather it must not hide it.
    const bubble = playing?.target ? bubbleTopOver(game, playing.target, frame) : null;
    const top = bubble === null ? r.y - 8 : Math.min(r.y - 8, bubble - 4);
    // The arrow points DOWN at the target from above it, unless that would
    // leave the screen, then UP from below — and never stands on the line.
    const { above, moveBox } = handPlace(r, hand, boxRect, f.height, top);
    // Judged only while the box is still: mid-move, it is not where it settles.
    if (moveBox && !boxMovedForHand && box.getAnimations().length === 0) {
      boxMovedForHand = true;
      setPlace(box.dataset.place === 'top' ? 'bottom' : 'top');
    }
    arrow.classList.toggle('is-below', !above);
    const src = above ? handDown : handUp;
    if (src !== null && arrow.getAttribute('src') !== src) arrow.setAttribute('src', src);
    Object.assign(arrow.style, {
      left: `${r.x + r.w / 2}px`, top: above ? `${top}px` : `${r.y + r.h + 8}px`,
    });
  };

  /**
   * THE STAGE'S CLOCK. While a scene plays it runs every frame — the line
   * types and the hand follows its target. Between scenes there is nothing
   * to animate, so it wakes four times a second to ask whether one is due
   * and whether the player is idle. Within a frame the layout is READ first
   * (where the target is, whether it is in sight) and WRITTEN after, so the
   * browser lays the page out once; the costlier reads — the scroller walk,
   * the cast's fit — ride the tenth-of-a-second check.
   */
  const IDLE_CHECK_MS = 250;
  let lastIdleHelp = 0;
  const frameTick = (now: number): void => {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (playing === null) {
      game.tutorialFocus = null;
      // Not while the page is hidden: a timer still fires there, and a
      // scene would play to nobody.
      if (now - lastCheck > IDLE_CHECK_MS - 10 && !document.hidden) {
        lastCheck = now;
        const scene = due();
        if (scene !== null) start(scene);
      }
    } else if (game.state.tutorial.seen[sceneKey(playing.scene.id)]) {
      // Marked played from outside — a dev skip: it leaves the screen.
      end();
    } else {
      const l = line();
      if (l !== null) {
        // Type the line — written below, after the layout has been read.
        let typedText: string | null = null;
        if (playing.typed < l.text.length) {
          const before = Math.floor(playing.typed);
          playing.typed = Math.min(l.text.length, playing.typed + HELP.typeCharsPerSecond * dt);
          const shown = Math.floor(playing.typed);
          typedText = l.text.slice(0, shown);
          // A soft knock every third letter as the line types — never on a
          // space, never two at once, and none for a line finished by a tap.
          for (let i = before; i < shown; i++) {
            if (i % TICK_EVERY === 0 && l.text[i].trim() !== '') {
              playSfx('textTick', { group: 'textTick', limit: 1 });
              break;
            }
          }
        }
        const moreHidden = !(l.until === 'tap' && playing.typed >= l.text.length);
        // Keep the target found: a UI node is re-found each frame, a cell is
        // kept while it still fits.
        const was = playing.target;
        playing.target = resolveTarget(game, l.point, playing.target);
        // A map target that moved on — the forest just cleared, the next one
        // pointed at — takes the camera with it, or the arrow points off the
        // screen.
        const moved = playing.target?.kind === 'cell' && was?.kind === 'cell'
          && (was.cell.x !== playing.target.cell.x || was.cell.y !== playing.target.cell.y);
        if (moved && playing.target?.kind === 'cell') {
          game.camera.centerOnCell(playing.target.cell, playing.target.span, CAMERA_GLIDE_MS);
        }
        const r = playing.target === null ? null : targetRect(game, playing.target, frame);
        // A MAP TARGET OUT OF SIGHT is brought back: the player tapped another
        // forest than the one pointed at, or panned away, and the hand is
        // pointing at nothing they can see. Once the hands are off the
        // screen for a moment — never mid-pan.
        if (playing.target?.kind === 'cell' && r !== null && outOfSight(r)) {
          playing.hiddenSince ??= now;
          if (now - playing.hiddenSince > REFOCUS_MS && now - lastActivity > REFOCUS_MS) {
            game.camera.centerOnCell(playing.target.cell, playing.target.span, CAMERA_GLIDE_MS);
            playing.hiddenSince = null;
          }
        } else {
          playing.hiddenSince = null;
        }
        // A LOCK NEVER STRANDS THE PLAYER: a target missing for a while lets
        // the lock go, and the line reads as a hint.
        if ((l.lock === 'target' || l.lock === 'map') && r === null && l.point !== '') {
          playing.missingSince ??= now;
          if (now - playing.missingSince > HELP.lockFailsafeSeconds * 1000) playing.lockReleased = true;
        } else {
          playing.missingSince = null;
        }
        drawTarget(r);
        if (typedText !== null) text.textContent = typedText;
        more.hidden = moreHidden;
        if (now - lastCheck > 100) {
          lastCheck = now;
          // A control scrolled out of its row — the fourth card of the build
          // menu — is brought into view, or the lock holds the player in
          // front of something they cannot reach.
          if (playing.target?.kind === 'ui') bringIntoView(playing.target.key);
          fitCast();
          if (lineHolds(l)) { graced(); next(); }
        }
      }
    }
    if (now - lastIdleHelp > IDLE_CHECK_MS - 10) {
      lastIdleHelp = now;
      idleHelp(now);
    }
    if (playing !== null) requestAnimationFrame(frameTick);
    else setTimeout(() => frameTick(performance.now()), IDLE_CHECK_MS);
  };
  requestAnimationFrame(frameTick);
}
