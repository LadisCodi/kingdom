// AN ARMY FOR THE WORLD BOARD, on the lair attack's screen
// (Docs/features/19-world-map.md §4): the same boards, roster and hero slots,
// with where it is going and what covers it in the enemy's place.

import type { Game } from '../../game';
import { WORLD, WORLD_BUILD } from '../../sim/data/definitions';
import { hexAt, hexDistance } from '../../sim/world/hex';
import type { UnitId } from '../../sim/state';
import { el, formatCount, formatDuration } from '../format';
import { renderBattleSheet, type BattleView } from '../battleSheet';
import { unitBust } from '../unitArt';
import { seatName } from './dispatchSheet';

const VERB = { attack: 'Attack', claim: 'Claim', garrison: 'Garrison', delve: 'Delve', portal: 'Descend' } as const;

export function renderArmySheet(game: Game): HTMLElement {
  const target = game.armyTarget;
  if (target === null) return el('div');
  const source = game.worldSource();
  const h = source.hexOf(target);
  const steps = hexDistance(hexAt(game.homeHex()), hexAt(target));
  const preview = game.armyPreview();
  const march = formatDuration((steps * WORLD.marchSecondsPerHex * 1000) / 1000);
  const where = game.armyPurpose === 'garrison' ? `Your ${WORLD_BUILD.improvements.Fortress.name}`
    : game.armyPurpose === 'claim' ? 'Ground nobody holds'
      : game.armyPurpose === 'delve' ? 'A dungeon'
        : game.armyPurpose === 'portal' ? 'The Dark Portal' : `${seatName(game, h?.owner ?? null)} ground`;
  const view: BattleView = {
    title: `${where} · ${formatCount(steps)} ${steps === 1 ? 'hex' : 'hexes'}, ${march}`,
    enemy: {
      squads: [],
      power: preview.power,
      portrait: (unitId: UnitId) => unitBust(unitId, 'k-portrait-art'),
    },
    attack: preview.attack,
    enough: preview.attack >= preview.power,
    supplies: {},
    fallen: 0,
    actionLabel: VERB[game.armyPurpose],
    onFight: () => void game.doSendArmy(),
    blocked: game.armyBlockText(),
  };
  return renderBattleSheet(game, view);
}
