// AN ARMY FOR THE WORLD BOARD, on the lair attack's screen
// (Docs/features/19-world-map.md §4): the same boards, roster and hero slots,
// with where it is going and what covers it in the enemy's place.

import type { Game } from '../../game';
import { WORLD_BUILD } from '../../sim/data/definitions';
import { campSquads } from '../../sim/world/camps';
import { creatureFace } from '../lairSheet';
import { lootWidget, terrainWidget } from './hexCard';
import { CAMP_TITLE, CREATURE_NAME, seatGround } from './hexNames';
import { tr, trn } from '../../i18n/tr';
import { campLoot, sendFights } from '../../sim/world/fights';
import { outboundMs } from '../../sim/world/travel';
import { hexAt, hexDistance } from '../../sim/world/hex';
import type { TroopId } from '../../sim/state';
import { el, formatCount, formatDuration } from '../format';
import { renderBattleSheet, type BattleView } from '../battleSheet';
import { unitBust } from '../unitArt';

const VERB = { attack: tr('Attack'), claim: tr('Claim'), garrison: tr('Garrison'), delve: tr('Delve'), portal: tr('Descend'), clear: tr('March') } as const;

/** Whose camp stands on a hex: its creature's lair's name. */
const campName = (game: Game, index: number): string => {
  const camp = game.worldSource().board().hexes[index]?.camp;
  return camp ? CREATURE_NAME[camp.creature] : tr('monsters');
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
  const march = route === null ? tr('no way there') : formatDuration(outboundMs(route.stepMs) / 1000);
  const where = game.armyPurpose === 'garrison' ? tr('Your {name}', { name: WORLD_BUILD.upgrades.Fortress.name })
    : game.armyPurpose === 'claim' ? tr('Ground nobody holds')
      : game.armyPurpose === 'delve' ? tr('A dungeon')
        : game.armyPurpose === 'portal' ? tr('The Dark Portal')
          : game.armyPurpose === 'clear' ? (camp != null ? CAMP_TITLE[camp.creature] : tr('A camp of {who}', { who: campName(game, target) }))
            : seatGround(game, h?.owner ?? null);
  // Under the boards: what the fight pays, and the ground it is fought on
  // with the march there (Docs/proposals/world-menus.md §3.5). A dungeon's
  // rooms and the Portal's floors are fought below ground: no terrain.
  const bh = source.board().hexes[target];
  const below = game.armyPurpose === 'delve' || game.armyPurpose === 'portal';
  const loot = game.armyPurpose === 'clear' && camp != null ? lootWidget(campLoot(game.state, camp.power)) : null;
  const widgets = [
    ...(loot === null ? [] : [loot]),
    ...(below || bh === undefined ? [] : [terrainWidget(bh, `${trn(steps, '{n} hex', '{n} hexes', { n: formatCount(steps) })} · ${march}`)]),
  ];
  const view: BattleView = {
    // The target alone: the route is the terrain widget's.
    title: where,
    widgets,
    enemy: {
      // A camp's army is seeded by its hex, so it is shown before the fight.
      squads: game.armyPurpose === 'clear' && camp != null ? campSquads(source.board().seed, target, camp) : [],
      power: preview.power,
      portrait: (unitId: TroopId) => (game.armyPurpose === 'clear' ? creatureFace(unitId) : unitBust(unitId, 'k-portrait-art')),
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
