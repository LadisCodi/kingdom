// The lair, on the attack screen (Docs/proposals/lairs.md §6).
//
// The boards, the roster and the action box are `battleSheet.ts` — every
// fight in the game uses them. What a lair adds is its creatures: the enemy's
// squads wear the lair's faces rather than the player's own soldiers, one
// creature per troop type, whatever lair they stand in.

import { LAIRS } from '../sim/data/definitions';
import type { Game } from '../game';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { UNIT_CREATURE_AVATAR } from '../render/lairMap';
import { unitOf } from '../sim/data/definitions';
import type { TroopId } from '../sim/state';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { unitBust } from './unitArt';
import { tr } from '../i18n/tr';

/** An enemy squad's face: the creature its UNIT is, whatever its rank — the
 *  rank rides on the coin the frame wears (unitArt.ts `portraitFrame`). */
export const creatureFace = (unitId: TroopId): HTMLElement => {
  const url = spriteUrl(UNIT_CREATURE_AVATAR[unitOf(unitId)]);
  return url ? spriteImgAt(url, 'k-portrait-art') : unitBust(unitId, 'k-portrait-art');
};

export function renderLairSheet(game: Game): HTMLElement {
  const lairId = game.lairId!;
  const preview = game.lairPreview()!;
  const view: BattleView = {
    title: LAIRS[lairId].name,
    enemy: { squads: preview.enemy, power: preview.power, portrait: creatureFace },
    attack: preview.attack,
    enough: preview.enough,
    supplies: preview.supplies,
    fallen: preview.fallen,
    actionLabel: tr('Attack'),
    onFight: () => game.doAttackLair(),
    blocked: game.lairBlockText(),
  };
  return renderBattleSheet(game, view);
}
