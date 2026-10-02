// THE DISPATCH SHEET — what a tapped world hex holds, and what can be done
// there (Docs/features/19-world-map.md §1.2, §3).
//
// The hexagon is the tap target; this sheet is where the action happens:
// Explore, Claim, Build, Upgrade, Collect. What the hex holds is told only as
// far as the player has seen it: a Revealed hex names its ground and who
// holds it, a Sensed one is shapes in the mist, an Unknown one nothing.

import type { Game } from '../../game';
import type { BoardHex } from '../../sim/world/board';
import {
  explorerSlots, fogStateOf, freeExplorers, marchMsPerHex, returnsAt, type FogState,
} from '../../sim/world/explorers';
import { hexAt, hexDistance } from '../../sim/world/hex';
import type { WorldFeature, WorldTerrain } from '../../sim/world/types';
import { WORLD_BUILD, WORLD_DUNGEON, WORLD_PORTAL } from '../../sim/data/definitions';
import { floorPower, nextRoom, roomPower } from '../../worldServer/core';
import { getWallet, type CurrencyId } from '../../sim/state';
import { el, formatCount, formatCountdown, formatDuration } from '../format';
import { action, sheet, stat } from '../kit';
import { hexActions, type HexAction } from './worldActions';

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

/** What the sheet is called: whose city, what stands there, what it is,
 *  or that nobody knows. */
export function hexTitle(game: Game, bh: BoardHex, fog: FogState): string {
  if (bh.role === 'portal') return 'The Dark Portal';
  const control = game.worldSource().controlOf(bh.index);
  if (bh.seat !== null && control?.owner.you) return 'Your city';
  if (fog === 'Unknown') return 'Unknown ground';
  if (bh.seat !== null && control !== null && !control.owner.you) return `${control.owner.name}'s city`;
  if (fog === 'Sensed') return 'Misty ground';
  const standing = game.worldSource().hexOf(bh.index)?.improvement;
  if (standing) return WORLD_BUILD.improvements[standing.kind].name;
  const main = bh.features.find((f) => f !== 'FertileLand' && f !== 'Game');
  return main !== undefined ? FEATURE_NAME[main] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
}

const MATERIAL_OF: Record<string, string> = { Wood: 'Wood', Food: 'Food', Stone: 'Stone' };

/** "Your" or "Lady Maren's". */
export function seatName(game: Game, seat: number | null): string {
  if (seat === null) return 'Nobody’s';
  const s = game.worldSource().seats()[seat];
  return s === undefined || s.owner.you ? 'Your' : `${s.owner.name}'s`;
}

/** Who holds a hex and how it stands, for the lines under the title. */
function controlLines(game: Game, bh: BoardHex, fog: FogState): HTMLElement[] {
  if (bh.seat !== null || fog === 'Unknown') return [];
  const source = game.worldSource();
  const h = source.hexOf(bh.index);
  if (h === null) return [];
  const now = game.now();
  const mine = h.owner === game.worldSeat();
  const lines: HTMLElement[] = [];
  const whose = `${seatName(game, h.owner)} ground`;
  if (!h.held) {
    lines.push(el('p', { class: 'wd-line' }, `${whose}, being claimed · the Outpost stands in ${formatCountdown(Math.max(0, h.outpostAt - now) / 1000)}`));
    return lines;
  }
  lines.push(el('p', { class: `wd-line${h.active ? '' : ' is-cut'}` },
    h.active ? whose : `${whose} — cut off from its city, it makes nothing`));
  if (h.improvement !== null) {
    lines.push(el('p', { class: 'wd-line' }, `${WORLD_BUILD.improvements[h.improvement.kind].name} · level ${formatCount(h.improvement.level)}`));
  }
  if (h.work !== null) {
    lines.push(el('p', { class: 'wd-line' }, `Level ${formatCount(h.work.toLevel)} ready in ${formatCountdown(Math.max(0, h.work.at - now) / 1000)}`));
  }
  if (mine && h.stores !== null) {
    const produces = h.improvement === null ? '' : WORLD_BUILD.improvements[h.improvement.kind].produces;
    if (produces !== '' && h.stores.materialCap > 0) {
      lines.push(el('p', { class: 'wd-line' }, `${MATERIAL_OF[produces]} in store ${formatCount(Math.floor(h.stores.material))}/${formatCount(Math.floor(h.stores.materialCap))}`));
    }
    if (h.stores.knowledgeCap > 0) {
      lines.push(el('p', { class: 'wd-line' }, `Knowledge in store ${formatCount(Math.floor(h.stores.knowledge))}/${formatCount(h.stores.knowledgeCap)}`));
    }
  }
  return lines;
}

const ARMY_VERB = { attack: 'Attack', claim: 'Claim', garrison: 'Garrison', delve: 'Delve', portal: 'Descend' } as const;
const ARMY_INFO = {
  attack: 'Send an army', claim: 'Send an army to take it', garrison: 'Station an army here',
  delve: 'An army camps here and fights room by room',
  portal: 'An army goes down, a floor at a time',
} as const;

/** The Portal: shut with its countdown, or open with the player's floor,
 *  the clears left today and the ranking. */
function portalLines(game: Game, bh: BoardHex): HTMLElement[] {
  if (bh.role !== 'portal') return [];
  const p = game.worldSource().portal();
  if (p === null) return [];
  const now = game.now();
  if (!p.open) return [el('p', { class: 'wd-line' }, `Shut · opens in ${formatCountdown(Math.max(0, p.opensAt - now) / 1000)}`)];
  const lines = [
    el('p', { class: 'wd-line' }, `Open · closes in ${formatCountdown(Math.max(0, p.closesAt - now) / 1000)}`),
    el('p', { class: 'wd-line' }, `Your floor ${formatCount(p.floor)} of ${formatCount(WORLD_PORTAL.floors)} · ${formatCount(p.attemptsLeft)} ${p.attemptsLeft === 1 ? 'clear' : 'clears'} left today`),
  ];
  p.ranking.slice(0, 6).forEach((r, i) => {
    lines.push(el('p', { class: 'wd-where' }, `${formatCount(i + 1)}. ${seatName(game, r.seat).replace(/'s$/, '')} — floor ${formatCount(r.floor)}`));
  });
  return lines;
}

/** How far the player has gone in a dungeon. */
function dungeonLines(game: Game, bh: BoardHex): HTMLElement[] {
  if (!bh.features.includes('Dungeon')) return [];
  const cleared = game.worldSource().delved(bh.index);
  const room = nextRoom(cleared);
  const per = WORLD_DUNGEON.roomsPerDepth;
  return [el('p', { class: 'wd-line' }, room === null
    ? 'Cleared to the bottom'
    : `Depth ${formatCount(room.depth + 1)} of ${formatCount(WORLD_DUNGEON.depths)} · Room ${formatCount(room.room)} of ${formatCount(per)}`)];
}

/** One button per thing the acting seat can do here. */
function actionRows(game: Game, bh: BoardHex): HTMLElement[] {
  const seat = game.worldSeat();
  const asRival = game.actingSeat !== null;
  const have = (c: CurrencyId) => (asRival ? Infinity : getWallet(game.state.city.wallet, c));
  // Playing a rival's part, the player's own fog does not bind that seat.
  const revealed = asRival || fogStateOf(game.state, bh.index, game.now()) === 'Revealed';
  return hexActions(game.worldSource(), seat, bh, { revealed }).map((a: HexAction) => {
    switch (a.kind) {
      case 'claim':
        return action({
          label: 'Claim', kind: 'primary', cost: { Gold: a.gold }, have,
          info: `An Outpost · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doClaimHex(bh.index, asRival ? 0 : a.gold),
        });
      case 'build':
        return action({
          label: a.level === 1 ? 'Build' : 'Upgrade', kind: a.level === 1 ? 'primary' : 'secondary',
          cost: { Gold: a.gold }, have,
          info: `${WORLD_BUILD.improvements[a.improvement].name}${a.level > 1 ? ` level ${formatCount(a.level)}` : ''} · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doBuildHex(bh.index, a.improvement, a.level, asRival ? 0 : a.gold),
        });
      case 'army':
        return action({
          label: ARMY_VERB[a.purpose], kind: a.purpose === 'attack' ? 'destructive' : 'primary',
          info: ARMY_INFO[a.purpose],
          onClick: () => game.openArmy(bh.index, a.purpose),
        });
      case 'descend': {
        const p = game.worldSource().portal();
        const floor = (p?.floor ?? 0) + 1;
        return action({
          label: 'Descend', kind: 'destructive',
          info: `Floor ${formatCount(floor)} · ${formatCount(floorPower(floor))} power`,
          disabledReason: p === null || !p.open ? 'The Portal is shut'
            : p.attemptsLeft === 0 ? 'No clears left today' : floor > WORLD_PORTAL.floors ? 'At the bottom' : undefined,
          onClick: () => void game.doDescendPortal(a.army),
        });
      }
      case 'delve': {
        const cleared = game.worldSource().delved(bh.index);
        const room = nextRoom(cleared);
        return action({
          label: 'Attack', kind: 'destructive',
          info: room === null ? 'Cleared to the bottom'
            : `${room.boss ? 'The boss' : `Room ${formatCount(room.room)}`} · ${formatCount(roomPower(room.depth, room.room))} power`,
          disabledReason: room === null ? 'Cleared to the bottom' : undefined,
          onClick: () => void game.doDelveRoom(a.army),
        });
      }
      case 'recall':
        return action({
          label: 'Recall', kind: 'secondary', info: 'The garrison marches home',
          onClick: () => void game.doRecallArmy(a.army),
        });
      case 'collect':
        return action({
          label: 'Collect', kind: 'gold',
          disabledReason: a.ready ? undefined : 'Nothing to collect yet',
          onClick: () => void game.doCollectHex(bh.index),
        });
    }
  });
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
    lines.push(el('p', { class: 'wd-line' }, 'Nobody holds it, and nobody ever will.'));
  } else if (control !== null && !control.owner.you && fog !== 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Another kingdom. A city can never be attacked.'));
  } else if (index !== home && fog === 'Revealed') {
    const holds = [TERRAIN_NAME[bh.terrain ?? 'Grassland'], ...bh.features.map((f) => FEATURE_NAME[f])];
    // Bare ground is already its own title; say what it holds only past that.
    if (holds.length > 1) lines.push(el('p', { class: 'wd-line' }, holds.join(' · ')));
  } else if (fog === 'Sensed') {
    lines.push(el('p', { class: 'wd-line' }, 'Shapes in the mist. Explore it before anything can be done there.'));
  } else if (fog === 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Nobody has been this way.'));
  }

  lines.push(...controlLines(game, bh, fog), ...dungeonLines(game, bh), ...portalLines(game, bh));
  if (game.actingSeat !== null) {
    lines.push(el('p', { class: 'wd-where' }, `Dev — playing for ${seatName(game, game.actingSeat)} kingdom`));
  }
  const body = el('div', { class: 'wd-body' }, ...lines, ...actionRows(game, bh));
  if (index !== home && game.actingSeat === null) {
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
