// The card for a map SITE — a landmark or a ruin.
//
// These are what paid fog is FOR. A player who clears a distance-9 ring and
// finds one more iron vein has learned that exploring is a treadmill; a player
// who finds a shrine that pays Mana forever, or a dungeon that keeps paying for
// months, has learned the opposite. So the card's job is to make the reward
// legible BEFORE the player spends anything — what it gives, what it costs,
// and, when it is out of reach, exactly what is missing.

import {
  FOG, LANDMARK_ART, MANA, type LandmarkDef, type RuinDef,
} from '../sim/data/definitions';
import type { Game } from '../game';
import { landmarkClaimCost } from '../sim/landmarks';
import { manaCap } from '../sim/mana';
import { spriteUrl } from '../render/sprites';
import type { Coord } from '../sim/state';
import { landmarkDefAt, ruinDefAt } from '../sim/sites';
import { el, formatDuration } from './format';
import { action, iconEl, panel, stat } from './kit';

/** The site art, at card size: the sprite if it exists, its glyph if not. */
function art(sprite: string, glyph: string): HTMLElement {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: 'site-art', src: url, alt: '' })
    : el('div', { class: 'site-art site-art--glyph' }, glyph);
}

function landmarkCard(game: Game, def: LandmarkDef): HTMLElement {
  const look = LANDMARK_ART[def.kind];
  const claimed = game.state.landmarks.claimed[def.id] === true;
  const cleared = !def.defended || game.state.landmarks.cleared[def.id] === true;
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
    disabledReason: !cleared ? 'An enemy warband holds this place' : undefined,
  }));
  return panel(body);
}

function ruinCard(game: Game, def: RuinDef): HTMLElement {
  const fullTime = Array.from({ length: def.maxDepth }, (_, i) =>
    def.baseDepthSeconds * def.depthGrowth ** i).reduce((a, b) => a + b, 0);

  const body = el('div', { class: 'site' },
    el('div', { class: 'site-head' },
      art(def.sprite, def.glyph),
      el('div', {},
        el('div', { class: 'site-name' }, def.name),
        el('div', { class: 'site-kind' }, `Tier ${def.tier} ruin`))),
    el('div', { class: 'site-desc' }, def.description),
    el('div', { class: 'site-stats' },
      stat('unknown', String(def.maxDepth), 'depths'),
      stat('hourglass', formatDuration(fullTime), 'to the bottom'),
      stat(def.affinity === 'Any' ? 'army' : def.affinity, def.affinity === 'Any'
        ? 'anything' : `${def.affinity}s`, 'answer best')),
  );

  body.append(el('div', { class: 'site-note' },
    'A dungeon, not a chest: it can be delved again and again. The first party '
    + 'to reach the bottom brings back its relic.'));

  // The launch control is expeditions' to own; everything above is content
  // the player can read the moment the fog comes off it.
  body.append(action({
    label: 'Send a party',
    kind: 'primary',
    onClick: () => game.openExpedition(def.id),
    disabledReason: game.expeditionBlock(def.id) ?? undefined,
  }));
  return panel(body);
}

/** Null when the cell holds no site — the caller then shows nothing. */
export function renderSiteCard(game: Game, cell: Coord): HTMLElement | null {
  const landmark = landmarkDefAt(cell);
  if (landmark) return landmarkCard(game, landmark);
  const ruin = ruinDefAt(cell);
  if (ruin) return ruinCard(game, ruin);
  return null;
}
