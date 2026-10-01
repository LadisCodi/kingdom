// THE STAGE (Docs/features/24-dialogue.md) and the director that decides what
// plays on it (Docs/features/23-tutorials.md).
//
// A small visual-novel stage over the game: a character on each side, a box
// of text that types itself and can sit at the bottom, the top or the middle
// of the screen, a pointer at whatever the line is about, and — during the
// First Morning — a lock on every tap but the one the line asks for.
//
// It is UI. The sim never reads a scene; the save only remembers which ones
// have played (`state.tutorial.seen['scene:<id>']`).
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
import type { Coord } from '../../sim/state';
import type { Game } from '../../game';
import { el } from '../format';
import { conditionHolds } from './conditions';
import { resolveTarget, targetHasCell, targetRect, uiNode, type Rect, type Target } from './targets';

/** A scene on the stage, and where it has got to. */
interface Playing {
  scene: SceneDef;
  index: number;
  /** The `taps` odometer when this line began (`taps` is relative). */
  tapsAtStart: number;
  /** Characters typed so far. */
  typed: number;
  target: Target | null;
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

/** How far a press may travel and still be a tap rather than a pan. */
const TAP_SLOP_PX = 10;

/** Conditions that record how far the kingdom has got, and so can tell a
 *  scene where to resume. The rest (a sheet open, a control on screen, taps
 *  since the line began) are moments, not progress. */
const PROGRESS: ReadonlySet<string> = new Set([
  'questReached', 'questComplete', 'questClaimed', 'questProgress', 'techDone', 'techFilled',
  'placed', 'built', 'population', 'heroes', 'lairFound', 'lairDefeated', 'lairCleared',
  'landmarkClaimed', 'landmarkSeen', 'bookOpen', 'doorOpen', 'revealed',
]);

export function mountStage(game: Game, root: HTMLElement, frame: HTMLElement): void {
  // ------------------------------------------------------------ the pieces
  const scrim = el('div', { class: 'stg-scrim' });
  // A CONTROL is highlighted by its own silhouette lit in a blue magic glow
  // (`.stg-glow` on the control itself); a MAP PLOT by the same glow drawn
  // as the plot's diamond — this ring.
  const ring = el('div', { class: 'stg-ring' });
  ring.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
    + '<polygon class="stg-ring-halo" points="50,3 97,50 50,97 3,50"/>'
    + '<polygon class="stg-ring-line" points="50,3 97,50 50,97 3,50"/></svg>';
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
  const layer = el('div', { class: 'stg' }, scrim, ring, arrow, box);

  let playing: Playing | null = null;
  /** No introduction starts before this: the breath between two scenes. */
  let gapUntil = 0;
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
      if (l.until === 'tap' || !lineHolds(l)) break;
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
      game.camera.centerOnCell(playing.target.cell, playing.target.span);
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
    text.textContent = '';
    box.classList.toggle('is-waiting', l.until !== 'tap');
    place(l);
  };

  const next = (): void => {
    if (playing === null) return;
    const l = line();
    if (l?.exit) leave(l.side);
    begin(playing.index + 1);
  };

  const end = (): void => {
    if (playing !== null) game.state.tutorial.seen[sceneKey(playing.scene.id)] = true;
    gapUntil = performance.now() + HELP.sceneGapSeconds * 1000;
    playing = null;
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
    begin(resumeAt);
  };

  /** Where the box sits: its own place, or away from the target. */
  const place = (l: SceneLine): void => {
    let where = l.box;
    if (where === 'auto') {
      const r = playing?.target ? targetRect(game, playing.target, frame) : null;
      where = r !== null && r.y + r.h / 2 > frame.clientHeight / 2 ? 'top' : 'bottom';
    }
    box.dataset.place = where;
    layer.dataset.place = where;
  };

  // ------------------------------------------------------------ taps
  /** A tap on the box finishes the line typing, then moves a tap line on. */
  const tapLine = (): void => {
    if (playing === null) return;
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
    if (waitsForTap()) return false; // the frame's click moves the line on
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
    const lock = waitsForTap() ? 'all' : lockNow();
    if (lock === 'none') return true;
    if (node === null) return false;
    const elNode = node instanceof HTMLElement ? node : node.parentElement;
    if (elNode === null) return false;
    if (box.contains(elNode) || elNode.closest('.dev-bar, #dev, .devbar') !== null) return true;
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
    if (node === null || box.contains(node) || node.closest('.dev-bar, #dev, .devbar') !== null) return;
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
  /** May a scene start now? Never over a fight, a reveal or a video; over a
   *  sheet only when the scene says so. */
  const canStart = (scene: SceneDef): boolean => {
    if (game.state.player.payer === null) return false;
    if (game.battle !== null || game.gachaReveal !== null || game.adWatch() !== null) return false;
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
  /** The control wearing the glow, so it can be taken off again. */
  let glowing: HTMLElement | null = null;
  const glow = (node: HTMLElement | null): void => {
    if (node === glowing) return;
    glowing?.classList.remove('stg-glow');
    node?.classList.add('stg-glow');
    glowing = node;
  };

  const drawTarget = (r: Rect | null, lock: SceneLine['lock']): void => {
    const show = r !== null;
    const isCell = playing?.target?.kind === 'cell';
    glow(show && !isCell && playing?.target?.kind === 'ui' ? uiNode(playing.target.key) : null);
    ring.hidden = !show || !isCell;
    arrow.hidden = !show;
    scrim.classList.toggle('is-dim', lock === 'all' || lock === 'target');
    scrim.classList.toggle('is-cut', show && lock === 'target');
    if (!show) return;
    const pad = playing?.target?.kind === 'cell' ? 0 : 6;
    Object.assign(ring.style, {
      left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + pad * 2}px`, height: `${r.h + pad * 2}px`,
    });
    // The scrim's cut-out IS the scrim: a box round the target whose shadow
    // darkens everything else. Without a cut it covers the frame.
    if (lock === 'target') {
      Object.assign(scrim.style, {
        left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + pad * 2}px`, height: `${r.h + pad * 2}px`,
      });
    } else {
      Object.assign(scrim.style, { left: '', top: '', width: '', height: '' });
    }
    // The arrow points DOWN at the target from above it, unless that would
    // leave the screen, then UP from below.
    const above = r.y > 70;
    arrow.classList.toggle('is-below', !above);
    const src = above ? handDown : handUp;
    if (src !== null && arrow.getAttribute('src') !== src) arrow.setAttribute('src', src);
    Object.assign(arrow.style, {
      left: `${r.x + r.w / 2}px`, top: above ? `${r.y - 8}px` : `${r.y + r.h + 8}px`,
    });
  };

  const frameTick = (now: number): void => {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (playing === null) {
      if (now - lastCheck > 250) {
        lastCheck = now;
        const scene = due();
        if (scene !== null) start(scene);
      }
    } else {
      const l = line();
      if (l !== null) {
        // Type the line.
        if (playing.typed < l.text.length) {
          const before = Math.floor(playing.typed);
          playing.typed = Math.min(l.text.length, playing.typed + HELP.typeCharsPerSecond * dt);
          const shown = Math.floor(playing.typed);
          text.textContent = l.text.slice(0, shown);
          // A soft knock every third letter as the line types — never on a
          // space, never two at once, and none for a line finished by a tap.
          for (let i = before; i < shown; i++) {
            if (i % TICK_EVERY === 0 && l.text[i].trim() !== '') {
              playSfx('textTick', { group: 'textTick', limit: 1 });
              break;
            }
          }
        }
        more.hidden = !(l.until === 'tap' && playing.typed >= l.text.length);
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
          game.camera.centerOnCell(playing.target.cell, playing.target.span);
        }
        // A control scrolled out of its row — the fourth card of the build
        // menu — is brought into view, or the lock holds the player in front
        // of something they cannot reach.
        if (playing.target?.kind === 'ui') bringIntoView(playing.target.key);
        const r = playing.target === null ? null : targetRect(game, playing.target, frame);
        // A LOCK NEVER STRANDS THE PLAYER: a target missing for a while lets
        // the lock go, and the line reads as a hint.
        if ((l.lock === 'target' || l.lock === 'map') && r === null && l.point !== '') {
          playing.missingSince ??= now;
          if (now - playing.missingSince > HELP.lockFailsafeSeconds * 1000) playing.lockReleased = true;
        } else {
          playing.missingSince = null;
        }
        drawTarget(r, lockNow());
        if (now - lastCheck > 100) {
          lastCheck = now;
          if (lineHolds(l)) next();
        }
      }
    }
    idleHelp(now);
    requestAnimationFrame(frameTick);
  };
  requestAnimationFrame(frameTick);
}
