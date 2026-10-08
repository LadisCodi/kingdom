// THE HEX CARD — a world hex as the city's building card (Docs/proposals/
// world-menus.md §2–§3.3; mockups m83b, m84c–e).
//
// Free ground has two sections: THE HEX (the ground: its art, how far it
// is, its terrain, its feature, the march across it) and DISTRICT (what it
// becomes, its yield and its Build). Once built, the hex and its district
// are one thing: one head, one band of tiles, and BUILDINGS — the
// district's slots, each empty (a tap opens the slot picker) or holding a
// Fortress or a Chapel (a tap opens its popup).
//
// A ready store is not here: a tap on the hex collects it, as on a city
// building. Nor is a raid to come: the board draws its arrow.

import type { Game } from '../../game';
import type { BoardHex } from '../../sim/world/board';
import { ARTIFACTS, DISTRICTS, WORLD_BUILD, WORLD_DUNGEON, WORLD_GEN, WORLD_PORTAL } from '../../sim/data/definitions';
import { buildingPortrait } from '../districtCard';
import { crestEl, rankRibbon, townhallTag } from '../friends/kingdomBits';
import { depositMaterial, type WorldDistrict, type WorldFeature, type WorldUpgrade } from '../../sim/world/types';
import { hexAt, hexDistance } from '../../sim/world/hex';
import { hexTravelMs, homeboundMs, outboundMs } from '../../sim/world/travel';
import {
  exploreGold, exploreWorkMs, explorerRoute, firstTripFree, freeExplorers, nextFreeAt, type FogState,
} from '../../sim/world/explorers';
import { scoutPay } from '../../sim/world/scouting';
import { getGood } from '../../sim/goods';
import { worldUpgradeGoods } from '../../sim/precious';
import type { CurrencyId, GoodId, UnitId } from '../../sim/state';
import { claimGold, districtOf, districtRate, floorPower, nextRoom, upgradeLevel } from '../../worldServer/core';
import { portalPortrait } from '../../render/world/boardRenderer';
import type { HexControl } from '../../sim/world/source';
import { COMBO_SPRITE, DISTRICT_SPRITE, PLATE_SPRITE, comboOf, fortressSprite } from '../../render/world/hexArt';
import { spriteImgAt, spriteUrl } from '../../render/sprites';
import { coach, el, formatCount, formatCountdown, formatDuration, formatExact, formatShort } from '../format';
import { action, btn, chip, costChips, currencyIcon, iconEl, powerTag, sectionHead, sheet, withTooltip, type IconName } from '../kit';
import { groundEdges } from '../../sim/world/terrainCombat';
import { emptyRelicSlot } from '../relicPicker';
import { relicArt } from '../relicSheet';
import { chapelRoom, explorersOutLine, fortressRoom, hexActions, hexWork, upgradeBlocked, worldBuildSeconds } from './worldActions';
import { armyBoard, marchingDock } from './delveScreen';
import { CAMP_CREATURE, campDifficulty, campSquads, campTribute, strongestParty } from '../../sim/world/camps';
import { campLoot } from '../../sim/world/fights';
import { enemyPanel } from '../battleSheet';
import { creatureFace } from '../lairSheet';
import { CAMP_TITLE, FEATURE_NAME, TERRAIN_NAME } from './hexNames';

/** A feature's mark on its tile: what it is worked for. */
const FEATURE_ICON: Partial<Record<WorldFeature, IconName>> = {
  Forest: 'Wood', Mountain: 'Stone', FertileLand: 'FarmLands', Game: 'Meat', Landmark: 'Knowledge',
  Sanctuary: 'Mana', HeartwoodGrove: 'Heartwood', StarfallCrater: 'Starmetal', MoonglassSpires: 'Moonglass',
};

/** What a building does, in one line. */
const BUILDING_LINE: Record<WorldUpgrade, string> = {
  Fortress: 'Its garrison fights raiders',
  Chapel: 'Hosts a world relic',
};

const buildingSprite = (b: WorldUpgrade, level: number): string =>
  (b === 'Fortress' ? fortressSprite(Math.max(1, level)) : 'whex_chapel');

/** What a district does for the city, in one sentence. */
function districtLine(bh: BoardHex, d: WorldDistrict): string {
  const def = WORLD_BUILD.districts[d];
  const material = depositMaterial(bh.features);
  if (material !== null) return `Digs ${material} for your city.`;
  if (d === 'Shrine') return 'Raises your Mana’s ceiling. Its Chapel hosts a world relic.';
  if (def.produces === 'Food') return 'Farms Food for your city.';
  if (def.produces === '') return 'Works its ground for your city.';
  return `${def.produces === 'Gold' ? 'Pays' : 'Brings'} ${def.produces} to your city.`;
}

/** The art in a portrait: a sprite, drawn larger than its tile and clipped. */
function portrait(sprite: string | null, fallback: IconName): HTMLElement {
  const url = sprite === null ? null : spriteUrl(sprite);
  return el('div', { class: 'dc-portrait k-section wd-portrait' },
    el('div', { class: 'dc-portrait-mask' }, url ? spriteImgAt(url, 'dc-portrait-art') : iconEl(fallback, { size: 'lg' })),
    ...(['tl', 'tr', 'bl', 'br'] as const).map((corner) => el('span', { class: `dc-orn is-${corner}`, 'aria-hidden': 'true' })));
}

/** The bare ground's art: its feature's drawing, or its terrain plate. */
const groundSprite = (bh: BoardHex): string => {
  const combo = comboOf(bh.terrain ?? 'Grassland', bh.features);
  return combo !== null ? COMBO_SPRITE[combo] : PLATE_SPRITE[bh.terrain ?? 'Grassland'];
};

interface Tile { icon: IconName; label: string; value: string; bad?: boolean }

/** A band of the city card's tiles. */
const tiles = (list: readonly Tile[]): HTMLElement => el('div', { class: 'dc-stats wd-stats' },
  ...list.map((f) => el('div', { class: `dc-stat k-section${f.bad ? ' is-bad' : ''}`, 'aria-label': `${f.label} ${f.value}` },
    iconEl(f.icon, { size: 'lg' }),
    el('div', { class: 'dc-stat-body', 'aria-hidden': 'true' },
      el('div', { class: 'dc-stat-label' }, f.label),
      el('b', { class: 'dc-stat-value' }, f.value)))));

/** "1 hex from your city", with the boot. */
function distanceLine(game: Game, index: number): HTMLElement {
  const n = hexDistance(hexAt(game.homeHex()), hexAt(index));
  return el('p', { class: 'wd-far' }, iconEl('boot', { size: 'sm' }),
    `${formatCount(n)} ${n === 1 ? 'hex' : 'hexes'} from your city`);
}

/** The ground's own tiles: terrain, feature, the march across it — at its
 *  distance from the player's city, where far ground is slower (19 §4.1). */
function groundTiles(game: Game, bh: BoardHex): Tile[] {
  const feature = bh.features[0];
  return [
    { icon: 'tile', label: 'Terrain', value: TERRAIN_NAME[bh.terrain ?? 'Grassland'] },
    ...(feature === undefined ? [] : [{ icon: FEATURE_ICON[feature] ?? 'tile', label: 'Feature', value: FEATURE_NAME[feature] }]),
    { icon: 'boot', label: 'March', value: `${formatDuration(Math.round(hexTravelMs(bh, 'army', hexDistance(hexAt(game.homeHex()), bh.hex)) / 1000))} / hex` },
  ];
}

/** What a district on this hex makes and holds, as the city card says it. */
function yieldTiles(game: Game, bh: BoardHex, h: HexControl | null): Tile[] {
  const rate = districtRate(bh, game.worldBoost());
  const out: Tile[] = [];
  if (rate.currency !== null) {
    const coin = rate.currency as IconName;
    out.push(h?.stores != null
      ? { icon: coin, label: 'Storage', value: `${formatShort(Math.floor(h.stores.amount))}/${formatShort(h.stores.cap)}`, bad: h.stores.amount >= h.stores.cap }
      : { icon: coin, label: 'Storage', value: formatShort(rate.cap) });
    out.push({ icon: coin, label: 'Income', value: `${formatShort(rate.perHour)} /h` });
  }
  // A deposit's precious store, beside its coin's.
  if (h?.precious != null && h.precious.cap > 0) {
    out.push({ icon: h.precious.id, label: h.precious.id, value: `${formatShort(Math.floor(h.precious.amount))}/${formatShort(h.precious.cap)}` });
  } else if (h === null) {
    const material = depositMaterial(bh.features);
    if (material !== null) out.push({ icon: material, label: 'Yields', value: material });
  }
  return out;
}

/** Why the section's button cannot be pressed: the padlock and a sentence,
 *  across the card under the head it belongs to. */
const blockedLine = (reason: string): HTMLElement =>
  el('p', { class: 'k-reason is-blocked wd-blocked' }, iconEl('padlock', { size: 'sm' }), reason);

/** The player's shield, at the left of the title plank. */
function withShield(game: Game, root: HTMLElement): HTMLElement {
  const me = game.worldSource().seats()[game.worldSeat()];
  const head = root.querySelector('.k-head');
  if (me !== undefined && head !== null) {
    head.prepend(el('span', { class: 'wd-shield', 'aria-hidden': 'true' }, crestEl(me.owner.name, me.owner.crest ?? null, 'md')));
  }
  return root;
}

// ------------------------------------------------------------ fog

/**
 * GROUND IN THE MIST (m85b): THE HEX — the mist, the distance, one sentence,
 * no tiles, for nothing is known of it yet — then EXPLORE, with its Explore
 * and the journey, and, on a Sensed hex, what exploring it pays. How many
 * explorers are free is the header's, as builders are while building.
 * `trip` is the explorer already on its way there, in place of the button.
 */
export function renderFog(game: Game, bh: BoardHex, fog: FogState, title: string, trip: HTMLElement | null): HTMLElement {
  const state = game.state;
  const now = game.now();
  const index = bh.index;
  const mist = el('div', { class: `dc-portrait k-section wd-portrait wd-mist${fog === 'Sensed' ? ' is-sensed' : ''}` },
    el('div', { class: 'dc-portrait-mask' },
      ...(fog === 'Sensed' && spriteUrl(groundSprite(bh)) !== null ? [spriteImgAt(spriteUrl(groundSprite(bh))!, 'dc-portrait-art wd-mist-ground')] : []),
      ...(spriteUrl('fog_cloud') !== null ? [spriteImgAt(spriteUrl('fog_cloud')!, 'wd-mist-cloud')] : [])),
    ...(['tl', 'tr', 'bl', 'br'] as const).map((corner) => el('span', { class: `dc-orn is-${corner}`, 'aria-hidden': 'true' })));
  const hex = el('div', { class: 'dc-head' }, mist,
    el('div', { class: 'dc-what-col' },
      distanceLine(game, index),
      el('div', { class: 'dc-what' }, fog === 'Sensed'
        ? 'Shapes in the mist. Send an explorer to see it.'
        : 'Nobody has been this way.')));

  const route = explorerRoute(state, index);
  const work = exploreWorkMs(state, index) / 1000;
  const there = route === null ? 0 : (outboundMs(route.stepMs) + homeboundMs(route.stepMs)) / 1000 + work;
  let reason: string | undefined;
  if (route === null) reason = 'No way there through explored ground';
  else if (freeExplorers(state) === 0) reason = explorersOutLine(state, nextFreeAt(state), now);
  // The first trip is the tutorial's: no Gold, and the button says so.
  const explore = trip !== null ? null : coach(btn({
    label: 'Explore', kind: 'primary', cost: { Gold: exploreGold(state, index) }, have: (c: CurrencyId) => game.walletValue(c),
    ...(firstTripFree(state) ? { note: 'Free' } : {}),
    disabledReason: reason,
    onClick: () => game.doSendExplorer(),
  }), 'explore');
  const exploreHead = el('div', { class: 'dc-head' },
    portrait('whex_explorer', 'compass'),
    el('div', { class: 'dc-what-col' },
      el('p', { class: 'wd-name' }, 'Send an explorer'),
      el('div', { class: 'dc-what' }, 'It explores the hex, then waits there for you.')),
    ...(explore === null ? [] : [el('div', { class: 'dc-upgrade' }, explore)]));
  const blocked = reason === undefined || trip !== null ? [] : [blockedLine(reason)];
  const journey = route === null ? [] : [tiles([
    { icon: 'compass', label: 'There and back', value: formatDuration(Math.round(there)) },
    { icon: 'hourglass', label: 'To explore', value: formatDuration(Math.round(work)) },
  ])];

  // What the explorer brings home, priced as of now (19 §3.2).
  const pays: HTMLElement[] = [];
  if (fog === 'Sensed' && bh.scout !== null) {
    const pay = scoutPay(state, bh.scout, bh.role, index);
    const rewards: Tile[] = pay.pack !== null
      ? [{ icon: 'pack', label: `${pay.pack} pack`, value: '+1' }]
      : [...Object.entries(pay.wallet), ...Object.entries(pay.goods)].map(([c, n]) => ({
        icon: c as IconName, label: c === 'HeroXp' ? 'Hero XP' : c, value: `+${formatShort(n as number)}`,
      }));
    if (rewards.length > 0) pays.push(sectionHead('Exploring it pays'), tiles(rewards));
  }

  return sheet({ title, onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' },
      sectionHead('The hex'), hex,
      sectionHead('Explore'), exploreHead, ...blocked, ...journey, ...(trip === null ? [] : [trip]),
      ...pays));
}

// ------------------------------------------------------------ a camp


/** The ground in one line — terrain, feature, the march across it — and,
 *  on a tap, what it does to each troop type in a fight (19 §4.2). */
function groundStrip(game: Game, bh: BoardHex): HTMLElement {
  const feature = bh.features[0];
  const name = feature !== undefined ? FEATURE_NAME[feature] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
  const edges = groundEdges(bh).map((e) =>
    `${TYPE_WORD[e.unit] ?? e.unit} ${e.attack > 0 ? '+' : '−'}${formatExact(Math.round(Math.abs(e.attack) * 100))}% attack`);
  const strip = el('button', { class: 'wd-ground k-section', type: 'button' },
    ...groundTiles(game, bh).map((t) => el('span', { class: 'wd-ground-fact', 'aria-label': `${t.label} ${t.value}` },
      iconEl(t.icon, { size: 'md' }), el('span', { class: 'wd-ground-value', 'aria-hidden': 'true' }, t.value))));
  return withTooltip(strip, edges.length === 0 ? 'No effect on the fight' : edges.join(' · '), name);
}

/**
 * A MONSTER CAMP (m86c, compacted to fit one screen): the ground in one
 * line, the enemy — its difficulty a wax seal on its plank — what beating
 * it pays, and one row with its two answers: Negotiate, priced, and Attack,
 * which opens the deployment. With the player's army on its way, the
 * dungeon's dock instead: its board, its bar and Finish; once it is there,
 * its board, Withdraw and Attack — the fight is the player's to call. How far it is and what it looks like are the
 * board's; a raid it will make is the board's arrow.
 */
export function renderCamp(game: Game, bh: BoardHex): HTMLElement {
  const camp = bh.camp!;
  const index = bh.index;
  const source = game.worldSource();
  const difficulty = campDifficulty(camp.power, strongestParty(game.state));
  const enemy = enemyPanel(campSquads(source.board().seed, index, camp), camp.power, creatureFace);
  // A wax seal in the board's colour for it: green easy, gold fair, red hard.
  const wax = difficulty === 'Fair' ? 'is-fair' : difficulty === 'Hard' || difficulty === 'Deadly' ? 'is-hard' : 'is-easy';
  enemy.querySelector('.k-headpanel-head')?.prepend(el('span', { class: `wd-seal ${wax}` }, difficulty));
  const loot = (Object.entries(campLoot(game.state, camp.power)) as Array<[CurrencyId, number]>)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => el('span', { class: 'k-chip' }, currencyIcon(c, { size: 'sm' }), `+${formatShort(n)}`));
  // An army of the player's on its way: its board, its bar and Finish, as at
  // a dungeon. A march is not called back halfway, only hurried.
  const marching = game.worldView?.armies.find((a) => a.owner === game.worldSeat() && a.target === index && a.purpose === 'clear' && a.phase !== 'home');
  const reach = hexActions(source, game.worldSeat(), bh, { revealed: true }, [], game.worldBoost());
  const tribute = reach.find((a) => a.kind === 'tribute');
  const answers = marching?.phase === 'camp'
    // There and waiting: its board, then Withdraw and the Attack that fights.
    ? el('div', { class: 'dv-dock' },
      armyBoard(game, marching),
      el('div', { class: 'dv-calls' },
        btn({ label: 'Withdraw', kind: 'secondary', onClick: () => void game.doRecallArmy(marching.id) }),
        btn({
          label: 'Attack', kind: 'destructive', cost: { Mana: game.fightMana() }, have: (c: CurrencyId) => game.walletValue(c),
          onClick: () => void game.doFightCamp(marching.id),
        })))
    : marching !== undefined
    ? marchingDock(game, marching, 'On the way')
    : el('div', { class: 'wd-choices' },
      btn({
        label: 'Negotiate', kind: 'secondary',
        cost: tribute?.kind === 'tribute' ? tribute.cost : campTribute(camp.power),
        have: (c: CurrencyId) => game.walletValue(c),
        onClick: () => void game.doTributeCamp(index),
      }),
      btn({ label: 'Attack', kind: 'destructive', onClick: () => game.openArmy(index, 'clear') }));
  return sheet({ title: CAMP_TITLE[camp.creature], onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' },
      groundStrip(game, bh), enemy,
      // On its way, the fight is chosen: the army's board takes the pay's room.
      ...(loot.length === 0 || marching !== undefined ? [] : [sectionHead('Beaten, it pays'), el('div', { class: 'wd-loot' }, ...loot)]),
      answers));
}

// ------------------------------------------------------------ the Portal

/**
 * THE DARK PORTAL (m88): when it shuts or opens, the player's floor, their
 * place and the next floor's power, the ranking as the friends list's rows,
 * and Descend, which opens the descent (portalScreen.ts).
 */
export function renderPortal(game: Game, bh: BoardHex): HTMLElement {
  const index = bh.index;
  const source = game.worldSource();
  const p = source.portal();
  const now = game.now();
  const ribbon = p === null ? null : el('div', { class: 'wd-ribbon is-portal' }, iconEl('hourglass', { size: 'sm' }),
    p.open ? `Closes in ${formatCountdown(Math.max(0, p.closesAt - now) / 1000)}`
      : `Opens in ${formatCountdown(Math.max(0, p.opensAt - now) / 1000)}`);
  const art = el('div', { class: 'dc-portrait k-section wd-portrait' },
    el('div', { class: `dc-portrait-mask wd-portal-art${p?.open ? ' is-open' : ''}` }, portalPortrait(p?.open ?? false, 84)),
    ...(['tl', 'tr', 'bl', 'br'] as const).map((corner) => el('span', { class: `dc-orn is-${corner}`, 'aria-hidden': 'true' })));
  const head = el('div', { class: 'dc-head' }, art,
    el('div', { class: 'dc-what-col' },
      distanceLine(game, index),
      el('div', { class: 'dc-what' }, 'Nobody holds it, and nobody ever will.')));
  const floor = p?.floor ?? 0;
  const next = Math.min(WORLD_PORTAL.floors, floor + 1);
  // Where the player stands in the world's ranking: 0 before a first floor.
  const place = (p?.ranking ?? []).findIndex((r) => r.seat === game.worldSeat()) + 1;
  const stats = tiles([
    { icon: 'dungeon', label: 'Your floor', value: `${formatExact(floor)}/${formatExact(WORLD_PORTAL.floors)}` },
    { icon: 'star', label: 'Your place', value: place === 0 ? '—' : `#${formatExact(place)}` },
    { icon: 'power', label: 'Next floor', value: formatShort(floorPower(next)) },
  ]);
  // The ranking: the friends list's rows, the player's own lit.
  const me = game.worldSeat();
  const seats = source.seats();
  const ranked = (p?.ranking ?? []).map((r, i) => ({ ...r, rank: i + 1 }));
  const shown = ranked.slice(0, 5);
  const mine = ranked.find((r) => r.seat === me);
  if (mine !== undefined && !shown.includes(mine)) shown.push(mine);
  const rows = shown.map((r) => {
    const s = seats[r.seat];
    const name = s === undefined ? 'A kingdom' : s.owner.you ? 'You' : s.owner.name;
    return el('div', { class: `fr-row wd-rank${r.seat === me ? ' is-you' : ''}` },
      rankRibbon(r.rank),
      crestEl(s?.owner.name ?? '?', s?.owner.crest ?? null),
      el('div', { class: 'fr-who' }, el('div', { class: 'fr-name' }, name)),
      el('div', { class: 'fr-trail wd-rank-floor' }, `Floor ${formatExact(r.floor)}`));
  });
  // Descend: the descent, where the army is sent and the floors fought.
  const foot = [btn({ label: 'Descend', kind: 'blue', onClick: () => game.openPortalDescent(index) })];
  const shut = p === null || !p.open ? [blockedLine(p === null ? 'The Portal is shut' : `It opens in ${formatCountdown(Math.max(0, p.opensAt - now) / 1000)}`)] : [];
  return sheet({ title: 'The Dark Portal', onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' },
      ...(ribbon === null ? [] : [ribbon]),
      head, stats,
      ...(rows.length === 0 ? [] : [sectionHead('Ranking'), el('div', { class: 'wd-ranks' }, ...rows)]),
      ...shut,
      el('div', { class: 'wd-foot' }, ...foot)));
}

// ------------------------------------------------------------ a city

/**
 * A CITY (m89): the player's own — its shield, its deposits and the way to
 * trade for the rest — or a rival's: its shield, its Townhall when it is a
 * friend, its ground and its Portal floor, and Profile or Add friend. A
 * city is never attacked, and its card says so.
 */
export function renderCity(game: Game, bh: BoardHex): HTMLElement {
  const index = bh.index;
  const source = game.worldSource();
  const seat = bh.seat!;
  const s = source.seats()[seat];
  const name = s?.owner.name ?? 'A kingdom';
  const mine = s?.owner.you === true;
  const friendView = mine ? undefined : game.friends.snap?.friends.find((f) => f.nickname === name);
  const ground = source.board().hexes.filter((h) => source.hexOf(h.index)?.owner === seat).length;
  const floor = source.portal()?.ranking.find((r) => r.seat === seat)?.floor ?? 0;
  const level = mine ? (game.state.city.districts.find((d) => d.definitionId === 'Townhall')?.level ?? 1) : friendView?.townhall ?? 4;
  const head = el('div', { class: 'dc-head' },
    buildingPortrait(DISTRICTS.Townhall, level),
    el('div', { class: 'dc-what-col' },
      ...(friendView !== undefined ? [townhallTag(friendView.townhall)] : []),
      ...(mine ? [] : [distanceLine(game, index)]),
      el('div', { class: 'dc-what' }, mine ? 'Your province, seen from the world.' : 'Another kingdom. A city can never be attacked.')));
  const facts: Tile[] = [
    { icon: 'tile', label: 'Ground', value: `${formatExact(ground)} ${ground === 1 ? 'hex' : 'hexes'}` },
    { icon: 'dungeon', label: 'Portal floor', value: formatExact(floor) },
  ];
  const parts: HTMLElement[] = [head, tiles(facts)];
  const foot: HTMLElement[] = [];
  if (mine) {
    // What the kingdom's ground is rich in: its deal of deposits, 3/2/1
    // (Docs/plans/precious-deposits.md §1.2).
    const deal = source.board().deposits[seat];
    if (deal !== undefined) {
      parts.push(sectionHead('Deposits'), tiles((['strong', 'middle', 'weak'] as const).map((rank) => ({
        icon: deal[rank] as IconName, label: deal[rank], value: `×${formatExact(WORLD_GEN.deposits[rank].length)}`,
      }))));
      foot.push(btn({ label: 'Trade', kind: 'secondary', onClick: () => { game.friends.open(); game.friends.setTab('trade'); } }));
    }
  } else if (friendView !== undefined) {
    foot.push(btn({ label: 'Profile', kind: 'secondary', onClick: () => game.friends.openProfile(friendView.code) }));
  } else if (s !== undefined && !s.owner.you && game.friends.named()) {
    const asked = game.friends.snap?.outgoing.some((r) => r.nickname === name) === true;
    foot.push(btn({
      label: 'Add friend', kind: 'primary',
      disabledReason: asked ? 'Request sent' : game.friends.busy.has(name) ? 'Sending' : undefined,
      onClick: () => void game.friends.request(name).then(() => game.toast(`A request is on its way to ${name}`)),
    }));
  }
  const root = sheet({ title: name, onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' }, ...parts, ...(foot.length === 0 ? [] : [el('div', { class: 'wd-foot' }, ...foot)])));
  // The kingdom's shield, at the left of the plank.
  root.querySelector('.k-head')?.prepend(el('span', { class: 'wd-shield', 'aria-hidden': 'true' }, crestEl(name, s?.owner.crest ?? null, 'md')));
  return root;
}

// ------------------------------------------------------------ the deployment's widgets

/** What a troop type is called on a modifier's line. */
const TYPE_WORD: Partial<Record<UnitId, string>> = { Warrior: 'Warriors', Lancer: 'Lancers', Archer: 'Archers', Cavalry: 'Cavalry' };
const TYPE_ICON: Partial<Record<UnitId, IconName>> = { Warrior: 'typeWarrior', Lancer: 'typeLancer', Archer: 'typeArcher', Cavalry: 'typeCavalry' };

/** A widget on the deployment (m87b): a parchment plate with its header. */
const widget = (title: string, ...body: HTMLElement[]): HTMLElement =>
  el('div', { class: 'wd-widget k-section' }, el('div', { class: 'wd-widget-title' }, title), ...body);

/** LOOT: what winning the fight pays, as chips. */
export function lootWidget(pay: Partial<Record<CurrencyId, number>>): HTMLElement | null {
  const coins = (Object.entries(pay) as Array<[CurrencyId, number]>).filter(([, n]) => n > 0);
  if (coins.length === 0) return null;
  return widget('Loot', el('div', { class: 'wd-widget-chips' }, ...coins.map(([c, n]) => chip(c, n))));
}

/** TERRAIN: the ground the fight is on, the march there, and what the
 *  ground does to each troop type (19 §4.2). */
export function terrainWidget(bh: BoardHex, march: string): HTMLElement {
  const feature = bh.features[0];
  const name = feature !== undefined ? FEATURE_NAME[feature] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
  const lines = groundEdges(bh).map((e) => el('div', { class: `wd-edge${e.attack < 0 ? ' is-bad' : ' is-good'}` },
    iconEl(TYPE_ICON[e.unit] ?? 'army', { size: 'sm' }),
    `${TYPE_WORD[e.unit] ?? e.unit} ${e.attack > 0 ? '+' : '−'}${formatExact(Math.round(Math.abs(e.attack) * 100))}% attack`));
  const url = spriteUrl(groundSprite(bh));
  return widget('Terrain', el('div', { class: 'wd-widget-ground' },
    el('span', { class: 'wd-widget-art' }, url ? spriteImgAt(url, 'wd-slot-img') : iconEl('tile', { size: 'lg' })),
    el('div', { class: 'wd-widget-what' },
      el('div', { class: 'wd-widget-name' }, name),
      el('div', { class: 'wd-far' }, iconEl('boot', { size: 'sm' }), march),
      ...(lines.length === 0 ? [el('div', { class: 'wd-edge' }, 'No effect on the fight')] : lines))));
}

// ------------------------------------------------------------ a dungeon

/** The dungeon whose race list was last centred on the player's row, and
 *  when its card was last drawn. The card is drawn every tick; a gap longer
 *  than a few ticks means it was closed and opened again, and an opening is
 *  centred on the player's own row once, then left where they scroll. */
let centredRace: { index: number; drawnAt: number } | null = null;

/**
 * A DUNGEON (m90, after feedback): its ground does nothing to it, so no THE
 * HEX. DUNGEON — its entrance, who holds it, how deep the player has gone,
 * and Delve — then THE RACE: every kingdom in it as the world ranking's
 * rows, furthest first, scrolling in a space of its own and opened on the
 * player's own row. The player's army there is the board's, with its power.
 */
export function renderDungeon(game: Game, bh: BoardHex): HTMLElement {
  const index = bh.index;
  const source = game.worldSource();
  const info = game.worldView?.dungeonInfo?.find((d) => d.index === index);
  const per = WORLD_DUNGEON.roomsPerDepth;
  const total = WORLD_DUNGEON.depths * per;
  const cleared = source.delved(index);
  const room = nextRoom(cleared);
  const creature = info === undefined ? null : CAMP_CREATURE[info.creature];
  const head = el('div', { class: 'dc-head' },
    portrait('whex_mountain_dungeon', 'dungeon'),
    el('div', { class: 'dc-what-col' },
      el('div', { class: 'dc-what' }, `${creature === null ? '' : `Held by ${creature}. `}${
        WORLD_DUNGEON.depths === 3 ? 'Three' : formatExact(WORLD_DUNGEON.depths)} depths of ${formatExact(per)} rooms.`),
      distanceLine(game, index)),
    el('div', { class: 'dc-upgrade' }, btn({ label: 'Delve', kind: 'primary', onClick: () => game.openDelve(index) })));
  const progress = tiles(room === null
    ? [{ icon: 'tick', label: 'Cleared', value: 'To the bottom' }]
    : [
      { icon: 'dungeon', label: 'Depth', value: `${formatExact(room.depth + 1)}/${formatExact(WORLD_DUNGEON.depths)}` },
      { icon: 'skull', label: 'Room', value: `${formatExact(room.room)}/${formatExact(per)}` },
    ]);

  // THE RACE: the world ranking's rows, ranked by rooms cleared.
  const seen = new Map((game.worldRanking() ?? []).map((r) => [r.seat, r]));
  const me = game.worldSeat();
  let place = 0;
  let last = -1;
  const race = (info?.race ?? []).map((r, i) => {
    if (r.cleared !== last) { place = i + 1; last = r.cleared; }
    const k = seen.get(r.seat);
    const s = source.seats()[r.seat];
    const name = s?.owner.name ?? k?.name ?? 'A kingdom';
    const you = r.seat === me;
    return el('div', { class: `fr-row rk-row${you ? ' is-you' : ''}`, ...(you ? { 'data-you': 'true' } : {}) },
      rankRibbon(place),
      crestEl(name, k?.crest ?? s?.owner.crest ?? null),
      el('div', { class: 'fr-who' },
        el('div', { class: 'fr-name rk-name' }, you ? 'You' : name,
          ...(k?.friend ? [el('span', { class: 'rk-friend', title: 'A friend' }, iconEl('friends', { size: 'sm' }))] : [])),
        ...(k?.townhall == null ? [] : [el('div', { class: 'fr-sub' }, townhallTag(k.townhall))])),
      el('span', { class: 'rk-hexes wd-race-at' }, iconEl('dungeon', { size: 'md' }), `${formatExact(r.cleared)}/${formatExact(total)}`));
  });
  const list = el('div', { class: 'wd-race', 'data-keep-scroll': `race-${index}` }, el('div', { class: 'fr-rows' }, ...race));
  const drawnAt = performance.now();
  const opening = centredRace === null || centredRace.index !== index || drawnAt - centredRace.drawnAt > 1500;
  centredRace = { index, drawnAt };
  if (opening) {
    // Once the list is laid out, its middle on the player's own row.
    // The card may be drawn again before then, so the list is looked up live.
    globalThis.requestAnimationFrame?.(() => {
      const live = document.querySelector<HTMLElement>(`[data-keep-scroll="race-${index}"]`);
      const mine = live?.querySelector<HTMLElement>('[data-you]') ?? null;
      if (live == null || mine === null) return;
      const off = mine.getBoundingClientRect().top - live.getBoundingClientRect().top + live.scrollTop;
      live.scrollTop = off - (live.clientHeight - mine.offsetHeight) / 2;
    });
  }
  const last_ = info?.bosses[WORLD_DUNGEON.depths - 1] ?? 'its last boss';
  const surface = sheet({ title: info?.name ?? 'A dungeon', onClose: () => game.dismiss() },
    el('div', { class: 'wd-card wd-race-card' },
      sectionHead('Dungeon'), head, progress,
      sectionHead('The race'),
      el('p', { class: 'wd-far wd-race-line' },
        `First to beat ${last_} closes it for everyone, and is paid his chest ×${formatExact(WORLD_DUNGEON.closeRewardMultiplier)}`),
      race.length === 0 ? el('p', { class: 'wd-far' }, 'Nobody has cleared a room yet.') : list));
  // The card's body does not scroll; the race does, in what is left of it.
  surface.classList.add('is-panes');
  return surface;
}

// ------------------------------------------------------------ free ground

/**
 * FREE GROUND (m83b): THE HEX, then DISTRICT with its Build. `reason` says
 * why it cannot be built yet, when it cannot.
 */
export function renderFreeGround(game: Game, bh: BoardHex, title: string, reason: string | undefined): HTMLElement {
  const district = districtOf(bh)!;
  const def = WORLD_BUILD.districts[district];
  const source = game.worldSource();
  const held = source.board().hexes.filter((x) => source.hexOf(x.index)?.owner === game.worldSeat()).length;
  const gold = claimGold(held);
  const hex = el('div', { class: 'dc-head' },
    portrait(groundSprite(bh), 'tile'),
    el('div', { class: 'dc-what-col' }, distanceLine(game, bh.index)));
  const build = btn({
    label: 'Build', kind: 'primary', cost: { Gold: gold }, have: (c: CurrencyId) => game.walletValue(c),
    disabledReason: reason,
    onClick: () => void game.doClaimHex(bh.index, gold),
  });
  const districtHead = el('div', { class: 'dc-head' },
    portrait(DISTRICT_SPRITE[district], 'build'),
    el('div', { class: 'dc-what-col' },
      el('p', { class: 'wd-name' }, def.name),
      el('div', { class: 'dc-what' }, districtLine(bh, district))),
    el('div', { class: 'dc-upgrade' }, build));
  return sheet({ title, onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' },
      sectionHead('The hex'), hex, tiles(groundTiles(game, bh)),
      sectionHead('District'), districtHead, ...(reason === undefined ? [] : [blockedLine(reason)]),
      tiles([...yieldTiles(game, bh, null),
        { icon: 'hourglass', label: 'Build', value: formatDuration(worldBuildSeconds(district, 1, game.worldBoost())) }])));
}

// ------------------------------------------------------------ your district

/** What stands in each of a district's slots, in order: its buildings, then
 *  the empty ones. A building going up stands in its slot already. */
export function districtSlots(bh: BoardHex, h: HexControl): Array<{ building: WorldUpgrade; level: number; going: boolean } | null> {
  const district = districtOf(bh);
  const n = district === null ? 0 : WORLD_BUILD.districts[district].slots;
  const built: Array<{ building: WorldUpgrade; level: number; going: boolean }> = [];
  const level = (b: WorldUpgrade) => upgradeLevel({ fortress: h.fortress, chapel: h.chapel === true ? 1 : 0 }, b);
  for (const b of ['Fortress', 'Chapel'] as const) {
    const going = h.work?.upgrade === b;
    if (level(b) > 0 || going) built.push({ building: b, level: level(b), going });
  }
  return [...built, ...Array.from({ length: Math.max(0, n - built.length) }, () => null)];
}

/** One slot: its building's art, name and level — or the empty well. */
function slotEl(game: Game, index: number, slot: ReturnType<typeof districtSlots>[number], h: HexControl): HTMLElement {
  if (slot === null) {
    const b = el('button', { class: 'wd-slot is-empty', type: 'button', 'aria-label': 'Build here' },
      el('span', { class: 'hc-plus', 'aria-hidden': 'true' }, '+'),
      el('span', { class: 'wd-slot-name' }, 'Build here'));
    b.addEventListener('click', () => game.openWorldSlot(index));
    return b;
  }
  const name = WORLD_BUILD.upgrades[slot.building].name;
  const art = spriteUrl(buildingSprite(slot.building, slot.level));
  const b = el('button', { class: `wd-slot${slot.going ? ' is-going' : ''}`, type: 'button', 'aria-label': name },
    el('span', { class: 'wd-slot-art' }, art ? spriteImgAt(art, 'wd-slot-img') : iconEl('build', { size: 'lg' })),
    el('span', { class: 'wd-slot-name' }, name),
    ...(slot.building === 'Fortress' && slot.level > 0 ? [el('span', { class: 'wd-slot-level' }, `Lv ${formatExact(slot.level)}`)] : []),
    ...(slot.going ? [el('span', { class: 'wd-slot-level' }, iconEl('hourglass', { size: 'sm' }), 'Building')] : []));
  b.addEventListener('click', () => game.openWorldBuilding(index, slot.building));
  // A Chapel's relic socket at its top right: a tap opens the relic picker.
  if (slot.building === 'Chapel' && !slot.going) {
    const relic = h.relic == null ? null : game.relicCard(h.relic.id);
    const socket = el('button', { class: 'wd-socket', type: 'button', 'aria-label': relic === null ? 'Host a relic' : `Change ${relic.name}` },
      relic === null ? el('span', { class: 'hc-plus', 'aria-hidden': 'true' }, '+') : relicArt(relic, 'wd-socket-art'));
    socket.addEventListener('click', (e) => {
      e.stopPropagation();
      game.openChapelPicker(index);
    });
    return el('div', { class: 'wd-slot-wrap' }, b, socket);
  }
  return el('div', { class: 'wd-slot-wrap' }, b);
}

/**
 * THE PLAYER'S DISTRICT (m84c, m84d): one card. `extra` carries what the
 * dispatch sheet still says about it — being claimed, cut off, burnt, a
 * builder at work — as rows under the tiles.
 */
export function renderOwnDistrict(game: Game, bh: BoardHex, h: HexControl, extra: readonly HTMLElement[]): HTMLElement {
  const district = h.district;
  const def = WORLD_BUILD.districts[district];
  const head = el('div', { class: 'dc-head' },
    portrait(DISTRICT_SPRITE[district], 'build'),
    el('div', { class: 'dc-what-col' },
      el('div', { class: 'dc-what' }, districtLine(bh, district)),
      distanceLine(game, bh.index)));
  const slots = h.held ? districtSlots(bh, h) : [];
  return withShield(game, sheet({ title: def.name, onClose: () => game.dismiss() },
    el('div', { class: 'wd-card' },
      head,
      tiles([...yieldTiles(game, bh, h), ...groundTiles(game, bh).filter((t) => t.label !== 'Feature')]),
      ...extra,
      ...(slots.length === 0 ? [] : [
        sectionHead('Buildings'),
        el('div', { class: 'wd-slots' }, ...slots.map((s) => slotEl(game, bh.index, s, h))),
      ]))));
}

// ------------------------------------------------------------ the slot picker

/** Why a building cannot go into this district now, or undefined. */
function slotRefusal(game: Game, h: HexControl, b: WorldUpgrade): string | undefined {
  if (h.burnt) return 'Repair it first';
  if (!h.active) return 'Cut off from your city';
  if (h.work !== null) return 'A builder is at work here';
  // Its card in the Atlas, and how many the kingdom may hold.
  return upgradeBlocked(game.worldSource(), game.worldSeat(), b, game.worldBoost()) ?? undefined;
}

/** A building's card in the slot picker: the city's Build drawer card. A
 *  tap builds it, as a tap on a city card places it. */
function slotCard(game: Game, index: number, h: HexControl, b: WorldUpgrade): HTMLElement {
  const level = WORLD_BUILD.upgrades[b].levels[0];
  const goods = Object.entries(worldUpgradeGoods(game.state, b, 1)) as Array<[GoodId, number]>;
  const blocked = slotRefusal(game, h, b);
  const shortGold = game.walletValue('Gold') < level.gold;
  const shortGoods = goods.some(([g, n]) => getGood(game.state.city.goods, g) < n);
  const art = spriteUrl(buildingSprite(b, 1));
  const room = b === 'Chapel' ? chapelRoom(game.worldSource(), game.worldSeat(), game.worldBoost())
    : fortressRoom(game.worldSource(), game.worldSeat(), game.worldBoost());
  const card = el('button', { class: `bld-card${blocked !== undefined ? ' is-locked' : ''}`, type: 'button' },
    el('div', { class: 'bld-art' }, art ? spriteImgAt(art) : iconEl('build', { size: 'lg' })),
    el('div', { class: 'bld-name' }, WORLD_BUILD.upgrades[b].name),
    el('div', { class: 'bld-promise' }, BUILDING_LINE[b]),
    ...(blocked !== undefined ? [] : [el('div', { class: 'bld-cost' },
      costChips({ Gold: level.gold }, (c) => game.walletValue(c)),
      ...goods.map(([g, n]) => el('span', { class: `k-chip${getGood(game.state.city.goods, g) < n ? ' is-short' : ''}` },
        iconEl(g, { size: 'sm' }), el('span', {}, formatExact(n)))))]),
    el('div', { class: 'bld-foot' },
      el('span', { class: 'bld-foot-time' }, iconEl('hourglass', { size: 'sm' }), formatDuration(worldBuildSeconds(b, 1, game.worldBoost()))),
      ...(room.allowed === null ? [] : [el('span', { class: 'bld-foot-built' }, `Built ${formatExact(room.built)}/${formatExact(room.allowed)}`)])));
  if (blocked !== undefined) {
    card.disabled = true;
    card.querySelector('.bld-art')!.append(el('div', { class: 'bld-ribbon' }, iconEl('padlock', { size: 'sm' }), el('span', {}, blocked)));
    return card;
  }
  card.addEventListener('click', () => {
    if (shortGold || shortGoods) {
      if (shortGold) game.shake(['Gold']);
      card.classList.remove('is-refused');
      void card.offsetWidth; // restart the animation on a second tap
      card.classList.add('is-refused');
      return;
    }
    game.doBuildInSlot(index, b, level.gold);
  });
  return card;
}

/** THE SLOT PICKER (m84e): what can be built in an empty slot. */
export function renderWorldSlot(game: Game): HTMLElement {
  const index = game.selectedHex;
  const h = index === null ? null : game.worldSource().hexOf(index);
  if (index === null || h === null) return el('div');
  const standing = new Set(districtSlots(game.worldSource().board().hexes[index], h).flatMap((s) => (s === null ? [] : [s.building])));
  const offer = (['Fortress', 'Chapel'] as const).filter((b) => !standing.has(b));
  return sheet({ title: `Build in ${WORLD_BUILD.districts[h.district].name}`, onClose: () => game.backToHex() },
    el('div', { class: 'bld-row wd-slot-row' }, ...offer.map((b) => slotCard(game, index, h, b))));
}

// ------------------------------------------------------------ a building

/** A building's popup: what it does, and its next level. A Fortress also
 *  says who mans it; a Chapel shows its relic's socket. */
export function renderWorldBuilding(game: Game): HTMLElement {
  const index = game.selectedHex;
  const b = game.worldBuilding;
  const h = index === null ? null : game.worldSource().hexOf(index);
  if (index === null || b === null || h === null) return el('div');
  const def = WORLD_BUILD.upgrades[b];
  const level = upgradeLevel({ fortress: h.fortress, chapel: h.chapel === true ? 1 : 0 }, b);
  const back = () => game.backToHex();
  const parts: HTMLElement[] = [];
  const next = def.levels[level];
  const work = hexWork(h, game.worldBoost());
  const goingUp = h.work?.upgrade === b;
  // The next level, priced inside its button (the shipped cost style).
  let upgrade: HTMLElement[] = [];
  if (!goingUp && level > 0 && next !== undefined) {
    const goods = Object.entries(worldUpgradeGoods(game.state, b, level + 1)) as Array<[GoodId, number]>;
    upgrade = [el('div', { class: 'dc-upgrade' }, btn({
      label: 'Upgrade', kind: 'primary', cost: { Gold: next.gold }, have: (c: CurrencyId) => game.walletValue(c),
      costExtra: goods.map(([g, n]) => ({ icon: g, amount: formatCount(n), short: getGood(game.state.city.goods, g) < n })),
      disabledReason: h.work !== null ? 'A builder is at work here' : !h.active ? 'Cut off from your city' : h.burnt ? 'Repair it first' : undefined,
      onClick: () => void game.doUpgradeHex(index, b, level + 1, next.gold),
    }))];
  }
  parts.push(el('div', { class: 'dc-head' },
    portrait(buildingSprite(b, Math.max(1, level)), 'build'),
    el('div', { class: 'dc-what-col' },
      el('div', { class: 'dc-what' }, `${BUILDING_LINE[b]}.`),
      ...(next !== undefined && !goingUp && level > 0 ? [el('p', { class: 'wd-far' }, `Level ${formatExact(level + 1)} takes ${formatDuration(worldBuildSeconds(b, level + 1, game.worldBoost()))}`)] : [])),
    ...upgrade));
  if (goingUp && work !== null) parts.push(el('p', { class: 'wd-line' }, `${work.what} — ${formatDuration(Math.max(0, Math.ceil((work.endsAt - game.now()) / 1000)))} left`));
  if (b === 'Fortress' && level > 0) {
    const mine = h.garrison != null && h.garrison.owner === game.worldSeat();
    parts.push(sectionHead('Garrison'), action({
      label: mine ? 'Recall' : 'Garrison', kind: mine ? 'secondary' : 'primary',
      info: mine ? el('span', {}, 'An army of ', powerTag(h.garrison!.power), ' stands here') : 'Station an army here: it fights raiders and rivals',
      onClick: () => (mine ? void game.doRecallArmy(h.garrison!.army) : game.openArmy(index, 'garrison')),
    }));
  }
  if (b === 'Chapel' && h.chapel === true) {
    const relic = h.relic == null ? null : game.relicCard(h.relic.id);
    const socket = el('button', { class: 'wd-chapel-socket', type: 'button', 'aria-label': relic === null ? 'Host a relic' : `Change ${relic.name}` },
      relic === null ? emptyRelicSlot() : relicArt(relic, 'rl-art'),
      el('span', { class: 'wd-chapel-what' }, relic === null
        ? 'Empty — host a restored world relic'
        : `${ARTIFACTS[relic.id].name}, level ${formatExact(h.relic?.level ?? 0)}`));
    socket.addEventListener('click', () => game.openChapelPicker(index));
    parts.push(sectionHead('Relic'), socket);
  }
  return sheet({ title: level > 0 && b === 'Fortress' ? `${def.name} Lv ${formatExact(level)}` : def.name, onClose: back },
    el('div', { class: 'wd-card' }, ...parts));
}
