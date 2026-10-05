// THE DISPATCH SHEET — what a tapped world hex holds, and what can be done
// there (Docs/features/19-world-map.md §1.2, §3).
//
// The hexagon is the tap target; this sheet is where the action happens:
// Explore, Claim, Build, Upgrade, Collect. What the hex holds is told only as
// far as the player has seen it: a Revealed hex names its ground and who
// holds it, a Sensed one is shapes in the mist, an Unknown one nothing.

import type { Game } from '../../game';
import { materialAt, type BoardHex } from '../../sim/world/board';
import {
  arrivesAt, exploreGold, exploreWorkMs, explorerRoute, explorerRushCost, explorerSlots, fogStateOf, freeExplorers,
  returnsAt, revealsAt, tripRevealing, type FogState,
} from '../../sim/world/explorers';
import type { ExplorerTrip } from '../../sim/state';
import { hexAt, hexDistance } from '../../sim/world/hex';
import { homeboundMs, outboundMs } from '../../sim/world/travel';
import type { WorldFeature, WorldTerrain } from '../../sim/world/types';
import { WORLD_BUILD, WORLD_CAMPS, WORLD_DUNGEON, WORLD_PORTAL } from '../../sim/data/definitions';
import { CAMP_CREATURE, DIFFICULTY_COLOR, campDifficulty, campShown, strongestParty } from '../../sim/world/camps';
import { floorPower, floorReward, nextRoom, roomPower } from '../../worldServer/core';
import { getWallet, type CurrencyId, type GoodId } from '../../sim/state';
import { getGood } from '../../sim/goods';
import { worldUpgradeGoods } from '../../sim/precious';
import { el, formatCount, formatCountdown, formatDuration } from '../format';
import { action, btn, progress, sheet, stat } from '../kit';
import { hexActions, hexWork, scoutWords, type HexAction } from './worldActions';
import { scoutPay } from '../../sim/world/scouting';
import { gemsToFinish } from '../../sim/rush';

const TERRAIN_NAME: Record<WorldTerrain, string> = {
  Grassland: 'Grassland', Plains: 'Plains', Desert: 'Desert',
};

const FEATURE_NAME: Record<WorldFeature, string> = {
  Forest: 'Forest', Mountain: 'Mountains', FertileLand: 'Fertile land', Game: 'Wild game',
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
  // A district, standing or going up, is what the hex is called.
  const held = game.worldSource().hexOf(bh.index);
  if (held !== null) return WORLD_BUILD.districts[held.district].name;
  const main = bh.features[0];
  return main !== undefined ? FEATURE_NAME[main] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
}

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
  const work = hexWork(h);
  if (!h.held) {
    lines.push(el('p', { class: 'wd-line' }, mine && work !== null && game.actingSeat === null
      ? `${whose}, being claimed`
      : `${whose}, being claimed · it stands in ${formatCountdown(Math.max(0, h.standsAt - now) / 1000)}`));
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
    return lines;
  }
  lines.push(el('p', { class: `wd-line${h.active ? '' : ' is-cut'}` },
    h.active ? whose : `${whose} — cut off from its city, it makes nothing`));
  if (h.fortress > 0) {
    lines.push(el('p', { class: 'wd-line' }, `${WORLD_BUILD.upgrades.Fortress.name} · level ${formatCount(h.fortress)}`));
  }
  // Burnt by raiders (19 §5.5): it makes nothing until it is repaired.
  if (h.burnt) {
    lines.push(el('p', { class: 'wd-line is-cut' }, 'Burnt by raiders — it makes nothing until it is repaired'));
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
  }
  // A camp beside it will raid it (19 §5.5).
  if (mine && !h.burnt && h.threat != null) {
    const creatures = h.threat.camps
      .map((c) => game.worldSource().board().hexes[c]?.camp?.creature)
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => CAMP_CREATURE[c]);
    const guard = h.garrison != null && h.garrison.owner === game.worldSeat() ? ' — your garrison will fight them' : '';
    lines.push(el('p', { class: 'wd-line is-cut' },
      `${creatures.join(' and ')} next door raid it in ${formatCountdown(Math.max(0, h.threat.nextRaidAt - now) / 1000)}${guard}`));
  }
  if (h.work !== null) {
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
    else lines.push(el('p', { class: 'wd-line' }, `Level ${formatCount(h.work.toLevel)} ready in ${formatCountdown(Math.max(0, h.work.at - now) / 1000)}`));
  }
  if (mine && h.stores !== null && h.stores.cap > 0) {
    lines.push(el('p', { class: 'wd-line' }, `${h.stores.currency} in store ${formatCount(Math.floor(h.stores.amount))}/${formatCount(Math.floor(h.stores.cap))}`));
  }
  if (mine && h.precious != null && h.precious.cap > 0) {
    lines.push(el('p', { class: 'wd-line' }, `${h.precious.id} in store ${formatCount(Math.floor(h.precious.amount))}/${formatCount(Math.floor(h.precious.cap))}`));
  }
  return lines;
}

const ARMY_VERB = { attack: 'Attack', claim: 'Claim', garrison: 'Garrison', delve: 'Delve', portal: 'Descend', clear: 'Attack' } as const;
const ARMY_INFO = {
  attack: 'Send an army', claim: 'Send an army to take it', garrison: 'Station an army here',
  delve: 'An army camps here and fights room by room',
  portal: 'An army goes down, a floor at a time',
  clear: 'Beat the camp, and take its loot',
} as const;

/** A camp: whose, how strong, and how hard against the player's best party. */
function campLines(game: Game, bh: BoardHex, fog: FogState): HTMLElement[] {
  if (!campShown(game.worldSource(), bh, fog) || bh.camp === null) return [];
  const difficulty = campDifficulty(bh.camp.power, strongestParty(game.state));
  const lines = [el('p', { class: 'wd-line' },
    `A camp of ${CAMP_CREATURE[bh.camp.creature]} · Power ${formatCount(bh.camp.power)} · `,
    el('b', { style: `color: ${DIFFICULTY_COLOR[difficulty]}` }, difficulty))];
  // Which of the player's districts it will raid (19 §5.5).
  const source = game.worldSource();
  const raided = source.board().hexes
    .map((h) => source.hexOf(h.index))
    .filter((h): h is NonNullable<typeof h> => h !== null && h.threat != null && h.threat.camps.includes(bh.index) && !h.burnt);
  if (raided.length > 0) {
    lines.push(el('p', { class: 'wd-line is-cut' },
      `It raids ${raided.length === 1 ? `your ${WORLD_BUILD.districts[raided[0].district].name}` : `${formatCount(raided.length)} of your districts`} every ${formatCount(WORLD_CAMPS.raidHours)} hours`));
  }
  return lines;
}

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
          info: `${WORLD_BUILD.districts[a.district].name} · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doClaimHex(bh.index, asRival ? 0 : a.gold),
        });
      case 'repair':
        return action({
          label: 'Repair', kind: 'primary', cost: { Gold: a.gold }, have,
          info: `The raiders' damage · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doRepairHex(bh.index, asRival ? 0 : a.gold),
        });
      case 'upgrade':
        return action({
          label: a.level === 1 ? 'Build' : 'Upgrade', kind: 'secondary',
          cost: { Gold: a.gold }, have,
          // Its precious materials, beside the Gold (19 §7.6).
          costExtra: asRival ? [] : Object.entries(worldUpgradeGoods(game.state, a.upgrade, a.level)).map(([g, n]) => ({
            icon: g as GoodId, amount: formatCount(n as number),
            short: getGood(game.state.city.goods, g as GoodId) < (n as number),
          })),
          info: `${WORLD_BUILD.upgrades[a.upgrade].name}${a.level > 1 ? ` level ${formatCount(a.level)}` : ''} · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doUpgradeHex(bh.index, a.upgrade, a.level, asRival ? 0 : a.gold),
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
          info: `Floor ${formatCount(floor)} · ${formatCount(floorPower(floor))} power${
            floorReward(floor).precious > 0 ? ` · pays ${formatCount(floorReward(floor).precious)} precious material` : ''}`,
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
      case 'tribute':
        return action({
          label: 'Pay off', kind: 'secondary', cost: a.cost, have,
          info: 'The camp leaves, and pays nothing',
          onClick: () => void game.doTributeCamp(bh.index),
        });
      case 'openDelve':
        return action({
          label: 'Delve', kind: 'primary', info: 'The descent, its rooms and what they pay',
          onClick: () => game.openDelve(bh.index),
        });
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
    // A rich hex: what its district will yield besides (19 §7.4).
    const material = bh.rich ? materialAt(game.worldSource().board(), index) : null;
    if (material !== null) lines.push(el('p', { class: 'wd-line' }, `Rich in ${material}`));
  } else if (fog === 'Sensed') {
    lines.push(el('p', { class: 'wd-line' }, 'Shapes in the mist. Explore it before anything can be done there.'));
    // What an explorer sent here brings home (19 §3.2), priced as of now.
    if (bh.scout !== null) {
      lines.push(el('p', { class: 'wd-line' }, `Exploring it pays ${scoutWords(scoutPay(state, bh.scout, bh.role, index))}`));
    }
  } else if (fog === 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Nobody has been this way.'));
  }

  lines.push(...controlLines(game, bh, fog), ...campLines(game, bh, fog), ...dungeonLines(game, bh), ...portalLines(game, bh));
  if (game.actingSeat !== null) {
    lines.push(el('p', { class: 'wd-where' }, `Dev — playing for ${seatName(game, game.actingSeat)} kingdom`));
  }
  const body = el('div', { class: 'wd-body' }, ...lines, ...actionRows(game, bh));
  // A trip that will reveal the hex: how far along it is, and the Gems that
  // finish it. While one is out, Explore is not offered there again.
  const trip = game.actingSeat === null ? tripRevealing(state, index) : null;
  if (trip !== null && (fog !== 'Revealed' || trip.target === index)) body.append(tripRow(game, trip));
  // Explore is offered only on ground not yet explored, and nobody is out to.
  if (index !== home && fog !== 'Revealed' && trip === null && game.actingSeat === null) {
    const slots = explorerSlots(state);
    const free = freeExplorers(state);
    const route = explorerRoute(state, index, now);
    const work = exploreWorkMs(state, index) / 1000;
    const trip = route === null ? 0 : (outboundMs(route.stepMs) + homeboundMs(route.stepMs)) / 1000 + work;
    let reason: string | undefined;
    if (slots === 0) reason = 'Research Cartography in the Atlas';
    else if (route === null) reason = 'No way there through explored ground';
    else if (free === 0) {
      const back = Math.min(...state.world.explorers.map(returnsAt));
      reason = `Every explorer is out — one is back in ${formatCountdown(Math.max(0, back - now) / 1000)}`;
    }
    body.append(
      ...(route === null ? [] : [el('div', { class: 'wd-march' },
        stat('compass', formatDuration(trip), 'there and back'),
        stat('hourglass', formatDuration(work), 'to explore'))]),
      action({
        label: 'Explore', kind: 'primary', icon: 'compass',
        cost: { Gold: exploreGold(state, index) }, have: (c: CurrencyId) => getWallet(state.city.wallet, c),
        onClick: () => game.doSendExplorer(),
        disabledReason: reason,
        info: slots > 0 ? `Explorers ${formatCount(free)}/${formatCount(slots)}` : undefined,
      }),
    );
  }
  return sheet({ title: hexTitle(game, bh, fog), onClose: () => game.dismiss() }, body);
}

/**
 * A WAIT THE PLAYER CAN BUY, as the training line draws a batch: what is
 * happening over the bar, the bar from start to end with the time left
 * inside it, the whole wait under it, and the Gems button that finishes it
 * (sim/rush.ts prices it).
 */
function waitRow(
  game: Game, what: string, startedAt: number, endsAt: number, gems: number, onFinish: () => void,
): HTMLElement {
  const now = game.now();
  const total = endsAt - startedAt;
  const left = Math.max(0, endsAt - now);
  const bar = progress('green');
  bar.run(total <= 0 ? 1 : 1 - left / total, left, formatDuration(Math.ceil(left / 1000)));
  return el('div', { class: 'tr-batch-row wd-trip' },
    el('div', { class: 'tr-batch-progress' },
      el('span', { class: 'tr-batch-what' }, what),
      bar.root,
      el('span', { class: 'tr-batch-total' }, `Total time: ${formatDuration(Math.ceil(total / 1000))}`)),
    btn({
      label: 'Finish',
      kind: 'gem',
      onClick: onFinish,
      cost: { Gems: gems },
      have: (c) => game.walletValue(c),
    }));
}

/** An explorer's trip: there, the work, and home. */
function tripRow(game: Game, trip: ExplorerTrip): HTMLElement {
  const now = game.now();
  const doing = now < arrivesAt(trip) ? 'On the way'
    : now < revealsAt(trip) ? 'Exploring'
      : 'Coming home';
  return waitRow(game, doing, trip.departedAt, returnsAt(trip), explorerRushCost(trip, now),
    () => game.doFinishExplorer(trip.id));
}

/** A builder's work on one of the player's hexes: its district, or an upgrade's level. */
function hexWorkRow(game: Game, index: number, work: NonNullable<ReturnType<typeof hexWork>>): HTMLElement {
  return waitRow(game, work.what, work.startedAt, work.endsAt, gemsToFinish((work.endsAt - game.now()) / 1000),
    () => void game.doFinishHexWork(index));
}

/** For the explorers chip: how many are out of how many. */
export const explorerCount = (game: Game): { out: number; slots: number } => ({
  out: game.state.world.explorers.length,
  slots: explorerSlots(game.state),
});
