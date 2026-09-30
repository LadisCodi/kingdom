// The card for a map SITE — a landmark, or a lair (`lairCardScreen`).
//
// These are what paid fog is FOR. A player who clears a distance-9 ring and
// finds one more iron vein has learned that exploring is a treadmill; a player
// who finds a shrine that pays Mana forever, or a lair worth clearing,
// has learned the opposite. So the card's job is to make the reward
// legible BEFORE the player spends anything — what it gives, what it costs,
// and, when it is out of reach, exactly what is missing.

import {
  FOG, LAIRS, LANDMARK_ART, MANA, type LandmarkDef,
} from '../sim/data/definitions';
import type { LairView, RaidableId } from '../sim/lairs';
import type { Game } from '../game';
import { landmarkClaimCost } from '../sim/landmarks';
import { manaCap } from '../sim/mana';
import { releaseSprites, spriteImgAt, spriteUrl } from '../render/sprites';
import type { Coord, LairId } from '../sim/state';
import { landmarkDefAt } from '../sim/sites';
import { el, formatDuration } from './format';
import { action, btn, closeKnob, iconEl, panel, sectionHead, stat, windowHead, type IconName } from './kit';
import type { Screen } from './kit/host';

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
 * THE LAIR'S CARD (Docs/proposals/lairs.md §6) — the district card's frame,
 * and five things in it, top to bottom:
 *
 *   the name, on the plain title plank;
 *   the painting of the creature at its worst, with its flavour line;
 *   the countdown, said as the threat it is;
 *   the reward — the hoard it carries, then Hero XP and Knowledge;
 *   Attack, which opens the attack screen — or, once the garrison is
 *   beaten, Claim, which pays the reward and strikes the lair from the map.
 *
 * Nothing else. The enemy's squads and power are the attack screen's, and a
 * raid count is never shown anywhere. Built ONCE per lair; a tick rewrites
 * the countdown's text and nothing else.
 */
export function lairCardScreen(game: Game, lairId: LairId): Screen {
  const def = LAIRS[lairId];
  const root = el('div', { class: 'dc lc' });
  const frame = el('div', { class: 'k-frame', 'aria-hidden': 'true' });
  const clock = el('b', { class: 'lc-clock-value' });
  let signature: string | null = null;

  const build = (lair: LairView): void => {
    const art = spriteUrl(`lair_art_${lairId.toLowerCase()}`);
    const figure = el('div', { class: 'lc-art k-section' },
      art ? spriteImgAt(art, 'lc-art-img') : el('div', { class: 'lc-art-glyph' }, def.glyph),
      el('p', { class: 'lc-flavour' }, def.flavour));

    // Beaten, the clock has stopped for good: the box says so, and the
    // button under the reward is the claim (Docs/proposals/lairs.md §5).
    const timer = lair.defeated
      ? el('div', { class: 'lc-clock k-section is-beaten' },
        iconEl('tick', { size: 'lg' }),
        el('div', { class: 'lc-clock-body' },
          el('div', { class: 'lc-clock-label' },
            `${lair.creature} ${lair.creature.startsWith('A ') ? 'is' : 'are'} beaten`),
          el('b', { class: 'lc-clock-value' }, 'Claim what they left behind')))
      : el('div', { class: 'lc-clock k-section' },
        iconEl('hourglass', { size: 'lg' }),
        el('div', { class: 'lc-clock-body' },
          el('div', { class: 'lc-clock-label' }, 'They will attack your city in'),
          clock));

    // The hoard first: it is what the raids took, and clearing the lair is
    // how it comes back — so it is the reward rather than a report.
    const chips: HTMLElement[] = [];
    for (const [c, n] of Object.entries(lair.hoard) as Array<[RaidableId, number]>) {
      if (n <= 0) continue;
      chips.push(rewardChip(c, String(n), lair.hoardFull[c] === true ? 'full' : undefined));
    }
    const reward = game.lairReward(lairId);
    if (reward.heroXp > 0) chips.push(rewardChip('HeroXp', String(reward.heroXp)));
    if (reward.knowledge > 0) chips.push(rewardChip('Knowledge', String(reward.knowledge)));

    root.replaceChildren(frame,
      windowHead(def.name, [closeKnob(() => game.dismiss(), `Close ${def.name}`)]),
      figure,
      timer,
      sectionHead('Reward'),
      el('div', { class: 'lc-reward' }, ...chips),
      el('div', { class: 'lc-go' }, lair.defeated
        ? btn({ label: 'Claim', kind: 'primary', onClick: () => game.doClaimLair(lairId) })
        : btn({ label: 'Attack', kind: 'primary', onClick: () => game.openLair(lairId) })));
  };

  return {
    root,
    refresh: () => {
      const lair = game.lairFor(lairId);
      if (lair === null || lair.cleared) {
        releaseSprites(root);
        root.replaceChildren();
        signature = null;
        return;
      }
      // Rebuilt only when what it SAYS moves — the hoard; a tick in between
      // touches the countdown's text alone.
      const now = JSON.stringify(lair.hoard) + JSON.stringify(lair.hoardFull) + String(lair.defeated);
      if (now !== signature) {
        signature = now;
        releaseSprites(root);
        build(lair);
      }
      const left = lair.nextRaidAt === null ? 0 : Math.max(0, (lair.nextRaidAt - game.now()) / 1000);
      clock.textContent = formatDuration(left);
    },
  };
}

/** One tile of the reward row: the icon, the amount, and a word under it
 *  when the lair carries all it can of that material. */
function rewardChip(icon: IconName, value: string, tag?: string): HTMLElement {
  return el('div', { class: 'lc-chip k-section' },
    iconEl(icon, { size: 'lg' }),
    el('b', { class: 'lc-chip-value' }, value),
    ...(tag ? [el('span', { class: 'lc-chip-tag' }, tag)] : []));
}

/** Null when the cell holds no landmark — the caller then shows nothing. A
 *  lair has a screen of its own (`lairCardScreen`). */
export function renderSiteCard(game: Game, cell: Coord): HTMLElement | null {
  const landmark = landmarkDefAt(cell);
  if (landmark) return landmarkCard(game, landmark);
  return null;
}
