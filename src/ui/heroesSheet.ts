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
import {
  ascensionStardustCost, canUnlockHero, heroStats, heroUnlockCost, rosterView,
} from '../sim/heroes';
import { levelCost, tierCost } from '../sim/collection';
import { spriteUrl } from '../render/sprites';
import type { HeroId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { action, btn, iconEl, knob, sheet, stat } from './kit';

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

/** Ascension, as the stars the player counts rather than a number they read.
 *  `big` is the card's row, which rides on the portrait and is the loudest
 *  thing under it; the tile's is the same row at icon size. */
function stars(tier: number, big = false): HTMLElement {
  const row = el('span', { class: `hero-stars${big ? ' is-big' : ''}` });
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

  // The foot rides ON the portrait's lower edge. The stars are the loudest
  // thing on the card after the art itself — ascension is the ladder the
  // player is chasing, and a row of 16px pips said so in a whisper.
  const foot = el('div', { class: 'hero-stage-foot' });
  foot.append(stars(view.entry.tier, true));
  if (owned) {
    if (view.entry.tier < COLLECTION.maxTier) {
      const toll = ascensionStardustCost(view.entry.tier);
      const shortFragments = view.entry.fragments < tierCost(view.entry.tier);
      const ascend = btn({
        label: 'Ascend',
        kind: 'primary',
        onClick: () => game.doRaiseHeroTier(id),
        // Both prices, inside the button that spends them: the Stardust toll
        // is a wallet row, the fragments are a counter beside the hero, and
        // one shown without the other is a button whose refusal has no reason.
        cost: { Stardust: toll },
        have: (c) => game.walletValue(c),
        costExtra: [{
          icon: 'sparkle',
          amount: `${view.entry.fragments} / ${tierCost(view.entry.tier)}`,
          short: shortFragments,
        }],
      });
      ascend.classList.add('hero-ascend');
      foot.append(ascend);
    }
  }

  const stage = el('div', { class: `hero-stage ${RARITY_CLASS[def.rarity]}` },
    back,
    el('span', { class: 'hero-rarity' }, RARITY_LABEL[def.rarity]),
    el('span', { class: 'hero-stage-type' },
      iconEl(def.unitType, { size: 'md' }),
      el('span', {}, def.unitType)),
    arrow(-1),
    heroArt(def, !owned),
    arrow(1),
    foot,
  );

  const body = el('div', { class: 'hero' },
    stage,
    el('div', { class: 'hero-title' },
      el('div', { class: 'hero-name' }, def.name),
      el('div', { class: 'hero-subtitle' }, def.title)),
  );

  // AN UNOWNED HERO GETS THE SAME CARD. What the player is deciding is whether
  // to chase this one, and that is a question about its stats, its type and
  // its passive — the card used to answer none of them and show a fragment
  // bar instead, which is a progress meter for a thing it never described.
  body.append(el('div', { class: 'hero-statline' },
    stat('army', String(s.atk), 'atk'),
    stat('padlock', String(s.def), 'def'),
    stat('population', String(s.hp), 'hp'),
  ));

  body.append(el('div', { class: 'hero-passive' },
    iconEl('sparkle', { size: 'sm' }), def.traitText));

  if (owned && heroIsBusy(game.state, id)) {
    body.append(el('div', { class: 'hero-note' }, 'Currently underground.'));
  }

  // THE FOOT WIDGET: one reading and one button, whichever pair is true.
  //
  // Owned, it is the level and Train — they were a number in one box and a
  // button four rows below it, which is two places to look for one decision.
  // Unowned, it is the fragment count and the way to get more of them: the
  // banner, or Recruit once ten have piled up. Same shape either way, so the
  // card does not reshuffle itself the moment the hero is yours.
  if (!owned) {
    const enough = view.entry.fragments >= heroUnlockCost();
    body.append(el('div', { class: 'hero-level' },
      el('div', { class: 'hero-level-read' },
        el('span', { class: 'hero-level-label' }, 'Fragments'),
        el('b', {}, `${view.entry.fragments}`),
        el('span', { class: 'hero-level-cap' }, `of ${heroUnlockCost()}`)),
      // Two doors to the same hero, which is the whole point of the fragment:
      // the banner may hand them over outright, and a pile of ten buys them
      // whether or not it ever does (Docs/features/10-heroes.md §4.1). One
      // button, whichever door is open.
      enough
        ? btn({
          label: 'Recruit',
          kind: 'primary',
          onClick: () => game.doUnlockHero(id),
          costExtra: [{
            icon: 'sparkle', amount: `${heroUnlockCost()}`, short: false,
          }],
        })
        : btn({
          label: 'Call for aid',
          kind: 'gem',
          icon: 'star',
          onClick: () => game.setOverlay('store'),
        }),
    ));
    return body;
  }

  const levelled = view.entry.level >= COLLECTION.maxLevel;
  body.append(el('div', { class: 'hero-level' },
    el('div', { class: 'hero-level-read' },
      el('span', { class: 'hero-level-label' }, 'Level'),
      el('b', {}, `${view.entry.level}`),
      el('span', { class: 'hero-level-cap' },
        levelled ? 'at the ceiling' : `of ${view.levelCap}`)),
    ...(levelled ? [] : [btn({
      label: 'Train',
      kind: 'primary',
      onClick: () => game.doLevelHero(id),
      cost: { Stardust: levelCost(view.entry.level) },
      have: (c) => game.walletValue(c),
      disabledReason: view.entry.level >= view.levelCap
        ? 'Their ascension holds them back' : undefined,
    })]),
  ));
  if (!levelled && view.entry.level >= view.levelCap) {
    body.append(el('div', { class: 'hero-note' },
      'Their ascension holds them back — raise it with fragments.'));
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
    {
      title: HEROES[open].name,
      onClose: () => game.dismiss(),
      bare: true,
      // Centred, not anchored to the bottom edge. A drawer is something you
      // pull up over a screen you are still working with; the card is the
      // whole of what the player is doing, so it sits in the middle.
      centred: true,
    },
    detail(game, open),
  );
}
