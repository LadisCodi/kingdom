// The Heroes screen — a roster of cards, and one card opened
// (Docs/features/10-heroes.md §8).
//
// It used to be a tab inside the Reliquary, on the argument that a hero and a
// relic share one collection ladder so they should share one screen. The
// argument was about the RULES; the screens have different jobs. A relic is
// something the player already holds when the screen opens — the decision is
// which passive to go without, so sockets come first and the collection is a
// list under them. A hero is a ROSTER: thirty-two faces, most of them not
// owned yet, and the thing the screen has to do is make the gaps visible.
// A list of rows cannot do that; a grid of portraits can, which is why every
// game with a roster draws one.
//
// So: a grid, and a detail behind each tile. Two views, one overlay — the
// nav tab stays put and `openHero` decides which of them draws.

import { COLLECTION, HERO_ORDER, HEROES } from '../sim/data/definitions';
import type { HeroDef, HeroRarity } from '../sim/data/definitions';
import { heroIsBusy } from '../sim/expeditions';
import { canUnlockHero, heroStats, heroUnlockCost, rosterView } from '../sim/heroes';
import { levelCost, tierCost } from '../sim/collection';
import { spriteUrl } from '../render/sprites';
import type { HeroId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { action, iconEl, knob, sheet, stat } from './kit';

/** Which hero's card is open, or null for the grid. Module-level so it
 *  survives the per-tick rebuild — the same reason the market's amount
 *  selector lives outside its render. */
let openHero: HeroId | null = null;

/** Reset to the grid. Called when the overlay closes, so re-opening the tab
 *  never lands the player back inside whoever they last read. */
export function resetHeroesView(): void {
  openHero = null;
}

/** Blue → violet → gold. The rarity is the tile's whole background, so the
 *  roster reads as a ladder before a single label is read. */
const RARITY_CLASS: Record<HeroRarity, string> = {
  Common: 'is-common', Rare: 'is-rare', Legendary: 'is-legendary',
};

/** A hero's portrait. The sheet is mixed — some are 128², some are tall
 *  42×74 — so the art is always CONTAINED in its box and never cropped. */
function heroArt(def: HeroDef, locked: boolean): HTMLElement {
  const url = spriteUrl(def.sprite);
  const cls = `hero-art${locked ? ' is-locked' : ''}`;
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} hero-art--glyph` }, def.glyph);
}

/** Ascension, as the stars the player counts rather than a number they read. */
function stars(tier: number): HTMLElement {
  const row = el('span', { class: 'hero-stars' });
  for (let i = 0; i < COLLECTION.maxTier; i++) {
    row.append(iconEl('star', { size: 'sm', locked: i >= tier, label: 'ascension' }));
  }
  return row;
}

type RosterEntry = ReturnType<typeof rosterView>[number];

/** Can this hero take a level or an ascension right now? The tile's green
 *  mark — the roster's job is to point at the one card worth opening. */
function ready(game: Game, view: RosterEntry): boolean {
  // An unfound hero with ten fragments is the most urgent card on the screen:
  // it is a hero the player already owns and has not noticed.
  if (!view.owned) return canUnlockHero(game.state, view.id);
  const canLevel = view.entry.level < view.levelCap
    && game.walletValue('Stardust') >= levelCost(view.entry.level);
  const canAscend = view.entry.tier < COLLECTION.maxTier
    && view.entry.fragments >= tierCost(view.entry.tier);
  return canLevel || canAscend;
}

// ------------------------------------------------------------------ the grid

function tile(game: Game, view: RosterEntry): HTMLElement {
  const def = HEROES[view.id];
  const t = el('button', {
    class: `hero-tile ${RARITY_CLASS[def.rarity]}${view.owned ? '' : ' is-locked'}`,
    type: 'button',
    'aria-label': def.name,
  });

  // Top-left: what it fights as. The type is the one fact that decides
  // whether this hero belongs in the party you are about to send, so it is
  // on the tile rather than one tap deeper.
  t.append(el('span', { class: 'hero-tile-type' }, iconEl(def.unitType, { size: 'sm' })));
  t.append(heroArt(def, !view.owned));

  if (view.owned) {
    t.append(el('span', { class: 'hero-tile-foot' },
      el('span', { class: 'hero-tile-level' }, `Lv ${view.entry.level}`),
      stars(view.entry.tier)));
    if (ready(game, view)) {
      t.append(el('span', { class: 'hero-tile-ready' }, iconEl('plus', { size: 'sm' })));
    }
  } else {
    // An unfound hero is a SIGNPOST, not a locked box: the fragment count is
    // the progress bar, so a silhouette is something to want rather than an
    // absence. Same treatment the locked relics get.
    t.append(el('span', { class: 'hero-tile-foot is-frag' },
      iconEl('sparkle', { size: 'sm' }),
      `${view.entry.fragments} / ${heroUnlockCost()}`));
    if (ready(game, view)) {
      t.append(el('span', { class: 'hero-tile-ready' }, iconEl('plus', { size: 'sm' })));
    }
  }

  t.addEventListener('click', () => {
    openHero = view.id;
    game.notify();
  });
  return t;
}

function grid(game: Game): HTMLElement {
  const roster = rosterView(game.state);
  // Owned first, then the gaps — both in roster order. That is the sort the
  // reference screens reach a dropdown for, and it needs no control at all.
  const ordered = [...roster.filter((h) => h.owned), ...roster.filter((h) => !h.owned)];
  const found = roster.filter((h) => h.owned).length;

  return el('div', { class: 'hero' },
    el('div', { class: 'hero-purse' },
      iconEl('Stardust', { size: 'lg' }),
      el('div', { class: 'hero-purse-body' },
        el('div', { class: 'hero-purse-title' }, `${game.walletValue('Stardust')} Stardust`),
        el('div', { class: 'hero-purse-hint' }, `${found} of ${roster.length} found`))),
    el('div', { class: 'hero-grid' }, ...ordered.map((view) => tile(game, view))),
    // The way to another hero. The banner lives in the store
    // (Docs/features/14-monetization.md §2.1) and moves to the Tavern when
    // that building lands, so the roster POINTS at it rather than holding a
    // copy of it.
    action({
      label: 'Call for aid',
      kind: 'gem',
      icon: 'star',
      onClick: () => game.setOverlay('store'),
      info: 'The banner is in the store. Every miss still pays fragments.',
    }),
  );
}

// ---------------------------------------------------------------- the detail

const RARITY_LABEL: Record<HeroRarity, string> = {
  Common: 'Common', Rare: 'Rare', Legendary: 'Legendary',
};

/** Step to the hero before or after this one, wrapping. Comparing two of them
 *  is most of what this screen is for, and a trip back through the grid to do
 *  it is three taps where this is one. */
function step(id: HeroId, by: 1 | -1): HeroId {
  const i = HERO_ORDER.indexOf(id);
  return HERO_ORDER[(i + by + HERO_ORDER.length) % HERO_ORDER.length]!;
}

function detail(game: Game, id: HeroId): HTMLElement {
  const def = HEROES[id];
  const view = rosterView(game.state).find((h) => h.id === id)!;
  const s = heroStats(game.state, id);
  const owned = view.owned;

  // The way back rides ON the portrait rather than above it. A row of its own
  // cost a band of the screen to say one word, and the card is a screen the
  // player scrolls — every pixel above the fold is the portrait's.
  // '←', not '‹': the step arrows are '‹' and '›', and two left-pointing
  // chevrons on the same edge meaning different things is a coin toss.
  const back = knob('←', () => { openHero = null; game.notify(); }, { label: 'All heroes' });
  back.classList.add('hero-back');

  const arrow = (by: 1 | -1) => knob(by === 1 ? '›' : '‹', () => {
    openHero = step(id, by);
    game.notify();
  }, { label: by === 1 ? 'Next hero' : 'Previous hero' });

  const stage = el('div', { class: `hero-stage ${RARITY_CLASS[def.rarity]}` },
    back,
    el('span', { class: 'hero-stage-type' },
      iconEl(def.unitType, { size: 'md' }),
      el('span', {}, def.unitType)),
    arrow(-1),
    heroArt(def, !owned),
    arrow(1),
    el('span', { class: 'hero-rarity' }, RARITY_LABEL[def.rarity]),
  );

  const body = el('div', { class: 'hero' },
    stage,
    el('div', { class: 'hero-title' },
      el('div', { class: 'hero-name' }, def.name),
      el('div', { class: 'hero-subtitle' }, def.title)),
  );

  if (!owned) {
    const short = heroUnlockCost() - view.entry.fragments;
    body.append(
      el('div', { class: 'hero-note' },
        short <= 0
          ? 'You have enough fragments. Recruit them.'
          : `Not yet found. ${short} more fragment${short === 1 ? '' : 's'} recruits them, `
            + 'and every miss on the banner pays some.'),
      el('div', { class: 'hero-ladder' },
        el('div', { class: 'hero-ladder-line' },
          el('span', { class: 'hero-ladder-label' }, 'Fragments'),
          el('b', {}, `${view.entry.fragments}`),
          el('span', { class: 'hero-ladder-cap' }, `of ${heroUnlockCost()}`))),
      // Two doors to the same hero, which is the whole point of the fragment:
      // the banner may hand them over outright, and a pile of ten buys them
      // whether or not it ever does (Docs/features/10-heroes.md §4).
      action({
        label: 'Recruit',
        kind: 'primary',
        onClick: () => game.doUnlockHero(id),
        costExtra: [{
          icon: 'sparkle',
          amount: `${view.entry.fragments} / ${heroUnlockCost()}`,
          short: short > 0,
        }],
      }),
      action({
        label: 'Call for aid',
        kind: 'gem',
        icon: 'star',
        onClick: () => game.setOverlay('store'),
      }),
    );
    return body;
  }

  // The two ladders, side by side, because they gate each other: a level is
  // refused by the tier above it, and the reason has to be visible in the
  // same glance as the button that is refused.
  body.append(el('div', { class: 'hero-ladder' },
    el('div', { class: 'hero-ladder-line' },
      el('span', { class: 'hero-ladder-label' }, 'Level'),
      el('b', {}, `${view.entry.level}`),
      el('span', { class: 'hero-ladder-cap' }, `of ${view.levelCap}`)),
    el('div', { class: 'hero-ladder-line' },
      el('span', { class: 'hero-ladder-label' }, 'Ascension'),
      stars(view.entry.tier)),
  ));

  body.append(el('div', { class: 'hero-statline' },
    stat('army', String(s.atk), 'atk'),
    stat('padlock', String(s.def), 'def'),
    stat('population', String(s.hp), 'hp'),
  ));

  body.append(el('div', { class: 'hero-passive' },
    iconEl('sparkle', { size: 'sm' }), def.traitText));

  if (heroIsBusy(game.state, id)) {
    body.append(el('div', { class: 'hero-note' }, 'Currently underground.'));
  }

  if (view.entry.level < COLLECTION.maxLevel) {
    body.append(action({
      label: 'Train',
      onClick: () => game.doLevelHero(id),
      cost: { Stardust: levelCost(view.entry.level) },
      have: (c) => game.walletValue(c),
      disabledReason: view.entry.level >= view.levelCap
        ? 'Their ascension holds them back' : undefined,
    }));
  }
  if (view.entry.tier < COLLECTION.maxTier) {
    body.append(action({
      label: 'Ascend',
      onClick: () => game.doRaiseHeroTier(id),
      // Fragments are a per-hero counter rather than a wallet row, but a
      // price is a price: it goes in the button like every other one, reading
      // "have / needed" so the gap is the thing you see.
      costExtra: [{
        icon: 'sparkle',
        amount: `${view.entry.fragments} / ${tierCost(view.entry.tier)}`,
        short: view.entry.fragments < tierCost(view.entry.tier),
      }],
      info: view.entry.fragments < tierCost(view.entry.tier)
        ? 'Pull for them, or delve again' : undefined,
    }));
  }
  return body;
}

export function renderHeroesSheet(game: Game): HTMLElement {
  // A hero the save no longer has cannot be open — the roster is fixed, but
  // a reset save is not, and a stale id would draw a card for nobody.
  if (openHero !== null && !(openHero in HEROES)) openHero = null;
  const open = openHero;
  if (open === null) {
    return sheet({ title: 'Heroes', onClose: () => game.dismiss() }, grid(game));
  }
  // The card is BARE: its portrait and its name are the title, and a plank
  // above them would print the name twice. The back knob on the portrait is
  // the way out, and tapping beside the sheet still closes the screen.
  return sheet(
    { title: HEROES[open].name, onClose: () => game.dismiss(), bare: true },
    detail(game, open),
  );
}
