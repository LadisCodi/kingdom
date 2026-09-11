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
// So: a grid, and a detail behind each tile. Two views, one overlay — the nav
// tab stays put and `game.openHeroId` decides which of them draws. That lives
// on the presenter, not here, for the reason `expeditionRuin` does: it
// survives the per-tick rebuild and it is node-testable.
//
// THE SCREEN DOES NOT REBUILD ON THE TICK. It draws thirty-two `<img>`
// portraits and nothing on it is time-dependent, so it opts out through
// `game.heroesSignature()` (src/ui/kit/host.ts). Recreating those images once
// a second made the grid blink, because a fresh `<img>` decodes before its
// first paint.

import { COLLECTION, HERO_ORDER, HEROES } from '../sim/data/definitions';
import type { HeroDef, HeroRarity } from '../sim/data/definitions';
import {
  ascensionStardustCost, canUnlockHero, heroStats, heroUnlockCost, rosterView,
} from '../sim/heroes';
import { tierCost, xpLevelCost } from '../sim/collection';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { HeroId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { action, btn, iconEl, knob, sheet, stat } from './kit';

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
    ? spriteImgAt(url, cls)
    : el('div', { class: `${cls} hero-art--glyph` }, def.glyph);
}

/** Ascension, as the stars the player counts rather than a number they read.
 *  `big` is the card's row, which rides on the portrait and is the loudest
 *  thing under it; the tile's is the same row at icon size. */
function stars(tier: number, big = false): HTMLElement {
  const row = el('span', { class: `hero-stars${big ? ' is-big' : ''}` });
  for (let i = 0; i < COLLECTION.maxTier; i++) {
    row.append(iconEl('ascension', { size: 'sm', locked: i >= tier, label: 'ascension' }));
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
    && game.walletValue('HeroXp') >= xpLevelCost(view.entry.level);
  const canAscend = view.entry.tier < COLLECTION.maxTier
    && view.entry.fragments >= tierCost(view.entry.tier);
  return canLevel || canAscend;
}

// ------------------------------------------------------------------ the grid

function tile(game: Game, view: RosterEntry): HTMLElement {
  const def = HEROES[view.id];
  const t = el('button', {
    class: `hero-tile ${RARITY_CLASS[def.rarity]} is-${def.unitType}${view.owned ? '' : ' is-locked'}`,
    type: 'button',
    'aria-label': def.name,
  });

  // Top-left: what it fights as. The type is the one fact that decides
  // whether this hero belongs in the party you are about to send, so it is
  // on the tile rather than one tap deeper — and it is the WORD, matching the
  // card, because four unit icons at 16px are four similar silhouettes.
  t.append(el('span', { class: 'hero-type is-tile' }, def.unitType));
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
      iconEl('fragment', { size: 'sm' }),
      `${view.entry.fragments} / ${heroUnlockCost()}`));
    if (ready(game, view)) {
      t.append(el('span', { class: 'hero-tile-ready' }, iconEl('plus', { size: 'sm' })));
    }
  }

  t.addEventListener('click', () => {
    game.openHeroId = view.id;
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
    // The two purses this screen spends from are on the PLANK while it is
    // open (`Game.visibleCurrencies`), so this row keeps only the one thing
    // the header cannot say.
    el('div', { class: 'hero-purse' },
      el('div', { class: 'hero-purse-found' }, `${found} of ${roster.length} found`)),
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

  // A CLOSE, top-right, not a back arrow top-left. The card is a modal over
  // the roster now, and what closes a modal is a cross in the corner every
  // other sheet in the game puts one in — an arrow pointing left beside two
  // arrows that step the roster was one glyph too many on that edge.
  const close = knob('✕', () => { game.openHeroId = null; game.notify(); }, {
    label: 'Close',
  });
  close.classList.add('hero-close');

  const arrow = (by: 1 | -1) => knob(by === 1 ? '›' : '‹', () => {
    game.openHeroId = step(id, by);
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
          icon: 'fragment',
          amount: `${view.entry.fragments} / ${tierCost(view.entry.tier)}`,
          short: shortFragments,
        }],
      });
      ascend.classList.add('hero-ascend');
      foot.append(ascend);
    }
  }

  const stage = el('div', { class: `hero-stage ${RARITY_CLASS[def.rarity]}` },
    // Top-left, the corner the back arrow gave up. A PILL WITH THE NAME and
    // no icon: the icon was a second way of saying the same word, at a size
    // where the four unit marks are hard to tell apart anyway.
    el('span', { class: 'hero-type' }, def.unitType),
    close,
    el('span', { class: 'hero-rarity' }, RARITY_LABEL[def.rarity]),
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
    stat('atk', String(s.atk), 'atk'),
    stat('def', String(s.def), 'def'),
    stat('hp', String(s.hp), 'hp'),
  ));

  body.append(el('div', { class: 'hero-passive' },
    iconEl('sparkle', { size: 'sm' }), def.traitText));


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
            icon: 'fragment', amount: `${heroUnlockCost()}`, short: false,
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

  const levelled = view.entry.level >= COLLECTION.heroMaxLevel;
  const capped = !levelled && view.entry.level >= view.levelCap;

  // At the ascension's ceiling the widget goes away entirely and says what to
  // do instead. A disabled button with a reason beside it is still a button
  // offering a press, and the press is not the answer here — the answer is
  // the Ascend on the portrait, which the message points at.
  if (capped) {
    body.append(el('div', { class: 'hero-level is-capped' },
      el('div', { class: 'hero-level-read' },
        el('span', { class: 'hero-level-label' }, 'Level'),
        el('b', {}, `${view.entry.level}`),
        el('span', { class: 'hero-level-cap' }, `of ${view.levelCap}`)),
      el('div', { class: 'hero-level-block' },
        iconEl('ascension', { size: 'sm' }),
        'Ascend them to go further')));
    return body;
  }

  body.append(el('div', { class: 'hero-level' },
    el('div', { class: 'hero-level-read' },
      el('span', { class: 'hero-level-label' }, 'Level'),
      el('b', {}, `${view.entry.level}`),
      el('span', { class: 'hero-level-cap' },
        levelled ? 'at the ceiling' : `of ${view.levelCap}`)),
    ...(levelled ? [] : [btn({
      label: 'Level Up',
      kind: 'primary',
      onClick: () => game.doLevelHero(id),
      cost: { HeroXp: xpLevelCost(view.entry.level) },
      have: (c) => game.walletValue(c),
    })]),
  ));
  return body;
}

export function renderHeroesSheet(game: Game): HTMLElement {
  // A hero the save no longer has cannot be open — the roster is fixed, but
  // a reset save is not, and a stale id would draw a card for nobody.
  if (game.openHeroId !== null && !(game.openHeroId in HEROES)) game.openHeroId = null;
  const open = game.openHeroId;
  if (open === null) {
    // Tall: a roster is a screen the player works in, and a drawer that
    // grew and shrank with the grid would move its own rows.
    return sheet({ title: 'Heroes', onClose: () => game.dismiss(), tall: true }, grid(game));
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
