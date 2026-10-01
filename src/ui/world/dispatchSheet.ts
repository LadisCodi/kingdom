// THE DISPATCH SHEET — what a tapped world hex holds, and what can be done
// there (Docs/features/19-world-map.md §1.2, §3).
//
// The hexagon is the tap target; this sheet is where the action happens.
// Step 1 has one action, Explore. What the hex holds is told only as far as
// the player has seen it: a Revealed hex names its ground, a Sensed one is
// shapes in the mist, an Unknown one is nothing at all.

import type { Game } from '../../game';
import type { BoardHex } from '../../sim/world/board';
import {
  explorerSlots, fogStateOf, freeExplorers, marchMsPerHex, returnsAt, type FogState,
} from '../../sim/world/explorers';
import { hexAt, hexDistance } from '../../sim/world/hex';
import type { WorldFeature, WorldTerrain } from '../../sim/world/types';
import { el, formatCount, formatCountdown, formatDuration } from '../format';
import { action, sheet, stat } from '../kit';

const TERRAIN_NAME: Record<WorldTerrain, string> = {
  Grassland: 'Grassland', Plains: 'Plains', Desert: 'Desert', Mountain: 'Mountains',
};

const FEATURE_NAME: Record<WorldFeature, string> = {
  Forest: 'Forest', FertileLand: 'Fertile land', Game: 'Wild game',
  Dungeon: 'Dungeon', Sanctuary: 'Sanctuary', Landmark: 'Landmark',
};

const ROLE_NAME: Record<BoardHex['role'], string> = {
  portal: 'The centre', inner: 'The inner ring', corridor: 'A corridor',
  home: 'The home ring', outer: 'The outer ring',
};

const FOG_NAME: Record<FogState, string> = { Revealed: 'Revealed', Sensed: 'Sensed', Unknown: 'Unknown' };

/** What the sheet is called: who holds it, or what it is, or that nobody
 *  knows. */
export function hexTitle(game: Game, bh: BoardHex, fog: FogState): string {
  if (bh.role === 'portal') return 'The Dark Portal';
  const control = game.worldSource().controlOf(bh.index);
  if (control !== null && control.owner.you) return 'Your city';
  if (fog === 'Unknown') return 'Unknown ground';
  if (control !== null && !control.owner.you) return `${control.owner.name}'s city`;
  if (fog === 'Sensed') return 'Misty ground';
  const main = bh.features.find((f) => f !== 'FertileLand' && f !== 'Game');
  return main !== undefined ? FEATURE_NAME[main] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
}

export function renderDispatchSheet(game: Game): HTMLElement {
  const index = game.selectedHex;
  if (index === null) return el('div');
  const state = game.state;
  const now = game.now();
  const bh = game.worldSource().board().hexes[index];
  const fog = fogStateOf(state, index, now);
  const home = game.homeHex();
  const distance = hexDistance(hexAt(home), hexAt(index));
  const control = game.worldSource().controlOf(index);

  const lines: HTMLElement[] = [];
  const where = index === home
    ? 'Your province, seen from the world'
    : `${FOG_NAME[fog]} · ${ROLE_NAME[bh.role]} · ${formatCount(distance)} ${distance === 1 ? 'hex' : 'hexes'} away`;
  lines.push(el('p', { class: 'wd-where' }, where));

  if (bh.role === 'portal') {
    lines.push(el('p', { class: 'wd-line' }, 'Shut. Nobody holds it, and nobody ever will.'));
  } else if (control !== null && !control.owner.you && fog !== 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Another kingdom. A city can never be attacked.'));
  } else if (index !== home && fog === 'Revealed') {
    const holds = [TERRAIN_NAME[bh.terrain ?? 'Grassland'], ...bh.features.map((f) => FEATURE_NAME[f])];
    // Bare ground is already its own title; say what it holds only past that.
    if (holds.length > 1) lines.push(el('p', { class: 'wd-line' }, holds.join(' · ')));
  } else if (fog === 'Sensed') {
    lines.push(el('p', { class: 'wd-line' }, 'Shapes in the mist. Send an explorer to see what is there.'));
  } else if (fog === 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Nobody has been this way.'));
  }

  const body = el('div', { class: 'wd-body' }, ...lines);
  if (index !== home) {
    const slots = explorerSlots(state);
    const free = freeExplorers(state);
    const trip = (2 * distance * marchMsPerHex(state)) / 1000;
    let reason: string | undefined;
    if (slots === 0) reason = 'Research Cartography in the Atlas';
    else if (free === 0) {
      const back = Math.min(...state.world.explorers.map(returnsAt));
      reason = `Every explorer is out — one is back in ${formatCountdown(Math.max(0, back - now) / 1000)}`;
    }
    body.append(
      el('div', { class: 'wd-march' }, stat('compass', formatDuration(trip), 'there and back')),
      action({
        label: 'Explore', kind: 'primary', icon: 'compass',
        onClick: () => game.doSendExplorer(),
        disabledReason: reason,
        info: slots > 0 ? `Explorers ${formatCount(free)}/${formatCount(slots)}` : undefined,
      }),
    );
  }
  return sheet({ title: hexTitle(game, bh, fog), onClose: () => game.dismiss() }, body);
}

/** For the explorers chip: how many are out of how many. */
export const explorerCount = (game: Game): { out: number; slots: number } => ({
  out: game.state.world.explorers.length,
  slots: explorerSlots(game.state),
});
