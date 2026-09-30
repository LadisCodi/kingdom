// The card for a map SITE — a landmark or a lair.
//
// These are what paid fog is FOR. A player who clears a distance-9 ring and
// finds one more iron vein has learned that exploring is a treadmill; a player
// who finds a shrine that pays Mana forever, or a lair worth clearing,
// has learned the opposite. So the card's job is to make the reward
// legible BEFORE the player spends anything — what it gives, what it costs,
// and, when it is out of reach, exactly what is missing.

import {
  FOG, LANDMARK_ART, MANA, type LandmarkDef, type LairDef,
} from '../sim/data/definitions';
import type { LairView } from '../sim/lairs';
import type { Game } from '../game';
import { landmarkClaimCost } from '../sim/landmarks';
import { manaCap } from '../sim/mana';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Coord } from '../sim/state';
import { landmarkDefAt, standingLairAt } from '../sim/sites';
import { el, formatDuration } from './format';
import { action, iconEl, panel, stat } from './kit';

/** The site art, at card size: the sprite if it exists, its glyph if not. */
function art(sprite: string, glyph: string): HTMLElement {
  const url = spriteUrl(sprite);
  return url
    ? spriteImgAt(url, 'site-art')
    : el('div', { class: 'site-art site-art--glyph' }, glyph);
}

function landmarkCard(game: Game, def: LandmarkDef): HTMLElement {
  const look = LANDMARK_ART[def.kind];
  const claimed = game.state.landmarks.claimed[def.id] === true;
  const cost = landmarkClaimCost(game.state, def);

  const body = el('div', { class: 'site' },
    el('div', { class: 'site-head' },
      art(look.sprite, look.glyph),
      el('div', {},
        el('div', { class: 'site-name' }, look.name),
        el('div', { class: 'site-kind' }, claimed ? 'Claimed' : 'Unclaimed'))),
    // The promise, stated as the two things it actually buys: a bigger pool
    // (which is also a bigger reward every time an ad refills it), and a
    // lantern held up over the map around it.
    el('div', { class: 'site-gift' },
      stat('Mana', `+${MANA.landmarkCap}`, 'to your pool, for good'),
      // `showme` is the "look over there" glyph the quest pill already uses,
      // and looking is exactly what a claim buys here — not owning.
      stat('showme', `${FOG.claimDiscoverRadius * 2 + 1}×${FOG.claimDiscoverRadius * 2 + 1}`,
        'of map uncovered')),
  );

  if (claimed) {
    body.append(el('div', { class: 'site-note' },
      iconEl('tick', { size: 'sm' }),
      // Spelled out against the running total, because the value of a claim
      // is what it made the ceiling, not the number on the tin.
      `Holding ${MANA.landmarkCap} more Mana. `
      + `Your pool: ${manaCap(game.state)}.`));
    return panel(body);
  }

  // What the claim actually buys, in the player's terms: a deeper pool means a
  // longer session AND a larger refill, because a refill fills the whole
  // thing. Relic upkeep is gone, so the old "how many relics you can wear"
  // framing would be describing a rule that no longer exists.
  body.append(el('div', { class: 'site-note' },
    `Claiming it holds ${MANA.landmarkCap} more Mana, for good — a longer run of `
    + 'taps, and more from every refill. It also lifts the fog for '
    + `${FOG.claimDiscoverRadius} cells around: you will see what is out there, `
    + 'though clearing it is still yours to pay for.'));

  body.append(action({
    label: 'Claim',
    kind: 'primary',
    onClick: () => game.doClaimLandmark(def.location),
    cost: { Gold: cost },
    have: (c) => game.walletValue(c),
  }));
  return panel(body);
}

/**
 * The lair's garrison, above everything else the card has to say.
 *
 * While it stands, the garrison is the decision, and it is on a clock. So the band carries the creature, the countdown, how
 * many trips are left in them and what they are holding, and the only button
 * on the card is the one that goes at them
 * (Docs/features/18-garrisons-and-raids.md §7).
 */
function lairBand(game: Game, def: LairDef, lair: LairView): HTMLElement {
  const left = lair.nextRaidAt === null
    ? null : Math.max(0, (lair.nextRaidAt - game.now()) / 1000);
  const hoard = Object.entries(lair.hoard).filter(([, n]) => n > 0);

  const band = el('div', { class: 'site-lair' },
    el('div', { class: 'site-lair-head' },
      iconEl(lair.threat === 'Any' ? 'army' : lair.threat, { size: 'md' }),
      el('div', {},
        el('div', { class: 'site-lair-name' }, `${lair.creature} hold the way in`),
        el('div', { class: 'site-lair-sub' }, left !== null
          ? `They will attack your city in ${formatDuration(left)}`
          : 'They are gone'))),
  );

  if (hoard.length > 0) {
    band.append(el('div', { class: 'site-lair-hoard' },
      hoard.map(([c, n]) => `${n} ${c}`).join(', ')
      + ' — cleared, it all comes back.'));
  }
  band.append(action({
    label: 'Clear the lair',
    kind: 'primary',
    onClick: () => game.openLair(def.id),
  }));
  return band;
}

function lairCard(game: Game, def: LairDef): HTMLElement {
  const body = el('div', { class: 'site' },
    el('div', { class: 'site-head' },
      art(def.sprite, def.glyph),
      el('div', {},
        el('div', { class: 'site-name' }, def.name),
        el('div', { class: 'site-kind' }, `Tier ${def.tier} lair`))),
    el('div', { class: 'site-desc' }, def.description),
  );

  // The garrison is the whole lair: while it stands it IS the card's
  // decision, and once it has fallen there is nothing behind it
  // (Docs/proposals/lairs.md §1).
  const lair = game.lairFor(def.id);
  if (lair !== null && !lair.cleared) {
    body.append(lairBand(game, def, lair));
  } else if (lair?.cleared === true) {
    body.append(el('div', { class: 'site-note' },
      iconEl('tick', { size: 'sm' }), 'Cleared. Nothing holds it now.'));
  }
  return panel(body);
}

/** Null when the cell holds no site — the caller then shows nothing. */
export function renderSiteCard(game: Game, cell: Coord): HTMLElement | null {
  const landmark = landmarkDefAt(cell);
  if (landmark) return landmarkCard(game, landmark);
  const lair = standingLairAt(game.state, cell);
  if (lair) return lairCard(game, lair);
  return null;
}
