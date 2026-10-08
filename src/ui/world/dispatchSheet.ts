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
  exploreGold, exploreWorkMs, explorerRoute, explorerRushCost, explorerSlots, firstTripFree, fogStateOf, freeExplorers,
  nextFreeAt, readyAt, returnsAt, tripPhase, tripRevealing, type FogState,
} from '../../sim/world/explorers';
import type { ExplorerTrip } from '../../sim/state';
import { hexAt, hexDistance } from '../../sim/world/hex';
import { homeboundMs, outboundMs } from '../../sim/world/travel';
import { depositMaterial } from '../../sim/world/types';
import { ARTIFACTS, WORLD_BUILD, WORLD_DUNGEON, WORLD_GEN, WORLD_PORTAL } from '../../sim/data/definitions';
import { CAMP_CREATURE, DIFFICULTY_COLOR, campDifficulty, campShown, strongestParty } from '../../sim/world/camps';
import { floorPower, floorReward, nextRoom, roomPower } from '../../worldServer/core';
import { getWallet, type CurrencyId, type GoodId } from '../../sim/state';
import { getGood } from '../../sim/goods';
import { worldUpgradeGoods } from '../../sim/precious';
import { coach, el, formatCount, formatCountdown, formatDuration, formatExact } from '../format';
import { action, btn, chip, powerTag, progress, sheet, stat } from '../kit';
import { timerButton } from '../speedupSheet';
import type { SpeedJob } from '../../sim/speedups';
import { explorersOutLine, hexActions, hexWork, scoutWords, type HexAction } from './worldActions';
import { scoutPay } from '../../sim/world/scouting';
import { campLoot } from '../../sim/world/fights';
import { districtOf } from '../../worldServer/core';
import {
  renderCamp, renderCity, renderDungeon, renderFog, renderFreeGround, renderOwnDistrict, renderPortal,
} from './hexCard';
import { FEATURE_NAME, FOG_NAME, ROLE_NAME, TERRAIN_NAME, hexTitle, seatName } from './hexNames';

export { hexTitle, seatName };
import { gemsToFinish } from '../../sim/rush';

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
  const work = hexWork(h, game.worldBoost());
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
  // A Chapel's relic is seen by every player (relic-restoration.md §5.3).
  if (h.chapel === true) {
    lines.push(el('p', { class: 'wd-line' }, h.relic != null
      ? `${WORLD_BUILD.upgrades.Chapel.name} · ${ARTIFACTS[h.relic.id].name}, level ${formatCount(h.relic.level)}`
      : `${WORLD_BUILD.upgrades.Chapel.name} · empty`));
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
    `A camp of ${CAMP_CREATURE[bh.camp.creature]} · `, powerTag(bh.camp.power), ' · ',
    el('b', { style: `color: ${DIFFICULTY_COLOR[difficulty]}` }, difficulty))];
  // What beating it pays, so the fight is worth weighing (19 §5.4).
  lines.push(el('p', { class: 'wd-line' }, 'Beaten, it pays ',
    ...(Object.entries(campLoot(game.state, bh.camp.power)) as Array<[CurrencyId, number]>)
      .filter(([, n]) => n > 0).map(([c, n]) => chip(c, n))));
  // Which of the player's districts it will raid (19 §5.5).
  const source = game.worldSource();
  const raided = source.board().hexes
    .map((h) => source.hexOf(h.index))
    .filter((h): h is NonNullable<typeof h> => h !== null && h.threat != null && h.threat.camps.includes(bh.index) && !h.burnt);
  // One raid at a time, so it is never more than one district.
  const target = raided[0];
  if (target !== undefined) {
    lines.push(el('p', { class: 'wd-line is-cut' },
      `It raids your ${WORLD_BUILD.districts[target.district].name} in ${formatCountdown(Math.max(0, target.threat!.nextRaidAt - game.now()) / 1000)} — beat it first and the raid is off`));
  }
  return lines;
}

/** The Portal: shut with its countdown, or open with the player's floor
 *  and the ranking. */
function portalLines(game: Game, bh: BoardHex): HTMLElement[] {
  if (bh.role !== 'portal') return [];
  const p = game.worldSource().portal();
  if (p === null) return [];
  const now = game.now();
  if (!p.open) return [el('p', { class: 'wd-line' }, `Shut · opens in ${formatCountdown(Math.max(0, p.opensAt - now) / 1000)}`)];
  const lines = [
    el('p', { class: 'wd-line' }, `Open · closes in ${formatCountdown(Math.max(0, p.closesAt - now) / 1000)}`),
    el('p', { class: 'wd-line' }, `Your floor ${formatCount(p.floor)} of ${formatCount(WORLD_PORTAL.floors)}`),
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
  const revealed = asRival || fogStateOf(game.state, bh.index) === 'Revealed';
  const relics = asRival ? [] : game.worldRelicsRestored();
  return hexActions(game.worldSource(), seat, bh, { revealed }, relics, game.worldBoost()).map((a: HexAction) => {
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
          disabledReason: a.blocked,
          onClick: () => void game.doUpgradeHex(bh.index, a.upgrade, a.level, asRival ? 0 : a.gold),
        });
      case 'host':
        return action({
          label: 'Host', kind: 'primary',
          info: `${ARTIFACTS[a.relic].name}, level ${formatCount(game.relicLevel(a.relic))}`,
          onClick: () => void game.doHostWorldRelic(a.relic, bh.index),
        });
      case 'unhost':
        return action({
          label: 'Remove', kind: 'secondary', info: `${ARTIFACTS[a.relic].name} goes back to your Bag`,
          onClick: () => void game.doUnhostWorldRelic(a.relic),
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
          label: 'Descend', kind: 'destructive', cost: { Mana: game.fightMana() }, have,
          info: el('span', {}, `Floor ${formatCount(floor)} · `, powerTag(floorPower(floor)),
            floorReward(floor).precious > 0 ? ` · pays ${formatCount(floorReward(floor).precious)} precious material` : ''),
          disabledReason: p === null || !p.open ? 'The Portal is shut'
            : floor > WORLD_PORTAL.floors ? 'At the bottom' : undefined,
          onClick: () => void game.doDescendPortal(a.army),
        });
      }
      case 'delve': {
        const cleared = game.worldSource().delved(bh.index);
        const room = nextRoom(cleared);
        return action({
          label: 'Attack', kind: 'destructive', cost: { Mana: game.fightMana() }, have,
          info: room === null ? 'Cleared to the bottom'
            : el('span', {}, `${room.boss ? 'The boss' : `Room ${formatCount(room.room)}`} · `, powerTag(roomPower(room.depth, room.room))),
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
  const fog = fogStateOf(state, index);
  const home = game.homeHex();
  const distance = hexDistance(hexAt(home), hexAt(index));
  const control = game.worldSource().controlOf(index);

  // The redesigned cards (Docs/proposals/world-menus.md §3.2, §3.3): free
  // ground the player has seen, and the player's own district.
  // A city — the player's, or a rival's once it is revealed (§3.7).
  if (game.actingSeat === null && bh.seat !== null && (index === home || fog === 'Revealed')) return renderCity(game, bh);
  // A dungeon (§3.8): its ground does nothing to it.
  if (game.actingSeat === null && bh.features.includes('Dungeon') && fog === 'Revealed') return renderDungeon(game, bh);
  // The Dark Portal (§3.6).
  if (game.actingSeat === null && bh.role === 'portal') return renderPortal(game, bh);
  // Ground in the mist (§3.1): exploring it is all there is to do.
  if (game.actingSeat === null && index !== home && fog !== 'Revealed') {
    const trip = tripRevealing(state, index);
    return renderFog(game, bh, fog, hexTitle(game, bh, fog), trip === null ? null : tripRow(game, trip));
  }
  if (game.actingSeat === null && bh.seat === null) {
    const held = game.worldSource().hexOf(index);
    if (held !== null && held.owner === game.worldSeat()) return renderOwnDistrict(game, bh, held, ownStatus(game, index, held));
    const unguarded = bh.camp === null || game.worldSource().campBeaten(index);
    // A camp that stands between the player and the ground (§3.4).
    if (held === null && !unguarded && fog === 'Revealed') return renderCamp(game, bh);
    if (held === null && fog === 'Revealed' && unguarded && districtOf(bh) !== null) {
      const claim = hexActions(game.worldSource(), game.worldSeat(), bh, { revealed: true }, [], game.worldBoost()).find((a) => a.kind === 'claim');
      return renderFreeGround(game, bh, hexTitle(game, bh, fog), claim === undefined ? 'Build beside ground you hold' : undefined);
    }
  }

  const lines: HTMLElement[] = [];
  const where = index === home
    ? 'Your province, seen from the world'
    : `${FOG_NAME[fog]} · ${ROLE_NAME[bh.role]} · ${formatCount(distance)} ${distance === 1 ? 'hex' : 'hexes'} away`;
  lines.push(el('p', { class: 'wd-where' }, where));
  // At home, what the kingdom's ground is rich in: its deal of deposits,
  // 3/2/1 (Docs/plans/precious-deposits.md §1.2).
  if (index === home) {
    const deal = game.worldSource().board().deposits[state.world.board.seat];
    if (deal !== undefined) {
      const n = (rank: 'strong' | 'middle' | 'weak') => formatExact(WORLD_GEN.deposits[rank].length);
      lines.push(el('p', { class: 'wd-line' },
        `Your deposits: ${deal.strong} ×${n('strong')} · ${deal.middle} ×${n('middle')} · ${deal.weak} ×${n('weak')}`
        + ` — trade with friends for more ${deal.weak}`));
    }
  }

  if (bh.role === 'portal') {
    lines.push(el('p', { class: 'wd-line' }, 'Nobody holds it, and nobody ever will.'));
  } else if (control !== null && !control.owner.you && fog !== 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, 'Another kingdom. A city can never be attacked.'));
  } else if (index !== home && fog === 'Revealed') {
    const holds = [TERRAIN_NAME[bh.terrain ?? 'Grassland'], ...bh.features.map((f) => FEATURE_NAME[f])];
    // Bare ground is already its own title; say what it holds only past that.
    if (holds.length > 1) lines.push(el('p', { class: 'wd-line' }, holds.join(' · ')));
    // A deposit: the precious material its district yields.
    const material = depositMaterial(bh.features);
    if (material !== null) lines.push(el('p', { class: 'wd-line' }, `Yields ${material}`));
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
    const route = explorerRoute(state, index);
    const work = exploreWorkMs(state, index) / 1000;
    const trip = route === null ? 0 : (outboundMs(route.stepMs) + homeboundMs(route.stepMs)) / 1000 + work;
    let reason: string | undefined;
    if (route === null) reason = 'No way there through explored ground';
    else if (free === 0) reason = explorersOutLine(state, nextFreeAt(state), now);
    body.append(
      ...(route === null ? [] : [el('div', { class: 'wd-march' },
        stat('compass', formatDuration(trip), 'there and back'),
        stat('hourglass', formatDuration(work), 'to explore'))]),
      action({
        label: 'Explore', kind: 'primary', icon: 'compass',
        cost: { Gold: exploreGold(state, index) }, have: (c: CurrencyId) => getWallet(state.city.wallet, c),
        ...(firstTripFree(state) ? { note: 'Free' } : {}),
        onClick: () => game.doSendExplorer(),
        disabledReason: reason,
        info: `Explorers ${formatCount(free)}/${formatCount(slots)}`,
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
export function waitRow(
  game: Game, what: string, startedAt: number, endsAt: number, gems: number, onFinish: () => void, job: SpeedJob,
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
    timerButton(game, job, btn({
      label: 'Finish',
      kind: 'gem',
      onClick: onFinish,
      cost: { Gems: gems },
      have: (c) => game.walletValue(c),
    })));
}

/** An explorer's trip: there and the work, then — once the player has
 *  revealed what it found — the road home. In between it waits at the hex,
 *  and the row is the reveal. */
function tripRow(game: Game, trip: ExplorerTrip): HTMLElement {
  const now = game.now();
  const phase = tripPhase(trip, now);
  if (phase === 'ready') {
    return el('div', { class: 'tr-batch-row wd-trip is-ready' },
      el('div', { class: 'tr-batch-progress' },
        el('span', { class: 'tr-batch-what' }, 'Explored — your explorer waits for you')),
      coach(btn({ label: 'Reveal', kind: 'primary', icon: 'compass', onClick: () => void game.doRevealHex(trip.target) }), 'reveal'));
  }
  const [doing, from, to] = phase === 'home' ? ['Coming home', trip.revealedAt!, returnsAt(trip)]
    : [phase === 'out' ? 'On the way' : 'Exploring', trip.departedAt, readyAt(trip)];
  return waitRow(game, doing, from, to, explorerRushCost(trip, now),
    () => game.doFinishExplorer(trip.id), { kind: 'explorer', tripId: trip.id });
}

/** A builder's work on one of the player's hexes: its district, or an upgrade's level. */
function hexWorkRow(game: Game, index: number, work: NonNullable<ReturnType<typeof hexWork>>): HTMLElement {
  return waitRow(game, work.what, work.startedAt, work.endsAt, gemsToFinish((work.endsAt - game.now()) / 1000),
    () => void game.doFinishHexWork(index), { kind: 'hex', index });
}

/** What the player's district card says beyond its tiles: being claimed,
 *  cut off, burnt and its repair, a builder at work. */
function ownStatus(game: Game, index: number, h: NonNullable<ReturnType<ReturnType<Game['worldSource']>['hexOf']>>): HTMLElement[] {
  const out: HTMLElement[] = [];
  const work = hexWork(h, game.worldBoost());
  if (!h.held) {
    out.push(el('p', { class: 'wd-line' }, 'Being claimed'));
  } else if (!h.active) {
    out.push(el('p', { class: 'wd-line is-cut' }, 'Cut off from your city, it makes nothing'));
  }
  if (h.burnt) {
    out.push(el('p', { class: 'wd-line is-cut' }, 'Burnt by raiders — it makes nothing until it is repaired'));
    const repair = hexActions(game.worldSource(), game.worldSeat(), game.worldSource().board().hexes[index], { revealed: true }, [], game.worldBoost())
      .find((a) => a.kind === 'repair');
    if (repair !== undefined && repair.kind === 'repair') {
      out.push(action({
        label: 'Repair', kind: 'primary', cost: { Gold: repair.gold }, have: (c: CurrencyId) => getWallet(game.state.city.wallet, c),
        info: formatDuration(repair.seconds),
        onClick: () => void game.doRepairHex(index, repair.gold),
      }));
    }
  }
  if (work !== null) out.push(hexWorkRow(game, index, work));
  return out;
}

/** For the explorers chip: how many are out of how many. */
export const explorerCount = (game: Game): { out: number; slots: number } => ({
  out: game.state.world.explorers.length,
  slots: explorerSlots(game.state),
});
