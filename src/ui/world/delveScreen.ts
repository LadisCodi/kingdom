// THE DELVE — a world dungeon as a full-screen menu (Docs/features/
// 19-world-map.md §8.2; mockups m65, m66).
//
// Top to bottom: the dungeon's name and where the player is in it; the race
// strip — every player in it at their room; the descent — one node per room
// of the depth shown, cleared, the frontier with its power and pay, the rooms
// ahead hazed, the boss and his chest; the depth tabs; and the army docked at
// the foot with Fight and Recall, or Send an army. After a room, the spoils
// lie over the descent.

import type { Game } from '../../game';
import { HEROES, LAIRS, WORLD_DUNGEON } from '../../sim/data/definitions';
import { lumpMaterial } from '../../sim/world/board';
import type { CurrencyId, PreciousId, UnitId } from '../../sim/state';
import { nextRoom, roomPower, roomReward } from '../../worldServer/core';
import type { ArmyView, DungeonView } from '../../worldServer/types';
import { spriteImgAt, spriteUrl } from '../../render/sprites';
import { el, formatCount, formatCountdown } from '../format';
import { action, chip, hpBar, iconEl, sheet, toggleGroup } from '../kit';
import { unitPortrait } from '../unitArt';
import { CAMP_CREATURE } from '../../sim/world/camps';
import { seatName } from './dispatchSheet';

/** What a room pays, as chips: the coins, then its precious lump. */
function payChips(pay: { gold: number; heroXp: number; stardust: number; knowledge: number }, precious: { id: PreciousId; amount: number } | null): HTMLElement {
  const coins: Array<[CurrencyId, number]> = [['Gold', pay.gold], ['HeroXp', pay.heroXp], ['Stardust', pay.stardust], ['Knowledge', pay.knowledge]];
  return el('div', { class: 'dv-pay' },
    ...coins.filter(([, n]) => n > 0).map(([c, n]) => chip(c, n)),
    ...(precious === null ? [] : [el('span', { class: 'k-chip' }, iconEl(precious.id, { size: 'sm' }), formatCount(precious.amount))]));
}

/** A hero's round face, or its glyph while the art is missing. */
function heroFace(id: string): HTMLElement {
  const def = HEROES[id as keyof typeof HEROES];
  const url = def === undefined ? null : spriteUrl(`${def.sprite}_avatar`) ?? spriteUrl(def.sprite);
  return el('span', { class: 'k-portrait dv-face' },
    el('span', { class: 'k-portrait-mask' }, url ? spriteImgAt(url, 'k-portrait-art') : el('span', {}, def?.glyph ?? '?')));
}

/** The player's army at this dungeon, if one is camped or on its way. */
const armyHere = (game: Game, index: number): ArmyView | undefined =>
  game.worldView?.armies.find((a) => a.owner === game.worldSeat() && a.target === index && a.purpose === 'delve' && a.phase !== 'home');

function raceStrip(game: Game, info: DungeonView | undefined): HTMLElement {
  const per = WORLD_DUNGEON.roomsPerDepth;
  const total = WORLD_DUNGEON.depths * per;
  const banners = (info?.race ?? []).map((r) => {
    const you = r.seat === game.worldSeat();
    const at = Math.min(total, r.cleared + 1);
    const banner = el('span', { class: `dv-banner${you ? ' is-you' : ''}` },
      you ? 'You' : seatName(game, r.seat).replace(/'s$/, ''));
    banner.style.left = `${Math.round((r.cleared / total) * 100)}%`;
    banner.title = `Room ${formatCount(at)} of ${formatCount(total)}`;
    return banner;
  });
  const last = info?.bosses[WORLD_DUNGEON.depths - 1] ?? 'its last boss';
  return el('div', { class: 'dv-race' },
    el('div', { class: 'dv-rope' }, ...banners),
    el('p', { class: 'dv-race-line' },
      `First to beat ${last} closes it for everyone, and is paid that chest ×${formatCount(WORLD_DUNGEON.closeRewardMultiplier)}`));
}

/** "the Rot Baron" at the head of a line. */
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The soldier a dungeon's creature fights as — its portrait on the frontier. */
const creatureUnit = (info: DungeonView): UnitId => {
  const threat = LAIRS[info.creature].guard.threat;
  return threat === 'Any' ? 'Warrior' : threat;
};

/** One room of the depth shown. */
function roomNode(
  game: Game, info: DungeonView | undefined, depth: number, room: number, cleared: number, army: ArmyView | undefined,
): HTMLElement {
  const per = WORLD_DUNGEON.roomsPerDepth;
  const at = depth * per + room; // this room's place in the whole dungeon, 1-based
  const boss = room === per;
  const power = roomPower(depth, room);
  const state = at <= cleared ? 'is-cleared' : at === cleared + 1 ? 'is-frontier' : 'is-ahead';
  const side = room % 2 === 0 ? ' is-right' : '';
  const label = boss ? capital(info?.bosses[depth] ?? 'the boss') : `Room ${formatCount(room)}`;
  const disc = el('span', { class: `dv-disc${boss ? ' is-boss' : ''}` },
    state === 'is-cleared' ? iconEl('tick', { size: 'md' })
      : state === 'is-frontier' && info !== undefined ? unitPortrait(creatureUnit(info))
        : el('span', { class: 'dv-disc-n' }, boss ? '' : formatCount(room)));
  const parts: Array<Node | string> = [disc];
  if (state === 'is-frontier') {
    const pay = roomReward(depth, room);
    const seat = game.worldSeat();
    const material = info === undefined ? null
      : lumpMaterial(game.worldSource().board(), seat, 'room', info.key, depth, room);
    parts.push(el('div', { class: 'dv-plaque' },
      el('p', { class: 'dv-plaque-title' }, label),
      el('p', { class: 'dv-plaque-power' },
        `Power ${formatCount(power)}${army ? ` vs your ${formatCount(army.power)}` : ''}`),
      payChips(pay, material === null ? null : { id: material, amount: pay.precious })));
  } else {
    parts.push(el('div', { class: 'dv-tag' },
      el('span', { class: 'dv-tag-name' }, label),
      state === 'is-ahead' ? el('span', { class: 'dv-tag-power' }, `Power ${formatCount(power)}`) : ''));
  }
  if (boss && state !== 'is-cleared') {
    // The boss's chest stands open: what beating him pays.
    const pay = roomReward(depth, room);
    parts.push(el('div', { class: 'dv-chest' }, iconEl('chest', { size: 'md' }), payChips(pay, null)));
  }
  return el('div', { class: `dv-room ${state}${boss ? ' is-boss' : ''}${side}` }, ...parts);
}

/** The army docked at the foot: what it fights with, and what to do. */
function dock(game: Game, index: number, army: ArmyView | undefined, cleared: number): HTMLElement {
  if (army === undefined) {
    return el('div', { class: 'dv-dock' },
      el('p', { class: 'wd-line' }, 'No army is camped here.'),
      action({ label: 'Send', kind: 'primary', info: 'An army camps here and fights room by room', onClick: () => game.openArmy(index, 'delve') }));
  }
  if (army.phase !== 'camp') {
    const left = army.at === null ? 0 : Math.max(0, army.at - game.now()) / 1000;
    return el('div', { class: 'dv-dock' },
      el('p', { class: 'wd-line' }, `Your army is on its way · here in ${formatCountdown(left)}`),
      action({ label: 'Recall', kind: 'secondary', onClick: () => void game.doRecallArmy(army.id) }));
  }
  const lost = new Map((army.fallen ?? []).map((f) => [f.unitId, f.count]));
  const slots = (army.slots ?? []).map((s) => s.kind === 'hero'
    ? el('span', { class: 'dv-slot' }, heroFace(s.fighterId ?? ''), hpBar(Math.round(s.hp), Math.round(s.hpMax)))
    : el('span', { class: 'dv-slot' },
      s.unitId ? unitPortrait(s.unitId) : '',
      el('span', { class: 'dv-count' }, `×${formatCount(s.count)}`),
      s.unitId !== null && (lost.get(s.unitId) ?? 0) > 0 ? el('span', { class: 'dv-lost' }, `−${formatCount(lost.get(s.unitId)!)}`) : ''));
  const next = nextRoom(cleared);
  return el('div', { class: 'dv-dock' },
    el('div', { class: 'dv-army' }, ...slots, el('span', { class: 'dv-power' }, `Power ${formatCount(army.power)}`)),
    el('div', { class: 'dv-calls' },
      action({
        label: 'Fight', kind: 'destructive', cost: { Mana: game.fightMana() }, have: (c) => game.walletValue(c),
        disabledReason: next === null ? 'Cleared to the bottom' : undefined,
        onClick: () => void game.doDelveRoom(army.id),
      }),
      action({ label: 'Recall', kind: 'secondary', onClick: () => void game.doRecallArmy(army.id) })));
}

/** The spoils of the last room fought, over the descent (m66). */
function spoils(game: Game, army: ArmyView | undefined, cleared: number): HTMLElement | null {
  const s = game.delveSpoils;
  if (s === null) return null;
  const canFight = army?.phase === 'camp' && nextRoom(cleared) !== null;
  const title = s.won ? `${s.boss ? 'The boss' : `Room ${formatCount(s.room)}`} cleared!` : 'Beaten back';
  const lost = s.lost > 0 ? `Your army lost ${formatCount(s.lost)} ${s.lost === 1 ? 'soldier' : 'soldiers'}` : 'Your army lost nobody';
  return el('div', { class: 'dv-spoils' },
    el('div', { class: 'dv-spoils-panel' },
      el('p', { class: 'dv-spoils-title' }, title),
      s.won && s.loot !== null ? payChips(s.loot, s.loot.precious ?? null)
        : el('p', { class: 'wd-line' }, 'The room still stands. Reinforce the army, or try again.'),
      el('p', { class: 'wd-line' }, lost),
      el('div', { class: 'dv-calls' },
        canFight ? action({
          label: s.won ? 'Fight next' : 'Fight again', kind: 'primary',
          cost: { Mana: game.fightMana() }, have: (c) => game.walletValue(c),
          onClick: () => { game.delveSpoils = null; void game.doDelveRoom(army!.id); },
        }) : '',
        action({ label: 'Back', kind: 'secondary', onClick: () => game.dismissSpoils() }))));
}

export function renderDelveScreen(game: Game): HTMLElement {
  const index = game.delveHex;
  if (index === null) return el('div');
  const info = game.worldView?.dungeonInfo?.find((d) => d.index === index);
  const cleared = game.worldSource().delved(index);
  const per = WORLD_DUNGEON.roomsPerDepth;
  const reached = Math.min(WORLD_DUNGEON.depths - 1, Math.floor(cleared / per));
  const depth = Math.min(game.delveDepth ?? reached, WORLD_DUNGEON.depths - 1);
  const room = nextRoom(cleared);
  const army = armyHere(game, index);

  const where = room === null ? 'Cleared to the bottom'
    : `Depth ${formatCount(room.depth + 1)} · Room ${formatCount(room.room)} of ${formatCount(per)}`;
  const creature = info === undefined ? '' : ` · held by ${CAMP_CREATURE[info.creature]}`;

  const tabs = toggleGroup(
    Array.from({ length: WORLD_DUNGEON.depths }, (_, d) => ({ label: d > reached ? `${formatCount(d + 1)} · locked` : formatCount(d + 1), value: d })),
    depth,
    (d) => {
      if (d > reached) return; // a depth opens when the one above it is cleared
      game.delveDepth = d;
      game.notify();
    });
  tabs.classList.add('dv-tabs');

  const rooms = Array.from({ length: per }, (_, i) => roomNode(game, info, depth, i + 1, cleared, army));
  const body = el('div', { class: 'dv-body' },
    el('p', { class: 'dv-where' }, `${where}${creature}`),
    raceStrip(game, info),
    tabs,
    el('div', { class: 'dv-descent' }, ...rooms),
    dock(game, index, army, cleared));
  const root = sheet({ title: info?.name ?? 'A dungeon', tall: true, onClose: () => game.dismiss() }, body);
  // The spoils lie over the whole sheet, not the descent that scrolls under
  // them, so they are in view wherever the stair was scrolled to.
  const over = spoils(game, army, cleared);
  if (over !== null) {
    root.classList.add('has-spoils');
    root.append(over);
  }
  return root;
}
