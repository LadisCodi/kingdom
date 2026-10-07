// THE DIRECTOR (Docs/features/23-tutorials.md §1): which scene plays next.
//
// Pure in the game it is given — no DOM, no clock of its own — so it is the
// part of the stage a test can hold to its rules:
//
//  1. A SCENE PLAYS WHERE IT BELONGS. `where` says the province, the world
//     board or either; a scene about the city never starts on the world.
//  2. ONE THAT CANNOT START HERE DOES NOT HOLD THE OTHERS. An introduction
//     waiting for the player to come back, or to close a card, lets the next
//     one that fits go first. Only the First Morning runs strictly in order.
//  3. WHAT THE PLAYER HAS ALREADY DONE IS NOT TAUGHT. A scene whose
//     `doneWhen` holds when it is due is settled — marked played — without
//     playing.

import { SCENES, type SceneDef } from '../../sim/data/definitions';
import { firstMorningOn } from '../../sim/doors';
import type { Game } from '../../game';
import { giveBook } from '../../sim/research';
import { giveRelic } from '../../sim/relics';
import { conditionHolds } from './conditions';

export const sceneKey = (id: string): string => `scene:${id}`;

/** Is the player on the screen this scene belongs to? */
export const inPlace = (game: Game, scene: SceneDef): boolean =>
  scene.where === 'any' || (scene.where === 'world') === (game.scene === 'world');

/** What holds EVERY scene back: the profile sheet (owed only once the First
 *  Morning is over, so the morning plays with none), a fight, a reveal, a
 *  video, or an unlock splash waiting to be shown — the splash names the
 *  thing, the scene then talks about it. */
export const heldBack = (game: Game): boolean =>
  game.payerDue() || game.battle !== null || game.gachaReveal !== null || game.adWatch() !== null
  || game.unlockQueue.length > 0;

/** May THIS scene start here and now? On its own screen, and over a sheet
 *  only when it says so. */
export const fitsHere = (game: Game, scene: SceneDef): boolean =>
  inPlace(game, scene) && (scene.anywhere || !game.hasOpenSheet());

/** Has the player already done what the scene would teach? */
export const alreadyDone = (game: Game, scene: SceneDef): boolean => scene.doneWhen !== ''
  && conditionHolds(game, { kind: scene.doneWhen, target: scene.doneTarget, amount: scene.doneAmount, tapsAtStart: 0 });

const triggered = (game: Game, scene: SceneDef): boolean => conditionHolds(game, {
  kind: scene.trigger, target: scene.triggerTarget, amount: scene.triggerAmount, tapsAtStart: 0,
});

export interface Pick {
  /** The scene to start now, or null. */
  scene: SceneDef | null;
  /** Scenes due but already done: to be marked played, gifts handed over. */
  settled: SceneDef[];
}

/**
 * The next scene to play. `breathing` is true while the gap after the last
 * scene is still running: every introduction waits it out.
 */
export function pickScene(game: Game, breathing: boolean): Pick {
  const settled: SceneDef[] = [];
  if (game.state.tutorial.veteran) return { scene: null, settled };
  // What stands in view past the fog — the Watchtower on the northern hills,
  // from the first screen — waits for the First Morning to end.
  const morning = firstMorningOn(game.state);
  for (const scene of SCENES) {
    if (game.state.tutorial.seen[sceneKey(scene.id)]) continue;
    if (morning && scene.trigger === 'sighted') continue;
    if (!triggered(game, scene)) continue;
    if (alreadyDone(game, scene)) { settled.push(scene); continue; }
    if (heldBack(game)) return { scene: null, settled };
    if (scene.skippable && breathing) return { scene: null, settled };
    if (fitsHere(game, scene)) return { scene, settled };
    // A beat of the First Morning waits its turn, strictly in order.
    if (!scene.skippable) return { scene: null, settled };
  }
  return { scene: null, settled };
}

/** Settle a scene the player has already done: marked played without
 *  playing — and what its lines hand over (a book, a relic) is still handed
 *  over, so skipping a lesson never costs its gift. */
export function settleScene(game: Game, scene: SceneDef): void {
  for (const l of scene.lines) {
    if (l.gives) giveBook(game.state, l.gives);
    if (l.restores) giveRelic(game.state, l.restores);
  }
  game.state.tutorial.seen[sceneKey(scene.id)] = true;
  game.track('scene_done', { id: scene.id, skipped: true });
}
