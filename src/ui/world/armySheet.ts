// AN ARMY FOR THE WORLD BOARD, on the lair attack's screen
// (Docs/features/19-world-map.md §4): the same boards, roster and hero slots,
// with where it is going and what covers it in the enemy's place.

import type { Game } from '../../game';
import { WORLD_BUILD } from '../../sim/data/definitions';
import { CAMP_CREATURE, campSquads } from '../../sim/world/camps';
import { creatureFace } from '../lairSheet';
import { sendFights } from '../../sim/world/fights';
import { outboundMs } from '../../sim/world/travel';
import { hexAt, hexDistance } from '../../sim/world/hex';
import type { UnitId } from '../../sim/state';
import { el, formatCount, formatDuration } from '../format';
import { renderBattleSheet, type BattleView } from '../battleSheet';
import { unitBust } from '../unitArt';
import { seatName } from './dispatchSheet';

const VERB = { attack: 'Attack', claim: 'Claim', garrison: 'Garrison', delve: 'Delve', portal: 'Descend', clear: 'Attack' } as const;

/** Whose camp stands on a hex: its creature's lair's name. */
const campName = (game: Game, index: number): string => {
  const camp = game.worldSource().board().hexes[index]?.camp;
  return camp ? CAMP_CREATURE[camp.creature] : 'monsters';
};

export function renderArmySheet(game: Game): HTMLElement {
  const target = game.armyTarget;
  if (target === null) return el('div');
  const source = game.worldSource();
  const h = source.hexOf(target);
  const route = game.armyRoute(target);
  const steps = route === null ? hexDistance(hexAt(game.homeHex()), hexAt(target)) : route.path.length - 1;
  const preview = game.armyPreview();
  const camp = source.board().hexes[target]?.camp;
  const march = route === null ? 'no way there' : formatDuration(outboundMs(route.stepMs) / 1000);
  const where = game.armyPurpose === 'garrison' ? `Your ${WORLD_BUILD.upgrades.Fortress.name}`
    : game.armyPurpose === 'claim' ? 'Ground nobody holds'
      : game.armyPurpose === 'delve' ? 'A dungeon'
        : game.armyPurpose === 'portal' ? 'The Dark Portal'
          : game.armyPurpose === 'clear' ? `A camp of ${campName(game, target)}`
            : `${seatName(game, h?.owner ?? null)} ground`;
  const view: BattleView = {
    title: `${where} · ${formatCount(steps)} ${steps === 1 ? 'hex' : 'hexes'}, ${march}`,
    enemy: {
      // A camp's army is seeded by its hex, so it is shown before the fight.
      squads: game.armyPurpose === 'clear' && camp != null ? campSquads(source.board().seed, target, camp) : [],
      power: preview.power,
      portrait: (unitId: UnitId) => (game.armyPurpose === 'clear' ? creatureFace(unitId) : unitBust(unitId, 'k-portrait-art')),
    },
    attack: preview.attack,
    enough: preview.attack >= preview.power,
    // A fight is paid in Mana (19 §4).
    supplies: sendFights(game.armyPurpose) ? { Mana: game.fightMana() } : {},
    fallen: 0,
    actionLabel: VERB[game.armyPurpose],
    onFight: () => void game.doSendArmy(),
    blocked: game.armyBlockText(),
  };
  return renderBattleSheet(game, view);
}
