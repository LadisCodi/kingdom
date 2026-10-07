// THE DARK PORTAL'S DESCENT — the Portal as a place played on the map, built
// like the delve (Docs/proposals/world-menus.md §3.10, mockup m92;
// Docs/features/19-world-map.md §10).
//
// Top to bottom: when it closes, and the player's floor; the floors going down a violet shaft — cleared, the frontier with
// its power and pay, the floors ahead that carry a pack, a lump or a
// milestone — with every kingdom's shield on its deepest floor, the
// player's own larger and the leader crowned; and the player's army docked
// at the foot as the deployment draws it, with Withdraw and Descend. There
// is no daily cap: every floor is fought for its Mana.

import type { Game } from '../../game';
import { HEROES, WORLD_PORTAL } from '../../sim/data/definitions';
import type { CurrencyId, HeroId } from '../../sim/state';
import { floorPower, floorReward } from '../../worldServer/core';
import type { ArmyView } from '../../worldServer/types';
import { el, formatCount, formatCountdown, formatExact } from '../format';
import { btn, chip, iconEl, powerTag, sheet } from '../kit';
import { fieldArmyPanel } from '../battleSheet';
import { marchingDock } from './delveScreen';
import { crestEl } from '../friends/kingdomBits';

/** The floor the descent was last opened on, and when it was last drawn:
 *  an opening scrolls to the player's frontier once, then the shaft stays
 *  where they leave it (the dungeon card's race does the same). */
let shown: { index: number; drawnAt: number } | null = null;

/** The player's army in the Portal, camped or on its way. */
const armyThere = (game: Game): ArmyView | undefined =>
  game.worldView?.armies.find((a) => a.owner === game.worldSeat() && a.purpose === 'portal' && a.phase !== 'home');

/** What a floor pays, as chips; its pack and lump called out. */
function floorPay(floor: number): HTMLElement {
  const pay = floorReward(floor);
  const coins: Array<[CurrencyId, number]> = [['Knowledge', pay.knowledge], ['HeroXp', pay.heroXp], ['Stardust', pay.stardust]];
  return el('div', { class: 'dv-pay' },
    ...coins.filter(([, n]) => n > 0).map(([c, n]) => chip(c, n)),
    ...(pay.pack === undefined ? [] : [el('span', { class: 'k-chip' }, iconEl('pack', { size: 'sm' }), `${pay.pack} pack`)]),
    ...(pay.precious > 0 ? [el('span', { class: 'k-chip' }, iconEl('sparkle', { size: 'sm' }), `${formatCount(pay.precious)} precious`)] : []));
}

/** One floor of the shaft. */
function floorNode(
  game: Game, floor: number, frontier: number, flags: ReadonlyArray<{ seat: number; you: boolean; leader: boolean }>,
): HTMLElement {
  const state = floor < frontier ? 'is-cleared' : floor === frontier ? 'is-frontier' : 'is-ahead';
  const side = floor % 2 === 0 ? ' is-right' : '';
  const pay = floorReward(floor);
  const disc = el('span', { class: 'dv-disc' },
    state === 'is-cleared' ? iconEl('tick', { size: 'md' }) : el('span', { class: 'dv-disc-n' }, formatCount(floor)));
  const seats = game.worldSource().seats();
  const shields = flags.map((f) => {
    const s = seats[f.seat];
    const name = s?.owner.name ?? '?';
    return el('span', { class: `dv-flag${f.you ? ' is-you' : ''}${f.leader ? ' is-leader' : ''}`, title: f.you ? 'You' : name },
      crestEl(name, s?.owner.crest ?? null, 'md'),
      el('span', { class: 'dv-flag-name' }, f.you ? 'You' : name));
  });
  const parts: Array<Node | string> = [el('span', { class: 'dv-node' },
    ...(shields.length === 0 ? [] : [el('span', { class: 'dv-flags' }, ...shields)]), disc)];
  if (state === 'is-frontier') {
    parts.push(el('div', { class: 'dv-plaque' },
      el('p', { class: 'dv-plaque-title' }, `Floor ${formatCount(floor)} · `, powerTag(floorPower(floor))),
      floorPay(floor)));
  } else if (state === 'is-ahead') {
    // A floor ahead says only what is worth going down for.
    const marks: HTMLElement[] = [];
    if (pay.pack !== undefined) marks.push(el('span', { class: 'k-chip' }, iconEl('pack', { size: 'sm' }), `${pay.pack} pack`));
    if (floor % WORLD_PORTAL.milestoneEvery === 0) {
      marks.push(el('span', { class: 'k-chip pt-milestone' }, 'First here', iconEl('Gems', { size: 'sm' }), formatCount(WORLD_PORTAL.milestoneGems)));
    }
    parts.push(el('div', { class: 'dv-tag' },
      el('span', { class: 'dv-tag-power' }, powerTag(floorPower(floor))),
      ...(marks.length === 0 ? [] : [el('span', { class: 'pt-marks' }, ...marks)])));
  }
  return el('div', { class: `dv-room ${state}${side}`, 'data-floor': String(floor) }, ...parts);
}

/** The army docked at the foot: as the dungeon's. */
function dock(game: Game, index: number, army: ArmyView | undefined, open: boolean, frontier: number): HTMLElement {
  if (army === undefined) {
    return el('div', { class: 'dv-dock' },
      el('p', { class: 'wd-line' }, 'No army is down there.'),
      el('div', { class: 'dv-calls is-one' },
        btn({ label: 'Send', kind: 'primary', disabledReason: open ? undefined : 'The Portal is shut', onClick: () => game.openArmy(index, 'portal') })));
  }
  if (army.phase !== 'camp') return marchingDock(game, army, 'On the way down');
  const lost = new Map((army.fallen ?? []).map((f) => [f.unitId, f.count]));
  const slots = army.slots ?? [];
  return el('div', { class: 'dv-dock' },
    fieldArmyPanel(game, {
      power: army.power,
      troops: slots.filter((s) => s.kind === 'troop' && s.unitId !== null)
        .map((s) => ({ unitId: s.unitId!, count: s.count, lost: lost.get(s.unitId!) ?? 0 })),
      heroes: slots.filter((s) => s.kind === 'hero' && s.fighterId !== null && s.fighterId in HEROES)
        .map((s) => ({ heroId: s.fighterId as HeroId, hp: s.hp, hpMax: s.hpMax })),
    }),
    el('div', { class: 'dv-calls' },
      btn({ label: 'Withdraw', kind: 'secondary', onClick: () => void game.doRecallArmy(army.id) }),
      btn({
        label: 'Descend', kind: 'destructive', cost: { Mana: game.fightMana() }, have: (c) => game.walletValue(c),
        disabledReason: !open ? 'The Portal is shut' : frontier > WORLD_PORTAL.floors ? 'At the bottom' : undefined,
        onClick: () => void game.doDescendPortal(army.id),
      })));
}

export function renderPortalScreen(game: Game): HTMLElement {
  const index = game.portalHex;
  if (index === null) return el('div');
  const p = game.worldSource().portal();
  const now = game.now();
  const open = p?.open === true;
  const floor = p?.floor ?? 0;
  const frontier = Math.min(WORLD_PORTAL.floors, floor + 1);
  const me = game.worldSeat();

  // The ranking, on the floors: each kingdom's shield on its deepest floor,
  // the leader crowned; the player's own on theirs even before the first.
  const ranking = p?.ranking ?? [];
  const at = new Map<number, Array<{ seat: number; you: boolean; leader: boolean }>>();
  ranking.forEach((r, i) => {
    const list = at.get(r.floor) ?? [];
    list.push({ seat: r.seat, you: r.seat === me, leader: i === 0 });
    at.set(r.floor, list);
  });
  if (!ranking.some((r) => r.seat === me)) {
    const list = at.get(frontier) ?? [];
    list.push({ seat: me, you: true, leader: false });
    at.set(frontier, list);
  }

  const ribbon = el('div', { class: 'wd-ribbon' }, iconEl('hourglass', { size: 'sm' }), p === null ? 'Shut'
    : open ? `Closes in ${formatCountdown(Math.max(0, p.closesAt - now) / 1000)}`
      : `Opens in ${formatCountdown(Math.max(0, p.opensAt - now) / 1000)}`);

  const floors = Array.from({ length: WORLD_PORTAL.floors }, (_, i) => floorNode(game, i + 1, frontier, at.get(i + 1) ?? []));
  const shaft = el('div', { class: 'dv-descent pt-shaft', 'data-keep-scroll': 'portal-shaft' }, ...floors);

  // An opening scrolls the shaft to the frontier once.
  const drawnAt = performance.now();
  const opening = shown === null || shown.index !== index || drawnAt - shown.drawnAt > 1500;
  shown = { index, drawnAt };
  if (opening) {
    globalThis.requestAnimationFrame?.(() => {
      const live = document.querySelector<HTMLElement>('[data-keep-scroll="portal-shaft"]');
      const node = live?.querySelector<HTMLElement>(`[data-floor="${frontier}"]`) ?? null;
      if (live == null || node === null) return;
      const off = node.getBoundingClientRect().top - live.getBoundingClientRect().top + live.scrollTop;
      live.scrollTop = off - (live.clientHeight - node.offsetHeight) / 2;
    });
  }

  const body = el('div', { class: 'dv-body is-portal' },
    ribbon,
    el('div', { class: 'dv-band' },
      el('p', { class: 'dv-where' }, `Your floor ${formatExact(floor)} of ${formatExact(WORLD_PORTAL.floors)}`),
      el('p', { class: 'dv-race-line' }, 'Ranked by the deepest floor reached; the first there leads.')),
    el('div', { class: 'dv-stage' }, shaft),
    dock(game, index, armyThere(game), open, floor + 1));
  const root = sheet({ title: 'The Dark Portal', tall: true, onClose: () => game.dismiss() }, body);
  root.classList.add('is-panes');
  return root;
}
