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
import { DIFFICULTY_COLOR, campDifficulty, campShown, strongestParty } from '../../sim/world/camps';
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
import {
  CREATURE_NAME, DIFFICULTY_NAME, FEATURE_NAME, FOG_NAME, ROLE_NAME, TERRAIN_NAME, coinName, hexTitle, seatGround, seatName, seatWho, withTag,
} from './hexNames';
import { tr, trn } from '../../i18n/tr';

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
  const whose = seatGround(game, h.owner);
  const work = hexWork(h, game.worldBoost());
  if (!h.held) {
    lines.push(el('p', { class: 'wd-line' }, mine && work !== null && game.actingSeat === null
      ? tr('{whose}, being claimed', { whose })
      : tr('{whose}, being claimed · it stands in {time}', { whose, time: formatCountdown(Math.max(0, h.standsAt - now) / 1000) })));
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
    return lines;
  }
  lines.push(el('p', { class: `wd-line${h.active ? '' : ' is-cut'}` },
    h.active ? whose : tr('{whose} — cut off from its city, it makes nothing', { whose })));
  if (h.fortress > 0) {
    lines.push(el('p', { class: 'wd-line' }, tr('{name} · level {n}', { name: WORLD_BUILD.upgrades.Fortress.name, n: formatCount(h.fortress) })));
  }
  // A Chapel's relic is seen by every player (relic-restoration.md §5.3).
  if (h.chapel === true) {
    lines.push(el('p', { class: 'wd-line' }, h.relic != null
      ? tr('{name} · {relic}, level {n}', { name: WORLD_BUILD.upgrades.Chapel.name, relic: ARTIFACTS[h.relic.id].name, n: formatCount(h.relic.level) })
      : tr('{name} · empty', { name: WORLD_BUILD.upgrades.Chapel.name })));
  }
  // Burnt by raiders (19 §5.5): it makes nothing until it is repaired.
  if (h.burnt) {
    lines.push(el('p', { class: 'wd-line is-cut' }, tr('Burnt by raiders — it makes nothing until it is repaired')));
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
  }
  // A camp beside it will raid it (19 §5.5).
  if (mine && !h.burnt && h.threat != null) {
    const creatures = h.threat.camps
      .map((c) => game.worldSource().board().hexes[c]?.camp?.creature)
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => CREATURE_NAME[c]);
    const vars = { who: creatures.join(tr(' and ')), time: formatCountdown(Math.max(0, h.threat.nextRaidAt - now) / 1000) };
    lines.push(el('p', { class: 'wd-line is-cut' }, h.garrison != null && h.garrison.owner === game.worldSeat()
      ? tr('{who} next door raid it in {time} — your garrison will fight them', vars)
      : tr('{who} next door raid it in {time}', vars)));
  }
  if (h.work !== null) {
    if (mine && work !== null && game.actingSeat === null) lines.push(hexWorkRow(game, bh.index, work));
    else lines.push(el('p', { class: 'wd-line' }, tr('Level {n} ready in {time}', { n: formatCount(h.work.toLevel), time: formatCountdown(Math.max(0, h.work.at - now) / 1000) })));
  }
  if (mine && h.stores !== null && h.stores.cap > 0) {
    lines.push(el('p', { class: 'wd-line' }, tr('{coin} in store {n}/{max}', { coin: coinName(h.stores.currency), n: formatCount(Math.floor(h.stores.amount)), max: formatCount(Math.floor(h.stores.cap)) })));
  }
  if (mine && h.precious != null && h.precious.cap > 0) {
    lines.push(el('p', { class: 'wd-line' }, tr('{coin} in store {n}/{max}', { coin: coinName(h.precious.id), n: formatCount(Math.floor(h.precious.amount)), max: formatCount(Math.floor(h.precious.cap)) })));
  }
  return lines;
}

const ARMY_VERB = { attack: tr('Attack'), claim: tr('Claim'), garrison: tr('Garrison'), delve: tr('Delve'), portal: tr('Descend'), clear: tr('Attack') } as const;
const ARMY_INFO = {
  attack: tr('Send an army'), claim: tr('Send an army to take it'), garrison: tr('Station an army here'),
  delve: tr('An army camps here and fights room by room'),
  portal: tr('An army goes down, a floor at a time'),
  clear: tr('Beat the camp, and take its loot'),
} as const;

/** A camp: whose, how strong, and how hard against the player's best party. */
function campLines(game: Game, bh: BoardHex, fog: FogState): HTMLElement[] {
  if (!campShown(game.worldSource(), bh, fog) || bh.camp === null) return [];
  const difficulty = campDifficulty(bh.camp.power, strongestParty(game.state));
  const lines = [el('p', { class: 'wd-line' },
    withTag(tr('A camp of {who} · {power} · {difficulty}', { who: CREATURE_NAME[bh.camp.creature] }), {
      power: powerTag(bh.camp.power),
      difficulty: el('b', { style: `color: ${DIFFICULTY_COLOR[difficulty]}` }, DIFFICULTY_NAME[difficulty]),
    }))];
  // What beating it pays, so the fight is worth weighing (19 §5.4).
  lines.push(el('p', { class: 'wd-line' }, `${tr('Beaten, it pays')} `,
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
      tr('It raids your {name} in {time} — beat it first and the raid is off', {
        name: WORLD_BUILD.districts[target.district].name, time: formatCountdown(Math.max(0, target.threat!.nextRaidAt - game.now()) / 1000),
      })));
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
  if (!p.open) return [el('p', { class: 'wd-line' }, tr('Shut · opens in {time}', { time: formatCountdown(Math.max(0, p.opensAt - now) / 1000) }))];
  const lines = [
    el('p', { class: 'wd-line' }, tr('Open · closes in {time}', { time: formatCountdown(Math.max(0, p.closesAt - now) / 1000) })),
    el('p', { class: 'wd-line' }, tr('Your floor {n} of {max}', { n: formatCount(p.floor), max: formatCount(WORLD_PORTAL.floors) })),
  ];
  p.ranking.slice(0, 6).forEach((r, i) => {
    lines.push(el('p', { class: 'wd-where' }, tr('{place}. {who} — floor {n}', { place: formatCount(i + 1), who: seatWho(game, r.seat), n: formatCount(r.floor) })));
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
    ? tr('Cleared to the bottom')
    : tr('Depth {depth} of {depths} · Room {room} of {rooms}', {
      depth: formatCount(room.depth + 1), depths: formatCount(WORLD_DUNGEON.depths), room: formatCount(room.room), rooms: formatCount(per),
    }))];
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
          label: tr('Claim'), kind: 'primary', cost: { Gold: a.gold }, have,
          info: `${WORLD_BUILD.districts[a.district].name} · ${formatDuration(a.seconds)}`,
          onClick: () => void game.doClaimHex(bh.index, asRival ? 0 : a.gold),
        });
      case 'repair':
        return action({
          label: tr('Repair'), kind: 'primary', cost: { Gold: a.gold }, have,
          info: tr("The raiders' damage · {time}", { time: formatDuration(a.seconds) }),
          onClick: () => void game.doRepairHex(bh.index, asRival ? 0 : a.gold),
        });
      case 'upgrade':
        return action({
          label: a.level === 1 ? tr('Build') : tr('Upgrade'), kind: 'secondary',
          cost: { Gold: a.gold }, have,
          // Its precious materials, beside the Gold (19 §7.6).
          costExtra: asRival ? [] : Object.entries(worldUpgradeGoods(game.state, a.upgrade, a.level)).map(([g, n]) => ({
            icon: g as GoodId, amount: formatCount(n as number),
            short: getGood(game.state.city.goods, g as GoodId) < (n as number),
          })),
          info: a.level > 1
            ? tr('{name} level {n} · {time}', { name: WORLD_BUILD.upgrades[a.upgrade].name, n: formatCount(a.level), time: formatDuration(a.seconds) })
            : `${WORLD_BUILD.upgrades[a.upgrade].name} · ${formatDuration(a.seconds)}`,
          disabledReason: a.blocked,
          onClick: () => void game.doUpgradeHex(bh.index, a.upgrade, a.level, asRival ? 0 : a.gold),
        });
      case 'host':
        return action({
          label: tr('Host'), kind: 'primary',
          info: tr('{name}, level {n}', { name: ARTIFACTS[a.relic].name, n: formatCount(game.relicLevel(a.relic)) }),
          onClick: () => void game.doHostWorldRelic(a.relic, bh.index),
        });
      case 'unhost':
        return action({
          label: tr('Remove'), kind: 'secondary', info: tr('{name} goes back to your Bag', { name: ARTIFACTS[a.relic].name }),
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
          label: tr('Descend'), kind: 'destructive', cost: { Mana: game.fightMana() }, have,
          info: withTag(floorReward(floor).precious > 0
            ? tr('Floor {n} · {power} · pays {precious} precious material', { n: formatCount(floor), precious: formatCount(floorReward(floor).precious) })
            : tr('Floor {n} · {power}', { n: formatCount(floor) }), { power: powerTag(floorPower(floor)) }),
          disabledReason: p === null || !p.open ? tr('The Portal is shut')
            : floor > WORLD_PORTAL.floors ? tr('At the bottom') : undefined,
          onClick: () => void game.doDescendPortal(a.army),
        });
      }
      case 'delve': {
        const cleared = game.worldSource().delved(bh.index);
        const room = nextRoom(cleared);
        return action({
          label: tr('Attack'), kind: 'destructive', cost: { Mana: game.fightMana() }, have,
          info: room === null ? tr('Cleared to the bottom')
            : withTag(room.boss ? tr('The boss · {power}') : tr('Room {n} · {power}', { n: formatCount(room.room) }),
              { power: powerTag(roomPower(room.depth, room.room)) }),
          disabledReason: room === null ? tr('Cleared to the bottom') : undefined,
          onClick: () => void game.doDelveRoom(a.army),
        });
      }
      case 'tribute':
        return action({
          label: tr('Pay off'), kind: 'secondary', cost: a.cost, have,
          info: tr('The camp leaves, and pays nothing'),
          onClick: () => void game.doTributeCamp(bh.index),
        });
      case 'openDelve':
        return action({
          label: tr('Delve'), kind: 'primary', info: tr('The descent, its rooms and what they pay'),
          onClick: () => game.openDelve(bh.index),
        });
      case 'recall':
        return action({
          label: tr('Recall'), kind: 'secondary', info: tr('The garrison marches home'),
          onClick: () => void game.doRecallArmy(a.army),
        });
      case 'collect':
        return action({
          label: tr('Collect'), kind: 'gold',
          disabledReason: a.ready ? undefined : tr('Nothing to collect yet'),
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
      return renderFreeGround(game, bh, hexTitle(game, bh, fog), claim === undefined ? tr('Build beside ground you hold') : undefined);
    }
  }

  const lines: HTMLElement[] = [];
  const where = index === home
    ? tr('Your province, seen from the world')
    : `${FOG_NAME[fog]} · ${ROLE_NAME[bh.role]} · ${trn(distance, '{n} hex away', '{n} hexes away', { n: formatCount(distance) })}`;
  lines.push(el('p', { class: 'wd-where' }, where));
  // At home, what the kingdom's ground is rich in: its deal of deposits,
  // 3/2/1 (Docs/plans/precious-deposits.md §1.2).
  if (index === home) {
    const deal = game.worldSource().board().deposits[state.world.board.seat];
    if (deal !== undefined) {
      const n = (rank: 'strong' | 'middle' | 'weak') => formatExact(WORLD_GEN.deposits[rank].length);
      lines.push(el('p', { class: 'wd-line' },
        tr('Your deposits: {strong} ×{a} · {middle} ×{b} · {weak} ×{c} — trade with friends for more {weak}', {
          strong: coinName(deal.strong), middle: coinName(deal.middle), weak: coinName(deal.weak), a: n('strong'), b: n('middle'), c: n('weak'),
        })));
    }
  }

  if (bh.role === 'portal') {
    lines.push(el('p', { class: 'wd-line' }, tr('Nobody holds it, and nobody ever will.')));
  } else if (control !== null && !control.owner.you && fog !== 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, tr('Another kingdom. A city can never be attacked.')));
  } else if (index !== home && fog === 'Revealed') {
    const holds = [TERRAIN_NAME[bh.terrain ?? 'Grassland'], ...bh.features.map((f) => FEATURE_NAME[f])];
    // Bare ground is already its own title; say what it holds only past that.
    if (holds.length > 1) lines.push(el('p', { class: 'wd-line' }, holds.join(' · ')));
    // A deposit: the precious material its district yields.
    const material = depositMaterial(bh.features);
    if (material !== null) lines.push(el('p', { class: 'wd-line' }, tr('Yields {material}', { material: coinName(material) })));
  } else if (fog === 'Sensed') {
    lines.push(el('p', { class: 'wd-line' }, tr('Shapes in the mist. Explore it before anything can be done there.')));
    // What an explorer sent here brings home (19 §3.2), priced as of now.
    if (bh.scout !== null) {
      lines.push(el('p', { class: 'wd-line' }, tr('Exploring it pays {what}', { what: scoutWords(scoutPay(state, bh.scout, bh.role, index)) })));
    }
  } else if (fog === 'Unknown') {
    lines.push(el('p', { class: 'wd-line' }, tr('Nobody has been this way.')));
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
    if (route === null) reason = tr('No way there through explored ground');
    else if (free === 0) reason = explorersOutLine(state, nextFreeAt(state), now);
    body.append(
      ...(route === null ? [] : [el('div', { class: 'wd-march' },
        stat('compass', formatDuration(trip), tr('there and back')),
        stat('hourglass', formatDuration(work), tr('to explore')))]),
      action({
        label: tr('Explore'), kind: 'primary', icon: 'compass',
        cost: { Gold: exploreGold(state, index) }, have: (c: CurrencyId) => getWallet(state.city.wallet, c),
        ...(firstTripFree(state) ? { note: tr('Free') } : {}),
        onClick: () => game.doSendExplorer(),
        disabledReason: reason,
        info: tr('Explorers {n}/{max}', { n: formatCount(free), max: formatCount(slots) }),
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
      el('span', { class: 'tr-batch-total' }, tr('Total time: {time}', { time: formatDuration(Math.ceil(total / 1000)) }))),
    timerButton(game, job, btn({
      label: tr('Finish'),
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
        el('span', { class: 'tr-batch-what' }, tr('Explored — your explorer waits for you'))),
      coach(btn({ label: tr('Reveal'), kind: 'primary', icon: 'compass', onClick: () => void game.doRevealHex(trip.target) }), 'reveal'));
  }
  const [doing, from, to] = phase === 'home' ? [tr('Coming home'), trip.revealedAt!, returnsAt(trip)]
    : [phase === 'out' ? tr('On the way') : tr('Exploring'), trip.departedAt, readyAt(trip)];
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
    out.push(el('p', { class: 'wd-line' }, tr('Being claimed')));
  } else if (!h.active) {
    out.push(el('p', { class: 'wd-line is-cut' }, tr('Cut off from your city, it makes nothing')));
  }
  if (h.burnt) {
    out.push(el('p', { class: 'wd-line is-cut' }, tr('Burnt by raiders — it makes nothing until it is repaired')));
    const repair = hexActions(game.worldSource(), game.worldSeat(), game.worldSource().board().hexes[index], { revealed: true }, [], game.worldBoost())
      .find((a) => a.kind === 'repair');
    if (repair !== undefined && repair.kind === 'repair') {
      out.push(action({
        label: tr('Repair'), kind: 'primary', cost: { Gold: repair.gold }, have: (c: CurrencyId) => getWallet(game.state.city.wallet, c),
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
