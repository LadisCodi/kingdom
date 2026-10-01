// WHAT MOVES A LINE ON, and what starts a scene (Docs/features/24-dialogue.md
// §5). A condition is a kind, a target and an amount; the kinds are here, the
// choice of one is data (`scenes`).
//
// Pure reads of the game and, for `ui`, of the DOM: nothing here writes.
// `taps` is RELATIVE — taps since the line began — so the caller hands in the
// odometer reading it started from.

import {
  DISTRICTS, LANDMARKS, LAIRS, QUESTS, TECHNOLOGIES, type SceneCondition,
} from '../../sim/data/definitions';
import { isDoorOpen, type DoorId } from '../../sim/doors';
import { tally } from '../../sim/events';
import { mana } from '../../sim/mana';
import { isQuestComplete, questValue } from '../../sim/quests';
import { isTechComplete, isTechFilled, isTomeOpen } from '../../sim/research';
import { fogState } from '../../sim/fog';
import { woundedCount } from '../../sim/army';
import {
  buildQueueCapacity, type LairId, type TechId, type TomeId,
} from '../../sim/state';
import type { Game } from '../../game';

export interface ConditionArgs {
  kind: SceneCondition;
  target: string;
  amount: number;
  /** The `taps` odometer when the line began. */
  tapsAtStart: number;
}

/** The buildings that run a workshop queue — what `built AnyWorkshop` means. */
const WORKSHOPS: readonly string[] = Object.entries(DISTRICTS)
  .filter(([, d]) => d.produces !== null).map(([id]) => id);

const questIndex = (id: string): number => QUESTS.findIndex((q) => q.id === id);

/** Is `kind(target, amount)` true right now? `tap` never is: a tap is the
 *  stage's own event. */
export function conditionHolds(game: Game, c: ConditionArgs): boolean {
  const state = game.state;
  switch (c.kind) {
    case 'tap': return false;
    case 'always': return true;
    case 'questReached': {
      const at = questIndex(c.target);
      return at >= 0 && state.quests.index >= at;
    }
    case 'questClaimed': {
      const at = questIndex(c.target);
      return at >= 0 && state.quests.index > at;
    }
    case 'questComplete': {
      const at = questIndex(c.target);
      if (at < 0) return false;
      if (state.quests.index > at) return true;
      return state.quests.index === at && isQuestComplete(state, QUESTS[at]);
    }
    case 'questProgress': {
      const at = questIndex(c.target);
      if (at < 0) return false;
      if (state.quests.index > at) return true;
      return state.quests.index === at && questValue(state, QUESTS[at]) >= Math.max(1, c.amount);
    }
    case 'techDone':
      return TECHNOLOGIES[c.target as TechId] !== undefined && isTechComplete(state, c.target as TechId);
    case 'techFilled':
      return TECHNOLOGIES[c.target as TechId] !== undefined
        && (isTechComplete(state, c.target as TechId) || isTechFilled(state, c.target as TechId));
    case 'placing':
      return game.mode.kind === 'placing' && game.mode.definitionId === c.target;
    case 'placed':
      return state.city.districts.some((d) => d.definitionId === c.target);
    case 'built': {
      const matches = (id: string): boolean => (c.target === 'AnyWorkshop'
        ? WORKSHOPS.includes(id) : id === c.target);
      return state.city.districts.filter((d) => d.state === 'Built' && matches(d.definitionId)).length
        >= Math.max(1, c.amount);
    }
    case 'overlay': return game.openOverlay === c.target;
    case 'noOverlay': return game.openOverlay === null;
    // ON SCREEN, not merely in the document: the quest scroll stays in the
    // DOM, hidden, while a card covers it.
    case 'ui': {
      const node = document.querySelector<HTMLElement>(`[data-coach="${CSS.escape(c.target)}"]`);
      if (node === null) return false;
      const r = node.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    }
    case 'taps': return tally(state, 'taps') - c.tapsAtStart >= Math.max(1, c.amount);
    case 'lairFound':
      return c.target === '' ? Object.keys(state.lairs).length > 0
        : state.lairs[c.target as LairId] !== undefined;
    case 'lairDefeated':
      return Object.entries(state.lairs).some(([id, l]) =>
        (c.target === '' || id === c.target) && (l!.defeated || l!.cleared));
    case 'lairCleared':
      return Object.entries(state.lairs).some(([id, l]) =>
        (c.target === '' || id === c.target) && l!.cleared);
    case 'landmarkClaimed':
      return LANDMARKS.some((l) => state.landmarks.claimed[l.id] === true
        && (c.target === '' || l.id === c.target || l.kind === c.target));
    case 'landmarkSeen': {
      const l = LANDMARKS.find((x) => x.id === c.target);
      return l !== undefined && fogState(state, game.map, l.location) !== 'Undiscovered';
    }
    case 'bookOpen': return isTomeOpen(state, c.target as TomeId);
    case 'doorOpen': return isDoorOpen(state, c.target as DoorId);
    case 'manaEmpty': return mana(state) < 1;
    case 'buildersBusy': return state.city.queue.length >= buildQueueCapacity(state);
    case 'raided':
      return Object.values(state.lairs).some((l) => Object.values(l!.hoard).some((n) => (n ?? 0) > 0));
    case 'wounded': return woundedCount(state) > 0;
    case 'heroes': return state.heroes.owned.length >= Math.max(1, c.amount);
    case 'population': return state.city.population >= Math.max(1, c.amount);
    case 'revealed': return Object.keys(state.fog.revealed).length >= Math.max(1, c.amount);
    // A feature out of the dark: any cell carrying it, discovered or revealed.
    case 'featureSeen':
      return Object.entries(state.features).some(([key, id]) => id === c.target
        && (state.fog.discovered[key] === true || state.fog.revealed[key] === true));
    default: return false;
  }
}

/** Every lair id, so a bad target is caught by the data rules, not here. */
export const LAIR_IDS = Object.keys(LAIRS);
