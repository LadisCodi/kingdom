// THE DELVE — a world dungeon as a full-screen menu (Docs/features/
// 19-world-map.md §8.2; mockups m65, m66, m91b).
//
// Top to bottom: the dungeon's name, and where the player is in it and who
// holds it; the descent — one node per room of the depth shown, every
// kingdom's shield on the room it has reached (the player's own larger,
// *You*), the frontier's power and pay, the boss still to beat at the foot
// with his chest; the depths as tabs down the right edge, each counting the
// kingdoms in it; and the player's army docked at the foot as the
// deployment draws it, with Withdraw and Attack. After a room, the spoils
// lie over the descent. No room shows its enemy: only the boss.

import type { Game } from '../../game';
import { HEROES, LAIRS, WORLD_DUNGEON } from '../../sim/data/definitions';
import { lumpMaterial } from '../../sim/world/board';
import type { CurrencyId, HeroId, PreciousId, UnitId } from '../../sim/state';
import { nextRoom, roomPower, roomReward } from '../../worldServer/core';
import type { ArmyView, DungeonView } from '../../worldServer/types';
import { el, formatCount } from '../format';
import { action, btn, chip, iconEl, sheet } from '../kit';
import { fieldArmyPanel } from '../battleSheet';
import { waitRow } from './dispatchSheet';
import { homeboundMs } from '../../sim/world/travel';
import { gemsToFinish } from '../../sim/rush';
import { crestEl } from '../friends/kingdomBits';
import { creatureFace } from '../lairSheet';
import { CAMP_CREATURE } from '../../sim/world/camps';

/** What a room pays, as chips: the coins, then its precious lump. */
function payChips(pay: { gold: number; heroXp: number; stardust: number; knowledge: number }, precious: { id: PreciousId; amount: number } | null): HTMLElement {
  const coins: Array<[CurrencyId, number]> = [['Gold', pay.gold], ['HeroXp', pay.heroXp], ['Stardust', pay.stardust], ['Knowledge', pay.knowledge]];
  return el('div', { class: 'dv-pay' },
    ...coins.filter(([, n]) => n > 0).map(([c, n]) => chip(c, n)),
    ...(precious === null ? [] : [el('span', { class: 'k-chip' }, iconEl(precious.id, { size: 'sm' }), formatCount(precious.amount))]));
}

/** The player's army at this dungeon, if one is camped or on its way. */
const armyHere = (game: Game, index: number): ArmyView | undefined =>
  game.worldView?.armies.find((a) => a.owner === game.worldSeat() && a.target === index && a.purpose === 'delve' && a.phase !== 'home');

/** "the Rot Baron" at the head of a line. */
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The soldier a dungeon's creature fights as — its portrait on the frontier. */
const creatureUnit = (info: DungeonView): UnitId => {
  const threat = LAIRS[info.creature].guard.threat;
  return threat === 'Any' ? 'Warrior' : threat;
};

/** Where each kingdom stands in the dungeon: the room it is at, 1-based
 *  through the whole dungeon (its next room, or the last once cleared). */
type Standing = { seat: number; at: number; you: boolean };

/** A kingdom's shield on its room — the player's own larger, with *You*. */
function shieldOn(game: Game, s: Standing): HTMLElement {
  const seat = game.worldSource().seats()[s.seat];
  const name = seat?.owner.name ?? '?';
  return el('span', { class: `dv-flag${s.you ? ' is-you' : ''}`, title: s.you ? 'You' : name },
    crestEl(name, seat?.owner.crest ?? null, s.you ? 'md' : 'md'),
    el('span', { class: 'dv-flag-name' }, s.you ? 'You' : name));
}

/** One room of the depth shown: its disc, the shields of the kingdoms that
 *  stand on it, and — the frontier — its power and pay; the boss, his face
 *  and his open chest. No other room shows its enemy (m91b). */
function roomNode(
  game: Game, info: DungeonView | undefined, depth: number, room: number, cleared: number, here: readonly Standing[],
): HTMLElement {
  const per = WORLD_DUNGEON.roomsPerDepth;
  const at = depth * per + room; // this room's place in the whole dungeon, 1-based
  const boss = room === per;
  const power = roomPower(depth, room);
  const state = at <= cleared ? 'is-cleared' : at === cleared + 1 ? 'is-frontier' : 'is-ahead';
  const side = room % 2 === 0 ? ' is-right' : '';
  const disc = el('span', { class: `dv-disc${boss ? ' is-boss' : ''}` },
    boss && state !== 'is-cleared' && info !== undefined
      ? el('span', { class: 'k-portrait' }, el('span', { class: 'k-portrait-mask' }, creatureFace(creatureUnit(info))))
      : state === 'is-cleared' ? iconEl('tick', { size: 'md' })
        : el('span', { class: 'dv-disc-n' }, formatCount(room)));
  const flags = here.filter((s) => s.at === at);
  const parts: Array<Node | string> = [el('span', { class: 'dv-node' },
    ...(flags.length === 0 ? [] : [el('span', { class: 'dv-flags' }, ...flags.map((s) => shieldOn(game, s)))]),
    disc)];
  if (boss) {
    parts.push(el('div', { class: 'dv-boss-name' }, capital(info?.bosses[depth] ?? 'the boss')));
  }
  if (state === 'is-frontier' && !boss) {
    const pay = roomReward(depth, room);
    const material = info === undefined ? null
      : lumpMaterial(game.worldSource().board(), game.worldSeat(), 'room', info.key, depth, room);
    parts.push(el('div', { class: 'dv-plaque' },
      el('p', { class: 'dv-plaque-title' }, `Room ${formatCount(room)} · Power ${formatCount(power)}`),
      payChips(pay, material === null ? null : { id: material, amount: pay.precious })));
  } else if (state === 'is-ahead' && !boss) {
    parts.push(el('div', { class: 'dv-tag' }, el('span', { class: 'dv-tag-power' }, `Power ${formatCount(power)}`)));
  }
  if (boss && state !== 'is-cleared') {
    // The boss's chest stands open: what beating him pays.
    parts.push(el('div', { class: 'dv-chest' }, el('span', { class: 'dv-chest-art', 'aria-hidden': 'true' }), payChips(roomReward(depth, room), null)));
  }
  return el('div', { class: `dv-room ${state}${boss ? ' is-boss' : ''}${side}` }, ...parts);
}

/** The army's own board as the deployment draws it, read only. */
function armyBoard(game: Game, army: ArmyView): HTMLElement {
  const lost = new Map((army.fallen ?? []).map((f) => [f.unitId, f.count]));
  const slots = army.slots ?? [];
  return fieldArmyPanel(game, {
    power: army.power,
    troops: slots.filter((s) => s.kind === 'troop' && s.unitId !== null)
      .map((s) => ({ unitId: s.unitId!, count: s.count, lost: lost.get(s.unitId!) ?? 0 })),
    heroes: slots.filter((s) => s.kind === 'hero' && s.fighterId !== null && s.fighterId in HEROES)
      .map((s) => ({ heroId: s.fighterId as HeroId, hp: s.hp, hpMax: s.hpMax })),
  });
}

/** An army on the road: its board, how far along it is with the time left,
 *  and Finish — Speed up when the Bag holds something that fits. */
export function marchingDock(game: Game, army: ArmyView, what: string): HTMLElement {
  const at = army.at ?? game.now();
  const from = army.phase === 'home' ? at - homeboundMs(army.stepMs) : army.departedAt;
  const left = Math.max(0, (at - game.now()) / 1000);
  return el('div', { class: 'dv-dock' },
    armyBoard(game, army),
    waitRow(game, army.phase === 'home' ? 'Coming home' : what, from, at, gemsToFinish(left),
      () => void game.doFinishArmyMarch(army.id), { kind: 'army', armyId: army.id, at }),
    el('div', { class: 'dv-calls is-one' },
      btn({ label: 'Withdraw', kind: 'secondary', onClick: () => void game.doRecallArmy(army.id) })));
}

/** The army docked at the foot (m91b): the deployment's YOUR ARMY board,
 *  read only, then Withdraw and Attack. On its way: when it arrives. None
 *  there: Send. */
function dock(game: Game, index: number, army: ArmyView | undefined, cleared: number): HTMLElement {
  if (army === undefined) {
    return el('div', { class: 'dv-dock' },
      el('p', { class: 'wd-line' }, 'No army is camped here.'),
      el('div', { class: 'dv-calls is-one' },
        btn({ label: 'Send', kind: 'primary', onClick: () => game.openArmy(index, 'delve') })));
  }
  if (army.phase !== 'camp') return marchingDock(game, army, 'On the way');
  const lost = new Map((army.fallen ?? []).map((f) => [f.unitId, f.count]));
  const slots = army.slots ?? [];
  const panel = fieldArmyPanel(game, {
    power: army.power,
    troops: slots.filter((s) => s.kind === 'troop' && s.unitId !== null)
      .map((s) => ({ unitId: s.unitId!, count: s.count, lost: lost.get(s.unitId!) ?? 0 })),
    heroes: slots.filter((s) => s.kind === 'hero' && s.fighterId !== null && s.fighterId in HEROES)
      .map((s) => ({ heroId: s.fighterId as HeroId, hp: s.hp, hpMax: s.hpMax })),
  });
  const next = nextRoom(cleared);
  return el('div', { class: 'dv-dock' },
    panel,
    el('div', { class: 'dv-calls' },
      btn({ label: 'Withdraw', kind: 'secondary', onClick: () => void game.doRecallArmy(army.id) }),
      btn({
        label: 'Attack', kind: 'destructive', cost: { Mana: game.fightMana() }, have: (c) => game.walletValue(c),
        disabledReason: next === null ? 'Cleared to the bottom' : undefined,
        onClick: () => void game.doDelveRoom(army.id),
      })));
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
  const total = WORLD_DUNGEON.depths * per;
  const reached = Math.min(WORLD_DUNGEON.depths - 1, Math.floor(cleared / per));
  const depth = Math.min(game.delveDepth ?? reached, WORLD_DUNGEON.depths - 1);
  const room = nextRoom(cleared);
  const army = armyHere(game, index);

  // Every kingdom in it, on the room it has reached — the player's own even
  // before their first room.
  const me = game.worldSeat();
  const race = info?.race ?? [];
  const here: Standing[] = race.map((r) => ({ seat: r.seat, at: Math.min(total, r.cleared + 1), you: r.seat === me }));
  if (!here.some((s) => s.you)) here.push({ seat: me, at: Math.min(total, cleared + 1), you: true });

  const where = room === null ? 'Cleared to the bottom'
    : `Depth ${formatCount(room.depth + 1)} · Room ${formatCount(room.room)} of ${formatCount(per)}`;
  const creature = info === undefined ? '' : ` · held by ${CAMP_CREATURE[info.creature]}`;
  const last = info?.bosses[WORLD_DUNGEON.depths - 1] ?? 'its last boss';

  // The depths, down the right edge: cleared, shown, or locked, and how many
  // kingdoms stand in each.
  const tabs = el('div', { class: 'dv-depths', role: 'tablist' },
    ...Array.from({ length: WORLD_DUNGEON.depths }, (_, d) => {
      const locked = d > reached;
      const done = cleared >= (d + 1) * per;
      const count = here.filter((s) => Math.floor((s.at - 1) / per) === d).length;
      const tab = el('button', {
        class: `dv-depth${d === depth ? ' is-on' : ''}${locked ? ' is-locked' : ''}`, type: 'button', role: 'tab',
        'aria-label': `Depth ${formatCount(d + 1)}${locked ? ', locked' : ''}`,
      },
      el('b', {}, formatCount(d + 1)),
      locked ? iconEl('padlock', { size: 'sm' }) : done ? iconEl('tick', { size: 'sm' }) : '',
      ...(count > 0 ? [el('span', { class: 'dv-depth-count' }, iconEl('crest', { size: 'sm' }), formatCount(count))] : []));
      tab.addEventListener('click', () => {
        if (locked) return; // a depth opens when the one above it is cleared
        game.delveDepth = d;
        game.notify();
      });
      return tab;
    }));

  const rooms = Array.from({ length: per }, (_, i) => roomNode(game, info, depth, i + 1, cleared, here));
  const body = el('div', { class: 'dv-body' },
    el('div', { class: 'dv-band' },
      el('p', { class: 'dv-where' }, `${where}${creature}`),
      el('p', { class: 'dv-race-line' }, `First to beat ${last} closes it for everyone, and is paid his chest ×${formatCount(WORLD_DUNGEON.closeRewardMultiplier)}`)),
    el('div', { class: 'dv-stage' }, el('div', { class: 'dv-descent' }, ...rooms), tabs),
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
