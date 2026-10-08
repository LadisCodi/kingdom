// WHAT THE NOTICES SAY (Docs/features/26-notices.md §2–§6): the column's
// bubbles, in the order it shows them, and what each one's card holds.
//
// A NEWS bubble is a group of the inbox (sim/notices.ts); a STATE bubble is
// read off the game on every notify, and goes when it stops being true. Each
// notice says what it shows (its art), where Go takes the player, and its
// second button. Nothing here changes the game but those buttons.

import { siteBanner, type Game } from '../../game';
import { ABANDONED, ARTIFACTS, DISTRICTS, GOODS, HEROES, LAIRS, LANDMARKS, STORE, TROOPS, WORLD_PORTAL } from '../../sim/data/definitions';
import type { BannerId } from '../../sim/data/definitions';
import { lairCreature } from '../../sim/lairs';
import { NEWS_GROUPS, type News, type NewsGroup } from '../../sim/notices';
import type { Coord, HeroId, LairId } from '../../sim/state';
import { homeIndex } from '../../sim/world/explorers';
import { buildingArtUrl, spriteImg, spriteUrl } from '../../render/sprites';
import { LAIR_AVATAR } from '../../render/lairMap';
import { el, formatCount, formatExact } from '../format';
import { iconEl, type IconName } from '../kit';
import { worldBuildDone } from '../world/worldActions';
import { CAMP_TITLE } from '../world/hexNames';

/** What a bubble or a card draws: built fresh each time it is asked for. */
export interface Art {
  /** Names the picture, so a bubble redraws only when it changes. */
  key: string;
  make: () => HTMLElement;
}

/** Which view a notice's subject is in. */
export type View = 'province' | 'world';

/** One line of a card: a news of a group, or a notice on the +N card. */
export interface NoticeRow {
  art: Art;
  name: string;
  line: string;
  go: (() => void) | null;
  /** On the +N card: the notice this row opens. */
  opens?: string;
}

/** A second button: a verb, and what it does. */
export interface NoticeAction {
  label: string;
  run: () => void;
  /** Drawn by the caller instead of a plain button (the relic's Activate). */
  make?: () => HTMLElement;
}

export interface Notice {
  /** `news:<group>`, `state:<name>`, or `more`. */
  id: string;
  kind: 'news' | 'state' | 'more';
  art: Art;
  /** The red seal's number: a group of two or more, or the +N. */
  count: number;
  /** A countdown under the bubble, to this epoch ms. */
  until: number | null;
  /** Ready to claim: the bubble glows. */
  glow: boolean;
  /** Where its subject is, when it has one place. */
  view: View | null;
  title: string;
  body: string;
  /** The wide picture of a one-line card. */
  picture: Art | null;
  /** A group's lines; a single news or a state has none. */
  rows: NoticeRow[];
  go: (() => void) | null;
  action: NoticeAction | null;
  /** What a tap on the bubble does instead of opening its card: a standing
   *  offer whose own menu already says it all (the Mana refill). */
  tap?: () => void;
  /** The bubble's tone: a threat is red. */
  tone: 'plain' | 'threat';
}

// ----------------------------------------------------------------- art

const icon = (name: IconName): Art => ({ key: `icon:${name}`, make: () => iconEl(name, { size: 'lg' }) });

const picture = (url: string | null, fallback: IconName, key: string): Art => ({
  key,
  make: () => (url === null ? iconEl(fallback, { size: 'lg' }) : imgOf(url)),
});

function imgOf(url: string): HTMLElement {
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.draggable = false;
  img.className = 'nt-img';
  return img;
}

/** A building at its level: the highest tier of art at or below it. */
function buildingArt(definitionId: keyof typeof DISTRICTS, level: number): Art {
  const def = DISTRICTS[definitionId];
  const url = buildingArtUrl(def.sprite, level);
  return {
    key: `building:${def.sprite}:${level}`,
    make: () => {
      const art = url === null ? iconEl(definitionId, { size: 'lg' }) : imgOf(url);
      art.classList.add('is-building');
      return art;
    },
  };
}

const lairArt = (lair: LairId): Art => picture(spriteUrl(LAIR_AVATAR[lair]), 'skull', `lair:${lair}`);

const heroArt = (id: HeroId): Art => picture(spriteUrl(HEROES[id].sprite), 'helmet', `hero:${id}`);

const spriteArt = (sprite: string, fallback: IconName): Art => ({
  key: `sprite:${sprite}`,
  make: () => spriteImg(sprite, 'nt-img') ?? iconEl(fallback, { size: 'lg' }),
});

/** The Dark Portal as the board draws it: shut, or open. */
const portalArt = (open: boolean): Art => spriteArt(open ? 'whex_portal_open' : 'whex_portal', 'dungeon');

// ---------------------------------------------------------- the news

/** Where a site stands in the province. */
function siteCell(id: string): Coord | null {
  return LANDMARKS.find((l) => l.id === id)?.location
    ?? Object.values(LAIRS).find((l) => l.id === id)?.location
    ?? ABANDONED.find((a) => a.id === id)?.location
    ?? null;
}

/** A news, as one line of its group's card and as a card of its own. */
interface NewsLine extends NoticeRow {
  title: string;
  body: string;
  view: View;
}

function newsLine(game: Game, n: News): NewsLine | null {
  switch (n.group) {
    case 'built': {
      const d = game.state.city.districts.find((x) => x.uniqueId === n.district);
      if (d === undefined) return null;
      const def = DISTRICTS[d.definitionId];
      const built = n.level === 1;
      return {
        art: buildingArt(d.definitionId, n.level),
        name: `${def.name} #${formatExact(d.ordinal)}`,
        line: built ? 'Built' : `Now level ${formatExact(n.level)}`,
        title: built ? 'Construction complete!' : 'Upgrade complete!',
        body: built ? def.description : `${def.name} is now level ${formatExact(n.level)}.`,
        go: () => game.focusDistrict(d.uniqueId),
        view: 'province',
      };
    }
    case 'trained': {
      const d = game.state.city.districts.find((x) => x.uniqueId === n.district);
      if (d === undefined) return null;
      const def = DISTRICTS[d.definitionId];
      const name = `${def.name} #${formatExact(d.ordinal)}`;
      return {
        art: buildingArt(d.definitionId, d.level),
        name,
        line: 'Queue done',
        title: 'Training complete',
        body: `${name} has trained its last ${TROOPS[n.unit].name} and stands idle. Queue more to keep it busy.`,
        go: () => game.focusDistrict(d.uniqueId),
        view: 'province',
      };
    }
    case 'goods': {
      const d = game.state.city.districts.find((x) => x.uniqueId === n.district);
      const good = GOODS[n.good];
      return {
        art: icon(n.good),
        name: good.name,
        line: `+${formatExact(n.count)}`,
        title: 'Goods ready',
        body: `${formatExact(n.count)} ${good.name} came off the workshop's bench.`,
        go: d === undefined ? null : () => game.focusDistrict(d.uniqueId),
        view: 'province',
      };
    }
    case 'raided': {
      const took = Object.entries(n.took).map(([c, amount]) => `${formatCount(amount ?? 0)} ${c}`).join(', ');
      return {
        art: lairArt(n.lair),
        name: `${lairCreature(n.lair)} raided the city`,
        line: took,
        title: 'The city was raided',
        body: `${lairCreature(n.lair)} came down from ${LAIRS[n.lair].name} and took ${took}. Clear the lair to get it back.`,
        go: () => game.showLair(n.lair),
        view: 'province',
      };
    }
    case 'sighted': {
      const b = siteBanner(n.site);
      const cell = siteCell(n.site);
      if (b === null) return null;
      return {
        art: b.sprite === undefined ? icon('compass') : spriteArt(b.sprite, 'compass'),
        name: b.name,
        line: b.title.replace(/!$/, ''),
        title: b.title,
        body: `${b.name}. ${b.desc}`,
        go: cell === null ? null : () => game.focusSite(cell),
        view: 'province',
      };
    }
    case 'worldBuild':
      return {
        art: icon('hex'),
        name: worldBuildDone(n.what, n.level),
        line: 'On the world map',
        title: 'Built on the world map',
        body: `${worldBuildDone(n.what, n.level)}.`,
        go: () => game.goToHex(n.hex),
        view: 'world',
      };
    case 'armyHome':
      return {
        art: icon('army'),
        name: 'Your army is home',
        line: n.fallen > 0
          ? `${formatCount(n.troops)} back, ${formatCount(n.fallen)} fell`
          : `${formatCount(n.troops)} back`,
        title: 'Your army is home',
        body: n.fallen > 0
          ? `${formatCount(n.troops)} soldiers came home; ${formatCount(n.fallen)} fell.`
          : `${formatCount(n.troops)} soldiers came home.`,
        go: () => game.goToHex(homeIndex(game.state)),
        view: 'world',
      };
    case 'world':
      return {
        art: icon(n.good ? 'hex' : 'power'),
        name: n.text,
        line: 'On the world map',
        title: n.good ? 'From the world' : 'Trouble abroad',
        body: `${n.text}.`,
        go: n.hex === undefined ? null : () => game.goToHex(n.hex!),
        view: 'world',
      };
    case 'portal':
      return n.open
        ? {
          art: portalArt(true),
          name: 'The Dark Portal is open',
          line: `For ${formatExact(WORLD_PORTAL.openDays)} days`,
          title: 'The Dark Portal is open',
          body: `For ${formatExact(WORLD_PORTAL.openDays)} days. Send an army down and clear its floors — the deepest divers win Gems when it closes.`,
          go: () => game.goToHex(game.nearestPortal()),
          view: 'world',
        }
        : {
          art: portalArt(false),
          name: 'The Dark Portal closed',
          line: `Placed ${formatExact(n.place)} of ${formatExact(n.of)}`,
          title: 'The Dark Portal closed',
          body: `You placed ${formatExact(n.place)} of ${formatExact(n.of)}, at floor ${formatExact(n.floor)}. It opens again in ${formatExact(7 - WORLD_PORTAL.openDays)} days.`,
          go: () => game.goToHex(game.nearestPortal()),
          view: 'world',
        };
    case 'event':
      return {
        art: icon('daily'),
        name: n.title,
        line: n.detail,
        title: n.title,
        body: n.detail,
        go: null,
        view: 'province',
      };
    case 'chainDone':
      return {
        art: icon('crest'),
        name: 'Your kingdom stands on its own',
        line: 'The chain is done',
        title: 'The chain is done',
        body: 'No more guidance — build whatever you like from here.',
        go: null,
        view: 'province',
      };
  }
}

/** A group's card title, for two or more. */
const GROUP_TITLE: Record<NewsGroup, (n: number) => string> = {
  built: (n) => `${formatExact(n)} buildings finished`,
  trained: () => 'Training complete',
  goods: () => 'Goods ready',
  raided: (n) => `${formatExact(n)} raids on the city`,
  sighted: (n) => `${formatExact(n)} new places`,
  worldBuild: (n) => `${formatExact(n)} builds on the world map`,
  armyHome: (n) => `${formatExact(n)} armies home`,
  world: () => 'From the world',
  portal: () => 'The Dark Portal',
  event: () => 'Events',
  chainDone: () => 'The chain is done',
};

/** A group of news as a notice: one card, or one line each. */
export function newsNotice(game: Game, group: NewsGroup, news: readonly News[]): Notice | null {
  const lines = news.flatMap((n) => {
    const line = newsLine(game, n);
    return line === null ? [] : [line];
  });
  if (lines.length === 0) return null;
  const lead = lines[0];
  const one = lines.length === 1;
  const views = new Set(lines.map((l) => l.view));
  return {
    id: `news:${group}`,
    kind: 'news',
    art: lead.art,
    count: lines.length,
    until: null,
    glow: false,
    view: views.size === 1 ? lead.view : null,
    title: one ? lead.title : GROUP_TITLE[group](lines.length),
    body: one ? lead.body : '',
    picture: one ? lead.art : null,
    rows: one ? [] : lines.map(({ art, name, line, go }) => ({ art, name, line, go })),
    go: one ? lead.go : null,
    action: null,
    tone: group === 'raided' ? 'threat' : 'plain',
  };
}

// ---------------------------------------------------------- the states

const BANNER_IDS: readonly BannerId[] = ['basic', 'advanced'];

function states(game: Game): Notice[] {
  const out: Notice[] = [];
  const base = { kind: 'state' as const, count: 0, until: null, glow: false, rows: [], picture: null, tone: 'plain' as const };

  // RAID COMING: the nearest raid of the open gates.
  const gates = (Object.keys(game.state.lairs) as LairId[]).flatMap((id) => {
    const at = game.state.lairs[id]?.nextRaidAt ?? null;
    return at === null || game.state.lairs[id]?.defeated ? [] : [{ id, at }];
  }).sort((a, b) => a.at - b.at);
  if (gates.length > 0) {
    const g = gates[0];
    out.push({
      ...base, id: 'state:raid', art: lairArt(g.id), count: gates.length > 1 ? gates.length : 0,
      until: g.at, view: 'province', tone: 'threat',
      title: `${lairCreature(g.id)} are coming`,
      body: gates.length > 1
        ? `${formatExact(gates.length)} lairs will raid the city's stores. Clear a lair to stop its raids.`
        : `${lairCreature(g.id)} from ${LAIRS[g.id].name} will raid the city's stores. Clear the lair to stop them.`,
      picture: lairArt(g.id),
      go: () => game.showLair(g.id),
      action: null,
    });
  }

  // MANA REFILL: the rewarded video, while it is offered.
  const ad = game.adOffer();
  if (ad !== null && game.adWatch() === null) {
    out.push({
      ...base, id: 'state:mana', art: icon('flask'), glow: true, view: null,
      title: 'A free refill',
      body: `Watch a short video for ${formatExact(ad.reward)} Mana.`,
      picture: icon('Mana'),
      go: null,
      action: { label: 'Watch', run: () => game.startAdWatch() },
      // The Mana sheet already offers the video beside the Gem refills.
      tap: () => game.openMana(),
    });
  }

  // RELIC ASLEEP: a city relic whose window has closed.
  const asleep = game.asleepNotice();
  if (asleep !== null) {
    const def = ARTIFACTS[asleep.relic];
    const art = spriteArt(def.sprite, 'relics');
    out.push({
      ...base, id: 'state:relic', art, count: asleep.count > 1 ? asleep.count : 0, view: 'province',
      title: asleep.count === 1 ? `${def.name} is asleep` : `${formatExact(asleep.count)} relics are asleep`,
      body: asleep.count === 1
        ? `Its window has closed. Wake it in its Shrine for ${formatExact(asleep.cost)} Mana.`
        : 'Their windows have closed. Wake each in its Shrine with Mana.',
      picture: art,
      go: () => game.openAsleepNotice(),
      action: null,
    });
  }

  // TOMORROW'S PART: a bought pack's next-day reward.
  const next = game.nextDayPill();
  if (next !== null) {
    out.push({
      ...base, id: 'state:nextDay', art: icon('chest'), until: next.ready ? null : next.at, glow: next.ready, view: null,
      title: next.ready ? 'Tomorrow’s reward is here' : 'Tomorrow’s reward',
      body: `The second part of ${STORE[next.sku].name}${next.ready ? ' is ready to claim.' : ' comes tomorrow.'}`,
      picture: icon('chest'),
      go: null,
      action: next.ready ? { label: 'Claim', run: () => game.openOfferSplash(next.sku) } : null,
    });
  }

  // PORTAL PRIZE: a closed opening's ranking Gems, waiting to be claimed.
  const prizes = game.portalPrizes();
  if (prizes.length > 0) {
    const lead = prizes[0];
    out.push({
      ...base, id: 'state:portalPrize', art: portalArt(false), count: prizes.length > 1 ? prizes.length : 0, glow: true, view: null,
      title: 'Portal reward',
      body: `The Dark Portal closed. You placed ${formatExact(lead.place)} of ${formatExact(lead.of)}, at floor ${formatExact(lead.floor)}: ${formatExact(lead.gems)} Gems.`,
      picture: icon('Gems'),
      go: null,
      action: { label: 'Claim', run: () => game.claimPortalPrize(lead.event) },
    });
  }

  // FREE CALL: a free pull waiting on a running banner.
  if (game.doorOpen('banner') && BANNER_IDS.some((b) => game.freePull(b).ready)) {
    out.push({
      ...base, id: 'state:freeCall', art: icon('SilverKey'), glow: true, view: null,
      title: 'A free call',
      body: 'A hero answers a free call today.',
      picture: icon('SilverKey'),
      go: () => game.openStore('heroes'),
      action: null,
    });
  }

  // ARMY READY: an army of the player's waits at a camp for the word to attack.
  // Read off the saved snapshot, so it shows in the province too.
  const ready = game.worldSource().armies()
    .filter((a) => a.owner === game.worldSeat() && a.purpose === 'clear' && a.phase === 'camp');
  if (ready.length > 0) {
    const lead = ready[0];
    const creature = game.worldSource().board().hexes[lead.target]?.camp?.creature;
    const art = creature === undefined ? icon('army') : spriteArt(`whex_camp_${creature.toLowerCase()}`, 'army');
    out.push({
      ...base, id: 'state:armyReady', art, count: ready.length > 1 ? ready.length : 0, glow: true, view: 'world',
      title: ready.length === 1 ? 'Your army is ready' : `${formatExact(ready.length)} armies are ready`,
      body: creature === undefined
        ? 'It waits at the camp. Attack when you are ready.'
        : `It waits at the ${CAMP_TITLE[creature].toLowerCase()}. Attack when you are ready.`,
      picture: art,
      go: () => game.goToHex(lead.target),
      action: null,
    });
  }

  // EXPLORER READY: an explorer's work is done, and it waits at its hex for
  // the player's tap. A tap on the bubble goes straight there, card shut:
  // the tap on the hex is what reveals it (19 §3.1).
  const waiting = game.explorersReady();
  if (waiting.length > 0) {
    const lead = waiting[0];
    const go = (): void => game.lookAtHex(lead.target);
    out.push({
      ...base, id: 'state:explorerReady', art: icon('compass'), count: waiting.length > 1 ? waiting.length : 0, glow: true,
      view: 'world',
      title: waiting.length === 1 ? 'Your explorer is waiting' : `${formatExact(waiting.length)} explorers are waiting`,
      body: 'The hex is explored. Tap it on the map to see what your explorer found.',
      picture: icon('compass'),
      go,
      action: null,
      tap: go,
    });
  }

  // HERO RESTED: a hero a fight exhausted is whole again.
  const rested = game.restedHeroes();
  if (rested.length > 0) {
    const lead = rested[0];
    out.push({
      ...base, id: 'state:heroRested', art: heroArt(lead), count: rested.length > 1 ? rested.length : 0, view: null,
      title: rested.length === 1 ? `${HEROES[lead].name} is rested` : `${formatExact(rested.length)} heroes are rested`,
      body: 'Whole again, and ready to fight.',
      picture: heroArt(lead),
      go: () => game.setOverlay('heroes'),
      action: null,
    });
  }
  return out;
}

// ---------------------------------------------------------- the column

/** Every notice, in the column's order (§3): the raid, the news newest
 *  first, then the other states. */
export function allNotices(game: Game): Notice[] {
  const st = states(game);
  const raid = st.filter((n) => n.id === 'state:raid');
  const rest = st.filter((n) => n.id !== 'state:raid');
  const groups = NEWS_GROUPS.map((g) => ({ g, news: game.state.notices.filter((n) => n.group === g) }))
    .filter((x) => x.news.length > 0)
    .sort((a, b) => b.news[0].at - a.news[0].at || NEWS_GROUPS.indexOf(a.g) - NEWS_GROUPS.indexOf(b.g));
  const news = groups.flatMap(({ g, news: list }) => {
    const n = newsNotice(game, g, list);
    return n === null ? [] : [n];
  });
  return [...raid, ...news, ...rest];
}

/** THE NEWS, newest first: what happened, waiting to be read — the
 *  column at the bottom. */
export const newsNotices = (game: Game): Notice[] => allNotices(game).filter((n) => n.kind === 'news');

/** THE STANDING NOTICES — something true now that stays until it is not (a
 *  raid coming, a refill offered, an army ready…): the larger column hung
 *  under the settings knob, the raid first. Never folded under a +N. */
export function standingNotices(game: Game): Notice[] {
  const st = states(game);
  return [...st.filter((n) => n.id === 'state:raid'), ...st.filter((n) => n.id !== 'state:raid')];
}

/** What the news column shows: every news while they fit, else the first
 *  `shown − 1` under a +N that opens them all. */
export function columnNotices(game: Game, shown: number): Notice[] {
  const all = newsNotices(game);
  if (all.length <= shown) return all;
  const kept = all.slice(0, shown - 1);
  const more = all.length - kept.length;
  return [moreNotice(all, more), ...kept];
}

function moreNotice(all: readonly Notice[], more: number): Notice {
  return {
    id: 'more', kind: 'more', art: { key: `more:${more}`, make: () => el('b', { class: 'nt-more' }, `+${formatExact(more)}`) },
    count: 0, until: null, glow: false, view: null, tone: 'plain',
    title: 'Notices', body: '', picture: null, go: null, action: null,
    rows: all.map((n) => ({ art: n.art, name: n.title, line: n.body, go: null, opens: n.id })),
  };
}

/** The card of the notice `id`: a news as it was when opened (`Game.
 *  noticeCard`), a state as it stands now. Null once there is nothing to say. */
export function noticeCardOf(game: Game): Notice | null {
  const card = game.noticeCard;
  if (card === null) return null;
  if (card.id === 'more') {
    const all = newsNotices(game);
    return all.length === 0 ? null : moreNotice(all, all.length);
  }
  if (card.id.startsWith('news:')) return newsNotice(game, card.id.slice('news:'.length) as NewsGroup, card.news);
  if (card.id === 'state:heroRested') {
    const lead = card.heroes[0];
    if (lead === undefined) return null;
    return {
      id: card.id, kind: 'state', art: heroArt(lead), count: 0, until: null, glow: false, view: null, tone: 'plain',
      title: card.heroes.length === 1 ? `${HEROES[lead].name} is rested` : `${formatExact(card.heroes.length)} heroes are rested`,
      body: 'Whole again, and ready to fight.',
      picture: card.heroes.length === 1 ? heroArt(lead) : null,
      rows: card.heroes.length === 1 ? [] : card.heroes.map((h) => ({
        art: heroArt(h), name: HEROES[h].name, line: 'Rested', go: () => game.setOverlay('heroes'),
      })),
      go: () => game.setOverlay('heroes'),
      action: null,
    };
  }
  return states(game).find((n) => n.id === card.id) ?? null;
}
